"""seed full reference geography (countries/states/cities) from dr5hn dataset

Loads the complete dr5hn/countries-states-cities-database (release v3.2-export.5,
ODbL v1.0) into the references schema:

    countries        196 -> 250  (top-up only; existing UUIDs preserved so
                                  guests.country_id FKs stay intact)
    states_provinces 158 -> ~5,256 (wiped + reloaded for ALL countries)
    cities           337 -> ~152,967 (wiped + reloaded for ALL countries)

The curated 0017 city seed used two partial unique indexes to stay idempotent.
The full dataset legitimately contains duplicate (state, name) pairs (distinct
localities sharing a name), so those indexes are dropped and replaced with a
pg_trgm GIN index that keeps the substring city search fast at 150k+ rows.

Source data is vendored gzipped under alembic/data/dr5hn/ and loaded via batched
inserts (driver-agnostic; works under the asyncpg migration runner).

Revision ID: 0019
Revises: 0018
Create Date: 2026-06-30

"""
import os
import csv
import gzip
import uuid
from decimal import Decimal, InvalidOperation
from typing import Optional, Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "dr5hn")
CITY_BATCH = 5000
STATE_BATCH = 1000

_LATLON = Decimal("0.000001")


def _clean(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    return v or None


def _num(v: Optional[str]) -> Optional[Decimal]:
    v = _clean(v)
    if v is None:
        return None
    try:
        return Decimal(v).quantize(_LATLON)
    except (InvalidOperation, ValueError):
        return None


def _read_rows(filename: str) -> list:
    path = os.path.join(DATA_DIR, filename)
    with gzip.open(path, mode="rt", encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def _chunked_execute(bind, stmt, rows: list, size: int) -> None:
    for i in range(0, len(rows), size):
        bind.execute(stmt, rows[i:i + size])


def upgrade() -> None:
    bind = op.get_bind()

    # ── 1. Drop curated-seed unique indexes (incompatible with full dataset) ──
    op.execute('DROP INDEX IF EXISTS "references".uq_ref_cities_state_city')
    op.execute('DROP INDEX IF EXISTS "references".uq_ref_cities_country_city_no_state')

    # ── 2. Wipe curated states + cities (countries kept to preserve guest FKs) ─
    op.execute('DELETE FROM "references".cities')
    op.execute('DELETE FROM "references".states_provinces')

    # ── 3. Top-up countries (insert only the missing ISO2 codes) ──────────────
    country_insert = sa.text("""
        INSERT INTO "references".countries
            (iso2_code, iso3_code, numeric_code, country_name,
             phone_code, currency_code, currency_name, nationality, continent)
        VALUES
            (:iso2, :iso3, :numeric, :name,
             :phone, :curr, :curr_name, :nat, :continent)
        ON CONFLICT (iso2_code) DO NOTHING
    """)
    country_rows = [
        {
            "iso2": _clean(c["iso2"]),
            "iso3": _clean(c["iso3"]),
            "numeric": _clean(c["numeric_code"]),
            "name": c["name"].strip(),
            "phone": _clean(c["phonecode"]),
            "curr": _clean(c["currency"]),
            "curr_name": _clean(c["currency_name"]),
            "nat": _clean(c["nationality"]),
            "continent": _clean(c["region"]),
        }
        for c in _read_rows("countries.csv.gz")
    ]
    bind.execute(country_insert, country_rows)

    # Map every ISO2 -> our country UUID (existing + newly inserted)
    country_uuid: dict[str, uuid.UUID] = {
        iso2: cid
        for cid, iso2 in bind.execute(
            sa.text('SELECT id, iso2_code FROM "references".countries')
        )
    }

    # ── 4. Load all states/provinces (pre-generate UUIDs for FK mapping) ──────
    # dr5hn cities reference states by integer id; we keep src_id -> our UUID so
    # cities can be linked. Duplicate (country, name) rows collapse onto one row
    # (our uq_ref_states_country_name forbids dupes) but still remap their cities.
    state_uuid_by_src: dict[str, uuid.UUID] = {}
    uuid_by_country_name: dict[tuple, uuid.UUID] = {}
    state_rows = []
    for s in _read_rows("states.csv.gz"):
        cc = s["country_code"]
        cid = country_uuid.get(cc)
        if cid is None:
            continue
        name = s["name"].strip()
        key = (cc, name)
        existing = uuid_by_country_name.get(key)
        if existing is not None:
            state_uuid_by_src[s["id"]] = existing
            continue
        new_id = uuid.uuid4()
        uuid_by_country_name[key] = new_id
        state_uuid_by_src[s["id"]] = new_id
        state_rows.append({
            "id": new_id,
            "country_id": cid,
            "state_code": _clean(s.get("iso2")),
            "state_name": name,
            "type": _clean(s.get("type")),
        })

    state_insert = sa.text("""
        INSERT INTO "references".states_provinces
            (id, country_id, state_code, state_name, type)
        VALUES (:id, :country_id, :state_code, :state_name, :type)
    """)
    _chunked_execute(bind, state_insert, state_rows, STATE_BATCH)

    # ── 5. Load all cities (streamed in batches to bound memory) ──────────────
    city_insert = sa.text("""
        INSERT INTO "references".cities
            (id, country_id, state_province_id, city_name, latitude, longitude, timezone)
        VALUES (:id, :country_id, :state_province_id, :city_name, :latitude, :longitude, :timezone)
    """)
    batch = []
    path = os.path.join(DATA_DIR, "cities.csv.gz")
    with gzip.open(path, mode="rt", encoding="utf-8", newline="") as fh:
        for c in csv.DictReader(fh):
            cid = country_uuid.get(c["country_code"])
            if cid is None:
                continue
            batch.append({
                "id": uuid.uuid4(),
                "country_id": cid,
                "state_province_id": state_uuid_by_src.get(c["state_id"]),
                "city_name": c["name"].strip(),
                "latitude": _num(c.get("latitude")),
                "longitude": _num(c.get("longitude")),
                "timezone": _clean(c.get("timezone")),
            })
            if len(batch) >= CITY_BATCH:
                bind.execute(city_insert, batch)
                batch = []
    if batch:
        bind.execute(city_insert, batch)

    # ── 6. Fast substring search index for the city autocomplete ──────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_ref_cities_name_trgm
        ON "references".cities USING gin (lower(city_name) gin_trgm_ops)
    """)


def downgrade() -> None:
    # Restore the curated (0016/0017) reference state for states + cities.
    # Countries are left as a benign superset (removing the topped-up rows could
    # orphan guests.country_id references).
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from data.states_full import PH_PROVINCES, US_STATES, AU_STATES, CA_PROVINCES
    from data.cities_full import PH_CITIES, US_CITIES, AU_CITIES, CA_CITIES, WORLD_CITIES

    op.execute('DROP INDEX IF EXISTS "references".ix_ref_cities_name_trgm')
    op.execute('DELETE FROM "references".cities')
    op.execute('DELETE FROM "references".states_provinces')

    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_ref_cities_state_city
        ON "references".cities (state_province_id, city_name)
        WHERE state_province_id IS NOT NULL
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_ref_cities_country_city_no_state
        ON "references".cities (country_id, city_name)
        WHERE state_province_id IS NULL
    """)

    def _seed_states(iso2: str, rows: list) -> None:
        for (code, name, stype) in rows:
            op.execute(sa.text("""
                INSERT INTO "references".states_provinces (country_id, state_code, state_name, type)
                SELECT c.id, :code, :name, :type
                FROM "references".countries c WHERE c.iso2_code = :iso2
                ON CONFLICT (country_id, state_name) DO NOTHING
            """).bindparams(iso2=iso2, code=code, name=name, type=stype))

    _seed_states("PH", PH_PROVINCES)
    _seed_states("US", US_STATES)
    _seed_states("AU", AU_STATES)
    _seed_states("CA", CA_PROVINCES)

    def _seed_state_city(city_name, iso2, state_code, lat, lon, tz):
        op.execute(sa.text("""
            INSERT INTO "references".cities
                (country_id, state_province_id, city_name, latitude, longitude, timezone)
            SELECT c.id, sp.id, :city_name, :lat, :lon, :tz
            FROM "references".countries c
            JOIN "references".states_provinces sp
                ON sp.country_id = c.id AND sp.state_code = :state_code
            WHERE c.iso2_code = :iso2
            ON CONFLICT (state_province_id, city_name)
            WHERE state_province_id IS NOT NULL
            DO NOTHING
        """).bindparams(city_name=city_name, iso2=iso2, state_code=state_code, lat=lat, lon=lon, tz=tz))

    def _seed_world_city(city_name, iso2, lat, lon, tz):
        op.execute(sa.text("""
            INSERT INTO "references".cities
                (country_id, city_name, latitude, longitude, timezone)
            SELECT c.id, :city_name, :lat, :lon, :tz
            FROM "references".countries c
            WHERE c.iso2_code = :iso2
            ON CONFLICT (country_id, city_name)
            WHERE state_province_id IS NULL
            DO NOTHING
        """).bindparams(city_name=city_name, iso2=iso2, lat=lat, lon=lon, tz=tz))

    for row in PH_CITIES:
        _seed_state_city(*row)
    for row in US_CITIES:
        _seed_state_city(*row)
    for row in AU_CITIES:
        _seed_state_city(*row)
    for row in CA_CITIES:
        _seed_state_city(*row)
    for row in WORLD_CITIES:
        _seed_world_city(*row)

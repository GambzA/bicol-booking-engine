"""seed reference cities with world capitals and major cities

Revision ID: 0017
Revises: 0016
Create Date: 2026-06-27

"""
import sys
import os
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from data.cities_full import PH_CITIES, US_CITIES, AU_CITIES, CA_CITIES, WORLD_CITIES

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "references"


def upgrade() -> None:
    # ── 1. Add South Korea (missing from 0016 countries seed) ────────────────
    op.execute(sa.text("""
        INSERT INTO "references".countries
            (iso2_code, iso3_code, numeric_code, country_name, official_name,
             phone_code, currency_code, currency_name, nationality, continent)
        VALUES
            ('KR', 'KOR', '410', 'South Korea', 'Republic of Korea',
             '+82', 'KRW', 'South Korean Won', 'Korean', 'Asia')
        ON CONFLICT (iso2_code) DO NOTHING
    """))

    # ── 2. Partial unique indexes for idempotent city seeding ─────────────────
    op.execute(sa.text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_ref_cities_state_city
        ON "references".cities (state_province_id, city_name)
        WHERE state_province_id IS NOT NULL
    """))
    op.execute(sa.text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_ref_cities_country_city_no_state
        ON "references".cities (country_id, city_name)
        WHERE state_province_id IS NULL
    """))

    # ── 3. Seed helpers ───────────────────────────────────────────────────────
    def _seed_state_city(city_name, iso2, state_code, lat, lon, tz):
        """Insert a city linked to a specific state/province."""
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
        """).bindparams(
            city_name=city_name, iso2=iso2, state_code=state_code,
            lat=lat, lon=lon, tz=tz,
        ))

    def _seed_world_city(city_name, iso2, lat, lon, tz):
        """Insert a city with country linkage only (no state)."""
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

    # ── 4. Seed state-linked cities ───────────────────────────────────────────
    for row in PH_CITIES:
        _seed_state_city(*row)
    for row in US_CITIES:
        _seed_state_city(*row)
    for row in AU_CITIES:
        _seed_state_city(*row)
    for row in CA_CITIES:
        _seed_state_city(*row)

    # ── 5. Seed world capitals + global major cities ──────────────────────────
    for row in WORLD_CITIES:
        _seed_world_city(*row)


def downgrade() -> None:
    op.execute(sa.text("""
        DROP INDEX IF EXISTS "references".uq_ref_cities_state_city
    """))
    op.execute(sa.text("""
        DROP INDEX IF EXISTS "references".uq_ref_cities_country_city_no_state
    """))
    op.execute(sa.text("""
        DELETE FROM "references".cities
    """))
    op.execute(sa.text("""
        DELETE FROM "references".countries WHERE iso2_code = 'KR'
    """))

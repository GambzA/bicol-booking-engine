"""restructure reference data into references schema with full country/state/city tables

Revision ID: 0016
Revises: 0015
Create Date: 2026-06-27

"""
import sys
import os
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from data.countries_full import COUNTRIES_FULL
from data.states_full import PH_PROVINCES, US_STATES, AU_STATES, CA_PROVINCES

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "references"


def upgrade() -> None:
    # ── 1. Create schema ─────────────────────────────────────────────────────
    op.execute(sa.text('CREATE SCHEMA IF NOT EXISTS "references"'))

    # ── 2. references.countries ───────────────────────────────────────────────
    op.create_table(
        "countries",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("iso2_code", sa.String(2), nullable=False),
        sa.Column("iso3_code", sa.String(3), nullable=True),
        sa.Column("numeric_code", sa.String(3), nullable=True),
        sa.Column("country_name", sa.String(255), nullable=False),
        sa.Column("official_name", sa.String(500), nullable=True),
        sa.Column("phone_code", sa.String(20), nullable=True),
        sa.Column("currency_code", sa.String(3), nullable=True),
        sa.Column("currency_name", sa.String(100), nullable=True),
        sa.Column("nationality", sa.String(150), nullable=True),
        sa.Column("continent", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("iso2_code", name="uq_ref_countries_iso2"),
        schema=SCHEMA,
    )
    op.create_index("ix_ref_countries_iso2", "countries", ["iso2_code"], schema=SCHEMA)
    op.create_index("ix_ref_countries_iso3", "countries", ["iso3_code"], schema=SCHEMA)
    op.create_index("ix_ref_countries_name", "countries", ["country_name"], schema=SCHEMA)

    # ── 3. references.states_provinces ────────────────────────────────────────
    op.create_table(
        "states_provinces",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("country_id", sa.UUID(), nullable=False),
        sa.Column("state_code", sa.String(20), nullable=True),
        sa.Column("state_name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("country_id", "state_name", name="uq_ref_states_country_name"),
        schema=SCHEMA,
    )
    op.create_index("ix_ref_states_country_id", "states_provinces", ["country_id"], schema=SCHEMA)
    op.create_index("ix_ref_states_name", "states_provinces", ["state_name"], schema=SCHEMA)
    op.create_foreign_key(
        "fk_ref_states_country_id",
        "states_provinces", "countries",
        ["country_id"], ["id"],
        source_schema=SCHEMA, referent_schema=SCHEMA,
        ondelete="CASCADE",
    )

    # ── 4. references.cities ─────────────────────────────────────────────────
    op.create_table(
        "cities",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("country_id", sa.UUID(), nullable=False),
        sa.Column("state_province_id", sa.UUID(), nullable=True),
        sa.Column("city_name", sa.String(255), nullable=False),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("timezone", sa.String(100), nullable=True),
        sa.Column("postal_code_pattern", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index("ix_ref_cities_country_id", "cities", ["country_id"], schema=SCHEMA)
    op.create_index("ix_ref_cities_state_id", "cities", ["state_province_id"], schema=SCHEMA)
    op.create_index("ix_ref_cities_name", "cities", ["city_name"], schema=SCHEMA)
    op.create_foreign_key(
        "fk_ref_cities_country_id",
        "cities", "countries",
        ["country_id"], ["id"],
        source_schema=SCHEMA, referent_schema=SCHEMA,
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_ref_cities_state_id",
        "cities", "states_provinces",
        ["state_province_id"], ["id"],
        source_schema=SCHEMA, referent_schema=SCHEMA,
        ondelete="SET NULL",
    )

    # ── 5. Seed countries ─────────────────────────────────────────────────────
    for (iso2, iso3, numeric, name, official, phone, curr_code, curr_name, nationality, continent) in COUNTRIES_FULL:
        op.execute(sa.text("""
            INSERT INTO "references".countries
                (iso2_code, iso3_code, numeric_code, country_name, official_name,
                 phone_code, currency_code, currency_name, nationality, continent)
            VALUES
                (:iso2, :iso3, :numeric, :name, :official,
                 :phone, :curr_code, :curr_name, :nationality, :continent)
            ON CONFLICT (iso2_code) DO NOTHING
        """).bindparams(
            iso2=iso2, iso3=iso3, numeric=numeric, name=name, official=official,
            phone=phone, curr_code=curr_code, curr_name=curr_name,
            nationality=nationality, continent=continent,
        ))

    # ── 6. Seed states/provinces ──────────────────────────────────────────────
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

    # ── 7. Migrate guests.country_id to new UUIDs ─────────────────────────────
    # guests.country_id currently points to reference_countries.id (old table).
    # Map via iso2 -> iso2_code to get the new UUID.
    op.drop_constraint("fk_guests_country_id", "guests", type_="foreignkey")

    op.execute(sa.text("""
        UPDATE guests g
        SET country_id = new_c.id
        FROM "references".countries new_c
        JOIN reference_countries old_c ON old_c.iso2 = new_c.iso2_code
        WHERE g.country_id = old_c.id
          AND g.country_id IS NOT NULL
    """))

    op.create_foreign_key(
        "fk_guests_country_id",
        "guests",
        "countries",
        ["country_id"],
        ["id"],
        referent_schema=SCHEMA,
        ondelete="SET NULL",
    )

    # ── 8. Drop old reference tables ──────────────────────────────────────────
    op.drop_index("ix_reference_provinces_country_id", table_name="reference_provinces")
    op.drop_table("reference_provinces")
    op.drop_index("ix_reference_countries_iso2", table_name="reference_countries")
    op.drop_table("reference_countries")


def downgrade() -> None:
    # Recreate old public-schema tables
    op.create_table(
        "reference_countries",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("iso2", sa.String(2), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("iso2", name="uq_reference_countries_iso2"),
    )
    op.create_index("ix_reference_countries_iso2", "reference_countries", ["iso2"])

    op.execute(sa.text("""
        INSERT INTO reference_countries (iso2, name)
        SELECT iso2_code, country_name FROM "references".countries
    """))

    op.create_table(
        "reference_provinces",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("country_id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(20), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["country_id"], ["reference_countries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reference_provinces_country_id", "reference_provinces", ["country_id"])

    op.drop_constraint("fk_guests_country_id", "guests", type_="foreignkey")

    op.execute(sa.text("""
        UPDATE guests g
        SET country_id = old_c.id
        FROM reference_countries old_c
        JOIN "references".countries new_c ON new_c.iso2_code = old_c.iso2
        WHERE g.country_id = new_c.id
          AND g.country_id IS NOT NULL
    """))

    op.create_foreign_key(
        "fk_guests_country_id", "guests", "reference_countries",
        ["country_id"], ["id"], ondelete="SET NULL",
    )

    op.drop_index("ix_ref_cities_name", table_name="cities", schema=SCHEMA)
    op.drop_index("ix_ref_cities_state_id", table_name="cities", schema=SCHEMA)
    op.drop_index("ix_ref_cities_country_id", table_name="cities", schema=SCHEMA)
    op.drop_table("cities", schema=SCHEMA)
    op.drop_index("ix_ref_states_name", table_name="states_provinces", schema=SCHEMA)
    op.drop_index("ix_ref_states_country_id", table_name="states_provinces", schema=SCHEMA)
    op.drop_table("states_provinces", schema=SCHEMA)
    op.drop_index("ix_ref_countries_name", table_name="countries", schema=SCHEMA)
    op.drop_index("ix_ref_countries_iso3", table_name="countries", schema=SCHEMA)
    op.drop_index("ix_ref_countries_iso2", table_name="countries", schema=SCHEMA)
    op.drop_table("countries", schema=SCHEMA)
    op.execute(sa.text('DROP SCHEMA IF EXISTS "references"'))

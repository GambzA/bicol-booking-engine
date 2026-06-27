"""create reference_countries and reference_provinces tables with seed data

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-27

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COUNTRIES = [
    ("AF", "Afghanistan"), ("AL", "Albania"), ("DZ", "Algeria"), ("AD", "Andorra"),
    ("AO", "Angola"), ("AG", "Antigua and Barbuda"), ("AR", "Argentina"), ("AM", "Armenia"),
    ("AU", "Australia"), ("AT", "Austria"), ("AZ", "Azerbaijan"), ("BS", "Bahamas"),
    ("BH", "Bahrain"), ("BD", "Bangladesh"), ("BB", "Barbados"), ("BY", "Belarus"),
    ("BE", "Belgium"), ("BZ", "Belize"), ("BJ", "Benin"), ("BT", "Bhutan"),
    ("BO", "Bolivia"), ("BA", "Bosnia and Herzegovina"), ("BW", "Botswana"), ("BR", "Brazil"),
    ("BN", "Brunei"), ("BG", "Bulgaria"), ("BF", "Burkina Faso"), ("BI", "Burundi"),
    ("CV", "Cabo Verde"), ("KH", "Cambodia"), ("CM", "Cameroon"), ("CA", "Canada"),
    ("CF", "Central African Republic"), ("TD", "Chad"), ("CL", "Chile"), ("CN", "China"),
    ("CO", "Colombia"), ("KM", "Comoros"), ("CG", "Congo"), ("CD", "Congo (DRC)"),
    ("CR", "Costa Rica"), ("HR", "Croatia"), ("CU", "Cuba"), ("CY", "Cyprus"),
    ("CZ", "Czech Republic"), ("DK", "Denmark"), ("DJ", "Djibouti"), ("DM", "Dominica"),
    ("DO", "Dominican Republic"), ("EC", "Ecuador"), ("EG", "Egypt"), ("SV", "El Salvador"),
    ("GQ", "Equatorial Guinea"), ("ER", "Eritrea"), ("EE", "Estonia"), ("SZ", "Eswatini"),
    ("ET", "Ethiopia"), ("FJ", "Fiji"), ("FI", "Finland"), ("FR", "France"),
    ("GA", "Gabon"), ("GM", "Gambia"), ("GE", "Georgia"), ("DE", "Germany"),
    ("GH", "Ghana"), ("GR", "Greece"), ("GD", "Grenada"), ("GT", "Guatemala"),
    ("GN", "Guinea"), ("GW", "Guinea-Bissau"), ("GY", "Guyana"), ("HT", "Haiti"),
    ("HN", "Honduras"), ("HK", "Hong Kong"), ("HU", "Hungary"), ("IS", "Iceland"),
    ("IN", "India"), ("ID", "Indonesia"), ("IR", "Iran"), ("IQ", "Iraq"),
    ("IE", "Ireland"), ("IL", "Israel"), ("IT", "Italy"), ("JM", "Jamaica"),
    ("JP", "Japan"), ("JO", "Jordan"), ("KZ", "Kazakhstan"), ("KE", "Kenya"),
    ("KI", "Kiribati"), ("KW", "Kuwait"), ("KG", "Kyrgyzstan"), ("LA", "Laos"),
    ("LV", "Latvia"), ("LB", "Lebanon"), ("LS", "Lesotho"), ("LR", "Liberia"),
    ("LY", "Libya"), ("LI", "Liechtenstein"), ("LT", "Lithuania"), ("LU", "Luxembourg"),
    ("MO", "Macau"), ("MG", "Madagascar"), ("MW", "Malawi"), ("MY", "Malaysia"),
    ("MV", "Maldives"), ("ML", "Mali"), ("MT", "Malta"), ("MH", "Marshall Islands"),
    ("MR", "Mauritania"), ("MU", "Mauritius"), ("MX", "Mexico"), ("FM", "Micronesia"),
    ("MD", "Moldova"), ("MC", "Monaco"), ("MN", "Mongolia"), ("ME", "Montenegro"),
    ("MA", "Morocco"), ("MZ", "Mozambique"), ("MM", "Myanmar"), ("NA", "Namibia"),
    ("NR", "Nauru"), ("NP", "Nepal"), ("NL", "Netherlands"), ("NZ", "New Zealand"),
    ("NI", "Nicaragua"), ("NE", "Niger"), ("NG", "Nigeria"), ("NO", "Norway"),
    ("OM", "Oman"), ("PK", "Pakistan"), ("PW", "Palau"), ("PA", "Panama"),
    ("PG", "Papua New Guinea"), ("PY", "Paraguay"), ("PE", "Peru"), ("PH", "Philippines"),
    ("PL", "Poland"), ("PT", "Portugal"), ("QA", "Qatar"), ("RO", "Romania"),
    ("RU", "Russia"), ("RW", "Rwanda"), ("KN", "Saint Kitts and Nevis"), ("LC", "Saint Lucia"),
    ("VC", "Saint Vincent and the Grenadines"), ("WS", "Samoa"), ("SM", "San Marino"),
    ("ST", "Sao Tome and Principe"), ("SA", "Saudi Arabia"), ("SN", "Senegal"),
    ("RS", "Serbia"), ("SC", "Seychelles"), ("SL", "Sierra Leone"), ("SG", "Singapore"),
    ("SK", "Slovakia"), ("SI", "Slovenia"), ("SB", "Solomon Islands"), ("SO", "Somalia"),
    ("ZA", "South Africa"), ("SS", "South Sudan"), ("ES", "Spain"), ("LK", "Sri Lanka"),
    ("SD", "Sudan"), ("SR", "Suriname"), ("SE", "Sweden"), ("CH", "Switzerland"),
    ("SY", "Syria"), ("TW", "Taiwan"), ("TJ", "Tajikistan"), ("TZ", "Tanzania"),
    ("TH", "Thailand"), ("TL", "Timor-Leste"), ("TG", "Togo"), ("TO", "Tonga"),
    ("TT", "Trinidad and Tobago"), ("TN", "Tunisia"), ("TR", "Turkey"), ("TM", "Turkmenistan"),
    ("TV", "Tuvalu"), ("UG", "Uganda"), ("UA", "Ukraine"), ("AE", "United Arab Emirates"),
    ("GB", "United Kingdom"), ("US", "United States"), ("UY", "Uruguay"), ("UZ", "Uzbekistan"),
    ("VU", "Vanuatu"), ("VE", "Venezuela"), ("VN", "Vietnam"), ("YE", "Yemen"),
    ("ZM", "Zambia"), ("ZW", "Zimbabwe"),
]

# Philippines provinces (code: 2-letter provincial code, name)
PH_PROVINCES = [
    # Ilocos Region (I)
    ("ILN", "Ilocos Norte"), ("ILS", "Ilocos Sur"), ("LAU", "La Union"), ("PAN", "Pangasinan"),
    # Cagayan Valley (II)
    ("BTN", "Batanes"), ("CAG", "Cagayan"), ("ISA", "Isabela"), ("NUV", "Nueva Vizcaya"), ("QUI", "Quirino"),
    # Central Luzon (III)
    ("AUR", "Aurora"), ("BAT", "Bataan"), ("BUL", "Bulacan"), ("NUE", "Nueva Ecija"),
    ("PAM", "Pampanga"), ("TAR", "Tarlac"), ("ZMB", "Zambales"),
    # CALABARZON (IV-A)
    ("BTG", "Batangas"), ("CAV", "Cavite"), ("LAG", "Laguna"), ("QUE", "Quezon"), ("RIZ", "Rizal"),
    # MIMAROPA (IV-B)
    ("MAD", "Marinduque"), ("OCC", "Occidental Mindoro"), ("ORI", "Oriental Mindoro"),
    ("PLW", "Palawan"), ("ROM", "Romblon"),
    # Bicol (V)
    ("ALB", "Albay"), ("CAN", "Camarines Norte"), ("CAS", "Camarines Sur"),
    ("CAT", "Catanduanes"), ("MAS", "Masbate"), ("SOR", "Sorsogon"),
    # Western Visayas (VI)
    ("AKL", "Aklan"), ("ANT", "Antique"), ("CAP", "Capiz"), ("GUI", "Guimaras"),
    ("ILO", "Iloilo"), ("NEC", "Negros Occidental"),
    # Central Visayas (VII)
    ("BOH", "Bohol"), ("CEB", "Cebu"), ("NER", "Negros Oriental"), ("SIG", "Siquijor"),
    # Eastern Visayas (VIII)
    ("BIL", "Biliran"), ("EAS", "Eastern Samar"), ("LEY", "Leyte"),
    ("NOS", "Northern Samar"), ("SAM", "Samar"), ("SOL", "Southern Leyte"),
    # Zamboanga Peninsula (IX)
    ("ZAN", "Zamboanga del Norte"), ("ZAS", "Zamboanga del Sur"), ("ZSI", "Zamboanga Sibugay"),
    # Northern Mindanao (X)
    ("BUK", "Bukidnon"), ("CAM", "Camiguin"), ("LAN", "Lanao del Norte"),
    ("MSC", "Misamis Occidental"), ("MSR", "Misamis Oriental"),
    # Davao Region (XI)
    ("DAC", "Davao de Oro"), ("DAD", "Davao del Norte"), ("DAS", "Davao del Sur"),
    ("DAO", "Davao Occidental"), ("DAR", "Davao Oriental"),
    # SOCCSKSARGEN (XII)
    ("NCO", "Cotabato"), ("SAR", "Sarangani"), ("SCO", "South Cotabato"), ("SUK", "Sultan Kudarat"),
    # Caraga (XIII)
    ("AGN", "Agusan del Norte"), ("AGS", "Agusan del Sur"), ("DIN", "Dinagat Islands"),
    ("SUN", "Surigao del Norte"), ("SUR", "Surigao del Sur"),
    # CAR
    ("ABR", "Abra"), ("APA", "Apayao"), ("BEN", "Benguet"), ("IFU", "Ifugao"),
    ("KAL", "Kalinga"), ("MTP", "Mountain Province"),
    # BARMM
    ("BAS", "Basilan"), ("LDS", "Lanao del Sur"), ("MGN", "Maguindanao del Norte"),
    ("MGS", "Maguindanao del Sur"), ("SLU", "Sulu"), ("TAW", "Tawi-Tawi"),
]


def upgrade() -> None:
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

    # Seed countries
    for iso2, name in COUNTRIES:
        op.execute(sa.text(
            "INSERT INTO reference_countries (id, iso2, name) VALUES (gen_random_uuid(), :iso2, :name)"
        ).bindparams(iso2=iso2, name=name))

    # Seed Philippines provinces
    for code, name in PH_PROVINCES:
        op.execute(sa.text("""
            INSERT INTO reference_provinces (id, country_id, code, name)
            SELECT gen_random_uuid(), rc.id, :code, :name
            FROM reference_countries rc WHERE rc.iso2 = 'PH'
        """).bindparams(code=code, name=name))


def downgrade() -> None:
    op.drop_index("ix_reference_provinces_country_id", table_name="reference_provinces")
    op.drop_table("reference_provinces")
    op.drop_index("ix_reference_countries_iso2", table_name="reference_countries")
    op.drop_table("reference_countries")

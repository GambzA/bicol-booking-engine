## Personas

| Role | Name | Description |
|------|------|-------------|
| Admin | June | Platform administrator. Manages hotels, plans, and system-wide settings via the admin portal. |
| Property Owner | Vivian | Hotel/property owner. Manages accommodations, bookings, guests, and availability via the property portal. |
| Guest | Peter | End guest. Makes bookings and interacts with the booking-facing experience. |

Use these personas when writing user stories, test scenarios, or feature descriptions.

## Important Rules

Read existing files before writing. Don't re-read unless changed.
Thorough in reasoning, concise in output.
Skip files over 100KB unless required.
No sycophantic openers or closing fluff.
No emojis or em-dashes.
Do not guess APIs, versions, flags, commit SHAs, or package names. Verify by reading code or docs before asserting.
Put repeating enums in a shared constant file in /constants.
Avoid json data types in Postgresql. As much as possible follow a normalized approach.
Keep PROGRESS.md up to date

## Frontend Form Layout Standard

All create/edit forms must use `frontend/src/components/common/FormLayout.tsx`.

### Components

- `FormPage` -- min-h-screen slate-50 background wrapper.
- `FormHeader` -- sticky top-0 header with back arrow, title, subtitle, and an `actions` slot (Cancel + Save buttons).
- `FormBody` -- max-w-4xl centered container with vertical spacing between section cards.
- `SectionCard` -- numbered card with circle badge. Props: `number`, `title`, optional `id` (scroll anchor), optional `grid` (enables 2-col internal grid).
- `Field` -- label wrapper with required asterisk, optional `error`, optional `hint`, optional `span2` (full-width within a grid section).

### Validation

Use React Hook Form + Zod. Never write custom validate() functions or `useState` for form errors.

### Address Fields

Guest and other forms with physical addresses must use the normalized 6-field set:
`address_line_1`, `address_line_2`, `city`, `state_province`, `postal_code`, `country_id`.

For country selection, use `CountrySelect` from `frontend/src/components/common/CountrySelect.tsx` (wrapped in `Controller`).
For state/province, use `ProvinceSelect` from `frontend/src/components/common/ProvinceSelect.tsx` -- it shows a dropdown when the selected country has seeded states, and a text input otherwise. Value maps to the `state_province` string field (state name, not UUID).

## Reference Data Schema

Geographical reference data lives in the `references` PostgreSQL schema (`references.countries`, `references.states_provinces`, `references.cities`). This is the single source of truth for all location lookups.

- Countries: full ISO 3166-1 data (iso2_code, iso3_code, numeric_code, country_name, official_name, phone_code, currency_code, currency_name, nationality, continent)
- States/Provinces: seeded for PH (82 provinces), US (50 states + DC + territories), AU (8), CA (13). Type field: State, Province, Region, Territory.
- Cities: table exists, populated via external seeder (GeoNames or similar).

API endpoints (no auth required):
- `GET /reference/countries`
- `GET /reference/countries/{id}/states`
- `GET /reference/states/{id}/cities`
- `GET /reference/cities/search?q=`

Do not store raw location strings on application tables when a reference FK exists. `guests.country_id` is a FK to `references.countries.id`. `guests.state_province` is a denormalized string (name) since not all countries have seeded states.
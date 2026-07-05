# Booking Engine - Build Progress

Multi-tenant SaaS booking engine for the hospitality industry in Sorsogon, Philippines.
Features are built one at a time in dependency order.

---

## Feature Roadmap

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Project Scaffolding | [x] Done | Docker Compose, backend skeleton, frontend skeleton |
| 2 | Multi-tenancy + Auth | [x] Done | Hotel registration, JWT login/refresh/logout |
| P | Platform Admin Portal | [x] Done | Full admin backend + frontend (separate auth, all pages) |
| 3 | Accommodations Management | [x] Done | Room types, occupancy pricing, rate calendar, rate plans, promotions, packages |
| 4 | Booking Engine | [x] Done | Availability search, quote, create/confirm, status lifecycle, historical pricing |
| 5 | Guest Management | [x] Done | Guest profiles, booking history |
| 6 | Payments | [~] In Progress | Payment methods (bank transfer / pay-at-property + deposits), payment records + immutable transactions, booking integration done; standalone payments dashboard + live gateways pending |
| 7 | Public Microsite (SEO) | [ ] Pending | Per-hotel public page, Lenis scroll |
| 8 | Reports / Export | [ ] Pending | Occupancy, revenue, openpyxl export |

---

## Status Key

- `[ ] Pending` — not started
- `[~] In Progress` — actively being built
- `[x] Done` — complete and integrated

---

## Current Feature: Reference Data + Guest Management (in progress)

### Reference Data Schema (`references` PostgreSQL schema)
- `references.countries` — 250 countries (ISO 3166-1 full fields: iso2/iso3/numeric/name/official/phone/currency/nationality/continent)
- `references.states_provinces` — 5,249 rows (all countries; ISO 3166-2 subdivisions)
- `references.cities` — 152,967 rows (full worldwide set with lat/lon/timezone)
- Source: dr5hn/countries-states-cities-database, release v3.2-export.5 (ODbL v1.0, attribution required). Vendored gzipped under `backend/alembic/data/dr5hn/`.
- City search backed by a `pg_trgm` GIN index on `lower(city_name)` (`ix_ref_cities_name_trgm`) — substring search stays sub-ms at 150k+ rows.
- Read-only API at `/api/v1/reference/countries`, `/api/v1/reference/countries/{id}/states`, `/api/v1/reference/states/{id}/cities`, `/api/v1/reference/cities/search`
- Migrations: 0016 (schema + countries + states), 0017 (curated cities + South Korea fix), 0019 (full dr5hn geo: countries top-up + all states/cities + trigram index)
- Frontend: `CountrySelect`, `ProvinceSelect`, `CitySearch`, `NationalitySelect` components; `frontend/src/api/reference.ts`

### Guest Management (property portal)
- Expanded guest model: address_line_1, address_line_2, city, state_province, postal_code, country_id FK -> references.countries
- GuestForm.tsx rewritten with FormLayout + RHF + Zod + CountrySelect + ProvinceSelect

### Packages (property portal)
- `packages` + `package_accommodations` + `package_inclusions` tables (migration 0020), mirroring the rate-plan structure
- Pricing types: `per_stay` (flat), `per_night` (x nights), `per_person` (x total guests)
- Backend: `app/api/v1/property/packages.py` (CRUD + toggle); Frontend: PackagesPage / PackageForm / Create / Edit; nav item + routes; `PACKAGE_PRICING_TYPES`, `PACKAGE_INCLUSIONS` constants

### Multi-Room Bookings (property portal)
- Schema (migration 0022): promoted `bookings` to a container. Per-room accommodation, occupancy, offering refs + snapshots, and the pricing breakdown moved to a new `booking_rooms` table; occupant names/ages to `booking_room_guests` (occupant_type adult/child, `full_name` blank => primary guest); `booking_nightly_rates` repointed from `booking_id` to `booking_room_id`. Existing single-room bookings migrated into one room each. `bookings` keeps only stay-level fields + aggregates (`total_amount`, `num_guests`).
- All rooms in a booking share one stay window (single check-in/check-out). `count_available_units` now counts overlapping `booking_rooms` (each room = one unit) joined to their booking; create validates rooms-per-accommodation <= free units.
- Backend `bookings.py`: `POST` create takes `rooms: [{accommodation_id, rate_plan/promo/package, adults:[{full_name}], children:[{age, full_name}]}]`, prices each room via `compute_quote`, writes `BookingRoom` + `BookingRoomGuest` + per-room nightly rates, sets `total_amount`/`num_guests` from the sum. Detail returns `rooms[]` (each with breakdown, nightly rates, resolved occupant names) + stay-level aggregates; list returns `accommodation_summary` ("Deluxe +1") + `rooms_count`. `availability-search`/`quote` unchanged (per-accommodation; the wizard quotes each room live).
- Frontend: `CreateBookingPage` rebuilt as a 3-step wizard: (1) Rooms = stay dates + room cart (add rooms, rate plan/promo/package, per-room occupancy counts/ages) on one page, changing dates re-prices cart rooms and forces a re-search; (2) Guests = primary guest select/create, then a per-room occupant-name manifest (blank => primary guest); (3) Confirm = source/notes/save. A sticky right-side summary panel (dates, per-room totals, grand total) is always visible so the two-column layout never reflows. `BookingDetailPage` renders one card per room + a Charges card; `BookingsPage` shows the accommodation summary + room count.

### Payment Methods (property portal)
- Schema (migration 0024): `payment_methods` config (method_type bank_transfer|pay_at_property, name, is_enabled, instructions; pay-at-property deposit_required/deposit_type/deposit_value) + `payment_method_bank_accounts` child (account/bank/number, branch/swift/iban, qr_image_url, instructions, is_default). Renamed `guest_payments` -> `payment_records` (`GuestPayment` -> `PaymentRecord`), added `payment_method_id` FK + name snapshot, extended `paymentrecordstatus` enum to pending/partially_paid/paid/failed/refunded/cancelled. New immutable `payment_transactions` (10 transaction types, opaque gateway_response text, no updated_at, never edited/deleted). Bookings gained `payment_method_id` + name snapshot + `deposit_required`/`deposit_amount`.
- Hierarchy: Booking -> Payment Method (1) + Payment Records (0..n) -> Payment Transactions (0..n). Gateway-ready: providers write only to transactions; adding Maya/GCash/PayMongo/Stripe needs no booking/record/transaction model change.
- Backend `app/api/v1/property/payment_methods.py`: CRUD + toggle + soft delete (replace-set bank accounts like packages). Guards: name required; bank_transfer needs >=1 account before enabling; deposit_value 0-100%; at least one method must stay enabled (blocks disabling/deleting the last); single default bank account. QR image via existing `POST /property/upload` (folder payment_qr). `bookings.py` create validates+snapshots the method and computes the deposit from the tax-inclusive total; `record_payment` writes a `PaymentRecord` + one immutable `PaymentTransaction` (manual_payment_recorded / refund_completed); detail returns the selected method, deposit, and each record's transactions.
- Frontend: Settings > Payment Methods (`/settings/payment-methods`). `PaymentMethodsPage` list (enable/disable toggle), `PaymentMethodForm` branching by type (Bank Transfer = bank-account repeater + QR upload + default; Pay at Property = instructions + deposit config), Create (type chooser)/Edit. `paymentMethods.ts` client + `PAYMENT_METHOD_TYPES`/`DEPOSIT_TYPES`/`PAYMENT_RECORD_STATUSES`/`TRANSACTION_TYPE_LABELS` constants + `PaymentRecordBadge`. New Booking wizard Confirm step selects a method (deposit shown in the summary); `BookingDetailPage` shows the method + deposit and lists payment records with status badge + their transactions.

### Billable Items (property portal)
- Schema (migration 0025): `billable_items` config (name, category [8 spec slugs, validated string not a table], pricing_type [fixed_amount|per_night|per_guest|per_adult|per_child|per_quantity|percentage_of_booking], unit_price, is_taxable, is_active; `applies_to_all_accommodations`/`applies_to_all_rate_plans` toggles + `billable_item_accommodations`/`billable_item_rate_plans` join tables mirroring `PromotionAccommodation`/`PromotionRatePlan`; 4 `available_at_booking/checkin/stay/checkout` booleans). `booking_billable_items` immutable per-booking snapshot (mirrors `BookingTax`). `bookings.billable_items_amount` aggregate added; `total_amount = subtotal_amount + billable_items_amount + tax_total`.
- Booking-level (not per-room) like taxes: `per_night`/`per_guest`/`per_adult`/`per_child` key off the booking's summed occupancy/nights; `fixed_amount`/`per_quantity` take a user-entered quantity; `percentage_of_booking` is a % of the net room subtotal. Engine `app/services/billable_items.py` (`compute_billable_item_line`, `load_eligible_items` -- OR-eligibility across a multi-room booking's accommodations/rate plans, optional `require_stage` filter).
- Taxable items are folded into the tax base at booking-creation time: `taxable_base = room_subtotal + sum(taxable billable item amounts)` feeds the existing `compute_taxes()` (engine itself unchanged, just the subtotal argument) -- so VAT/service-charge-style taxes correctly apply to a taxable billable item too. Verified: 3 taxable items (200+100+40=340) folded into a 2500 room subtotal correctly shifted the 10% service charge from 250 to 284 and the 12%-inclusive VAT accordingly.
- Items can be added in the New Booking wizard (Step 3, filtered to `available_at_booking`) and from the Booking Detail page post-confirmation (any eligible active item, unfiltered by stage -- no dedicated check-in/stay/checkout screens exist yet). Post-confirmation additions do **not** retroactively recompute the booking's already-snapshotted taxes (verified: adding an item after confirmation left `booking.taxes[]` byte-for-byte unchanged and increased `total_amount` by exactly the new line's amount).
- Backend `app/api/v1/property/billable_items.py`: CRUD + toggle + soft delete (replace-set accommodation/rate-plan links like packages) + `GET /eligible` (query: accommodation_ids, rate_plan_ids, stage -- defaults to 'booking' for the wizard; the detail page passes `stage=all` to skip stage filtering). `bookings.py` create validates eligibility against the accommodations/rate plans actually used by the booking's rooms, persists snapshots, folds taxable items into the tax base; new `POST /bookings/{id}/billable-items` for post-confirmation adds.
- Frontend: top-level nav item "Billable Items" (`/billable-items`) -- **not** under Settings, since the spec never says "Settings >" for this module (unlike Tax/Payment Methods). `BillableItemsPage` list, `BillableItemForm` (category/pricing-type selectors, accommodation + rate-plan eligibility toggles with multi-select checklists, 4-stage availability chips), Create/Edit. `billableItems.ts` client + `BILLABLE_ITEM_CATEGORIES`/`BILLABLE_ITEM_PRICING_TYPES`/`QUANTITY_INPUT_PRICING_TYPES` constants. New Booking wizard Step 3 lists eligible items with add-toggle + quantity (client computes a live estimate; the create endpoint is authoritative); `BookingDetailPage` lists snapshot lines + an "Add Item" flow.

### Tax Configuration (property portal)
- Schema (migration 0023): `taxes` config table (name, description, tax_type percentage|fixed_amount, rate, calculation_method inclusive|exclusive, application_scope per_booking|per_night|per_guest|per_adult|per_child, is_active, display_order) + `booking_taxes` immutable per-booking snapshot (name/type/rate/method/scope snapshots + calculated_amount + is_included, tax_id FK SET NULL). Added `bookings.subtotal_amount` (net pre-tax = sum of room totals) and `bookings.tax_total` (added taxes); `bookings.total_amount` is now the tax-inclusive grand total.
- Taxes are reservation-level (computed once over the whole booking, not per room). Engine `app/services/taxes.py`: percentage taxes apply to the net subtotal S (inclusive => `S - S/(1+rate)`, extracted not added; exclusive => `S*rate`); fixed taxes = `rate * scope_count` (per_booking/night/guest/adult/child). Each tax evaluated independently (no tax-on-tax). Verified against the spec example (VAT 12% incl, Service 10% added, Env ₱50/guest => ₱11,100 on ₱10,000/2 guests).
- Backend `app/api/v1/property/taxes.py`: CRUD + toggle + soft delete (mirrors packages) + `POST /taxes/preview` (subtotal/nights/adults/children -> tax lines + grand total) for the wizard's live summary. `bookings.py` create computes + snapshots taxes after pricing rooms; detail returns `taxes[]`, `net_amount`, `tax_total`. Validation: rate>=0, percentage<=100 (MAX_TAX_PERCENTAGE).
- Frontend: new Settings area (expandable nav group). `SettingsPage` hub -> `TaxesPage` list + `TaxForm`/Create/Edit (FormLayout+RHF+Zod) at `/settings/taxes`. `taxes.ts` client + `TAX_TYPES`/`TAX_CALCULATION_METHODS`/`TAX_APPLICATION_SCOPES`/`MAX_TAX_PERCENTAGE` constants. New Booking wizard right-summary previews tax lines live; `BookingDetailPage` Charges card shows net subtotal + per-tax lines (inclusive shown parenthesised) + tax-inclusive total.

### Booking Management (property portal)
- Schema (migration 0021): booking snapshot columns (source, num_adults/children, rate_plan/package refs + name snapshots, per-line breakdown amounts), `booking_nightly_rates` (immutable nightly snapshot), `booking_status_history` (timeline). Added `pending` to the `bookingstatus` enum (additive). Superseded by migration 0022 (per-room columns moved off `bookings`).
- Pricing engine `app/services/pricing.py` — single source of truth shared by availability search, live quote, and confirm. Per-night build-up: room rate (override -> weekend -> base) -> rate-plan adjustment -> additional-adult charge -> child-policy charges; stay-level: promotion discount -> package amount -> taxes/fees (0). Also `count_available_units` (honors unit blocks + active bookings) and occupancy validation (0/None caps treated as "not configured").
- Backend `app/api/v1/property/bookings.py`: `POST availability-search`, `POST quote`, `GET` list (search/status/payment/date filters + sort), `GET {id}` detail, `POST` create+confirm (re-quotes server-side, generates `BK-YYYYMMDD-XXXX`, writes nightly snapshot + initial timeline entry), `PATCH {id}/status` (timeline, no re-pricing), `POST {id}/payments` (records to guest_payments), `DELETE` soft-delete. Payment status (unpaid/partially_paid/paid) is derived from paid payments vs total.
- Frontend: BookingsPage (list), BookingDetailPage (summary, nightly breakdown, status management, timeline, payment summary + record payment), CreateBookingPage (4-step wizard: search -> select rate plan/promo/package with live quote -> select/create guest -> confirm). `bookings.ts` client, `BookingBadges` (status + payment pills), `BOOKING_STATUSES` / `BOOKING_PAYMENT_STATUSES` / `BOOKING_SOURCES` / `PAYMENT_METHODS` constants.

---

## Platform Admin Portal — What was built

### Backend additions
- `app/core/deps.py` — `get_current_admin` dependency (checks `type: "admin"` in JWT payload)
- `app/core/constants.py` — `AuditAction` string constants
- `app/models/platform_admin.py` — `PlatformAdmin`, `AdminRefreshToken`
- `app/models/hotel.py` — `HotelStatus` enum + `status` column added
- `app/models/subscription.py` — `SubscriptionPlan`, `PropertySubscription`
- `app/models/billing.py` — `Invoice`, `Payment`, `CommissionStatement`, `CommissionAdjustment`
- `app/models/audit_log.py` — `AuditLog` with JSONB before/after state
- `app/repositories/platform_admin.py`, `subscription.py`, `billing.py`, `audit_log.py`
- `app/services/admin_auth.py`, `property_service.py`, `subscription_service.py`, `invoice_service.py`, `commission_service.py`, `payment_service.py`, `platform_reports.py`
- `app/services/audit_service.py` — standalone `log_audit()` async function
- `app/api/v1/admin/` — auth, properties, plans, subscriptions, invoices, payments, commissions, audit, reports
- `alembic/versions/0002_platform_admin_portal.py` — all new tables (circular FK solved with use_alter)
- `scripts/seed_admin.py` — CLI script to seed first platform admin

### Frontend additions
- `src/types/admin.ts` — all admin TypeScript interfaces
- `src/store/adminAuthStore.ts` — separate Zustand store for admin auth (persisted)
- `src/api/adminClient.ts` — separate Axios instance, redirects to /admin/login on 401
- `src/api/admin/` — auth, properties, plans, subscriptions, invoices, payments, commissions, audit, reports
- `src/components/common/` — Table, Select, Textarea, Pagination added
- `src/components/admin/` — StatCard, StatusBadge (Hotel/Subscription/Invoice/Commission), AdminLayout
- `src/pages/admin/` — AdminLogin, AdminDashboard, PropertiesPage, PropertyDetailPage, PlansPage, InvoicesPage, InvoiceDetailPage, PaymentsPage, CommissionsPage, CommissionDetailPage, AuditLogsPage, ReportsPage
- `src/App.tsx` — updated with /admin/* route tree, AdminProtectedRoute, AdminPublicRoute

### Admin access
- Run `docker compose exec backend python scripts/seed_admin.py` to create the first admin
- Admin portal: http://localhost:5173/admin/login

---

## Feature 1 + 2 — What was built

### Backend (`backend/`)
- `app/core/config.py` — pydantic-settings, env-driven
- `app/core/database.py` — async SQLAlchemy engine + `Base`
- `app/core/exceptions.py` — `AppError` hierarchy + FastAPI handler
- `app/core/security.py` — bcrypt hashing, JWT encode/decode
- `app/core/deps.py` — `get_current_user` FastAPI dependency
- `app/models/base.py` — `TimestampMixin` (created_at, updated_at, deleted_at)
- `app/models/hotel.py` — `Hotel` model (tenant)
- `app/models/user.py` — `User` + `RefreshToken` models
- `app/repositories/base.py` — `BaseRepository[T]` with get_by_id, create, update, soft_delete, paginate
- `app/repositories/hotel.py` — get_by_slug, get_by_email
- `app/repositories/user.py` — `UserRepository` + `RefreshTokenRepository`
- `app/services/auth.py` — register, login, refresh, logout
- `app/api/v1/auth.py` — POST /register /login /refresh /logout
- `app/main.py` — FastAPI app with CORS + error handlers
- `alembic/versions/0001_initial.py` — hotels, users, refresh_tokens tables

### Frontend (`frontend/`)
- React 18 + TypeScript + Vite + TailwindCSS
- `src/api/client.ts` — Axios instance with JWT injection + silent refresh interceptor
- `src/api/auth.ts` — register, login, refresh, logout calls
- `src/store/authStore.ts` — Zustand + persist (user, tokens, isAuthenticated)
- `src/types/auth.ts` — User, AuthResponse types
- `src/components/common/` — Button, Input, Modal, Badge, Avatar, EmptyState, ConfirmDialog, PageLoader, LoadingSpinner, useToast
- `src/pages/Login.tsx` — RHF + Zod login form
- `src/pages/Register.tsx` — RHF + Zod register form (hotel_name, full_name, email, password)
- `src/pages/Dashboard.tsx` — authenticated shell with logout
- `src/App.tsx` — BrowserRouter with ProtectedRoute + PublicRoute guards

### Infrastructure
- `docker-compose.yml` — postgres:16, pgadmin, backend, frontend
- `.env.example` + `backend/.env.example` + `frontend/.env.example`
- `.gitignore`

---

## How to run locally

```bash
# 1. copy env files
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. edit backend/.env — set a real SECRET_KEY and POSTGRES_PASSWORD

# 3. start services
docker compose up --build

# 4. run migrations (first time only)
docker compose exec backend alembic upgrade head
```

- API: http://localhost:8000
- Frontend: http://localhost:5173
- PgAdmin: http://localhost:5050

---

## Decision Log

| Date | Decision | Reason |
|---|---|---|
| 2026-06-21 | Build features one at a time | Avoid scope creep; keep context small |
| 2026-06-21 | Multi-tenancy via `hotel_id` FK on all tenant-scoped models | Simpler than schema-per-tenant for this scale |
| 2026-06-21 | Refresh tokens stored in DB (not stateless) | Allows explicit logout and token revocation |
| 2026-06-21 | Hotel registration creates both Hotel + User(OWNER) atomically | Single form UX; hotel cannot exist without an owner |
| 2026-06-27 | Dedicated `references` PostgreSQL schema for geographical data | Isolates reference data from tenant data; schema name requires double-quoting in SQL (reserved word) |
| 2026-06-27 | FK constraints between `references` schema tables added separately via `op.create_foreign_key` with `source_schema`/`referent_schema` | Avoids SQLAlchemy double-quoting bug when embedding FK strings inside `op.create_table` for schemas with reserved-word names |
| 2026-06-30 | Replace curated geo seed with full dr5hn dataset (250 countries / 5,249 states / 152,967 cities) via migration 0019 | Curated 337-city set was too sparse; dr5hn maps 1:1 to the 3-table schema and ships lat/lon/timezone. CSVs vendored gzipped (~5MB) and loaded with batched inserts under asyncpg |
| 2026-06-30 | Countries topped-up (ON CONFLICT DO NOTHING), states + cities wiped and reloaded | Existing country UUIDs are referenced by `guests.country_id`; states/cities have no external FKs (`guests.state_province`/`city` are strings), so they can be safely rebuilt |
| 2026-06-30 | Dropped 0017 partial unique indexes on cities; added `pg_trgm` GIN index | Full dataset has 324 legitimate duplicate (state, name) localities; uniqueness no longer holds. Trigram index keeps `LIKE '%q%'` city search sub-ms at 150k rows |
| 2026-07-01 | Built a minimal Packages module before Bookings | Spec references packages in the booking flow but no Packages module existed; built CRUD + pricing (per_stay/per_night/per_person) mirroring rate plans so bookings can bundle add-ons |
| 2026-07-01 | Single shared pricing engine (`services/pricing.py`) for search, quote, and confirm | Guarantees the estimate, live recalc, and stored snapshot are computed identically; server always re-quotes on confirm and never trusts client totals |
| 2026-07-01 | Historical pricing stored as `booking_nightly_rates` (per-night) + stay-level snapshot columns on `bookings` | Normalized nightly breakdown for the summary/audit; confirmed bookings are immune to later rate-calendar/rate-plan/promotion/package changes |
| 2026-07-01 | Booking payment status derived (not stored); `pending` added to enum additively | Deriving unpaid/partially_paid/paid from paid payments vs total avoids sync drift; additive enum change preserves existing `pending_payment`/`refunded` values |
| 2026-07-01 | Occupancy caps of 0/None treated as "not configured" | Accommodation form stores 0 for blank max_adults/max_children; enforcing a literal 0 would reject every booking, so caps apply only when a positive limit is set |
| 2026-07-01 | Multi-room bookings via `booking_rooms` child table; per-room columns dropped from `bookings` | A booking can hold several rooms sharing one stay; normalizing per-room data (accommodation, occupancy, offerings, pricing snapshot) into `booking_rooms` keeps `bookings` a clean container. `bookings.total_amount`/`num_guests` retained as aggregates so the list's payment-status subquery avoids joining rooms |
| 2026-07-01 | Per-occupant names in `booking_room_guests` (adult/child rows), blank => primary guest | Vivian wanted a name for every occupant, not just a room label; a normalized child table (vs a JSON manifest) fits the "avoid json / normalized" rule, and child rows carry the age that drives pricing |
| 2026-07-01 | Taxes computed at reservation level (not inside `compute_quote`) over the net booking subtotal; snapshotted per booking in `booking_taxes` | Tax scopes (per booking/night/guest) span the whole reservation while the pricing engine is per-room; computing once over the summed net subtotal keeps the engine unchanged. Percentage base = net subtotal (post-discount, incl. package) per the user's choice. Snapshot table (vs JSON) keeps confirmed bookings immune to later config edits |
| 2026-07-01 | Tax Configuration placed under a new Settings nav group; percentage taxes forced to per_booking scope | User chose "Settings > Tax Configuration" over a flat nav item; percentage taxes apply once to the subtotal so non-per_booking scopes are meaningless for them (fixed-amount taxes use the full scope matrix) |
| 2026-07-01 | Renamed `guest_payments` -> `payment_records` and layered immutable `payment_transactions` beneath it | Spec models a Booking -> Payment Record -> Payment Transaction hierarchy; the existing flat GuestPayment was the record. Renaming (vs a parallel table) keeps one ledger and the spec vocabulary; the immutable transaction layer makes the model gateway-ready without ever touching booking/record rows |
| 2026-07-01 | Payment method config as one `payment_methods` table with a `method_type` discriminator + type-specific columns/child tables | Bank transfer (many bank accounts) and pay-at-property (deposit rules) differ, and future providers (Maya/GCash/PayMongo/Stripe) must slot in without schema churn on bookings; a discriminated config table + child `payment_method_bank_accounts` keeps it normalized and extensible |
| 2026-07-06 | Billable Item accommodation/rate-plan eligibility uses specific accommodation/rate-plan links (join tables), not the broader `AccommodationType` category | Consistent with how Packages/Promotions/Rate Plans already restrict eligibility, even though the spec's wording ("accommodation types") suggested the category enum; user chose consistency over literal wording |
| 2026-07-06 | Taxable billable items are folded into the tax base at booking-creation time only; post-confirmation additions never retroactively recompute stored `booking_taxes` | Keeps the tax snapshot immutable (consistent with its existing design) while still letting VAT/service-charge-style taxes apply correctly to taxable extras added during the original booking flow |
| 2026-07-06 | Billable Items got a top-level nav item, not nested under Settings | Unlike the Tax/Payment Methods specs (which said "Settings > X"), the Billable Items spec only ever says "the Billable Items module" -- treated as a signal to place it alongside Packages/Rate Plans/Promotions instead |

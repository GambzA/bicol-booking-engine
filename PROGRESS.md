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
| 3 | Accommodations Management | [ ] Pending | Room types, rooms, pricing |
| 4 | Booking Engine | [ ] Pending | Availability check, reservations CRUD |
| 5 | Guest Management | [ ] Pending | Guest profiles, booking history |
| 6 | Payments | [ ] Pending | Payment recording, receipts |
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
- `references.countries` — 196 countries (ISO 3166-1 full fields: iso2/iso3/numeric/name/official/phone/currency/nationality/continent)
- `references.states_provinces` — 158 rows (PH 83 provinces + NCR, US 54, AU 8, CA 13)
- `references.cities` — 337 rows (world capitals, major PH/US/AU/CA cities, global notable cities)
- Read-only API at `/reference/countries`, `/reference/countries/{id}/states`, `/reference/states/{id}/cities`, `/reference/cities/search`
- Migrations: 0016 (schema + countries + states), 0017 (cities + South Korea fix)
- Frontend: `CountrySelect`, `ProvinceSelect` components; `frontend/src/api/reference.ts`

### Guest Management (property portal)
- Expanded guest model: address_line_1, address_line_2, city, state_province, postal_code, country_id FK -> references.countries
- GuestForm.tsx rewritten with FormLayout + RHF + Zod + CountrySelect + ProvinceSelect

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

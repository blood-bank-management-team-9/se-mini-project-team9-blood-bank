# Backend structure (SAD 4.1)

src/modules/<feature>/  routes, controller, service, repository, unit tests
  features: auth, admin, donors, search, donations, stock, requests, reports
src/middleware  shared middleware (RBAC, validation, error handler)
src/config      settings
src/audit       audit trail
src/database    migrations, seed scripts, connection

Rules: controllers hold no business rules, services hold the rules, repositories hold all SQL.

## Database Scripts
- `npm run db:migrate` – Run schema migrations (idempotent, safe for existing data)
- `npm run db:seed` – Load initial seed data
- `npm run db:reset` – Drop all tables and re-run migrations (development only)

## Default Seed Accounts
All default seed users share the test password: **`Test@1234`**
- **Admin**: `admin@bloodbank.org` (Role: Admin)
- **Staff**: `staff@bloodbank.org` (Role: Staff)
- **Donor**: `john.doe@example.com` (Role: Donor)
- **Hospital/Patient**: `hospital@citygen.org` (Role: Hospital/Patient)
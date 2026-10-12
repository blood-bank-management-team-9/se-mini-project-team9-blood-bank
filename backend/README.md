# Backend structure (SAD 4.1)

src/modules/<feature>/  routes, controller, service, repository, unit tests
  features: auth, admin, donors, search, donations, stock, requests, reports
src/middleware  shared middleware (RBAC, validation, error handler)
src/config      settings
src/audit       audit trail
src/database    migrations, seed scripts, connection

Rules: controllers hold no business rules, services hold the rules, repositories hold all SQL.
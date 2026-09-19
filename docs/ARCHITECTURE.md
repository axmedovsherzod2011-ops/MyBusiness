# MyBusiness Architecture

## Principles

1. Business rules live in the API, not the browser.
2. PostgreSQL is the source of truth for transactional data.
3. The API starts as a modular monolith with explicit domain boundaries.
4. Business records are company-scoped so branch growth does not require a rewrite.
5. Large collections use indexed pagination and never load a full table into the client.
6. Financial and inventory changes are performed inside database transactions.
7. Destructive business actions are auditable.
8. Infrastructure secrets are environment variables and never committed.

## Long-term domains

- Identity and access
- Company and organization
- Customers
- Product catalog
- Inventory and warehouses
- Orders and POS
- Payments and receivables
- Delivery
- Invoices
- Reporting
- Audit and system settings

## Scaling path

Start with one API and one PostgreSQL database. Extract workers or services only when a measured workload requires it. This avoids premature infrastructure complexity while preserving clear domain boundaries.

## Data safety

Production migrations must be reviewed before execution. Backups must exist before destructive schema changes. Order totals, inventory movements, and payments must be transactionally consistent.

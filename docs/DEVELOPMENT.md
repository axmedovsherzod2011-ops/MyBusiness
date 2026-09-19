# Development Rules

## Branches

- `main`: stable integration branch.
- `feature/*`: isolated feature work.
- `fix/*`: bug fixes.

Production changes should be promoted from reviewed commits rather than edited directly on the server.

## Environments

- local: developer machine
- staging: safe shared testing environment
- production: real company data

Never point local development at the production database.

## Database

Use Drizzle migrations for schema changes. Do not manually modify production tables. Prefer additive migrations and explicit data backfills for risky changes.

## API

All public API routes belong under `/api/v1`. Health and readiness endpoints remain outside that namespace.

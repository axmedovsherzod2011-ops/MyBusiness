# Development Rules

## Environments

- local: development
- staging: validation
- production: real M Cosmetics marketplace

Never point local development at the production database.

## Database

Do not create marketplace tables until the product requirements are agreed. After the model is defined, use reviewed Drizzle migrations.

## API

Public API routes belong under /api/v1. Health and readiness endpoints remain outside that namespace.

## Product development

Build from the agreed M Cosmetics product ideas rather than carrying forward assumptions from the old MyBusiness application.

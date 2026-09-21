# M Cosmetics Marketplace Architecture

The repository is intentionally reset to a clean foundation. No previous MyBusiness business-management domain is retained.

## Current layers

- Web: React + Vite
- API: Node.js + Express
- Database: PostgreSQL + Drizzle
- Hosting: Cloudflare frontend + Render API

## Design rule

Do not add marketplace entities or business rules until the product requirements are defined. The product model will be designed from the M Cosmetics ideas first, then implemented as explicit modules.

## Production principles

- Keep business rules in the API.
- Keep PostgreSQL as the source of truth.
- Validate all public inputs.
- Keep secrets in environment variables.
- Use staging before production.
- Use migrations for database changes.
- Keep health and readiness endpoints available.

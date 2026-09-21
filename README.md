# M Cosmetics Marketplace

A clean foundation for the M Cosmetics online marketplace.

## Current state

The previous MyBusiness wholesale/POS application has been removed from the application layer. The repository now contains only the deployment foundation and a minimal web/API shell.

## Foundation

- React + Vite + TypeScript frontend
- Node.js + Express + TypeScript API
- PostgreSQL on Neon
- Drizzle ORM
- Render for the API
- Cloudflare for the frontend
- GitHub Actions for validation

## Important

The marketplace domain model, customer experience, catalog, checkout, delivery, administration, and other product decisions are intentionally not implemented yet. They will be designed from the product ideas before database tables and business logic are added.

## Development

Copy .env.example to .env, provide DATABASE_URL, install dependencies with pnpm install, then run pnpm dev.

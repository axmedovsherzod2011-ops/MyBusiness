# MyBusiness

MyBusiness is a business-owned wholesale distribution and POS platform.

## Foundation

- React + Vite frontend
- Node.js + Express API
- TypeScript
- PostgreSQL on Neon
- Drizzle ORM
- Cloudflare for DNS/TLS and optional object storage
- Render for application hosting

The project is intentionally a modular monolith at the beginning. Domain boundaries are kept explicit so individual services can be extracted later if scale requires it.

## Core domains

Auth, users, roles, companies, branches, warehouses, customers, products, inventory, orders, payments, debts, deliveries, invoices, reports, audit logs, and settings.

## Development

Copy `.env.example` to `.env` and provide `DATABASE_URL`.

Then install dependencies with `pnpm install` and run the API with `pnpm dev`.

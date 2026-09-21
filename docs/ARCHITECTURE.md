# Marketplace Architecture

The project contains two user-facing web applications backed by one shared API and one future source-of-truth database.

## Applications

- `apps/seller` — seller-facing site for seller accounts, stores, products, inventory, orders and seller operations.
- `apps/customer` — public customer marketplace for discovery, stores, products, cart and customer orders.
- `apps/api` — the single backend API used by both sites.

## Data flow

```
Seller Site ─┐
             ├── Marketplace API ─── Single Database
Customer Site┘
```

The database is not duplicated between the two sites. Both applications read and write marketplace data through the API.

## Shared code

- `packages/shared` contains contracts and types shared by the applications.
- A database package can be introduced when the marketplace data model is defined; the database remains behind the API boundary.

## Local development

- Seller: `http://localhost:5173`
- Customer: `http://localhost:5174`
- API: `http://localhost:10000`

Do not place business logic or database credentials directly in either web application.

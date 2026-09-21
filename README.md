# Marketplace

Marketplace is a monorepo with two separate web experiences:

- Seller Site — seller operations and store management.
- Customer Site — public marketplace and customer shopping.

Both sites use the same Marketplace API and one shared database as the system of record.

## Structure

```
apps/
  seller/
  customer/
  api/
packages/
  shared/
docs/
```

The product requirements and business features will be added incrementally after the architecture is established.

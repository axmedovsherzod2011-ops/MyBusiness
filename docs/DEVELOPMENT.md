# Development

## Workspace

This is a pnpm monorepo with two web applications and one API:

- `@marketplace/seller`
- `@marketplace/customer`
- `@marketplace/api`
- `@marketplace/shared`

## Commands

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm build
```

The seller and customer applications intentionally use the same API and will later use the same database through that API.

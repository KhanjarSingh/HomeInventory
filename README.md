# Home Inventory System

A production-quality Home Inventory Management System engineered to be the definitive single source of truth for all physical items in a household without needing to open boxes, drawers, or cupboards.

---

## Key Features

- **Photo-First & Visual**: Instant visual verification of items, variants, colors, and storage bins.
- **Hierarchical Locations**: Arbitrary-depth location tree (House → Room → Cupboard → Shelf) with fast subtree queries.
- **Smart Containers**: Containers are inventory items that can house other items/containers and move atomically with all their contents.
- **Strict Quantity Invariant**: Total quantity always reconciles with distributed placements across locations and containers.
- **Fast Cataloguing Mode**: Camera-first rapid entry designed for standing in front of a cupboard with a smartphone.
- **PostgreSQL Native Search**: Trigram typo tolerance (`pg_trgm`) and full-text search across items, tags, and locations.
- **Multi-Tenant Isolation**: Strict household-level scoping on every database query.
- **Direct Cloudinary Uploads**: Browser-to-Cloudinary image pipeline with client-side EXIF GPS stripping.

---

## Tech Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query v5
- **Backend**: Node.js 20+, Express 5, TypeScript, Drizzle ORM, Pino logger
- **Database**: Neon PostgreSQL (with `pg_trgm` & FTS indexes)
- **Media**: Cloudinary CDN
- **Testing**: Vitest, Supertest, Playwright

---

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Run Migrations & Seed Data
```bash
pnpm db:migrate
pnpm db:seed
```

### 4. Start Development
```bash
pnpm dev
```
- **Web App**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:4000](http://localhost:4000)
- **Health Check**: [http://localhost:4000/health](http://localhost:4000/health)

---

## Documentation

- [API Specification](docs/API.md)
- [Architecture Decisions (ADR)](docs/DECISIONS.md)
- [Operations & Runbook](docs/RUNBOOK.md)

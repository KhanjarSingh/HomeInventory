# Architecture Decision Records (ADRs)

## ADR-001: Monorepo Architecture with pnpm Workspaces
- **Status**: Approved (Phase 0)
- **Context**: The project consists of a Next.js frontend, an Express 5 REST API, and shared TypeScript domain logic/schemas.
- **Decision**: Use `pnpm` workspaces (`apps/web`, `apps/api`, `packages/shared`).
- **Consequences**: Strict dependency isolation, shared type definitions, single repository management, zero code duplication between frontend and backend validation.

## ADR-002: Location Hierarchy via Materialized Path + Adjacency
- **Status**: Approved (Phase 0)
- **Context**: Locations can be arbitrarily nested (House -> Room -> Cupboard -> Shelf). Efficient subtree queries ("show all items in Store Room") and strict cycle prevention are required.
- **Decision**: Combine `parent_id` (foreign key) with a materialized `path` string (e.g. `/uuid1/uuid2/uuid3/`).
- **Consequences**: O(1) subtree matching using SQL `LIKE '/uuid/%'` with text_pattern_ops indexes; cycle prevention easily enforced by checking ancestor paths before reparenting.

## ADR-003: Containers as First-Class Inventory Items
- **Status**: Approved (Phase 0)
- **Context**: Boxes, suitcases, and bins can contain other items, have their own physical attributes (purchase price, dimensions, photos), and can be relocated as a single unit.
- **Decision**: Model containers as `items` with `is_container = true`. Placements link an item to either a `location_id` or a `container_item_id`.
- **Consequences**: Moving a container moves all its contents automatically in a single atomic update of the container's placement; supports arbitrary container nesting while preventing circular references.

## ADR-004: Strict Stock Quantity Invariant
- **Status**: Approved (Phase 0)
- **Context**: Item counts must never become desynchronized across placements.
- **Decision**: Enforce `item.total_quantity = SUM(placements.quantity)` inside database transactions with row-level locking (`SELECT ... FOR UPDATE`).
- **Consequences**: Zero phantom quantities; race conditions during concurrent moves are rejected or serialized safely.

## ADR-005: Money Storage as Integer Minor Units
- **Status**: Approved (Phase 0)
- **Context**: Currency math in floating point leads to precision loss.
- **Decision**: Store all currency values as `BIGINT` minor units (e.g., 25000 paise for ₹250.00). Default currency is `INR`.
- **Consequences**: Exact arithmetic, zero rounding drift, deterministic financial reports.

## ADR-006: Direct Signed Cloudinary Uploads
- **Status**: Approved (Phase 0)
- **Context**: Uploading multi-megabyte photos through Express exhausts server memory and ties up worker threads.
- **Decision**: Express generates short-lived HMAC-SHA256 signatures; the browser uploads directly to Cloudinary and confirms metadata with Express.
- **Consequences**: Express handles only lightweight JSON; Cloudinary CDN handles bandwidth and automated responsive transformations.

## ADR-007: Client-Side EXIF GPS Privacy Stripping
- **Status**: Approved (Phase 0)
- **Context**: Home photos contain exact GPS coordinates of the user's residence.
- **Decision**: Canvas and image preprocessing pipeline strips GPS metadata before uploading to Cloudinary.
- **Consequences**: Preserves privacy while keeping image quality and orientation intact.

## ADR-008: Node.js 24 Runtime Standardization & Credential Rotation
- **Status**: Approved (Phase 1)
- **Context**: Local development runs Node.js 24.19.0. Deployment and CI must not diverge.
- **Decision**: Standardize on Node.js 24 across `.nvmrc`, `package.json` engines (`>=24.0.0`), Dockerfile (`node:24-alpine`), and GitHub Actions CI.
- **Cloudinary Security Note**: Any API secrets provided during initial development are strictly server-side and must be rotated prior to public production deployment. No secret shall ever be exposed to client bundles or git.

## ADR-009: Database & Domain Integrity Enforcement Matrix
- **Status**: Approved (Phase 1)
- **Context**: The system must rigorously prevent invalid inventory states, orphaned containers, circular nesting, and cross-household data leaks.
- **Integrity Enforcement Architecture**:

| Rule | Enforcement Mechanism | Rationale |
|---|---|---|
| **Item placed inside itself** | PostgreSQL `CHECK (item_id != container_item_id)` + Service Validation | Hard database constraint prevents physical impossibility. |
| **Placement Target XOR** | PostgreSQL `CHECK ((location_id IS NOT NULL AND container_item_id IS NULL) OR (location_id IS NULL AND container_item_id IS NOT NULL))` | Guarantees placement is either a location OR container, never both/neither. |
| **Non-negative Quantities** | PostgreSQL `CHECK (quantity > 0)` on placements, `CHECK (total_quantity >= 0)` on items | Database-level mathematical boundary. |
| **Cross-Household Isolation** | Composite Foreign Keys: `(household_id, item_id) REFERENCES items(household_id, id)` and `(household_id, location_id) REFERENCES locations(household_id, id)` | Mathematically impossible in PostgreSQL engine for placement to reference another household. |
| **Circular Container Nesting** | Transactional Recursive CTE in Service Layer + Locking | Detects arbitrary-depth nesting cycles before reparenting without unbounded triggers. |
| **Non-container as Container** | Composite Foreign Key `(container_item_id, true) REFERENCES items(id, is_container)` + Service check | Enforces container capability at relational level. |
| **Quantity Reconciliation** | Database Transaction with `SELECT ... FOR UPDATE` | Atomic movements prevent race conditions. |
| **Legitimate Unplaced Items** | Intentional omission of strict trigger requiring placements | Allows rapid cataloguing (Quick Capture) where items have `total_quantity > 0` with 0 placements. |

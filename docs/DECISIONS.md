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

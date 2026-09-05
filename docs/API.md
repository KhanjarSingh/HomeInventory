# Home Inventory API Documentation

Base URL: `http://localhost:4000/api/v1`

All responses follow standard envelopes:

### Success Envelope
```json
{
  "data": {},
  "meta": {
    "requestId": "req_...",
    "nextCursor": null
  }
}
```

### Error Envelope
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": []
  },
  "meta": {
    "requestId": "req_..."
  }
}
```

---

## Health & System

### GET `/health`
Returns system status including database and Cloudinary connectivity.

**Response (200 OK):**
```json
{
  "data": {
    "status": "ok",
    "timestamp": "2026-09-05T09:40:00.000Z",
    "version": "0.1.0",
    "uptimeSeconds": 12.34,
    "services": {
      "database": "connected",
      "cloudinary": "configured"
    }
  },
  "meta": {
    "requestId": "req_01j7..."
  }
}
```

---

## Authentication (`/api/v1/auth`)

* `POST /auth/register` — Register a new user and auto-create default household.
* `POST /auth/login` — Authenticate credentials, set httpOnly access + refresh tokens.
* `POST /auth/refresh` — Rotate refresh token and issue new access token.
* `POST /auth/logout` — Revoke active refresh token and clear cookies.
* `GET  /auth/me` — Return authenticated user profile and active household context.

---

## Items & Inventory (`/api/v1/items`)

* `GET    /items` — Query items with cursor pagination, filters (category, location, status, tag), and sorting.
* `POST   /items` — Create new inventory item (supports quick cataloguing).
* `GET    /items/:id` — Full details with placements, images, and valuations.
* `PATCH  /items/:id` — Update item details with optimistic locking (`version`).
* `DELETE /items/:id` — Soft-delete item.
* `POST   /items/:id/restore` — Restore soft-deleted item.
* `POST   /items/:id/move` — Atomic stock movement between locations/containers.

---

## Locations (`/api/v1/locations`)

* `GET    /locations` — Retrieve full location tree.
* `POST   /locations` — Create a new location node.
* `PATCH  /locations/:id` — Update or reparent location.
* `DELETE /locations/:id` — Delete location using strategy (`move_to_parent`, `archive`).
* `GET    /locations/:id/contents` — Get items in location.

---

## Uploads & Images (`/api/v1/uploads`, `/api/v1/items/:id/images`)

* `POST   /uploads/signature` — Generate signed direct upload parameters for Cloudinary.
* `POST   /items/:id/images` — Confirm upload and persist Cloudinary asset metadata.

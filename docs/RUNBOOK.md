# Operational Runbook

## 1. Local Development Setup

### Prerequisites
- Node.js 20+
- pnpm 10+
- PostgreSQL database (Neon or local)

### Quick Start
1. Clone the repository and install dependencies:
   ```bash
   pnpm install
   ```
2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
3. Run database migrations:
   ```bash
   pnpm db:migrate
   ```
4. Seed database with realistic household data:
   ```bash
   pnpm db:seed
   ```
5. Start development servers:
   ```bash
   pnpm dev
   ```
   - Web frontend: `http://localhost:3000`
   - Express backend: `http://localhost:4000`
   - Health check: `http://localhost:4000/health`

---

## 2. Database Operations

### Generating Migrations
When modifying Drizzle schema in `apps/api/src/db/schema/`:
```bash
pnpm db:generate
```

### Applying Migrations
```bash
pnpm db:migrate
```

### Rollback Strategy
Neon supports Point-in-Time-Recovery (PITR) and branching. Before executing major migrations on production, create a branch in Neon:
```bash
neon branches create --name pre-migration-backup
```

---

## 3. Secret Rotation Procedures

### JWT Secret Rotation
1. Update `JWT_SECRET` in environment variables.
2. Active access tokens (~15m expiry) will invalidate immediately; users will automatically use their refresh tokens to acquire new access tokens signed with the new secret without disruption.

### Refresh Token Secret Rotation
1. Update `REFRESH_TOKEN_SECRET` in environment variables.
2. Forces full re-login across all active sessions upon expiry.

### Cloudinary Credentials Rotation
1. Generate new API Key & Secret in the Cloudinary Console.
2. Deploy backend with updated `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`.
3. Revoke old key in Cloudinary Console.

---

## 4. Health Checks & Monitoring
- Check `/health` endpoint periodically:
  ```bash
  curl -s http://localhost:4000/health | jq .
  ```
- Pino logs output structured JSON with `requestId` and execution duration.

# Production Deployment Guide: Home Inventory System

This document outlines the step-by-step instructions to deploy the Home Inventory System:

$$\text{GitHub Repository: KhanjarSingh/HomeInventory} \longrightarrow \text{Render (API)} + \text{Vercel (Web)} + \text{Neon PostgreSQL} + \text{Cloudinary}$$

---

## 1. Prerequisites & Services

1. **GitHub**: Repository `KhanjarSingh/HomeInventory` (branch: `main`).
2. **Neon**: Serverless PostgreSQL database.
3. **Cloudinary**: Cloudinary account for media assets.
4. **Render**: Web service for Express API backend (`apps/api`).
5. **Vercel**: Next.js frontend hosting (`apps/web`).

---

## 2. Step 1: Neon PostgreSQL Database

1. Create a project in [Neon Console](https://console.neon.tech).
2. Copy your pooled connection string:
   ```bash
   DATABASE_URL="postgresql://<user>:<password>@<ep-pooler-domain>/neondb?sslmode=require"
   ```
3. Run database migrations and seed the default household (**Tandalwade's Residency**):
   ```bash
   DATABASE_URL="<your-neon-database-url>" pnpm run db:migrate
   DATABASE_URL="<your-neon-database-url>" pnpm run db:seed
   ```
   > **Default Household Profiles Seeded:**
   > - **Vithal Tandalwade** — Role: `Owner` — Unlock Year: `1973`
   > - **Shailaja Tandalwade** — Role: `Owner` — Unlock Year: `1979`
   > - **Rutuja Tandalwade** — Role: `Editor` — Unlock Year: `2003`
   > - **Parth Tandalwade** — Role: `Editor` — Unlock Year: `2007`

---

## 3. Step 2: Cloudinary Setup

1. In [Cloudinary Console](https://console.cloudinary.com), retrieve:
   - **Cloud Name** (`CLOUDINARY_CLOUD_NAME`)
   - **API Key** (`CLOUDINARY_API_KEY`)
   - **API Secret** (`CLOUDINARY_API_SECRET`)
2. **SECURITY INVARIANT**:
   - `CLOUDINARY_API_SECRET` must ONLY be set on Render (server-side).
   - NEVER provide `CLOUDINARY_API_SECRET` to Vercel or client code.

---

## 4. Step 3: Render API Deployment (`apps/api`)

### Option A: Blueprint (Automatic via `render.yaml`)
1. In Render Dashboard, select **New +** → **Blueprint**.
2. Connect `KhanjarSingh/HomeInventory`. Render will detect `render.yaml`.
3. Fill in the prompted secret values (`DATABASE_URL`, `CORS_ORIGIN`, `WEB_URL`, Cloudinary credentials).

### Option B: Manual Web Service
1. Select **New +** → **Web Service**.
2. Connect repository `KhanjarSingh/HomeInventory`.
3. Configure:
   - **Name**: `home-inventory-api`
   - **Runtime**: `Node` (Node.js 24)
   - **Root Directory**: `.` (leave empty or root)
   - **Build Command**:
     ```bash
     pnpm --filter @home-inventory/shared run build && pnpm --filter @home-inventory/api run build
     ```
   - **Start Command**:
     ```bash
     pnpm --filter @home-inventory/api run start
     ```
   - **Health Check Path**: `/health`
4. **Environment Variables on Render**:

   | Variable Name | Example Value / Description | Sensitive? |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | No |
   | `PORT` | `10000` | No |
   | `DATABASE_URL` | `postgresql://...` (from Neon) | **YES** |
   | `JWT_SECRET` | 32+ character random string | **YES** |
   | `REFRESH_TOKEN_SECRET` | 32+ character random string | **YES** |
   | `COOKIE_SECRET` | 32+ character random string | **YES** |
   | `CORS_ORIGIN` | `https://your-app.vercel.app` | No |
   | `WEB_URL` | `https://your-app.vercel.app` | No |
   | `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | No |
   | `CLOUDINARY_API_KEY` | Cloudinary API key | No |
   | `CLOUDINARY_API_SECRET` | Cloudinary API secret | **YES** |

5. Deploy. Once live, test: `https://<your-render-url>/health` → should return HTTP 200 `{ "status": "ok", ... }`.

---

## 5. Step 4: Vercel Web Deployment (`apps/web`)

1. In [Vercel Dashboard](https://vercel.com), click **Add New...** → **Project**.
2. Import repository `KhanjarSingh/HomeInventory`.
3. Configure Project Settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `.` (or `apps/web`)
   - **Build Command**:
     ```bash
     pnpm --filter @home-inventory/shared run build && pnpm --filter @home-inventory/web run build
     ```
   - **Output Directory**: `apps/web/.next`
   - **Install Command**: `pnpm install`
4. **Environment Variables on Vercel**:

   | Variable Name | Example Value / Description | Sensitive? |
   | :--- | :--- | :--- |
   | `NEXT_PUBLIC_API_URL` | `https://<your-render-url>/api/v1` | No (Public) |

5. Click **Deploy**.
6. Once deployed, copy your Vercel URL (e.g., `https://home-inventory-xyz.vercel.app`) and update `CORS_ORIGIN` and `WEB_URL` in the **Render API** environment variables.

---

## 6. Step 5: Mobile-First Verification Checklist

Open the Vercel production URL on your smartphone browser (Safari on iOS / Chrome on Android):

1. **Authentication**:
   - Verify that "Tandalwade's Residency" appears.
   - Tap your profile (e.g., Parth Tandalwade).
   - Enter your 4-digit PIN (`2007`) on the numeric keypad.
   - Verify instant redirect to the dashboard.
2. **Mobile Quick Capture**:
   - Tap the **`+ Quick Add`** navigation button or the floating camera button.
   - Tap **Take Photo** → Camera opens natively.
   - Take a picture of an item → Photo preview displays with retake button.
   - Select Category (horizontal pills).
   - Adjust Quantity with stepper (`-`, `+`).
   - Pick destination (Room/Shelf or Storage Box).
   - Tap **Save Item** → instant save and confirmation.
   - Tap **`+ Add Another Item`** → resets form and opens camera for next item.
3. **Item Catalog & Detail**:
   - Visit `/items` → card list displays thumbnail covers and location breadcrumbs.
   - Tap an item → view cover image, photo gallery reel, full-screen lightbox zoom, and location card with "Move Item" action.

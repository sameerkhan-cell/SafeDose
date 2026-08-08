# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: MediVerify (SafeDose)

AI + blockchain powered counterfeit medicine detection platform — Pakistan's DRAP (Drug Regulatory Authority of Pakistan) regulatory workflow. Patients scan QR codes to verify medicines; manufacturers register batches on Polygon Amoy; pharmacies/admin/regulator dashboards operate per role.

Live contract: `0x0039546e8A3eE8b068878961CD721a775F8750EE` (Polygon Amoy, chainId 80002).

## graphify

This project has a graphify knowledge graph at `graphify-out/`.

Rules:
- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

## Tech stack

- **Framework**: TanStack Start (file-based routing, SSR) + TanStack Router + TanStack Query
- **Build/Dev**: Vite 7 via `@lovable.dev/vite-tanstack-config` (do NOT add React/TanStack/Tailwind plugins manually — the lovable config already includes them)
- **Deployment targets**: Vercel (Nitro preset) AND Cloudflare Workers (`src/server.ts` is the CF fetch wrapper; do NOT set it as the Nitro entry on Vercel — that produces 404s)
- **Database**: MySQL via Prisma (`relationMode = "prisma"` — no FK constraints at DB level)
- **Auth**: JWT (access + refresh) stored in `Session` table, `bcryptjs`, Google OAuth via `google-auth-library`, OTP via SMTP (Nodemailer)
- **Styling**: Tailwind CSS v4 + shadcn/ui (new-york style, `components.json`), Lucide icons, Motion/Framer Motion + GSAP
- **Blockchain**: ethers v6 + Hardhat (Solidity 0.8.20), Polygon Amoy testnet
- **AI**: Google Gemini (`@google/genai`) for patient medicine chat
- **QR**: `qrcode` + `qrcode.react` for generation; native `BarcodeDetector` with `@zxing/library` fallback for scanning
- **State**: Zustand for client stores (fraud, qr, regulatory, verification)
- **Workers**: Standalone blockchain queue worker (`tsx scripts/dev-worker.ts`)

## Common commands

```bash
npm run dev          # Vite dev server (host: 0.0.0.0, 4GB heap)
npm run worker:dev   # Standalone blockchain queue worker (polls every 15s)
npm run build        # prisma generate + vite build for Vercel
npm run build:dev    # vite build --mode development
npm run preview      # vite preview
npm run lint         # eslint .
npm run format       # prettier --write .
npx prisma migrate dev
npx prisma studio
npx hardhat run scripts/deploy.ts --network amoy   # ONLY if redeploying contract
```

## Architecture

### Source layout (`src/`)

- `routes/` — TanStack file-based routes. `__root.tsx` wraps everything in `QueryClientProvider` + `AuthProvider` + `ThemeProvider`. `routes/api/**` contains server-side API endpoints (excluded from vite import protection). `routes/dashboard/*` is the role-based dashboard shell — each role renders through `DashShell` using `DASH_NAV` from `src/config/nav.ts`.
- `routes/api/` — Endpoint tree organized by domain: `auth/`, `blockchain/`, `fraud/`, `manufacturer/`, `pharmacy/`, `regulator/`, `report/`, `ai/`, `realtime/`, `internal/`, `health/`.
- `server/` — Server-only code (SSR, API handlers). Entry is `src/start.ts` (creates `startInstance` with an error-capture middleware). `src/server.ts` is the Cloudflare Workers fetch wrapper.
  - `server/db/client.ts` — Singleton Prisma client (HMR-safe via `globalForPrisma`).
  - `server/auth/` — `jwt.service.ts`, `password.service.ts`.
  - `server/middleware/auth.middleware.ts` — `authorizeRequest(request, allowedRoles?)` returns JWT payload or throws `ApiError`.
  - `server/services/` — Business logic layer. Heavily modularized by domain (admin, ai, analytics, audit, blockchain, cache, downloads, fraud, manufacturer, monitoring, pdf, qr, realtime, recall, etc.).
  - `server/validation/schemas.ts` — Zod schemas.
  - `server/validators/` — Domain-specific validators.
  - `server/utils/api-response.ts` — `ApiError` class + `ApiResponse.success/error` envelopes.
- `components/` — UI components grouped by feature (`auth`, `batch-registration`, `blockchain`, `dashboard`, `download-center`, `maps`, `motion`, `navigation`, `patient`, `qr`, `regulatory`, `shared`, `site`, `accessibility`) plus `ui/` (shadcn primitives).
- `services/` — Client-side wrappers calling API endpoints (not server-side services; do not confuse with `src/server/services`).
- `store/` — Zustand client stores.
- `hooks/` — `use-count-up`, `use-mobile`, `useBatchGeneration`.
- `lib/` — Cross-cutting: `auth-context.tsx`, `theme-context.tsx`, `error-capture.ts`, `error-page.ts`, `api-route-helper.ts`, `auth-routes.ts`, `motion.ts`, `gsap.ts`, `prefetch-routes.ts`, `utils.ts` (the `cn` utility for shadcn).
- `types/` — Shared TS types (`auth.ts`, `barcode-detector.d.ts`, `dual-qr.ts`).
- `config/nav.ts` — `DASH_NAV` — single source of truth for dashboard sidebar items. Import in any route using `DashShell`; do NOT redeclare locally.

### Critical services (all in `src/server/services/`)

- **`VerificationEngine`** (`verification.service.ts`) — The core. Patient QR scan entry point. Combines `BlockchainService`, `AIService`, `FraudEngine`, `RealtimeService`, `geo-anomaly.util`. Returns resultType ∈ {GENUINE, FAKE, SUSPICIOUS, DUPLICATE, EXPIRED, RECALLED, UNVERIFIED}.
- **`BlockchainService`** — ethers v6 wrapper around `MediVerify.sol`. Anchors verification events to Polygon Amoy via a job queue (DB-backed, see `blockchain.queue.ts` + `blockchain.worker.ts`). `MEDIVERIFY_ABI` is a hand-rolled fragment, not the full contract ABI.
- **`BlockchainWorker.processAnchorQueue()`** — Polls PENDING jobs (BATCH first, then PILL, then VERIFICATION_ANCHOR), max 5 concurrent, 3 retry attempts, 1s inter-tx delay, gas safety check (skips if wallet < 3x estimated cost).
- **`AuthService`** — JWT issuance/refresh, session lookup, Google OAuth, MFA via `mfa.service.ts`.
- **`ManufacturerDocumentService`** — DRAP license / WHO GMP / ISO / business registration workflow (PENDING → UNDER_REVIEW → APPROVED/REJECTED/EXPIRED).
- **`ManufacturerReportService`**, **`ReportReviewService`** — Manufacturer analytics + report review workflows.
- **`GeoTrackingService`** — Tracks manufacturer business locations (used in batch registration).
- **`PharmacyService`**, **`PharmacyAdminService`** — Pharmacy profiles + admin approval.
- **`AdminService`**, **`DrapBatchRegistryService`**, **`MedicineService`**, **`AnalyticsService`**, **`MonitoringService`**, **`RecallService`**, **`AIMedicineChatService`** — Domain-specific services, mostly thin CRUD layers.
- **`GeoIPService`** — IP → location resolution.
- **`CacheService`** — Cache abstraction.
- **`AuditLogService`** — Compliance audit trail.
- **`FraudEngine`** — Risk scoring for verification events.
- **`ExportService`**, **`PrintingService`**, **`PDFSheetService`**, **`QRService`**, **`ZIPExportService`** — Generation/export.

### Database (Prisma)

Key models in `prisma/schema.prisma`: `User` (Role enum: PATIENT/PHARMACY/MANUFACTURER/REGULATOR/ADMIN/SUPER_ADMIN/DRAP_ADMIN/FRAUD_ANALYST/AUDITOR), `Session`, `Manufacturer`, `Pharmacy`, `Report`, `VerificationLog`, `Notification`, `BlockchainJob`. `DocumentStatus` and `ManufacturerDocumentType` enums drive the document review workflow.

Migrations live in `prisma/migrations/`. Latest additions include the blockchain job queue and `DrapBatch` extras.

### On-chain contract (`contracts/MediVerify.sol`)

Solidity 0.8.20, OpenZeppelin `Ownable`. Owns: `Batch`, `Pill`, `Verification` structs, `registerBatch`/`registerPill`/`verifyPill` (manufacturer-gated), `authorizeManufacturer` (owner-only). `scripts/deploy.ts` is the redeploy script — **do not run it against the live network unless redeployment is intentional**; the contract is already deployed at `0x0039546e8A3eE8b068878961CD721a775F8750EE`.

## Error handling

- `src/server.ts` wraps the TanStack `server-entry` and normalizes "h3 swallowed SSR errors" (the `{"unhandled":true,"message":"HTTPError"}` 500 body) into a branded debug HTML response.
- `src/start.ts` registers a request middleware that catches errors with `statusCode === 500` and renders a debug page with the full stack trace.
- `src/lib/error-capture.ts` exposes `consumeLastCapturedError()`.
- API code throws `ApiError(statusCode, message, data?)` and uses `ApiResponse.success/error` envelopes.

## Env vars

Copy `.env.example` to `.env`. Required: `DATABASE_URL` (MySQL), `JWT_SECRET` + `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID` + `VITE_GOOGLE_CLIENT_ID`, `SMTP_*`, `POLYGON_AMOY_RPC`, `BLOCKCHAIN_SIGNER_KEY`, `NEXT_PUBLIC_CONTRACT_ADDRESS`, optional `GEMINI_API_KEY`, `GOOGLE_DRIVE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID`.

`src/server/load-env.ts` explicitly loads `.env` (Vite SSR does not always expose non-`VITE_` vars to `process.env`).

## Conventions

- ESLint enforces `no-restricted-imports` on `server-only` (Next.js package) — use `*.server.ts` suffix or `@tanstack/react-start/server-only` instead.
- Path alias: `@/*` → `src/*`.
- Tailwind config (Tailwind v4) is CSS-based; tokens are in `src/styles.css`.
- Multi-portal theme: each portal (admin/manufacturer/pharmacy/regulator/patient) reads its theme from `localStorage` keyed `theme-<portal>`; the inline script in `__root.tsx` applies it before hydration to avoid flash.
- shadcn primitives live in `src/components/ui/` — add new ones via the shadcn CLI (config in `components.json`).
- Do NOT add `@lovable.dev/vite-tanstack-config` plugins manually — see the comment at the top of `vite.config.ts`.
- Routes under `src/routes/api/**` are explicitly excluded from TanStack Start's import protection.
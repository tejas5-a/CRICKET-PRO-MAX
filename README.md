# CRICKET PRO MAX

**CRICKET PRO MAX** is a full-stack, responsive cricket platform serving fans, amateur players, clubs, tournament organizers, scorers, and coaches.

## 1. Architecture & Stack

- **Runtime & Server**: Node.js + Express (`server.ts`) with Vite SPA middleware on port `3000`.
- **Database**: PostgreSQL (Cloud SQL) managed via **Drizzle ORM** (`src/db/schema.ts`, `src/db/index.ts`, `src/db/repository.ts`) and **Drizzle Kit** (`src/db/drizzle.config.ts`).
- **Authentication & RBAC**: Firebase Authentication (Google Sign-In via `src/lib/firebase.ts` and `src/lib/firebase-admin.ts`) + Server-Enforced Scoped Role-Based Access Control (`src/domain/rbac.ts`).
- **Domain Engines**:
  - `src/domain/scoringEngine.ts`: Pure integer-ball cricket scoring engine supporting legal balls, wides, no-balls, byes, leg-byes, strike rotation, over completion, maiden tracking, bowler-credited wickets vs run-outs, DLS rain target revisions, idempotency keys, and deterministic replay on delivery corrections.
  - `src/domain/tournamentEngine.ts`: Configurable Round Robin, Groups, Knockout, and Group+Knockout tournament engine with non-duplicate fixture generation and official Net Run Rate (`NRR`) including the ICC/ECB All-Out full-quota rule.
- **Validation & Charts**: `zod`, `react-hook-form`, and `recharts`.

## 2. Development & Production Commands

```bash
# Install dependencies
npm install

# Run fast-feedback domain unit tests (scoring, NRR, RBAC)
npm test
# or directly via tsx:
tsx --test src/domain/engine.test.ts

# Type-check codebase
npm run lint

# Start full-stack development server on http://localhost:3000
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 3. Database Setup & Migrations

1. Configure the `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ADMIN_USER`, and `SQL_ADMIN_PASSWORD` variables as documented in `.env.example`.
2. Push schema updates using Drizzle Kit (`src/db/drizzle.config.ts`) and review RLS policies in `drizzle/0001_initial_schema_and_rls.sql`.
3. On first boot, `ensureSeedData()` in `src/db/repository.ts` populates deterministic development seed data explicitly marked with `isFictionalSeed = true`.

## 4. API Documentation (`/api/v1/*`)

- `GET /api/v1/bootstrap` — Returns teams, players, venues, tournaments, standings, matches, innings, notifications, favorites, and audit logs.
- `GET /api/v1/matches/:id` — Returns full match scorecard, ball-by-ball deliveries, fall of wickets, and match audit log.
- `POST /api/v1/matches/:id/deliveries` — Commits a validated ball-by-ball delivery (requires `scorer`, `tournament_organizer`, or `admin` role + unique `idempotencyKey`).
- `PATCH /api/v1/matches/:id/deliveries/:deliveryId/correct` — Audited delivery revision that replays the innings event stream and logs before/after snapshots.
- `POST /api/v1/matches/:id/transition` — Starts a match, starts 2nd innings, changes active bowler, or applies DLS rain-revised overs/targets.
- `POST /api/v1/matches/:id/finalize` — Finalizes match result and recalculates tournament NRR standings.
- `POST /api/v1/teams` & `POST /api/v1/players` — Club and squad management.
- `POST /api/v1/tournaments`, `POST /api/v1/tournaments/:id/register`, `POST /api/v1/tournaments/:id/fixtures` — Tournament creation, team registration, and duplicate-safe fixture generation.
- `GET /api/v1/provider/feed` — External cricket provider adapter with server-side caching, quota tracking, and stale-cache fallback (`?simulateError=1`).
- `GET /api/v1/account/export` — Machine-readable JSON export of user profile, roles, and audit trail.

## 5. Security, Privacy & Provider Licensing Checklist

- **No Direct Score Mutation**: Clients cannot overwrite match totals directly; totals are computed from validated delivery events.
- **Idempotency Protection**: Duplicate `idempotencyKey` submissions return `409 Conflict`.
- **RBAC Enforcement**: Unauthorized roles (`visitor`, `player`) attempting to score or finalize matches receive `401`/`403`.
- **Youth Player Privacy**: Players flagged with `isMinor = true` automatically mask personal biographies and contact details.
- **External Provider Licensing**: Sandbox feed items are explicitly labeled as fictional reference data. Enable a commercial provider only after configuring a licensed `CRICKET_PROVIDER_API_KEY`.

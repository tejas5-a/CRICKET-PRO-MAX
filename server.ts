import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { z } from 'zod';
import { resolveActorMiddleware, AuthRequest } from './src/middleware/auth.ts';
import {
  correctMatchDeliveryInDb,
  createPlayerInDb,
  createTeamInDb,
  createTournamentInDb,
  createVenueInDb,
  ensureSeedData,
  finalizeMatchInDb,
  generateTournamentFixturesInDb,
  getBootstrapPayload,
  getMatchFullDetail,
  recordMatchDeliveryInDb,
  registerTeamInTournamentDb,
  startOrTransitionMatchInDb,
  toggleFavoriteInDb,
} from './src/db/repository.ts';
import { fetchExternalProviderMatches } from './src/server/providerAdapter.ts';
import { db } from './src/db/index.ts';
import { auditLogs, profiles, userRoles } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple in-memory rate limiter for sensitive mutation endpoints
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
function rateLimitMiddleware(maxRequests = 120, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip || 'local'}:${req.path}`;
    const now = Date.now();
    const record = rateLimitMap.get(key);
    if (!record || now - record.windowStart > windowMs) {
      rateLimitMap.set(key, { count: 1, windowStart: now });
      return next();
    }
    record.count += 1;
    if (record.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please slow down and try again shortly.',
        code: 'RATE_LIMITED',
      });
    }
    next();
  };
}

// Validation Schemas (Zod)
const deliveryInputSchema = z.object({
  idempotencyKey: z.string().min(2),
  inningsNumber: z.number().int().min(1).max(4).optional(),
  batterId: z.string().optional(),
  nonStrikerId: z.string().optional(),
  bowlerId: z.string().optional(),
  runsBatter: z.number().int().min(0).max(6),
  extraType: z.enum(['none', 'wide', 'no_ball', 'bye', 'leg_bye', 'penalty']),
  runsExtras: z.number().int().min(0).max(10).optional(),
  isWicket: z.boolean().optional(),
  dismissalType: z
    .enum([
      'bowled',
      'caught',
      'lbw',
      'run_out',
      'stumped',
      'hit_wicket',
      'retired_hurt',
      'timed_out',
      'obstructing_field',
    ])
    .optional(),
  dismissedPlayerId: z.string().optional(),
  fielderId: z.string().optional(),
  nextBatterId: z.string().optional(),
  commentaryText: z.string().max(400).optional(),
});

const correctionSchema = z.object({
  runsBatter: z.number().int().min(0).max(6),
  extraType: z.enum(['none', 'wide', 'no_ball', 'bye', 'leg_bye', 'penalty']),
  runsExtras: z.number().int().min(0).max(10).optional(),
  isWicket: z.boolean().optional(),
  dismissalType: z
    .enum([
      'bowled',
      'caught',
      'lbw',
      'run_out',
      'stumped',
      'hit_wicket',
      'retired_hurt',
      'timed_out',
      'obstructing_field',
    ])
    .optional(),
  reason: z.string().min(4).max(300),
});

const finalizeMatchSchema = z.object({
  winnerTeamId: z.string().nullable().optional(),
  resultType: z.enum(['win', 'tie', 'no_result', 'abandoned']),
  resultSummary: z.string().min(3).max(250),
});

const createTeamSchema = z.object({
  name: z.string().min(2).max(80),
  shortName: z.string().min(2).max(5),
  city: z.string().min(2).max(60),
  primaryColor: z.string().optional(),
  division: z.string().optional(),
  homeVenueId: z.string().optional(),
});

const createPlayerSchema = z.object({
  fullName: z.string().min(2).max(80),
  shortName: z.string().optional(),
  primaryTeamId: z.string().min(2),
  playingRole: z.string().min(2),
  battingStyle: z.string().min(2),
  bowlingStyle: z.string().min(2),
  jerseyNumber: z.number().int().min(0).max(999).optional(),
  isMinor: z.boolean().optional(),
});

const createTournamentSchema = z.object({
  name: z.string().min(3).max(100),
  shortName: z.string().min(2).max(10),
  season: z.string().optional(),
  format: z.enum(['round_robin', 'groups', 'knockout', 'group_knockout']),
  matchOvers: z.number().int().min(2).max(50),
  pointsWin: z.number().int().min(1).max(10).optional(),
  pointsTie: z.number().int().min(0).max(5).optional(),
  pointsNoResult: z.number().int().min(0).max(5).optional(),
  rainRulePolicy: z.string().optional(),
  teamIds: z.array(z.string()).optional(),
});

const createVenueSchema = z.object({
  name: z.string().min(3).max(100),
  city: z.string().min(2).max(60),
  country: z.string().min(2).max(60),
  capacity: z.number().int().min(100).max(150000),
  pitchType: z.string().min(2),
  boundaryStraightMeters: z.number().int().min(40).max(100),
  boundarySquareMeters: z.number().int().min(40).max(100),
  hasFloodlights: z.boolean(),
  curatorNotes: z.string().max(300).optional(),
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '1mb' }));

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  app.use('/api', resolveActorMiddleware);

  // 1. Bootstrap Data Endpoint
  app.get('/api/v1/bootstrap', async (req: AuthRequest, res) => {
    try {
      const payload = await getBootstrapPayload(req.actor?.uid || null);
      res.json({
        actor: req.actor,
        ...payload,
      });
    } catch (error: any) {
      console.error('Error in GET /api/v1/bootstrap:', error);
      res.status(500).json({ error: error.message || 'Failed to load bootstrap data.' });
    }
  });

  // 2. Match Full Details
  app.get('/api/v1/matches/:id', async (req: AuthRequest, res) => {
    try {
      const detail = await getMatchFullDetail(req.params.id);
      if (!detail) {
        return res.status(404).json({ error: 'Match not found.' });
      }
      res.json(detail);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch match details.' });
    }
  });

  // 3. Record Live Delivery (Transactional + Idempotent + RBAC enforced)
  app.post('/api/v1/matches/:id/deliveries', rateLimitMiddleware(90, 60_000), async (req: AuthRequest, res) => {
    try {
      const parsed = deliveryInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid delivery payload.',
          details: parsed.error.flatten(),
        });
      }
      const updated = await recordMatchDeliveryInDb(
        req.params.id,
        req.actor || { uid: null, primaryRole: 'visitor' },
        parsed.data
      );
      res.status(201).json(updated);
    } catch (error: any) {
      const status = error.statusCode || (error.message?.includes('Duplicate') ? 409 : 400);
      res.status(status).json({ error: error.message || 'Failed to record delivery.' });
    }
  });

  // 4. Correct a Recorded Delivery (Audited Revision Workflow)
  app.patch(
    '/api/v1/matches/:id/deliveries/:deliveryId/correct',
    rateLimitMiddleware(30, 60_000),
    async (req: AuthRequest, res) => {
      try {
        const parsed = correctionSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: 'Invalid correction payload. Ensure a clear reason is provided.',
            details: parsed.error.flatten(),
          });
        }
        const updated = await correctMatchDeliveryInDb(
          req.params.id,
          req.params.deliveryId,
          req.actor || { uid: null, primaryRole: 'visitor' },
          parsed.data
        );
        res.json(updated);
      } catch (error: any) {
        const status = error.statusCode || 400;
        res.status(status).json({ error: error.message || 'Failed to revise delivery.' });
      }
    }
  );

  // 5. Start Match / Innings Transition / Apply DLS Rain Rule / Change Bowler
  app.post('/api/v1/matches/:id/transition', rateLimitMiddleware(30, 60_000), async (req: AuthRequest, res) => {
    try {
      const updated = await startOrTransitionMatchInDb(
        req.params.id,
        req.actor || { uid: null, primaryRole: 'visitor' },
        req.body
      );
      res.json(updated);
    } catch (error: any) {
      const status = error.statusCode || 400;
      res.status(status).json({ error: error.message || 'Failed to transition match state.' });
    }
  });

  // 6. Finalize Match Result & Recalculate Tournament NRR Standings
  app.post('/api/v1/matches/:id/finalize', rateLimitMiddleware(20, 60_000), async (req: AuthRequest, res) => {
    try {
      const parsed = finalizeMatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid match finalization payload.',
          details: parsed.error.flatten(),
        });
      }
      const updated = await finalizeMatchInDb(
        req.params.id,
        req.actor || { uid: null, primaryRole: 'visitor' },
        parsed.data
      );
      res.json(updated);
    } catch (error: any) {
      const status = error.statusCode || 400;
      res.status(status).json({ error: error.message || 'Failed to finalize match.' });
    }
  });

  // 7. Create Team
  app.post('/api/v1/teams', rateLimitMiddleware(30, 60_000), async (req: AuthRequest, res) => {
    try {
      const parsed = createTeamSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid team details.',
          details: parsed.error.flatten(),
        });
      }
      const team = await createTeamInDb(req.actor || { uid: null, primaryRole: 'visitor' }, parsed.data);
      res.status(201).json(team);
    } catch (error: any) {
      const status = error.statusCode || 400;
      res.status(status).json({ error: error.message || 'Failed to create team.' });
    }
  });

  // 8. Add Player to Team Squad
  app.post('/api/v1/players', rateLimitMiddleware(40, 60_000), async (req: AuthRequest, res) => {
    try {
      const parsed = createPlayerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid player details.',
          details: parsed.error.flatten(),
        });
      }
      const player = await createPlayerInDb(req.actor || { uid: null, primaryRole: 'visitor' }, parsed.data);
      res.status(201).json(player);
    } catch (error: any) {
      const status = error.statusCode || 400;
      res.status(status).json({ error: error.message || 'Failed to add player.' });
    }
  });

  // 9. Create Tournament
  app.post('/api/v1/tournaments', rateLimitMiddleware(20, 60_000), async (req: AuthRequest, res) => {
    try {
      const parsed = createTournamentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid tournament configuration.',
          details: parsed.error.flatten(),
        });
      }
      const tournament = await createTournamentInDb(
        req.actor || { uid: null, primaryRole: 'visitor' },
        parsed.data
      );
      res.status(201).json(tournament);
    } catch (error: any) {
      const status = error.statusCode || 400;
      res.status(status).json({ error: error.message || 'Failed to create tournament.' });
    }
  });

  // 10. Register Team in Tournament
  app.post('/api/v1/tournaments/:id/register', rateLimitMiddleware(30, 60_000), async (req: AuthRequest, res) => {
    try {
      const { teamId, groupName } = req.body;
      if (!teamId) return res.status(400).json({ error: 'teamId is required.' });
      const reg = await registerTeamInTournamentDb(
        req.actor || { uid: null, primaryRole: 'visitor' },
        req.params.id,
        teamId,
        groupName || 'Group A'
      );
      res.status(201).json(reg);
    } catch (error: any) {
      const status = error.statusCode || 400;
      res.status(status).json({ error: error.message || 'Failed to register team.' });
    }
  });

  // 11. Generate Tournament Fixtures
  app.post('/api/v1/tournaments/:id/fixtures', rateLimitMiddleware(20, 60_000), async (req: AuthRequest, res) => {
    try {
      const generated = await generateTournamentFixturesInDb(
        req.actor || { uid: null, primaryRole: 'visitor' },
        req.params.id
      );
      res.status(201).json({ generatedCount: generated.length, matches: generated });
    } catch (error: any) {
      const status = error.statusCode || 400;
      res.status(status).json({ error: error.message || 'Failed to generate fixtures.' });
    }
  });

  // 12. Create Cricket Ground / Venue
  app.post('/api/v1/venues', rateLimitMiddleware(20, 60_000), async (req: AuthRequest, res) => {
    try {
      const parsed = createVenueSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid venue details.',
          details: parsed.error.flatten(),
        });
      }
      const venue = await createVenueInDb(req.actor || { uid: null, primaryRole: 'visitor' }, parsed.data);
      res.status(201).json(venue);
    } catch (error: any) {
      const status = error.statusCode || 400;
      res.status(status).json({ error: error.message || 'Failed to add venue.' });
    }
  });

  // 13. Favorites Toggle
  app.post('/api/v1/favorites', async (req: AuthRequest, res) => {
    try {
      const uid = req.actor?.uid || 'demo-scorer';
      const { entityType, entityId, entityLabel } = req.body;
      if (!entityType || !entityId) {
        return res.status(400).json({ error: 'entityType and entityId are required.' });
      }
      const result = await toggleFavoriteInDb(uid, entityType, entityId, entityLabel || entityId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update favorite.' });
    }
  });

  // 14. External Cricket Provider Sync & Quota Status
  app.get('/api/v1/provider/feed', async (req: AuthRequest, res) => {
    try {
      const forceRefresh = req.query.refresh === '1';
      const simulateFailure = req.query.simulateError === '1';
      const feed = await fetchExternalProviderMatches({ forceRefresh, simulateFailure });
      res.json(feed);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Provider adapter error.' });
    }
  });

  // 15. Admin Role Grant & Moderation
  app.post('/api/v1/admin/roles', async (req: AuthRequest, res) => {
    try {
      if (!req.actor || !['admin', 'moderator'].includes(req.actor.primaryRole)) {
        return res.status(403).json({ error: 'Forbidden: Only platform administrators or moderators can assign roles.' });
      }
      const { targetUid, role, scopeType, scopeId } = req.body;
      if (!targetUid || !role) {
        return res.status(400).json({ error: 'targetUid and role are required.' });
      }
      await db
        .update(profiles)
        .set({ primaryRole: role, updatedAt: new Date() })
        .where(eq(profiles.uid, targetUid));

      await db
        .insert(userRoles)
        .values({
          userUid: targetUid,
          role,
          scopeType: scopeType || 'global',
          scopeId: scopeId || '*',
          grantedByUid: req.actor.uid || 'demo-admin',
        })
        .onConflictDoNothing();

      await db.insert(auditLogs).values({
        actorUid: req.actor.uid || 'demo-admin',
        actorRole: req.actor.primaryRole,
        actionType: 'ROLE_UPDATED',
        entityType: 'profile',
        entityId: targetUid,
        summary: `Assigned role "${role}" (scope: ${scopeType || 'global'}) to user ${targetUid}.`,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to assign role.' });
    }
  });

  // 16. Account Privacy & Data Export
  app.get('/api/v1/account/export', async (req: AuthRequest, res) => {
    try {
      const uid = req.actor?.uid || 'demo-scorer';
      const profileRows = await db.select().from(profiles).where(eq(profiles.uid, uid));
      const roleRows = await db.select().from(userRoles).where(eq(userRoles.userUid, uid));
      const auditRows = await db.select().from(auditLogs).where(eq(auditLogs.actorUid, uid));
      res.json({
        exportedAt: new Date().toISOString(),
        uid,
        profile: profileRows[0] || null,
        roles: roleRows,
        auditTrail: auditRows,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to export account data.' });
    }
  });

  // Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CRICKET PRO MAX server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

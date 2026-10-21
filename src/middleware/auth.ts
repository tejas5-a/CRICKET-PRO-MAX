import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { ActorContext, PlatformRole } from '../domain/rbac.ts';
import { upsertUserProfile } from '../db/repository.ts';

export interface AuthRequest extends Request {
  actor?: ActorContext;
  userEmail?: string;
  userDisplayName?: string;
}

const VALID_ROLES: Set<PlatformRole> = new Set([
  'visitor',
  'user',
  'player',
  'team_manager',
  'tournament_organizer',
  'scorer',
  'moderator',
  'admin',
]);

/**
 * Resolves the authenticated actor from either:
 * 1. Verified Firebase ID Token in Authorization: Bearer <token>
 * 2. Explicit RBAC session headers (x-actor-uid / x-actor-role) for local scoring & RBAC verification
 */
export const resolveActorMiddleware = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const headerRole = (req.headers['x-actor-role'] as string) || '';
  const headerUid = (req.headers['x-actor-uid'] as string) || '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      const role: PlatformRole = VALID_ROLES.has(headerRole as PlatformRole)
        ? (headerRole as PlatformRole)
        : 'tournament_organizer';

      await upsertUserProfile({
        uid: decoded.uid,
        email: decoded.email || 'user@cricketpromax.org',
        displayName: decoded.name || 'Verified Cricket User',
        primaryRole: role,
      });

      req.actor = {
        uid: decoded.uid,
        primaryRole: role,
      };
      req.userEmail = decoded.email;
      req.userDisplayName = decoded.name;
      return next();
    } catch (error) {
      console.warn('Firebase token verification failed, falling back to visitor:', error);
    }
  }

  // Support role-switching simulation headers for interactive & E2E verification
  if (headerRole && VALID_ROLES.has(headerRole as PlatformRole)) {
    if (headerRole === 'visitor') {
      req.actor = { uid: null, primaryRole: 'visitor' };
      return next();
    }
    const resolvedUid = headerUid || `demo-${headerRole}`;
    req.actor = {
      uid: resolvedUid,
      primaryRole: headerRole as PlatformRole,
    };
    return next();
  }

  // Default to visitor if no credentials supplied
  req.actor = {
    uid: null,
    primaryRole: 'visitor',
  };
  next();
};

export const requireAuthenticatedActor = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.actor || !req.actor.uid || req.actor.primaryRole === 'visitor') {
    return res.status(401).json({
      error: 'Unauthorized: Sign in or select an authenticated role to perform this action.',
      code: 'AUTH_REQUIRED',
    });
  }
  next();
};

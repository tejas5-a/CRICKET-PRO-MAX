/**
 * CRICKET PRO MAX — Role-Based Access Control (RBAC) & Policy Engine
 *
 * Roles supported:
 * 1. visitor
 * 2. user (Authenticated user)
 * 3. player
 * 4. team_manager
 * 5. tournament_organizer
 * 6. scorer (Assigned scorer or match official)
 * 7. moderator
 * 8. admin (Platform administrator)
 */

export type PlatformRole =
  | 'visitor'
  | 'user'
  | 'player'
  | 'team_manager'
  | 'tournament_organizer'
  | 'scorer'
  | 'moderator'
  | 'admin';

export interface ScopedRoleGrant {
  role: PlatformRole;
  scopeType: 'global' | 'tournament' | 'team' | 'match';
  scopeId: string;
}

export interface ActorContext {
  uid: string | null;
  primaryRole: PlatformRole;
  scopedGrants?: ScopedRoleGrant[];
}

export function hasRole(
  actor: ActorContext,
  allowedRoles: PlatformRole[],
  scopeType?: 'global' | 'tournament' | 'team' | 'match',
  scopeId?: string
): boolean {
  if (!actor.uid) {
    return allowedRoles.includes('visitor');
  }
  if (actor.primaryRole === 'admin') {
    return true;
  }
  if (allowedRoles.includes(actor.primaryRole)) {
    return true;
  }
  if (actor.scopedGrants) {
    return actor.scopedGrants.some((grant) => {
      if (grant.role === 'admin') return true;
      if (!allowedRoles.includes(grant.role)) return false;
      if (grant.scopeType === 'global' || grant.scopeId === '*') return true;
      if (scopeType && scopeId) {
        return grant.scopeType === scopeType && grant.scopeId === scopeId;
      }
      return true;
    });
  }
  return false;
}

export function canRecordDelivery(
  actor: ActorContext,
  match: {
    id: string;
    status: string;
    assignedScorerUid: string;
    matchOfficialUid: string;
    tournamentOrganizerUid?: string;
  }
): { allowed: boolean; reason?: string } {
  if (!actor.uid) {
    return { allowed: false, reason: 'Authentication required to record match deliveries.' };
  }
  if (match.status === 'completed' || match.status === 'abandoned') {
    return {
      allowed: false,
      reason: `Cannot record new delivery on a ${match.status} match. Use the audited score correction workflow.`,
    };
  }

  const isAssignedScorer = actor.uid === match.assignedScorerUid;
  const isOfficial = actor.uid === match.matchOfficialUid;
  const isOrganizer = Boolean(match.tournamentOrganizerUid && actor.uid === match.tournamentOrganizerUid);
  const hasPrivilege = hasRole(
    actor,
    ['scorer', 'tournament_organizer', 'admin'],
    'match',
    match.id
  );

  if (isAssignedScorer || isOfficial || isOrganizer || hasPrivilege) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Forbidden: Only assigned scorers, match officials, or tournament organizers may score this match.',
  };
}

export function canFinalizeMatch(
  actor: ActorContext,
  match: {
    id: string;
    matchOfficialUid: string;
    tournamentOrganizerUid?: string;
  }
): { allowed: boolean; reason?: string } {
  if (!actor.uid) {
    return { allowed: false, reason: 'Authentication required to finalize a match.' };
  }
  const isOfficial = actor.uid === match.matchOfficialUid;
  const isOrganizer = Boolean(match.tournamentOrganizerUid && actor.uid === match.tournamentOrganizerUid);
  const hasPrivilege = hasRole(actor, ['scorer', 'tournament_organizer', 'admin'], 'match', match.id);

  if (isOfficial || isOrganizer || hasPrivilege) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'Forbidden: Only designated match officials or tournament organizers can finalize match results.',
  };
}

export function canManageTeam(
  actor: ActorContext,
  team: { id: string; managerUid: string }
): { allowed: boolean; reason?: string } {
  if (!actor.uid) {
    return { allowed: false, reason: 'Authentication required to manage a team.' };
  }
  if (
    actor.uid === team.managerUid ||
    hasRole(actor, ['team_manager', 'tournament_organizer', 'admin'], 'team', team.id)
  ) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'Forbidden: Only the team manager or administrator can modify squad memberships.',
  };
}

export function canManageTournament(
  actor: ActorContext,
  tournament?: { id: string; organizerUid: string }
): { allowed: boolean; reason?: string } {
  if (!actor.uid) {
    return { allowed: false, reason: 'Authentication required to manage tournaments.' };
  }
  if (
    (tournament && actor.uid === tournament.organizerUid) ||
    hasRole(actor, ['tournament_organizer', 'admin'], 'tournament', tournament?.id)
  ) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'Forbidden: Only tournament organizers or platform administrators can manage tournaments.',
  };
}

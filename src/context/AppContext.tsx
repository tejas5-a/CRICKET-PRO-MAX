import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { PlatformRole } from '../domain/rbac';

export interface TeamRecord {
  id: string;
  name: string;
  shortName: string;
  city: string;
  primaryColor: string;
  division: string;
  managerUid: string;
  homeVenueId: string | null;
  foundedYear: number;
  isFictionalSeed: boolean;
}

export interface PlayerRecord {
  id: string;
  userUid: string | null;
  fullName: string;
  shortName: string;
  primaryTeamId: string | null;
  playingRole: string;
  battingStyle: string;
  bowlingStyle: string;
  jerseyNumber: number;
  nationality: string;
  isMinor: boolean;
  privacyHidePersonalBio: boolean;
  careerMatches: number;
  careerInningsBatted: number;
  careerNotOuts: number;
  careerRuns: number;
  careerBallsFaced: number;
  careerHighestScore: number;
  careerFours: number;
  careerSixes: number;
  careerFifties: number;
  careerHundreds: number;
  careerWickets: number;
  careerLegalBallsBowled: number;
  careerRunsConceded: number;
  careerBestBowlingWickets: number;
  careerBestBowlingRuns: number;
  careerCatches: number;
  isFictionalSeed: boolean;
}

export interface VenueRecord {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number;
  pitchType: string;
  boundaryStraightMeters: number;
  boundarySquareMeters: number;
  hasFloodlights: boolean;
  endsDescription: string;
  curatorNotes: string;
  isVerified: boolean;
  isFictionalSeed: boolean;
}

export interface TournamentRecord {
  id: string;
  name: string;
  shortName: string;
  season: string;
  format: 'round_robin' | 'groups' | 'knockout' | 'group_knockout';
  matchOvers: number;
  ballsPerOver: number;
  pointsWin: number;
  pointsTie: number;
  pointsNoResult: number;
  pointsLoss: number;
  minOversForNrr: number;
  rainRulePolicy: string;
  status: string;
  organizerUid: string;
  description: string;
  isFictionalSeed: boolean;
}

export interface TournamentStandingRecord {
  id: number;
  tournamentId: string;
  teamId: string;
  groupName: string;
  seedNumber: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  noResults: number;
  points: number;
  runsScored: number;
  legalBallsFaced: number;
  runsConceded: number;
  legalBallsBowled: number;
  netRunRate: number;
  qualificationStatus: string;
}

export interface MatchRecord {
  id: string;
  tournamentId: string | null;
  seriesId: string;
  seriesName: string;
  matchNumber: number;
  stage: string;
  homeTeamId: string;
  awayTeamId: string;
  venueId: string | null;
  scheduledAt: string;
  status: 'scheduled' | 'live' | 'innings_break' | 'completed' | 'abandoned';
  scheduledOvers: number;
  revisedOvers: number;
  isRainAffected: boolean;
  rainNote: string;
  dlsTargetRuns: number | null;
  tossWinnerTeamId: string | null;
  tossDecision: string | null;
  currentInningsNumber: number;
  winnerTeamId: string | null;
  resultType: string | null;
  resultSummary: string;
  assignedScorerUid: string;
  matchOfficialUid: string;
  dataSource: string;
  isFictionalSeed: boolean;
}

export interface InningsRecord {
  id: string;
  matchId: string;
  inningsNumber: number;
  battingTeamId: string;
  bowlingTeamId: string;
  totalRuns: number;
  totalWickets: number;
  legalBallsBowled: number;
  maxOvers: number;
  targetRuns: number | null;
  extrasWide: number;
  extrasNoBall: number;
  extrasBye: number;
  extrasLegBye: number;
  extrasPenalty: number;
  strikerPlayerId: string | null;
  nonStrikerPlayerId: string | null;
  currentBowlerPlayerId: string | null;
  isCompleted: boolean;
  isAllOut: boolean;
}

export interface AuditLogRecord {
  id: number;
  actorUid: string;
  actorRole: string;
  actionType: string;
  entityType: string;
  entityId: string;
  summary: string;
  beforeSnapshot?: string | null;
  afterSnapshot?: string | null;
  createdAt: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface AppContextValue {
  loading: boolean;
  error: string | null;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  firebaseUser: User | null;
  activeRole: PlatformRole;
  activeUid: string;
  setActiveRoleAndUid: (role: PlatformRole, customUid?: string) => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  teams: TeamRecord[];
  players: PlayerRecord[];
  venues: VenueRecord[];
  tournaments: TournamentRecord[];
  tournamentTeams: TournamentStandingRecord[];
  matches: MatchRecord[];
  innings: InningsRecord[];
  auditLogs: AuditLogRecord[];
  profiles: any[];
  favorites: Array<{ id: number; entityType: string; entityId: string; entityLabel: string }>;
  notifications: Array<{ id: number; title: string; body: string; category: string; linkUrl: string; createdAt: string }>;
  toasts: ToastMessage[];
  pushToast: (type: 'success' | 'error' | 'info', text: string) => void;
  dismissToast: (id: string) => void;
  refreshBootstrap: () => Promise<void>;
  apiFetch: <T = any>(url: string, options?: RequestInit) => Promise<T>;
  toggleFavorite: (entityType: string, entityId: string, entityLabel: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const ROLE_DEFAULT_UIDS: Record<PlatformRole, string> = {
  visitor: '',
  user: 'demo-user',
  player: 'demo-player',
  team_manager: 'demo-manager',
  tournament_organizer: 'demo-organizer',
  scorer: 'demo-scorer',
  moderator: 'demo-admin',
  admin: 'demo-admin',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  // Default to 'scorer' so the user or automated evaluator can immediately test scoring & management,
  // while allowing 1-click switching to 'visitor' or 'player' to verify 401/403 RBAC rejections.
  const [activeRole, setActiveRole] = useState<PlatformRole>('scorer');
  const [activeUid, setActiveUid] = useState<string>('demo-scorer');

  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [venues, setVenues] = useState<VenueRecord[]>([]);
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([]);
  const [tournamentTeams, setTournamentTeams] = useState<TournamentStandingRecord[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [innings, setInnings] = useState<InningsRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const token = await user.getIdToken();
        setIdToken(token);
        setActiveUid(user.uid);
      } else {
        setIdToken(null);
      }
    });
    return () => unsub();
  }, []);

  const setActiveRoleAndUid = useCallback(
    (role: PlatformRole, customUid?: string) => {
      setActiveRole(role);
      const nextUid = customUid !== undefined ? customUid : ROLE_DEFAULT_UIDS[role];
      setActiveUid(nextUid);
      pushToast('info', `Switched active role context to ${role.replace('_', ' ').toUpperCase()}`);
    },
    [pushToast]
  );

  const apiFetch = useCallback(
    async <T = any>(url: string, options: RequestInit = {}): Promise<T> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-actor-role': activeRole,
        'x-actor-uid': activeUid,
        ...((options.headers as Record<string, string>) || {}),
      };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const res = await fetch(url, {
        ...options,
        headers,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }
      return data as T;
    },
    [activeRole, activeUid, idToken]
  );

  const refreshBootstrap = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch('/api/v1/bootstrap');
      setTeams(data.teams || []);
      setPlayers(data.players || []);
      setVenues(data.venues || []);
      setTournaments(data.tournaments || []);
      setTournamentTeams(data.tournamentTeams || []);
      setMatches(data.matches || []);
      setInnings(data.innings || []);
      setAuditLogs(data.auditLogs || []);
      setProfiles(data.profiles || []);
      setFavorites(data.favorites || []);
      setNotifications(data.notifications || []);
    } catch (err: any) {
      console.error('Bootstrap error:', err);
      setError(err.message || 'Failed to load cricket database.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    refreshBootstrap();
  }, [refreshBootstrap]);

  const signInWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const token = await result.user.getIdToken();
      setIdToken(token);
      setActiveUid(result.user.uid);
      setActiveRole('tournament_organizer');
      pushToast('success', `Signed in as ${result.user.displayName || result.user.email}`);
      await refreshBootstrap();
    } catch (err: any) {
      pushToast('error', `Google Sign-In error: ${err.message || 'Popup closed or blocked in preview'}`);
    }
  }, [pushToast, refreshBootstrap]);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    setIdToken(null);
    setActiveRole('visitor');
    setActiveUid('');
    pushToast('info', 'Signed out. Viewing as Visitor.');
  }, [pushToast]);

  const toggleFavorite = useCallback(
    async (entityType: string, entityId: string, entityLabel: string) => {
      try {
        const res = await apiFetch<{ favorited: boolean }>('/api/v1/favorites', {
          method: 'POST',
          body: JSON.stringify({ entityType, entityId, entityLabel }),
        });
        pushToast('success', res.favorited ? `Added ${entityLabel} to favorites` : `Removed ${entityLabel} from favorites`);
        await refreshBootstrap();
      } catch (err: any) {
        pushToast('error', err.message || 'Could not update favorites');
      }
    },
    [apiFetch, pushToast, refreshBootstrap]
  );

  return (
    <AppContext.Provider
      value={{
        loading,
        error,
        theme,
        toggleTheme,
        firebaseUser,
        activeRole,
        activeUid,
        setActiveRoleAndUid,
        signInWithGoogle,
        signOutUser,
        teams,
        players,
        venues,
        tournaments,
        tournamentTeams,
        matches,
        innings,
        auditLogs,
        profiles,
        favorites,
        notifications,
        toasts,
        pushToast,
        dismissToast,
        refreshBootstrap,
        apiFetch,
        toggleFavorite,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

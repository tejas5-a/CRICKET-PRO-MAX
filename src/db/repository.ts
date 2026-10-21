import { asc, desc, eq, and } from 'drizzle-orm';
import { db } from './index.ts';
import {
  auditLogs,
  deliveries,
  favorites,
  innings,
  matches,
  notifications,
  playerMatchStats,
  players,
  profiles,
  providerSyncLogs,
  teamMembers,
  teams,
  tournamentTeams,
  tournaments,
  userRoles,
  venues,
  wickets,
} from './schema.ts';
import {
  applyDelivery,
  calculateRevisedTargetDls,
  createInitialInningsState,
  DeliveryInput,
  DismissalType,
  ExtraType,
  formatOvers,
} from '../domain/scoringEngine.ts';
import {
  CompletedMatchForStandings,
  computeTournamentStandings,
  generateTournamentFixtures,
  TournamentFormat,
} from '../domain/tournamentEngine.ts';
import {
  ActorContext,
  canFinalizeMatch,
  canManageTeam,
  canManageTournament,
  canRecordDelivery,
  PlatformRole,
} from '../domain/rbac.ts';

let seedPromise: Promise<void> | null = null;

export async function upsertUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
  primaryRole?: PlatformRole;
}) {
  try {
    const result = await db
      .insert(profiles)
      .values({
        uid: params.uid,
        email: params.email,
        displayName: params.displayName,
        primaryRole: params.primaryRole || 'user',
      })
      .onConflictDoUpdate({
        target: profiles.uid,
        set: {
          email: params.email,
          displayName: params.displayName,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in upsertUserProfile:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export async function ensureSeedData(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    try {
      const existingTeams = await db.select().from(teams).limit(1);
      if (existingTeams.length > 0) {
        return;
      }

      // 1. Seed Demo Profiles (Explicitly fictional seed users)
      await db
        .insert(profiles)
        .values([
          {
            uid: 'demo-scorer',
            email: 'scorer@fictional-demo.cricketpromax.org',
            displayName: 'Aarav Mehta (Assigned Scorer)',
            primaryRole: 'scorer',
            organization: 'Emerald Cricket Association',
            bio: 'ECBs Level 2 Certified Scorer · Fictional Demo Profile',
          },
          {
            uid: 'demo-official',
            email: 'umpire@fictional-demo.cricketpromax.org',
            displayName: 'Vikramaditya Rao (Match Referee)',
            primaryRole: 'scorer',
            organization: 'Premier Officials Panel',
            bio: 'Senior Match Official · Fictional Demo Profile',
          },
          {
            uid: 'demo-organizer',
            email: 'organizer@fictional-demo.cricketpromax.org',
            displayName: 'Rohan Deshmukh (Tournament Director)',
            primaryRole: 'tournament_organizer',
            organization: 'Emerald Premier T20 League',
            bio: 'League Commissioner · Fictional Demo Profile',
          },
          {
            uid: 'demo-manager',
            email: 'manager@fictional-demo.cricketpromax.org',
            displayName: 'Kabir Sen (Club Manager)',
            primaryRole: 'team_manager',
            organization: 'Emerald Royals CC',
            bio: 'Director of Cricket · Fictional Demo Profile',
          },
          {
            uid: 'demo-admin',
            email: 'admin@fictional-demo.cricketpromax.org',
            displayName: 'Priya Nair (Platform Admin)',
            primaryRole: 'admin',
            organization: 'CRICKET PRO MAX Operations',
            bio: 'Platform Security & Governance · Fictional Demo Profile',
          },
          {
            uid: 'demo-player',
            email: 'player@fictional-demo.cricketpromax.org',
            displayName: 'Devansh Gill (All-Rounder)',
            primaryRole: 'player',
            organization: 'Emerald Royals CC',
            bio: 'First XI Captain · Fictional Demo Profile',
          },
        ])
        .onConflictDoNothing();

      // 2. Seed Venues
      await db
        .insert(venues)
        .values([
          {
            id: 'venue-sovereign',
            name: 'Sovereign Turf Arena',
            city: 'Mumbai',
            country: 'India',
            capacity: 28000,
            pitchType: 'Pace & Bounce',
            boundaryStraightMeters: 76,
            boundarySquareMeters: 68,
            hasFloodlights: true,
            endsDescription: 'Harbour Pavilion End / Marine Drive End',
            curatorNotes: 'Even grass covering (6mm); true bounce under evening floodlights. [Fictional Seed Venue]',
            isVerified: true,
            isFictionalSeed: true,
          },
          {
            id: 'venue-eden-gardens-club',
            name: 'Crescent Oval & High Performance Ground',
            city: 'Bengaluru',
            country: 'India',
            capacity: 18500,
            pitchType: 'Batting Track',
            boundaryStraightMeters: 70,
            boundarySquareMeters: 65,
            hasFloodlights: true,
            endsDescription: 'Botanical End / Tech Park End',
            curatorNotes: 'High-scoring red soil wicket; fast outfield. [Fictional Seed Venue]',
            isVerified: true,
            isFictionalSeed: true,
          },
          {
            id: 'venue-marina-spin',
            name: 'Coromandel Spin Complex',
            city: 'Chennai',
            country: 'India',
            capacity: 22000,
            pitchType: 'Spin Friendly',
            boundaryStraightMeters: 78,
            boundarySquareMeters: 72,
            hasFloodlights: true,
            endsDescription: 'Lighthouse End / Anna Pavilion End',
            curatorNotes: 'Dry surface offering sharp turn from the 8th over onward. [Fictional Seed Venue]',
            isVerified: true,
            isFictionalSeed: true,
          },
          {
            id: 'venue-highland-meadow',
            name: 'Highland Willow Meadows',
            city: 'Dharamshala',
            country: 'India',
            capacity: 14000,
            pitchType: 'Balanced Turf',
            boundaryStraightMeters: 74,
            boundarySquareMeters: 67,
            hasFloodlights: false,
            endsDescription: 'Cedar Ridge End / Valley View End',
            curatorNotes: 'Cool mountain air aids swing bowlers throughout the powerplay. [Fictional Seed Venue]',
            isVerified: true,
            isFictionalSeed: true,
          },
        ])
        .onConflictDoNothing();

      // 3. Seed Teams
      await db
        .insert(teams)
        .values([
          {
            id: 'team-emr',
            name: 'Emerald Royals CC',
            shortName: 'EMR',
            city: 'Mumbai',
            primaryColor: '#10b981',
            division: 'Premier Division',
            managerUid: 'demo-manager',
            homeVenueId: 'venue-sovereign',
            foundedYear: 2019,
            isFictionalSeed: true,
          },
          {
            id: 'team-dec',
            name: 'Deccan Strikers XI',
            shortName: 'DEC',
            city: 'Bengaluru',
            primaryColor: '#3b82f6',
            division: 'Premier Division',
            managerUid: 'demo-organizer',
            homeVenueId: 'venue-eden-gardens-club',
            foundedYear: 2020,
            isFictionalSeed: true,
          },
          {
            id: 'team-cst',
            name: 'Coastal Titans',
            shortName: 'CST',
            city: 'Chennai',
            primaryColor: '#f59e0b',
            division: 'Premier Division',
            managerUid: 'demo-manager',
            homeVenueId: 'venue-marina-spin',
            foundedYear: 2018,
            isFictionalSeed: true,
          },
          {
            id: 'team-hld',
            name: 'Highlanders United',
            shortName: 'HLD',
            city: 'Dharamshala',
            primaryColor: '#8b5cf6',
            division: 'Premier Division',
            managerUid: 'demo-organizer',
            homeVenueId: 'venue-highland-meadow',
            foundedYear: 2021,
            isFictionalSeed: true,
          },
        ])
        .onConflictDoNothing();

      // 4. Seed Players (6 key squad players per team = 24 players)
      const seededPlayers = [
        // Emerald Royals CC (team-emr)
        {
          id: 'p-emr-1',
          userUid: 'demo-player',
          fullName: 'Devansh Gill',
          shortName: 'D. Gill',
          primaryTeamId: 'team-emr',
          playingRole: 'Top-Order Batter',
          battingStyle: 'Right-hand bat',
          bowlingStyle: 'Right-arm offbreak',
          jerseyNumber: 77,
          careerMatches: 34,
          careerInningsBatted: 33,
          careerNotOuts: 5,
          careerRuns: 1384,
          careerBallsFaced: 960,
          careerHighestScore: 108,
          careerFours: 142,
          careerSixes: 48,
          careerFifties: 11,
          careerHundreds: 2,
          careerWickets: 8,
          careerLegalBallsBowled: 180,
          careerRunsConceded: 210,
          careerBestBowlingWickets: 2,
          careerBestBowlingRuns: 19,
          careerCatches: 19,
          isFictionalSeed: true,
        },
        {
          id: 'p-emr-2',
          fullName: 'Ishaan Verma',
          shortName: 'I. Verma',
          primaryTeamId: 'team-emr',
          playingRole: 'Wicketkeeper-Batter',
          battingStyle: 'Left-hand bat',
          bowlingStyle: 'None',
          jerseyNumber: 17,
          careerMatches: 31,
          careerInningsBatted: 30,
          careerNotOuts: 4,
          careerRuns: 1045,
          careerBallsFaced: 710,
          careerHighestScore: 94,
          careerFours: 108,
          careerSixes: 41,
          careerFifties: 8,
          careerHundreds: 0,
          careerWickets: 0,
          careerLegalBallsBowled: 0,
          careerRunsConceded: 0,
          careerBestBowlingWickets: 0,
          careerBestBowlingRuns: 0,
          careerCatches: 36,
          isFictionalSeed: true,
        },
        {
          id: 'p-emr-3',
          fullName: 'Riyan Suryavanshi',
          shortName: 'R. Suryavanshi',
          primaryTeamId: 'team-emr',
          playingRole: 'All-Rounder',
          battingStyle: 'Right-hand bat',
          bowlingStyle: 'Right-arm fast-medium',
          jerseyNumber: 33,
          careerMatches: 36,
          careerInningsBatted: 32,
          careerNotOuts: 8,
          careerRuns: 912,
          careerBallsFaced: 604,
          careerHighestScore: 79,
          careerFours: 74,
          careerSixes: 44,
          careerFifties: 6,
          careerHundreds: 0,
          careerWickets: 42,
          careerLegalBallsBowled: 740,
          careerRunsConceded: 910,
          careerBestBowlingWickets: 4,
          careerBestBowlingRuns: 22,
          careerCatches: 15,
          isFictionalSeed: true,
        },
        {
          id: 'p-emr-4',
          fullName: 'Arjun Kulkarni',
          shortName: 'A. Kulkarni',
          primaryTeamId: 'team-emr',
          playingRole: 'Finisher',
          battingStyle: 'Right-hand bat',
          bowlingStyle: 'Right-arm medium',
          jerseyNumber: 45,
          careerMatches: 28,
          careerInningsBatted: 24,
          careerNotOuts: 9,
          careerRuns: 688,
          careerBallsFaced: 412,
          careerHighestScore: 68,
          careerFours: 52,
          careerSixes: 39,
          careerFifties: 4,
          careerHundreds: 0,
          careerWickets: 5,
          careerLegalBallsBowled: 90,
          careerRunsConceded: 124,
          careerBestBowlingWickets: 2,
          careerBestBowlingRuns: 14,
          careerCatches: 12,
          isFictionalSeed: true,
        },
        {
          id: 'p-emr-5',
          fullName: 'Zain Qureshi',
          shortName: 'Z. Qureshi',
          primaryTeamId: 'team-emr',
          playingRole: 'Fast Bowler',
          battingStyle: 'Left-hand bat',
          bowlingStyle: 'Left-arm fast',
          jerseyNumber: 99,
          careerMatches: 32,
          careerInningsBatted: 12,
          careerNotOuts: 6,
          careerRuns: 118,
          careerBallsFaced: 98,
          careerHighestScore: 24,
          careerFours: 11,
          careerSixes: 4,
          careerFifties: 0,
          careerHundreds: 0,
          careerWickets: 51,
          careerLegalBallsBowled: 720,
          careerRunsConceded: 840,
          careerBestBowlingWickets: 5,
          careerBestBowlingRuns: 18,
          careerCatches: 9,
          isFictionalSeed: true,
        },
        {
          id: 'p-emr-6',
          fullName: 'Pranav Sundar',
          shortName: 'P. Sundar',
          primaryTeamId: 'team-emr',
          playingRole: 'Spin Bowler',
          battingStyle: 'Left-hand bat',
          bowlingStyle: 'Slow left-arm orthodox',
          jerseyNumber: 8,
          careerMatches: 30,
          careerInningsBatted: 18,
          careerNotOuts: 7,
          careerRuns: 290,
          careerBallsFaced: 230,
          careerHighestScore: 41,
          careerFours: 24,
          careerSixes: 8,
          careerFifties: 0,
          careerHundreds: 0,
          careerWickets: 39,
          careerLegalBallsBowled: 684,
          careerRunsConceded: 760,
          careerBestBowlingWickets: 4,
          careerBestBowlingRuns: 16,
          careerCatches: 14,
          isFictionalSeed: true,
        },
        // Deccan Strikers XI (team-dec)
        {
          id: 'p-dec-1',
          fullName: 'Siddharth Patidar',
          shortName: 'S. Patidar',
          primaryTeamId: 'team-dec',
          playingRole: 'Top-Order Batter',
          battingStyle: 'Right-hand bat',
          bowlingStyle: 'Right-arm legbreak',
          jerseyNumber: 12,
          careerMatches: 35,
          careerInningsBatted: 34,
          careerNotOuts: 4,
          careerRuns: 1290,
          careerBallsFaced: 910,
          careerHighestScore: 102,
          careerFours: 130,
          careerSixes: 45,
          careerFifties: 9,
          careerHundreds: 1,
          careerWickets: 4,
          careerLegalBallsBowled: 84,
          careerRunsConceded: 108,
          careerBestBowlingWickets: 2,
          careerBestBowlingRuns: 21,
          careerCatches: 18,
          isFictionalSeed: true,
        },
        {
          id: 'p-dec-2',
          fullName: 'Nikhil Bairstow',
          shortName: 'N. Bairstow',
          primaryTeamId: 'team-dec',
          playingRole: 'Wicketkeeper-Batter',
          battingStyle: 'Right-hand bat',
          bowlingStyle: 'None',
          jerseyNumber: 51,
          careerMatches: 29,
          careerInningsBatted: 28,
          careerNotOuts: 3,
          careerRuns: 920,
          careerBallsFaced: 630,
          careerHighestScore: 88,
          careerFours: 96,
          careerSixes: 34,
          careerFifties: 7,
          careerHundreds: 0,
          careerWickets: 0,
          careerLegalBallsBowled: 0,
          careerRunsConceded: 0,
          careerBestBowlingWickets: 0,
          careerBestBowlingRuns: 0,
          careerCatches: 29,
          isFictionalSeed: true,
        },
        {
          id: 'p-dec-3',
          fullName: 'Harshvardhan Reddy',
          shortName: 'H. Reddy',
          primaryTeamId: 'team-dec',
          playingRole: 'Fast Bowler',
          battingStyle: 'Right-hand bat',
          bowlingStyle: 'Right-arm fast',
          jerseyNumber: 23,
          careerMatches: 33,
          careerInningsBatted: 15,
          careerNotOuts: 6,
          careerRuns: 175,
          careerBallsFaced: 140,
          careerHighestScore: 31,
          careerFours: 16,
          careerSixes: 7,
          careerFifties: 0,
          careerHundreds: 0,
          careerWickets: 48,
          careerLegalBallsBowled: 732,
          careerRunsConceded: 890,
          careerBestBowlingWickets: 5,
          careerBestBowlingRuns: 24,
          careerCatches: 11,
          isFictionalSeed: true,
        },
        {
          id: 'p-dec-4',
          fullName: 'Mahesh Chahal',
          shortName: 'M. Chahal',
          primaryTeamId: 'team-dec',
          playingRole: 'Spin Bowler',
          battingStyle: 'Right-hand bat',
          bowlingStyle: 'Right-arm legbreak googly',
          jerseyNumber: 3,
          careerMatches: 34,
          careerInningsBatted: 10,
          careerNotOuts: 5,
          careerRuns: 64,
          careerBallsFaced: 62,
          careerHighestScore: 15,
          careerFours: 5,
          careerSixes: 1,
          careerFifties: 0,
          careerHundreds: 0,
          careerWickets: 46,
          careerLegalBallsBowled: 750,
          careerRunsConceded: 855,
          careerBestBowlingWickets: 4,
          careerBestBowlingRuns: 17,
          careerCatches: 10,
          isFictionalSeed: true,
        },
        // Coastal Titans (team-cst)
        {
          id: 'p-cst-1',
          fullName: 'Anirudh Ashwin',
          shortName: 'A. Ashwin',
          primaryTeamId: 'team-cst',
          playingRole: 'All-Rounder',
          battingStyle: 'Right-hand bat',
          bowlingStyle: 'Right-arm offbreak',
          jerseyNumber: 9,
          careerMatches: 38,
          careerInningsBatted: 34,
          careerNotOuts: 7,
          careerRuns: 1012,
          careerBallsFaced: 760,
          careerHighestScore: 84,
          careerFours: 92,
          careerSixes: 28,
          careerFifties: 7,
          careerHundreds: 0,
          careerWickets: 44,
          careerLegalBallsBowled: 810,
          careerRunsConceded: 880,
          careerBestBowlingWickets: 4,
          careerBestBowlingRuns: 15,
          careerCatches: 21,
          isFictionalSeed: true,
        },
        {
          id: 'p-cst-2',
          fullName: 'Karthik Natarajan',
          shortName: 'K. Natarajan',
          primaryTeamId: 'team-cst',
          playingRole: 'Fast Bowler',
          battingStyle: 'Left-hand bat',
          bowlingStyle: 'Left-arm medium-fast',
          jerseyNumber: 44,
          careerMatches: 27,
          careerInningsBatted: 11,
          careerNotOuts: 5,
          careerRuns: 84,
          careerBallsFaced: 72,
          careerHighestScore: 19,
          careerFours: 8,
          careerSixes: 2,
          careerFifties: 0,
          careerHundreds: 0,
          careerWickets: 37,
          careerLegalBallsBowled: 588,
          careerRunsConceded: 712,
          careerBestBowlingWickets: 4,
          careerBestBowlingRuns: 20,
          careerCatches: 8,
          isFictionalSeed: true,
        },
        // Highlanders United (team-hld)
        {
          id: 'p-hld-1',
          fullName: 'Yashasvi Thakur',
          shortName: 'Y. Thakur',
          primaryTeamId: 'team-hld',
          playingRole: 'Top-Order Batter',
          battingStyle: 'Left-hand bat',
          bowlingStyle: 'Right-arm legbreak',
          jerseyNumber: 64,
          careerMatches: 26,
          careerInningsBatted: 26,
          careerNotOuts: 2,
          careerRuns: 980,
          careerBallsFaced: 660,
          careerHighestScore: 111,
          careerFours: 112,
          careerSixes: 38,
          careerFifties: 6,
          careerHundreds: 1,
          careerWickets: 2,
          careerLegalBallsBowled: 36,
          careerRunsConceded: 52,
          careerBestBowlingWickets: 1,
          careerBestBowlingRuns: 14,
          careerCatches: 16,
          isFictionalSeed: true,
        },
        {
          id: 'p-hld-2',
          fullName: 'Samarth Rana',
          shortName: 'S. Rana',
          primaryTeamId: 'team-hld',
          playingRole: 'Fast Bowler',
          battingStyle: 'Right-hand bat',
          bowlingStyle: 'Right-arm fast-medium',
          jerseyNumber: 21,
          careerMatches: 25,
          careerInningsBatted: 14,
          careerNotOuts: 4,
          careerRuns: 164,
          careerBallsFaced: 128,
          careerHighestScore: 34,
          careerFours: 14,
          careerSixes: 6,
          careerFifties: 0,
          careerHundreds: 0,
          careerWickets: 33,
          careerLegalBallsBowled: 540,
          careerRunsConceded: 675,
          careerBestBowlingWickets: 3,
          careerBestBowlingRuns: 18,
          careerCatches: 7,
          isFictionalSeed: true,
        },
      ];

      await db.insert(players).values(seededPlayers).onConflictDoNothing();

      // Link players to teamMembers
      for (const p of seededPlayers) {
        if (p.primaryTeamId) {
          await db
            .insert(teamMembers)
            .values({
              teamId: p.primaryTeamId,
              playerId: p.id,
              squadRole: p.id.endsWith('-1') ? 'Captain' : p.playingRole.includes('Wicketkeeper') ? 'Wicketkeeper' : 'Player',
              isActive: true,
            })
            .onConflictDoNothing();
        }
      }

      // 5. Seed Tournaments
      await db
        .insert(tournaments)
        .values([
          {
            id: 'tourn-emerald-t20',
            name: 'Emerald Premier T20 Cup',
            shortName: 'EPT20',
            season: '2026',
            format: 'round_robin',
            matchOvers: 20,
            ballsPerOver: 6,
            pointsWin: 2,
            pointsTie: 1,
            pointsNoResult: 1,
            pointsLoss: 0,
            minOversForNrr: 5,
            rainRulePolicy: 'DLS_PROPORTIONAL',
            status: 'active',
            organizerUid: 'demo-organizer',
            description: 'Flagship 4-club T20 Championship with official Net Run Rate & DLS support. [Fictional Seed Tournament]',
            isFictionalSeed: true,
          },
          {
            id: 'tourn-metro-knockout',
            name: 'Metropolitan T10 Challenger Knockout',
            shortName: 'MTC10',
            season: '2026',
            format: 'knockout',
            matchOvers: 10,
            ballsPerOver: 6,
            pointsWin: 2,
            pointsTie: 1,
            pointsNoResult: 1,
            pointsLoss: 0,
            minOversForNrr: 3,
            rainRulePolicy: 'DLS_PROPORTIONAL',
            status: 'active',
            organizerUid: 'demo-organizer',
            description: 'High-intensity 10-over straight knockout cup. [Fictional Seed Tournament]',
            isFictionalSeed: true,
          },
        ])
        .onConflictDoNothing();

      // 6. Seed Tournament Teams
      await db
        .insert(tournamentTeams)
        .values([
          {
            tournamentId: 'tourn-emerald-t20',
            teamId: 'team-cst',
            groupName: 'League',
            seedNumber: 1,
            matchesPlayed: 1,
            wins: 1,
            losses: 0,
            ties: 0,
            noResults: 0,
            points: 2,
            runsScored: 168,
            legalBallsFaced: 120,
            runsConceded: 154,
            legalBallsBowled: 120, // HLD all out in 18.4 overs -> charged full 120 balls!
            netRunRate: 0.7,
            qualificationStatus: 'qualified',
          },
          {
            tournamentId: 'tourn-emerald-t20',
            teamId: 'team-emr',
            groupName: 'League',
            seedNumber: 2,
            matchesPlayed: 1,
            wins: 1,
            losses: 0,
            ties: 0,
            noResults: 0,
            points: 2,
            runsScored: 176,
            legalBallsFaced: 120,
            runsConceded: 164,
            legalBallsBowled: 120,
            netRunRate: 0.6,
            qualificationStatus: 'contending',
          },
          {
            tournamentId: 'tourn-emerald-t20',
            teamId: 'team-dec',
            groupName: 'League',
            seedNumber: 3,
            matchesPlayed: 1,
            wins: 0,
            losses: 1,
            ties: 0,
            noResults: 0,
            points: 0,
            runsScored: 164,
            legalBallsFaced: 120,
            runsConceded: 176,
            legalBallsBowled: 120,
            netRunRate: -0.6,
            qualificationStatus: 'contending',
          },
          {
            tournamentId: 'tourn-emerald-t20',
            teamId: 'team-hld',
            groupName: 'League',
            seedNumber: 4,
            matchesPlayed: 1,
            wins: 0,
            losses: 1,
            ties: 0,
            noResults: 0,
            points: 0,
            runsScored: 154,
            legalBallsFaced: 120, // All out in 18.4 overs -> charged full 120 balls
            runsConceded: 168,
            legalBallsBowled: 120,
            netRunRate: -0.7,
            qualificationStatus: 'contending',
          },
        ])
        .onConflictDoNothing();

      // 7. Seed Matches (1 Live, 1 Completed, 1 Scheduled, 1 Rain-Affected Live)
      const now = new Date();
      await db
        .insert(matches)
        .values([
          {
            id: 'match-live-101',
            tournamentId: 'tourn-emerald-t20',
            seriesId: 'series-premier-t20',
            seriesName: 'Emerald Premier T20 Cup',
            matchNumber: 3,
            stage: 'League Stage',
            homeTeamId: 'team-emr',
            awayTeamId: 'team-dec',
            venueId: 'venue-sovereign',
            scheduledAt: now,
            status: 'live',
            scheduledOvers: 20,
            revisedOvers: 20,
            isRainAffected: false,
            tossWinnerTeamId: 'team-emr',
            tossDecision: 'bat',
            currentInningsNumber: 1,
            resultSummary: 'Emerald Royals CC elected to bat · Live Local Scoring',
            assignedScorerUid: 'demo-scorer',
            matchOfficialUid: 'demo-official',
            dataSource: 'organizer_local',
            isFictionalSeed: true,
          },
          {
            id: 'match-completed-100',
            tournamentId: 'tourn-emerald-t20',
            seriesId: 'series-premier-t20',
            seriesName: 'Emerald Premier T20 Cup',
            matchNumber: 1,
            stage: 'League Stage',
            homeTeamId: 'team-cst',
            awayTeamId: 'team-hld',
            venueId: 'venue-marina-spin',
            scheduledAt: new Date(now.getTime() - 86400000),
            status: 'completed',
            scheduledOvers: 20,
            revisedOvers: 20,
            isRainAffected: false,
            tossWinnerTeamId: 'team-cst',
            tossDecision: 'bat',
            currentInningsNumber: 2,
            winnerTeamId: 'team-cst',
            resultType: 'win',
            resultSummary: 'Coastal Titans won by 14 runs (HLD all out in 18.4 overs)',
            assignedScorerUid: 'demo-scorer',
            matchOfficialUid: 'demo-official',
            dataSource: 'organizer_local',
            isFictionalSeed: true,
          },
          {
            id: 'match-scheduled-102',
            tournamentId: 'tourn-emerald-t20',
            seriesId: 'series-premier-t20',
            seriesName: 'Emerald Premier T20 Cup',
            matchNumber: 4,
            stage: 'League Stage',
            homeTeamId: 'team-emr',
            awayTeamId: 'team-cst',
            venueId: 'venue-sovereign',
            scheduledAt: new Date(now.getTime() + 86400000),
            status: 'scheduled',
            scheduledOvers: 20,
            revisedOvers: 20,
            isRainAffected: false,
            currentInningsNumber: 1,
            resultSummary: 'Upcoming Top-of-Table Clash · 19:30 IST',
            assignedScorerUid: 'demo-scorer',
            matchOfficialUid: 'demo-official',
            dataSource: 'organizer_local',
            isFictionalSeed: true,
          },
          {
            id: 'match-rain-103',
            tournamentId: 'tourn-metro-knockout',
            seriesId: 'series-metro-t10',
            seriesName: 'Metropolitan T10 Challenger Knockout',
            matchNumber: 2,
            stage: 'Semi-Final 1',
            homeTeamId: 'team-dec',
            awayTeamId: 'team-hld',
            venueId: 'venue-eden-gardens-club',
            scheduledAt: now,
            status: 'live',
            scheduledOvers: 10,
            revisedOvers: 8,
            isRainAffected: true,
            rainNote: 'Rain delay of 25 mins reduced chase to 8 overs (DLS Target 84)',
            dlsTargetRuns: 84,
            tossWinnerTeamId: 'team-hld',
            tossDecision: 'bowl',
            currentInningsNumber: 2,
            resultSummary: 'DLS Target 84 in 8.0 overs · Highlanders chasing',
            assignedScorerUid: 'demo-scorer',
            matchOfficialUid: 'demo-official',
            dataSource: 'organizer_local',
            isFictionalSeed: true,
          },
        ])
        .onConflictDoNothing();

      // 8. Seed Live Match 101 Innings & Initial Deliveries using our Domain Scoring Engine!
      const initParams = {
        matchId: 'match-live-101',
        inningsNumber: 1,
        battingTeamId: 'team-emr',
        bowlingTeamId: 'team-dec',
        maxOvers: 20,
        strikerId: 'p-emr-1',
        nonStrikerId: 'p-emr-2',
        openingBowlerId: 'p-dec-3',
      };

      const sampleDeliveries: DeliveryInput[] = [
        {
          idempotencyKey: 'seed-101-b1',
          batterId: 'p-emr-1',
          nonStrikerId: 'p-emr-2',
          bowlerId: 'p-dec-3',
          runsBatter: 4,
          extraType: 'none',
          commentaryText: 'Crunched through extra cover! Gorgeous timing on the front foot for four.',
          recordedByUid: 'demo-scorer',
        },
        {
          idempotencyKey: 'seed-101-b2',
          batterId: 'p-emr-1',
          nonStrikerId: 'p-emr-2',
          bowlerId: 'p-dec-3',
          runsBatter: 1,
          extraType: 'none',
          commentaryText: 'Tapped into the midwicket pocket for a brisk single.',
          recordedByUid: 'demo-scorer',
        },
        {
          idempotencyKey: 'seed-101-b3',
          batterId: 'p-emr-2',
          nonStrikerId: 'p-emr-1',
          bowlerId: 'p-dec-3',
          runsBatter: 0,
          extraType: 'wide',
          runsExtras: 1,
          commentaryText: 'Swings down the leg side, called wide by Umpire Rao.',
          recordedByUid: 'demo-scorer',
        },
        {
          idempotencyKey: 'seed-101-b4',
          batterId: 'p-emr-2',
          nonStrikerId: 'p-emr-1',
          bowlerId: 'p-dec-3',
          runsBatter: 6,
          extraType: 'none',
          commentaryText: 'Launched high over deep square leg! First maximum of the evening.',
          recordedByUid: 'demo-scorer',
        },
        {
          idempotencyKey: 'seed-101-b5',
          batterId: 'p-emr-2',
          nonStrikerId: 'p-emr-1',
          bowlerId: 'p-dec-3',
          runsBatter: 0,
          extraType: 'none',
          isWicket: true,
          dismissalType: 'caught',
          dismissedPlayerId: 'p-emr-2',
          fielderId: 'p-dec-1',
          nextBatterId: 'p-emr-3',
          commentaryText: 'OUT! Slicing drive taken sharply at backward point by Patidar!',
          recordedByUid: 'demo-scorer',
        },
        {
          idempotencyKey: 'seed-101-b6',
          batterId: 'p-emr-3',
          nonStrikerId: 'p-emr-1',
          bowlerId: 'p-dec-3',
          runsBatter: 2,
          extraType: 'none',
          commentaryText: 'Clipped off the pads behind square for a comfortable brace.',
          recordedByUid: 'demo-scorer',
        },
        {
          idempotencyKey: 'seed-101-b7',
          batterId: 'p-emr-3',
          nonStrikerId: 'p-emr-1',
          bowlerId: 'p-dec-3',
          runsBatter: 4,
          extraType: 'none',
          commentaryText: 'Threaded past mid-off to finish an action-packed opening over!',
          recordedByUid: 'demo-scorer',
        },
      ];

      let domainState = createInitialInningsState(initParams);
      for (const d of sampleDeliveries) {
        domainState = applyDelivery(domainState, d);
      }

      await db
        .insert(innings)
        .values({
          id: 'inn-101-1',
          matchId: 'match-live-101',
          inningsNumber: 1,
          battingTeamId: 'team-emr',
          bowlingTeamId: 'team-dec',
          totalRuns: domainState.totalRuns,
          totalWickets: domainState.totalWickets,
          legalBallsBowled: domainState.legalBallsBowled,
          maxOvers: 20,
          extrasWide: domainState.extras.wide,
          extrasNoBall: domainState.extras.noBall,
          extrasBye: domainState.extras.bye,
          extrasLegBye: domainState.extras.legBye,
          extrasPenalty: domainState.extras.penalty,
          strikerPlayerId: domainState.strikerId,
          nonStrikerPlayerId: domainState.nonStrikerId,
          currentBowlerPlayerId: 'p-dec-4', // Spin bowler ready for Over 2
          isCompleted: false,
          isAllOut: false,
        })
        .onConflictDoNothing();

      for (const ev of domainState.deliveries) {
        const delivId = `deliv-${ev.idempotencyKey}`;
        await db
          .insert(deliveries)
          .values({
            id: delivId,
            matchId: 'match-live-101',
            inningsId: 'inn-101-1',
            inningsNumber: 1,
            sequenceNumber: ev.sequenceNumber,
            overNumber: ev.overNumber,
            ballInOver: ev.ballInOver,
            isLegalDelivery: ev.isLegalDelivery,
            batterId: ev.batterId,
            nonStrikerId: ev.nonStrikerId,
            bowlerId: ev.bowlerId,
            runsBatter: ev.runsBatter,
            extraType: ev.extraType,
            runsExtras: ev.computedExtras,
            totalRunsOnBall: ev.totalRunsOnBall,
            isBoundaryFour: ev.isBoundaryFour,
            isBoundarySix: ev.isBoundarySix,
            isWicket: Boolean(ev.isWicket),
            dismissalType: ev.dismissalType,
            dismissedPlayerId: ev.dismissedPlayerId,
            fielderId: ev.fielderId,
            commentaryText: ev.commentaryText || '',
            idempotencyKey: ev.idempotencyKey,
            recordedByUid: ev.recordedByUid,
            revisionNumber: 1,
          })
          .onConflictDoNothing();

        if (ev.isWicket && ev.dismissalType) {
          await db
            .insert(wickets)
            .values({
              id: `wkt-${ev.idempotencyKey}`,
              deliveryId: delivId,
              matchId: 'match-live-101',
              inningsId: 'inn-101-1',
              dismissedPlayerId: ev.dismissedPlayerId || ev.batterId,
              dismissalType: ev.dismissalType,
              bowlerCredited: ev.bowlerCreditedWicket,
              bowlerId: ev.bowlerId,
              fielderId: ev.fielderId,
              runsAtFall: domainState.fallOfWickets[0]?.runsAtFall || 12,
              wicketNumber: 1,
              legalBallsAtFall: domainState.fallOfWickets[0]?.legalBallsAtFall || 4,
            })
            .onConflictDoNothing();
        }
      }

      // Persist playerMatchStats for match-live-101
      await syncInningsStatsToDb('match-live-101', domainState);

      // Seed innings for match-completed-100 & match-rain-103
      await db
        .insert(innings)
        .values([
          {
            id: 'inn-100-1',
            matchId: 'match-completed-100',
            inningsNumber: 1,
            battingTeamId: 'team-cst',
            bowlingTeamId: 'team-hld',
            totalRuns: 168,
            totalWickets: 6,
            legalBallsBowled: 120,
            maxOvers: 20,
            extrasWide: 6,
            extrasLegBye: 4,
            strikerPlayerId: 'p-cst-1',
            nonStrikerPlayerId: 'p-cst-2',
            currentBowlerPlayerId: 'p-hld-2',
            isCompleted: true,
            isAllOut: false,
          },
          {
            id: 'inn-100-2',
            matchId: 'match-completed-100',
            inningsNumber: 2,
            battingTeamId: 'team-hld',
            bowlingTeamId: 'team-cst',
            totalRuns: 154,
            totalWickets: 10,
            legalBallsBowled: 112, // 18.4 overs all out
            maxOvers: 20,
            targetRuns: 169,
            extrasWide: 5,
            extrasBye: 2,
            strikerPlayerId: 'p-hld-1',
            nonStrikerPlayerId: 'p-hld-2',
            currentBowlerPlayerId: 'p-cst-1',
            isCompleted: true,
            isAllOut: true,
          },
          {
            id: 'inn-103-1',
            matchId: 'match-rain-103',
            inningsNumber: 1,
            battingTeamId: 'team-dec',
            bowlingTeamId: 'team-hld',
            totalRuns: 98,
            totalWickets: 4,
            legalBallsBowled: 60,
            maxOvers: 10,
            extrasWide: 4,
            strikerPlayerId: 'p-dec-1',
            nonStrikerPlayerId: 'p-dec-2',
            currentBowlerPlayerId: 'p-hld-2',
            isCompleted: true,
            isAllOut: false,
          },
          {
            id: 'inn-103-2',
            matchId: 'match-rain-103',
            inningsNumber: 2,
            battingTeamId: 'team-hld',
            bowlingTeamId: 'team-dec',
            totalRuns: 62,
            totalWickets: 2,
            legalBallsBowled: 36, // 6.0 / 8.0 overs
            maxOvers: 8,
            targetRuns: 84,
            extrasWide: 3,
            strikerPlayerId: 'p-hld-1',
            nonStrikerPlayerId: 'p-hld-2',
            currentBowlerPlayerId: 'p-dec-3',
            isCompleted: false,
            isAllOut: false,
          },
        ])
        .onConflictDoNothing();

      // Seed Notifications & Audit Logs
      await db
        .insert(notifications)
        .values([
          {
            userUid: 'demo-scorer',
            title: 'Scorer Console Assigned: EMR vs DEC',
            body: 'You are the designated official scorer for Match #3 at Sovereign Turf Arena.',
            category: 'match_alert',
            linkUrl: '/matches/match-live-101',
            isRead: false,
          },
          {
            userUid: 'demo-organizer',
            title: 'Standings Verified: Coastal Titans +0.700 NRR',
            body: 'All-out NRR rule applied for Match #1 (HLD charged 20.0 overs after being bowled out in 18.4 overs).',
            category: 'tournament_update',
            linkUrl: '/tournaments/tourn-emerald-t20',
            isRead: false,
          },
        ])
        .onConflictDoNothing();

      await db
        .insert(auditLogs)
        .values([
          {
            actorUid: 'demo-official',
            actorRole: 'scorer',
            actionType: 'MATCH_FINALIZED',
            entityType: 'match',
            entityId: 'match-completed-100',
            summary: 'Match #1 finalized: Coastal Titans won by 14 runs. Tournament NRR updated.',
          },
          {
            actorUid: 'demo-organizer',
            actorRole: 'tournament_organizer',
            actionType: 'DLS_REVISION_APPLIED',
            entityType: 'match',
            entityId: 'match-rain-103',
            summary: 'Rain interruption applied: Second innings revised from 10 to 8 overs, DLS target set to 84.',
          },
        ])
        .onConflictDoNothing();
    } catch (error) {
      console.error('Error seeding initial fictional cricket data:', error);
    }
  })();
  return seedPromise;
}

async function syncInningsStatsToDb(matchId: string, state: ReturnType<typeof createInitialInningsState>) {
  // Upsert batter lines
  for (const batter of Object.values(state.batters)) {
    const existing = await db
      .select()
      .from(playerMatchStats)
      .where(
        and(
          eq(playerMatchStats.matchId, matchId),
          eq(playerMatchStats.inningsNumber, state.inningsNumber),
          eq(playerMatchStats.playerId, batter.playerId)
        )
      );

    if (existing.length > 0) {
      await db
        .update(playerMatchStats)
        .set({
          battingPosition: batter.battingPosition,
          runsScored: batter.runs,
          ballsFaced: batter.balls,
          fours: batter.fours,
          sixes: batter.sixes,
          isOut: batter.isOut,
          dismissalText: batter.dismissalText,
        })
        .where(eq(playerMatchStats.id, existing[0].id));
    } else {
      await db.insert(playerMatchStats).values({
        matchId,
        inningsNumber: state.inningsNumber,
        playerId: batter.playerId,
        teamId: state.battingTeamId,
        battingPosition: batter.battingPosition,
        runsScored: batter.runs,
        ballsFaced: batter.balls,
        fours: batter.fours,
        sixes: batter.sixes,
        isOut: batter.isOut,
        dismissalText: batter.dismissalText,
      });
    }
  }

  // Upsert bowler lines
  for (const bowler of Object.values(state.bowlers)) {
    const existing = await db
      .select()
      .from(playerMatchStats)
      .where(
        and(
          eq(playerMatchStats.matchId, matchId),
          eq(playerMatchStats.inningsNumber, state.inningsNumber),
          eq(playerMatchStats.playerId, bowler.playerId)
        )
      );

    if (existing.length > 0) {
      await db
        .update(playerMatchStats)
        .set({
          legalBallsBowled: bowler.legalBalls,
          maidens: bowler.maidens,
          runsConceded: bowler.runsConceded,
          wicketsTaken: bowler.wickets,
          widesBowled: bowler.wides,
          noBallsBowled: bowler.noBalls,
        })
        .where(eq(playerMatchStats.id, existing[0].id));
    } else {
      await db.insert(playerMatchStats).values({
        matchId,
        inningsNumber: state.inningsNumber,
        playerId: bowler.playerId,
        teamId: state.bowlingTeamId,
        battingPosition: 11,
        legalBallsBowled: bowler.legalBalls,
        maidens: bowler.maidens,
        runsConceded: bowler.runsConceded,
        wicketsTaken: bowler.wickets,
        widesBowled: bowler.wides,
        noBallsBowled: bowler.noBalls,
      });
    }
  }
}

export async function getBootstrapPayload(actorUid: string | null) {
  await ensureSeedData();
  try {
    const [
      allTeams,
      allPlayers,
      allVenues,
      allTournaments,
      allTournamentTeams,
      allMatches,
      allInnings,
      allAuditLogs,
      allProfiles,
      allRoles,
    ] = await Promise.all([
      db.select().from(teams).orderBy(asc(teams.name)),
      db.select().from(players).orderBy(desc(players.careerRuns)),
      db.select().from(venues).orderBy(asc(venues.name)),
      db.select().from(tournaments).orderBy(desc(tournaments.createdAt)),
      db.select().from(tournamentTeams).orderBy(desc(tournamentTeams.points), desc(tournamentTeams.netRunRate)),
      db.select().from(matches).orderBy(asc(matches.matchNumber)),
      db.select().from(innings).orderBy(asc(innings.inningsNumber)),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(40),
      db.select().from(profiles).orderBy(asc(profiles.displayName)),
      db.select().from(userRoles).orderBy(desc(userRoles.createdAt)),
    ]);

    const userFavorites = actorUid
      ? await db.select().from(favorites).where(eq(favorites.userUid, actorUid))
      : [];
    const userNotifications = actorUid
      ? await db.select().from(notifications).where(eq(notifications.userUid, actorUid)).orderBy(desc(notifications.createdAt))
      : await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(10);

    return {
      teams: allTeams,
      players: allPlayers,
      venues: allVenues,
      tournaments: allTournaments,
      tournamentTeams: allTournamentTeams,
      matches: allMatches,
      innings: allInnings,
      auditLogs: allAuditLogs,
      profiles: allProfiles,
      userRoles: allRoles,
      favorites: userFavorites,
      notifications: userNotifications,
    };
  } catch (error) {
    console.error('Database query failed in getBootstrapPayload:', error);
    throw new Error('Failed to load application data from PostgreSQL.', { cause: error });
  }
}

export async function getMatchFullDetail(matchId: string) {
  await ensureSeedData();
  try {
    const matchRows = await db.select().from(matches).where(eq(matches.id, matchId));
    if (matchRows.length === 0) {
      return null;
    }
    const match = matchRows[0];
    const [matchInnings, matchDeliveries, matchWickets, matchStats, allTeams, allPlayers, allVenues, matchAudits] =
      await Promise.all([
        db.select().from(innings).where(eq(innings.matchId, matchId)).orderBy(asc(innings.inningsNumber)),
        db
          .select()
          .from(deliveries)
          .where(eq(deliveries.matchId, matchId))
          .orderBy(asc(deliveries.inningsNumber), asc(deliveries.sequenceNumber)),
        db.select().from(wickets).where(eq(wickets.matchId, matchId)).orderBy(asc(wickets.wicketNumber)),
        db.select().from(playerMatchStats).where(eq(playerMatchStats.matchId, matchId)),
        db.select().from(teams),
        db.select().from(players),
        db.select().from(venues),
        db
          .select()
          .from(auditLogs)
          .where(and(eq(auditLogs.entityType, 'match'), eq(auditLogs.entityId, matchId)))
          .orderBy(desc(auditLogs.createdAt)),
      ]);

    return {
      match,
      innings: matchInnings,
      deliveries: matchDeliveries,
      wickets: matchWickets,
      playerStats: matchStats,
      teams: allTeams,
      players: allPlayers,
      venue: allVenues.find((v) => v.id === match.venueId) || null,
      auditLogs: matchAudits,
    };
  } catch (error) {
    console.error('Database query failed in getMatchFullDetail:', error);
    throw new Error('Failed to fetch match details.', { cause: error });
  }
}

async function rebuildInningsDomainStateFromDb(matchId: string, inningsNumber: number) {
  const innRows = await db
    .select()
    .from(innings)
    .where(and(eq(innings.matchId, matchId), eq(innings.inningsNumber, inningsNumber)));
  if (innRows.length === 0) {
    throw new Error(`Innings #${inningsNumber} not found for match ${matchId}.`);
  }
  const innRecord = innRows[0];
  const existingDeliveries = await db
    .select()
    .from(deliveries)
    .where(and(eq(deliveries.matchId, matchId), eq(deliveries.inningsNumber, inningsNumber)))
    .orderBy(asc(deliveries.sequenceNumber));

  const teamPlayers = await db.select().from(players);
  const battingSquad = teamPlayers.filter((p) => p.primaryTeamId === innRecord.battingTeamId);
  const bowlingSquad = teamPlayers.filter((p) => p.primaryTeamId === innRecord.bowlingTeamId);

  const initialStriker =
    existingDeliveries[0]?.batterId || innRecord.strikerPlayerId || battingSquad[0]?.id || 'p-emr-1';
  const initialNonStriker =
    existingDeliveries[0]?.nonStrikerId || innRecord.nonStrikerPlayerId || battingSquad[1]?.id || 'p-emr-2';
  const initialBowler =
    existingDeliveries[0]?.bowlerId || innRecord.currentBowlerPlayerId || bowlingSquad[0]?.id || 'p-dec-3';

  const initParams = {
    matchId,
    inningsNumber,
    battingTeamId: innRecord.battingTeamId,
    bowlingTeamId: innRecord.bowlingTeamId,
    maxOvers: innRecord.maxOvers,
    targetRuns: innRecord.targetRuns,
    strikerId: initialStriker,
    nonStrikerId: initialNonStriker,
    openingBowlerId: initialBowler,
  };

  let state = createInitialInningsState(initParams);
  for (const d of existingDeliveries) {
    // Determine nextBatterId if a wicket fell on this ball
    const idx = existingDeliveries.indexOf(d);
    let nextBatterId: string | undefined;
    if (d.isWicket) {
      const subsequent = existingDeliveries.slice(idx + 1);
      const seenBefore = new Set([
        initialStriker,
        initialNonStriker,
        ...existingDeliveries.slice(0, idx + 1).flatMap((x) => [x.batterId, x.nonStrikerId]),
      ]);
      for (const s of subsequent) {
        if (!seenBefore.has(s.batterId)) {
          nextBatterId = s.batterId;
          break;
        }
        if (!seenBefore.has(s.nonStrikerId)) {
          nextBatterId = s.nonStrikerId;
          break;
        }
      }
      if (!nextBatterId) {
        const unusedBatter = battingSquad.find((p) => !seenBefore.has(p.id));
        nextBatterId = unusedBatter?.id;
      }
    }

    state = applyDelivery(state, {
      idempotencyKey: d.idempotencyKey,
      batterId: d.batterId,
      nonStrikerId: d.nonStrikerId,
      bowlerId: d.bowlerId,
      runsBatter: d.runsBatter,
      extraType: d.extraType as ExtraType,
      runsExtras: d.runsExtras,
      isWicket: d.isWicket,
      dismissalType: (d.dismissalType as DismissalType) || undefined,
      dismissedPlayerId: d.dismissedPlayerId || undefined,
      fielderId: d.fielderId || undefined,
      nextBatterId,
      commentaryText: d.commentaryText,
      recordedByUid: d.recordedByUid,
    });
  }

  return { innRecord, initParams, existingDeliveries, state, battingSquad, bowlingSquad };
}

export async function recordMatchDeliveryInDb(
  matchId: string,
  actor: ActorContext,
  input: {
    idempotencyKey: string;
    inningsNumber?: number;
    batterId?: string;
    nonStrikerId?: string;
    bowlerId?: string;
    runsBatter: number;
    extraType: ExtraType;
    runsExtras?: number;
    isWicket?: boolean;
    dismissalType?: DismissalType;
    dismissedPlayerId?: string;
    fielderId?: string;
    nextBatterId?: string;
    commentaryText?: string;
  }
) {
  await ensureSeedData();
  const matchRows = await db.select().from(matches).where(eq(matches.id, matchId));
  if (matchRows.length === 0) {
    throw new Error('Match not found.');
  }
  const match = matchRows[0];

  const permission = canRecordDelivery(actor, {
    id: match.id,
    status: match.status,
    assignedScorerUid: match.assignedScorerUid,
    matchOfficialUid: match.matchOfficialUid,
  });

  if (!permission.allowed) {
    const err = new Error(permission.reason || 'Forbidden');
    (err as any).statusCode = actor.uid ? 403 : 401;
    throw err;
  }

  // Check duplicate idempotencyKey first
  const dup = await db
    .select()
    .from(deliveries)
    .where(eq(deliveries.idempotencyKey, input.idempotencyKey));
  if (dup.length > 0) {
    const err = new Error(`Duplicate delivery rejected: idempotencyKey "${input.idempotencyKey}" already exists.`);
    (err as any).statusCode = 409;
    throw err;
  }

  const inningsNumber = input.inningsNumber || match.currentInningsNumber || 1;
  const { innRecord, state, battingSquad } = await rebuildInningsDomainStateFromDb(matchId, inningsNumber);

  const strikerId = input.batterId || innRecord.strikerPlayerId || state.strikerId;
  const nonStrikerId = input.nonStrikerId || innRecord.nonStrikerPlayerId || state.nonStrikerId;
  const bowlerId = input.bowlerId || innRecord.currentBowlerPlayerId || state.currentBowlerId;

  let nextBatterId = input.nextBatterId;
  if (input.isWicket && !nextBatterId) {
    const usedIds = new Set(state.battingOrderIds);
    usedIds.add(strikerId);
    usedIds.add(nonStrikerId);
    const candidate = battingSquad.find((p) => !usedIds.has(p.id));
    nextBatterId = candidate?.id;
  }

  const deliveryPayload: DeliveryInput = {
    idempotencyKey: input.idempotencyKey,
    batterId: strikerId,
    nonStrikerId: nonStrikerId,
    bowlerId: bowlerId,
    runsBatter: input.runsBatter,
    extraType: input.extraType,
    runsExtras: input.runsExtras,
    isWicket: input.isWicket,
    dismissalType: input.dismissalType,
    dismissedPlayerId: input.dismissedPlayerId || strikerId,
    fielderId: input.fielderId,
    nextBatterId,
    commentaryText:
      input.commentaryText ||
      generateAutomaticCommentary({
        runsBatter: input.runsBatter,
        extraType: input.extraType,
        isWicket: input.isWicket,
        dismissalType: input.dismissalType,
      }),
    recordedByUid: actor.uid || 'demo-scorer',
  };

  const nextState = applyDelivery(state, deliveryPayload);
  const lastEvent = nextState.deliveries[nextState.deliveries.length - 1];
  const deliveryId = `deliv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  await db.insert(deliveries).values({
    id: deliveryId,
    matchId,
    inningsId: innRecord.id,
    inningsNumber,
    sequenceNumber: lastEvent.sequenceNumber,
    overNumber: lastEvent.overNumber,
    ballInOver: lastEvent.ballInOver,
    isLegalDelivery: lastEvent.isLegalDelivery,
    batterId: lastEvent.batterId,
    nonStrikerId: lastEvent.nonStrikerId,
    bowlerId: lastEvent.bowlerId,
    runsBatter: lastEvent.runsBatter,
    extraType: lastEvent.extraType,
    runsExtras: lastEvent.computedExtras,
    totalRunsOnBall: lastEvent.totalRunsOnBall,
    isBoundaryFour: lastEvent.isBoundaryFour,
    isBoundarySix: lastEvent.isBoundarySix,
    isWicket: Boolean(lastEvent.isWicket),
    dismissalType: lastEvent.dismissalType,
    dismissedPlayerId: lastEvent.dismissedPlayerId,
    fielderId: lastEvent.fielderId,
    commentaryText: lastEvent.commentaryText || '',
    idempotencyKey: lastEvent.idempotencyKey,
    recordedByUid: lastEvent.recordedByUid,
    revisionNumber: 1,
  });

  if (lastEvent.isWicket && lastEvent.dismissalType) {
    const fow = nextState.fallOfWickets[nextState.fallOfWickets.length - 1];
    await db.insert(wickets).values({
      id: `wkt-${deliveryId}`,
      deliveryId,
      matchId,
      inningsId: innRecord.id,
      dismissedPlayerId: lastEvent.dismissedPlayerId || lastEvent.batterId,
      dismissalType: lastEvent.dismissalType,
      bowlerCredited: lastEvent.bowlerCreditedWicket,
      bowlerId: lastEvent.bowlerId,
      fielderId: lastEvent.fielderId,
      runsAtFall: fow?.runsAtFall ?? nextState.totalRuns,
      wicketNumber: nextState.totalWickets,
      legalBallsAtFall: nextState.legalBallsBowled,
    });
  }

  await db
    .update(innings)
    .set({
      totalRuns: nextState.totalRuns,
      totalWickets: nextState.totalWickets,
      legalBallsBowled: nextState.legalBallsBowled,
      extrasWide: nextState.extras.wide,
      extrasNoBall: nextState.extras.noBall,
      extrasBye: nextState.extras.bye,
      extrasLegBye: nextState.extras.legBye,
      extrasPenalty: nextState.extras.penalty,
      strikerPlayerId: nextState.strikerId,
      nonStrikerPlayerId: nextState.nonStrikerId,
      currentBowlerPlayerId: nextState.currentBowlerId,
      isCompleted: nextState.isCompleted,
      isAllOut: nextState.isAllOut,
    })
    .where(eq(innings.id, innRecord.id));

  await syncInningsStatsToDb(matchId, nextState);

  await db.insert(auditLogs).values({
    actorUid: actor.uid || 'demo-scorer',
    actorRole: actor.primaryRole,
    actionType: 'DELIVERY_RECORDED',
    entityType: 'match',
    entityId: matchId,
    summary: `Innings ${inningsNumber} (${formatOvers(nextState.legalBallsBowled)} ov): +${lastEvent.totalRunsOnBall} runs (${lastEvent.extraType !== 'none' ? lastEvent.extraType : 'legal'}) · Score ${nextState.totalRuns}/${nextState.totalWickets}`,
    afterSnapshot: JSON.stringify({
      totalRuns: nextState.totalRuns,
      totalWickets: nextState.totalWickets,
      legalBallsBowled: nextState.legalBallsBowled,
    }),
  });

  return getMatchFullDetail(matchId);
}

export async function correctMatchDeliveryInDb(
  matchId: string,
  deliveryId: string,
  actor: ActorContext,
  correction: {
    runsBatter: number;
    extraType: ExtraType;
    runsExtras?: number;
    isWicket?: boolean;
    dismissalType?: DismissalType;
    reason: string;
  }
) {
  await ensureSeedData();
  const matchRows = await db.select().from(matches).where(eq(matches.id, matchId));
  if (matchRows.length === 0) throw new Error('Match not found.');
  const match = matchRows[0];

  const permission = canFinalizeMatch(actor, {
    id: match.id,
    matchOfficialUid: match.matchOfficialUid,
  });
  const scorerPerm = canRecordDelivery(actor, {
    id: match.id,
    status: 'live',
    assignedScorerUid: match.assignedScorerUid,
    matchOfficialUid: match.matchOfficialUid,
  });

  if (!permission.allowed && !scorerPerm.allowed) {
    const err = new Error('Forbidden: Only assigned scorers or match officials may revise deliveries.');
    (err as any).statusCode = 403;
    throw err;
  }
  if (!correction.reason || correction.reason.trim().length < 4) {
    const err = new Error('Audit reason of at least 4 characters is required for scoring corrections.');
    (err as any).statusCode = 400;
    throw err;
  }

  const targetRows = await db.select().from(deliveries).where(eq(deliveries.id, deliveryId));
  if (targetRows.length === 0) {
    throw new Error('Target delivery not found.');
  }
  const target = targetRows[0];

  const beforeInnings = await rebuildInningsDomainStateFromDb(matchId, target.inningsNumber);

  const isLegal =
    correction.extraType === 'none' || correction.extraType === 'bye' || correction.extraType === 'leg_bye';
  const computedExtras =
    correction.extraType === 'none'
      ? 0
      : correction.runsExtras && correction.runsExtras > 0
        ? correction.runsExtras
        : 1;

  await db
    .update(deliveries)
    .set({
      runsBatter: correction.runsBatter,
      extraType: correction.extraType,
      runsExtras: computedExtras,
      totalRunsOnBall: correction.runsBatter + computedExtras,
      isLegalDelivery: isLegal,
      isBoundaryFour: correction.runsBatter === 4,
      isBoundarySix: correction.runsBatter === 6,
      isWicket: Boolean(correction.isWicket),
      dismissalType: correction.isWicket ? correction.dismissalType || 'bowled' : null,
      revisionNumber: target.revisionNumber + 1,
      correctionNote: correction.reason,
      commentaryText: `[REVISED v${target.revisionNumber + 1}: ${correction.reason}] ${target.commentaryText}`,
    })
    .where(eq(deliveries.id, deliveryId));

  // Rebuild innings totals deterministically from the updated delivery log
  const afterInnings = await rebuildInningsDomainStateFromDb(matchId, target.inningsNumber);

  await db
    .update(innings)
    .set({
      totalRuns: afterInnings.state.totalRuns,
      totalWickets: afterInnings.state.totalWickets,
      legalBallsBowled: afterInnings.state.legalBallsBowled,
      extrasWide: afterInnings.state.extras.wide,
      extrasNoBall: afterInnings.state.extras.noBall,
      extrasBye: afterInnings.state.extras.bye,
      extrasLegBye: afterInnings.state.extras.legBye,
      extrasPenalty: afterInnings.state.extras.penalty,
      strikerPlayerId: afterInnings.state.strikerId,
      nonStrikerPlayerId: afterInnings.state.nonStrikerId,
      currentBowlerPlayerId: afterInnings.state.currentBowlerId,
      isCompleted: afterInnings.state.isCompleted,
      isAllOut: afterInnings.state.isAllOut,
    })
    .where(eq(innings.id, afterInnings.innRecord.id));

  await db
    .delete(playerMatchStats)
    .where(and(eq(playerMatchStats.matchId, matchId), eq(playerMatchStats.inningsNumber, target.inningsNumber)));
  await syncInningsStatsToDb(matchId, afterInnings.state);

  await db.insert(auditLogs).values({
    actorUid: actor.uid || 'demo-scorer',
    actorRole: actor.primaryRole,
    actionType: 'DELIVERY_CORRECTED',
    entityType: 'match',
    entityId: matchId,
    summary: `Revised delivery #${target.sequenceNumber} (${correction.reason}): Score changed from ${beforeInnings.state.totalRuns}/${beforeInnings.state.totalWickets} to ${afterInnings.state.totalRuns}/${afterInnings.state.totalWickets}`,
    beforeSnapshot: JSON.stringify({
      runsBatter: target.runsBatter,
      extraType: target.extraType,
      totalRuns: beforeInnings.state.totalRuns,
    }),
    afterSnapshot: JSON.stringify({
      runsBatter: correction.runsBatter,
      extraType: correction.extraType,
      totalRuns: afterInnings.state.totalRuns,
    }),
  });

  return getMatchFullDetail(matchId);
}

export async function finalizeMatchInDb(
  matchId: string,
  actor: ActorContext,
  payload: {
    winnerTeamId?: string | null;
    resultType: 'win' | 'tie' | 'no_result' | 'abandoned';
    resultSummary: string;
  }
) {
  await ensureSeedData();
  const matchRows = await db.select().from(matches).where(eq(matches.id, matchId));
  if (matchRows.length === 0) throw new Error('Match not found.');
  const match = matchRows[0];

  const perm = canFinalizeMatch(actor, {
    id: match.id,
    matchOfficialUid: match.matchOfficialUid,
  });
  if (!perm.allowed) {
    const err = new Error(perm.reason || 'Forbidden');
    (err as any).statusCode = 403;
    throw err;
  }

  await db
    .update(matches)
    .set({
      status: payload.resultType === 'abandoned' ? 'abandoned' : 'completed',
      winnerTeamId: payload.winnerTeamId || null,
      resultType: payload.resultType,
      resultSummary: payload.resultSummary,
      updatedAt: new Date(),
    })
    .where(eq(matches.id, matchId));

  await db
    .update(innings)
    .set({ isCompleted: true })
    .where(eq(innings.matchId, matchId));

  if (match.tournamentId) {
    await recalculateTournamentStandingsInDb(match.tournamentId);
  }

  await db.insert(auditLogs).values({
    actorUid: actor.uid || 'demo-official',
    actorRole: actor.primaryRole,
    actionType: 'MATCH_FINALIZED',
    entityType: 'match',
    entityId: matchId,
    summary: `Match finalized (${payload.resultType}): ${payload.resultSummary}`,
  });

  return getMatchFullDetail(matchId);
}

export async function recalculateTournamentStandingsInDb(tournamentId: string) {
  const tournRows = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (tournRows.length === 0) return;
  const tourn = tournRows[0];

  const regTeams = await db
    .select()
    .from(tournamentTeams)
    .where(eq(tournamentTeams.tournamentId, tournamentId));

  const completedMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId));

  const allInnings = await db.select().from(innings);

  const domainMatches: CompletedMatchForStandings[] = [];
  for (const m of completedMatches) {
    if (m.status !== 'completed' && m.status !== 'abandoned') continue;
    const mInns = allInnings
      .filter((i) => i.matchId === m.id)
      .sort((a, b) => a.inningsNumber - b.inningsNumber);

    const inn1 = mInns[0] || {
      battingTeamId: m.homeTeamId,
      bowlingTeamId: m.awayTeamId,
      totalRuns: 0,
      legalBallsBowled: m.scheduledOvers * 6,
      maxOvers: m.scheduledOvers,
      isAllOut: false,
    };
    const inn2 = mInns[1] || {
      battingTeamId: m.awayTeamId,
      bowlingTeamId: m.homeTeamId,
      totalRuns: Math.max(0, inn1.totalRuns - 12),
      legalBallsBowled: m.scheduledOvers * 6,
      maxOvers: m.scheduledOvers,
      isAllOut: false,
    };

    domainMatches.push({
      matchId: m.id,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      resultType: (m.resultType as any) || 'win',
      winnerTeamId: m.winnerTeamId,
      firstInnings: {
        battingTeamId: inn1.battingTeamId,
        bowlingTeamId: inn1.bowlingTeamId,
        runs: inn1.totalRuns,
        legalBalls: inn1.legalBallsBowled,
        maxOvers: inn1.maxOvers,
        isAllOut: inn1.isAllOut,
      },
      secondInnings: {
        battingTeamId: inn2.battingTeamId,
        bowlingTeamId: inn2.bowlingTeamId,
        runs: inn2.totalRuns,
        legalBalls: inn2.legalBallsBowled,
        maxOvers: inn2.maxOvers,
        isAllOut: inn2.isAllOut,
      },
    });
  }

  const computed = computeTournamentStandings(
    regTeams.map((r) => ({ teamId: r.teamId, groupName: r.groupName })),
    domainMatches,
    {
      id: tourn.id,
      format: tourn.format as TournamentFormat,
      matchOvers: tourn.matchOvers,
      ballsPerOver: tourn.ballsPerOver,
      pointsWin: tourn.pointsWin,
      pointsTie: tourn.pointsTie,
      pointsNoResult: tourn.pointsNoResult,
      pointsLoss: tourn.pointsLoss,
      minOversForNrr: tourn.minOversForNrr,
    }
  );

  for (let i = 0; i < computed.length; i++) {
    const row = computed[i];
    await db
      .update(tournamentTeams)
      .set({
        matchesPlayed: row.matchesPlayed,
        wins: row.wins,
        losses: row.losses,
        ties: row.ties,
        noResults: row.noResults,
        points: row.points,
        runsScored: row.runsScored,
        legalBallsFaced: row.effectiveBallsFaced,
        runsConceded: row.runsConceded,
        legalBallsBowled: row.effectiveBallsBowled,
        netRunRate: row.netRunRate,
        qualificationStatus: i < 2 ? 'qualified' : 'contending',
      })
      .where(and(eq(tournamentTeams.tournamentId, tournamentId), eq(tournamentTeams.teamId, row.teamId)));
  }
}

export async function startOrTransitionMatchInDb(
  matchId: string,
  actor: ActorContext,
  action: {
    type: 'start_match' | 'start_second_innings' | 'apply_dls' | 'change_bowler';
    tossWinnerTeamId?: string;
    tossDecision?: 'bat' | 'bowl';
    RevisedOvers?: number;
    rainNote?: string;
    newBowlerId?: string;
  }
) {
  await ensureSeedData();
  const matchRows = await db.select().from(matches).where(eq(matches.id, matchId));
  if (matchRows.length === 0) throw new Error('Match not found.');
  const match = matchRows[0];

  const perm = canRecordDelivery(actor, {
    id: match.id,
    status: 'live',
    assignedScorerUid: match.assignedScorerUid,
    matchOfficialUid: match.matchOfficialUid,
  });
  if (!perm.allowed) {
    const err = new Error(perm.reason || 'Forbidden');
    (err as any).statusCode = 403;
    throw err;
  }

  const allPlayers = await db.select().from(players);

  if (action.type === 'start_match') {
    const battingTeamId =
      action.tossDecision === 'bowl'
        ? action.tossWinnerTeamId === match.homeTeamId
          ? match.awayTeamId
          : match.homeTeamId
        : action.tossWinnerTeamId || match.homeTeamId;
    const bowlingTeamId = battingTeamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;

    const batPlayers = allPlayers.filter((p) => p.primaryTeamId === battingTeamId);
    const bowlPlayers = allPlayers.filter((p) => p.primaryTeamId === bowlingTeamId);

    await db
      .update(matches)
      .set({
        status: 'live',
        tossWinnerTeamId: action.tossWinnerTeamId || match.homeTeamId,
        tossDecision: action.tossDecision || 'bat',
        currentInningsNumber: 1,
        resultSummary: 'Match underway · 1st Innings Live',
      })
      .where(eq(matches.id, matchId));

    await db
      .insert(innings)
      .values({
        id: `inn-${matchId}-1`,
        matchId,
        inningsNumber: 1,
        battingTeamId,
        bowlingTeamId,
        totalRuns: 0,
        totalWickets: 0,
        legalBallsBowled: 0,
        maxOvers: match.revisedOvers,
        strikerPlayerId: batPlayers[0]?.id || 'p-emr-1',
        nonStrikerPlayerId: batPlayers[1]?.id || 'p-emr-2',
        currentBowlerPlayerId: bowlPlayers[0]?.id || 'p-cst-1',
      })
      .onConflictDoNothing();
  } else if (action.type === 'start_second_innings') {
    const inn1Rows = await db
      .select()
      .from(innings)
      .where(and(eq(innings.matchId, matchId), eq(innings.inningsNumber, 1)));
    const inn1 = inn1Rows[0];
    if (!inn1) throw new Error('First innings not found.');

    await db.update(innings).set({ isCompleted: true }).where(eq(innings.id, inn1.id));

    const battingTeamId = inn1.bowlingTeamId;
    const bowlingTeamId = inn1.battingTeamId;
    const targetRuns = match.dlsTargetRuns || inn1.totalRuns + 1;

    const batPlayers = allPlayers.filter((p) => p.primaryTeamId === battingTeamId);
    const bowlPlayers = allPlayers.filter((p) => p.primaryTeamId === bowlingTeamId);

    await db
      .insert(innings)
      .values({
        id: `inn-${matchId}-2`,
        matchId,
        inningsNumber: 2,
        battingTeamId,
        bowlingTeamId,
        totalRuns: 0,
        totalWickets: 0,
        legalBallsBowled: 0,
        maxOvers: match.revisedOvers,
        targetRuns,
        strikerPlayerId: batPlayers[0]?.id || 'p-dec-1',
        nonStrikerPlayerId: batPlayers[1]?.id || 'p-dec-2',
        currentBowlerPlayerId: bowlPlayers[0]?.id || 'p-emr-5',
      })
      .onConflictDoNothing();

    await db
      .update(matches)
      .set({
        status: 'live',
        currentInningsNumber: 2,
        resultSummary: `2nd Innings Chase · Target ${targetRuns} in ${match.revisedOvers} overs`,
      })
      .where(eq(matches.id, matchId));
  } else if (action.type === 'apply_dls') {
    const revisedOvers = action.RevisedOvers || Math.max(5, match.scheduledOvers - 4);
    const inn1Rows = await db
      .select()
      .from(innings)
      .where(and(eq(innings.matchId, matchId), eq(innings.inningsNumber, 1)));
    const firstInningsRuns = inn1Rows[0]?.totalRuns || 140;
    const dls = calculateRevisedTargetDls({
      firstInningsRuns,
      scheduledOvers: match.scheduledOvers,
      revisedOvers,
    });

    await db
      .update(matches)
      .set({
        isRainAffected: true,
        revisedOvers,
        dlsTargetRuns: dls.targetRuns,
        rainNote: action.rainNote || dls.explanation,
        resultSummary: dls.explanation,
      })
      .where(eq(matches.id, matchId));

    await db.insert(auditLogs).values({
      actorUid: actor.uid || 'demo-official',
      actorRole: actor.primaryRole,
      actionType: 'DLS_REVISION_APPLIED',
      entityType: 'match',
      entityId: matchId,
      summary: dls.explanation,
    });
  } else if (action.type === 'change_bowler' && action.newBowlerId) {
    const currInn = match.currentInningsNumber || 1;
    await db
      .update(innings)
      .set({ currentBowlerPlayerId: action.newBowlerId })
      .where(and(eq(innings.matchId, matchId), eq(innings.inningsNumber, currInn)));
  }

  return getMatchFullDetail(matchId);
}

export async function createTeamInDb(
  actor: ActorContext,
  payload: {
    name: string;
    shortName: string;
    city: string;
    primaryColor?: string;
    division?: string;
    homeVenueId?: string;
  }
) {
  await ensureSeedData();
  if (!actor.uid || actor.primaryRole === 'visitor') {
    const err = new Error('Authentication required to create a team.');
    (err as any).statusCode = 401;
    throw err;
  }

  const teamId = `team-${payload.shortName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
  const created = await db
    .insert(teams)
    .values({
      id: teamId,
      name: payload.name.trim(),
      shortName: payload.shortName.trim().toUpperCase().slice(0, 5),
      city: payload.city.trim(),
      primaryColor: payload.primaryColor || '#10b981',
      division: payload.division || 'Premier Division',
      managerUid: actor.uid,
      homeVenueId: payload.homeVenueId || 'venue-sovereign',
      foundedYear: 2026,
      isFictionalSeed: false,
    })
    .returning();

  // Seed 2 starter players for immediate scoring usability
  const p1Id = `p-${teamId}-1`;
  const p2Id = `p-${teamId}-2`;
  await db.insert(players).values([
    {
      id: p1Id,
      fullName: `${payload.shortName.toUpperCase()} Captain XI`,
      shortName: `${payload.shortName.toUpperCase()} Capt`,
      primaryTeamId: teamId,
      playingRole: 'Top-Order Batter',
      battingStyle: 'Right-hand bat',
      bowlingStyle: 'Right-arm medium',
      jerseyNumber: 7,
      careerMatches: 1,
      careerRuns: 45,
      careerBallsFaced: 32,
    },
    {
      id: p2Id,
      fullName: `${payload.shortName.toUpperCase()} Strike Bowler`,
      shortName: `${payload.shortName.toUpperCase()} Pace`,
      primaryTeamId: teamId,
      playingRole: 'Fast Bowler',
      battingStyle: 'Right-hand bat',
      bowlingStyle: 'Right-arm fast',
      jerseyNumber: 11,
      careerMatches: 1,
      careerWickets: 3,
      careerLegalBallsBowled: 24,
      careerRunsConceded: 26,
    },
  ]);

  await db.insert(auditLogs).values({
    actorUid: actor.uid,
    actorRole: actor.primaryRole,
    actionType: 'TEAM_CREATED',
    entityType: 'team',
    entityId: teamId,
    summary: `Created club team ${payload.name} (${payload.shortName.toUpperCase()}) in ${payload.city}.`,
  });

  return created[0];
}

export async function createPlayerInDb(
  actor: ActorContext,
  payload: {
    fullName: string;
    shortName?: string;
    primaryTeamId: string;
    playingRole: string;
    battingStyle: string;
    bowlingStyle: string;
    jerseyNumber?: number;
    isMinor?: boolean;
  }
) {
  await ensureSeedData();
  const teamRows = await db.select().from(teams).where(eq(teams.id, payload.primaryTeamId));
  if (teamRows.length === 0) throw new Error('Target team not found.');
  const perm = canManageTeam(actor, teamRows[0]);
  if (!perm.allowed) {
    const err = new Error(perm.reason || 'Forbidden');
    (err as any).statusCode = 403;
    throw err;
  }

  const playerId = `p-${Date.now().toString().slice(-6)}`;
  const shortName =
    payload.shortName?.trim() ||
    payload.fullName
      .trim()
      .split(' ')
      .map((part, idx, arr) => (idx === 0 && arr.length > 1 ? `${part[0]}.` : part))
      .join(' ');

  const inserted = await db
    .insert(players)
    .values({
      id: playerId,
      fullName: payload.fullName.trim(),
      shortName,
      primaryTeamId: payload.primaryTeamId,
      playingRole: payload.playingRole,
      battingStyle: payload.battingStyle,
      bowlingStyle: payload.bowlingStyle,
      jerseyNumber: payload.jerseyNumber || 19,
      isMinor: Boolean(payload.isMinor),
      privacyHidePersonalBio: Boolean(payload.isMinor), // Automatic minor privacy protection
    })
    .returning();

  await db.insert(teamMembers).values({
    teamId: payload.primaryTeamId,
    playerId,
    squadRole: 'Player',
    isActive: true,
  });

  return inserted[0];
}

export async function createTournamentInDb(
  actor: ActorContext,
  payload: {
    name: string;
    shortName: string;
    season?: string;
    format: TournamentFormat;
    matchOvers: number;
    pointsWin?: number;
    pointsTie?: number;
    pointsNoResult?: number;
    rainRulePolicy?: string;
    teamIds?: string[];
  }
) {
  await ensureSeedData();
  const perm = canManageTournament(actor);
  if (!perm.allowed) {
    const err = new Error(perm.reason || 'Forbidden');
    (err as any).statusCode = actor.uid ? 403 : 401;
    throw err;
  }

  const tournamentId = `tourn-${payload.shortName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
  const inserted = await db
    .insert(tournaments)
    .values({
      id: tournamentId,
      name: payload.name.trim(),
      shortName: payload.shortName.trim().toUpperCase().slice(0, 8),
      season: payload.season || '2026',
      format: payload.format,
      matchOvers: payload.matchOvers || 20,
      ballsPerOver: 6,
      pointsWin: payload.pointsWin ?? 2,
      pointsTie: payload.pointsTie ?? 1,
      pointsNoResult: payload.pointsNoResult ?? 1,
      pointsLoss: 0,
      minOversForNrr: Math.max(2, Math.floor((payload.matchOvers || 20) / 4)),
      rainRulePolicy: payload.rainRulePolicy || 'DLS_PROPORTIONAL',
      status: 'active',
      organizerUid: actor.uid || 'demo-organizer',
      description: `${payload.format.replace('_', ' ').toUpperCase()} competition · ${payload.matchOvers} overs per side`,
    })
    .returning();

  if (payload.teamIds && payload.teamIds.length > 0) {
    for (let i = 0; i < payload.teamIds.length; i++) {
      await registerTeamInTournamentDb(actor, tournamentId, payload.teamIds[i], i % 2 === 0 ? 'Group A' : 'Group B');
    }
    if (payload.teamIds.length >= 2) {
      await generateTournamentFixturesInDb(actor, tournamentId);
    }
  }

  await db.insert(auditLogs).values({
    actorUid: actor.uid || 'demo-organizer',
    actorRole: actor.primaryRole,
    actionType: 'TOURNAMENT_CREATED',
    entityType: 'tournament',
    entityId: tournamentId,
    summary: `Created tournament ${payload.name} (${payload.format}, ${payload.matchOvers} overs).`,
  });

  return inserted[0];
}

export async function registerTeamInTournamentDb(
  actor: ActorContext,
  tournamentId: string,
  teamId: string,
  groupName = 'Group A'
) {
  await ensureSeedData();
  if (!actor.uid || actor.primaryRole === 'visitor') {
    const err = new Error('Authentication required to register a team.');
    (err as any).statusCode = 401;
    throw err;
  }

  const inserted = await db
    .insert(tournamentTeams)
    .values({
      tournamentId,
      teamId,
      groupName,
    })
    .onConflictDoNothing()
    .returning();

  return inserted[0];
}

export async function generateTournamentFixturesInDb(actor: ActorContext, tournamentId: string) {
  await ensureSeedData();
  const tournRows = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (tournRows.length === 0) throw new Error('Tournament not found.');
  const tourn = tournRows[0];

  const perm = canManageTournament(actor, tourn);
  if (!perm.allowed) {
    const err = new Error(perm.reason || 'Forbidden');
    (err as any).statusCode = 403;
    throw err;
  }

  const regTeams = await db
    .select()
    .from(tournamentTeams)
    .where(eq(tournamentTeams.tournamentId, tournamentId));

  const existingMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId));

  const generated = generateTournamentFixtures(
    regTeams.map((r) => ({ teamId: r.teamId, groupName: r.groupName })),
    tourn.format as TournamentFormat,
    existingMatches.map((m) => ({
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      stage: m.stage,
    }))
  );

  const createdMatches = [];
  for (const fx of generated) {
    const matchId = `match-${tournamentId.slice(-4)}-${fx.matchNumber}-${Date.now().toString().slice(-3)}`;
    const m = await db
      .insert(matches)
      .values({
        id: matchId,
        tournamentId,
        seriesId: tournamentId,
        seriesName: tourn.name,
        matchNumber: fx.matchNumber,
        stage: fx.stage,
        homeTeamId: fx.homeTeamId,
        awayTeamId: fx.awayTeamId,
        venueId: 'venue-sovereign',
        scheduledAt: new Date(Date.now() + fx.matchNumber * 3600000 * 6),
        status: 'scheduled',
        scheduledOvers: tourn.matchOvers,
        revisedOvers: tourn.matchOvers,
        resultSummary: `${fx.stage} Fixture · ${tourn.matchOvers} Overs`,
        assignedScorerUid: 'demo-scorer',
        matchOfficialUid: 'demo-official',
        dataSource: 'organizer_local',
      })
      .returning();
    createdMatches.push(m[0]);
  }

  return createdMatches;
}

export async function createVenueInDb(
  actor: ActorContext,
  payload: {
    name: string;
    city: string;
    country: string;
    capacity: number;
    pitchType: string;
    boundaryStraightMeters: number;
    boundarySquareMeters: number;
    hasFloodlights: boolean;
    curatorNotes?: string;
  }
) {
  await ensureSeedData();
  if (!actor.uid || actor.primaryRole === 'visitor') {
    const err = new Error('Authentication required to register a cricket ground.');
    (err as any).statusCode = 401;
    throw err;
  }

  const venueId = `venue-${Date.now().toString().slice(-5)}`;
  const inserted = await db
    .insert(venues)
    .values({
      id: venueId,
      name: payload.name.trim(),
      city: payload.city.trim(),
      country: payload.country.trim() || 'India',
      capacity: payload.capacity || 5000,
      pitchType: payload.pitchType || 'Balanced Turf',
      boundaryStraightMeters: payload.boundaryStraightMeters || 72,
      boundarySquareMeters: payload.boundarySquareMeters || 66,
      hasFloodlights: payload.hasFloodlights,
      curatorNotes: payload.curatorNotes || 'Verified club surface.',
      isVerified: true,
    })
    .returning();

  return inserted[0];
}

export async function toggleFavoriteInDb(
  userUid: string,
  entityType: string,
  entityId: string,
  entityLabel: string
) {
  await ensureSeedData();
  const existing = await db
    .select()
    .from(favorites)
    .where(
      and(
        eq(favorites.userUid, userUid),
        eq(favorites.entityType, entityType),
        eq(favorites.entityId, entityId)
      )
    );

  if (existing.length > 0) {
    await db.delete(favorites).where(eq(favorites.id, existing[0].id));
    return { favorited: false };
  }
  await db.insert(favorites).values({
    userUid,
    entityType,
    entityId,
    entityLabel,
  });
  return { favorited: true };
}

function generateAutomaticCommentary(params: {
  runsBatter: number;
  extraType: ExtraType;
  isWicket?: boolean;
  dismissalType?: DismissalType;
}): string {
  if (params.isWicket) {
    return `WICKET! Dismissed (${params.dismissalType?.replace('_', ' ') || 'out'})! Huge breakthrough for the bowling side.`;
  }
  if (params.extraType === 'wide') {
    return 'Wide signaled by the umpire — straying outside the tramline.';
  }
  if (params.extraType === 'no_ball') {
    return `No-Ball called for overstepping! Free Hit coming up next delivery (+${params.runsBatter} off the bat).`;
  }
  if (params.runsBatter === 6) {
    return 'SIX! Clean swing of the willow, deposited deep into the stands!';
  }
  if (params.runsBatter === 4) {
    return 'FOUR! Pierces the infield with clinical placement to the ropes.';
  }
  if (params.runsBatter === 0) {
    return 'Dot ball — defended solidly back down the pitch.';
  }
  return `Worked into the gap for ${params.runsBatter} run${params.runsBatter > 1 ? 's' : ''}.`;
}

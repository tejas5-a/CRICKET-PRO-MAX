import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. Profiles (Users synchronized with Firebase Auth)
export const profiles = pgTable(
  'profiles',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    primaryRole: text('primary_role').notNull().default('user'), // visitor, user, player, team_manager, tournament_organizer, scorer, moderator, admin
    bio: text('bio').default(''),
    organization: text('organization').default(''),
    privacyProfilePublic: boolean('privacy_profile_public').notNull().default(true),
    privacyShowContact: boolean('privacy_show_contact').notNull().default(false),
    isMinorAccount: boolean('is_minor_account').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('idx_profiles_uid').on(table.uid)]
);

// 2. User Roles (Scoped RBAC permissions)
export const userRoles = pgTable(
  'user_roles',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid')
      .notNull()
      .references(() => profiles.uid, { onDelete: 'cascade' }),
    role: text('role').notNull(), // player, team_manager, tournament_organizer, scorer, moderator, admin
    scopeType: text('scope_type').notNull().default('global'), // global, tournament, team, match
    scopeId: text('scope_id').notNull().default('*'),
    grantedByUid: text('granted_by_uid').default('system'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_user_roles_uid').on(table.userUid),
    uniqueIndex('idx_user_roles_unique_scope').on(table.userUid, table.role, table.scopeType, table.scopeId),
  ]
);

// 3. Venues (Cricket grounds directory)
export const venues = pgTable(
  'venues',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    city: text('city').notNull(),
    country: text('country').notNull(),
    capacity: integer('capacity').notNull().default(5000),
    pitchType: text('pitch_type').notNull().default('Balanced Turf'), // Pace & Bounce, Spin Friendly, Batting Track, Balanced Turf, Synthetic Mat
    boundaryStraightMeters: integer('boundary_straight_meters').notNull().default(72),
    boundarySquareMeters: integer('boundary_square_meters').notNull().default(66),
    hasFloodlights: boolean('has_floodlights').notNull().default(true),
    endsDescription: text('ends_description').notNull().default('Pavilion End / Media Center End'),
    curatorNotes: text('curator_notes').default(''),
    isVerified: boolean('is_verified').notNull().default(true),
    isFictionalSeed: boolean('is_fictional_seed').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_venues_city').on(table.city)]
);

// 4. Teams
export const teams = pgTable(
  'teams',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    city: text('city').notNull(),
    primaryColor: text('primary_color').notNull().default('#10b981'),
    division: text('division').notNull().default('Premier Division'),
    managerUid: text('manager_uid').notNull(),
    homeVenueId: text('home_venue_id').references(() => venues.id, { onDelete: 'set null' }),
    foundedYear: integer('founded_year').notNull().default(2021),
    isFictionalSeed: boolean('is_fictional_seed').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_teams_short_name').on(table.shortName),
    index('idx_teams_manager').on(table.managerUid),
  ]
);

// 5. Players
export const players = pgTable(
  'players',
  {
    id: text('id').primaryKey(),
    userUid: text('user_uid'),
    fullName: text('full_name').notNull(),
    shortName: text('short_name').notNull(),
    primaryTeamId: text('primary_team_id').references(() => teams.id, { onDelete: 'set null' }),
    playingRole: text('playing_role').notNull().default('All-Rounder'), // Top-Order Batter, Finisher, Fast Bowler, Spin Bowler, Wicketkeeper-Batter, All-Rounder
    battingStyle: text('batting_style').notNull().default('Right-hand bat'),
    bowlingStyle: text('bowling_style').notNull().default('Right-arm medium-fast'),
    jerseyNumber: integer('jersey_number').notNull().default(18),
    nationality: text('nationality').notNull().default('IND'),
    isMinor: boolean('is_minor').notNull().default(false),
    privacyHidePersonalBio: boolean('privacy_hide_personal_bio').notNull().default(false),
    careerMatches: integer('career_matches').notNull().default(0),
    careerInningsBatted: integer('career_innings_batted').notNull().default(0),
    careerNotOuts: integer('career_not_outs').notNull().default(0),
    careerRuns: integer('career_runs').notNull().default(0),
    careerBallsFaced: integer('career_balls_faced').notNull().default(0),
    careerHighestScore: integer('career_highest_score').notNull().default(0),
    careerFours: integer('career_fours').notNull().default(0),
    careerSixes: integer('career_sixes').notNull().default(0),
    careerFifties: integer('career_fifties').notNull().default(0),
    careerHundreds: integer('career_hundreds').notNull().default(0),
    careerWickets: integer('career_wickets').notNull().default(0),
    careerLegalBallsBowled: integer('career_legal_balls_bowled').notNull().default(0),
    careerRunsConceded: integer('career_runs_conceded').notNull().default(0),
    careerBestBowlingWickets: integer('career_best_bowling_wickets').notNull().default(0),
    careerBestBowlingRuns: integer('career_best_bowling_runs').notNull().default(0),
    careerCatches: integer('career_catches').notNull().default(0),
    isFictionalSeed: boolean('is_fictional_seed').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_players_team').on(table.primaryTeamId)]
);

// 6. Team Members
export const teamMembers = pgTable(
  'team_members',
  {
    id: serial('id').primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    squadRole: text('squad_role').notNull().default('Player'), // Captain, Vice-Captain, Wicketkeeper, Player, Coach
    isActive: boolean('is_active').notNull().default(true),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('idx_team_members_unique').on(table.teamId, table.playerId)]
);

// 7. Tournaments
export const tournaments = pgTable(
  'tournaments',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    season: text('season').notNull().default('2026'),
    format: text('format').notNull().default('round_robin'), // round_robin, groups, knockout, group_knockout
    matchOvers: integer('match_overs').notNull().default(20),
    ballsPerOver: integer('balls_per_over').notNull().default(6),
    pointsWin: integer('points_win').notNull().default(2),
    pointsTie: integer('points_tie').notNull().default(1),
    pointsNoResult: integer('points_no_result').notNull().default(1),
    pointsLoss: integer('points_loss').notNull().default(0),
    minOversForNrr: integer('min_overs_for_nrr').notNull().default(5),
    rainRulePolicy: text('rain_rule_policy').notNull().default('DLS_PROPORTIONAL'), // DLS_PROPORTIONAL, REVISED_TARGET_PAR, ABANDON_SPLIT_POINTS
    status: text('status').notNull().default('active'), // registration, active, knockout, completed
    organizerUid: text('organizer_uid').notNull(),
    description: text('description').default(''),
    isFictionalSeed: boolean('is_fictional_seed').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_tournaments_status').on(table.status)]
);

// 8. Tournament Teams & Standings Projection
export const tournamentTeams = pgTable(
  'tournament_teams',
  {
    id: serial('id').primaryKey(),
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    groupName: text('group_name').notNull().default('Group A'),
    seedNumber: integer('seed_number').notNull().default(1),
    matchesPlayed: integer('matches_played').notNull().default(0),
    wins: integer('wins').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    ties: integer('ties').notNull().default(0),
    noResults: integer('no_results').notNull().default(0),
    points: integer('points').notNull().default(0),
    runsScored: integer('runs_scored').notNull().default(0),
    legalBallsFaced: integer('legal_balls_faced').notNull().default(0),
    runsConceded: integer('runs_conceded').notNull().default(0),
    legalBallsBowled: integer('legal_balls_bowled').notNull().default(0),
    netRunRate: doublePrecision('net_run_rate').notNull().default(0),
    qualificationStatus: text('qualification_status').notNull().default('contending'), // qualified, contending, eliminated
    registeredAt: timestamp('registered_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_tournament_teams_unique').on(table.tournamentId, table.teamId),
    index('idx_tournament_teams_standings').on(table.tournamentId, table.points),
  ]
);

// 9. Matches
export const matches = pgTable(
  'matches',
  {
    id: text('id').primaryKey(),
    tournamentId: text('tournament_id').references(() => tournaments.id, { onDelete: 'set null' }),
    seriesId: text('series_id').notNull().default('series-premier-t20'),
    seriesName: text('series_name').notNull().default('Emerald Premier T20 Cup'),
    matchNumber: integer('match_number').notNull().default(1),
    stage: text('stage').notNull().default('League Stage'), // League Stage, Group A, Group B, Semi-Final 1, Semi-Final 2, Final
    homeTeamId: text('home_team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    awayTeamId: text('away_team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    venueId: text('venue_id').references(() => venues.id, { onDelete: 'set null' }),
    scheduledAt: timestamp('scheduled_at').notNull(),
    status: text('status').notNull().default('scheduled'), // scheduled, live, innings_break, completed, abandoned
    scheduledOvers: integer('scheduled_overs').notNull().default(20),
    revisedOvers: integer('revised_overs').notNull().default(20),
    isRainAffected: boolean('is_rain_affected').notNull().default(false),
    rainNote: text('rain_note').default(''),
    dlsTargetRuns: integer('dls_target_runs'),
    tossWinnerTeamId: text('toss_winner_team_id'),
    tossDecision: text('toss_decision'), // bat, bowl
    currentInningsNumber: integer('current_innings_number').notNull().default(1),
    winnerTeamId: text('winner_team_id'),
    resultType: text('result_type'), // win, tie, no_result, abandoned
    resultSummary: text('result_summary').default(''),
    assignedScorerUid: text('assigned_scorer_uid').notNull().default('demo-scorer'),
    matchOfficialUid: text('match_official_uid').notNull().default('demo-official'),
    dataSource: text('data_source').notNull().default('organizer_local'), // organizer_local, official_provider, community_unverified
    externalProviderId: text('external_provider_id'),
    isFictionalSeed: boolean('is_fictional_seed').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_matches_status').on(table.status),
    index('idx_matches_tournament').on(table.tournamentId),
    index('idx_matches_series').on(table.seriesId),
  ]
);

// 10. Innings
export const innings = pgTable(
  'innings',
  {
    id: text('id').primaryKey(),
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    inningsNumber: integer('innings_number').notNull(), // 1 or 2
    battingTeamId: text('batting_team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    bowlingTeamId: text('bowling_team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    totalRuns: integer('total_runs').notNull().default(0),
    totalWickets: integer('total_wickets').notNull().default(0),
    legalBallsBowled: integer('legal_balls_bowled').notNull().default(0), // NEVER float overs; integer legal balls
    maxOvers: integer('max_overs').notNull().default(20),
    targetRuns: integer('target_runs'),
    extrasWide: integer('extras_wide').notNull().default(0),
    extrasNoBall: integer('extras_no_ball').notNull().default(0),
    extrasBye: integer('extras_bye').notNull().default(0),
    extrasLegBye: integer('extras_leg_bye').notNull().default(0),
    extrasPenalty: integer('extras_penalty').notNull().default(0),
    strikerPlayerId: text('striker_player_id'),
    nonStrikerPlayerId: text('non_striker_player_id'),
    currentBowlerPlayerId: text('current_bowler_player_id'),
    isCompleted: boolean('is_completed').notNull().default(false),
    isAllOut: boolean('is_all_out').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_innings_match_number').on(table.matchId, table.inningsNumber),
    index('idx_innings_match').on(table.matchId),
  ]
);

// 11. Deliveries (Ball-by-ball events with idempotency and audit revision support)
export const deliveries = pgTable(
  'deliveries',
  {
    id: text('id').primaryKey(),
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    inningsId: text('innings_id')
      .notNull()
      .references(() => innings.id, { onDelete: 'cascade' }),
    inningsNumber: integer('innings_number').notNull(),
    sequenceNumber: integer('sequence_number').notNull(),
    overNumber: integer('over_number').notNull(), // 0-indexed over number (0..19)
    ballInOver: integer('ball_in_over').notNull(), // 1-indexed legal ball in over (1..6)
    isLegalDelivery: boolean('is_legal_delivery').notNull().default(true),
    batterId: text('batter_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
    nonStrikerId: text('non_striker_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
    bowlerId: text('bowler_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
    runsBatter: integer('runs_batter').notNull().default(0),
    extraType: text('extra_type').notNull().default('none'), // none, wide, no_ball, bye, leg_bye, penalty
    runsExtras: integer('runs_extras').notNull().default(0),
    totalRunsOnBall: integer('total_runs_on_ball').notNull().default(0),
    isBoundaryFour: boolean('is_boundary_four').notNull().default(false),
    isBoundarySix: boolean('is_boundary_six').notNull().default(false),
    isWicket: boolean('is_wicket').notNull().default(false),
    dismissalType: text('dismissal_type'),
    dismissedPlayerId: text('dismissed_player_id'),
    fielderId: text('fielder_id'),
    commentaryText: text('commentary_text').notNull().default(''),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    recordedByUid: text('recorded_by_uid').notNull(),
    revisionNumber: integer('revision_number').notNull().default(1),
    correctionNote: text('correction_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_deliveries_idempotency').on(table.idempotencyKey),
    index('idx_deliveries_match_innings').on(table.matchId, table.inningsNumber, table.sequenceNumber),
  ]
);

// 12. Wickets
export const wickets = pgTable(
  'wickets',
  {
    id: text('id').primaryKey(),
    deliveryId: text('delivery_id')
      .notNull()
      .references(() => deliveries.id, { onDelete: 'cascade' }),
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    inningsId: text('innings_id')
      .notNull()
      .references(() => innings.id, { onDelete: 'cascade' }),
    dismissedPlayerId: text('dismissed_player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
    dismissalType: text('dismissal_type').notNull(), // bowled, caught, lbw, run_out, stumped, hit_wicket
    bowlerCredited: boolean('bowler_credited').notNull().default(true),
    bowlerId: text('bowler_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
    fielderId: text('fielder_id'),
    runsAtFall: integer('runs_at_fall').notNull(),
    wicketNumber: integer('wicket_number').notNull(),
    legalBallsAtFall: integer('legal_balls_at_fall').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_wickets_innings').on(table.inningsId)]
);

// 13. Player Match Stats
export const playerMatchStats = pgTable(
  'player_match_stats',
  {
    id: serial('id').primaryKey(),
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    inningsNumber: integer('innings_number').notNull().default(1),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    battingPosition: integer('batting_position').notNull().default(1),
    runsScored: integer('runs_scored').notNull().default(0),
    ballsFaced: integer('balls_faced').notNull().default(0),
    fours: integer('fours').notNull().default(0),
    sixes: integer('sixes').notNull().default(0),
    isOut: boolean('is_out').notNull().default(false),
    dismissalText: text('dismissal_text').notNull().default('not out'),
    legalBallsBowled: integer('legal_balls_bowled').notNull().default(0),
    maidens: integer('maidens').notNull().default(0),
    runsConceded: integer('runs_conceded').notNull().default(0),
    wicketsTaken: integer('wickets_taken').notNull().default(0),
    widesBowled: integer('wides_bowled').notNull().default(0),
    noBallsBowled: integer('no_balls_bowled').notNull().default(0),
  },
  (table) => [
    uniqueIndex('idx_player_match_stats_unique').on(table.matchId, table.inningsNumber, table.playerId),
  ]
);

// 14. Notifications
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    category: text('category').notNull().default('match_alert'), // match_alert, score_correction, tournament_update, moderation
    linkUrl: text('link_url').notNull().default('/matches'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_notifications_user').on(table.userUid)]
);

// 15. Audit Logs
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorUid: text('actor_uid').notNull(),
    actorRole: text('actor_role').notNull(),
    actionType: text('action_type').notNull(), // DELIVERY_RECORDED, DELIVERY_CORRECTED, MATCH_FINALIZED, ROLE_UPDATED, TOURNAMENT_CREATED, MODERATION_ACTION
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    summary: text('summary').notNull(),
    beforeSnapshot: text('before_snapshot'),
    afterSnapshot: text('after_snapshot'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_audit_logs_entity').on(table.entityType, table.entityId)]
);

// 16. Favorites
export const favorites = pgTable(
  'favorites',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid').notNull(),
    entityType: text('entity_type').notNull(), // match, team, tournament, player
    entityId: text('entity_id').notNull(),
    entityLabel: text('entity_label').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('idx_favorites_unique').on(table.userUid, table.entityType, table.entityId)]
);

// 17. Provider Sync Logs
export const providerSyncLogs = pgTable(
  'provider_sync_logs',
  {
    id: serial('id').primaryKey(),
    providerName: text('provider_name').notNull(), // MockFeedAdapter, LicensedProCricketFeed
    endpoint: text('endpoint').notNull(),
    status: text('status').notNull(), // ok, cached, rate_limited, degraded
    recordsSynced: integer('records_synced').notNull().default(0),
    latencyMs: integer('latency_ms').notNull().default(0),
    quotaRemaining: integer('quota_remaining').notNull().default(500),
    isStaleCache: boolean('is_stale_cache').notNull().default(false),
    message: text('message').default(''),
    syncedAt: timestamp('synced_at').defaultNow().notNull(),
  }
);

// Relations
export const teamsRelations = relations(teams, ({ one, many }) => ({
  homeVenue: one(venues, {
    fields: [teams.homeVenueId],
    references: [venues.id],
  }),
  players: many(players),
  members: many(teamMembers),
}));

export const playersRelations = relations(players, ({ one }) => ({
  primaryTeam: one(teams, {
    fields: [players.primaryTeamId],
    references: [teams.id],
  }),
}));

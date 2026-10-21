import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDelivery,
  calculateRevisedTargetDls,
  calculateRunRate,
  createInitialInningsState,
  formatOvers,
  replayInningsWithCorrection,
} from './scoringEngine';
import {
  calculateNetRunRate,
  computeTournamentStandings,
  generateTournamentFixtures,
} from './tournamentEngine';
import { canFinalizeMatch, canManageTeam, canRecordDelivery } from './rbac';

test('Overs formatting uses integer legal balls and never decimal arithmetic', () => {
  assert.equal(formatOvers(0), '0.0');
  assert.equal(formatOvers(5), '0.5');
  assert.equal(formatOvers(6), '1.0');
  assert.equal(formatOvers(14), '2.2');
  assert.equal(formatOvers(120), '20.0');
});

test('Scoring engine tracks legal deliveries, wides, no-balls, byes, and strike rotation accurately', () => {
  let state = createInitialInningsState({
    matchId: 'm-1',
    inningsNumber: 1,
    battingTeamId: 't-home',
    bowlingTeamId: 't-away',
    maxOvers: 20,
    strikerId: 'p-1',
    nonStrikerId: 'p-2',
    openingBowlerId: 'b-1',
  });

  // Ball 1: 1 run off bat -> legal ball 1, strike rotates to p-2
  state = applyDelivery(state, {
    idempotencyKey: 'k-1',
    batterId: state.strikerId,
    nonStrikerId: state.nonStrikerId,
    bowlerId: 'b-1',
    runsBatter: 1,
    extraType: 'none',
    recordedByUid: 'scorer-1',
  });
  assert.equal(state.totalRuns, 1);
  assert.equal(state.legalBallsBowled, 1);
  assert.equal(state.strikerId, 'p-2');

  // Ball 2 (Wide): 1 wide -> NOT legal ball, strike stays with p-2
  state = applyDelivery(state, {
    idempotencyKey: 'k-2',
    batterId: state.strikerId,
    nonStrikerId: state.nonStrikerId,
    bowlerId: 'b-1',
    runsBatter: 0,
    extraType: 'wide',
    runsExtras: 1,
    recordedByUid: 'scorer-1',
  });
  assert.equal(state.totalRuns, 2);
  assert.equal(state.legalBallsBowled, 1);
  assert.equal(state.extras.wide, 1);
  assert.equal(state.strikerId, 'p-2');

  // Ball 2 (No-Ball + 4 off bat): 5 total runs, NOT legal ball, p-2 gets 4 runs
  state = applyDelivery(state, {
    idempotencyKey: 'k-3',
    batterId: state.strikerId,
    nonStrikerId: state.nonStrikerId,
    bowlerId: 'b-1',
    runsBatter: 4,
    extraType: 'no_ball',
    runsExtras: 1,
    recordedByUid: 'scorer-1',
  });
  assert.equal(state.totalRuns, 7);
  assert.equal(state.legalBallsBowled, 1);
  assert.equal(state.batters['p-2'].runs, 4);
  assert.equal(state.batters['p-2'].fours, 1);

  // Duplicate idempotencyKey must throw
  assert.throws(() => {
    applyDelivery(state, {
      idempotencyKey: 'k-3',
      batterId: state.strikerId,
      nonStrikerId: state.nonStrikerId,
      bowlerId: 'b-1',
      runsBatter: 0,
      extraType: 'none',
      recordedByUid: 'scorer-1',
    });
  }, /Duplicate delivery rejected/);
});

test('Over completion rotates strike and distinguishes bowler-credited wickets from run-outs', () => {
  let state = createInitialInningsState({
    matchId: 'm-2',
    inningsNumber: 1,
    battingTeamId: 't-home',
    bowlingTeamId: 't-away',
    maxOvers: 2,
    strikerId: 'p-1',
    nonStrikerId: 'p-2',
    openingBowlerId: 'b-1',
  });

  // 5 dot balls
  for (let i = 1; i <= 5; i++) {
    state = applyDelivery(state, {
      idempotencyKey: `dot-${i}`,
      batterId: state.strikerId,
      nonStrikerId: state.nonStrikerId,
      bowlerId: 'b-1',
      runsBatter: 0,
      extraType: 'none',
      recordedByUid: 'scorer-1',
    });
  }

  // 6th legal ball: Run out (0 runs) -> over complete (maiden!), bowler not credited with wicket
  state = applyDelivery(state, {
    idempotencyKey: 'ball-6-runout',
    batterId: state.strikerId,
    nonStrikerId: state.nonStrikerId,
    bowlerId: 'b-1',
    runsBatter: 0,
    extraType: 'none',
    isWicket: true,
    dismissalType: 'run_out',
    dismissedPlayerId: 'p-1',
    nextBatterId: 'p-3',
    recordedByUid: 'scorer-1',
  });

  assert.equal(state.legalBallsBowled, 6);
  assert.equal(state.totalWickets, 1);
  assert.equal(state.bowlers['b-1'].wickets, 0); // Run out does NOT credit bowler
  assert.equal(state.bowlers['b-1'].maidens, 1); // 6 legal balls, 0 runs conceded = 1 maiden
  // End of over rotated strike between new striker p-3 and non-striker p-2 -> p-2 is now striker
  assert.equal(state.strikerId, 'p-2');
});

test('Scoring correction replays event stream and preserves audit states', () => {
  const init = {
    matchId: 'm-3',
    inningsNumber: 1,
    battingTeamId: 't-home',
    bowlingTeamId: 't-away',
    maxOvers: 20,
    strikerId: 'p-1',
    nonStrikerId: 'p-2',
    openingBowlerId: 'b-1',
  };
  const deliveries = [
    {
      idempotencyKey: 'd-1',
      batterId: 'p-1',
      nonStrikerId: 'p-2',
      bowlerId: 'b-1',
      runsBatter: 4,
      extraType: 'none' as const,
      recordedByUid: 'scorer-1',
    },
    {
      idempotencyKey: 'd-2',
      batterId: 'p-1',
      nonStrikerId: 'p-2',
      bowlerId: 'b-1',
      runsBatter: 2,
      extraType: 'none' as const,
      recordedByUid: 'scorer-1',
    },
  ];

  const { beforeState, afterState } = replayInningsWithCorrection(
    init,
    deliveries,
    'd-1',
    {
      ...deliveries[0],
      runsBatter: 6, // Umpire signaled 6 instead of 4
    },
    'Umpire boundary review upgraded 4 to 6'
  );

  assert.equal(beforeState.totalRuns, 6);
  assert.equal(afterState.totalRuns, 8);
  assert.equal(afterState.deliveries[0].revisionNumber, 2);
  assert.equal(afterState.deliveries[0].correctionNote, 'Umpire boundary review upgraded 4 to 6');
});

test('Tournament NRR applies the all-out full-quota rule and orders standings properly', () => {
  // Team A scores 150 in 20 overs (120 balls). Team B is ALL OUT for 120 in 15 overs (90 balls, but charged 120 balls!)
  const standings = computeTournamentStandings(
    [{ teamId: 'team-a' }, { teamId: 'team-b' }],
    [
      {
        matchId: 'm-101',
        homeTeamId: 'team-a',
        awayTeamId: 'team-b',
        resultType: 'win',
        winnerTeamId: 'team-a',
        firstInnings: {
          battingTeamId: 'team-a',
          bowlingTeamId: 'team-b',
          runs: 150,
          legalBalls: 120,
          maxOvers: 20,
          isAllOut: false,
        },
        secondInnings: {
          battingTeamId: 'team-b',
          bowlingTeamId: 'team-a',
          runs: 120,
          legalBalls: 90, // Bowled out in 15.0 overs
          maxOvers: 20,
          isAllOut: true, // All out -> counts as 20 overs (120 balls) for NRR!
        },
      },
    ],
    {
      id: 't-1',
      format: 'round_robin',
      matchOvers: 20,
      ballsPerOver: 6,
      pointsWin: 2,
      pointsTie: 1,
      pointsNoResult: 1,
      pointsLoss: 0,
      minOversForNrr: 5,
    }
  );

  assert.equal(standings[0].teamId, 'team-a');
  assert.equal(standings[0].points, 2);
  // Team A run rate = 150/20 = 7.5, conceded = 120/20 = 6.0 -> NRR = +1.5
  assert.equal(standings[0].netRunRate, 1.5);
  assert.equal(standings[1].netRunRate, -1.5);

  const fixtures = generateTournamentFixtures(
    [{ teamId: 'team-a' }, { teamId: 'team-b' }, { teamId: 'team-c' }],
    'round_robin'
  );
  assert.equal(fixtures.length, 3);
});

test('RBAC rejects unauthorized scoring requests and allows assigned scorers', () => {
  const match = {
    id: 'm-live-1',
    status: 'live',
    assignedScorerUid: 'scorer-99',
    matchOfficialUid: 'umpire-1',
  };

  const visitorDecision = canRecordDelivery({ uid: null, primaryRole: 'visitor' }, match);
  assert.equal(visitorDecision.allowed, false);

  const randomPlayerDecision = canRecordDelivery({ uid: 'player-5', primaryRole: 'player' }, match);
  assert.equal(randomPlayerDecision.allowed, false);

  const assignedScorerDecision = canRecordDelivery({ uid: 'scorer-99', primaryRole: 'user' }, match);
  assert.equal(assignedScorerDecision.allowed, true);

  const finalizeByPlayer = canFinalizeMatch({ uid: 'player-5', primaryRole: 'player' }, match);
  assert.equal(finalizeByPlayer.allowed, false);

  const finalizeByOfficial = canFinalizeMatch({ uid: 'umpire-1', primaryRole: 'scorer' }, match);
  assert.equal(finalizeByOfficial.allowed, true);

  const teamCheck = canManageTeam({ uid: 'mgr-1', primaryRole: 'team_manager' }, { id: 't1', managerUid: 'mgr-1' });
  assert.equal(teamCheck.allowed, true);

  const dls = calculateRevisedTargetDls({ firstInningsRuns: 180, scheduledOvers: 20, revisedOvers: 10 });
  assert.ok(dls.targetRuns > 90 && dls.targetRuns < 180);
  assert.equal(calculateRunRate(36, 18), 12);
});

/**
 * CRICKET PRO MAX — Pure Domain Scoring Engine
 *
 * Rules enforced:
 * - Legal balls are always stored and calculated as integer counts (never float overs).
 * - Wides and No-Balls do not count as legal balls (unless configured differently in special junior rules, standard is false).
 * - Batter runs are credited on normal deliveries and no-balls; byes, leg-byes, and wides are credited only to team extras.
 * - Bowler is debited with wides and no-balls, plus batter runs, but NOT byes or leg-byes.
 * - Bowler is credited with wickets for: bowled, caught, lbw, stumped, hit_wicket.
 * - Bowler is NOT credited with wickets for: run_out, retired_hurt, timed_out, obstructing_field.
 * - Strike rotates on odd physical runs between the wickets, and flips at the completion of every 6-ball legal over.
 * - Duplicate deliveries are rejected via idempotency keys.
 */

export type ExtraType = 'none' | 'wide' | 'no_ball' | 'bye' | 'leg_bye' | 'penalty';

export type DismissalType =
  | 'bowled'
  | 'caught'
  | 'lbw'
  | 'run_out'
  | 'stumped'
  | 'hit_wicket'
  | 'retired_hurt'
  | 'timed_out'
  | 'obstructing_field';

export interface DeliveryInput {
  idempotencyKey: string;
  batterId: string;
  nonStrikerId: string;
  bowlerId: string;
  runsBatter: number; // Runs off the bat (0..6)
  extraType: ExtraType;
  runsExtras?: number; // Additional extras beyond automatic 1 on wide/no-ball, or total byes/leg-byes
  isWicket?: boolean;
  dismissalType?: DismissalType;
  dismissedPlayerId?: string;
  fielderId?: string;
  nextBatterId?: string;
  crossedBeforeCatchOrRunOut?: boolean;
  commentaryText?: string;
  recordedByUid: string;
}

export interface BatterLine {
  playerId: string;
  battingPosition: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissalText: string;
}

export interface BowlerLine {
  playerId: string;
  legalBalls: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  wides: number;
  noBalls: number;
}

export interface FallOfWicketRecord {
  wicketNumber: number;
  dismissedPlayerId: string;
  runsAtFall: number;
  legalBallsAtFall: number;
  oversFormatted: string;
  dismissalType: DismissalType;
  bowlerId: string;
}

export interface PartnershipRecord {
  batter1Id: string;
  batter2Id: string;
  runs: number;
  balls: number;
  wicketNumber: number;
}

export interface RecordedDeliveryEvent extends DeliveryInput {
  sequenceNumber: number;
  overNumber: number;
  ballInOver: number;
  isLegalDelivery: boolean;
  computedExtras: number;
  totalRunsOnBall: number;
  isBoundaryFour: boolean;
  isBoundarySix: boolean;
  bowlerCreditedWicket: boolean;
  revisionNumber: number;
  correctionNote?: string;
}

export interface InningsDomainState {
  matchId: string;
  inningsNumber: number;
  battingTeamId: string;
  bowlingTeamId: string;
  maxOvers: number;
  ballsPerOver: number;
  targetRuns: number | null;
  totalRuns: number;
  totalWickets: number;
  legalBallsBowled: number;
  extras: {
    wide: number;
    noBall: number;
    bye: number;
    legBye: number;
    penalty: number;
    total: number;
  };
  strikerId: string;
  nonStrikerId: string;
  currentBowlerId: string;
  isCompleted: boolean;
  isAllOut: boolean;
  batters: Record<string, BatterLine>;
  battingOrderIds: string[];
  bowlers: Record<string, BowlerLine>;
  bowlingOrderIds: string[];
  fallOfWickets: FallOfWicketRecord[];
  currentPartnership: PartnershipRecord;
  partnerships: PartnershipRecord[];
  deliveries: RecordedDeliveryEvent[];
  currentOverRunsConcededByBowler: number;
  currentOverLegalBallsByBowler: number;
}

const BOWLER_CREDITED_DISMISSALS: ReadonlySet<DismissalType> = new Set([
  'bowled',
  'caught',
  'lbw',
  'stumped',
  'hit_wicket',
]);

export function formatOvers(legalBalls: number, ballsPerOver = 6): string {
  if (legalBalls < 0 || !Number.isInteger(legalBalls)) {
    throw new Error(`Invalid legalBalls count: ${legalBalls}. Must be a non-negative integer.`);
  }
  const completedOvers = Math.floor(legalBalls / ballsPerOver);
  const remainingBalls = legalBalls % ballsPerOver;
  return `${completedOvers}.${remainingBalls}`;
}

export function calculateRunRate(runs: number, legalBalls: number, ballsPerOver = 6): number {
  if (legalBalls <= 0) return 0;
  return Number(((runs * ballsPerOver) / legalBalls).toFixed(2));
}

export function calculateRequiredRunRate(
  targetRuns: number,
  currentRuns: number,
  legalBallsBowled: number,
  maxOvers: number,
  ballsPerOver = 6
): number | null {
  const totalBallsAvailable = maxOvers * ballsPerOver;
  const ballsRemaining = totalBallsAvailable - legalBallsBowled;
  const runsNeeded = targetRuns - currentRuns;
  if (runsNeeded <= 0) return 0;
  if (ballsRemaining <= 0) return null;
  return Number(((runsNeeded * ballsPerOver) / ballsRemaining).toFixed(2));
}

export function isBowlerCreditedWicket(dismissalType?: DismissalType): boolean {
  if (!dismissalType) return false;
  return BOWLER_CREDITED_DISMISSALS.has(dismissalType);
}

export function createInitialInningsState(params: {
  matchId: string;
  inningsNumber: number;
  battingTeamId: string;
  bowlingTeamId: string;
  maxOvers: number;
  ballsPerOver?: number;
  targetRuns?: number | null;
  strikerId: string;
  nonStrikerId: string;
  openingBowlerId: string;
}): InningsDomainState {
  const ballsPerOver = params.ballsPerOver ?? 6;
  const batters: Record<string, BatterLine> = {
    [params.strikerId]: {
      playerId: params.strikerId,
      battingPosition: 1,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      dismissalText: 'not out',
    },
    [params.nonStrikerId]: {
      playerId: params.nonStrikerId,
      battingPosition: 2,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      dismissalText: 'not out',
    },
  };

  const bowlers: Record<string, BowlerLine> = {
    [params.openingBowlerId]: {
      playerId: params.openingBowlerId,
      legalBalls: 0,
      maidens: 0,
      runsConceded: 0,
      wickets: 0,
      wides: 0,
      noBalls: 0,
    },
  };

  return {
    matchId: params.matchId,
    inningsNumber: params.inningsNumber,
    battingTeamId: params.battingTeamId,
    bowlingTeamId: params.bowlingTeamId,
    maxOvers: params.maxOvers,
    ballsPerOver,
    targetRuns: params.targetRuns ?? null,
    totalRuns: 0,
    totalWickets: 0,
    legalBallsBowled: 0,
    extras: {
      wide: 0,
      noBall: 0,
      bye: 0,
      legBye: 0,
      penalty: 0,
      total: 0,
    },
    strikerId: params.strikerId,
    nonStrikerId: params.nonStrikerId,
    currentBowlerId: params.openingBowlerId,
    isCompleted: false,
    isAllOut: false,
    batters,
    battingOrderIds: [params.strikerId, params.nonStrikerId],
    bowlers,
    bowlingOrderIds: [params.openingBowlerId],
    fallOfWickets: [],
    currentPartnership: {
      batter1Id: params.strikerId,
      batter2Id: params.nonStrikerId,
      runs: 0,
      balls: 0,
      wicketNumber: 1,
    },
    partnerships: [],
    deliveries: [],
    currentOverRunsConcededByBowler: 0,
    currentOverLegalBallsByBowler: 0,
  };
}

export function validateDeliveryInput(
  state: InningsDomainState,
  input: DeliveryInput
): { valid: boolean; error?: string } {
  if (state.isCompleted) {
    return { valid: false, error: 'Cannot record delivery: innings is already completed.' };
  }
  if (!input.idempotencyKey || input.idempotencyKey.trim().length === 0) {
    return { valid: false, error: 'Idempotency key is required for every delivery.' };
  }
  if (state.deliveries.some((d) => d.idempotencyKey === input.idempotencyKey)) {
    return { valid: false, error: `Duplicate delivery rejected: idempotencyKey "${input.idempotencyKey}" already exists.` };
  }
  if (input.batterId === input.nonStrikerId) {
    return { valid: false, error: 'Striker and non-striker must be distinct players.' };
  }
  if (!Number.isInteger(input.runsBatter) || input.runsBatter < 0 || input.runsBatter > 6) {
    return { valid: false, error: 'Batter runs must be an integer between 0 and 6.' };
  }
  if (input.extraType === 'wide' && input.runsBatter > 0) {
    return { valid: false, error: 'A wide delivery cannot have runs off the bat (use runsExtras for additional wide runs).' };
  }
  if ((input.extraType === 'bye' || input.extraType === 'leg_bye') && input.runsBatter > 0) {
    return { valid: false, error: 'Byes and leg-byes cannot simultaneously credit runs off the bat.' };
  }
  if (input.isWicket) {
    if (!input.dismissalType) {
      return { valid: false, error: 'Dismissal type is required when recording a wicket.' };
    }
    if (input.extraType === 'wide' && ['bowled', 'lbw', 'caught', 'leg_bye'].includes(input.dismissalType)) {
      return { valid: false, error: `Cannot be dismissed ${input.dismissalType} on a Wide delivery.` };
    }
    if (
      input.extraType === 'no_ball' &&
      ['bowled', 'lbw', 'caught', 'stumped', 'hit_wicket'].includes(input.dismissalType)
    ) {
      return { valid: false, error: `Cannot be dismissed ${input.dismissalType} on a No-Ball delivery.` };
    }
  }
  return { valid: true };
}

export function applyDelivery(state: InningsDomainState, input: DeliveryInput): InningsDomainState {
  const validation = validateDeliveryInput(state, input);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const nextState: InningsDomainState = structuredClone(state);
  nextState.strikerId = input.batterId;
  nextState.nonStrikerId = input.nonStrikerId;
  nextState.currentBowlerId = input.bowlerId;

  // Ensure batter & bowler lines exist
  if (!nextState.batters[input.batterId]) {
    nextState.battingOrderIds.push(input.batterId);
    nextState.batters[input.batterId] = {
      playerId: input.batterId,
      battingPosition: nextState.battingOrderIds.length,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      dismissalText: 'not out',
    };
  }
  if (!nextState.batters[input.nonStrikerId]) {
    nextState.battingOrderIds.push(input.nonStrikerId);
    nextState.batters[input.nonStrikerId] = {
      playerId: input.nonStrikerId,
      battingPosition: nextState.battingOrderIds.length,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      dismissalText: 'not out',
    };
  }
  if (!nextState.bowlers[input.bowlerId]) {
    nextState.bowlingOrderIds.push(input.bowlerId);
    nextState.bowlers[input.bowlerId] = {
      playerId: input.bowlerId,
      legalBalls: 0,
      maidens: 0,
      runsConceded: 0,
      wickets: 0,
      wides: 0,
      noBalls: 0,
    };
  }

  const isLegal = input.extraType === 'none' || input.extraType === 'bye' || input.extraType === 'leg_bye';
  const batterFacedBall = input.extraType !== 'wide' && input.extraType !== 'penalty';

  let computedExtras = 0;
  let bowlerConcededOnBall = 0;
  let physicalRunsForRotation = 0;

  switch (input.extraType) {
    case 'none': {
      computedExtras = 0;
      bowlerConcededOnBall = input.runsBatter;
      physicalRunsForRotation = input.runsBatter;
      break;
    }
    case 'wide': {
      // Base 1 wide + any additional runs run between wickets
      const extraRunning = input.runsExtras && input.runsExtras > 0 ? input.runsExtras : 1;
      computedExtras = extraRunning;
      nextState.extras.wide += computedExtras;
      bowlerConcededOnBall = computedExtras;
      // If 2 wides total (1 automatic + 1 run), batters crossed once (1)
      physicalRunsForRotation = Math.max(0, computedExtras - 1);
      nextState.bowlers[input.bowlerId].wides += computedExtras;
      break;
    }
    case 'no_ball': {
      const additionalExtras = input.runsExtras && input.runsExtras > 0 ? input.runsExtras : 1;
      computedExtras = additionalExtras;
      nextState.extras.noBall += computedExtras;
      bowlerConcededOnBall = computedExtras + input.runsBatter;
      physicalRunsForRotation = input.runsBatter + Math.max(0, computedExtras - 1);
      nextState.bowlers[input.bowlerId].noBalls += 1;
      break;
    }
    case 'bye': {
      computedExtras = input.runsExtras ?? 1;
      nextState.extras.bye += computedExtras;
      bowlerConcededOnBall = 0; // Byes not charged to bowler
      physicalRunsForRotation = computedExtras;
      break;
    }
    case 'leg_bye': {
      computedExtras = input.runsExtras ?? 1;
      nextState.extras.legBye += computedExtras;
      bowlerConcededOnBall = 0; // Leg-byes not charged to bowler
      physicalRunsForRotation = computedExtras;
      break;
    }
    case 'penalty': {
      computedExtras = input.runsExtras ?? 5;
      nextState.extras.penalty += computedExtras;
      bowlerConcededOnBall = 0;
      physicalRunsForRotation = 0;
      break;
    }
  }

  nextState.extras.total =
    nextState.extras.wide +
    nextState.extras.noBall +
    nextState.extras.bye +
    nextState.extras.legBye +
    nextState.extras.penalty;

  const totalRunsOnBall = input.runsBatter + computedExtras;
  const overNumber = Math.floor(nextState.legalBallsBowled / nextState.ballsPerOver);
  const ballInOver = (nextState.legalBallsBowled % nextState.ballsPerOver) + (isLegal ? 1 : 0);

  // Update team & batter totals
  nextState.totalRuns += totalRunsOnBall;
  const batterLine = nextState.batters[input.batterId];
  batterLine.runs += input.runsBatter;
  if (batterFacedBall) {
    batterLine.balls += 1;
  }
  const isBoundaryFour = input.runsBatter === 4;
  const isBoundarySix = input.runsBatter === 6;
  if (isBoundaryFour) batterLine.fours += 1;
  if (isBoundarySix) batterLine.sixes += 1;

  // Update bowler totals
  const bowlerLine = nextState.bowlers[input.bowlerId];
  bowlerLine.runsConceded += bowlerConcededOnBall;
  nextState.currentOverRunsConcededByBowler += bowlerConcededOnBall;

  if (isLegal) {
    nextState.legalBallsBowled += 1;
    bowlerLine.legalBalls += 1;
    nextState.currentOverLegalBallsByBowler += 1;
  }

  // Update partnership
  nextState.currentPartnership.runs += totalRunsOnBall;
  if (isLegal) {
    nextState.currentPartnership.balls += 1;
  }

  // Handle Wicket
  const bowlerCredited = Boolean(input.isWicket && isBowlerCreditedWicket(input.dismissalType));
  if (input.isWicket && input.dismissalType) {
    const dismissedId = input.dismissedPlayerId || input.batterId;
    if (input.dismissalType !== 'retired_hurt') {
      nextState.totalWickets += 1;
      if (bowlerCredited) {
        bowlerLine.wickets += 1;
      }
      if (nextState.batters[dismissedId]) {
        nextState.batters[dismissedId].isOut = true;
        nextState.batters[dismissedId].dismissalText = formatDismissalText(
          input.dismissalType,
          input.bowlerId,
          input.fielderId
        );
      }

      nextState.fallOfWickets.push({
        wicketNumber: nextState.totalWickets,
        dismissedPlayerId: dismissedId,
        runsAtFall: nextState.totalRuns,
        legalBallsAtFall: nextState.legalBallsBowled,
        oversFormatted: formatOvers(nextState.legalBallsBowled, nextState.ballsPerOver),
        dismissalType: input.dismissalType,
        bowlerId: input.bowlerId,
      });

      // Archive completed partnership
      nextState.partnerships.push({ ...nextState.currentPartnership });

      // Bring in next batter if not all out
      if (nextState.totalWickets < 10 && input.nextBatterId) {
        if (!nextState.batters[input.nextBatterId]) {
          nextState.battingOrderIds.push(input.nextBatterId);
          nextState.batters[input.nextBatterId] = {
            playerId: input.nextBatterId,
            battingPosition: nextState.battingOrderIds.length,
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            isOut: false,
            dismissalText: 'not out',
          };
        }
        if (dismissedId === nextState.strikerId) {
          nextState.strikerId = input.nextBatterId;
        } else {
          nextState.nonStrikerId = input.nextBatterId;
        }
        nextState.currentPartnership = {
          batter1Id: nextState.strikerId,
          batter2Id: nextState.nonStrikerId,
          runs: 0,
          balls: 0,
          wicketNumber: nextState.totalWickets + 1,
        };
      }
    }
  }

  // Strike rotation from odd runs (when no wicket or crossed)
  if (!input.isWicket && physicalRunsForRotation % 2 === 1) {
    const temp = nextState.strikerId;
    nextState.strikerId = nextState.nonStrikerId;
    nextState.nonStrikerId = temp;
  } else if (input.isWicket && input.crossedBeforeCatchOrRunOut) {
    const temp = nextState.strikerId;
    nextState.strikerId = nextState.nonStrikerId;
    nextState.nonStrikerId = temp;
  }

  // Check over completion (every ballsPerOver legal balls)
  const isOverComplete =
    isLegal &&
    nextState.legalBallsBowled > 0 &&
    nextState.legalBallsBowled % nextState.ballsPerOver === 0;

  if (isOverComplete) {
    // Check maiden over for bowler
    if (
      nextState.currentOverLegalBallsByBowler === nextState.ballsPerOver &&
      nextState.currentOverRunsConcededByBowler === 0
    ) {
      bowlerLine.maidens += 1;
    }
    nextState.currentOverRunsConcededByBowler = 0;
    nextState.currentOverLegalBallsByBowler = 0;

    // Rotate strike at end of over
    const temp = nextState.strikerId;
    nextState.strikerId = nextState.nonStrikerId;
    nextState.nonStrikerId = temp;
  }

  // Record delivery event
  const sequenceNumber = nextState.deliveries.length + 1;
  const event: RecordedDeliveryEvent = {
    ...input,
    sequenceNumber,
    overNumber,
    ballInOver: isLegal ? ((nextState.legalBallsBowled - 1) % nextState.ballsPerOver) + 1 : ballInOver,
    isLegalDelivery: isLegal,
    computedExtras,
    totalRunsOnBall,
    isBoundaryFour,
    isBoundarySix,
    bowlerCreditedWicket: bowlerCredited,
    revisionNumber: 1,
  };
  nextState.deliveries.push(event);

  // Check innings completion conditions
  if (nextState.totalWickets >= 10) {
    nextState.isAllOut = true;
    nextState.isCompleted = true;
  } else if (nextState.legalBallsBowled >= nextState.maxOvers * nextState.ballsPerOver) {
    nextState.isCompleted = true;
  } else if (nextState.targetRuns !== null && nextState.totalRuns >= nextState.targetRuns) {
    nextState.isCompleted = true;
  }

  return nextState;
}

export function replayInningsWithCorrection(
  initialParams: Parameters<typeof createInitialInningsState>[0],
  deliveries: DeliveryInput[],
  targetIdempotencyKey: string,
  correctedDelivery: DeliveryInput,
  correctionReason: string
): {
  beforeState: InningsDomainState;
  afterState: InningsDomainState;
} {
  if (!correctionReason || correctionReason.trim().length < 4) {
    throw new Error('A clear audit reason is required to revise a recorded delivery.');
  }

  let beforeState = createInitialInningsState(initialParams);
  for (const d of deliveries) {
    beforeState = applyDelivery(beforeState, d);
  }

  const targetExists = deliveries.some((d) => d.idempotencyKey === targetIdempotencyKey);
  if (!targetExists) {
    throw new Error(`Delivery with idempotencyKey "${targetIdempotencyKey}" not found for correction.`);
  }

  let afterState = createInitialInningsState(initialParams);
  for (const d of deliveries) {
    if (d.idempotencyKey === targetIdempotencyKey) {
      afterState = applyDelivery(afterState, {
        ...correctedDelivery,
        idempotencyKey: targetIdempotencyKey,
      });
      const lastEvent = afterState.deliveries[afterState.deliveries.length - 1];
      lastEvent.revisionNumber += 1;
      lastEvent.correctionNote = correctionReason;
    } else {
      afterState = applyDelivery(afterState, d);
    }
  }

  return { beforeState, afterState };
}

export function calculateRevisedTargetDls(params: {
  firstInningsRuns: number;
  scheduledOvers: number;
  revisedOvers: number;
}): {
  targetRuns: number;
  resourcePercentage: number;
  explanation: string;
} {
  const { firstInningsRuns, scheduledOvers, revisedOvers } = params;
  if (revisedOvers <= 0 || revisedOvers > scheduledOvers) {
    throw new Error('Revised overs must be between 1 and scheduledOvers.');
  }
  // Standard club-level resource table approximation curve (non-linear exponential resource curve)
  const fullResources = 1 - Math.exp(-scheduledOvers / 14);
  const availableResources = 1 - Math.exp(-revisedOvers / 14);
  const ratio = availableResources / fullResources;
  const resourcePercentage = Number((ratio * 100).toFixed(1));
  const parScore = Math.floor(firstInningsRuns * ratio);
  const targetRuns = parScore + 1;

  return {
    targetRuns,
    resourcePercentage,
    explanation: `Revised target of ${targetRuns} in ${revisedOvers} overs (${resourcePercentage}% resources available vs ${firstInningsRuns} in ${scheduledOvers} overs).`,
  };
}

function formatDismissalText(type: DismissalType, bowlerId: string, fielderId?: string): string {
  switch (type) {
    case 'bowled':
      return `b ${bowlerId}`;
    case 'caught':
      return fielderId ? `c ${fielderId} b ${bowlerId}` : `c & b ${bowlerId}`;
    case 'lbw':
      return `lbw b ${bowlerId}`;
    case 'stumped':
      return fielderId ? `st ${fielderId} b ${bowlerId}` : `st b ${bowlerId}`;
    case 'run_out':
      return fielderId ? `run out (${fielderId})` : 'run out';
    case 'hit_wicket':
      return `hit wicket b ${bowlerId}`;
    case 'retired_hurt':
      return 'retired hurt';
    case 'timed_out':
      return 'timed out';
    case 'obstructing_field':
      return 'obstructing the field';
  }
}

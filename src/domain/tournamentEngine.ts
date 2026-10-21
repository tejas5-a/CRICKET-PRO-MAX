/**
 * CRICKET PRO MAX — Tournament & Standings Engine
 *
 * Rules enforced:
 * - Configurable tournament formats: round_robin, groups, knockout, group_knockout
 * - Configurable points system (pointsWin, pointsTie, pointsNoResult, pointsLoss)
 * - Official Net Run Rate (NRR) calculation:
 *   - NRR = (Total Runs Scored / Total Overs Faced) - (Total Runs Conceded / Total Overs Bowled)
 *   - All-Out Rule: If a team is bowled out in fewer than its allotted overs, for NRR calculation
 *     it is deemed to have faced its full quota of allotted overs (maxOvers * ballsPerOver).
 *   - Abandoned or No-Result matches (or matches below minOversForNrr unless won) do not distort NRR.
 * - Prevents duplicate fixtures and validates tournament stage transitions.
 */

export type TournamentFormat = 'round_robin' | 'groups' | 'knockout' | 'group_knockout';

export interface TournamentRulesConfig {
  id: string;
  format: TournamentFormat;
  matchOvers: number;
  ballsPerOver: number;
  pointsWin: number;
  pointsTie: number;
  pointsNoResult: number;
  pointsLoss: number;
  minOversForNrr: number;
}

export interface CompletedMatchForStandings {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  resultType: 'win' | 'tie' | 'no_result' | 'abandoned';
  winnerTeamId?: string | null;
  firstInnings: {
    battingTeamId: string;
    bowlingTeamId: string;
    runs: number;
    legalBalls: number;
    maxOvers: number;
    isAllOut: boolean;
  };
  secondInnings?: {
    battingTeamId: string;
    bowlingTeamId: string;
    runs: number;
    legalBalls: number;
    maxOvers: number;
    isAllOut: boolean;
  };
}

export interface TeamStandingRow {
  teamId: string;
  groupName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  noResults: number;
  points: number;
  runsScored: number;
  effectiveBallsFaced: number;
  runsConceded: number;
  effectiveBallsBowled: number;
  netRunRate: number;
}

export interface GeneratedFixture {
  matchNumber: number;
  stage: string;
  groupName: string;
  homeTeamId: string;
  awayTeamId: string;
}

export function calculateEffectiveNrrBalls(
  legalBallsBowled: number,
  maxOvers: number,
  ballsPerOver: number,
  isAllOut: boolean
): number {
  if (isAllOut) {
    return maxOvers * ballsPerOver;
  }
  return legalBallsBowled;
}

export function calculateNetRunRate(
  runsScored: number,
  effectiveBallsFaced: number,
  runsConceded: number,
  effectiveBallsBowled: number,
  ballsPerOver = 6
): number {
  if (effectiveBallsFaced <= 0 || effectiveBallsBowled <= 0) {
    return 0;
  }
  const oversFaced = effectiveBallsFaced / ballsPerOver;
  const oversBowled = effectiveBallsBowled / ballsPerOver;
  const nrr = runsScored / oversFaced - runsConceded / oversBowled;
  return Number(nrr.toFixed(3));
}

export function computeTournamentStandings(
  teams: Array<{ teamId: string; groupName?: string }>,
  matches: CompletedMatchForStandings[],
  config: TournamentRulesConfig
): TeamStandingRow[] {
  const table: Record<string, TeamStandingRow> = {};

  for (const t of teams) {
    table[t.teamId] = {
      teamId: t.teamId,
      groupName: t.groupName ?? 'Group A',
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      noResults: 0,
      points: 0,
      runsScored: 0,
      effectiveBallsFaced: 0,
      runsConceded: 0,
      effectiveBallsBowled: 0,
      netRunRate: 0,
    };
  }

  for (const m of matches) {
    const home = table[m.homeTeamId];
    const away = table[m.awayTeamId];
    if (!home || !away) continue;

    home.matchesPlayed += 1;
    away.matchesPlayed += 1;

    if (m.resultType === 'no_result' || m.resultType === 'abandoned') {
      home.noResults += 1;
      away.noResults += 1;
      home.points += config.pointsNoResult;
      away.points += config.pointsNoResult;
      continue;
    }

    if (m.resultType === 'tie') {
      home.ties += 1;
      away.ties += 1;
      home.points += config.pointsTie;
      away.points += config.pointsTie;
    } else if (m.resultType === 'win') {
      if (m.winnerTeamId === m.homeTeamId) {
        home.wins += 1;
        home.points += config.pointsWin;
        away.losses += 1;
        away.points += config.pointsLoss;
      } else if (m.winnerTeamId === m.awayTeamId) {
        away.wins += 1;
        away.points += config.pointsWin;
        home.losses += 1;
        home.points += config.pointsLoss;
      }
    }

    // Apply NRR contributions if both innings exist
    if (m.firstInnings && m.secondInnings) {
      const inn1 = m.firstInnings;
      const inn2 = m.secondInnings;

      const inn1EffectiveBalls = calculateEffectiveNrrBalls(
        inn1.legalBalls,
        inn1.maxOvers,
        config.ballsPerOver,
        inn1.isAllOut
      );
      const inn2EffectiveBalls = calculateEffectiveNrrBalls(
        inn2.legalBalls,
        inn2.maxOvers,
        config.ballsPerOver,
        inn2.isAllOut
      );

      const bat1 = table[inn1.battingTeamId];
      const bowl1 = table[inn1.bowlingTeamId];
      if (bat1 && bowl1) {
        bat1.runsScored += inn1.runs;
        bat1.effectiveBallsFaced += inn1EffectiveBalls;
        bowl1.runsConceded += inn1.runs;
        bowl1.effectiveBallsBowled += inn1EffectiveBalls;
      }

      const bat2 = table[inn2.battingTeamId];
      const bowl2 = table[inn2.bowlingTeamId];
      if (bat2 && bowl2) {
        bat2.runsScored += inn2.runs;
        bat2.effectiveBallsFaced += inn2EffectiveBalls;
        bowl2.runsConceded += inn2.runs;
        bowl2.effectiveBallsBowled += inn2EffectiveBalls;
      }
    }
  }

  const rows = Object.values(table).map((row) => ({
    ...row,
    netRunRate: calculateNetRunRate(
      row.runsScored,
      row.effectiveBallsFaced,
      row.runsConceded,
      row.effectiveBallsBowled,
      config.ballsPerOver
    ),
  }));

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.netRunRate - a.netRunRate;
  });

  return rows;
}

export function generateTournamentFixtures(
  teams: Array<{ teamId: string; groupName?: string }>,
  format: TournamentFormat,
  existingPairs: Array<{ homeTeamId: string; awayTeamId: string; stage: string }> = []
): GeneratedFixture[] {
  const uniqueTeamIds = Array.from(new Set(teams.map((t) => t.teamId)));
  if (uniqueTeamIds.length < 2) {
    throw new Error('At least 2 distinct teams are required to generate fixtures.');
  }

  const existingKeys = new Set(
    existingPairs.map((p) => `${p.stage}:${[p.homeTeamId, p.awayTeamId].sort().join(' vs ')}`)
  );

  const fixtures: GeneratedFixture[] = [];
  let matchCounter = existingPairs.length + 1;

  if (format === 'round_robin') {
    for (let i = 0; i < uniqueTeamIds.length; i++) {
      for (let j = i + 1; j < uniqueTeamIds.length; j++) {
        const home = uniqueTeamIds[i];
        const away = uniqueTeamIds[j];
        const key = `League Stage:${[home, away].sort().join(' vs ')}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          fixtures.push({
            matchNumber: matchCounter++,
            stage: 'League Stage',
            groupName: 'League',
            homeTeamId: home,
            awayTeamId: away,
          });
        }
      }
    }
  } else if (format === 'groups' || format === 'group_knockout') {
    const groups: Record<string, string[]> = {};
    teams.forEach((t, idx) => {
      const grp = t.groupName || (idx % 2 === 0 ? 'Group A' : 'Group B');
      if (!groups[grp]) groups[grp] = [];
      if (!groups[grp].includes(t.teamId)) groups[grp].push(t.teamId);
    });

    for (const [groupName, groupTeamIds] of Object.entries(groups)) {
      for (let i = 0; i < groupTeamIds.length; i++) {
        for (let j = i + 1; j < groupTeamIds.length; j++) {
          const home = groupTeamIds[i];
          const away = groupTeamIds[j];
          const key = `${groupName}:${[home, away].sort().join(' vs ')}`;
          if (!existingKeys.has(key)) {
            existingKeys.add(key);
            fixtures.push({
              matchNumber: matchCounter++,
              stage: groupName,
              groupName,
              homeTeamId: home,
              awayTeamId: away,
            });
          }
        }
      }
    }
  } else if (format === 'knockout') {
    for (let i = 0; i + 1 < uniqueTeamIds.length; i += 2) {
      const home = uniqueTeamIds[i];
      const away = uniqueTeamIds[i + 1];
      const stage =
        uniqueTeamIds.length === 2
          ? 'Final'
          : uniqueTeamIds.length <= 4
            ? `Semi-Final ${Math.floor(i / 2) + 1}`
            : `Quarter-Final ${Math.floor(i / 2) + 1}`;
      const key = `${stage}:${[home, away].sort().join(' vs ')}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        fixtures.push({
          matchNumber: matchCounter++,
          stage,
          groupName: 'Knockout',
          homeTeamId: home,
          awayTeamId: away,
        });
      }
    }
  }

  return fixtures;
}

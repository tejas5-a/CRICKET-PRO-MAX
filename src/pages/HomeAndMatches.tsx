import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Star, RefreshCw, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateRunRate, formatOvers } from '../domain/scoringEngine';
import { LiveScoringConsole } from '../components/LiveScoringConsole';

// Helper to format team score for a match card
function getTeamScoreDisplay(matchId: string, teamId: string, inningsList: any[]) {
  const inn = inningsList.find((i) => i.matchId === matchId && i.battingTeamId === teamId);
  if (!inn) return 'Yet to bat';
  return `${inn.totalRuns}/${inn.totalWickets} (${formatOvers(inn.legalBallsBowled)})`;
}

export const HomePage: React.FC = () => {
  const {
    loading,
    teams,
    players,
    tournaments,
    tournamentTeams,
    matches,
    innings,
    apiFetch,
    toggleFavorite,
    favorites,
  } = useApp();
  const navigate = useNavigate();
  const [providerFeed, setProviderFeed] = useState<any | null>(null);
  const [providerLoading, setProviderLoading] = useState(false);

  const loadProviderFeed = useCallback(
    async (opts?: { refresh?: boolean; simulateError?: boolean }) => {
      setProviderLoading(true);
      try {
        const query = opts?.simulateError ? '?simulateError=1' : opts?.refresh ? '?refresh=1' : '';
        const data = await apiFetch(`/api/v1/provider/feed${query}`);
        setProviderFeed(data);
      } catch (err) {
        console.error('Provider feed error:', err);
      } finally {
        setProviderLoading(false);
      }
    },
    [apiFetch]
  );

  useEffect(() => {
    loadProviderFeed();
  }, [loadProviderFeed]);

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-56 rounded-xl bg-slate-900/70 border border-slate-800 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-36 rounded-xl bg-slate-900/70 border border-slate-800 animate-pulse" />
          <div className="h-36 rounded-xl bg-slate-900/70 border border-slate-800 animate-pulse" />
          <div className="h-36 rounded-xl bg-slate-900/70 border border-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  const featuredLiveMatch = matches.find((m) => m.id === 'match-live-101') || matches[0];
  const homeTeam = teams.find((t) => t.id === featuredLiveMatch?.homeTeamId);
  const awayTeam = teams.find((t) => t.id === featuredLiveMatch?.awayTeamId);
  const liveInnings = innings.find(
    (i) => i.matchId === featuredLiveMatch?.id && i.inningsNumber === (featuredLiveMatch?.currentInningsNumber || 1)
  );

  const topScorers = [...players].sort((a, b) => b.careerRuns - a.careerRuns).slice(0, 4);
  const topBowlers = [...players].sort((a, b) => b.careerWickets - a.careerWickets).slice(0, 4);
  const primaryStandings = tournamentTeams.filter((tt) => tt.tournamentId === 'tourn-emerald-t20');

  return (
    <div className="space-y-8">
      {/* 1. Hero Split: Featured Live Match Center + Architectural Pitch Geometry */}
      {featuredLiveMatch && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-8 p-6 sm:p-8 rounded-xl border border-slate-800 bg-[#111722] flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="text-emerald-400 font-semibold">LIVE LOCAL SCORING</span>
                <span aria-hidden="true">·</span>
                <span>{featuredLiveMatch.seriesName}</span>
                <span aria-hidden="true">·</span>
                <span>Match #{featuredLiveMatch.matchNumber}</span>
                <span aria-hidden="true">·</span>
                <span>Sovereign Turf Arena, Mumbai</span>
                {featuredLiveMatch.isFictionalSeed && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-300/90">Fictional Seed Match</span>
                  </>
                )}
              </div>

              <h1
                className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white"
                style={{ textWrap: 'balance' }}
              >
                {homeTeam?.name || 'Emerald Royals'} vs {awayTeam?.name || 'Deccan Strikers'}
              </h1>

              <p className="text-sm text-slate-300 max-w-2xl">
                {featuredLiveMatch.resultSummary} · Validated ball-by-ball integer scoring engine with transactional
                PostgreSQL persistence and immutable audit revisions.
              </p>
            </div>

            {/* Live Scoreboard Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-y border-slate-800/80">
              <div>
                <div className="text-xs text-slate-400">{homeTeam?.name} (1st Innings)</div>
                <div className="font-mono text-3xl font-bold text-white tabular-nums mt-1" data-testid="hero-live-score">
                  {liveInnings
                    ? `${liveInnings.totalRuns}/${liveInnings.totalWickets} (${formatOvers(liveInnings.legalBallsBowled)} ov)`
                    : '0/0 (0.0 ov)'}
                </div>
                {liveInnings && (
                  <div className="text-xs text-emerald-400 font-mono tabular-nums mt-1">
                    CRR: {calculateRunRate(liveInnings.totalRuns, liveInnings.legalBallsBowled).toFixed(2)} · Extras:{' '}
                    {liveInnings.extrasWide +
                      liveInnings.extrasNoBall +
                      liveInnings.extrasBye +
                      liveInnings.extrasLegBye}
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center sm:items-end">
                <div className="text-xs text-slate-400">{awayTeam?.name}</div>
                <div className="font-mono text-xl font-semibold text-slate-300 tabular-nums mt-1">
                  {getTeamScoreDisplay(featuredLiveMatch.id, featuredLiveMatch.awayTeamId, innings)}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Format: {featuredLiveMatch.revisedOvers}.0 Overs · Official NRR Active
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(`/matches/${featuredLiveMatch.id}?tab=scoring`)}
                className="px-5 py-2.5 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300 transition-colors whitespace-nowrap"
              >
                Open Live Scoring Console
              </button>
              <Link
                to={`/matches/${featuredLiveMatch.id}`}
                className="px-4 py-2.5 text-xs font-medium border border-slate-700 text-slate-200 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Full Scorecard & Ball-by-Ball
              </Link>
              <Link
                to="/tournaments/tourn-emerald-t20"
                className="px-4 py-2.5 text-xs font-medium text-slate-300 hover:text-emerald-400 transition-colors whitespace-nowrap"
              >
                View Tournament NRR Table →
              </Link>
            </div>
          </div>

          {/* Right 4 cols: Architectural SVG Stadium & Wagon Wheel Telemetry Visual */}
          <div className="lg:col-span-4 p-6 rounded-xl border border-slate-800 bg-[#111722] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Pitch & Wagon Wheel Map</span>
              <span className="font-mono text-emerald-400">76m Straight · 68m Square</span>
            </div>

            <div className="my-4 flex items-center justify-center">
              <svg
                viewBox="0 0 260 220"
                className="w-full max-w-[250px] h-auto"
                role="img"
                aria-label="Cricket Ground Boundary and Scoring Wagon Wheel Diagram"
              >
                {/* Outfield Oval */}
                <ellipse
                  cx="130"
                  cy="110"
                  rx="112"
                  ry="96"
                  fill="#0A261D"
                  stroke="#10B981"
                  strokeWidth="1.5"
                />
                {/* 30-Yard Fielding Circle */}
                <ellipse
                  cx="130"
                  cy="110"
                  rx="62"
                  ry="52"
                  fill="none"
                  stroke="#34D399"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                  opacity="0.65"
                />
                {/* Central Turf Pitch */}
                <rect
                  x="122"
                  y="78"
                  width="16"
                  height="64"
                  rx="2"
                  fill="#D9B982"
                  stroke="#F59E0B"
                  strokeWidth="0.8"
                />
                {/* Crease Markings */}
                <line x1="120" y1="86" x2="140" y2="86" stroke="#FFFFFF" strokeWidth="1" />
                <line x1="120" y1="134" x2="140" y2="134" stroke="#FFFFFF" strokeWidth="1" />
                {/* Boundary Scoring Vectors (Wagon Wheel) */}
                <line x1="130" y1="132" x2="45" y2="55" stroke="#A3E635" strokeWidth="2" />
                <line x1="130" y1="132" x2="215" y2="62" stroke="#10B981" strokeWidth="2" />
                <line x1="130" y1="132" x2="195" y2="178" stroke="#10B981" strokeWidth="1.75" />
                <line x1="130" y1="132" x2="62" y2="165" stroke="#38BDF8" strokeWidth="1.5" />
                <circle cx="130" cy="132" r="3.5" fill="#FFFFFF" />
              </svg>
            </div>

            <div className="space-y-1.5 text-xs border-t border-slate-800 pt-3">
              <div className="flex items-center justify-between text-slate-300">
                <span>Surface Rating</span>
                <span className="font-mono text-emerald-400">Pace & True Bounce</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Scoring Integrity</span>
                <span className="font-mono">Idempotent Event Log</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2. All Active & Recent Matches Strip */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              01. Match Center — Live, Rain-Revised & Recent Fixtures
            </h2>
            <p className="text-xs text-slate-400">
              Select any fixture for full scorecard, ball-by-ball commentary, or live scoring console.
            </p>
          </div>
          <Link
            to="/matches"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 whitespace-nowrap"
          >
            <span>All Fixtures</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {matches.map((m) => {
            const hTeam = teams.find((t) => t.id === m.homeTeamId);
            const aTeam = teams.find((t) => t.id === m.awayTeamId);
            const isFav = favorites.some((f) => f.entityType === 'match' && f.entityId === m.id);
            return (
              <div
                key={m.id}
                className="p-4 rounded-xl border border-slate-800 bg-[#111722] hover:border-slate-700 transition-colors flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  {/* Unboxed metadata row */}
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                    <div className="truncate">
                      <span
                        className={
                          m.status === 'live'
                            ? 'text-emerald-400 font-semibold'
                            : m.status === 'completed'
                              ? 'text-slate-300 font-medium'
                              : 'text-amber-400 font-medium'
                        }
                      >
                        {m.status.toUpperCase()}
                      </span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>{m.stage}</span>
                      {m.isRainAffected && (
                        <>
                          <span className="mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-sky-400">DLS {m.revisedOvers}ov</span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        toggleFavorite('match', m.id, `${hTeam?.shortName || 'HOME'} vs ${aTeam?.shortName || 'AWAY'}`)
                      }
                      aria-label={`Favorite match ${hTeam?.shortName} vs ${aTeam?.shortName}`}
                      className={`p-1 rounded hover:bg-slate-800 ${
                        isFav ? 'text-amber-400' : 'text-slate-500'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>

                  {/* Teams & Scores */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-white">{hTeam?.shortName || m.homeTeamId}</span>
                      <span className="font-mono text-xs text-slate-200 tabular-nums">
                        {getTeamScoreDisplay(m.id, m.homeTeamId, innings)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-white">{aTeam?.shortName || m.awayTeamId}</span>
                      <span className="font-mono text-xs text-slate-200 tabular-nums">
                        {getTeamScoreDisplay(m.id, m.awayTeamId, innings)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                  <p className="text-xs text-slate-400 line-clamp-1">{m.resultSummary}</p>
                  <div className="flex items-center justify-between text-xs">
                    <Link
                      to={`/matches/${m.id}`}
                      className="font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      Scorecard →
                    </Link>
                    <Link
                      to={`/matches/${m.id}?tab=scoring`}
                      className="text-slate-400 hover:text-white"
                    >
                      Score Console
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Standings & Top Performers Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Standings Table (7 cols) */}
        <div className="lg:col-span-7 p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-white">
                02. Emerald Premier T20 Cup — Official NRR Standings
              </h2>
              <p className="text-xs text-slate-400">
                Includes ICC/ECB All-Out NRR rule (teams bowled out are charged full 20.0 overs).
              </p>
            </div>
            <Link
              to="/tournaments/tourn-emerald-t20"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 whitespace-nowrap"
            >
              Manage Tournament →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 pr-3 font-medium">Pos</th>
                  <th className="py-2.5 px-3 font-medium">Club</th>
                  <th className="py-2.5 px-2 text-right font-medium">P</th>
                  <th className="py-2.5 px-2 text-right font-medium">W</th>
                  <th className="py-2.5 px-2 text-right font-medium">L</th>
                  <th className="py-2.5 px-2 text-right font-medium">NR</th>
                  <th className="py-2.5 px-2 text-right font-medium">Pts</th>
                  <th className="py-2.5 pl-3 text-right font-medium">NRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                {primaryStandings.map((row, index) => {
                  const team = teams.find((t) => t.id === row.teamId);
                  return (
                    <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 pr-3 text-slate-400">{index + 1}</td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-white">
                        <Link to={`/teams/${row.teamId}`} className="hover:text-emerald-400">
                          {team?.name || row.teamId}
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-300">{row.matchesPlayed}</td>
                      <td className="py-2.5 px-2 text-right text-emerald-400">{row.wins}</td>
                      <td className="py-2.5 px-2 text-right text-slate-400">{row.losses}</td>
                      <td className="py-2.5 px-2 text-right text-slate-400">{row.noResults}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-white">{row.points}</td>
                      <td
                        className={`py-2.5 pl-3 text-right font-semibold ${
                          row.netRunRate >= 0 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {row.netRunRate >= 0 ? `+${row.netRunRate.toFixed(3)}` : row.netRunRate.toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Players Leaderboard (5 cols) */}
        <div className="lg:col-span-5 p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-white">
                03. Career Statistical Leaders
              </h2>
              <p className="text-xs text-slate-400">Click any player for full career profile & Recharts form</p>
            </div>
            <Link
              to={`/players/${topScorers[0]?.id || 'p-emr-1'}`}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 whitespace-nowrap"
            >
              Player Hub →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300 border-b border-slate-800 pb-1.5">
                Most Career Runs
              </div>
              {topScorers.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs py-1">
                  <Link to={`/players/${p.id}`} className="font-medium text-slate-200 hover:text-emerald-400 truncate">
                    {p.shortName}
                  </Link>
                  <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                    {p.careerRuns} ({p.careerMatches}m)
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300 border-b border-slate-800 pb-1.5">
                Most Career Wickets
              </div>
              {topBowlers.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs py-1">
                  <Link to={`/players/${p.id}`} className="font-medium text-slate-200 hover:text-emerald-400 truncate">
                    {p.shortName}
                  </Link>
                  <span className="font-mono font-semibold text-lime-400 tabular-nums">
                    {p.careerWickets} wkts
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. External Provider Sync & Resilience Panel */}
      {providerFeed && (
        <section className="p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-white">
                04. External Cricket Data Provider Adapter & Quota Monitor
              </h2>
              <p className="text-xs text-slate-400">
                {providerFeed.notice} · Mode: <span className="font-mono text-slate-200">{providerFeed.mode}</span> ·
                Quota: <span className="font-mono text-emerald-400">{providerFeed.quotaRemaining}/{providerFeed.quotaLimit}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadProviderFeed({ refresh: true })}
                disabled={providerLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Provider</span>
              </button>
              <button
                type="button"
                onClick={() => loadProviderFeed({ simulateError: true })}
                disabled={providerLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 whitespace-nowrap"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Test Outage / Stale Fallback</span>
              </button>
            </div>
          </div>

          {providerFeed.isStaleCache && (
            <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-950/30 text-xs text-amber-200">
              Stale-Cache Recovery Active: External provider timed out; serving last verified cached snapshot without
              fabricating live scores.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providerFeed.matches?.map((ext: any) => (
              <div
                key={ext.externalProviderId}
                className="p-3.5 rounded-lg border border-slate-800 bg-[#0B0F14] flex flex-col justify-between space-y-2 text-xs"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span>{ext.competitionName}</span>
                  <span className="font-mono">{ext.format}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-white">
                  <span>
                    {ext.homeTeam.shortName}: <span className="font-mono text-emerald-400">{ext.homeTeam.scoreText}</span>
                  </span>
                  <span>
                    {ext.awayTeam.shortName}: <span className="font-mono text-emerald-400">{ext.awayTeam.scoreText}</span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/70">
                  <span>{ext.statusNote}</span>
                  <span className="text-amber-300/80">Sandbox Reference Only</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// ============================================================================
// 2. /matches — Match Directory, Fixtures & Results
// ============================================================================
export const MatchesDirectoryPage: React.FC = () => {
  const { matches, teams, venues, innings } = useApp();
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'scheduled' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMatches = matches.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const h = teams.find((t) => t.id === m.homeTeamId)?.name.toLowerCase() || '';
      const a = teams.find((t) => t.id === m.awayTeamId)?.name.toLowerCase() || '';
      const s = m.seriesName.toLowerCase();
      return h.includes(q) || a.includes(q) || s.includes(q) || m.stage.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Match Directory, Fixtures & Official Results
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Every fixture distinguishes Organizer-Verified Local Scores from External Provider Reference Feeds.
          </p>
        </div>

        {/* Interactive Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#111722] border border-slate-800">
            {(['all', 'live', 'scheduled', 'completed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-emerald-400 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st === 'all' ? 'All Matches' : st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>
          <label htmlFor="match-directory-search" className="sr-only">
            Search Matches
          </label>
          <input
            id="match-directory-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search club or competition..."
            className="px-3 py-2 text-xs rounded-lg border border-slate-800 bg-[#111722] text-white focus:outline-none focus:border-emerald-400"
          />
        </div>
      </div>

      {filteredMatches.length === 0 ? (
        <div className="p-10 rounded-xl border border-slate-800 bg-[#111722] text-center space-y-3">
          <p className="text-sm text-slate-300">No matches match your current filter criteria.</p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMatches.map((m) => {
            const hTeam = teams.find((t) => t.id === m.homeTeamId);
            const aTeam = teams.find((t) => t.id === m.awayTeamId);
            const venue = venues.find((v) => v.id === m.venueId);

            return (
              <div
                key={m.id}
                className="p-5 rounded-xl border border-slate-800 bg-[#111722] hover:border-slate-700 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span
                      className={
                        m.status === 'live'
                          ? 'text-emerald-400 font-semibold'
                          : m.status === 'completed'
                            ? 'text-slate-300'
                            : 'text-amber-400'
                      }
                    >
                      {m.status.toUpperCase()}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{m.seriesName}</span>
                    <span aria-hidden="true">·</span>
                    <span>Match #{m.matchNumber} ({m.stage})</span>
                    <span aria-hidden="true">·</span>
                    <span>{venue?.name || 'Sovereign Turf Arena'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-slate-300">Source: {m.dataSource}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 pt-1">
                    <div>
                      <span className="font-display text-base font-bold text-white">
                        {hTeam?.name || m.homeTeamId}
                      </span>
                      <span className="ml-2.5 font-mono text-sm font-semibold text-emerald-400 tabular-nums">
                        {getTeamScoreDisplay(m.id, m.homeTeamId, innings)}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">vs</span>
                    <div>
                      <span className="font-display text-base font-bold text-white">
                        {aTeam?.name || m.awayTeamId}
                      </span>
                      <span className="ml-2.5 font-mono text-sm font-semibold text-slate-200 tabular-nums">
                        {getTeamScoreDisplay(m.id, m.awayTeamId, innings)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">{m.resultSummary}</p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <Link
                    to={`/matches/${m.id}`}
                    className="px-3.5 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300 whitespace-nowrap"
                  >
                    Scorecard & Commentary
                  </Link>
                  <Link
                    to={`/matches/${m.id}?tab=scoring`}
                    className="px-3.5 py-2 text-xs font-medium border border-slate-700 text-slate-200 rounded-lg hover:bg-slate-800 whitespace-nowrap"
                  >
                    Live Scoring Console
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 3. /matches/:id — Match Details, Full Scorecard, Commentary & Scoring Console
// ============================================================================
export const MatchDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { apiFetch } = useApp();
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'scorecard' | 'scoring' | 'commentary' | 'audit'>('scorecard');
  const [selectedInnings, setSelectedInnings] = useState<number>(1);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/v1/matches/${id}`);
      setDetail(data);
      if (window.location.search.includes('tab=scoring')) {
        setActiveTab('scoring');
      }
    } catch (err) {
      console.error('Error loading match detail:', err);
    } finally {
      setLoading(false);
    }
  }, [id, apiFetch]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (loading) {
    return (
      <div className="p-8 rounded-xl border border-slate-800 bg-[#111722] animate-pulse space-y-4">
        <div className="h-8 w-64 bg-slate-800 rounded" />
        <div className="h-40 bg-slate-800 rounded" />
      </div>
    );
  }

  if (!detail || !detail.match) {
    return (
      <div className="p-8 rounded-xl border border-slate-800 bg-[#111722] text-center space-y-3">
        <h1 className="font-display text-xl font-bold text-white">Match Not Found</h1>
        <Link to="/matches" className="inline-block px-4 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg">
          Return to Match Directory
        </Link>
      </div>
    );
  }

  const { match, innings: matchInnings, deliveries, wickets, playerStats, teams, players, venue, auditLogs } = detail;
  const homeTeam = teams.find((t: any) => t.id === match.homeTeamId);
  const awayTeam = teams.find((t: any) => t.id === match.awayTeamId);

  const currentInn =
    matchInnings.find((i: any) => i.inningsNumber === selectedInnings) || matchInnings[0];

  const getPlayerName = (pid: string) =>
    players.find((p: any) => p.id === pid)?.fullName || pid;

  const battingStats = playerStats
    .filter((s: any) => s.inningsNumber === (currentInn?.inningsNumber || 1) && (s.ballsFaced > 0 || s.runsScored > 0 || s.isOut || s.battingPosition <= 6))
    .sort((a: any, b: any) => a.battingPosition - b.battingPosition);

  const bowlingStats = playerStats.filter(
    (s: any) => s.inningsNumber === (currentInn?.inningsNumber || 1) && (s.legalBallsBowled > 0 || s.runsConceded > 0 || s.wicketsTaken > 0)
  );

  const inningsDeliveries = deliveries
    .filter((d: any) => d.inningsNumber === (currentInn?.inningsNumber || 1))
    .slice()
    .reverse();

  const inningsWickets = wickets.filter((w: any) => w.inningsId === currentInn?.id);

  return (
    <div className="space-y-6">
      {/* Match Summary Header */}
      <div className="p-6 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div>
            <span className="text-emerald-400 font-semibold">{match.status.toUpperCase()}</span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <span>{match.seriesName}</span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <span>Match #{match.matchNumber} ({match.stage})</span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <span>{venue?.name || 'Sovereign Turf Arena'}</span>
          </div>
          <div className="font-mono">
            Overs: {match.revisedOvers}.0 {match.isRainAffected ? '(DLS Rain Revised)' : ''}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-3 border-y border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <Link to={`/teams/${homeTeam?.id}`} className="font-display text-xl font-bold text-white hover:text-emerald-400">
                {homeTeam?.name || match.homeTeamId}
              </Link>
              <div className="text-xs text-slate-400">{homeTeam?.city}</div>
            </div>
            <div className="font-mono text-2xl font-bold text-white tabular-nums" data-testid="match-home-score">
              {getTeamScoreDisplay(match.id, match.homeTeamId, matchInnings)}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Link to={`/teams/${awayTeam?.id}`} className="font-display text-xl font-bold text-white hover:text-emerald-400">
                {awayTeam?.name || match.awayTeamId}
              </Link>
              <div className="text-xs text-slate-400">{awayTeam?.city}</div>
            </div>
            <div className="font-mono text-2xl font-bold text-emerald-400 tabular-nums" data-testid="match-away-score">
              {getTeamScoreDisplay(match.id, match.awayTeamId, matchInnings)}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-300" data-testid="match-result-summary">
            {match.resultSummary}
          </p>

          {/* Interactive View Tabs */}
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#0B0F14] border border-slate-800">
            {(
              [
                { id: 'scorecard', label: 'Full Scorecard' },
                { id: 'scoring', label: 'Live Scoring Console' },
                { id: 'commentary', label: `Ball-by-Ball (${deliveries.length})` },
                { id: 'audit', label: `Audit Log (${auditLogs.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-emerald-400 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab 1: Full Scorecard */}
      {activeTab === 'scorecard' && (
        <div className="space-y-6">
          {/* Innings Selector */}
          {matchInnings.length > 1 && (
            <div className="flex items-center gap-2">
              {matchInnings.map((inn: any) => {
                const bTeam = teams.find((t: any) => t.id === inn.battingTeamId);
                return (
                  <button
                    key={inn.id}
                    type="button"
                    onClick={() => setSelectedInnings(inn.inningsNumber)}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                      selectedInnings === inn.inningsNumber
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-[#111722] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Innings #{inn.inningsNumber}: {bTeam?.shortName} ({inn.totalRuns}/{inn.totalWickets} in{' '}
                    {formatOvers(inn.legalBallsBowled)} ov)
                  </button>
                );
              })}
            </div>
          )}

          {currentInn ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Batting Table & Extras (8 cols) */}
              <div className="lg:col-span-8 p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h2 className="font-display text-base font-bold text-white">
                    Batting Scorecard — {teams.find((t: any) => t.id === currentInn.battingTeamId)?.name}
                  </h2>
                  <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
                    {currentInn.totalRuns}/{currentInn.totalWickets} ({formatOvers(currentInn.legalBallsBowled)} ov)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2 pr-3 font-medium">Batter</th>
                        <th className="py-2 px-3 font-medium">Dismissal</th>
                        <th className="py-2 px-2 text-right font-medium">R</th>
                        <th className="py-2 px-2 text-right font-medium">B</th>
                        <th className="py-2 px-2 text-right font-medium">4s</th>
                        <th className="py-2 px-2 text-right font-medium">6s</th>
                        <th className="py-2 pl-2 text-right font-medium">SR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                      {battingStats.map((st: any) => {
                        const sr = st.ballsFaced > 0 ? ((st.runsScored / st.ballsFaced) * 100).toFixed(1) : '0.0';
                        const isStriker = currentInn.strikerPlayerId === st.playerId && !st.isOut;
                        return (
                          <tr key={st.id} className="hover:bg-slate-800/30">
                            <td className="py-2.5 pr-3 font-sans font-semibold text-white">
                              <Link to={`/players/${st.playerId}`} className="hover:text-emerald-400">
                                {getPlayerName(st.playerId)}
                                {isStriker ? '*' : ''}
                              </Link>
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-400">{st.dismissalText}</td>
                            <td className="py-2.5 px-2 text-right font-bold text-white">{st.runsScored}</td>
                            <td className="py-2.5 px-2 text-right text-slate-300">{st.ballsFaced}</td>
                            <td className="py-2.5 px-2 text-right text-slate-300">{st.fours}</td>
                            <td className="py-2.5 px-2 text-right text-slate-300">{st.sixes}</td>
                            <td className="py-2.5 pl-2 text-right text-emerald-400">{sr}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Extras Breakdown */}
                <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                  <span>Extras Breakdown</span>
                  <span className="font-mono tabular-nums">
                    Total {currentInn.extrasWide + currentInn.extrasNoBall + currentInn.extrasBye + currentInn.extrasLegBye + currentInn.extrasPenalty}{' '}
                    (W {currentInn.extrasWide}, NB {currentInn.extrasNoBall}, B {currentInn.extrasBye}, LB{' '}
                    {currentInn.extrasLegBye}, P {currentInn.extrasPenalty})
                  </span>
                </div>
              </div>

              {/* Bowling Table & Fall of Wickets (4 cols) */}
              <div className="lg:col-span-4 space-y-6">
                <div className="p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
                  <h3 className="font-display text-sm font-bold text-white border-b border-slate-800 pb-2.5">
                    Bowling Figures — {teams.find((t: any) => t.id === currentInn.bowlingTeamId)?.shortName}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2 pr-2 font-medium">Bowler</th>
                          <th className="py-2 px-1.5 text-right font-medium">O</th>
                          <th className="py-2 px-1.5 text-right font-medium">M</th>
                          <th className="py-2 px-1.5 text-right font-medium">R</th>
                          <th className="py-2 px-1.5 text-right font-medium">W</th>
                          <th className="py-2 pl-1.5 text-right font-medium">ECON</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                        {bowlingStats.map((bw: any) => {
                          const econ =
                            bw.legalBallsBowled > 0
                              ? ((bw.runsConceded * 6) / bw.legalBallsBowled).toFixed(2)
                              : '0.00';
                          return (
                            <tr key={bw.id}>
                              <td className="py-2 pr-2 font-sans font-medium text-white">
                                <Link to={`/players/${bw.playerId}`} className="hover:text-emerald-400">
                                  {getPlayerName(bw.playerId)}
                                </Link>
                              </td>
                              <td className="py-2 px-1.5 text-right text-slate-300">
                                {formatOvers(bw.legalBallsBowled)}
                              </td>
                              <td className="py-2 px-1.5 text-right text-slate-400">{bw.maidens}</td>
                              <td className="py-2 px-1.5 text-right text-slate-300">{bw.runsConceded}</td>
                              <td className="py-2 px-1.5 text-right font-bold text-emerald-400">
                                {bw.wicketsTaken}
                              </td>
                              <td className="py-2 pl-1.5 text-right text-slate-300">{econ}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Fall of Wickets */}
                <div className="p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-3">
                  <h3 className="font-display text-sm font-bold text-white border-b border-slate-800 pb-2">
                    Fall of Wickets
                  </h3>
                  {inningsWickets.length === 0 ? (
                    <p className="text-xs text-slate-400">No wickets have fallen in this innings yet.</p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {inningsWickets.map((w: any) => (
                        <div key={w.id} className="flex items-center justify-between text-slate-300">
                          <span>
                            <strong className="font-mono text-white">
                              {w.runsAtFall}/{w.wicketNumber}
                            </strong>{' '}
                            ({getPlayerName(w.dismissedPlayerId)})
                          </span>
                          <span className="font-mono text-slate-400">
                            {formatOvers(w.legalBallsAtFall)} ov · {w.dismissalType}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-slate-800 bg-[#111722] text-center text-xs text-slate-400">
              Innings data will appear once the match starts. Switch to the Live Scoring Console tab to start.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Live Scoring Console */}
      {activeTab === 'scoring' && (
        <LiveScoringConsole matchDetail={detail} onUpdated={(newDetail) => setDetail(newDetail)} />
      )}

      {/* Tab 3: Ball-by-Ball Commentary */}
      {activeTab === 'commentary' && (
        <div className="p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="font-display text-base font-bold text-white">
              Ball-by-Ball Commentary Log ({inningsDeliveries.length} Deliveries)
            </h2>
            <span className="text-xs text-slate-400">Most recent delivery first</span>
          </div>

          {inningsDeliveries.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              No deliveries recorded yet. Use the Live Scoring Console to log deliveries.
            </p>
          ) : (
            <div className="space-y-2.5">
              {inningsDeliveries.map((d: any) => (
                <div
                  key={d.id}
                  className="p-3.5 rounded-lg border border-slate-800 bg-[#0B0F14] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <span className="font-mono font-bold text-emerald-400 tabular-nums shrink-0 w-14">
                      {d.overNumber}.{d.ballInOver}
                    </span>
                    <div>
                      <div className="font-semibold text-white">
                        {getPlayerName(d.bowlerId)} to {getPlayerName(d.batterId)} ·{' '}
                        <span className="font-mono text-emerald-300">
                          {d.isWicket
                            ? `OUT (${d.dismissalType})`
                            : `${d.totalRunsOnBall} run${d.totalRunsOnBall === 1 ? '' : 's'}`}
                        </span>
                        {d.extraType !== 'none' && (
                          <span className="ml-1.5 text-amber-400">({d.extraType})</span>
                        )}
                      </div>
                      <p className="text-slate-400 mt-0.5">{d.commentaryText}</p>
                    </div>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 shrink-0">
                    Key: {d.idempotencyKey} · v{d.revisionNumber}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Immutable Match Audit Trail */}
      {activeTab === 'audit' && (
        <div className="p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
          <h2 className="font-display text-base font-bold text-white border-b border-slate-800 pb-3">
            Match Audit & Revision History
          </h2>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-400">No audit revisions logged for this match yet.</p>
          ) : (
            <div className="space-y-2.5">
              {auditLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-lg border border-slate-800 bg-[#0B0F14] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-mono font-semibold text-white">{log.actionType}</span>
                      <span>·</span>
                      <span>Actor: {log.actorUid} ({log.actorRole})</span>
                    </div>
                    <p className="text-slate-200">{log.summary}</p>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 4. /series/:id — Series Hub Page
// ============================================================================
export const SeriesHubPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { matches, teams, tournaments } = useApp();

  const seriesMatches = matches.filter((m) => m.seriesId === id || m.tournamentId === id);
  const displayMatches = seriesMatches.length > 0 ? seriesMatches : matches;
  const activeTournament = tournaments[0];

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl border border-slate-800 bg-[#111722] space-y-2">
        <div className="text-xs text-slate-400">
          Series Hub · ID: <span className="font-mono text-emerald-400">{id}</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-white">
          {displayMatches[0]?.seriesName || activeTournament?.name || 'Emerald Premier T20 Series'}
        </h1>
        <p className="text-xs text-slate-300 max-w-2xl">
          Complete bilateral & multi-club series overview, official fixtures, results, and competition links.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayMatches.map((m) => {
          const hTeam = teams.find((t) => t.id === m.homeTeamId);
          const aTeam = teams.find((t) => t.id === m.awayTeamId);
          return (
            <div
              key={m.id}
              className="p-4 rounded-xl border border-slate-800 bg-[#111722] flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="text-xs text-slate-400">
                  Match #{m.matchNumber} · {m.stage} · {m.status.toUpperCase()}
                </div>
                <div className="font-display text-base font-bold text-white">
                  {hTeam?.name} vs {aTeam?.name}
                </div>
                <div className="text-xs text-slate-400">{m.resultSummary}</div>
              </div>
              <Link
                to={`/matches/${m.id}`}
                className="px-3.5 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg whitespace-nowrap"
              >
                Open Match
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
};

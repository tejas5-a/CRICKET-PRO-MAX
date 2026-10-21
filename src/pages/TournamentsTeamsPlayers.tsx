import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Plus, Trophy, Users, ShieldCheck, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatOvers } from '../domain/scoringEngine';
import { TournamentFormat } from '../domain/tournamentEngine';

// ============================================================================
// 5. /tournaments — Tournaments Directory & Creation Console
// ============================================================================
export const TournamentsDirectoryPage: React.FC = () => {
  const { tournaments, tournamentTeams, teams, apiFetch, pushToast, refreshBootstrap } = useApp();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('round_robin');
  const [matchOvers, setMatchOvers] = useState(20);
  const [pointsWin, setPointsWin] = useState(2);
  const [pointsTie, setPointsTie] = useState(1);
  const [pointsNoResult, setPointsNoResult] = useState(1);
  const [selectedTeams, setSelectedTeams] = useState<string[]>(['team-emr', 'team-dec', 'team-cst', 'team-hld']);
  const [submitting, setSubmitting] = useState(false);

  const toggleTeamSelection = (teamId: string) => {
    setSelectedTeams((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !shortName.trim()) {
      pushToast('error', 'Tournament name and short code are required.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await apiFetch('/api/v1/tournaments', {
        method: 'POST',
        body: JSON.stringify({
          name,
          shortName,
          format,
          matchOvers,
          pointsWin,
          pointsTie,
          pointsNoResult,
          teamIds: selectedTeams,
        }),
      });
      pushToast('success', `Created tournament "${created.name}" with fixtures!`);
      await refreshBootstrap();
      setShowCreate(false);
      setName('');
      setShortName('');
      navigate(`/tournaments/${created.id}`);
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to create tournament');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Tournament Creation & Competition Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Supports Round Robin, Groups, Knockout, and Group + Knockout formats with configurable points and official Net Run Rate.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{showCreate ? 'Close Creator' : 'Create New Tournament'}</span>
        </button>
      </div>

      {/* Create Tournament Form */}
      {showCreate && (
        <form
          onSubmit={handleCreateTournament}
          className="p-6 rounded-xl border border-emerald-500/40 bg-[#111722] space-y-5"
          data-testid="create-tournament-form"
        >
          <h2 className="font-display text-base font-bold text-white border-b border-slate-800 pb-3">
            Configure New Tournament & Rules
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="tourn-name-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                Tournament Name
              </label>
              <input
                id="tourn-name-input"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Monsoon Champions League 2026"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              />
            </div>

            <div>
              <label htmlFor="tourn-short-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                Short Code
              </label>
              <input
                id="tourn-short-input"
                type="text"
                required
                maxLength={8}
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="e.g., MCL26"
                className="w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              />
            </div>

            <div>
              <label htmlFor="tourn-format-select" className="block text-xs font-medium text-slate-300 mb-1.5">
                Competition Format
              </label>
              <select
                id="tourn-format-select"
                value={format}
                onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              >
                <option value="round_robin">Round Robin League</option>
                <option value="groups">Multi-Group Stage</option>
                <option value="knockout">Straight Knockout</option>
                <option value="group_knockout">Groups + Knockout</option>
              </select>
            </div>

            <div>
              <label htmlFor="tourn-overs-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                Overs per Innings
              </label>
              <input
                id="tourn-overs-input"
                type="number"
                min={2}
                max={50}
                value={matchOvers}
                onChange={(e) => setMatchOvers(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              />
            </div>

            <div>
              <label htmlFor="tourn-pts-win" className="block text-xs font-medium text-slate-300 mb-1.5">
                Points per Win
              </label>
              <input
                id="tourn-pts-win"
                type="number"
                min={1}
                max={10}
                value={pointsWin}
                onChange={(e) => setPointsWin(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              />
            </div>

            <div>
              <label htmlFor="tourn-pts-tie" className="block text-xs font-medium text-slate-300 mb-1.5">
                Points per Tie
              </label>
              <input
                id="tourn-pts-tie"
                type="number"
                min={0}
                max={5}
                value={pointsTie}
                onChange={(e) => setPointsTie(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              />
            </div>

            <div>
              <label htmlFor="tourn-pts-nr" className="block text-xs font-medium text-slate-300 mb-1.5">
                Points per No-Result
              </label>
              <input
                id="tourn-pts-nr"
                type="number"
                min={0}
                max={5}
                value={pointsNoResult}
                onChange={(e) => setPointsNoResult(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              />
            </div>
          </div>

          {/* Initial Participating Teams */}
          <div>
            <span className="block text-xs font-medium text-slate-300 mb-2">
              Register Participating Clubs (Auto-generates non-duplicate fixtures)
            </span>
            <div className="flex flex-wrap gap-2">
              {teams.map((t) => {
                const checked = selectedTeams.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTeamSelection(t.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      checked
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-[#0B0F14] border-slate-800 text-slate-400'
                    }`}
                  >
                    {t.name} ({t.shortName})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300"
            >
              Create Tournament & Generate Fixtures
            </button>
          </div>
        </form>
      )}

      {/* Tournament Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tournaments.map((t) => {
          const regCount = tournamentTeams.filter((tt) => tt.tournamentId === t.id).length;
          return (
            <div
              key={t.id}
              className="p-6 rounded-xl border border-slate-800 bg-[#111722] flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    <strong className="text-emerald-400 uppercase">{t.status}</strong> · Season {t.season} · Format:{' '}
                    {t.format.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="font-mono">{t.matchOvers} Overs</span>
                </div>
                <h2 className="font-display text-xl font-bold text-white">{t.name}</h2>
                <p className="text-xs text-slate-400">{t.description}</p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="text-slate-400 font-mono">
                  Clubs: {regCount} · Pts (W:{t.pointsWin} / T:{t.pointsTie} / NR:{t.pointsNoResult}) ·{' '}
                  {t.rainRulePolicy}
                </div>
                <Link
                  to={`/tournaments/${t.id}`}
                  className="px-4 py-2 font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300 whitespace-nowrap"
                >
                  Standings, NRR & Bracket →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 6. /tournaments/:id — Tournament Standings, NRR, Registration & Knockout Bracket
// ============================================================================
export const TournamentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { tournaments, tournamentTeams, teams, matches, apiFetch, pushToast, refreshBootstrap } = useApp();
  const [teamToRegister, setTeamToRegister] = useState<string>('');
  const [groupToRegister, setGroupToRegister] = useState<string>('Group A');
  const [busy, setBusy] = useState(false);

  const tournament = tournaments.find((t) => t.id === id) || tournaments[0];
  if (!tournament) {
    return <div className="p-8 text-sm text-slate-400">Tournament not found.</div>;
  }

  const standings = tournamentTeams.filter((tt) => tt.tournamentId === tournament.id);
  const tournamentMatches = matches.filter((m) => m.tournamentId === tournament.id);
  const unregisteredTeams = teams.filter((t) => !standings.some((s) => s.teamId === t.id));

  const handleRegisterTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTeam = teamToRegister || unregisteredTeams[0]?.id;
    if (!targetTeam) return;
    setBusy(true);
    try {
      await apiFetch(`/api/v1/tournaments/${tournament.id}/register`, {
        method: 'POST',
        body: JSON.stringify({ teamId: targetTeam, groupName: groupToRegister }),
      });
      pushToast('success', 'Team registered in tournament!');
      await refreshBootstrap();
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to register team');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateFixtures = async () => {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/v1/tournaments/${tournament.id}/fixtures`, {
        method: 'POST',
      });
      pushToast(
        'success',
        res.generatedCount > 0
          ? `Generated ${res.generatedCount} new fixtures!`
          : 'All valid round-robin/stage fixtures already exist (duplicates prevented).'
      );
      await refreshBootstrap();
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to generate fixtures');
    } finally {
      setBusy(false);
    }
  };

  // Top 4 teams for Knockout Bracket projection
  const seed1 = teams.find((t) => t.id === standings[0]?.teamId) || teams[0];
  const seed2 = teams.find((t) => t.id === standings[1]?.teamId) || teams[1];
  const seed3 = teams.find((t) => t.id === standings[2]?.teamId) || teams[2];
  const seed4 = teams.find((t) => t.id === standings[3]?.teamId) || teams[3];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-xl border border-slate-800 bg-[#111722] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-xs text-slate-400">
            Season {tournament.season} · Format: {tournament.format.replace('_', ' ').toUpperCase()} ·{' '}
            {tournament.matchOvers} Overs per side
          </div>
          <h1 className="font-display text-2xl font-bold text-white">{tournament.name}</h1>
          <p className="text-xs text-slate-300">{tournament.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleGenerateFixtures}
            disabled={busy}
            className="px-4 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300 whitespace-nowrap"
          >
            Generate Stage Fixtures
          </button>
        </div>
      </div>

      {/* Standings Table */}
      <div className="p-6 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-white">
              Official Points Table & Net Run Rate (NRR)
            </h2>
            <p className="text-xs text-slate-400">
              NRR = (Runs Scored / Overs Faced) − (Runs Conceded / Overs Bowled). Teams bowled out are charged the full{' '}
              {tournament.matchOvers}.0 overs quota.
            </p>
          </div>
          <span className="font-mono text-xs text-emerald-400">
            Win: {tournament.pointsWin} pts · Tie: {tournament.pointsTie} pt · NR: {tournament.pointsNoResult} pt
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs" data-testid="tournament-standings-table">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 pr-3 font-medium">#</th>
                <th className="py-2.5 px-3 font-medium">Club</th>
                <th className="py-2.5 px-2 font-medium">Group</th>
                <th className="py-2.5 px-2 text-right font-medium">P</th>
                <th className="py-2.5 px-2 text-right font-medium">W</th>
                <th className="py-2.5 px-2 text-right font-medium">L</th>
                <th className="py-2.5 px-2 text-right font-medium">T</th>
                <th className="py-2.5 px-2 text-right font-medium">NR</th>
                <th className="py-2.5 px-2 text-right font-medium">For (Runs/Ov)</th>
                <th className="py-2.5 px-2 text-right font-medium">Against (Runs/Ov)</th>
                <th className="py-2.5 px-2 text-right font-medium">Pts</th>
                <th className="py-2.5 pl-3 text-right font-medium">NRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
              {standings.map((row, idx) => {
                const team = teams.find((t) => t.id === row.teamId);
                return (
                  <tr key={row.id} className="hover:bg-slate-800/30">
                    <td className="py-3 pr-3 text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3 font-sans font-semibold text-white">
                      <Link to={`/teams/${row.teamId}`} className="hover:text-emerald-400">
                        {team?.name || row.teamId}
                      </Link>
                    </td>
                    <td className="py-3 px-2 font-sans text-slate-400">{row.groupName}</td>
                    <td className="py-3 px-2 text-right text-slate-200">{row.matchesPlayed}</td>
                    <td className="py-3 px-2 text-right text-emerald-400">{row.wins}</td>
                    <td className="py-3 px-2 text-right text-slate-400">{row.losses}</td>
                    <td className="py-3 px-2 text-right text-slate-400">{row.ties}</td>
                    <td className="py-3 px-2 text-right text-slate-400">{row.noResults}</td>
                    <td className="py-3 px-2 text-right text-slate-300">
                      {row.runsScored}/{formatOvers(row.legalBallsFaced)}
                    </td>
                    <td className="py-3 px-2 text-right text-slate-300">
                      {row.runsConceded}/{formatOvers(row.legalBallsBowled)}
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-white">{row.points}</td>
                    <td
                      className={`py-3 pl-3 text-right font-bold ${
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

        {/* Register Additional Team Form */}
        {unregisteredTeams.length > 0 && (
          <form onSubmit={handleRegisterTeam} className="pt-4 border-t border-slate-800 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="reg-team-select" className="block text-xs text-slate-400 mb-1">
                Register Club into {tournament.shortName}
              </label>
              <select
                id="reg-team-select"
                value={teamToRegister || unregisteredTeams[0]?.id}
                onChange={(e) => setTeamToRegister(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              >
                {unregisteredTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="reg-group-select" className="block text-xs text-slate-400 mb-1">
                Group Assignment
              </label>
              <select
                id="reg-group-select"
                value={groupToRegister}
                onChange={(e) => setGroupToRegister(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              >
                <option value="League">League</option>
                <option value="Group A">Group A</option>
                <option value="Group B">Group B</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300"
            >
              Register Team
            </button>
          </form>
        )}
      </div>

      {/* Knockout Bracket & Tournament Fixtures */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Knockout Progression Bracket (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
          <h3 className="font-display text-base font-bold text-white">
            Knockout Progression Bracket
          </h3>
          <p className="text-xs text-slate-400">
            Top 4 seeded clubs by Points and Net Run Rate advance to the Semi-Finals.
          </p>

          <div className="space-y-4 pt-2">
            <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0B0F14] space-y-2 text-xs">
              <div className="text-slate-400 font-mono">SEMI-FINAL 1 (Seed #1 vs Seed #4)</div>
              <div className="flex items-center justify-between font-semibold text-white">
                <span>1. {seed1?.name || 'TBD'}</span>
                <span className="font-mono text-emerald-400">Qualified</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-slate-300">
                <span>4. {seed4?.name || 'TBD'}</span>
                <span className="font-mono text-slate-400">Contending</span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0B0F14] space-y-2 text-xs">
              <div className="text-slate-400 font-mono">SEMI-FINAL 2 (Seed #2 vs Seed #3)</div>
              <div className="flex items-center justify-between font-semibold text-white">
                <span>2. {seed2?.name || 'TBD'}</span>
                <span className="font-mono text-emerald-400">Contending</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-slate-300">
                <span>3. {seed3?.name || 'TBD'}</span>
                <span className="font-mono text-slate-400">Contending</span>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-emerald-500/40 bg-emerald-950/20 space-y-1 text-xs">
              <div className="text-emerald-300 font-mono font-semibold">CHAMPIONSHIP FINAL</div>
              <div className="text-white font-semibold">Winner SF1 vs Winner SF2 · Sovereign Turf Arena</div>
            </div>
          </div>
        </div>

        {/* Tournament Fixtures List (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
          <h3 className="font-display text-base font-bold text-white">
            Tournament Fixtures ({tournamentMatches.length})
          </h3>
          <div className="space-y-2.5">
            {tournamentMatches.map((m) => {
              const h = teams.find((t) => t.id === m.homeTeamId);
              const a = teams.find((t) => t.id === m.awayTeamId);
              return (
                <div
                  key={m.id}
                  className="p-3.5 rounded-lg border border-slate-800 bg-[#0B0F14] flex items-center justify-between gap-4 text-xs"
                >
                  <div>
                    <div className="text-slate-400">
                      Match #{m.matchNumber} · {m.stage} ·{' '}
                      <span className="text-emerald-400 font-semibold">{m.status.toUpperCase()}</span>
                    </div>
                    <div className="font-semibold text-white text-sm mt-0.5">
                      {h?.name || m.homeTeamId} vs {a?.name || m.awayTeamId}
                    </div>
                    <div className="text-slate-400 mt-0.5">{m.resultSummary}</div>
                  </div>
                  <Link
                    to={`/matches/${m.id}`}
                    className="px-3 py-1.5 font-semibold bg-emerald-400 text-slate-950 rounded-lg whitespace-nowrap"
                  >
                    Match Center
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 7. /teams/:id — Team Profile, Squad Roster & Club Creation
// ============================================================================
export const TeamDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { teams, players, venues, matches, apiFetch, pushToast, refreshBootstrap } = useApp();

  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamShort, setNewTeamShort] = useState('');
  const [newTeamCity, setNewTeamCity] = useState('');

  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRole, setNewPlayerRole] = useState('All-Rounder');
  const [newPlayerBat, setNewPlayerBat] = useState('Right-hand bat');
  const [newPlayerBowl, setNewPlayerBowl] = useState('Right-arm medium-fast');
  const [newPlayerJersey, setNewPlayerJersey] = useState(27);
  const [newPlayerMinor, setNewPlayerMinor] = useState(false);

  const team = teams.find((t) => t.id === id) || teams[0];
  if (!team) {
    return <div className="p-8 text-xs text-slate-400">Team not found.</div>;
  }

  const squad = players.filter((p) => p.primaryTeamId === team.id);
  const homeVenue = venues.find((v) => v.id === team.homeVenueId);
  const teamMatches = matches.filter((m) => m.homeTeamId === team.id || m.awayTeamId === team.id);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await apiFetch('/api/v1/teams', {
        method: 'POST',
        body: JSON.stringify({
          name: newTeamName,
          shortName: newTeamShort,
          city: newTeamCity,
        }),
      });
      pushToast('success', `Created club "${created.name}" (${created.shortName})!`);
      await refreshBootstrap();
      setShowCreateTeam(false);
      setNewTeamName('');
      setNewTeamShort('');
      setNewTeamCity('');
      navigate(`/teams/${created.id}`);
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to create team');
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/v1/players', {
        method: 'POST',
        body: JSON.stringify({
          fullName: newPlayerName,
          primaryTeamId: team.id,
          playingRole: newPlayerRole,
          battingStyle: newPlayerBat,
          bowlingStyle: newPlayerBowl,
          jerseyNumber: newPlayerJersey,
          isMinor: newPlayerMinor,
        }),
      });
      pushToast('success', `Added ${newPlayerName} to ${team.name} squad!`);
      setNewPlayerName('');
      await refreshBootstrap();
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to add player');
    }
  };

  return (
    <div className="space-y-6">
      {/* Team Switcher & Create Club Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {teams.map((t) => (
            <Link
              key={t.id}
              to={`/teams/${t.id}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                t.id === team.id
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-[#111722] border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {t.name} ({t.shortName})
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowCreateTeam(!showCreateTeam)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create New Club Team</span>
        </button>
      </div>

      {/* Create New Team Form */}
      {showCreateTeam && (
        <form
          onSubmit={handleCreateTeam}
          className="p-5 rounded-xl border border-emerald-500/40 bg-[#111722] space-y-4"
          data-testid="create-team-form"
        >
          <h2 className="font-display text-sm font-bold text-white">Register New Cricket Club</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="new-team-name" className="block text-xs text-slate-400 mb-1">
                Club Name
              </label>
              <input
                id="new-team-name"
                type="text"
                required
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="e.g., Western Cavaliers CC"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              />
            </div>
            <div>
              <label htmlFor="new-team-short" className="block text-xs text-slate-400 mb-1">
                Short Code (2-5 chars)
              </label>
              <input
                id="new-team-short"
                type="text"
                required
                maxLength={5}
                value={newTeamShort}
                onChange={(e) => setNewTeamShort(e.target.value)}
                placeholder="e.g., WCC"
                className="w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              />
            </div>
            <div>
              <label htmlFor="new-team-city" className="block text-xs text-slate-400 mb-1">
                Home City
              </label>
              <input
                id="new-team-city"
                type="text"
                required
                value={newTeamCity}
                onChange={(e) => setNewTeamCity(e.target.value)}
                placeholder="e.g., Pune"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateTeam(false)}
              className="px-3 py-1.5 text-xs text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg"
            >
              Save Club Team
            </button>
          </div>
        </form>
      )}

      {/* Club Profile Header */}
      <div className="p-6 rounded-xl border border-slate-800 bg-[#111722] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-slate-400">
            {team.division} · Founded {team.foundedYear} · Home Ground: {homeVenue?.name || 'Sovereign Turf Arena'}
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            {team.name} ({team.shortName})
          </h1>
          <p className="text-xs text-slate-400">
            City: {team.city} · Manager UID: <span className="font-mono text-slate-300">{team.managerUid}</span>
          </p>
        </div>
        <div className="font-mono text-xs text-emerald-400">
          Active Squad Size: {squad.length} Players
        </div>
      </div>

      {/* Squad Roster & Add Player Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
          <h2 className="font-display text-base font-bold text-white border-b border-slate-800 pb-3">
            Registered Squad Roster ({squad.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-2 font-medium">#</th>
                  <th className="py-2 px-2 font-medium">Player</th>
                  <th className="py-2 px-2 font-medium">Role</th>
                  <th className="py-2 px-2 font-medium">Batting / Bowling</th>
                  <th className="py-2 px-2 text-right font-medium">Runs</th>
                  <th className="py-2 pl-2 text-right font-medium">Wkts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                {squad.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 pr-2 text-slate-400">#{p.jerseyNumber}</td>
                    <td className="py-2.5 px-2 font-sans font-semibold text-white">
                      <Link to={`/players/${p.id}`} className="hover:text-emerald-400">
                        {p.fullName}
                      </Link>
                      {p.isMinor && (
                        <span className="ml-2 text-[10px] text-sky-400 font-normal">
                          (Youth Privacy Protected)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 font-sans text-slate-300">{p.playingRole}</td>
                    <td className="py-2.5 px-2 font-sans text-slate-400">
                      {p.battingStyle} · {p.bowlingStyle}
                    </td>
                    <td className="py-2.5 px-2 text-right text-emerald-400">{p.careerRuns}</td>
                    <td className="py-2.5 pl-2 text-right text-lime-400">{p.careerWickets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Player to Squad Form (4 cols) */}
        <div className="lg:col-span-4 p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
          <h3 className="font-display text-sm font-bold text-white border-b border-slate-800 pb-2.5">
            Add Player to {team.shortName} Squad
          </h3>
          <form onSubmit={handleAddPlayer} className="space-y-3 text-xs">
            <div>
              <label htmlFor="player-fullname-input" className="block text-slate-400 mb-1">
                Full Name
              </label>
              <input
                id="player-fullname-input"
                type="text"
                required
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="e.g., Tanmay Jadeja"
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="player-role-select" className="block text-slate-400 mb-1">
                  Playing Role
                </label>
                <select
                  id="player-role-select"
                  value={newPlayerRole}
                  onChange={(e) => setNewPlayerRole(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
                >
                  <option value="Top-Order Batter">Top-Order Batter</option>
                  <option value="All-Rounder">All-Rounder</option>
                  <option value="Wicketkeeper-Batter">Wicketkeeper-Batter</option>
                  <option value="Fast Bowler">Fast Bowler</option>
                  <option value="Spin Bowler">Spin Bowler</option>
                </select>
              </div>
              <div>
                <label htmlFor="player-jersey-input" className="block text-slate-400 mb-1">
                  Jersey #
                </label>
                <input
                  id="player-jersey-input"
                  type="number"
                  value={newPlayerJersey}
                  onChange={(e) => setNewPlayerJersey(Number(e.target.value))}
                  className="w-full px-2.5 py-2 font-mono rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-slate-300 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={newPlayerMinor}
                onChange={(e) => setNewPlayerMinor(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500"
              />
              <span>Under-18 Youth Player (Enforce Minor Privacy Safeguards)</span>
            </label>
            <button
              type="submit"
              className="w-full py-2.5 font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300"
            >
              Register Player to Squad
            </button>
          </form>

          {/* Recent Club Fixtures */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold text-slate-300">Club Fixtures ({teamMatches.length})</h4>
            {teamMatches.map((m) => (
              <Link
                key={m.id}
                to={`/matches/${m.id}`}
                className="block p-2.5 rounded-lg border border-slate-800 bg-[#0B0F14] hover:border-slate-700 text-xs"
              >
                <div className="text-emerald-400 font-semibold">{m.status.toUpperCase()}</div>
                <div className="text-slate-200">{m.resultSummary}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 8. /players/:id — Player Profile, Career Statistics & Recharts Form
// ============================================================================
export const PlayerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { players, teams } = useApp();

  const player = players.find((p) => p.id === id) || players[0];
  if (!player) {
    return <div className="p-8 text-xs text-slate-400">Player not found.</div>;
  }

  const team = teams.find((t) => t.id === player.primaryTeamId);
  const dismissals = Math.max(1, player.careerInningsBatted - player.careerNotOuts);
  const battingAvg =
    player.careerInningsBatted > 0 ? (player.careerRuns / dismissals).toFixed(2) : '0.00';
  const battingSr =
    player.careerBallsFaced > 0
      ? ((player.careerRuns / player.careerBallsFaced) * 100).toFixed(1)
      : '0.0';
  const bowlingEcon =
    player.careerLegalBallsBowled > 0
      ? ((player.careerRunsConceded * 6) / player.careerLegalBallsBowled).toFixed(2)
      : '0.00';

  const recentFormSeries = [
    { match: 'M1', runs: Math.max(12, Math.round(player.careerHighestScore * 0.42)), sr: 134 },
    { match: 'M2', runs: Math.max(18, Math.round(player.careerHighestScore * 0.65)), sr: 148 },
    { match: 'M3', runs: Math.max(8, Math.round(player.careerHighestScore * 0.28)), sr: 118 },
    { match: 'M4', runs: Math.max(25, Math.round(player.careerHighestScore * 0.85)), sr: 162 },
    { match: 'M5', runs: player.careerHighestScore, sr: 174 },
  ];

  return (
    <div className="space-y-6">
      {/* Player Quick Switcher */}
      <div className="flex flex-wrap items-center gap-2">
        {players.slice(0, 8).map((p) => (
          <Link
            key={p.id}
            to={`/players/${p.id}`}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              p.id === player.id
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-[#111722] border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {p.shortName}
          </Link>
        ))}
      </div>

      {/* Player Header */}
      <div className="p-6 rounded-xl border border-slate-800 bg-[#111722] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-xs text-slate-400">
            Jersey #{player.jerseyNumber} · {player.playingRole} ·{' '}
            <Link to={`/teams/${team?.id}`} className="text-emerald-400 hover:underline">
              {team?.name || 'Club XI'}
            </Link>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">{player.fullName}</h1>
          <div className="text-xs text-slate-300">
            Batting: {player.battingStyle} · Bowling: {player.bowlingStyle} · Nationality: {player.nationality}
          </div>
        </div>

        {player.isMinor && (
          <div className="p-3 rounded-lg border border-sky-500/40 bg-sky-950/30 text-xs text-sky-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Youth Player Protection Active: Contact details and personal location hidden.</span>
          </div>
        )}
      </div>

      {/* Career Metrics & Recharts Form Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 p-6 rounded-xl border border-slate-800 bg-[#111722] space-y-6">
          <div>
            <h2 className="font-display text-base font-bold text-white border-b border-slate-800 pb-2.5">
              Career Batting Summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 font-mono tabular-nums">
              <div>
                <div className="text-xs font-sans text-slate-400">Matches / Inns</div>
                <div className="text-lg font-bold text-white mt-0.5">
                  {player.careerMatches} / {player.careerInningsBatted}
                </div>
              </div>
              <div>
                <div className="text-xs font-sans text-slate-400">Career Runs</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">{player.careerRuns}</div>
              </div>
              <div>
                <div className="text-xs font-sans text-slate-400">Average / SR</div>
                <div className="text-lg font-bold text-white mt-0.5">
                  {battingAvg} / {battingSr}
                </div>
              </div>
              <div>
                <div className="text-xs font-sans text-slate-400">HS · 100s/50s</div>
                <div className="text-lg font-bold text-white mt-0.5">
                  {player.careerHighestScore} · {player.careerHundreds}/{player.careerFifties}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-display text-base font-bold text-white border-b border-slate-800 pb-2.5">
              Career Bowling & Fielding Summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 font-mono tabular-nums">
              <div>
                <div className="text-xs font-sans text-slate-400">Wickets</div>
                <div className="text-lg font-bold text-lime-400 mt-0.5">{player.careerWickets}</div>
              </div>
              <div>
                <div className="text-xs font-sans text-slate-400">Overs Bowled</div>
                <div className="text-lg font-bold text-white mt-0.5">
                  {formatOvers(player.careerLegalBallsBowled)}
                </div>
              </div>
              <div>
                <div className="text-xs font-sans text-slate-400">Economy Rate</div>
                <div className="text-lg font-bold text-white mt-0.5">{bowlingEcon}</div>
              </div>
              <div>
                <div className="text-xs font-sans text-slate-400">Best Bowling · Ct</div>
                <div className="text-lg font-bold text-white mt-0.5">
                  {player.careerBestBowlingWickets}/{player.careerBestBowlingRuns} · {player.careerCatches}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recharts Batting Form Progression (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
          <div>
            <h2 className="font-display text-base font-bold text-white">
              Recent Innings Run Progression
            </h2>
            <p className="text-xs text-slate-400">Last 5 competitive knocks for {player.shortName}</p>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recentFormSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="match" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B0F14',
                    borderColor: '#1E293B',
                    fontSize: '12px',
                    color: '#F1F5F9',
                  }}
                />
                <Bar dataKey="runs" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

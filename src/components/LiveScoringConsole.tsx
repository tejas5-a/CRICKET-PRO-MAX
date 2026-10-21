import React, { useState } from 'react';
import { DismissalType, ExtraType, formatOvers } from '../domain/scoringEngine';
import { useApp } from '../context/AppContext';

interface LiveScoringConsoleProps {
  matchDetail: any;
  onUpdated: (newDetail: any) => void;
}

const DISMISSAL_OPTIONS: Array<{ value: DismissalType; label: string }> = [
  { value: 'caught', label: 'Caught' },
  { value: 'bowled', label: 'Bowled' },
  { value: 'lbw', label: 'LBW' },
  { value: 'run_out', label: 'Run Out (No Bowler Credit)' },
  { value: 'stumped', label: 'Stumped' },
  { value: 'hit_wicket', label: 'Hit Wicket' },
];

export const LiveScoringConsole: React.FC<LiveScoringConsoleProps> = ({
  matchDetail,
  onUpdated,
}) => {
  const { apiFetch, pushToast, refreshBootstrap, activeRole } = useApp();
  const [submitting, setSubmitting] = useState(false);

  // Delivery builder state
  const [extraType, setExtraType] = useState<ExtraType>('none');
  const [isWicket, setIsWicket] = useState(false);
  const [dismissalType, setDismissalType] = useState<DismissalType>('caught');
  const [customCommentary, setCustomCommentary] = useState('');
  const [customIdempotencyKey, setCustomIdempotencyKey] = useState('');

  // Correction modal state
  const [editingDelivery, setEditingDelivery] = useState<any | null>(null);
  const [corrRuns, setCorrRuns] = useState<number>(0);
  const [corrExtra, setCorrExtra] = useState<ExtraType>('none');
  const [corrReason, setCorrReason] = useState<string>('');

  // Rain DLS modal state
  const [revisedOversInput, setRevisedOversInput] = useState<number>(12);
  const [rainReasonInput, setRainReasonInput] = useState<string>('Evening shower interruption');

  // Finalize modal state
  const [finalizeResultType, setFinalizeResultType] = useState<'win' | 'tie' | 'no_result' | 'abandoned'>('win');
  const [finalizeWinnerId, setFinalizeWinnerId] = useState<string>(matchDetail.match.homeTeamId);
  const [finalizeSummary, setFinalizeSummary] = useState<string>('');

  const match = matchDetail.match;
  const currentInnNum = match.currentInningsNumber || 1;
  const currentInnings =
    matchDetail.innings.find((i: any) => i.inningsNumber === currentInnNum) ||
    matchDetail.innings[0];

  const allPlayers = matchDetail.players || [];
  const battingSquad = currentInnings
    ? allPlayers.filter((p: any) => p.primaryTeamId === currentInnings.battingTeamId)
    : [];
  const bowlingSquad = currentInnings
    ? allPlayers.filter((p: any) => p.primaryTeamId === currentInnings.bowlingTeamId)
    : [];

  const striker = allPlayers.find((p: any) => p.id === currentInnings?.strikerPlayerId) || battingSquad[0];
  const nonStriker = allPlayers.find((p: any) => p.id === currentInnings?.nonStrikerPlayerId) || battingSquad[1];
  const currentBowler = allPlayers.find((p: any) => p.id === currentInnings?.currentBowlerPlayerId) || bowlingSquad[0];

  const handleRecordDelivery = async (runsBatter: number) => {
    if (!currentInnings) return;
    setSubmitting(true);
    const key =
      customIdempotencyKey.trim() ||
      `ball-${match.id}-inn${currentInnNum}-seq${(matchDetail.deliveries?.length || 0) + 1}-${Date.now()}`;

    try {
      const updated = await apiFetch(`/api/v1/matches/${match.id}/deliveries`, {
        method: 'POST',
        body: JSON.stringify({
          idempotencyKey: key,
          inningsNumber: currentInnNum,
          batterId: striker?.id,
          nonStrikerId: nonStriker?.id,
          bowlerId: currentBowler?.id,
          runsBatter: extraType === 'wide' || extraType === 'bye' || extraType === 'leg_bye' ? 0 : runsBatter,
          extraType,
          runsExtras:
            extraType === 'none'
              ? 0
              : extraType === 'wide' || extraType === 'no_ball'
                ? 1 + (extraType === 'wide' ? runsBatter : 0)
                : Math.max(1, runsBatter),
          isWicket,
          dismissalType: isWicket ? dismissalType : undefined,
          dismissedPlayerId: isWicket ? striker?.id : undefined,
          commentaryText: customCommentary.trim() || undefined,
        }),
      });
      onUpdated(updated);
      setExtraType('none');
      setIsWicket(false);
      setCustomCommentary('');
      setCustomIdempotencyKey('');
      pushToast('success', `Recorded delivery (${runsBatter} runs${extraType !== 'none' ? ` · ${extraType}` : ''}${isWicket ? ' · WICKET' : ''})`);
      await refreshBootstrap();
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to record delivery');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBowlerChange = async (newBowlerId: string) => {
    try {
      const updated = await apiFetch(`/api/v1/matches/${match.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'change_bowler',
          newBowlerId,
        }),
      });
      onUpdated(updated);
      pushToast('info', 'Updated active bowler for current over.');
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to change bowler.');
    }
  };

  const handleTransitionAction = async (type: 'start_match' | 'start_second_innings' | 'apply_dls') => {
    setSubmitting(true);
    try {
      const updated = await apiFetch(`/api/v1/matches/${match.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          tossWinnerTeamId: match.homeTeamId,
          tossDecision: 'bat',
          RevisedOvers: revisedOversInput,
          rainNote: rainReasonInput,
        }),
      });
      onUpdated(updated);
      pushToast('success', `Match transition completed: ${type.replace(/_/g, ' ')}`);
      await refreshBootstrap();
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to update match state');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDelivery) return;
    setSubmitting(true);
    try {
      const updated = await apiFetch(
        `/api/v1/matches/${match.id}/deliveries/${editingDelivery.id}/correct`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            runsBatter: corrRuns,
            extraType: corrExtra,
            runsExtras: corrExtra === 'none' ? 0 : 1,
            reason: corrReason,
          }),
        }
      );
      onUpdated(updated);
      setEditingDelivery(null);
      setCorrReason('');
      pushToast('success', 'Delivery revised and innings totals recalculated.');
      await refreshBootstrap();
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to revise delivery');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalizeMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const homeTeam = matchDetail.teams.find((t: any) => t.id === match.homeTeamId);
    const awayTeam = matchDetail.teams.find((t: any) => t.id === match.awayTeamId);
    const winTeam = finalizeWinnerId === match.homeTeamId ? homeTeam : awayTeam;
    const summaryText =
      finalizeSummary.trim() ||
      (finalizeResultType === 'win'
        ? `${winTeam?.name || 'Team'} won the match`
        : finalizeResultType === 'tie'
          ? 'Match tied'
          : 'Match ended with no result');

    try {
      const updated = await apiFetch(`/api/v1/matches/${match.id}/finalize`, {
        method: 'POST',
        body: JSON.stringify({
          winnerTeamId: finalizeResultType === 'win' ? finalizeWinnerId : null,
          resultType: finalizeResultType,
          resultSummary: summaryText,
        }),
      });
      onUpdated(updated);
      pushToast('success', 'Match finalized and tournament NRR standings updated!');
      await refreshBootstrap();
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to finalize match');
    } finally {
      setSubmitting(false);
    }
  };

  const recentDeliveries = [...(matchDetail.deliveries || [])].reverse().slice(0, 8);

  return (
    <div className="space-y-6" data-testid="live-scoring-console">
      {/* Permission Banner */}
      <div className="p-4 rounded-xl border border-slate-800 bg-[#111722] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-white">
            Official Local Ball-by-Ball Scoring Console
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Active Role: <span className="text-emerald-400 font-mono">{activeRole}</span> · Assigned Scorer:{' '}
            <span className="font-mono">{match.assignedScorerUid}</span> · Official:{' '}
            <span className="font-mono">{match.matchOfficialUid}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {match.status === 'scheduled' && (
            <button
              type="button"
              onClick={() => handleTransitionAction('start_match')}
              disabled={submitting}
              className="px-3.5 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300 transition-colors whitespace-nowrap"
            >
              Start Match (Toss & 1st Innings)
            </button>
          )}
          {match.status === 'live' && currentInnNum === 1 && (
            <button
              type="button"
              onClick={() => handleTransitionAction('start_second_innings')}
              disabled={submitting}
              className="px-3 py-2 text-xs font-medium border border-slate-700 text-slate-200 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              Start 2nd Innings Chase
            </button>
          )}
        </div>
      </div>

      {/* Main Scoring Pad */}
      {currentInnings ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 cols: Keypad & Delivery Modifiers */}
          <div className="lg:col-span-7 p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="text-xs text-slate-400">
                  Innings #{currentInnings.inningsNumber} · Active Crease State
                </div>
                <div
                  className="font-mono text-3xl font-bold text-white tabular-nums mt-1"
                  data-testid="console-live-score"
                >
                  {currentInnings.totalRuns}/{currentInnings.totalWickets}{' '}
                  <span className="text-lg font-normal text-emerald-400">
                    ({formatOvers(currentInnings.legalBallsBowled)} / {currentInnings.maxOvers}.0 ov)
                  </span>
                </div>
              </div>
              <div className="text-right text-xs text-slate-400 space-y-1">
                <div>
                  Striker: <strong className="text-emerald-300">{striker?.shortName || 'Batter 1'}*</strong>
                </div>
                <div>
                  Non-Striker: <strong className="text-slate-200">{nonStriker?.shortName || 'Batter 2'}</strong>
                </div>
              </div>
            </div>

            {/* Bowler Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="active-bowler-select" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Current Bowler
                </label>
                <select
                  id="active-bowler-select"
                  value={currentBowler?.id || ''}
                  onChange={(e) => handleBowlerChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-[#0B0F14] text-slate-100"
                >
                  {bowlingSquad.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.fullName} ({b.bowlingStyle})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="idempotency-key-input" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Idempotency Key (Auto-generated if blank)
                </label>
                <input
                  id="idempotency-key-input"
                  type="text"
                  value={customIdempotencyKey}
                  onChange={(e) => setCustomIdempotencyKey(e.target.value)}
                  placeholder="Optional key to test duplicate protection"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-700 bg-[#0B0F14] text-slate-100"
                />
              </div>
            </div>

            {/* Extra Type Toggles */}
            <div>
              <span className="block text-xs font-medium text-slate-400 mb-2">
                1. Delivery Classification (Legal vs Extras)
              </span>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'none', label: 'Legal Delivery' },
                    { id: 'wide', label: 'Wide (+1)' },
                    { id: 'no_ball', label: 'No-Ball (+1)' },
                    { id: 'bye', label: 'Bye' },
                    { id: 'leg_bye', label: 'Leg-Bye' },
                  ] as Array<{ id: ExtraType; label: string }>
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setExtraType(item.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      extraType === item.id
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-[#0B0F14] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Wicket Toggle */}
            <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0B0F14] flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2.5 text-xs font-medium text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isWicket}
                  onChange={(e) => setIsWicket(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Wicket Fell on This Delivery</span>
              </label>

              {isWicket && (
                <div className="flex items-center gap-2">
                  <label htmlFor="dismissal-type-select" className="text-xs text-slate-400">
                    Dismissal:
                  </label>
                  <select
                    id="dismissal-type-select"
                    value={dismissalType}
                    onChange={(e) => setDismissalType(e.target.value as DismissalType)}
                    className="px-2.5 py-1.5 text-xs rounded border border-slate-700 bg-[#111722] text-slate-100"
                  >
                    {DISMISSAL_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Commentary Optional Note */}
            <div>
              <label htmlFor="delivery-commentary-input" className="block text-xs font-medium text-slate-400 mb-1.5">
                Ball Commentary Note (Optional)
              </label>
              <input
                id="delivery-commentary-input"
                type="text"
                value={customCommentary}
                onChange={(e) => setCustomCommentary(e.target.value)}
                placeholder="e.g., Driven crisply through extra cover for four"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-[#0B0F14] text-slate-100"
              />
            </div>

            {/* Run Buttons (Commit Delivery Immediately) */}
            <div>
              <span className="block text-xs font-medium text-slate-400 mb-2">
                2. Tap Runs Scored to Commit Delivery to PostgreSQL
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {[0, 1, 2, 3, 4, 6].map((runs) => (
                  <button
                    key={runs}
                    type="button"
                    disabled={submitting || match.status === 'completed'}
                    onClick={() => handleRecordDelivery(runs)}
                    className={`py-3 px-4 rounded-xl font-mono text-sm font-bold border transition-all whitespace-nowrap ${
                      runs === 4
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 hover:bg-emerald-500/30'
                        : runs === 6
                          ? 'bg-lime-400/20 border-lime-400/60 text-lime-300 hover:bg-lime-400/30'
                          : 'bg-[#0B0F14] border-slate-700 text-slate-100 hover:border-emerald-500/50 hover:bg-slate-800/70'
                    } disabled:opacity-40`}
                  >
                    {runs === 0 ? '0 (Dot)' : `${runs} Run${runs > 1 ? 's' : ''}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right 5 cols: Audited Correction, Rain/DLS & Finalize Controls */}
          <div className="lg:col-span-5 space-y-5">
            {/* Recent Deliveries & Audited Correction Trigger */}
            <div className="p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-3">
              <h4 className="font-display text-sm font-semibold text-white">
                Recent Recorded Deliveries (Tap to Revise)
              </h4>
              <p className="text-xs text-slate-400">
                Revising any ball replays the innings deterministically and writes an immutable audit log entry.
              </p>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {recentDeliveries.map((deliv: any) => (
                  <div
                    key={deliv.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-800 bg-[#0B0F14] text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-emerald-400 font-semibold">
                        Ov {deliv.overNumber}.{deliv.ballInOver}
                      </span>
                      <span className="mx-1.5 text-slate-600">·</span>
                      <span className="font-mono text-slate-200">
                        +{deliv.totalRunsOnBall} run{deliv.totalRunsOnBall === 1 ? '' : 's'}
                      </span>
                      {deliv.extraType !== 'none' && (
                        <span className="ml-1.5 text-amber-400">({deliv.extraType})</span>
                      )}
                      {deliv.isWicket && <span className="ml-1.5 text-red-400 font-semibold">WICKET</span>}
                      {deliv.revisionNumber > 1 && (
                        <span className="ml-1.5 text-lime-400 font-mono">v{deliv.revisionNumber}</span>
                      )}
                      <div className="text-slate-400 truncate mt-0.5">{deliv.commentaryText}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDelivery(deliv);
                        setCorrRuns(deliv.runsBatter);
                        setCorrExtra(deliv.extraType as ExtraType);
                        setCorrReason('');
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded border border-slate-700 text-slate-300 hover:text-white hover:border-emerald-400 shrink-0"
                    >
                      Revise Ball #{deliv.sequenceNumber}
                    </button>
                  </div>
                ))}
              </div>

              {/* Correction Form when a delivery is selected */}
              {editingDelivery && (
                <form
                  onSubmit={handleApplyCorrection}
                  className="p-3.5 rounded-lg border border-emerald-500/40 bg-[#0B0F14] space-y-3 mt-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-300">
                      Audited Revision — Ball #{editingDelivery.sequenceNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingDelivery(null)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label htmlFor="corr-runs-select" className="block text-[11px] text-slate-400 mb-1">
                        Corrected Batter Runs
                      </label>
                      <select
                        id="corr-runs-select"
                        value={corrRuns}
                        onChange={(e) => setCorrRuns(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-700 bg-[#111722] text-white"
                      >
                        {[0, 1, 2, 3, 4, 6].map((r) => (
                          <option key={r} value={r}>
                            {r} Runs
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="corr-extra-select" className="block text-[11px] text-slate-400 mb-1">
                        Corrected Extra Type
                      </label>
                      <select
                        id="corr-extra-select"
                        value={corrExtra}
                        onChange={(e) => setCorrExtra(e.target.value as ExtraType)}
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-700 bg-[#111722] text-white"
                      >
                        <option value="none">Legal</option>
                        <option value="wide">Wide</option>
                        <option value="no_ball">No-Ball</option>
                        <option value="bye">Bye</option>
                        <option value="leg_bye">Leg-Bye</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="corr-reason-input" className="block text-[11px] text-slate-400 mb-1">
                      Mandatory Audit Reason
                    </label>
                    <input
                      id="corr-reason-input"
                      type="text"
                      required
                      minLength={4}
                      value={corrReason}
                      onChange={(e) => setCorrReason(e.target.value)}
                      placeholder="e.g., Umpire signaled boundary 6 on review"
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-700 bg-[#111722] text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300"
                  >
                    Commit Audited Revision
                  </button>
                </form>
              )}
            </div>

            {/* Rain / DLS Revision & Official Match Finalization */}
            <div className="p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
              <h4 className="font-display text-sm font-semibold text-white">
                Match Official Controls (DLS Rain Rules & Finalization)
              </h4>

              {/* Rain / DLS Adjustment */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="dls-overs-input" className="block text-[11px] text-slate-400 mb-1">
                    Revised Overs (Rain / DLS)
                  </label>
                  <input
                    id="dls-overs-input"
                    type="number"
                    min={5}
                    max={match.scheduledOvers}
                    value={revisedOversInput}
                    onChange={(e) => setRevisedOversInput(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-slate-700 bg-[#0B0F14] text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleTransitionAction('apply_dls')}
                  className="px-3 py-1.5 text-xs font-medium rounded border border-slate-700 text-slate-200 hover:bg-slate-800 whitespace-nowrap"
                >
                  Apply DLS Target
                </button>
              </div>

              {/* Finalize Match Form */}
              <form onSubmit={handleFinalizeMatch} className="pt-3 border-t border-slate-800 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="finalize-result-type" className="block text-[11px] text-slate-400 mb-1">
                      Result Classification
                    </label>
                    <select
                      id="finalize-result-type"
                      value={finalizeResultType}
                      onChange={(e) => setFinalizeResultType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-700 bg-[#0B0F14] text-white"
                    >
                      <option value="win">Decisive Win</option>
                      <option value="tie">Match Tied</option>
                      <option value="no_result">No Result (NR)</option>
                      <option value="abandoned">Abandoned</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="finalize-winner-team" className="block text-[11px] text-slate-400 mb-1">
                      Winning Team
                    </label>
                    <select
                      id="finalize-winner-team"
                      value={finalizeWinnerId}
                      onChange={(e) => setFinalizeWinnerId(e.target.value)}
                      disabled={finalizeResultType !== 'win'}
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-700 bg-[#0B0F14] text-white disabled:opacity-40"
                    >
                      {matchDetail.teams
                        .filter((t: any) => t.id === match.homeTeamId || t.id === match.awayTeamId)
                        .map((t: any) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="finalize-summary-input" className="block text-[11px] text-slate-400 mb-1">
                    Official Result Summary
                  </label>
                  <input
                    id="finalize-summary-input"
                    type="text"
                    value={finalizeSummary}
                    onChange={(e) => setFinalizeSummary(e.target.value)}
                    placeholder="e.g., Emerald Royals CC won by 24 runs"
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-700 bg-[#0B0F14] text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2 text-xs font-semibold rounded-lg border border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                >
                  Finalize Match & Update Tournament Standings
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-xl border border-slate-800 bg-[#111722] text-center space-y-3">
          <p className="text-sm text-slate-300">
            This match has not started its first innings yet.
          </p>
          <button
            type="button"
            onClick={() => handleTransitionAction('start_match')}
            className="px-4 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg"
          >
            Initialize Toss & Start 1st Innings
          </button>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  MapPin,
  Plus,
  Video,
  Shield,
  Download,
  Bell,
  Star,
  CheckSquare,
  Lock,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PlatformRole } from '../domain/rbac';

// ============================================================================
// 9. /grounds — Cricket Ground & Venue Directory
// ============================================================================
export const GroundsDirectoryPage: React.FC = () => {
  const { venues, apiFetch, pushToast, refreshBootstrap } = useApp();
  const [cityFilter, setCityFilter] = useState('');
  const [showAddVenue, setShowAddVenue] = useState(false);

  const [vName, setVName] = useState('');
  const [vCity, setVCity] = useState('');
  const [vPitch, setVPitch] = useState('Balanced Turf');
  const [vCapacity, setVCapacity] = useState(12000);
  const [vStraight, setVStraight] = useState(74);
  const [vSquare, setVSquare] = useState(66);
  const [vLights, setVLights] = useState(true);
  const [vNotes, setVNotes] = useState('');

  const filtered = venues.filter((v) =>
    cityFilter.trim()
      ? v.city.toLowerCase().includes(cityFilter.toLowerCase()) ||
        v.name.toLowerCase().includes(cityFilter.toLowerCase()) ||
        v.pitchType.toLowerCase().includes(cityFilter.toLowerCase())
      : true
  );

  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/v1/venues', {
        method: 'POST',
        body: JSON.stringify({
          name: vName,
          city: vCity,
          country: 'India',
          capacity: vCapacity,
          pitchType: vPitch,
          boundaryStraightMeters: vStraight,
          boundarySquareMeters: vSquare,
          hasFloodlights: vLights,
          curatorNotes: vNotes,
        }),
      });
      pushToast('success', `Added cricket ground "${vName}" to directory!`);
      setShowAddVenue(false);
      setVName('');
      setVCity('');
      setVNotes('');
      await refreshBootstrap();
    } catch (err: any) {
      pushToast('error', err.message || 'Failed to add cricket ground');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Cricket Ground & Turf Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Verified boundary dimensions, pitch characteristics, floodlight status, and curator notes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="ground-search-input" className="sr-only">
            Filter Grounds by City or Pitch Type
          </label>
          <input
            id="ground-search-input"
            type="search"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            placeholder="Filter by city or pitch..."
            className="px-3 py-2 text-xs rounded-lg border border-slate-800 bg-[#111722] text-white"
          />
          <button
            type="button"
            onClick={() => setShowAddVenue(!showAddVenue)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Ground</span>
          </button>
        </div>
      </div>

      {showAddVenue && (
        <form
          onSubmit={handleCreateVenue}
          className="p-5 rounded-xl border border-emerald-500/40 bg-[#111722] space-y-4 text-xs"
        >
          <h2 className="font-display text-sm font-bold text-white">Register New Cricket Venue</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="venue-name-input" className="block text-slate-400 mb-1">
                Ground Name
              </label>
              <input
                id="venue-name-input"
                type="text"
                required
                value={vName}
                onChange={(e) => setVName(e.target.value)}
                placeholder="e.g., Gymkhana Turf Oval"
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              />
            </div>
            <div>
              <label htmlFor="venue-city-input" className="block text-slate-400 mb-1">
                City
              </label>
              <input
                id="venue-city-input"
                type="text"
                required
                value={vCity}
                onChange={(e) => setVCity(e.target.value)}
                placeholder="e.g., Hyderabad"
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              />
            </div>
            <div>
              <label htmlFor="venue-pitch-select" className="block text-slate-400 mb-1">
                Primary Pitch Characteristic
              </label>
              <select
                id="venue-pitch-select"
                value={vPitch}
                onChange={(e) => setVPitch(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              >
                <option value="Balanced Turf">Balanced Turf</option>
                <option value="Pace & Bounce">Pace & Bounce</option>
                <option value="Batting Track">Batting Track</option>
                <option value="Spin Friendly">Spin Friendly</option>
              </select>
            </div>
            <div>
              <label htmlFor="venue-straight-input" className="block text-slate-400 mb-1">
                Straight Boundary (m)
              </label>
              <input
                id="venue-straight-input"
                type="number"
                value={vStraight}
                onChange={(e) => setVStraight(Number(e.target.value))}
                className="w-full px-3 py-2 font-mono rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              />
            </div>
            <div>
              <label htmlFor="venue-square-input" className="block text-slate-400 mb-1">
                Square Boundary (m)
              </label>
              <input
                id="venue-square-input"
                type="number"
                value={vSquare}
                onChange={(e) => setVSquare(Number(e.target.value))}
                className="w-full px-3 py-2 font-mono rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              />
            </div>
            <div>
              <label htmlFor="venue-cap-input" className="block text-slate-400 mb-1">
                Seating Capacity
              </label>
              <input
                id="venue-cap-input"
                type="number"
                value={vCapacity}
                onChange={(e) => setVCapacity(Number(e.target.value))}
                className="w-full px-3 py-2 font-mono rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={vLights}
                onChange={(e) => setVLights(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500"
              />
              <span>Equipped with Match-Grade LED Floodlights</span>
            </label>
            <button
              type="submit"
              className="px-4 py-2 font-semibold bg-emerald-400 text-slate-950 rounded-lg"
            >
              Save Ground
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((v) => (
          <div
            key={v.id}
            className="p-6 rounded-xl border border-slate-800 bg-[#111722] flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  {v.city}, {v.country} · <strong className="text-emerald-400">{v.pitchType}</strong>
                </span>
                <span className="font-mono">Cap: {v.capacity.toLocaleString()}</span>
              </div>
              <h2 className="font-display text-xl font-bold text-white">{v.name}</h2>
              <p className="text-xs text-slate-300">{v.curatorNotes}</p>
            </div>

            <div className="pt-4 border-t border-slate-800 grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
              <div>
                <div className="font-sans text-slate-400">Straight</div>
                <div className="text-white font-semibold">{v.boundaryStraightMeters}m</div>
              </div>
              <div>
                <div className="font-sans text-slate-400">Square</div>
                <div className="text-white font-semibold">{v.boundarySquareMeters}m</div>
              </div>
              <div>
                <div className="font-sans text-slate-400">Floodlights</div>
                <div className={v.hasFloodlights ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                  {v.hasFloodlights ? 'Yes (Day/Night)' : 'Daylight Only'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 10. /coach — Video Coaching & Biomechanics Review Module
// ============================================================================
const BIOMECH_FRAMES = [
  {
    id: 0,
    phase: '01. Balanced Stance & Pre-Delivery Trigger',
    headAngle: '91° Vertical Alignment',
    frontKnee: '164° Relaxed Flex',
    batSpeed: '18 km/h Backlift Initiation',
    note: 'Eyes level over middle stump; weight distributed 52/48 toward balls of feet.',
  },
  {
    id: 1,
    phase: '02. High Elbow Front-Foot Stride',
    headAngle: '89° Tracking Release Point',
    frontKnee: '142° Loading Into Stride',
    batSpeed: '68 km/h Downswing Acceleration',
    note: 'Front shoulder aligned toward extra cover; minimal head dip during forward press.',
  },
  {
    id: 2,
    phase: '03. Sweet-Spot Impact Under the Eyes',
    headAngle: '90° Directly Over Contact Zone',
    frontKnee: '158° Braced Front Pillar',
    batSpeed: '114 km/h Peak Willow Velocity',
    note: 'Full face presented at 14° launch angle; crisp transfer of momentum through the ball.',
  },
];

export const VideoCoachingPage: React.FC = () => {
  const { pushToast } = useApp();
  const [selectedFrame, setSelectedFrame] = useState(2);
  const [uploadStatus, setUploadStatus] = useState<string>(
    'No local clip loaded — inspecting sample biomechanics session (D. Gill Cover Drive).'
  );
  const [annotations, setAnnotations] = useState<Array<{ frame: string; text: string; coach: string }>>([
    {
      frame: '00:01.42 (Impact)',
      text: 'Lead elbow stays high at 118°; zero bottom-hand dominance.',
      coach: 'Coach K. Sen',
    },
    {
      frame: '00:00.88 (Stride)',
      text: 'Keep front foot toe pointing slightly open toward mid-off to clear the hip.',
      coach: 'Coach K. Sen',
    },
  ]);
  const [newAnnotationText, setNewAnnotationText] = useState('');

  const frame = BIOMECH_FRAMES[selectedFrame];

  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const maxBytes = 50 * 1024 * 1024; // 50 MB limit per Section 12 & 14

    if (!allowedTypes.includes(file.type)) {
      pushToast('error', 'Security Validation Rejected: Only .mp4, .webm, or .mov video files are permitted.');
      return;
    }
    if (file.size > maxBytes) {
      pushToast('error', 'File exceeds the 50 MB free-tier coaching upload cap.');
      return;
    }
    setUploadStatus(
      `Verified Clip Ready: "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB · ${file.type})`
    );
    pushToast('success', `Validated coaching clip "${file.name}" for frame analysis!`);
  };

  const handleAddAnnotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnotationText.trim()) return;
    setAnnotations((prev) => [
      {
        frame: frame.phase.split('.')[0] + ' Frame',
        text: newAnnotationText.trim(),
        coach: 'Active Coach Session',
      },
      ...prev,
    ]);
    setNewAnnotationText('');
    pushToast('success', 'Saved frame annotation to coaching log.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Video Coaching & Biomechanics Analysis Studio
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Frame-by-frame batting/bowling kinematics with strict upload validation (50 MB cap, MIME allowlist).
          </p>
        </div>

        <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300 cursor-pointer whitespace-nowrap">
          <Video className="w-4 h-4" />
          <span>Validate & Load Video Clip</span>
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={handleVideoFileSelect}
            className="sr-only"
          />
        </label>
      </div>

      <div className="p-3.5 rounded-lg border border-slate-800 bg-[#111722] text-xs text-slate-300 font-mono">
        {uploadStatus}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Biomechanics SVG Frame Viewport (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-xl border border-slate-800 bg-[#111722] space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-white">{frame.phase}</h2>
            <span className="font-mono text-xs text-emerald-400">240 FPS High-Speed Telemetry</span>
          </div>

          {/* Interactive Biomechanics Skeleton & Bat Swing Plane SVG */}
          <div className="p-4 rounded-xl bg-[#0B0F14] border border-slate-800 flex items-center justify-center">
            <svg
              viewBox="0 0 420 220"
              className="w-full max-w-[400px] h-auto"
              role="img"
              aria-label="Cricket Batter Biomechanics Posture and Bat Swing Plane"
            >
              {/* Grid lines */}
              <line x1="20" y1="190" x2="400" y2="190" stroke="#334155" strokeWidth="2" />
              <line x1="210" y1="20" x2="210" y2="190" stroke="#1E293B" strokeDasharray="4 4" />
              {/* Bat Swing Arc */}
              <path
                d="M 140 50 Q 210 185 310 85"
                fill="none"
                stroke="#10B981"
                strokeWidth="2.5"
                strokeDasharray="6 3"
              />
              {/* Kinematic Skeleton */}
              <circle cx={205 + selectedFrame * 6} cy="56" r="11" fill="none" stroke="#A3E635" strokeWidth="2.5" />
              {/* Spine */}
              <line
                x1={205 + selectedFrame * 6}
                y1="67"
                x2="198"
                y2="128"
                stroke="#F1F5F9"
                strokeWidth="3"
              />
              {/* Back Leg & Braced Front Leg */}
              <line x1="198" y1="128" x2="172" y2="188" stroke="#94A3B8" strokeWidth="3" />
              <line
                x1="198"
                y1="128"
                x2={232 + selectedFrame * 10}
                y2="188"
                stroke="#10B981"
                strokeWidth="3.5"
              />
              {/* Arms & Willow Blade */}
              <line
                x1={203 + selectedFrame * 4}
                y1="82"
                x2={228 + selectedFrame * 12}
                y2="112"
                stroke="#38BDF8"
                strokeWidth="2.5"
              />
              <line
                x1={228 + selectedFrame * 12}
                y1="112"
                x2={255 + selectedFrame * 18}
                y2={155 - selectedFrame * 15}
                stroke="#F59E0B"
                strokeWidth="5"
              />
              {/* Ball Impact Marker */}
              <circle
                cx={255 + selectedFrame * 18}
                cy={152 - selectedFrame * 15}
                r="5"
                fill="#EF4444"
              />
            </svg>
          </div>

          {/* Frame Selector Buttons */}
          <div className="grid grid-cols-3 gap-2.5">
            {BIOMECH_FRAMES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFrame(f.id)}
                className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                  selectedFrame === f.id
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-semibold'
                    : 'bg-[#0B0F14] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {f.phase}
              </button>
            ))}
          </div>

          {/* Kinematic Readout */}
          <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-800 text-xs font-mono">
            <div>
              <div className="font-sans text-slate-400">Head Stability</div>
              <div className="text-white font-semibold mt-0.5">{frame.headAngle}</div>
            </div>
            <div>
              <div className="font-sans text-slate-400">Front Knee Bracing</div>
              <div className="text-emerald-400 font-semibold mt-0.5">{frame.frontKnee}</div>
            </div>
            <div>
              <div className="font-sans text-slate-400">Bat Velocity</div>
              <div className="text-lime-400 font-semibold mt-0.5">{frame.batSpeed}</div>
            </div>
          </div>
        </div>

        {/* Coach Annotations & Drill Prescriptions (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-xl border border-slate-800 bg-[#111722] space-y-5">
          <h2 className="font-display text-base font-bold text-white border-b border-slate-800 pb-2.5">
            Coach Frame Annotations & Drills
          </h2>

          <form onSubmit={handleAddAnnotation} className="space-y-2.5 text-xs">
            <label htmlFor="coach-note-input" className="block text-slate-400">
              Add Timestamped Coaching Note for {frame.phase.split('.')[0]}
            </label>
            <div className="flex gap-2">
              <input
                id="coach-note-input"
                type="text"
                value={newAnnotationText}
                onChange={(e) => setNewAnnotationText(e.target.value)}
                placeholder="e.g., Maintain head stillness through impact..."
                className="flex-1 px-3 py-2 rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              />
              <button
                type="submit"
                className="px-4 py-2 font-semibold bg-emerald-400 text-slate-950 rounded-lg whitespace-nowrap"
              >
                Add Note
              </button>
            </div>
          </form>

          <div className="space-y-2.5">
            {annotations.map((a, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-slate-800 bg-[#0B0F14] text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-400 font-mono">
                  <span className="text-emerald-400">{a.frame}</span>
                  <span>{a.coach}</span>
                </div>
                <p className="text-slate-200">{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 11–14. /dashboard, /dashboard/teams, /dashboard/tournaments, /dashboard/matches
// ============================================================================
export const DashboardPage: React.FC = () => {
  const location = useLocation();
  const {
    activeRole,
    activeUid,
    teams,
    tournaments,
    matches,
    favorites,
    notifications,
    toggleFavorite,
  } = useApp();

  const currentSection = location.pathname.includes('/dashboard/teams')
    ? 'teams'
    : location.pathname.includes('/dashboard/tournaments')
      ? 'tournaments'
      : location.pathname.includes('/dashboard/matches')
        ? 'matches'
        : 'overview';

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl border border-slate-800 bg-[#111722] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-400">
            Personal Operations Workspace · Active UID: <span className="font-mono text-emerald-400">{activeUid || 'visitor'}</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-white mt-0.5">
            User Dashboard, Favorites & Assigned Operations
          </h1>
        </div>

        {/* Sub-route Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#0B0F14] border border-slate-800 text-xs">
          <Link
            to="/dashboard"
            className={`px-3 py-1.5 rounded-md font-medium ${
              currentSection === 'overview' ? 'bg-emerald-400 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Overview
          </Link>
          <Link
            to="/dashboard/matches"
            className={`px-3 py-1.5 rounded-md font-medium ${
              currentSection === 'matches' ? 'bg-emerald-400 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Assigned Matches
          </Link>
          <Link
            to="/dashboard/teams"
            className={`px-3 py-1.5 rounded-md font-medium ${
              currentSection === 'teams' ? 'bg-emerald-400 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            My Teams
          </Link>
          <Link
            to="/dashboard/tournaments"
            className={`px-3 py-1.5 rounded-md font-medium ${
              currentSection === 'tournaments' ? 'bg-emerald-400 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            My Tournaments
          </Link>
        </div>
      </div>

      {currentSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Favorites (6 cols) */}
          <div className="lg:col-span-6 p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
            <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" />
              <span>Pinned Favorites ({favorites.length})</span>
            </h2>
            {favorites.length === 0 ? (
              <p className="text-xs text-slate-400">
                Star any match on the Match Center to pin it here for instant access.
              </p>
            ) : (
              <div className="space-y-2">
                {favorites.map((fav) => (
                  <div
                    key={fav.id}
                    className="p-3 rounded-lg border border-slate-800 bg-[#0B0F14] flex items-center justify-between text-xs"
                  >
                    <Link to={`/matches/${fav.entityId}`} className="font-semibold text-white hover:text-emerald-400">
                      {fav.entityLabel} ({fav.entityType})
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(fav.entityType, fav.entityId, fav.entityLabel)}
                      className="text-slate-400 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notifications (6 cols) */}
          <div className="lg:col-span-6 p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
            <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              <span>Operational Notifications ({notifications.length})</span>
            </h2>
            <div className="space-y-2.5">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  to={n.linkUrl}
                  className="block p-3.5 rounded-lg border border-slate-800 bg-[#0B0F14] hover:border-slate-700 text-xs space-y-1"
                >
                  <div className="font-semibold text-white">{n.title}</div>
                  <div className="text-slate-400">{n.body}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {currentSection === 'matches' && (
        <div className="p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
          <h2 className="font-display text-base font-bold text-white">
            Assigned Scorer & Match Official Console Queue ({matches.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-lg border border-slate-800 bg-[#0B0F14] flex items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="text-emerald-400 font-semibold">{m.status.toUpperCase()}</div>
                  <div className="text-white font-semibold">{m.seriesName} · Match #{m.matchNumber}</div>
                  <div className="text-slate-400">Scorer: {m.assignedScorerUid}</div>
                </div>
                <Link
                  to={`/matches/${m.id}?tab=scoring`}
                  className="px-3.5 py-2 font-semibold bg-emerald-400 text-slate-950 rounded-lg whitespace-nowrap"
                >
                  Score Match
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentSection === 'teams' && (
        <div className="p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-white">Managed Cricket Clubs ({teams.length})</h2>
            <Link
              to="/teams/team-emr"
              className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg"
            >
              Manage Squads & Add Club
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {teams.map((t) => (
              <Link
                key={t.id}
                to={`/teams/${t.id}`}
                className="p-4 rounded-lg border border-slate-800 bg-[#0B0F14] hover:border-emerald-500/50 space-y-1 text-xs"
              >
                <div className="font-display text-base font-bold text-white">{t.name}</div>
                <div className="text-slate-400">{t.city} · {t.division}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {currentSection === 'tournaments' && (
        <div className="p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-white">
              Managed Competitions & Standings ({tournaments.length})
            </h2>
            <Link
              to="/tournaments"
              className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg"
            >
              Create Tournament
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tournaments.map((t) => (
              <Link
                key={t.id}
                to={`/tournaments/${t.id}`}
                className="p-4 rounded-lg border border-slate-800 bg-[#0B0F14] hover:border-emerald-500/50 space-y-1 text-xs"
              >
                <div className="font-display text-base font-bold text-white">{t.name}</div>
                <div className="text-slate-400">
                  Format: {t.format.toUpperCase()} · {t.matchOvers} Overs
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 15. /admin — Administrative Moderation, RBAC Grants & Audit Logs
// ============================================================================
export const AdminModerationPage: React.FC = () => {
  const { profiles, auditLogs, apiFetch, pushToast, refreshBootstrap, activeRole } = useApp();
  const [targetUid, setTargetUid] = useState('demo-player');
  const [grantRole, setGrantRole] = useState<PlatformRole>('scorer');

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/v1/admin/roles', {
        method: 'POST',
        body: JSON.stringify({
          targetUid,
          role: grantRole,
          scopeType: 'global',
          scopeId: '*',
        }),
      });
      pushToast('success', `Granted role "${grantRole}" to ${targetUid}!`);
      await refreshBootstrap();
    } catch (err: any) {
      pushToast('error', err.message || 'Role assignment rejected');
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl border border-slate-800 bg-[#111722] space-y-2">
        <div className="text-xs text-slate-400">
          Platform Governance & Security · Active Role: <span className="font-mono text-emerald-400">{activeRole}</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-white">
          Administrative Moderation, Scoped RBAC & Immutable Audit Trail
        </h1>
        <p className="text-xs text-slate-400">
          All scoring revisions, match finalizations, DLS adjustments, and role grants are logged with before/after snapshots.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* RBAC Role Grant Form (4 cols) */}
        <div className="lg:col-span-4 p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
          <h2 className="font-display text-base font-bold text-white border-b border-slate-800 pb-2.5">
            Assign User Role (RBAC)
          </h2>
          <form onSubmit={handleAssignRole} className="space-y-3 text-xs">
            <div>
              <label htmlFor="admin-user-select" className="block text-slate-400 mb-1">
                Target User Profile
              </label>
              <select
                id="admin-user-select"
                value={targetUid}
                onChange={(e) => setTargetUid(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              >
                {profiles.map((p) => (
                  <option key={p.uid} value={p.uid}>
                    {p.displayName} ({p.uid})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="admin-role-select" className="block text-slate-400 mb-1">
                Role to Grant
              </label>
              <select
                id="admin-role-select"
                value={grantRole}
                onChange={(e) => setGrantRole(e.target.value as PlatformRole)}
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#0B0F14] text-white"
              >
                <option value="scorer">Assigned Scorer / Official</option>
                <option value="tournament_organizer">Tournament Organizer</option>
                <option value="team_manager">Team Manager</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Platform Administrator</option>
                <option value="player">Player</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300"
            >
              Update Role Permission
            </button>
          </form>
        </div>

        {/* Immutable Audit Trail (8 cols) */}
        <div className="lg:col-span-8 p-5 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
          <h2 className="font-display text-base font-bold text-white border-b border-slate-800 pb-2.5">
            System-Wide Audit Log ({auditLogs.length} Events)
          </h2>
          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-lg border border-slate-800 bg-[#0B0F14] text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-slate-400 font-mono">
                  <span className="text-emerald-400 font-semibold">{log.actionType}</span>
                  <span>
                    Actor: {log.actorUid} ({log.actorRole}) · {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-slate-200">{log.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 16–17. /login & /signup — Authentication & RBAC Role Simulation Console
// ============================================================================
export const AuthPage: React.FC<{ mode: 'login' | 'signup' }> = ({ mode }) => {
  const {
    firebaseUser,
    signInWithGoogle,
    signOutUser,
    activeRole,
    setActiveRoleAndUid,
  } = useApp();

  return (
    <div className="max-w-xl mx-auto p-6 sm:p-8 rounded-xl border border-slate-800 bg-[#111722] space-y-6">
      <div className="space-y-2">
        <div className="text-xs text-emerald-400 font-semibold uppercase">
          Authentication & Role-Based Access Control
        </div>
        <h1 className="font-display text-2xl font-bold text-white">
          {mode === 'login' ? 'Sign In to CRICKET PRO MAX' : 'Create Club & Scorer Account'}
        </h1>
        <p className="text-xs text-slate-400">
          Authenticate with Google OAuth via Firebase or switch your active RBAC role to test server-enforced
          permissions across scoring, tournaments, and moderation.
        </p>
      </div>

      {/* Google OAuth Button */}
      <div className="p-4 rounded-xl border border-slate-800 bg-[#0B0F14] space-y-3">
        <div className="text-xs font-semibold text-white">1. Google OAuth Authentication (Firebase Auth)</div>
        {firebaseUser ? (
          <div className="flex items-center justify-between text-xs">
            <span className="text-emerald-400">
              Signed in as {firebaseUser.displayName || firebaseUser.email}
            </span>
            <button
              type="button"
              onClick={signOutUser}
              className="px-3 py-1.5 rounded border border-slate-700 text-slate-300 hover:text-white"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={signInWithGoogle}
            className="w-full py-2.5 px-4 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300 transition-colors"
          >
            Continue with Google Sign-In
          </button>
        )}
      </div>

      {/* Role Switcher for Testing Server RBAC */}
      <div className="p-4 rounded-xl border border-slate-800 bg-[#0B0F14] space-y-3">
        <div className="text-xs font-semibold text-white">
          2. Active Permission Role Switcher (Server-Side Enforced)
        </div>
        <p className="text-xs text-slate-400">
          Current Role: <strong className="font-mono text-emerald-400">{activeRole}</strong>. Selecting Visitor or
          Player will cause the backend API to reject unauthorized live scoring or tournament modification requests with
          HTTP 401/403.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(
            [
              { role: 'scorer', label: 'Assigned Scorer' },
              { role: 'tournament_organizer', label: 'Organizer' },
              { role: 'team_manager', label: 'Team Manager' },
              { role: 'player', label: 'Player (No Scoring)' },
              { role: 'admin', label: 'Platform Admin' },
              { role: 'visitor', label: 'Visitor (Read-Only)' },
            ] as Array<{ role: PlatformRole; label: string }>
          ).map((r) => (
            <button
              key={r.role}
              type="button"
              onClick={() => setActiveRoleAndUid(r.role)}
              className={`p-2.5 text-xs font-medium rounded-lg border text-left transition-colors ${
                activeRole === r.role
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-semibold'
                  : 'border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 18. /settings — User Settings, Privacy Controls & GDPR Data Export
// ============================================================================
export const SettingsPage: React.FC = () => {
  const { activeUid, activeRole, apiFetch, pushToast } = useApp();
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [minorProtection, setMinorProtection] = useState(true);
  const [hideContact, setHideContact] = useState(true);

  const handleExportData = async () => {
    try {
      const data = await apiFetch('/api/v1/account/export');
      setExportJson(JSON.stringify(data, null, 2));
      pushToast('success', 'Generated complete JSON account data export.');
    } catch (err: any) {
      pushToast('error', err.message || 'Export failed');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="p-6 rounded-xl border border-slate-800 bg-[#111722] space-y-4">
        <h1 className="font-display text-2xl font-bold text-white">
          Account Settings, Privacy & Data Portability
        </h1>
        <p className="text-xs text-slate-400">
          Active UID: <span className="font-mono text-emerald-400">{activeUid || 'visitor'}</span> · Role:{' '}
          <span className="font-mono text-slate-200">{activeRole}</span>
        </p>

        <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
          <label className="flex items-center justify-between py-2 cursor-pointer">
            <span className="text-slate-200">
              Youth / Minor Cricketer Safeguards (Mask personal bio & precise location)
            </span>
            <input
              type="checkbox"
              checked={minorProtection}
              onChange={(e) => {
                setMinorProtection(e.target.checked);
                pushToast('info', 'Updated Youth Privacy Protection setting.');
              }}
              className="rounded border-slate-700 text-emerald-500"
            />
          </label>
          <label className="flex items-center justify-between py-2 cursor-pointer">
            <span className="text-slate-200">Hide Private Contact Email from Public Club Directory</span>
            <input
              type="checkbox"
              checked={hideContact}
              onChange={(e) => {
                setHideContact(e.target.checked);
                pushToast('info', 'Updated Contact Visibility preference.');
              }}
              className="rounded border-slate-700 text-emerald-500"
            />
          </label>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportData}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg hover:bg-emerald-300"
          >
            <Download className="w-4 h-4" />
            <span>Export My Account & Audit Data (JSON)</span>
          </button>
        </div>

        {exportJson && (
          <pre className="p-4 rounded-lg bg-[#0B0F14] border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-64">
            {exportJson}
          </pre>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 19–20. /privacy & /terms — Legal, Security & Provider Licensing Pages
// ============================================================================
export const PrivacyPage: React.FC = () => (
  <div className="max-w-3xl mx-auto p-6 rounded-xl border border-slate-800 bg-[#111722] space-y-4 text-xs text-slate-300 leading-relaxed">
    <h1 className="font-display text-2xl font-bold text-white">
      Privacy Policy & Youth Cricketer Protection Charter
    </h1>
    <p>
      CRICKET PRO MAX minimizes personal data collection. Player profiles store only cricket-specific performance
      statistics, batting/bowling styles, and club squad memberships.
    </p>
    <h2 className="font-display text-base font-bold text-white pt-2">1. Youth & Minor Safeguards</h2>
    <p>
      Profiles flagged as Under-18 (`isMinor = true`) automatically suppress personal biographical notes, contact
      handles, and precise geolocation coordinates.
    </p>
    <h2 className="font-display text-base font-bold text-white pt-2">2. Data Portability & Account Deletion</h2>
    <p>
      Authenticated users can export their complete profile, role grants, and audit trail in machine-readable JSON from
      the Settings page at any time.
    </p>
  </div>
);

export const TermsPage: React.FC = () => (
  <div className="max-w-3xl mx-auto p-6 rounded-xl border border-slate-800 bg-[#111722] space-y-4 text-xs text-slate-300 leading-relaxed">
    <h1 className="font-display text-2xl font-bold text-white">
      Terms of Service, Scoring Integrity & Data Licensing
    </h1>
    <p>
      1. <strong>Scoring Integrity:</strong> Match totals are never editable directly by arbitrary clients. Every run,
      extra, and wicket is derived from validated ball-by-ball events protected by unique idempotency keys and
      server-side RBAC.
    </p>
    <p>
      2. <strong>External Feed Attribution:</strong> All development seed fixtures and sandbox provider feeds are
      explicitly labeled as fictional reference data. Production deployment requires a licensed commercial cricket feed
      key (`CRICKET_PROVIDER_API_KEY`). Web scraping or unauthorized API reuse is strictly prohibited.
    </p>
  </div>
);

export const NotFoundPage: React.FC = () => (
  <div className="p-12 rounded-xl border border-slate-800 bg-[#111722] text-center space-y-4">
    <h1 className="font-display text-2xl font-bold text-white">404 — Page Out of Crease</h1>
    <p className="text-xs text-slate-400">The requested route does not exist on CRICKET PRO MAX.</p>
    <Link
      to="/"
      className="inline-block px-4 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-lg"
    >
      Return to Match Center
    </Link>
  </div>
);

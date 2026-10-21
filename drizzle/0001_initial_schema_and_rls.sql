-- CRICKET PRO MAX — Version-Controlled SQL Migration & Row-Level Security (RLS) Policies
-- Target: PostgreSQL 15+ (Cloud SQL / Supabase Compatible)

-- Enable RLS across all exposed domain tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE wickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_sync_logs ENABLE ROW LEVEL SECURITY;

-- Public Read Policies for Match Discovery, Standings, Venues, Teams & Public Player Stats
CREATE POLICY "Public read access for matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Public read access for innings" ON innings FOR SELECT USING (true);
CREATE POLICY "Public read access for deliveries" ON deliveries FOR SELECT USING (true);
CREATE POLICY "Public read access for wickets" ON wickets FOR SELECT USING (true);
CREATE POLICY "Public read access for player_match_stats" ON player_match_stats FOR SELECT USING (true);
CREATE POLICY "Public read access for tournaments" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Public read access for tournament_teams" ON tournament_teams FOR SELECT USING (true);
CREATE POLICY "Public read access for teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public read access for venues" ON venues FOR SELECT USING (true);
CREATE POLICY "Public read access for players" ON players FOR SELECT USING (true);

-- Write Policies: Deliveries & Innings can only be mutated by assigned scorers, match officials, or admins
CREATE POLICY "Assigned scorers and officials record deliveries" ON deliveries
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = deliveries.match_id
        AND m.status IN ('live', 'toss')
        AND (
          m.assigned_scorer_uid = current_setting('app.current_user_uid', true)
          OR m.match_official_uid = current_setting('app.current_user_uid', true)
        )
    )
  );

-- Team management restricted to team manager or admin
CREATE POLICY "Team managers update own teams" ON teams
  FOR UPDATE
  USING (manager_uid = current_setting('app.current_user_uid', true));

-- Audit logs are append-only
CREATE POLICY "Audit logs are readable by authenticated users" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Audit logs are append-only" ON audit_logs FOR INSERT WITH CHECK (true);

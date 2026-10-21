/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import {
  HomePage,
  MatchesDirectoryPage,
  MatchDetailPage,
  SeriesHubPage,
} from './pages/HomeAndMatches';
import {
  TournamentsDirectoryPage,
  TournamentDetailPage,
  TeamDetailPage,
  PlayerDetailPage,
} from './pages/TournamentsTeamsPlayers';
import {
  GroundsDirectoryPage,
  VideoCoachingPage,
  DashboardPage,
  AdminModerationPage,
  AuthPage,
  SettingsPage,
  PrivacyPage,
  TermsPage,
  NotFoundPage,
} from './pages/GroundsCoachAdminUser';

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/matches" element={<MatchesDirectoryPage />} />
            <Route path="/matches/:id" element={<MatchDetailPage />} />
            <Route path="/series/:id" element={<SeriesHubPage />} />
            <Route path="/tournaments" element={<TournamentsDirectoryPage />} />
            <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
            <Route path="/teams/:id" element={<TeamDetailPage />} />
            <Route path="/players/:id" element={<PlayerDetailPage />} />
            <Route path="/grounds" element={<GroundsDirectoryPage />} />
            <Route path="/coach" element={<VideoCoachingPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/teams" element={<DashboardPage />} />
            <Route path="/dashboard/tournaments" element={<DashboardPage />} />
            <Route path="/dashboard/matches" element={<DashboardPage />} />
            <Route path="/admin" element={<AdminModerationPage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </AppProvider>
    </BrowserRouter>
  );
}

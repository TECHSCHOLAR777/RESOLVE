/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { RunProvider, useRun } from './components/run/RunContext';
import AppShell from './components/workspace/AppShell';
import Workspace from './components/workspace/Workspace';

const RunPage = lazy(() => import('./components/run/RunPage'));
const MyResultsPage = lazy(() => import('./components/pages/MyResultsPage'));
const MapPage = lazy(() => import('./components/map/MapPage'));
const SettingsPage = lazy(() => import('./components/pages/SettingsPage'));
const HelpPage = lazy(() => import('./components/pages/HelpPage'));
const AnalysisPage = lazy(() => import('./components/analysis/AnalysisPage'));
const ReportPage = lazy(() => import('./components/pages/ReportPage'));

function ResultsRoute() {
  const navigate = useNavigate();
  const { openEntry, startSample, startArea, samples } = useRun();
  return (
    <MyResultsPage
      onOpen={(entry) => openEntry(entry)}
      onAnalysis={(entry) => openEntry(entry, '/analysis')}
      onRerunSample={(id) => startSample({ id, name: samples.find((s) => s.id === id)?.name ?? id })}
      onRerunArea={startArea}
      onGoToWorkspace={() => navigate('/')}
    />
  );
}

function ReportRoute() {
  const navigate = useNavigate();
  const { result, imageName } = useRun();
  if (!result) return <Navigate to="/" replace />;
  return <ReportPage result={result} name={imageName} onBack={() => navigate('/')} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <RunProvider>
        <Suspense fallback={<div className="min-h-screen bg-page" />}>
          <Routes>
            <Route path="/run" element={<RunPage />} />
            <Route path="/report" element={<ReportRoute />} />
            <Route element={<AppShell />}>
              <Route path="/" element={<Workspace />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/results" element={<ResultsRoute />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/help" element={<HelpPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </RunProvider>
    </BrowserRouter>
  );
}

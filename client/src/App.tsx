import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { PageLoading } from './components/Feedback';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';

// Route-level code splitting: each page (and heavy libs like Leaflet/Recharts) loads on demand.
const ReportPage = lazy(() => import('./pages/ReportPage'));
const TrackPage = lazy(() => import('./pages/TrackPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="report" element={<ReportPage />} />
          <Route path="track" element={<TrackPage />} />
          <Route path="track/:code" element={<TrackPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

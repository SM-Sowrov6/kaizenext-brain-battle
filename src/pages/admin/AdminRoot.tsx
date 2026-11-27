import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { AdminAuthProvider, useAdminAuth } from '@/hooks/useAdminAuth'
import { PageLoader } from '@/components/ui/Feedback'
import { AdminLayout } from '@/layouts/AdminLayout'
import AdminLogin from './AdminLogin'

const Dashboard = lazy(() => import('./AdminDashboard'))
const Questions = lazy(() => import('./AdminQuestions'))
const Participants = lazy(() => import('./AdminParticipants'))
const Leaderboard = lazy(() => import('./AdminLeaderboard'))
const Settings = lazy(() => import('./AdminSettings'))
const QrPage = lazy(() => import('./AdminQr'))
const Draw = lazy(() => import('./AdminDraw'))

function Guard() {
  const { user, checking } = useAdminAuth()
  const location = useLocation()
  if (checking) return <PageLoader label="Checking admin session…" />
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  return <AdminLayout />
}

/**
 * Admin area. The route guard is UX only — real protection is server-side:
 * every admin query runs under Supabase Auth + RLS (`is_admin()`), so a
 * non-admin who bypasses the UI still receives nothing.
 */
export default function AdminRoot() {
  return (
    <AdminAuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="login" element={<AdminLogin />} />
          <Route element={<Guard />}>
            <Route index element={<Dashboard />} />
            <Route path="questions" element={<Questions />} />
            <Route path="participants" element={<Participants />} />
            <Route path="draw" element={<Draw />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="settings" element={<Settings />} />
            <Route path="qr" element={<QrPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </AdminAuthProvider>
  )
}

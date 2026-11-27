import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { FlaskConical } from 'lucide-react'
import { env } from '@/lib/env'
import { ConfigProvider } from '@/hooks/useConfig'
import { ToastProvider } from '@/components/ui/Toast'
import { PageLoader } from '@/components/ui/Feedback'
import { PublicLayout } from '@/layouts/PublicLayout'
import LandingPage from '@/pages/LandingPage'
import RegisterPage from '@/pages/RegisterPage'
import InstructionsPage from '@/pages/InstructionsPage'
import NotFoundPage from '@/pages/NotFoundPage'
import ConfigMissingPage from '@/pages/ConfigMissingPage'

// Heavier / less-frequent screens are code-split.
const QuizPage = lazy(() => import('@/pages/QuizPage'))
const ResultPage = lazy(() => import('@/pages/ResultPage'))
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage'))
const AdminRoot = lazy(() => import('@/pages/admin/AdminRoot'))

function DemoBadge() {
  if (!env.demoMode) return null
  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-[70]">
      <div
        title="Development demo backend — data lives in this browser's localStorage. Configure Supabase in .env.local to use the real backend."
        className="glass pointer-events-auto flex items-center gap-1.5 rounded-full border border-warning/40 px-3 py-1.5 text-[11px] font-semibold text-warning shadow-lg"
      >
        <FlaskConical className="size-3.5" /> Demo mode · local data
      </div>
    </div>
  )
}

export default function App() {
  if (env.misconfigured) {
    return (
      <ConfigMissingPage />
    )
  }
  return (
    <ToastProvider>
        <ConfigProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route element={<PublicLayout />}>
                  <Route index element={<LandingPage />} />
                </Route>
                <Route element={<PublicLayout minimal />}>
                  <Route path="register" element={<RegisterPage />} />
                  <Route path="instructions" element={<InstructionsPage />} />
                  <Route path="result" element={<ResultPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
                <Route path="quiz" element={<QuizPage />} />
                <Route path="leaderboard" element={<LeaderboardPage />} />
                <Route path="admin/*" element={<AdminRoot />} />
              </Routes>
            </Suspense>
            <DemoBadge />
          </BrowserRouter>
        </ConfigProvider>
    </ToastProvider>
  )
}

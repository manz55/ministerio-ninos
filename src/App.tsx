import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { LoginScreen } from './components/ui/LoginScreen'
import { useAuth } from './lib/auth'

const CheckInPage  = lazy(() => import('./pages/CheckInPage'))
const ReportsPage  = lazy(() => import('./pages/ReportsPage'))
const FamiliesPage = lazy(() => import('./pages/FamiliesPage'))
const NotesPage    = lazy(() => import('./pages/NotesPage'))
const UsersPage    = lazy(() => import('./pages/UsersPage'))

function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  )
}

function RequireAdmin({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  if (!isAdmin) return <Navigate to="/registro" replace />
  return <>{children}</>
}

function App() {
  const { session, profile, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!session || !profile) {
    return <LoginScreen />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout isAdmin={isAdmin} profile={profile} />}>
          <Route index element={<Navigate to="/registro" replace />} />
          <Route path="/registro" element={<Suspense fallback={<PageSpinner />}><CheckInPage /></Suspense>} />
          <Route path="/notas" element={<Suspense fallback={<PageSpinner />}><NotesPage /></Suspense>} />
          <Route
            path="/reportes"
            element={
              <RequireAdmin isAdmin={isAdmin}>
                <Suspense fallback={<PageSpinner />}><ReportsPage /></Suspense>
              </RequireAdmin>
            }
          />
          <Route
            path="/familias"
            element={
              <RequireAdmin isAdmin={isAdmin}>
                <Suspense fallback={<PageSpinner />}><FamiliesPage /></Suspense>
              </RequireAdmin>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RequireAdmin isAdmin={isAdmin}>
                <Suspense fallback={<PageSpinner />}><UsersPage /></Suspense>
              </RequireAdmin>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App

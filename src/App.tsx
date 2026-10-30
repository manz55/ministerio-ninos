import { lazy, Suspense } from 'react'
import { BrowserRouter, MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { LoginScreen } from './components/ui/LoginScreen'
import { ResetPasswordScreen } from './components/ui/ResetPasswordScreen'
import { AuthShell } from './components/ui/AuthShell'
import { useAuth, signOut } from './lib/auth'

const CheckInPage  = lazy(() => import('./pages/CheckInPage'))
const ReportsPage  = lazy(() => import('./pages/ReportsPage'))
const FamiliesPage = lazy(() => import('./pages/FamiliesPage'))
const NotesPage    = lazy(() => import('./pages/NotesPage'))
const UsersPage    = lazy(() => import('./pages/UsersPage'))
const MaestrosPage = lazy(() => import('./pages/MaestrosPage'))

function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  )
}

// La demo (npm run build:demo) corre dentro de una página ajena, donde la
// URL no es nuestra — ahí las rutas viven en memoria.
function Router({ children }: { children: React.ReactNode }) {
  if (import.meta.env.VITE_DEMO === '1') return <MemoryRouter initialEntries={['/registro']}>{children}</MemoryRouter>
  return <BrowserRouter>{children}</BrowserRouter>
}

function RequireAdmin({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  if (!isAdmin) return <Navigate to="/registro" replace />
  return <>{children}</>
}

function App() {
  const { session, profile, loading, isAdmin, isPasswordRecovery } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  // Antes que cualquier otra cosa: una sesión de recuperación (llegó del
  // enlace de "olvidé mi contraseña") ya cuenta como `session` válida para
  // Supabase, pero no debe dejar entrar a la app normal hasta que de verdad
  // elija una contraseña nueva.
  if (isPasswordRecovery) {
    return <ResetPasswordScreen />
  }

  if (!session || !profile) {
    return <LoginScreen />
  }

  // Una cuenta desactivada ya no puede ver ni registrar nada (lo bloquea la
  // base de datos); aquí solo se le explica en vez de mostrarle la app vacía.
  if (profile.active === false) {
    return (
      <AuthShell title="Cuenta desactivada" subtitle="Un coordinador desactivó esta cuenta. Si es un error, pídele que la vuelva a activar.">
        <button onClick={() => signOut()} className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-display font-bold text-lg hover:bg-indigo-700">
          Cerrar sesión
        </button>
      </AuthShell>
    )
  }

  return (
    <Router>
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
          <Route
            path="/maestros"
            element={
              <RequireAdmin isAdmin={isAdmin}>
                <Suspense fallback={<PageSpinner />}><MaestrosPage /></Suspense>
              </RequireAdmin>
            }
          />
        </Route>
      </Routes>
    </Router>
  )
}

export default App

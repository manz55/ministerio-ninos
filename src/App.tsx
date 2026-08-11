import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { PinScreen, isAuthenticated } from './components/ui/PinScreen'

const CheckInPage  = lazy(() => import('./pages/CheckInPage'))
const ReportsPage  = lazy(() => import('./pages/ReportsPage'))
const FamiliesPage = lazy(() => import('./pages/FamiliesPage'))

function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  )
}

function App() {
  const [authed, setAuthed] = useState(isAuthenticated)

  if (!authed) {
    return <PinScreen onAuth={() => setAuthed(true)} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/registro" replace />} />
          <Route path="/registro" element={<Suspense fallback={<PageSpinner />}><CheckInPage /></Suspense>} />
          <Route path="/reportes" element={<Suspense fallback={<PageSpinner />}><ReportsPage /></Suspense>} />
          <Route path="/familias" element={<Suspense fallback={<PageSpinner />}><FamiliesPage /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App

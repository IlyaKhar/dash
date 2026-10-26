import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'

import AdminPage from './pages/AdminPage'
import LoginPage from './pages/LoginPage'
import NotesPage from './pages/NotesPage'
import { useAuth } from './state/auth'

function Splash() {
  return (
    <div className="splash">
      <div className="splash-mark">Идея</div>
      <div className="spinner" aria-label="Загрузка" />
    </div>
  )
}

function Protected({ children, adminOnly = false }: { children: ReactElement; adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useAuth()

  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={loading ? <Splash /> : user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <NotesPage />
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <Protected adminOnly>
            <AdminPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

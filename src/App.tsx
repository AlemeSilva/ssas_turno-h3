import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './layout/AppShell'
import { PlanoPage } from './pages/PlanoPage'
import { ChecklistPage } from './pages/ChecklistPage'
import { EscalaPage } from './pages/EscalaPage'
import { RelatoriosPage } from './pages/RelatoriosPage'
import { HistoricoPage } from './pages/HistoricoPage'
import { DefinicoesPage } from './pages/DefinicoesPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RequireAuth>
          <AppShell>
            <Routes>
              <Route path="/" element={<Navigate to="/plano" replace />} />
              <Route path="/plano" element={<PlanoPage />} />
              <Route path="/checklist" element={<ChecklistPage />} />
              <Route path="/escala" element={<EscalaPage />} />
              <Route path="/relatorios" element={<RelatoriosPage />} />
              <Route path="/historico" element={<HistoricoPage />} />
              <Route path="/definicoes" element={<DefinicoesPage />} />
              <Route path="*" element={<Navigate to="/plano" replace />} />
            </Routes>
          </AppShell>
        </RequireAuth>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

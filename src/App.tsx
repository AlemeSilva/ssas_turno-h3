import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './layout/AppShell'
import { InicioPage } from './pages/InicioPage'
import { PlanoPage } from './pages/PlanoPage'
import { ChecklistPage } from './pages/ChecklistPage'
import { EscalaPage } from './pages/EscalaPage'
import { RelatoriosPage } from './pages/RelatoriosPage'
import { HistoricoPage } from './pages/HistoricoPage'
import { DefinicoesPage } from './pages/DefinicoesPage'
import { UtilizadoresPage } from './pages/UtilizadoresPage'
import { TooltipProvider } from '@/components/ui/tooltip'

function App() {
  return (
    <TooltipProvider delayDuration={400}>
      <AuthProvider>
        <BrowserRouter>
          <RequireAuth>
            <AppShell>
              <Routes>
                <Route path="/" element={<Navigate to="/inicio" replace />} />
                <Route path="/inicio" element={<InicioPage />} />
                <Route path="/plano" element={<PlanoPage />} />
                <Route path="/checklist" element={<ChecklistPage />} />
                <Route path="/escala" element={<EscalaPage />} />
                <Route path="/relatorios" element={<RelatoriosPage />} />
                <Route path="/historico" element={<HistoricoPage />} />
                <Route path="/definicoes" element={<DefinicoesPage />} />
                <Route path="/utilizadores" element={<UtilizadoresPage />} />
                <Route path="*" element={<Navigate to="/inicio" replace />} />
              </Routes>
            </AppShell>
          </RequireAuth>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  )
}

export default App

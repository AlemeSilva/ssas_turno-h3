import type { ReactNode } from 'react'
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

// Marca os ecrãs ainda não migrados para Tailwind/shadcn — ver o
// comentário em src/styles/theme.css sobre porque isto é necessário
// (as regras antigas de input/select/a são globais e sem @layer, e
// venceriam sempre as utilities Tailwind de um ecrã já migrado). À
// medida que cada rota for migrada, remove-se o wrapper <Legacy> aqui.
function Legacy({ children }: { children: ReactNode }) {
  return <div className="legacy-theme">{children}</div>
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RequireAuth>
          <AppShell>
            <Routes>
              <Route path="/" element={<Navigate to="/inicio" replace />} />
              <Route path="/inicio" element={<InicioPage />} />
              <Route path="/plano" element={<Legacy><PlanoPage /></Legacy>} />
              <Route path="/checklist" element={<Legacy><ChecklistPage /></Legacy>} />
              <Route path="/escala" element={<EscalaPage />} />
              <Route path="/relatorios" element={<Legacy><RelatoriosPage /></Legacy>} />
              <Route path="/historico" element={<Legacy><HistoricoPage /></Legacy>} />
              <Route path="/definicoes" element={<Legacy><DefinicoesPage /></Legacy>} />
              <Route path="*" element={<Navigate to="/inicio" replace />} />
            </Routes>
          </AppShell>
        </RequireAuth>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

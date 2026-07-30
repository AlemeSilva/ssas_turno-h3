import { defineConfig, devices } from '@playwright/test'

// CAMADA 3 — headless, viewport de desktop (1920x1080), simulando o
// posto de trabalho da equipa sob VPN corporativa. Sem projeto mobile
// — a app é deliberadamente desktop-only.
export default defineConfig({
  testDir: './tests/camada3-e2e',
  fullyParallel: false, // os cenários partilham o mesmo plano/ciclo semeado — corridas paralelas colidiriam
  workers: 1,          // garante execução sequencial entre ficheiros (evita rate-limit Auth e eventos Realtime cruzados)
  retries: 0,
  reporter: [['html', { outputFolder: 'tests/camada3-e2e/relatorio' }], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chrome-1920x1080',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
  ],
})

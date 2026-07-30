import { expect, test } from '@playwright/test'
import { loginComo } from './fixtures/auth'
import { SABADO_CICLO } from './seed/dados'

// SABADO_CICLO é o sábado do ciclo activo — calculado dinamicamente em dados.ts
// para que estes testes funcionem em qualquer semana, sem datas hardcoded.
// O ciclo é NORMAL (tipo_fim_semana padrão), pelo que o alerta das 15h
// (exclusivo de MANUTENCAO) nunca deve aparecer.

// Estratégia de simulação de hora:
//   clock.install()      — congela TODOS os timers (incluindo queueMicrotask React 18).
//                          Seguro apenas em asserções negativas onde nenhum componente
//                          precisa de re-renderizar depois de mudar a hora.
//   window.__TEST_TIME__ — injeta a hora de teste via page.evaluate/addInitScript sem
//                          tocar em Date.now() global. PainelAlertas e AlertBar lêem
//                          esta propriedade via agora() (src/lib/datas.ts). Não afecta
//                          o JWT do Supabase — evita o loop de refresh e o rate-limit.

test.describe('Alerta sonoro/visual — janelas críticas 20h / 15h', () => {
  test('antes das 20h de Sábado, não há alerta de checagem visível', async ({ page }) => {
    await loginComo(page, 'kilson')
    await page.clock.install({ time: new Date(`${SABADO_CICLO}T19:00:00`) })
    await page.getByRole('link', { name: 'Checklist Ativo' }).click()

    await expect(page.getByText('Janela crítica das 20h')).toHaveCount(0)
  })

  test('a partir das 20h de Sábado, o alerta e o botão de acionamento aparecem', async ({ page }) => {
    await loginComo(page, 'kilson')
    // __TEST_TIME__ é lido por agora() em PainelAlertas e AlertBar sem afectar Date.now().
    // O JWT do Supabase não é considerado expirado — sem loop de refresh nem rate-limit.
    await page.evaluate((t) => { (window as { __TEST_TIME__?: string }).__TEST_TIME__ = t }, `${SABADO_CICLO}T20:05:00`)
    await page.getByRole('link', { name: 'Checklist Ativo' }).click()

    await expect(page.getByText('Janela crítica das 20h (Sáb/Dom) em curso.')).toBeVisible()
    // O seed cria sempre uma tarefa com hr_limite:'00:01' que também exibe um botão
    // "Registar acionamento ao Gerente". getByText() usa *:has-text() e faz match em
    // todos os ancestrais, causando strict mode violation se se usar .locator('..').
    // locator('span:has-text(...)') limita o match a SPAN elementos, garantindo que
    // só o <span style="font-size:0.8rem"> é selecionado (único span com este texto),
    // e o .locator('..') dá o <div> da linha que tem exatamente um botão.
    const linha20h = page.locator('span:has-text("Janela crítica das 20h (Sáb/Dom) em curso.")').locator('..')
    const botao = linha20h.getByRole('button', { name: 'Registar acionamento ao Gerente' })
    await expect(botao).toBeVisible()
    await botao.click()
    await expect(botao).toHaveText('Acionamento registado')
    await expect(botao).toBeDisabled()
  })

  test('o alerta das 15h nunca aparece num fim de semana NORMAL, só em manutenção', async ({ page }) => {
    await loginComo(page, 'kilson')
    await page.clock.install({ time: new Date(`${SABADO_CICLO}T15:05:00`) })
    await page.getByRole('link', { name: 'Checklist Ativo' }).click()

    await expect(page.getByText('Janela crítica das 15h')).toHaveCount(0)
  })

  test('a barra superior mostra o próximo alerta e a contagem decrescente', async ({ page }) => {
    // addInitScript corre antes de qualquer script em CADA carregamento de página.
    // AlertBar usa useState(getNow()) ao montar — lê __TEST_TIME__ logo na 1.ª renderização.
    await page.addInitScript((t: string) => {
      (window as { __TEST_TIME__?: string }).__TEST_TIME__ = t
    }, `${SABADO_CICLO}T19:30:00`)
    await loginComo(page, 'kilson')
    // Após loginComo, AlertBar está montado com agora = T19:30 — sem reload necessário.

    await expect(page.getByText('Próximo alerta')).toBeVisible()
    await expect(page.getByText(/Checagem das 20h às 20:00 · em 30 min/)).toBeVisible()
  })
})

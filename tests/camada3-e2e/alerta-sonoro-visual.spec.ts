import { expect, test } from '@playwright/test'
import { loginComo } from './fixtures/auth'

// CICLO_TESTE (2026-08-06) tem Sábado a 2026-08-08 — não é o último
// Sábado de agosto (é 2026-08-29), logo é um ciclo NORMAL. Isto é
// usado deliberadamente para confirmar que o alerta das 15h (só
// manutenção) NÃO aparece aqui — ver bug corrigido em src/lib/alertas.ts.

test.describe('Alerta sonoro/visual — janelas críticas 20h / 15h', () => {
  test('antes das 20h de Sábado, não há alerta de checagem visível', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-08-08T19:00:00') })
    await loginComo(page, 'kilson')
    await page.getByRole('link', { name: 'Checklist Ativo' }).click()

    await expect(page.getByText('Janela crítica das 20h')).toHaveCount(0)
  })

  test('a partir das 20h de Sábado, o alerta e o botão de acionamento aparecem', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-08-08T20:05:00') })
    await loginComo(page, 'kilson')
    await page.getByRole('link', { name: 'Checklist Ativo' }).click()

    await expect(page.getByText('Janela crítica das 20h (Sáb/Dom) em curso.')).toBeVisible()
    const botao = page.getByRole('button', { name: 'Registar acionamento ao Gerente' }).first()
    await expect(botao).toBeVisible()
    await botao.click()
    await expect(botao).toHaveText('Acionamento registado')
    await expect(botao).toBeDisabled()
  })

  test('o alerta das 15h nunca aparece num fim de semana NORMAL, só em manutenção', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-08-08T15:05:00') })
    await loginComo(page, 'kilson')
    await page.getByRole('link', { name: 'Checklist Ativo' }).click()

    await expect(page.getByText('Janela crítica das 15h')).toHaveCount(0)
    // Nota: um cenário positivo (alerta das 15h A aparecer num ciclo de
    // MANUTENÇÃO) precisa de um segundo plano semeado com esse tipo —
    // fica documentado aqui como extensão futura da suite, fora do
    // âmbito deste seed único.
  })

  test('a barra superior mostra o próximo alerta e a contagem decrescente', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-08-08T19:30:00') })
    await loginComo(page, 'kilson')

    await expect(page.getByText('Próximo alerta')).toBeVisible()
    await expect(page.getByText(/Checagem das 20h às 20:00 · em 30 min/)).toBeVisible()
  })
})

import { expect, test } from '@playwright/test'
import { loginComo } from './fixtures/auth'
import { SABADO_CICLO } from './seed/dados'

// SABADO_CICLO é o sábado do ciclo activo — calculado dinamicamente em dados.ts
// para que estes testes funcionem em qualquer semana, sem datas hardcoded.
// O ciclo é NORMAL (tipo_fim_semana padrão), pelo que o alerta das 15h
// (exclusivo de MANUTENCAO) nunca deve aparecer.

// Estratégia de relógio:
//   clock.install()     — congela TODOS os timers (incluindo queueMicrotask usado pelo
//                         React 18). Só seguro em testes de asserção negativa onde
//                         nenhum componente precisa de re-renderizar após o clock.
//   clock.setSystemTime() — apenas substitui new Date(); os timers reais mantêm-se.
//                         Obrigatório quando a página precisa de renderizar depois
//                         de mudar a hora (testes de asserção positiva).

test.describe('Alerta sonoro/visual — janelas críticas 20h / 15h', () => {
  test('antes das 20h de Sábado, não há alerta de checagem visível', async ({ page }) => {
    await loginComo(page, 'kilson')
    await page.clock.install({ time: new Date(`${SABADO_CICLO}T19:00:00`) })
    await page.getByRole('link', { name: 'Checklist Ativo' }).click()

    await expect(page.getByText('Janela crítica das 20h')).toHaveCount(0)
  })

  test('a partir das 20h de Sábado, o alerta e o botão de acionamento aparecem', async ({ page }) => {
    await loginComo(page, 'kilson')
    // setSystemTime em vez de install: mantém queueMicrotask activo para o React renderizar.
    // Definido antes de navegar para o checklist: PainelAlertas monta já com a hora simulada.
    await page.clock.setSystemTime(new Date(`${SABADO_CICLO}T20:05:00`))
    await page.getByRole('link', { name: 'Checklist Ativo' }).click()

    await expect(page.getByText('Janela crítica das 20h (Sáb/Dom) em curso.')).toBeVisible()
    const botao = page.getByRole('button', { name: 'Registar acionamento ao Gerente' }).first()
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
    await loginComo(page, 'kilson')
    // setSystemTime fixa new Date() sem congelar timers — AlertBar monta com a hora certa após reload.
    await page.clock.setSystemTime(new Date(`${SABADO_CICLO}T19:30:00`))
    await page.reload()

    await expect(page.getByText('Próximo alerta')).toBeVisible()
    await expect(page.getByText(/Checagem das 20h às 20:00 · em 30 min/)).toBeVisible()
  })
})

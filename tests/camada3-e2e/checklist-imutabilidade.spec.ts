import { expect, test } from '@playwright/test'
import { loginComo } from './fixtures/auth'

test.describe('Checklist — carimbo imutável', () => {
  test('marcar um item exige confirmação em 2 etapas e grava o carimbo com nome/hora', async ({ page }) => {
    await loginComo(page, 'kilson')
    await page.getByRole('link', { name: 'Checklist Ativo' }).click()

    const linhaItem = page.getByText('Item de teste E2E — Preparação').locator('..')
    await linhaItem.getByRole('button', { name: 'Marcar concluído' }).click()

    // 1ª etapa: pede confirmação, ainda não gravou
    await expect(linhaItem.getByRole('button', { name: 'Confirmar' })).toBeVisible()
    await expect(page.getByText('Carimbado por')).toHaveCount(0)

    // 2ª etapa: confirma
    await linhaItem.getByRole('button', { name: 'Confirmar' }).click()

    // Subscrição real-time pode ter latência em CI — reload garante dados frescos da BD.
    await page.reload()
    const linhaItemRecarga = page.getByText('Item de teste E2E — Preparação').locator('..')
    await expect(linhaItemRecarga.getByText('Carimbado por')).toBeVisible()
    await expect(linhaItemRecarga.getByText('Kilson')).toBeVisible()
  })

  test('depois de carimbado, a UI não oferece nenhuma forma de desmarcar diretamente', async ({ page }) => {
    await loginComo(page, 'kilson')
    await page.getByRole('link', { name: 'Checklist Ativo' }).click()

    const linhaItem = page.getByText('Item de teste E2E — Preparação').locator('..')
    await expect(linhaItem.getByRole('button', { name: 'Marcar concluído' })).toHaveCount(0)
    await expect(linhaItem.getByRole('button', { name: 'Destravar' })).toHaveCount(0) // só o Gerente vê este botão
  })

  test('só o Gerente vê e usa o botão Destravar, e tem de indicar justificativa', async ({ page }) => {
    await loginComo(page, 'gerente')
    await page.getByRole('link', { name: 'Checklist Ativo' }).click()

    const linhaItem = page.getByText('Item de teste E2E — Preparação').locator('..')
    await linhaItem.getByRole('button', { name: 'Destravar' }).click()

    const botaoConfirmar = linhaItem.getByRole('button', { name: 'Confirmar destravar' })
    await expect(botaoConfirmar).toBeDisabled() // sem justificativa, não deixa avançar

    await linhaItem.getByPlaceholder('Justificativa do destravar (obrigatória)').fill('Marcado por engano durante o turno')
    await expect(botaoConfirmar).toBeEnabled()
    await botaoConfirmar.click()

    // volta a "não concluído" — nunca edição direta do carimbo
    await expect(linhaItem.getByRole('button', { name: 'Marcar concluído' })).toBeVisible()
  })
})

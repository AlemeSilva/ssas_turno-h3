import { expect, test } from '@playwright/test'
import { loginComo } from './fixtures/auth'

test.describe('Cadeias — alertas condicionais de atraso (categorias */**)', () => {
  test.beforeEach(async ({ page }) => {
    await loginComo(page, 'kilson')
    await page.getByRole('link', { name: 'Checklist Ativo' }).click()
  })

  test('cadeia normal (SD) não mostra nenhum popup de instrução ao marcar atraso', async ({ page }) => {
    const linha = page.getByText('SD', { exact: true }).locator('..')
    await linha.getByRole('button', { name: 'Marcar atraso' }).click()
    await expect(page.getByText(/valida.*ficheiros no FTRANS/i)).toHaveCount(0)
    await expect(page.getByText(/input AML\/MAB/i)).toHaveCount(0)
  })

  test('cadeia * (SD_FL) mostra a instrução de cópia automática / Synapse ao marcar atraso', async ({ page }) => {
    const linha = page.getByText('SD_FL *', { exact: true }).locator('..')
    await linha.getByRole('button', { name: 'Marcar atraso' }).click()
    await expect(page.getByText(/FTRANS da Cloud/i)).toBeVisible()
    await expect(page.getByText(/pipeline no Synapse/i)).toBeVisible()
  })

  test('cadeia ** (EP_DDS) mostra a instrução de input AML/MAB ao marcar atraso', async ({ page }) => {
    const linha = page.getByText('EP_DDS **', { exact: true }).locator('..')
    await linha.getByRole('button', { name: 'Marcar atraso' }).click()
    await expect(page.getByText(/AML\/MAB/i)).toBeVisible()
  })

  test('o popup de instrução fecha ao clicar Ok, sem alterar o estado da cadeia', async ({ page }) => {
    const linha = page.getByText('SD_FL *', { exact: true }).locator('..')
    await linha.getByRole('button', { name: 'Marcar atraso' }).click()
    await expect(page.getByText(/FTRANS da Cloud/i)).toBeVisible()

    await page.getByRole('button', { name: 'Ok' }).click()
    await expect(page.getByText(/FTRANS da Cloud/i)).toHaveCount(0)
    await expect(linha.getByText('ATRASADO')).toBeVisible()
  })
})

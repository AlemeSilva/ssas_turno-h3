import { expect, test } from '@playwright/test'
import { loginComo } from './fixtures/auth'

test.describe('Definições — gestão de cadeias (adicionar/desativar)', () => {
  test('Gerente consegue adicionar uma cadeia nova ao catálogo', async ({ page }) => {
    await loginComo(page, 'gerente')
    await page.getByRole('link', { name: 'Definições' }).click()

    await page.getByPlaceholder('ex.: SD_NOVA').fill('SD_TESTE_E2E')
    // Listener antes do click — o handler onSubmit é async e o click() retorna antes
    // de supabase.insert() completar; o reload sem waitForResponse chegaria à BD antes da escrita.
    const postConcluido = page.waitForResponse(
      (r) => r.url().includes('cadeias_catalogo') && r.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'Adicionar cadeia' }).click()
    await postConcluido

    await page.reload()
    await expect(page.getByText('SD_TESTE_E2E')).toBeVisible()
    const linha = page.getByText('SD_TESTE_E2E').locator('..')
    await expect(linha.getByText('Ativa', { exact: true })).toBeVisible()
  })

  test('desativar uma cadeia não a remove da lista, só muda o estado — nunca apaga', async ({ page }) => {
    await loginComo(page, 'gerente')
    await page.getByRole('link', { name: 'Definições' }).click()

    const linha = page.getByText('SD_TESTE_E2E').locator('..')
    // Listener antes do click — onClick chama alternarAtivo() sem await; o PATCH
    // corre em background e o click() retorna antes da escrita na BD completar.
    const patchConcluido = page.waitForResponse(
      (r) => r.url().includes('cadeias_catalogo') && r.request().method() === 'PATCH'
    )
    await linha.getByRole('button', { name: 'Desativar' }).click()
    await patchConcluido

    await page.reload()
    const linhaRecarga = page.getByText('SD_TESTE_E2E').locator('..')
    await expect(linhaRecarga.getByText('Desativada')).toBeVisible()
    await expect(page.getByText('SD_TESTE_E2E')).toBeVisible() // continua na lista
    await expect(linhaRecarga.getByRole('button', { name: 'Reativar' })).toBeVisible()
  })

  test('uma cadeia com histórico não oferece opção de apagar na interface, só desativar', async ({ page }) => {
    await loginComo(page, 'gerente')
    await page.getByRole('link', { name: 'Definições' }).click()

    // SD_FL já tem histórico (semeado no plano de teste) — a UI nunca
    // expõe um botão "Apagar" para nenhuma cadeia, precisamente porque
    // o trigger na base de dados bloquearia fisicamente essa operação
    // para qualquer cadeia com histórico.
    await expect(page.getByRole('button', { name: 'Apagar' })).toHaveCount(0)
  })
})

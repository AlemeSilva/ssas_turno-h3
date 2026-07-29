import type { Page } from '@playwright/test'
import { PASSWORD_TESTE, UTILIZADORES_TESTE } from '../seed/dados'

export async function loginComo(page: Page, chave: (typeof UTILIZADORES_TESTE)[number]['chave']) {
  const utilizador = UTILIZADORES_TESTE.find((u) => u.chave === chave)
  if (!utilizador) throw new Error(`Utilizador de teste desconhecido: ${chave}`)

  await page.goto('/')
  await page.getByLabel('Email').fill(utilizador.email)
  await page.getByLabel('Palavra-passe').fill(PASSWORD_TESTE)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/plano')
}

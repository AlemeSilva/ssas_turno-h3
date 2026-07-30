import type { Page } from '@playwright/test'
import { PASSWORD_TESTE, UTILIZADORES_TESTE } from '../seed/dados'

export async function loginComo(page: Page, chave: (typeof UTILIZADORES_TESTE)[number]['chave']) {
  const utilizador = UTILIZADORES_TESTE.find((u) => u.chave === chave)
  if (!utilizador) throw new Error(`Utilizador de teste desconhecido: ${chave}`)

  // Navega primeiro: page.evaluate() falha em about:blank (SecurityError).
  await page.goto('/')
  // Limpa sessão Supabase anterior para que o form de login seja sempre apresentado,
  // mesmo quando loginComo é chamado duas vezes no mesmo teste (ex.: permissoes-perfil).
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb-'))
      .forEach((k) => localStorage.removeItem(k))
  })
  // Segunda navegação para que a app releia o localStorage vazio e mostre o form.
  await page.goto('/')
  await page.getByLabel('Email').fill(utilizador.email)
  await page.getByLabel('Palavra-passe').fill(PASSWORD_TESTE)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/plano')
}

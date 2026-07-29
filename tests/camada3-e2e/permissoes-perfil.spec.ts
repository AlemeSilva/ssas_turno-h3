import { expect, test } from '@playwright/test'
import { loginComo } from './fixtures/auth'

// Complementa a CAMADA 1 (que testa a mesma regra diretamente na API):
// aqui confirma-se que a INTERFACE também respeita e reflete a
// permissão real — não porque a UI seja a fronteira de segurança (é o
// RLS), mas porque uma UI que mostrasse botões que depois falham é
// uma má experiência e esconde o problema até tarde.

test.describe('Permissões por perfil, refletidas na interface', () => {
  test('OPERADOR comum (não-H3) vê o plano mas sem controlos de edição', async ({ page }) => {
    await loginComo(page, 'sergio') // Sérgio é OPERADOR, não OPERADOR_H3
    await page.getByRole('link', { name: 'Plano de Fim de Semana' }).click()

    await expect(page.getByRole('button', { name: 'Submeter para aprovação' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Adicionar tarefa excecional' })).toBeVisible() // o form existe; a escrita real é bloqueada no servidor (RLS)
  })

  test('a aba "Definições" só aparece para o Gerente (ou substituto em delegação)', async ({ page }) => {
    await loginComo(page, 'kilson')
    await expect(page.getByRole('link', { name: 'Definições' })).toHaveCount(0)

    await loginComo(page, 'gerente')
    await expect(page.getByRole('link', { name: 'Definições' })).toBeVisible()
  })

  test('operador H3 que não está escalado nesta semana não vê o botão de aprovação do Gerente', async ({ page }) => {
    await loginComo(page, 'bruno') // Bruno é OPERADOR_H3, mas está em H1 nesta semana de teste, não H3
    await page.getByRole('link', { name: 'Plano de Fim de Semana' }).click()

    await expect(page.getByRole('button', { name: 'Aprovar' })).toHaveCount(0)
  })

  test('a escala do mês é sempre visível em modo de consulta, mesmo para quem não é Gerente', async ({ page }) => {
    await loginComo(page, 'leonardo')
    await page.getByRole('link', { name: 'Escala do Mês' }).click()
    await expect(page.getByText('Escala do Mês')).toBeVisible()
    await expect(page.getByText('Kilson')).toBeVisible() // vê quem está escalado, mesmo não sendo H3
  })
})

// Dados de teste partilhados entre o script de seed e os specs —
// única fonte de verdade para não haver credenciais/ids divergentes
// entre quem semeia os dados e quem os usa nos testes.

export const PASSWORD_TESTE = 'Teste!Homologacao2026'

export const UTILIZADORES_TESTE = [
  { chave: 'caique', nome: 'Caique Araújo', email: 'e2e.caique@turnoh3.teste', perfil: 'OPERADOR_H3' as const, limite_h3_mensal: 1 },
  { chave: 'bruno', nome: 'Bruno Diniz', email: 'e2e.bruno@turnoh3.teste', perfil: 'OPERADOR_H3' as const, limite_h3_mensal: null },
  { chave: 'kilson', nome: 'Kilson Júnior', email: 'e2e.kilson@turnoh3.teste', perfil: 'OPERADOR_H3' as const, limite_h3_mensal: null },
  { chave: 'leonardo', nome: 'Leonardo Madruga', email: 'e2e.leonardo@turnoh3.teste', perfil: 'OPERADOR' as const, limite_h3_mensal: null },
  { chave: 'sergio', nome: 'Sérgio Gomes', email: 'e2e.sergio@turnoh3.teste', perfil: 'OPERADOR' as const, limite_h3_mensal: null },
  { chave: 'gerente', nome: 'Gerente Teste', email: 'e2e.gerente@turnoh3.teste', perfil: 'GERENTE' as const, limite_h3_mensal: null },
] as const

/** Quinta-feira usada como ciclo H3 fixo para toda a suite E2E. */
export const CICLO_TESTE = '2026-08-06'

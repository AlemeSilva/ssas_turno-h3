// Lógica pura sobre utilizadores — sem Supabase, 100% testável.

/**
 * Nome para escolher uma pessoa numa lista de consulta ao histórico. Quem
 * já saiu continua a aparecer (o histórico dele tem de poder ser consultado,
 * para efeito de controlo), mas assinalado: quem saiu não pode passar por
 * equipa ativa. Listas de ações futuras (delegar, propor troca, atribuir
 * turno) não usam isto — nelas quem saiu nem aparece.
 */
export function nomeParaLista(u: { nome: string; ativo: boolean }): string {
  return u.ativo ? u.nome : `${u.nome} (inativo)`
}

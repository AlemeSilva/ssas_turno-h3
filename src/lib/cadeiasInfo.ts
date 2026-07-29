import type { CadeiaCatalogo, CategoriaCadeia } from '../types/database'

export function categoriaDaCadeia(nome: string, catalogo: CadeiaCatalogo[]): CategoriaCadeia {
  return catalogo.find((c) => c.nome_cadeia === nome)?.categoria ?? 'NORMAL'
}

export const INSTRUCAO_ASTERISCO =
  'Sempre ao concluir com sucesso, esta cadeia tem um processo de cópia automática via crontab. Em caso de atraso: correr o script manualmente, validar os ficheiros no FTRANS da Cloud e executar a respetiva pipeline no Synapse.'

export const INSTRUCAO_DUPLO_ASTERISCO =
  'Sempre ao concluir com sucesso, esta cadeia gera dados de input automático para as soluções AML/MAB na Cloud (via crontab). Em caso de atraso, ou ao fim de semana: correr os scripts manualmente.'

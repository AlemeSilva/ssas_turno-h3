import type { SecaoChecklist, TipoFimSemana } from '../types/database'

export interface NovoItemChecklist {
  secao: SecaoChecklist
  item_descricao: string
}

/**
 * Itens fixos do checklist por secção — reflete o CheckList.xlsx real
 * (Preparação, Reunião, e as 3 secções de batch). A linha de
 * manutenção só entra quando o ciclo é MANUTENCAO.
 */
export function gerarChecklistTemplate(tipo: TipoFimSemana): NovoItemChecklist[] {
  const itens: NovoItemChecklist[] = [
    { secao: 'PREPARACAO', item_descricao: 'Verificar espaço em disco' },
    { secao: 'PREPARACAO', item_descricao: 'Encerrar no RTM as sessões ativas há mais de 5 dias' },
    { secao: 'REUNIAO', item_descricao: 'Definir o planeamento do batch do fim de semana' },
    { secao: 'BATCH_SEX_SAB', item_descricao: 'Validar ficheiros das cadeias em destaque no /data/prd/ftrans' },
    { secao: 'BATCH_SAB_DOM', item_descricao: 'Validar ficheiros das cadeias em destaque no /data/prd/ftrans' },
    { secao: 'BATCH_DOM_SEG', item_descricao: 'Garantir o fluxo normal das cadeias diárias' },
  ]

  if (tipo === 'MANUTENCAO') {
    itens.push({ secao: 'BATCH_SAB_DOM', item_descricao: 'Realizada manutenção mensal do ambiente SAS (OnPremise + Cloud)' })
  }

  return itens
}

export const DIA_POR_SECAO_BATCH: Record<string, 'SABADO' | 'DOMINGO' | 'SEGUNDA'> = {
  BATCH_SEX_SAB: 'SABADO',
  BATCH_SAB_DOM: 'DOMINGO',
  BATCH_DOM_SEG: 'SEGUNDA',
}

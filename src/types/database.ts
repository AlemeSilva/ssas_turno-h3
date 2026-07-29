// Tipos manuais alinhados com supabase/migrations/0001_schema.sql.
// Quando o projeto Supabase real existir, substituir por
// `supabase gen types typescript` para manter isto sincronizado.

export type PerfilUsuario = 'OPERADOR' | 'OPERADOR_H3' | 'GERENTE'
export type TurnoTipo = 'H1' | 'H2' | 'H3' | 'H4'
export type TipoFimSemana = 'NORMAL' | 'MANUTENCAO'
export type StatusPlano = 'RASCUNHO' | 'PENDENTE_APROVACAO' | 'APROVADO' | 'EM_EXECUCAO' | 'CONCLUIDO'
export type StatusFerias = 'PENDENTE' | 'APROVADA' | 'REJEITADA'
export type StatusTroca = 'PROPOSTA' | 'APROVADA' | 'REJEITADA'
export type CategoriaCadeia = 'NORMAL' | 'ASTERISCO' | 'DUPLO_ASTERISCO'
export type StatusCadeia = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDO_AUTOMATICO' | 'CONCLUIDO_MANUAL' | 'ATRASADO'
export type StatusTarefa = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'ATRASADO'
export type OrigemTarefa = 'TEMPLATE' | 'MANUTENCAO' | 'EXCECIONAL'
export type SecaoChecklist = 'PREPARACAO' | 'REUNIAO' | 'BATCH_SEX_SAB' | 'BATCH_SAB_DOM' | 'BATCH_DOM_SEG'

export interface Usuario {
  id: string
  nome: string
  email: string
  perfil: PerfilUsuario
  empresa: string
  ativo: boolean
  data_saida: string | null
  limite_h3_mensal: number | null
  criado_em: string
}

export interface EscalaSemanal {
  id: number
  semana_ref: string
  usuario_id: string
  turno: TurnoTipo
  criado_por: string | null
  atualizado_em: string
}

export interface Ferias {
  id: number
  usuario_id: string
  data_inicio: string
  data_fim: string
  status: StatusFerias
  aprovado_por: string | null
  data_aprovacao: string | null
  criado_em: string
}

export interface TrocaEscala {
  id: number
  usuario_proponente: string
  usuario_substituto: string
  semana_ref: string
  status: StatusTroca
  aprovado_por: string | null
  data_aprovacao: string | null
  justificativa: string | null
  criado_em: string
}

export interface DelegacaoAprovacao {
  id: number
  gerente_titular: string
  substituto: string
  data_inicio: string
  data_fim: string
  criado_em: string
}

export interface Plano {
  id: number
  data_inicio_ciclo: string
  tipo_fim_semana: TipoFimSemana
  tipo_fim_semana_manual: boolean
  status: StatusPlano
  observacoes_gerais: string | null
  criado_por: string | null
  aprovado_por: string | null
  data_criacao: string
  data_aprovacao: string | null
}

export interface TarefaPlano {
  id: number
  id_plano: number
  data_execucao: string
  descricao_tarefa: string
  equipa_responsavel: string
  hora_arranque: string | null
  dt_previsao: string | null
  hr_previsao_termino: string | null
  hr_limite: string | null
  observacao: string | null
  status: StatusTarefa
  origem: OrigemTarefa
  executado_por: string | null
  dt_hr_conclusao_real: string | null
}

export interface ChecklistItem {
  id: number
  id_plano: number
  secao: SecaoChecklist
  item_descricao: string
  concluido: boolean
  concluido_por: string | null
  data_hora_conclusao: string | null
  comentario_especifico: string | null
  destravado_por: string | null
  destravado_em: string | null
  destravado_motivo: string | null
}

export interface CadeiaDiaria {
  id: number
  id_plano: number
  secao: SecaoChecklist
  data: string
  nome_cadeia: string
  status: StatusCadeia
  concluido_por: string | null
  data_hora_conclusao: string | null
  observacao: string | null
}

export interface LogAuditoria {
  id: number
  referencia_tipo: string
  referencia_id: number | null
  id_usuario: string | null
  acao: string
  descricao_detalhada: string | null
  delegacao_id: number | null
  data_hora: string
}

export interface CadeiaCatalogo {
  nome_cadeia: string
  categoria: CategoriaCadeia
  ordem: number
  ativo: boolean
}

// Não existe lista fixa de cadeias no código — o catálogo (incluindo
// quais dependem do GIR_FL) vive exclusivamente em cadeias_catalogo /
// gir_fl_dependencias na base de dados, lido via useCadeiasCatalogo().
// Isto permite ao Gerente adicionar ou desativar uma cadeia sem
// depender de uma alteração de código.

// Placeholder mínimo para o generic parameter do supabase-js — substituir
// por `supabase gen types typescript` assim que o projeto real existir.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Database {}

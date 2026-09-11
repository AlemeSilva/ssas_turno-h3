// Tipos manuais alinhados com supabase/migrations/0001_schema.sql.
// Quando o projeto Supabase real existir, substituir por
// `supabase gen types typescript` para manter isto sincronizado.

export type PerfilUsuario = 'OPERADOR' | 'OPERADOR_H3' | 'GERENTE'
export type TurnoTipo = 'H1' | 'H2' | 'H3' | 'H4'
export type TipoFimSemana = 'NORMAL' | 'MANUTENCAO'
export type StatusPlano = 'RASCUNHO' | 'PENDENTE_APROVACAO' | 'APROVADO' | 'EM_EXECUCAO' | 'CONCLUIDO'
export type StatusFerias = 'PENDENTE' | 'APROVADA' | 'REJEITADA'
export type TipoAusencia = 'FERIAS' | 'LICENCA'
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
  /** H1 ou H4 — só para perfil OPERADOR; define a escala composta ao
   * registar e no preenchimento automático anual (migração 0029). */
  turno_fixo: 'H1' | 'H4' | null
  /** Só para perfil OPERADOR_H3 — define quem pode ocupar H2 na
   * rotação anual (migração 0035). */
  elegivel_h2: boolean
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
  tipo: TipoAusencia
  eh_operador_h3: boolean
}

/**
 * Substituto de uma ausência, decidido por semana civil (Segunda a
 * Sexta) — uma ausência de várias semanas pode precisar de gente
 * diferente, ou ninguém, em cada uma. A ausência de uma linha para
 * dada (ferias_id, semana_inicio) significa "por decidir"; mesmo
 * "Nenhum" é uma decisão explícita, gravada com substituto_id nulo.
 */
export interface FeriasSemana {
  id: number
  ferias_id: number
  semana_inicio: string
  substituto_id: string | null
  confirmado_por: string | null
  confirmado_em: string | null
}

/** Ferias com as semanas já decididas embutidas (consulta com
 * `select('*, ferias_semanas(*)')`) — forma usada em toda a app
 * sempre que se precisa de saber o substituto por semana. */
export type AusenciaComSemanas = Ferias & { ferias_semanas: FeriasSemana[] }

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

export interface FeriadoPortugal {
  id: number
  data: string
  nome: string
  tipo: string
  ano: number
  descricao: string | null
  criado_em: string
}

export interface PlantaoVoluntario {
  id: number
  data_feriado: string
  usuario_id: string
  voluntario: boolean
  confirmado_em: string | null
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
  atualizado_em: string
  destravado_por: string | null
  destravado_em: string | null
  destravado_motivo: string | null
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

/** Singleton (id é sempre true) — parâmetros da calculadora de
 * Headcount Ideal, editáveis só pelo Gerente titular (migração 0039). */
export interface HeadcountParametros {
  id: boolean
  capacidade_base_horas: number
  taxa_eficiencia: number
  taxa_cobertura_ferias: number
  batch_horas_dia: number
  olho_vivo_minutos_dia: number
  prep_fim_semana_horas_semana: number
  tempo_medio_pedido_minutos: number
  imparidade_calendario_horas: number
  imparidade_execucao_horas_semana: number
  imparidade_reportes_minutos_dia: number
  imparidade_reportes_dias_mes: number
  banda_tolerancia_pessoas: number
  janela_tendencia_meses: number
  minimo_turnos_criticos: number
  garantia_contratual_fracao: number
  atualizado_por: string | null
  atualizado_em: string
}

/** Uma linha por mês. Enquanto fechado=false é um rascunho editável
 * (titular ou delegado); as colunas de snapshot e resultado só ficam
 * preenchidas no fecho (fechar_mes_headcount), e a partir daí a linha
 * é imutável — sem caminho de reabertura. */
export interface HeadcountMensal {
  id: number
  mes_referencia: string
  volume_pedidos: number | null
  dias_recuperacao_cadeia: number
  capacidade_base_horas: number | null
  taxa_eficiencia: number | null
  taxa_cobertura_ferias: number | null
  batch_horas_dia: number | null
  olho_vivo_minutos_dia: number | null
  prep_fim_semana_horas_semana: number | null
  tempo_medio_pedido_minutos: number | null
  imparidade_calendario_horas: number | null
  imparidade_execucao_horas_semana: number | null
  imparidade_reportes_minutos_dia: number | null
  imparidade_reportes_dias_mes: number | null
  carga_horas: number | null
  capacidade_plena_horas_pessoa: number | null
  capacidade_plena_horas_equipa: number | null
  capacidade_presente_horas_equipa: number | null
  headcount_real_snapshot: number | null
  operador_h3_ativo_snapshot: number | null
  fechado: boolean
  fechado_por: string | null
  fechado_em: string | null
  atualizado_por: string | null
  atualizado_em: string
  criado_em: string
}

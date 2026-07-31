import { describe, expect, it } from 'vitest'
import { gerarTextoPlano } from '../../src/lib/exportarPlano'
import { gerarTextoRelatorioSemanal, ID_PEDRO_BACKUP_H1, ID_SERGIO } from '../../src/lib/gerarRelatorioSemanal'
import type { EscalaSemanal, Ferias, Plano, TarefaPlano, Usuario } from '../../src/types/database'

const PLANO_BASE: Plano = {
  id: 1,
  data_inicio_ciclo: '2026-07-30',
  tipo_fim_semana: 'NORMAL',
  tipo_fim_semana_manual: false,
  status: 'RASCUNHO',
  observacoes_gerais: null,
  criado_por: null,
  aprovado_por: null,
  data_criacao: '2026-07-30T10:00:00Z',
  data_aprovacao: null,
}

const TAREFA_BASE: TarefaPlano = {
  id: 1,
  id_plano: 1,
  data_execucao: '2026-07-31',
  descricao_tarefa: 'Preparação para o final de semana',
  equipa_responsavel: 'DEOS - Operações',
  hora_arranque: '19:00',
  dt_previsao: '2026-07-31',
  hr_previsao_termino: '21:00',
  hr_limite: null,
  observacao: null,
  status: 'PENDENTE',
  origem: 'TEMPLATE',
  executado_por: null,
  dt_hr_conclusao_real: null,
}

describe('gerarTextoPlano — texto pronto a copiar/colar, sempre em português europeu', () => {
  it('identifica corretamente Draft vs Definitivo no título', () => {
    const draft = gerarTextoPlano(PLANO_BASE, [TAREFA_BASE], 'DRAFT')
    const definitivo = gerarTextoPlano(PLANO_BASE, [TAREFA_BASE], 'DEFINITIVO')
    expect(draft).toContain('PRÉVIA (DRAFT)')
    expect(definitivo).toContain('PLANO DEFINITIVO')
  })

  it('assinala claramente um ciclo de manutenção', () => {
    const texto = gerarTextoPlano({ ...PLANO_BASE, tipo_fim_semana: 'MANUTENCAO' }, [TAREFA_BASE], 'DRAFT')
    expect(texto).toContain('MANUTENÇÃO')
  })

  it('inclui o HR. LIMITE apenas quando definido, sem "undefined" nem "null" no texto', () => {
    const semLimite = gerarTextoPlano(PLANO_BASE, [TAREFA_BASE], 'DRAFT')
    expect(semLimite).not.toContain('undefined')
    expect(semLimite).not.toContain('HR. LIMITE')

    const comLimite = gerarTextoPlano(PLANO_BASE, [{ ...TAREFA_BASE, hr_limite: '21:00' }], 'DRAFT')
    expect(comLimite).toContain('HR. LIMITE: 21:00')
  })

  it('agrupa tarefas por dia de execução', () => {
    const outraData = { ...TAREFA_BASE, id: 2, data_execucao: '2026-08-01', descricao_tarefa: 'Arranque Cadeia - AUTOMÁTICA' }
    const texto = gerarTextoPlano(PLANO_BASE, [TAREFA_BASE, outraData], 'DRAFT')
    expect(texto.indexOf('31/07/2026')).toBeLessThan(texto.indexOf('01/08/2026'))
  })
})

describe('gerarTextoRelatorioSemanal — mesmo formato do email real usado pelo Gerente', () => {
  const usuarios: Usuario[] = [
    { id: 'bruno', nome: 'Bruno Diniz', email: 'b@x.pt', perfil: 'OPERADOR_H3', empresa: 'Accenture', ativo: true, data_saida: null, limite_h3_mensal: null, criado_em: '' },
    { id: 'kilson', nome: 'Kilson Júnior', email: 'k@x.pt', perfil: 'OPERADOR_H3', empresa: 'Accenture', ativo: true, data_saida: null, limite_h3_mensal: null, criado_em: '' },
    { id: 'sergio', nome: 'Sérgio Gomes', email: 's@x.pt', perfil: 'OPERADOR', empresa: 'Accenture', ativo: true, data_saida: null, limite_h3_mensal: null, criado_em: '' },
  ]

  const escalas: EscalaSemanal[] = [
    { id: 1, semana_ref: '2026-07-30', usuario_id: 'bruno', turno: 'H1', criado_por: null, atualizado_em: '' },
    { id: 2, semana_ref: '2026-07-30', usuario_id: 'kilson', turno: 'H3', criado_por: null, atualizado_em: '' },
  ]

  const ferias: Ferias[] = [
    { id: 1, usuario_id: 'sergio', data_inicio: '2026-07-28', data_fim: '2026-08-02', status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '' },
  ]

  it('inclui a listagem dos 4 turnos, mesmo quando algum fica sem ninguém atribuído', () => {
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, ferias, usuarios)
    expect(texto).toContain('H1 - 07h00 às 16h00')
    expect(texto).toContain('H2 - 14h00 às 23h00 – —')
    expect(texto).toContain('H3 - 22h00 às 07h00 – Kilson Júnior')
  })

  it('lista as férias/licenças que tocam a semana', () => {
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, ferias, usuarios)
    expect(texto).toContain('Férias/Licenças')
    expect(texto).toContain('Sérgio Gomes')
  })

  it('mostra "—" quando ninguém está de férias nessa semana', () => {
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, [], usuarios)
    const apos = texto.split('Férias/Licenças')[1]
    expect(apos.trim()).toBe('—')
  })
})

describe('gerarTextoRelatorioSemanal — substituição do Sérgio pelo Pedro no H1', () => {
  const usuarios: Usuario[] = [
    { id: ID_SERGIO, nome: 'Sérgio Real', email: 's@x.pt', perfil: 'OPERADOR', empresa: 'Accenture', ativo: true, data_saida: null, limite_h3_mensal: null, criado_em: '' },
    { id: ID_PEDRO_BACKUP_H1, nome: 'Pedro Real', email: 'p@x.pt', perfil: 'OPERADOR', empresa: 'Accenture', ativo: true, data_saida: null, limite_h3_mensal: null, criado_em: '' },
    { id: 'kilson', nome: 'Kilson Júnior', email: 'k@x.pt', perfil: 'OPERADOR_H3', empresa: 'Accenture', ativo: true, data_saida: null, limite_h3_mensal: null, criado_em: '' },
  ]

  const escalas: EscalaSemanal[] = [
    { id: 1, semana_ref: '2026-07-30', usuario_id: ID_SERGIO, turno: 'H1', criado_por: null, atualizado_em: '' },
    { id: 2, semana_ref: '2026-07-30', usuario_id: ID_PEDRO_BACKUP_H1, turno: 'H4', criado_por: null, atualizado_em: '' },
    { id: 3, semana_ref: '2026-07-30', usuario_id: 'kilson', turno: 'H3', criado_por: null, atualizado_em: '' },
  ]

  const feriasDoSergio: Ferias = {
    id: 1, usuario_id: ID_SERGIO, data_inicio: '2026-07-28', data_fim: '2026-08-02',
    status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '',
  }

  it('quando o Sérgio está de férias, o Pedro cobre o H1 e some do H4 (não aparece duas vezes)', () => {
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, [feriasDoSergio], usuarios)
    expect(texto).toContain('H1 - 07h00 às 16h00 – Pedro Real')
    expect(texto).toContain('H4 - 09h00 às 18h00 – —')
    expect(texto.match(/Pedro Real/g)?.length).toBe(1)
  })

  it('quando o Sérgio NÃO está de férias, não há substituição', () => {
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, [], usuarios)
    expect(texto).toContain('H1 - 07h00 às 16h00 – Sérgio Real')
    expect(texto).toContain('H4 - 09h00 às 18h00 – Pedro Real')
  })

  it('quando o Sérgio E o Pedro estão ambos de férias, o H1 fica vazio em vez de duplicar o Pedro', () => {
    const feriasDoPedroTambem: Ferias = {
      id: 2, usuario_id: ID_PEDRO_BACKUP_H1, data_inicio: '2026-07-29', data_fim: '2026-08-01',
      status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '',
    }
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, [feriasDoSergio, feriasDoPedroTambem], usuarios)
    expect(texto).toContain('H1 - 07h00 às 16h00 – —')
    // Pedro aparece exatamente uma vez (em Férias/Licenças), nunca no H1
    expect(texto.match(/Pedro Real/g)?.length).toBe(1)
    const secaoFerias = texto.split('Férias/Licenças')[1]
    expect(secaoFerias).toContain('Sérgio Real')
    expect(secaoFerias).toContain('Pedro Real')
  })

  it('não duplica uma pessoa em Férias/Licenças que tenha 2 pedidos aprovados sobrepostos à semana', () => {
    const segundoPedidoDoSergio: Ferias = {
      id: 3, usuario_id: ID_SERGIO, data_inicio: '2026-08-03', data_fim: '2026-08-05',
      status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '',
    }
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, [feriasDoSergio, segundoPedidoDoSergio], usuarios)
    expect(texto.match(/Sérgio Real/g)?.length).toBe(1)
  })
})

import { describe, expect, it } from 'vitest'
import { gerarTextoPlano } from '../../src/lib/exportarPlano'
import { gerarTextoRelatorioSemanal } from '../../src/lib/gerarRelatorioSemanal'
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

describe('gerarTextoRelatorioSemanal — substituto real (ferias.substituto_id) cobre o turno de quem está ausente', () => {
  const usuarios: Usuario[] = [
    { id: 'sergio', nome: 'Sérgio Real', email: 's@x.pt', perfil: 'OPERADOR', empresa: 'Accenture', ativo: true, data_saida: null, limite_h3_mensal: null, criado_em: '' },
    { id: 'leonardo', nome: 'Leonardo Real', email: 'l@x.pt', perfil: 'OPERADOR', empresa: 'Accenture', ativo: true, data_saida: null, limite_h3_mensal: null, criado_em: '' },
    { id: 'kilson', nome: 'Kilson Júnior', email: 'k@x.pt', perfil: 'OPERADOR_H3', empresa: 'Accenture', ativo: true, data_saida: null, limite_h3_mensal: null, criado_em: '' },
  ]

  const escalas: EscalaSemanal[] = [
    { id: 1, semana_ref: '2026-07-30', usuario_id: 'sergio', turno: 'H1', criado_por: null, atualizado_em: '' },
    { id: 2, semana_ref: '2026-07-30', usuario_id: 'leonardo', turno: 'H4', criado_por: null, atualizado_em: '' },
    { id: 3, semana_ref: '2026-07-30', usuario_id: 'kilson', turno: 'H3', criado_por: null, atualizado_em: '' },
  ]

  const feriasDoSergio: Ferias = {
    id: 1, usuario_id: 'sergio', data_inicio: '2026-07-28', data_fim: '2026-08-02',
    status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '',
    tipo: 'FERIAS', eh_operador_h3: false, substituicao_confirmada: false, confirmado_por: null,
    confirmado_em: null, substituto_id: null,
  }

  it('com substituto confirmado, este cobre o turno de quem está ausente e some do seu próprio (não aparece duas vezes)', () => {
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, [{ ...feriasDoSergio, substituto_id: 'leonardo' }], usuarios)
    expect(texto).toContain('H1 - 07h00 às 16h00 – Leonardo Real')
    expect(texto).toContain('H4 - 09h00 às 18h00 – —')
    expect(texto.match(/Leonardo Real/g)?.length).toBe(1)
  })

  it('sem substituto confirmado, o turno fica vazio em vez de adivinhar um nome', () => {
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, [feriasDoSergio], usuarios)
    expect(texto).toContain('H1 - 07h00 às 16h00 – —')
  })

  it('quando ninguém está de férias, não há substituição nenhuma', () => {
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, [], usuarios)
    expect(texto).toContain('H1 - 07h00 às 16h00 – Sérgio Real')
    expect(texto).toContain('H4 - 09h00 às 18h00 – Leonardo Real')
  })

  it('quando o ausente e o seu substituto estão ambos de férias, o turno fica vazio em vez de pôr alguém ausente', () => {
    const feriasDoLeonardoTambem: Ferias = {
      ...feriasDoSergio, id: 2, usuario_id: 'leonardo', data_inicio: '2026-07-29', data_fim: '2026-08-01',
    }
    const texto = gerarTextoRelatorioSemanal(
      '2026-07-30',
      escalas,
      [{ ...feriasDoSergio, substituto_id: 'leonardo' }, feriasDoLeonardoTambem],
      usuarios
    )
    expect(texto).toContain('H1 - 07h00 às 16h00 – —')
    // Leonardo aparece exatamente uma vez (em Férias/Licenças), nunca a cobrir o H1
    expect(texto.match(/Leonardo Real/g)?.length).toBe(1)
    const secaoFerias = texto.split('Férias/Licenças')[1]
    expect(secaoFerias).toContain('Sérgio Real')
    expect(secaoFerias).toContain('Leonardo Real')
  })

  it('não duplica uma pessoa em Férias/Licenças que tenha 2 pedidos aprovados sobrepostos à semana', () => {
    const segundoPedidoDoSergio: Ferias = {
      ...feriasDoSergio, id: 3, data_inicio: '2026-08-03', data_fim: '2026-08-05',
    }
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, [feriasDoSergio, segundoPedidoDoSergio], usuarios)
    expect(texto.match(/Sérgio Real/g)?.length).toBe(1)
  })
})

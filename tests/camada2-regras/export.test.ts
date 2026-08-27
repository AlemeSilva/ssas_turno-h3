import { describe, expect, it } from 'vitest'
import { gerarTextoPlano } from '../../src/lib/exportarPlano'
import { gerarTextoRelatorioSemanal } from '../../src/lib/gerarRelatorioSemanal'
import type { AusenciaComSemanas, EscalaSemanal, Ferias, Plano, TarefaPlano, Usuario } from '../../src/types/database'

// Segunda-feira da semana civil que mais se sobrepõe a semanaRef =
// '2026-07-30' (Quinta) — mesma fórmula usada em gerarRelatorioSemanal
// (segundaDaSemanaDe(semanaRef + 3 dias)). Constante calculada uma vez
// aqui para todos os testes deste ficheiro, em vez de "magic strings"
// espalhadas.
const SEMANA_CIVIL_DOMINANTE = '2026-07-27'

function semDecisao(f: Ferias): AusenciaComSemanas {
  return { ...f, ferias_semanas: [] }
}

function comSubstituto(f: Ferias, substitutoId: string | null, semanaInicio = SEMANA_CIVIL_DOMINANTE): AusenciaComSemanas {
  return {
    ...f,
    ferias_semanas: [{ id: f.id, ferias_id: f.id, semana_inicio: semanaInicio, substituto_id: substitutoId, confirmado_por: null, confirmado_em: null }],
  }
}

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

  const ferias: AusenciaComSemanas[] = [
    semDecisao({ id: 1, usuario_id: 'sergio', data_inicio: '2026-07-28', data_fim: '2026-08-02', status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '', tipo: 'FERIAS', eh_operador_h3: false }),
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

describe('gerarTextoRelatorioSemanal — utilizador inativo não aparece a ocupar turno (caso real: Pedro, 2026-08-21)', () => {
  const usuarios: Usuario[] = [
    { id: 'bruno', nome: 'Bruno Diniz', email: 'b@x.pt', perfil: 'OPERADOR_H3', empresa: 'Accenture', ativo: true, data_saida: null, limite_h3_mensal: null, criado_em: '' },
    { id: 'pedro', nome: 'Pedro Saiu', email: 'p@x.pt', perfil: 'OPERADOR', empresa: 'Accenture', ativo: false, data_saida: '2026-08-21', limite_h3_mensal: null, criado_em: '' },
  ]

  const escalas: EscalaSemanal[] = [
    { id: 1, semana_ref: '2026-07-30', usuario_id: 'bruno', turno: 'H1', criado_por: null, atualizado_em: '' },
    // Linha da semana em curso, ainda não apagada pela desativação (que só
    // remove semana_ref >= hoje) — cenário real que motivou este teste.
    { id: 2, semana_ref: '2026-07-30', usuario_id: 'pedro', turno: 'H2', criado_por: null, atualizado_em: '' },
  ]

  it('não conta o turno de quem está inativo, mesmo que a linha ainda exista em escala_semanal', () => {
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, [], usuarios)
    expect(texto).toContain('H1 - 07h00 às 16h00 – Bruno Diniz')
    expect(texto).toContain('H2 - 14h00 às 23h00 – —')
    expect(texto).not.toContain('Pedro Saiu')
  })
})

describe('gerarTextoRelatorioSemanal — férias parciais na semana aparecem como nota junto ao turno (caso real: Caique, 2026-08-27)', () => {
  const usuarios: Usuario[] = [
    { id: 'caique', nome: 'Caique Silva', email: 'c@x.pt', perfil: 'OPERADOR_H3', empresa: 'Accenture', ativo: true, data_saida: null, limite_h3_mensal: null, turno_fixo: null, criado_em: '' },
  ]

  const escalas: EscalaSemanal[] = [
    { id: 1, semana_ref: '2026-08-31', usuario_id: 'caique', turno: 'H2', criado_por: null, atualizado_em: '' },
  ]

  const ferias: AusenciaComSemanas[] = [
    semDecisao({
      id: 1, usuario_id: 'caique', data_inicio: '2026-09-02', data_fim: '2026-09-04',
      status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '', tipo: 'FERIAS', eh_operador_h3: true,
    }),
  ]

  it('mantém Caique na linha H2 (3/7 dias, abaixo dos 50%) e acrescenta uma nota com os dias concretos de ausência', () => {
    const texto = gerarTextoRelatorioSemanal('2026-08-31', escalas, ferias, usuarios)
    expect(texto).toContain('H2 - 14h00 às 23h00 – Caique Silva (ausente por férias em 02/09/2026 a 04/09/2026)')
    expect(texto.split('Férias/Licenças')[1].trim()).toBe('—')
  })

  it('sem férias nenhuma essa semana, o nome aparece sem qualquer nota (não regressão)', () => {
    const texto = gerarTextoRelatorioSemanal('2026-08-31', escalas, [], usuarios)
    expect(texto).toContain('H2 - 14h00 às 23h00 – Caique Silva')
    expect(texto).not.toContain('ausente por férias')
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
    tipo: 'FERIAS', eh_operador_h3: false,
  }

  it('com substituto confirmado, este cobre o turno de quem está ausente e some do seu próprio (não aparece duas vezes)', () => {
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, [comSubstituto(feriasDoSergio, 'leonardo')], usuarios)
    expect(texto).toContain('H1 - 07h00 às 16h00 – Leonardo Real')
    expect(texto).toContain('H4 - 09h00 às 18h00 – —')
    expect(texto.match(/Leonardo Real/g)?.length).toBe(1)
  })

  it('sem semana decidida, o turno fica vazio em vez de adivinhar um nome', () => {
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, [semDecisao(feriasDoSergio)], usuarios)
    expect(texto).toContain('H1 - 07h00 às 16h00 – —')
  })

  it('semana decidida como "Nenhum" (substituto_id nulo) também deixa o turno vazio', () => {
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, [comSubstituto(feriasDoSergio, null)], usuarios)
    expect(texto).toContain('H1 - 07h00 às 16h00 – —')
  })

  it('quando ninguém está de férias, não há substituição nenhuma', () => {
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, [], usuarios)
    expect(texto).toContain('H1 - 07h00 às 16h00 – Sérgio Real')
    expect(texto).toContain('H4 - 09h00 às 18h00 – Leonardo Real')
  })

  it('quando o ausente e o seu substituto estão ambos de férias, o turno fica vazio em vez de pôr alguém ausente', () => {
    // 30/07 a 03/08 = 5 dos 7 dias do período (30/07-05/08) — acima do
    // limiar de 50%, para o Leonardo continuar a contar como ausente.
    const feriasDoLeonardoTambem: Ferias = {
      ...feriasDoSergio, id: 2, usuario_id: 'leonardo', data_inicio: '2026-07-29', data_fim: '2026-08-03',
    }
    const texto = gerarTextoRelatorioSemanal(
      '2026-07-30',
      escalas,
      [comSubstituto(feriasDoSergio, 'leonardo'), semDecisao(feriasDoLeonardoTambem)],
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
    const texto = gerarTextoRelatorioSemanal(
      '2026-07-30',
      escalas,
      [semDecisao(feriasDoSergio), semDecisao(segundoPedidoDoSergio)],
      usuarios
    )
    expect(texto.match(/Sérgio Real/g)?.length).toBe(1)
  })

  it('férias que termina exatamente no dia rotulado como início da semana (dia de transição) já não afeta esta semana — caso real Sérgio/Leonardo', () => {
    const feriasNaFronteira: Ferias = { ...feriasDoSergio, data_inicio: '2026-07-26', data_fim: '2026-07-30' }
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, [comSubstituto(feriasNaFronteira, 'leonardo')], usuarios)
    expect(texto).toContain('H1 - 07h00 às 16h00 – Sérgio Real')
    expect(texto).toContain('H4 - 09h00 às 18h00 – Leonardo Real')
    const secaoFerias = texto.split('Férias/Licenças')[1]
    expect(secaoFerias.trim()).toBe('—')
  })

  it('férias que cruza a fronteira mas com pouco volume (2 dos 7 dias) já não conta como férias — regra dos 50%', () => {
    // Cruza a fronteira de transição (data_fim = semanaRef + 1, já não
    // é o caso excluído por completo), mas só 30-31/07 se sobrepõem ao
    // período (30/07-05/08) — 2/7 ≈ 29%, abaixo do limiar de 50%.
    const feriasPassaFronteira: Ferias = { ...feriasDoSergio, data_inicio: '2026-07-26', data_fim: '2026-07-31' }
    const texto = gerarTextoRelatorioSemanal('2026-07-30', escalas, [comSubstituto(feriasPassaFronteira, 'leonardo')], usuarios)
    expect(texto).toContain('H1 - 07h00 às 16h00 – Sérgio Real')
    expect(texto).toContain('H4 - 09h00 às 18h00 – Leonardo Real')
    const secaoFerias = texto.split('Férias/Licenças')[1]
    expect(secaoFerias.trim()).toBe('—')
  })

  it('duas semanas diferentes da mesma ausência podem ter substitutos diferentes — mesmo padrão do caso real Caique/Kilson', () => {
    // Reaproveita o utilizador "sergio" já definido acima, mas com o
    // padrão de datas/semanas real que motivou ferias_semanas: férias
    // de 20/08 (Quinta) a 28/08 (Sexta), semana de 17/08 sem substituto
    // (fecha o ciclo em curso) e semana de 24/08 com substituto.
    const feriasComDuasSemanas: AusenciaComSemanas = {
      id: 4, usuario_id: 'sergio', data_inicio: '2026-08-20', data_fim: '2026-08-28',
      status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '',
      tipo: 'FERIAS', eh_operador_h3: false,
      ferias_semanas: [
        { id: 1, ferias_id: 4, semana_inicio: '2026-08-17', substituto_id: null, confirmado_por: null, confirmado_em: null },
        { id: 2, ferias_id: 4, semana_inicio: '2026-08-24', substituto_id: 'kilson', confirmado_por: null, confirmado_em: null },
      ],
    }
    // semanaRef = Sexta 21/08 → semana civil dominante = Segunda 24/08 (a que tem o substituto).
    const texto = gerarTextoRelatorioSemanal('2026-08-21', escalas, [feriasComDuasSemanas], usuarios)
    expect(texto).toContain('H1 - 07h00 às 16h00 – Kilson Júnior')
  })
})

describe('gerarTextoRelatorioSemanal — só conta como férias a partir de 50% dos dias da semana (decisão do Gerente, 2026-08-13)', () => {
  const usuarios: Usuario[] = [
    { id: 'sergio', nome: 'Sérgio Gomes', email: 's@x.pt', perfil: 'OPERADOR', empresa: 'Accenture', ativo: true, data_saida: null, limite_h3_mensal: null, criado_em: '' },
    { id: 'bruno', nome: 'Bruno Diniz', email: 'b@x.pt', perfil: 'OPERADOR_H3', empresa: 'Accenture', ativo: true, data_saida: null, limite_h3_mensal: null, criado_em: '' },
    { id: 'caique', nome: 'Caique Silva', email: 'c@x.pt', perfil: 'OPERADOR_H3', empresa: 'Accenture', ativo: true, data_saida: null, limite_h3_mensal: null, criado_em: '' },
    { id: 'kilson', nome: 'Kilson Júnior', email: 'k@x.pt', perfil: 'OPERADOR_H3', empresa: 'Accenture', ativo: true, data_saida: null, limite_h3_mensal: null, criado_em: '' },
  ]

  const escalas: EscalaSemanal[] = [
    { id: 1, semana_ref: '2026-08-15', usuario_id: 'sergio', turno: 'H1', criado_por: null, atualizado_em: '' },
    { id: 2, semana_ref: '2026-08-15', usuario_id: 'bruno', turno: 'H2', criado_por: null, atualizado_em: '' },
    { id: 3, semana_ref: '2026-08-15', usuario_id: 'kilson', turno: 'H3', criado_por: null, atualizado_em: '' },
    { id: 4, semana_ref: '2026-08-15', usuario_id: 'caique', turno: 'H4', criado_por: null, atualizado_em: '' },
  ]

  it('caso real: Bruno ausente 1 dia e Caique a iniciar férias no último dia do período — nenhum dos dois aparece no relatório', () => {
    const feriasDoBruno = semDecisao({
      id: 10, usuario_id: 'bruno', data_inicio: '2026-08-19', data_fim: '2026-08-19',
      status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '', tipo: 'FERIAS', eh_operador_h3: true,
    })
    const feriasDoCaique = semDecisao({
      id: 11, usuario_id: 'caique', data_inicio: '2026-08-20', data_fim: '2026-08-28',
      status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '', tipo: 'FERIAS', eh_operador_h3: true,
    })
    const texto = gerarTextoRelatorioSemanal('2026-08-14', escalas, [feriasDoBruno, feriasDoCaique], usuarios)
    expect(texto).toContain('H2 - 14h00 às 23h00 – Bruno Diniz')
    expect(texto).toContain('H4 - 09h00 às 18h00 – Caique Silva')
    const secaoFerias = texto.split('Férias/Licenças')[1]
    expect(secaoFerias.trim()).toBe('—')
  })

  it('fronteira exata: 3 dos 7 dias (43%) ainda não conta como férias', () => {
    const ferias3Dias = semDecisao({
      id: 12, usuario_id: 'bruno', data_inicio: '2026-08-18', data_fim: '2026-08-20',
      status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '', tipo: 'FERIAS', eh_operador_h3: true,
    })
    const texto = gerarTextoRelatorioSemanal('2026-08-14', escalas, [ferias3Dias], usuarios)
    expect(texto).toContain('H2 - 14h00 às 23h00 – Bruno Diniz')
    expect(texto.split('Férias/Licenças')[1].trim()).toBe('—')
  })

  it('fronteira exata: 4 dos 7 dias (57%) já conta como férias', () => {
    const ferias4Dias = semDecisao({
      id: 13, usuario_id: 'bruno', data_inicio: '2026-08-17', data_fim: '2026-08-20',
      status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '', tipo: 'FERIAS', eh_operador_h3: true,
    })
    const texto = gerarTextoRelatorioSemanal('2026-08-14', escalas, [ferias4Dias], usuarios)
    expect(texto).toContain('H2 - 14h00 às 23h00 – —')
    expect(texto.split('Férias/Licenças')[1]).toContain('Bruno Diniz')
  })

  it('quem conta como férias (≥50%) aparece com o período concreto, não só o nome — caso real Caique/Kilson', () => {
    const feriasDoCaique = semDecisao({
      id: 14, usuario_id: 'caique', data_inicio: '2026-08-20', data_fim: '2026-08-28',
      status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '', tipo: 'FERIAS', eh_operador_h3: true,
    })
    // Sexta 21/08 a Quinta 27/08 — os 7 dias inteiros dentro da férias.
    const texto = gerarTextoRelatorioSemanal('2026-08-21', escalas, [feriasDoCaique], usuarios)
    expect(texto).toContain('Caique Silva - 20/08/2026 à 28/08/2026')
  })

  it('dois pedidos aprovados contíguos (sem intervalo) do mesmo utilizador contam como um único ciclo ininterrupto', () => {
    const primeiroPedido = semDecisao({
      id: 15, usuario_id: 'caique', data_inicio: '2026-08-15', data_fim: '2026-08-19',
      status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '', tipo: 'FERIAS', eh_operador_h3: true,
    })
    // Começa logo no dia seguinte ao fim do primeiro — sem intervalo nenhum.
    const segundoPedido = semDecisao({
      id: 16, usuario_id: 'caique', data_inicio: '2026-08-20', data_fim: '2026-08-25',
      status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '', tipo: 'FERIAS', eh_operador_h3: true,
    })
    const texto = gerarTextoRelatorioSemanal('2026-08-14', escalas, [primeiroPedido, segundoPedido], usuarios)
    // Um só ciclo, 15 a 25/08 — nunca aparece a fronteira interna (19 ou 20/08).
    expect(texto).toContain('Caique Silva - 15/08/2026 à 25/08/2026')
    expect(texto.match(/Caique Silva/g)?.length).toBe(1)
  })

  it('um intervalo real entre dois pedidos (a pessoa esteve mesmo cá) quebra o ciclo — cada um conta pelo seu próprio período', () => {
    const feriasDeJulho = semDecisao({
      id: 17, usuario_id: 'caique', data_inicio: '2026-07-01', data_fim: '2026-07-10',
      status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '', tipo: 'FERIAS', eh_operador_h3: true,
    })
    const feriasDeAgosto = semDecisao({
      id: 18, usuario_id: 'caique', data_inicio: '2026-08-17', data_fim: '2026-08-24',
      status: 'APROVADA', aprovado_por: null, data_aprovacao: null, criado_em: '', tipo: 'FERIAS', eh_operador_h3: true,
    })
    const texto = gerarTextoRelatorioSemanal('2026-08-14', escalas, [feriasDeJulho, feriasDeAgosto], usuarios)
    expect(texto).toContain('Caique Silva - 17/08/2026 à 24/08/2026')
    expect(texto).not.toContain('01/07/2026')
  })
})

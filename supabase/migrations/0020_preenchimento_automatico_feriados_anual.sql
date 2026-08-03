-- =====================================================================
-- Preenchimento automático dos feriados nacionais/municipais (Lisboa)
-- do ano seguinte, sem intervenção manual — pedido do Gerente em
-- 2026-08-03, depois de o feriado de 8 de Dezembro (Imaculada
-- Conceição) e o Corpo de Deus terem ficado de fora do calendário de
-- 2026 por esquecimento manual, e de não existir nenhum feriado
-- carregado para 2027 em diante.
--
-- Corre uma vez por ano (agendado via pg_cron mais abaixo, 1 de
-- Novembro às 02:00 UTC — uma hora antes de preencher_escala_anual;
-- não há dependência real entre as duas funções, é só para manter as
-- duas na mesma janela anual de manutenção, fora de horas).
--
-- Datas fixas: Ano Novo, Dia da Liberdade, Dia do Trabalho, Dia de
-- Camões, Santo António (Lisboa, municipal), Assunção de Maria,
-- Implantação da República, Finados, Restauração da Independência,
-- Imaculada Conceição, Natal.
--
-- Datas móveis, calculadas a partir da Páscoa via calcular_pascoa()
-- (algoritmo de Gauss/Meeus para a Páscoa gregoriana — verificado
-- contra 2024 = 31/03, 2025 = 20/04 e o valor já corrigido de 2026 =
-- 05/04 em 0010_correcao_feriados_2026.sql, antes de confiar nele
-- para anos futuros): Carnaval (Páscoa-47), Sexta-feira Santa
-- (Páscoa-2), Domingo de Páscoa, Corpo de Deus (Páscoa+60).
--
-- Idempotente: não faz nada se já existir alguma linha para o ano-
-- alvo (mesmo padrão de preencher_escala_anual), e o próprio insert
-- usa "on conflict (data) do nothing" como segunda rede de segurança
-- — feriados_portugal já tem unique(data).
-- =====================================================================

create or replace function calcular_pascoa(p_ano int)
returns date
language plpgsql
immutable
as $function$
declare
    a int := p_ano % 19;
    b int := p_ano / 100;
    c int := p_ano % 100;
    d int := b / 4;
    e int := b % 4;
    f int := (b + 8) / 25;
    g int := (b - f + 1) / 3;
    h int := (19*a + b - d - g + 15) % 30;
    i int := c / 4;
    k int := c % 4;
    l int := (32 + 2*e + 2*i - h - k) % 7;
    m int := (a + 11*h + 22*l) / 451;
    v_mes int := (h + l - 7*m + 114) / 31;
    v_dia int := ((h + l - 7*m + 114) % 31) + 1;
begin
    return make_date(p_ano, v_mes, v_dia);
end;
$function$;

create or replace function preencher_feriados_anual()
returns void
language plpgsql
as $function$
declare
    v_ano int := extract(year from current_date)::int + 1;
    v_pascoa date;
    v_total int := 0;
begin
    if exists (select 1 from feriados_portugal where ano = v_ano) then
        insert into logs_auditoria (referencia_tipo, acao, descricao_detalhada)
        values ('FERIADOS_ANUAL', 'PREENCHIMENTO_AUTOMATICO_IGNORADO',
                format('Já existiam feriados para %s — preenchimento automático não repetido.', v_ano));
        return;
    end if;

    v_pascoa := calcular_pascoa(v_ano);

    insert into feriados_portugal (data, nome, tipo, ano) values
        (make_date(v_ano, 1, 1),   'Ano Novo',                     'NACIONAL', v_ano),
        (v_pascoa - 47,            'Carnaval',                     'NACIONAL', v_ano),
        (v_pascoa - 2,             'Sexta-feira Santa',            'NACIONAL', v_ano),
        (v_pascoa,                 'Domingo de Páscoa',            'NACIONAL', v_ano),
        (make_date(v_ano, 4, 25),  'Dia da Liberdade',             'NACIONAL', v_ano),
        (make_date(v_ano, 5, 1),   'Dia do Trabalho',              'NACIONAL', v_ano),
        (v_pascoa + 60,            'Corpo de Deus',                'NACIONAL', v_ano),
        (make_date(v_ano, 6, 10),  'Dia de Camões',                'NACIONAL', v_ano),
        (make_date(v_ano, 6, 13),  'Santo António (Lisboa)',       'LISBOA',   v_ano),
        (make_date(v_ano, 8, 15),  'Assunção de Maria',            'NACIONAL', v_ano),
        (make_date(v_ano, 10, 5),  'Implantação da República',     'NACIONAL', v_ano),
        (make_date(v_ano, 11, 1),  'Finados',                      'NACIONAL', v_ano),
        (make_date(v_ano, 12, 1),  'Restauração da Independência', 'NACIONAL', v_ano),
        (make_date(v_ano, 12, 8),  'Imaculada Conceição',          'NACIONAL', v_ano),
        (make_date(v_ano, 12, 25), 'Natal',                        'NACIONAL', v_ano)
    on conflict (data) do nothing;

    get diagnostics v_total = row_count;

    insert into logs_auditoria (referencia_tipo, acao, descricao_detalhada)
    values ('FERIADOS_ANUAL', 'PREENCHIMENTO_AUTOMATICO',
            format('Feriados de %s preenchidos automaticamente — %s linhas.', v_ano, v_total));
exception
    when others then
        insert into logs_auditoria (referencia_tipo, acao, descricao_detalhada)
        values ('FERIADOS_ANUAL', 'PREENCHIMENTO_AUTOMATICO_ERRO',
                format('Falhou a preencher feriados de %s: %s', v_ano, sqlerrm));
end;
$function$;

select cron.schedule(
    'preencher-feriados-anual',
    '0 2 1 11 *',
    $$select preencher_feriados_anual();$$
);

-- =====================================================================
-- preencher_feriados_anual() (migração 0020) grava o feriado de 1 de
-- Novembro como "Finados" — nome errado. Em Portugal, 1 de Novembro é
-- "Dia de Todos os Santos" (feriado nacional obrigatório); "Dia de
-- Finados" é 2 de Novembro e não é feriado. A data já estava certa,
-- só o nome mostrado na Escala e no Início (EscalaPage.tsx, InicioPage.tsx,
-- via feriados_portugal.nome) estava errado.
--
-- Achado ao peer-review do preenchimento automático de 2027 (2026-09-10).
-- Corrige o nome para os anos ainda por gerar (a função passa a gravar
-- "Todos os Santos" — sem "Dia de", mesmo padrão de brevidade já usado
-- em "Imaculada Conceição", "Assunção de Maria", "Restauração da
-- Independência") e faz o update pontual do único ano já gravado (2026).
-- =====================================================================

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
        (make_date(v_ano, 11, 1),  'Todos os Santos',              'NACIONAL', v_ano),
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

update feriados_portugal set nome = 'Todos os Santos' where ano = 2026 and nome = 'Finados';

begin;
select plan(8);

-- A função de elegibilidade recebe a data de referência como argumento para
-- testar os limites de dezembro em qualquer mês, sem depender do relógio.
select tests.autenticar_como(gen_random_uuid());

select ok(
    public.pedido_ferias_ano_permitido('2026-06-15', 'FERIAS', '2026-12-01'),
    'férias com início no ano corrente continuam permitidas'
);
select ok(
    public.pedido_ferias_ano_permitido('2026-06-15', 'LICENCA', '2026-12-01'),
    'licenças no ano corrente continuam permitidas'
);
select ok(
    public.pedido_ferias_ano_permitido('2027-01-01', 'FERIAS', '2026-12-01'),
    'férias com início em janeiro do ano seguinte são permitidas desde 1 de dezembro'
);
select ok(
    public.pedido_ferias_ano_permitido('2027-01-31', 'FERIAS', '2026-12-31'),
    'férias com início em janeiro do ano seguinte são permitidas até 31 de dezembro'
);
select ok(
    not public.pedido_ferias_ano_permitido('2027-01-01', 'FERIAS', '2026-11-30'),
    'férias para janeiro do ano seguinte ainda são recusadas em novembro'
);
select ok(
    not public.pedido_ferias_ano_permitido('2027-02-01', 'FERIAS', '2026-12-01'),
    'em dezembro, fevereiro do ano seguinte continua recusado'
);
select ok(
    not public.pedido_ferias_ano_permitido('2027-01-01', 'LICENCA', '2026-12-01'),
    'a exceção de janeiro não permite antecipar licenças'
);
select ok(
    public.pedido_ferias_ano_permitido('2027-02-01', 'FERIAS', '2027-01-01'),
    'a partir de janeiro, férias para outros meses do ano corrente são permitidas'
);

select * from finish();
rollback;

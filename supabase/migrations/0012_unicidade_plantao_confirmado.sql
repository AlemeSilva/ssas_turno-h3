-- =====================================================================
-- Previne dois plantonistas confirmados (voluntario=true) para o
-- mesmo feriado — plantonistaDoDia()/feriados_sem_plantao só contam
-- o primeiro, uma segunda escolha simultânea ficaria gravada mas
-- invisível na grelha. Índice único parcial rejeita a segunda
-- inserção em vez de a deixar órfã.
-- =====================================================================

create unique index if not exists plantao_voluntarios_unico_confirmado
  on plantao_voluntarios (data_feriado)
  where voluntario = true;

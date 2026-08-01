-- =====================================================================
-- Substituto escolhido para uma ausência (férias/licença).
--
-- A migração 0008 desenhou "Confirmar" deliberadamente como um botão
-- cego — registava QUE a cobertura tinha sido tratada, mas nunca QUEM
-- cobria (isso ficava fora da app). Decisão revertida agora: a página
-- Início passa a apresentar a equipa para o Gerente escolher, e essa
-- escolha grava-se aqui. `confirmado_por` mantém o significado
-- original (quem geriu a confirmação); `substituto_id` é novo e
-- guarda quem cobre.
-- =====================================================================

alter table ferias add column if not exists substituto_id uuid references usuarios(id);

comment on column ferias.substituto_id is 'Pessoa que cobre esta ausência, escolhida pelo Gerente/delegado na página Início ao confirmar. Distinto de confirmado_por (quem geriu a confirmação, não quem substitui).';

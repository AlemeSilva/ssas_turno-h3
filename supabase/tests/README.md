# CAMADA 1 — Base de Dados & Contratos (pgTAP)

Testa os contratos que a base de dados garante por si própria: schema,
triggers de regra de negócio (férias, escala H3, manutenção, checklist
imutável, trocas, delegação, catálogo de cadeias) e políticas de RLS —
tentando escrever diretamente na API como cada perfil tentaria, não só
através da interface.

## Como correr

O ambiente onde a aplicação é construída não tem Docker nem o Supabase
CLI instalados, por isso `supabase test db` (o caminho oficial, descrito
abaixo) nunca correu aqui. Em vez disso, a suite já foi executada com
sucesso diretamente contra a base de produção (89/89 em 2026-08-14),
sempre dentro de `begin; ... rollback;` — nenhum ficheiro depende de
Docker para correr, só de acesso Postgres direto (via `psql` — instalado
neste ambiente através de `brew install libpq`, keg-only, binário em
`/opt/homebrew/opt/libpq/bin/psql`).

Caminho oficial (Postgres local, recomendado para desenvolvimento):

1. Instalar o [Supabase CLI](https://supabase.com/docs/guides/cli) e o Docker Desktop.
2. Na raiz do projeto: `supabase init` (se ainda não existir `supabase/config.toml`).
3. `supabase start` — sobe um Postgres local com pgTAP disponível.
4. `supabase test db` — aplica as migrações e corre todos os ficheiros
   `supabase/tests/*.sql` por ordem alfabética, cada um dentro de uma
   transação revertida no fim (não deixa dados de teste na base).

## Estrutura

- `00_helpers.sql` — `tests.criar_usuario()` e `tests.autenticar_como()`,
  simulam um utilizador autenticado definindo `request.jwt.claims`
  (o mesmo mecanismo que `auth.uid()` lê em produção).
- `01_schema.sql` — existência de tabelas/colunas críticas.
- `02_trigger_turno_h3.sql` — só `OPERADOR_H3` pode ocupar H3.
- `03_trigger_ferias.sql` — sobreposição entre colegas, saldo de 22
  dias úteis, conflito com escala já atribuída.
- `04_calcula_tipo_fim_semana.sql` — regra do último Sábado do mês em
  vários meses/fronteiras, e o override manual do Gerente.
- `05_checklist_imutavel.sql` — trigger bloqueia UPDATE pós-conclusão;
  `destravar_checklist_item` é o único caminho de correção.
- `06_trocas_e_delegacao.sql` — substituto de troca tem de ser
  `OPERADOR_H3`; aprovação aplica-se de imediato à escala; delegação
  sem sobreposição e aditiva (titular mantém o poder).
- `07_rls_permissoes.sql` — o teste mais importante de segurança:
  cada perfil a tentar escrever diretamente via SQL, incluindo a
  reatribuição dinâmica de permissão quando uma troca é aprovada a
  meio da semana.
- `08_gestao_cadeias.sql` — adicionar/desativar cadeias; proteção
  contra apagar uma cadeia com histórico.
- `09_ferias_semanas_turno_fixo_plantao.sql` — substituto de férias por
  semana civil (RLS + unicidade); `turno_fixo` só H1/H4 e só para
  OPERADOR; `plantao_voluntarios` — primeira escolha aberta a
  Gerente/delegado, alterar uma já confirmada exclusiva do titular.
- `10_tarefas_plano_edicao.sql` — RLS de `tarefas_plano` distingue
  origem: o operador do ciclo insere tarefas TEMPLATE (criarPlano) mas
  só edita/apaga as suas EXCECIONAL, nunca TEMPLATE/MANUTENCAO;
  `atualizado_em` avança em cada UPDATE (bloqueio otimista do
  frontend); edição normal fica em `logs_auditoria` mesmo sem reabrir
  aprovação.
- `11_tarefas_excecionais_conclusao.sql` — concluir uma tarefa
  excecional (bloco próprio no Checklist Ativo) não reabre a aprovação
  do plano, ao contrário de uma edição de conteúdo real (regressão);
  fica imutável depois de concluída, só `destravar_tarefa_plano`
  reverte, reservado a Gerente/delegado; destravar não duplica o
  registo de auditoria da conclusão.
- `12_aprovacao_operador_h3.sql` — o operador do ciclo aprova o seu
  próprio plano (não só Gerente/delegado), mas nunca o de outro ciclo;
  não se pode creditar outra pessoa como aprovador (RLS `with check`);
  ninguém salta Rascunho→Aprovado direto, nem o Gerente (trigger
  `trg_planos_transicao_aprovacao`) — nota no ficheiro da migração
  0033 sobre porque isto não dá para fazer só com duas políticas RLS
  separadas (Postgres combina os `with check` de políticas permissivas
  por OR, não só o da política cujo `using` admitiu a linha).
- `13_trigger_escala_ferias_parcial.sql` — atribuir turno a uma semana
  só é bloqueado quando férias/licença aprovadas cobrem os 7 dias
  inteiros (um só registo ou vários não contíguos somados); havendo
  pelo menos 1 dia livre, a mudança de turno é sempre aceite (migração
  0034, caso real: Caique, 2026-08-27).
- `14_preencher_escala_anual_trio_generico.sql` — o preenchimento
  automático anual (cron 1 Nov) deixa de depender de 3 nomes fixos:
  qualquer conjunto de OPERADOR_H3 ativos, mínimo 3 (falha controlada
  e específica por contagem se houver menos), sem máximo; H2 respeita
  `elegivel_h2` por pessoa em vez de nomes hardcoded (migração 0035).
- `15_preencher_escala_anual_falha_isolada.sql` — uma semana com
  conflito (ex.: férias a cobrir a semana toda) já não deita fora o
  ano inteiro; savepoint por semana isola a falha, as restantes 51 são
  geradas com sucesso, e a entrada de auditoria fica classificada
  ERRO — não sucesso — para não esconder o aviso do Achado #1
  (migração 0036).
- `16_preencher_escala_anual_avisos.sql` — um pool de candidatos vazio
  (ninguém com turno_fixo=H1, nem H4, nem elegivel_h2) já não é
  silencioso: a escala é gerada na mesma, mas a auditoria fica
  classificada AVISO (âmbar no AlertBar, não vermelho — é um estado
  válido, não uma falha) e menciona qual turno ficou sem ninguém
  (migração 0037).
- `17_preencher_escala_anual_gerente_titular.sql` — com 2+ Gerentes
  ativos em simultâneo (handover/transição), só o mais antigo
  (`criado_em`) recebe H4 automaticamente — antes, todos recebiam;
  aviso (mesma classificação do Achado #3) menciona quantos Gerentes
  estão ativos, para atribuição manual dos restantes se for o caso
  (migração 0038).
- `18_headcount_ideal.sql` — calculadora de headcount ideal (migração
  0039): dois níveis de acesso (titular+delegado só leem e preenchem o
  rascunho do mês; só titular edita parâmetros e fecha o mês), cada um
  imposto por RLS e reforçado dentro das próprias funções `security
  definer`; capacidade presente conta dias de calendário distintos
  (nunca soma a duração de férias e licença sobrepostas na mesma
  pessoa); recorte de férias às fronteiras do mês; capacidade plena
  por pessoa não depende do headcount; mês fechado fica imutável mesmo
  em bypass de RLS; guardas do fecho (sem rascunho, mês por terminar,
  pedidos por preencher, já fechado); alteração de parâmetro fica em
  auditoria; `garantir_rascunho_headcount_mensal` recupera atraso de
  vários meses a partir do último fechado, não só o mais recente.

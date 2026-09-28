# Base de dados: referência técnica

**Estado:** levantado a 2026-09-27 diretamente da base de produção (catálogo do Postgres — `pg_class`, `pg_proc`, `pg_policies`, `pg_constraint`, comentários de coluna — não só das migrações); reconfirmado a 2026-09-28 (migrações 0062-0064). É o **inventário**: o que existe e como se liga. **O porquê de cada regra** está no ficheiro da funcionalidade dona (a tabela da secção 8 aponta para lá); este ficheiro não repete essas explicações.
**Ler quando:** criar uma tabela, coluna, função, gatilho ou índice; perceber uma referência entre tabelas; escrever uma migração; investigar o catálogo. Para permissões (RLS) ver `docs/perfis-e-permissoes.md`; para as Edge Functions e os agendamentos, `docs/edge-functions.md`.

## 1. Como está organizada

Um único schema `public`, num projeto Supabase (Postgres). **Todas as 17 tabelas têm RLS ligada**; não há tabela pública sem política. As migrações vivem em `supabase/migrations/`, numeradas e aplicadas por ordem, à mão (`docs/operacao.md`); não há tipos gerados a partir do esquema (`src/types/database.ts` é escrito à mão).

## 2. Tipos enumerados

| Enum | Valores |
| --- | --- |
| `perfil_usuario` | `OPERADOR`, `OPERADOR_H3`, `GERENTE` |
| `turno_tipo` | `H1`, `H2`, `H3`, `H4` |
| `status_ferias` | `PENDENTE`, `APROVADA`, `REJEITADA` |
| `tipo_ausencia` | `FERIAS`, `LICENCA` |
| `status_troca` | `PROPOSTA`, `APROVADA`, `REJEITADA` |
| `status_plano` | `RASCUNHO`, `PENDENTE_APROVACAO`, `APROVADO`, `EM_EXECUCAO`, `CONCLUIDO` |
| `tipo_fim_semana` | `NORMAL`, `MANUTENCAO` |
| `origem_tarefa` | `TEMPLATE`, `MANUTENCAO`, `EXCECIONAL` |
| `status_tarefa` | `PENDENTE`, `EM_ANDAMENTO`, `CONCLUIDO`, `ATRASADO` |
| `secao_checklist` | `PREPARACAO`, `REUNIAO`, `BATCH_SEX_SAB`, `BATCH_SAB_DOM`, `BATCH_DOM_SEG` |
| `status_cadeia` | `PENDENTE`, `EM_ANDAMENTO`, `CONCLUIDO_AUTOMATICO`, `CONCLUIDO_MANUAL`, `ATRASADO` |
| `categoria_cadeia` | `NORMAL`, `ASTERISCO`, `DUPLO_ASTERISCO` |

## 3. Extensões instaladas

`pg_cron` (agendamentos, secção 10), `pgcrypto`, `uuid-ossp`, `pg_net` (chamadas HTTP a partir da base — hoje sem uso confirmado, `docs/edge-functions.md` EDG-06), `btree_gist` (índices/exclusões avançadas), `pg_stat_statements`, `supabase_vault` (cofre de segredos — hoje vazio), `plpgsql`.

## 4. Tabelas

Convenção: **PK** = chave primária; **FK** = chave estrangeira; "RLS" remete para `docs/perfis-e-permissoes.md`. Colunas óbvias (`id`, `criado_em`) não se voltam a explicar tabela a tabela.

### `usuarios`

A equipa: contas e perfil. PK `id` (é também o `id` de `auth.users`, com `ON DELETE RESTRICT` — não se apaga um utilizador Auth com perfil por baixo). `email` único. `perfil` (`perfil_usuario`), `empresa` (por omissão "Accenture"), `ativo`, `data_saida`, `limite_h3_mensal` (só `OPERADOR_H3`, definido ao registar), `turno_fixo` (`H1`/`H4`, só `OPERADOR`), `elegivel_h2` (só `OPERADOR_H3`). Restrições: `data_saida` nula ou ≥ hoje enquanto ativo; `turno_fixo` só em `OPERADOR` e só H1/H4; `elegivel_h2` só em `OPERADOR_H3`; **índice único parcial** garante **um só `GERENTE` ativo** (`ux_usuarios_gerente_titular_unico`). Gatilho: `trg_usuarios_desativado_limpa_futuro` (USR-08). Detalhe de regras: `docs/utilizadores-e-saidas.md`.

### `escala_semanal`

Uma linha = um turno de uma pessoa numa semana (`semana_ref`, sempre sábado). PK `id`; **único** (`semana_ref`, `usuario_id`) — uma pessoa não tem duas linhas na mesma semana. Índices por `semana_ref`, por `usuario_id` e por (`semana_ref`, `turno`). Gatilhos: `trg_escala_semanal_valida_h3`, `_valida_um_h3`, `_valida_limite_h3_mensal`, `_valida_ferias`. Detalhe: `docs/turnos-e-rotacao.md`, `docs/calendario-h3.md`.

### `ferias`

Um pedido de férias ou licença. PK `id`. `tipo` (`tipo_ausencia`), `status` (`status_ferias`), `data_inicio`/`data_fim` (`data_fim ≥ data_inicio`), `aprovado_por`, `data_aprovacao`. `eh_operador_h3`: fotografia do perfil no momento do pedido — **o comentário da coluna na base ainda diz "usado pela exclusion constraint"; essa exclusion constraint já não existe** (a regra de não-sobreposição passou a geral em todos os perfis na migração 0044): comentário desatualizado, sem efeito prático (`docs/ferias-e-plantoes.md`, FER-06). Índices por `usuario_id` e por (`data_inicio`, `data_fim`). Gatilhos: `trg_valida_ferias`, `trg_ferias_marca_perfil_h3`.

### `ferias_semanas`

A decisão de substituto de **uma semana civil** de um pedido de férias. PK `id`, FK `ferias_id` (`ON DELETE CASCADE`), `substituto_id`, `confirmado_por`/`confirmado_em`. Único (`ferias_id`, `semana_inicio`). Gatilho: `trg_ferias_semanas_valida` (recusa `substituto_id` igual ao `usuario_id` da ausência; migração 0063). Detalhe: `docs/ferias-e-plantoes.md`.

### `plantao_voluntarios`

Quem cobre um feriado. PK `id`, único (`data_feriado`, `usuario_id`); **índice único parcial** garante **um só confirmado por feriado** (`plantao_voluntarios_unico_confirmado`, `WHERE voluntario = true`). `voluntario` (true = ofereceu-se ou foi designado; false = recusou ou não se pronunciou).

### `delegacoes_aprovacao`

Uma janela em que `substituto` tem os poderes de `gerente_titular`. PK `id`; `data_fim ≥ data_inicio`; `substituto ≠ gerente_titular` (`chk_delegacao_substituto_diferente`, migração 0063). Gatilho: `trg_delegacao_valida`.

### `trocas_escala`

Uma proposta de troca de H3. PK `id`, `usuario_proponente`, `usuario_substituto`, `semana_ref` (sábado), `status` (`status_troca`), `aprovado_por`/`data_aprovacao`, `justificativa`. Índice por `semana_ref`. Gatilhos: `trg_valida_troca` (antes), `trg_aplica_troca_aprovada` (depois, só em `UPDATE`).

### `feriados_portugal`

O calendário de feriados. PK `id`, `data` única, `ano`, `tipo` (`NACIONAL` ou `LISBOA`). Índices por `data` e por `ano`. Sem nenhuma escrita permitida pelo browser (só a função anual ou SQL).

### `planos`

O Plano de Fim de Semana de um ciclo. PK `id`, `data_inicio_ciclo` **única** (quinta-feira), `tipo_fim_semana` (`tipo_fim_semana`) e `tipo_fim_semana_manual` (true = alguém corrigiu à mão o tipo calculado), `status` (`status_plano`), `criado_por`/`aprovado_por`/`data_aprovacao`. Gatilhos: `trg_planos_default_tipo`, `trg_planos_transicao_aprovacao`.

### `tarefas_plano`

Uma tarefa do plano. PK `id`, FK `id_plano` (`ON DELETE CASCADE`), `data_execucao`, `hora_arranque`, `dt_previsao`, `hr_previsao_termino`, `hr_limite`, `status` (`status_tarefa`), `origem` (`origem_tarefa`), `executado_por`, `dt_hr_conclusao_real`, `destravado_por`/`destravado_em`/`destravado_motivo`. Índice por `id_plano`. Gatilhos: `trg_tarefas_plano_toca_atualizado_em`, `trg_tarefas_plano_imutavel`, `trg_tarefas_reabre_aprovacao` (depois, em `INSERT`/`UPDATE`/`DELETE`).

### `checklist_itens`

Um item de checklist de uma secção do plano. PK `id`, FK `id_plano` (`ON DELETE CASCADE`), `secao` (`secao_checklist`), `concluido`, `concluido_por`/`data_hora_conclusao`, `destravado_por`/`destravado_em`/`destravado_motivo`. Índice por `id_plano`. Gatilho: `trg_checklist_itens_imutavel`.

### `cadeias_diarias`

O acompanhamento de uma cadeia, num dia e secção de um plano. PK `id`, FK `id_plano` (`ON DELETE CASCADE`), FK `nome_cadeia` → `cadeias_catalogo`, único (`id_plano`, `secao`, `nome_cadeia`), `status` (`status_cadeia`). Índice por `id_plano`.

### `cadeias_catalogo`

O catálogo de cadeias (secção 1 de `docs/definicoes.md`). PK `nome_cadeia` (texto, é a própria chave — DEF-02), `categoria` (`categoria_cadeia`), `ordem`, `ativo`. Gatilho: `trg_cadeias_catalogo_protege_historico` (antes de apagar).

### `gir_fl_dependencias`

Quais cadeias atrasam o alerta GIR_FL. PK `nome_cadeia`, FK → `cadeias_catalogo` (`ON DELETE CASCADE`).

### `logs_auditoria`

O registo que só cresce. PK `id`, `referencia_tipo` (texto livre), `referencia_id`, `id_usuario`, `acao` (texto livre), `descricao_detalhada`, `delegacao_id` (FK → `delegacoes_aprovacao`). Índices por (`referencia_tipo`, `referencia_id`), por `id_usuario` e por `data_hora`. Gatilho: `trg_logs_auditoria_marca_delegacao` (antes de inserir, preenche `delegacao_id`). Catálogo completo de ações: `docs/historico.md`.

### `headcount_mensal`

Uma linha por mês (dia 1 obrigatório, `chk_headcount_mensal_primeiro_dia`), rascunho ou fechada. PK `id`, `mes_referencia` única. As colunas e o significado de cada uma: `docs/headcount.md`. Gatilhos: `trg_headcount_mensal_toca_atualizado_em`, `trg_headcount_mensal_bloqueia_reabertura`.

### `headcount_parametros`

Uma só linha (`id boolean`, `CHECK (id = true)`). Colunas e valores iniciais: `docs/headcount.md`. Gatilho: `trg_headcount_parametros_before_update` (grava quem alterou e audita antes e depois).

## 5. Vistas

| Vista | Opções | Para que serve |
| --- | --- | --- |
| `feriados_sem_plantao` | `security_invoker=true` | Feriados do ano corrente sem plantonista **ativo** confirmado, com quem é o H3 e os voluntários. Corrigida a 2026-09-25 (migração 0060) para ignorar quem já saiu. **Nenhum ecrã a usa hoje** (`docs/ferias-e-plantoes.md`, FER-12). |

`security_invoker=true` quer dizer que a vista corre com as permissões de quem a consulta, não do dono — por isso obedece à mesma RLS que as tabelas por baixo.

## 6. Funções (visão de catálogo)

A lista funcional (o que cada uma decide) está nos ficheiros de cada funcionalidade; aqui só o inventário e o que é comum.

- **De cálculo/leitura, sem efeitos** (`STABLE` ou sem gravação): `dias_uteis`, `dias_uteis_sem_feriados`, `calcula_tipo_fim_semana`, `calcular_pascoa`, `operador_do_ciclo`, `is_gerente_ou_delegado`, `is_gerente_titular`, `is_operador_do_ciclo`, `pode_editar_plano`, `delegacao_ativa_id`, `calcular_headcount` (esta última só concede leitura ao Gerente/delegado, por dentro).
- **Que escrevem, chamáveis pelo ecrã com verificação por dentro**: `fechar_mes_headcount`, `garantir_rascunho_headcount_mensal`, `destravar_checklist_item`, `destravar_tarefa_plano`.
- **Que escrevem, só do servidor** (`EXECUTE` restrito a `postgres`/`service_role`, revogado de `anon`/`authenticated`): `limpar_dados_futuros_de_utilizador`, `revogar_sessoes_utilizador` (corrigido a 2026-09-25, migração 0059 — antes qualquer pessoa com a chave pública conseguia terminar a sessão de qualquer utilizador, provado numa transação revertida), a função por trás do gatilho de desativação.
- **Agendadas** (chamadas só pelo `pg_cron`, sem verificação de chamador por dentro — não precisam, ninguém as chama por HTTP): `preencher_escala_anual`, `preencher_feriados_anual` (`docs/preenchimento-anual-de-novembro.md`).
- **Gatilhos** (`trg_*`, executadas só pelo Postgres ao disparar): listadas na secção 7. A maioria não é `SECURITY DEFINER`; são as que precisam de privilégio elevado para escrever fora da tabela do próprio gatilho (auditoria, delegação, limpeza) que o são.

## 7. Gatilhos

| Tabela | Gatilho | Quando | Função |
| --- | --- | --- | --- |
| `usuarios` | `trg_usuarios_desativado_limpa_futuro` | depois de `ativo` passar de verdadeiro a falso | `trg_limpa_dados_futuros_ao_desativar` |
| `escala_semanal` | `trg_escala_semanal_valida_h3` | antes de inserir/alterar | `trg_valida_turno_h3` |
| `escala_semanal` | `trg_escala_semanal_valida_um_h3` | antes de inserir/alterar | `trg_valida_um_h3_por_semana` |
| `escala_semanal` | `trg_escala_semanal_valida_limite_h3_mensal` | antes de inserir/alterar | `trg_valida_limite_h3_mensal` |
| `escala_semanal` | `trg_escala_semanal_valida_ferias` | antes de inserir/alterar | `trg_valida_escala_sobre_ferias` |
| `ferias` | `trg_ferias_valida` | antes de inserir/alterar | `trg_valida_ferias` |
| `ferias` | `trg_ferias_marca_perfil_h3_before` | antes de inserir/alterar | `trg_ferias_marca_perfil_h3` |
| `ferias_semanas` | `trg_ferias_semanas_valida` | antes de inserir/alterar | `trg_valida_ferias_semanas` |
| `trocas_escala` | `trg_trocas_valida` | antes de inserir/alterar | `trg_valida_troca` |
| `trocas_escala` | `trg_trocas_aplica` | depois de alterar | `trg_aplica_troca_aprovada` |
| `delegacoes_aprovacao` | `trg_delegacao_valida` | antes de inserir/alterar | `trg_valida_delegacao` |
| `planos` | `trg_planos_tipo` | antes de inserir/alterar | `trg_planos_default_tipo` |
| `planos` | `trg_planos_transicao_aprovacao` | antes de alterar | `trg_planos_transicao_aprovacao` |
| `tarefas_plano` | `trg_tarefas_plano_atualizado_em` | antes de alterar | `trg_tarefas_plano_toca_atualizado_em` |
| `tarefas_plano` | `trg_tarefas_plano_imutavel` | antes de alterar | `trg_tarefas_plano_imutavel` |
| `tarefas_plano` | `trg_tarefas_plano_reabre` | depois de inserir/alterar/apagar | `trg_tarefas_reabre_aprovacao` |
| `checklist_itens` | `trg_checklist_itens_imutavel` | antes de alterar | `trg_checklist_imutavel` |
| `cadeias_catalogo` | `trg_cadeias_catalogo_protege_historico` | antes de apagar | `trg_impede_apagar_cadeia_com_historico` |
| `logs_auditoria` | `trg_logs_auditoria_marca_delegacao` | antes de inserir | `trg_logs_auditoria_marca_delegacao` |
| `headcount_mensal` | `trg_headcount_mensal_atualizado_em` | antes de alterar | `trg_headcount_mensal_toca_atualizado_em` |
| `headcount_mensal` | `trg_headcount_mensal_bloqueia_reabertura` | antes de alterar | `trg_headcount_mensal_imutavel` |
| `headcount_parametros` | `trg_headcount_parametros_before_update` | antes de alterar | `trg_headcount_parametros_auditoria` |

Todos `FOR EACH ROW`; nenhum gatilho `FOR EACH STATEMENT` nas tabelas de negócio (os únicos do género são internos do `storage`, alheios a este projeto).

## 8. Onde cada tabela está explicada

| Tabela | Ficheiro |
| --- | --- |
| `usuarios` | `docs/utilizadores-e-saidas.md` |
| `escala_semanal` | `docs/turnos-e-rotacao.md`, `docs/escala.md`, `docs/calendario-h3.md` |
| `ferias`, `ferias_semanas`, `plantao_voluntarios` | `docs/ferias-e-plantoes.md` |
| `delegacoes_aprovacao`, `trocas_escala` | `docs/trocas-e-delegacao.md` |
| `feriados_portugal` | `docs/preenchimento-anual-de-novembro.md` |
| `planos`, `tarefas_plano` | `docs/plano-de-fim-de-semana.md` |
| `checklist_itens`, `cadeias_diarias` | `docs/checklist.md` |
| `cadeias_catalogo`, `gir_fl_dependencias` | `docs/definicoes.md`, `docs/alarmes.md` |
| `logs_auditoria` | `docs/historico.md` |
| `headcount_mensal`, `headcount_parametros` | `docs/headcount.md` |

Regras entre colegas (o porquê, entre pessoas): `docs/regras-entre-colegas.md`. RLS e funções de permissão: `docs/perfis-e-permissoes.md`.

## 9. Tempo real (`postgres_changes`)

Publicadas para atualização automática entre sessões (confirmado a 2026-09-27 por consulta direta a `pg_publication_tables`, 11 tabelas): `escala_semanal`, `ferias`, `ferias_semanas`, `plantao_voluntarios`, `trocas_escala`, `planos`, `tarefas_plano`, `checklist_itens`, `cadeias_diarias`, `cadeias_catalogo`, `gir_fl_dependencias`. **Não publicadas**: `usuarios`, `delegacoes_aprovacao`, `feriados_portugal`, `logs_auditoria`, `headcount_mensal`, `headcount_parametros`. Detalhe de quem escuta o quê: `docs/interface.md`, INT-08.

## 10. Agendamentos (`pg_cron`)

Ver `docs/edge-functions.md`, secção 6 — só dois trabalhos, ambos a 1 de novembro.

## 11. Migrações

64 migrações, de 2026-07-29 (`0001_schema`) a 2026-09-28 (`0064_backfill_feriados_plantao_e_policies_escala_diaria`), aplicadas por ordem, à mão (`docs/operacao.md`). `0001` cria a maioria das tabelas principais, mas **duas tabelas (`feriados_portugal`, `plantao_voluntarios`) e a vista `feriados_sem_plantao` nunca foram criadas por nenhuma das primeiras 61 migrações** — existiam em produção desde antes do histórico de migrações (o comentário da migração `0008_confirmacao_substituto_ferias.sql` já registava isso: "plantao_voluntarios existe desde antes desta sessão, tal como feriados_portugal e a view feriados_sem_plantao"), tal como 3 políticas RLS de `escala_semanal` (`escala_diaria_gerente_all`, `escala_diaria_operador_readonly`, `escala_diaria_operador_select` — ver `docs/perfis-e-permissoes.md`, secção 4). A migração `0064` (stress-test de documentação, 2026-09-28) fecha essa lacuna com `CREATE TABLE/POLICY IF NOT EXISTS`/`DROP POLICY IF EXISTS` — não mudou nada em produção (os objetos já existiam), só passou a permitir reconstruir o esquema do zero só a partir das migrações. Datas de criação e o que cada uma decidiu (agrupadas por tema, com a razão): `docs/decisoes.md`. Para o número exato de cada migração referida por uma regra, ver o ficheiro da funcionalidade (cada um cita as migrações relevantes).

## 12. Limites e lacunas conhecidos

- **Comentário desatualizado** em `ferias.eh_operador_h3` (secção 4): cita uma exclusion constraint que já não existe.
- **Comentário com nomes de pessoas** em `usuarios.elegivel_h2`: o comentário desta coluna, escrito num backfill de agosto de 2026, cita por nome quem ficou elegível ou não nessa migração. É só um comentário técnico do catálogo (não aparece em nenhum ecrã), mas está desatualizado como fonte de verdade — a coluna em si é o que vale.
- `logs_auditoria.referencia_tipo` e `logs_auditoria.acao` são **texto livre**, sem enum nem restrição: um valor novo não precisa de migração, mas também não há lista fechada a impor consistência de nomes (`docs/historico.md`, HIS-03/HIS-04).
- `pg_net` e `supabase_vault` estão instaladas e sem uso confirmado hoje.
- Não há tipos gerados automaticamente a partir do esquema; `src/types/database.ts` pode divergir silenciosamente de uma coluna nova até alguém o atualizar à mão.

## 13. Como reler o catálogo

Sem Docker nem Supabase CLI local, a única via é uma ligação direta (`docs/operacao.md` explica onde está a connection string). Consultas úteis: `select * from information_schema.columns where table_schema='public'`; `select * from pg_policies where schemaname='public'`; `select tgname, pg_get_triggerdef(oid) from pg_trigger where not tgisinternal`; `select proname, prosrc from pg_proc where pronamespace = 'public'::regnamespace`.

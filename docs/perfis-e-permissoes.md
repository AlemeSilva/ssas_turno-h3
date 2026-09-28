# Perfis, poderes e permissões

**Estado:** levantado a 2026-09-26 diretamente da base de produção (políticas RLS, permissões de tabelas e funções lidas do catálogo, não só das migrações). Decisões do Gerente: um só Gerente titular (2026-09-05, migração 0042); delegação de aprovação aditiva (migrações 0001, 0043, 0056); a base é a proteção real e o ecrã só esconde (regra desde o início do projeto).
**Ler quando:** alterar ou validar quem pode ver ou fazer o quê; criar uma tabela, função ou ecrã novo (decidir a política antes do ecrã); investigar "porque é que esta pessoa consegue (ou não consegue)…". As regras de comportamento entre colegas (quem decide o quê sobre quem) estão em `docs/regras-entre-colegas.md`; aqui está o mecanismo.

## 1. Princípios

- **PER-01** **A base decide; o ecrã só esconde.** A proteção real é a base de dados: políticas RLS, gatilhos e funções. Esconder um botão ou uma página é conveniência, nunca segurança: quem chame a base diretamente passa pelas mesmas regras. Por isso uma regra nova nunca fica só no ecrã.
- **PER-02** **Toda a tabela tem RLS ligada** e políticas explícitas. Uma tabela sem política para uma operação não a permite a ninguém pelo browser (só ao servidor). As permissões de tabela ao nível do Postgres são as predefinidas da plataforma (`anon`, `authenticated` e `service_role` têm todos os privilégios); **quem realmente restringe é a RLS**, mais os gatilhos.
- **PER-03** **Os poderes exigem estar ativo.** As funções de permissão só reconhecem um Gerente ou delegado com `ativo = true` (USR-01).
- **PER-04** Uma funcionalidade nova que **escreve** define primeiro a política (quem pode), depois o ecrã, e escreve um teste de permissões (`supabase/tests/07_rls_permissoes.sql` é o modelo).

## 2. Perfis e poderes

O perfil é o valor de `usuarios.perfil`; os poderes que vêm de uma delegação ou do ciclo não mudam o perfil.

| Poder | Como se obtém | Função da base |
| --- | --- | --- |
| **Gerente titular** | Perfil `GERENTE` e ativo. **Só um** ativo (USR-03) | `is_gerente_titular()` |
| **Gerente ou delegado** | Titular, **ou** uma pessoa ativa com uma delegação cuja janela (`data_inicio` a `data_fim`, inclusive) contém a data de hoje (UTC) | `is_gerente_ou_delegado()` |
| **Operador do ciclo** | O `OPERADOR_H3` **ativo** que tem H3 no sábado do ciclo (`semana_ref = data_inicio_ciclo + 2`) | `operador_do_ciclo(data_inicio_ciclo)`, `is_operador_do_ciclo(...)` |
| **Pode editar o plano** | Gerente ou delegado, ou o operador do ciclo desse plano | `pode_editar_plano(id_plano)` |
| **Delegação em vigor** (para marcar a auditoria) | A linha de `delegacoes_aprovacao` que dá poderes a quem chama, hoje | `delegacao_ativa_id()` |

- O perfil `OPERADOR_H3` roda entre H3, H2 e H4; o `OPERADOR` tem turno fixo H1 ou H4; o `GERENTE` não roda turnos (`docs/utilizadores-e-saidas.md`).
- Delegar é **aditivo**: o titular mantém os seus poderes; o delegado ganha os de Gerente **menos** o que é exclusivo do titular (COL-17).
- O ecrã pergunta à base se o utilizador é Gerente ou delegado ao iniciar a sessão (`AuthContext`, que chama `is_gerente_ou_delegado`) e volta a perguntar quando a sessão muda; se a delegação começar ou acabar a meio, o ecrã só o reconhece nessa altura ou ao recarregar (a base aplica-o logo).

## 3. Quem pode ler

- **Qualquer utilizador autenticado** lê: `usuarios`, `escala_semanal`, `ferias`, `ferias_semanas`, `trocas_escala`, `delegacoes_aprovacao`, `plantao_voluntarios`, `feriados_portugal`, `planos`, `tarefas_plano`, `checklist_itens`, `cadeias_diarias`, `cadeias_catalogo`, `gir_fl_dependencias` e `logs_auditoria`.
- **Só Gerente ou delegado** lê `headcount_mensal` e `headcount_parametros`.
- Sem sessão (`anon`) **não lê nada**: nenhuma política lhe dá acesso, e as que dependem de `auth.uid()` não têm a quem se aplicar. A única vista pública, `feriados_sem_plantao`, é `security_invoker`, por isso obedece às mesmas políticas de quem a consulta.
- **Atenção:** o que o ecrã esconde a operadores (a página de Histórico, com a auditoria, e a de Utilizadores) **não está escondido na base**: um operador que chame a API lê a auditoria e a lista de utilizadores (com emails). Ver a secção 7.

## 4. Quem pode escrever, tabela a tabela

"Gerente" quer dizer Gerente titular ou delegado (`is_gerente_ou_delegado()`); "titular" só o titular. A coluna **Tempo real** diz se a tabela está publicada para atualização automática entre sessões.

| Tabela | Inserir | Alterar | Apagar | Tempo real |
| --- | --- | --- | --- | --- |
| `usuarios` | Gerente (só o titular cria `GERENTE`) | Gerente (só o titular altera contas `GERENTE`) | ninguém pelo browser | não |
| `escala_semanal` | Gerente | Gerente | Gerente | sim |
| `ferias` | a própria pessoa, só em seu nome | a própria, **enquanto pendente**, ou Gerente | a própria, enquanto pendente, ou Gerente | sim |
| `ferias_semanas` | Gerente | Gerente | Gerente | sim |
| `trocas_escala` | um `OPERADOR_H3` **ativo**, só em seu nome | Gerente | ninguém | sim |
| `delegacoes_aprovacao` | só o titular, para si | só o titular | só o titular | não |
| `plantao_voluntarios` | Gerente | só o titular | só o titular | sim |
| `feriados_portugal` | ninguém pelo browser (a função anual ou SQL) | ninguém | ninguém | não |
| `planos` | Gerente ou operador do ciclo | quem pode editar o plano; `aprovado_por` só pode ser nulo ou o próprio | ninguém | sim |
| `tarefas_plano` | quem pode editar o plano | quem pode editar o plano e (Gerente **ou** tarefa `EXCECIONAL`) | idem | sim |
| `checklist_itens` | quem pode editar o plano | quem pode editar o plano | Gerente | sim |
| `cadeias_diarias` | quem pode editar o plano | quem pode editar o plano | quem pode editar o plano | sim |
| `cadeias_catalogo` | Gerente | Gerente | Gerente (o gatilho protege as que têm histórico) | sim |
| `gir_fl_dependencias` | Gerente | Gerente | Gerente | sim |
| `logs_auditoria` | qualquer utilizador, **só em seu nome** e só cinco ações (secção 5) | ninguém | ninguém | não |
| `headcount_mensal` | ninguém pelo browser (a função de rascunho) | Gerente, **só enquanto o mês está em rascunho** | ninguém | não |
| `headcount_parametros` | ninguém (linha única) | só o titular | ninguém | não |

- Além das políticas, os **gatilhos** validam o conteúdo (férias, trocas, escala, delegações, planos, checklist, headcount…). Estão descritos nos ficheiros de cada funcionalidade e reunidos em `docs/base-de-dados.md`.
- Na `escala_semanal` existem várias políticas sobrepostas (uma só para o titular ativo, outra para Gerente ou delegado, e três de leitura); o efeito é a **união** delas: qualquer autenticado lê tudo, e só o Gerente escreve. **3 destas políticas** (`escala_diaria_gerente_all`, `escala_diaria_operador_readonly`, `escala_diaria_operador_select`) **não têm nenhum `CREATE POLICY` em nenhuma das 61 migrações** — existem em produção mas o esquema não é reconstruível do zero só com `supabase/migrations/` (a migração 0056 chega a fazer `ALTER POLICY` sobre uma delas). Ver `docs/base-de-dados.md`, secção 11.

## 5. Funções e chamadas do servidor

- **O que o ecrã chama diretamente** (pelo browser): `is_gerente_ou_delegado`, `operador_do_ciclo`, `destravar_checklist_item`, `destravar_tarefa_plano` (exigem Gerente ou delegado por dentro), `garantir_rascunho_headcount_mensal` (Gerente ou delegado) e `fechar_mes_headcount` (só o titular).
- **Funções só do servidor** (`EXECUTE` apenas para `service_role` e `postgres`, o browser não as executa): `limpar_dados_futuros_de_utilizador`, `revogar_sessoes_utilizador` e a função do gatilho de limpeza ao desativar.
- **Restantes funções** têm a permissão predefinida de execução (qualquer papel), por isso **cada uma verifica por dentro** quem chama quando isso importa (por exemplo `calcular_headcount`, `is_gerente_ou_delegado`). As que escrevem em tabelas como quem chama (por exemplo `preencher_escala_anual` e `preencher_feriados_anual`, que correm sem privilégios especiais) ficam presas às políticas da secção 4: um operador que as chame não consegue gravar.
- **Edge Functions:** `gerir-utilizadores` (criar, repor palavra-passe, desativar; chamada pelo Gerente ou delegado, com regras extra para contas `GERENTE`), `sugerir-escala` (só devolve uma sugestão, não grava) e `desactivar-saidos` (pensada para correr todos os dias, mas hoje sem agendamento: EDG-06). Ver `docs/edge-functions.md`.
- **Auditoria escrita pelo browser:** só `PASSWORD_ALTERADA_PROPRIA`, `ESCALONAMENTO_HR_LIMITE`, `ESCALONAMENTO_GIR_FL`, `ESCALONAMENTO_CHECAGEM_20H` e `ESCALONAMENTO_CHECAGEM_15H`, sempre em nome de quem clica. Todas as outras linhas de auditoria são escritas por funções e gatilhos da base.

## 6. O que cada perfil vê e faz nos ecrãs

| Ecrã | Operador e Operador H3 | Delegado e titular |
| --- | --- | --- |
| **Início** | Vista pessoal: saldo de férias, turno atual, próxima semana | Vista do Gerente: férias da equipa, ausências e substitutos, plantão de feriados |
| **Plano de Fim de Semana** | Vê. Cria, edita e submete só o **operador do ciclo** (nas tarefas excecionais) | Cria, edita, aprova, exporta |
| **Checklist Ativo** | Vê. Escreve só o **operador do ciclo** | Escreve; destrava com justificativa |
| **Escala do Mês** | Vê tudo. Pede férias; o `OPERADOR_H3` propõe trocas | Edita células, decide férias e trocas, escolhe substitutos e plantonistas; só o titular delega |
| **Relatórios, Histórico, Definições, Utilizadores, Headcount** | Não aparecem no menu; se se aceder ao endereço, mostram "Esta área é reservada ao Gerente." | Aparecem; dentro deles, alguns botões são só do titular (parâmetros e fecho do Headcount, PDF, contas `GERENTE`) |

## 7. Limites e lacunas conhecidos

- **A auditoria e a lista de utilizadores (com emails) são legíveis, na base, por qualquer utilizador autenticado**, embora o ecrã as restrinja ao Gerente. É a política atual (`logs_select_all`, `usuarios_select_all`); mudá-la exige rever os ecrãs que leem essas tabelas para toda a equipa (por exemplo, nomes nas escalas e nas listas de escolha).
- Os botões que a base recusa a quem não tem permissão (por exemplo, "Submeter para aprovação" ao operador que não é do ciclo) **aparecem na mesma**, sem aviso de erro ao clicar (`docs/plano-de-fim-de-semana.md`, PLA-05).
- O poder de delegado usa a data UTC da base; perto da meia-noite, hora de Lisboa, pode diferir um dia da data que se vê no ecrã.
- Um utilizador desativado perde os poderes na hora (`ativo = false`) e as sessões abertas são terminadas, mas o ecrã já aberto continua até ao próximo pedido à base.

## 8. Código e testes

- Base: funções `is_gerente_ou_delegado`, `is_gerente_titular`, `operador_do_ciclo`, `is_operador_do_ciclo`, `pode_editar_plano`, `delegacao_ativa_id`; políticas listáveis com `select * from pg_policies where schemaname = 'public'`.
- Ecrã: `src/auth/AuthContext.tsx`, `src/auth/RequireAuth.tsx`, `src/layout/AppShell.tsx` (menu por perfil).
- Testes: `supabase/tests/07_rls_permissoes.sql`, `06_trocas_e_delegacao.sql`, `19_gerente_titular_unico.sql`, `20_delegacao_id_auditoria.sql`, `26_revogar_sessoes_so_service_role.sql`, e os testes de cada funcionalidade.

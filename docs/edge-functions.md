# Funções do servidor (Edge Functions) e agendamentos

**Estado:** levantado a 2026-09-27 do código, da base de produção (só leitura) e de chamadas sem credenciais às três funções; reconfirmado a 2026-09-28 (EDG-03, CORS/OPTIONS em `desactivar-saidos`). **A desativação automática por data de saída (`desactivar-saidos`) não está agendada em lado nenhum** (EDG-06): é a lacuna mais importante deste ficheiro. As decisões de negócio por trás das funções estão nos ficheiros das funcionalidades (`docs/utilizadores-e-saidas.md`, `docs/sugestao-automatica.md`).
**Ler quando:** criar, alterar ou chamar uma Edge Function; explicar por que uma saída agendada não desativou a conta; mexer nos agendamentos (`pg_cron`); publicar funções.

## 1. Visão geral

Há três Edge Functions (código em `supabase/functions/`), que correm no servidor da Supabase com a **chave de serviço** (nunca exposta ao browser), e duas funções SQL agendadas.

| Função | Quem a chama | O que faz | Grava? | Agendada? |
| --- | --- | --- | --- | --- |
| `gerir-utilizadores` | O ecrã Utilizadores (Gerente ou delegado) | Cria uma conta, repõe a palavra-passe de outra pessoa, desativa uma conta | sim | não |
| `sugerir-escala` | O ecrã Escala do Mês, botão "Sugerir automaticamente" | Propõe H1 a H4 para uma semana | **não** | não |
| `desactivar-saidos` | **Ninguém, hoje** (pretendia-se todos os dias às 01:00 UTC) | Desativa quem tem `data_saida` até hoje | sim | **não confirmado (EDG-06)** |
| `preencher_feriados_anual()` (SQL) | `pg_cron`, a 1 de novembro às 02:00 UTC | Cria os feriados do ano seguinte | sim | sim |
| `preencher_escala_anual()` (SQL) | `pg_cron`, a 1 de novembro às 03:00 UTC | Cria a escala do ano seguinte | sim | sim |

As duas funções SQL estão descritas em `docs/preenchimento-anual-de-novembro.md`.

## 2. Regras comuns

- **EDG-01** **A chave de serviço só existe no servidor.** Tudo o que precisa de privilégios que o browser não tem (criar contas de acesso, repor palavras-passe, terminar sessões) passa por uma Edge Function. O browser só leva a chave pública.
- **EDG-02** **O acesso exige um JWT** (`verify_jwt` por omissão): sem cabeçalho `Authorization` as três funções respondem `401 Missing authorization header` (verificado a 2026-09-27). Mas o portão só valida o token: **qualquer token válido do projeto passa, incluindo a chave pública do site**. Quem confirma o perfil de quem chama é o código de cada função: só a `gerir-utilizadores` o faz (EDG-12).
- **EDG-03** As três funções respondem a `OPTIONS` (pré-voo do browser) e enviam `Access-Control-Allow-Origin: *`; um método diferente de `POST` recebe 405 (corrigido em `desactivar-saidos` no stress-test de documentação de 2026-09-28 — antes usava `Deno.serve(async () => {...})` sem sequer receber `req`, por isso nunca verificava o método nem enviava cabeçalhos CORS em nenhuma resposta).
- **EDG-04** **"Hoje" dentro das funções é a data do relógio do servidor da Supabase, que trabalha em UTC.** Perto da meia-noite de Lisboa pode diferir um dia do que se vê no ecrã.
- **EDG-05** As respostas de erro têm a forma `{ "erro": "mensagem" }`, com o estado HTTP 400, 401, 403, 404, 405 ou 500; as de sucesso, `{ "ok": true }`, `{ "id": "…" }` ou o conteúdo pedido. O ecrã mostra o texto de `erro` tal como vem.

## 3. `gerir-utilizadores`

Um só ponto de entrada (`POST`) com o campo `acao`.

- **EDG-12** **Quem pode chamar:** o chamador tem de estar **ativo** e ser **Gerente ou delegado** (a função confirma com `is_gerente_ou_delegado()` usando o próprio token de quem chama); senão `403 Sem permissão — reservado ao Gerente/delegado.` Um delegado **não** tem poder sobre contas `GERENTE` (EDG-08).

| Ação | Corpo | O que faz | Auditoria |
| --- | --- | --- | --- |
| `criar` | `nome`, `email`, `password`, `perfil`, `empresa`, `limite_h3_mensal`, `turno_fixo`, `elegivel_h2` | Cria a conta de acesso (email já confirmado) e o perfil em `usuarios`. Para um `OPERADOR` compõe logo a escala (secção 3.1) | `UTILIZADOR_CRIADO`; `UTILIZADOR_FANTASMA` se o perfil falhar e a limpeza também; `COMPOSICAO_ESCALA_FALHOU` se a escala falhar |
| `reset_password` | `usuario_id`, `nova_password` | Define a nova palavra-passe | `PASSWORD_REPOSTA` |
| `desativar` | `usuario_id` | Põe `ativo = false` e `data_saida` = a que já tinha, ou hoje; termina as sessões abertas | `UTILIZADOR_DESATIVADO` |

Validações de `criar` (todas devolvem o erro no ecrã): faltam campos ("Faltam campos obrigatórios."); um delegado a criar `GERENTE` ("Um delegado não pode criar uma conta com perfil Gerente."); um `OPERADOR` sem turno fixo H1 ou H4 ("Um Operador tem de ter um turno fixo (H1 ou H4) indicado."); turno fixo num perfil que não é `OPERADOR`; elegibilidade a H2 num perfil que não é `OPERADOR_H3`. O limite mensal de H3 só se grava para `OPERADOR_H3`.

- **EDG-07** **Não fica meio-criado:** se a conta de acesso se cria mas o perfil falha, a função **remove a conta de acesso**; se essa limpeza também falha, deixa `UTILIZADOR_FANTASMA` na auditoria ("Requer remoção manual no Supabase.").
- **EDG-08** Um delegado **não** repõe a palavra-passe do titular ("Um delegado não pode repor a password do Gerente titular.") nem o desativa ("Um delegado não pode desativar o Gerente titular.").
- **EDG-09** **Desativar** escreve `ativo = false` **primeiro** e só depois termina as sessões (`revogar_sessoes_utilizador`). Se terminar as sessões falhar, a resposta é 500 **mas a conta já ficou desativada**. A limpeza do que a pessoa tinha marcado de hoje em diante faz-se por gatilho na base, no momento da gravação (USR-08), não pela função.
- A palavra-passe mínima (6 caracteres) é imposta pelo ecrã e, em última instância, pelo serviço de autenticação; a função não a valida.
- **Não passam por esta função:** reativar, agendar ou cancelar saída e mudar o turno fixo ou a elegibilidade a H2. O ecrã grava-as diretamente em `usuarios` (a política RLS só o permite ao Gerente ou delegado) e, na reativação de um `OPERADOR`, compõe a escala no próprio browser (`src/lib/composicaoEscala.ts`).

### 3.1 Escala de um operador novo

Para um `OPERADOR` com turno fixo, a função insere uma linha de escala por sábado, com o turno fixo, **do primeiro sábado a partir de amanhã até 31 de dezembro** desse ano; se o registo for em **novembro ou dezembro**, junta o **ano seguinte inteiro** (porque o preenchimento anual de novembro já correu sem esta pessoa). A mesma lógica existe em duas cópias (`supabase/functions/gerir-utilizadores/composicaoEscala.ts` e `src/lib/composicaoEscala.ts`, usada na reativação); um teste garante que se comportam da mesma maneira.

## 4. `sugerir-escala`

- **EDG-10** **Só propõe, nunca grava.** Recebe `{ "semana_ref": "AAAA-MM-DD" }`, que **tem de ser um sábado** (senão `400 semana_ref tem de ser um sábado (AAAA-MM-DD)`; sem valor, `400 semana_ref em falta`), e devolve a sugestão para essa semana. Aplicar é sempre um ato explícito do Gerente no ecrã (`docs/sugestao-automatica.md`).
- Lê, com a chave de serviço: os utilizadores **ativos** (perfil, limite mensal de H3, elegibilidade a H2, turno fixo); as **férias** aprovadas ou pendentes que tocam a semana (sábado a sexta); o histórico de H3 e H2 desde o início do ano ou dos últimos 3 meses (o que for mais antigo) até à semana anterior; e os H3 do mês da semana (o mês onde cai a maioria dos 7 dias, migração 0050).
- Se a consulta de utilizadores falhar, a lista fica vazia e **nada é sugerido** (falha para o lado seguro). As regras de decisão estão em `supabase/functions/sugerir-escala/algoritmo.ts`, sem entradas nem saídas, testadas em `tests/camada2-regras/algoritmo-sugestao-h3.test.ts`.
- **Não confirma o perfil de quem chama** (EDG-02): a resposta contém identificadores de utilizadores e os turnos propostos.

## 5. `desactivar-saidos`

A função existe e faz o que a regra pede (USR-07): lê os utilizadores **ativos** com `data_saida` até hoje (data UTC), põe-nos `ativo = false`, termina-lhes as sessões e regista um `DESATIVACAO_AUTOMATICA` por pessoa (a limpeza de dados futuros vem do gatilho de `usuarios`). Se não houver ninguém, responde `{ "desativados": 0 }`. **Não confirma o perfil de quem chama** (EDG-02); o comentário da função diz que também se pode chamar à mão.

- **EDG-06** **O agendamento diário não está confirmado, e tudo indica que não existe.** Verificado a 2026-09-27:
  - o único sítio que o declara é `supabase/config.toml` (`[functions.desactivar-saidos] schedule = "0 1 * * *"`), mas essa chave **não consta das chaves que a CLI da Supabase suporta** para funções (`enabled`, `verify_jwt`, `import_map`, `entrypoint`, `static_files`, segundo a referência oficial);
  - na base só há **dois** trabalhos do `pg_cron` (os anuais de novembro); nenhum chama esta função;
  - não há registo de pedidos HTTP feitos pela base (a tabela de respostas do `pg_net` está vazia, mas só guarda algumas horas, por isso isto só exclui pedidos recentes) e o cofre de segredos está vazio (não há chave guardada para um agendamento por HTTP);
  - o repositório não tem nenhum outro agendador (nem no GitHub Actions nem no Netlify) que a chame;
  - a auditoria não tem **nenhuma** linha `DESATIVACAO_AUTOMATICA`, e a única saída até hoje (2026-08-21) foi desativada à mão.
  
  **Consequência:** "Agendar saída" só **grava a data**. A conta **não é desativada sozinha**: continua ativa, com acesso e a contar como equipa, até alguém carregar em **Desativar** (ou chamar a função à mão). Os textos do ecrã ("Desativação automática agendada — corre todos os dias às 01h00") prometem o contrário. Não se consegue ver, a partir daqui, o painel da Supabase; se o Gerente souber de um agendamento feito lá, deve registá-lo neste ficheiro.

## 6. Agendamentos na base (`pg_cron`)

| Trabalho | Expressão | Hora (UTC) | Comando | Ativo |
| --- | --- | --- | --- | --- |
| `preencher-feriados-anual` | `0 2 1 11 *` | 02:00 de 1 de novembro | `select preencher_feriados_anual();` | sim |
| `preencher-escala-anual` | `0 3 1 11 *` | 03:00 de 1 de novembro | `select preencher_escala_anual();` | sim |

Ainda não têm execuções registadas (a primeira é a 1 de novembro de 2026). A base tem também as extensões `pg_net` e `supabase_vault`, hoje sem uso.

## 7. Publicação das funções

- As funções publicam-se por um fluxo do GitHub (`.github/workflows/deploy-functions.yml`) sempre que uma alteração a `supabase/functions/**` ou a `supabase/config.toml` chega ao ramo `main`, ou por execução manual. O fluxo publica as três funções com a CLI da Supabase e o segredo `SUPABASE_ACCESS_TOKEN` do repositório. Publicar o ecrã (Netlify) é independente (`docs/operacao.md`).
- **EDG-11** Alterar uma função é alterar comportamento em produção assim que a alteração chega a `main`; segue a regra de perguntar antes de enviar (`docs/operacao.md`). Uma função que muda uma regra escrita nestes ficheiros atualiza o ficheiro na mesma alteração.

## 8. Limites e lacunas conhecidos

- **`desactivar-saidos` não corre sozinha** (EDG-06). Enquanto assim for, quem tem saída agendada tem de ser desativado à mão no dia.
- `sugerir-escala` e `desactivar-saidos` **não confirmam o perfil de quem chama**; o portão só exige um token válido do projeto (EDG-02). A `gerir-utilizadores` confirma.
- Desativar termina as sessões **depois** de gravar a desativação (EDG-09).
- O comentário de `src/auth/RequireAuth.tsx` cita uma função `desativar-saidas` que não existe (a real é `desactivar-saidos`) e diz que o corte é "a partir do dia seguinte"; a função, se corresse, desativaria no próprio dia.

## 9. Código e testes

- `supabase/functions/gerir-utilizadores/` (`index.ts`, `composicaoEscala.ts`), `supabase/functions/sugerir-escala/` (`index.ts`, `algoritmo.ts`), `supabase/functions/desactivar-saidos/index.ts`, `supabase/config.toml`, `.github/workflows/deploy-functions.yml`.
- Testes: `tests/camada2-regras/algoritmo-sugestao-h3.test.ts`, `composicaoEscala.test.ts`; `supabase/tests/25_desativar_apaga_dados_futuros.sql` e `26_revogar_sessoes_so_service_role.sql` (a base, não as funções). **Não há testes das próprias Edge Functions** (chamadas HTTP).

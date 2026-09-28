# Gestão de Turnos (Turno H3) — ponto de entrada

Aplicação de gestão de turnos da equipa DEOS/SAS (Accenture · Banco Montepio): escala H1-H4, férias, trocas de H3, Plano e Checklist do fim de semana, relatório semanal, Headcount Ideal. React + Vite + Supabase (Postgres, Auth, Realtime, Edge Functions); produção em `https://turno-h3.netlify.app`.

## Regra obrigatória de consulta

**Antes de qualquer alteração ou validação de regra, ler primeiro o ficheiro `docs/` dono dessa regra.** Instrução direta do Gerente (2026-09-25/26): o conjunto de ficheiros abaixo é a cópia fiel de como a solução funciona — interface, operacionalidade e regra, uma por uma, com os seus limites. Não assumir um critério de memória; confirmá-lo no ficheiro antes de mexer ou de responder sobre ele. Se o código e um ficheiro `docs/` discordarem, é motivo para avisar o Gerente, não para decidir sozinho qual dos dois está certo.

## Princípios nunca violados

- **A base de dados é a proteção real; o ecrã só esconde.** (`docs/perfis-e-permissoes.md`, PER-01)
- **Quem saiu da equipa não conta como ativo em nenhuma funcionalidade.** (`docs/utilizadores-e-saidas.md`, USR-01)
- **As cinco âncoras de data nunca se misturam** (escala/H3 = sábado, plano = quinta, relatório = sexta administrativa, férias/substitutos = semana civil, mês de uma semana H3 = o do sábado+3). (`docs/calendario-h3.md`)
- **Um alarme só existe com o critério escrito e confirmado pelo Gerente, testado com dados reais.** (`docs/alarmes.md`, ALA-11/12)
- **Nunca publicar (ecrã, funções ou base de dados) sem autorização explícita do Gerente**, mesmo quando o pedido foi "implementa isto". (`docs/operacao.md`, OP-02)
- **Uma alteração à base de dados só está terminada depois de correr contra dados reais** (transação revertida) e provar por consulta que não sobrou resíduo. (`docs/operacao.md`, OP-04/OP-05)
- **Nunca simular condições em produção**, nem acionar ao vivo uma ação irreversível "só para verificar". (`docs/operacao.md`, OP-07/OP-08)
- **Nenhum período de férias ou licença se sobrepõe ao de outro colega ativo**, seja qual for o perfil. (`docs/regras-entre-colegas.md`, COL-01)
- **Uma semana só tem um `OPERADOR_H3` em H3**, e o preenchimento anual exige no mínimo 3 ativos. (`docs/turnos-e-rotacao.md`, TUR-05; `docs/preenchimento-anual-de-novembro.md`, NOV-07)

Lista completa (uma dúzia, com todos os IDs): `docs/regras.md`, secção 3.

## Índice de `docs/`

| Ficheiro | Cobre |
| --- | --- |
| `calendario-h3.md` | As cinco âncoras de data/hora e as conversões entre elas — **ler primeiro** para qualquer coisa com datas |
| `turnos-e-rotacao.md` | Os quatro turnos (H1-H4), composição, rotação, limite mensal |
| `regras-entre-colegas.md` | Regras entre pessoas: férias, substitutos, trocas, delegação, plantão, plano/checklist |
| `preenchimento-anual-de-novembro.md` | O preenchimento automático anual de 1 de novembro, passo a passo |
| `escala.md` | A grelha da Escala do Mês |
| `ferias-e-plantoes.md` | Férias, licenças, substitutos, plantões de feriado |
| `trocas-e-delegacao.md` | Trocas de H3 e delegação de aprovação |
| `sugestao-automatica.md` | A Sugestão automática de escala |
| `plano-de-fim-de-semana.md` | O Plano de Fim de Semana e as suas tarefas |
| `checklist.md` | O Checklist Ativo e o acompanhamento das cadeias |
| `definicoes.md` | O catálogo de cadeias |
| `alarmes.md` | Alarmes, avisos e acionamentos |
| `inicio.md` | A página Início |
| `relatorios.md` | O relatório semanal |
| `historico.md` | A página Histórico e a auditoria |
| `headcount.md` | Headcount Ideal, fecho mensal, Estudo de Cenários, relatório PDF |
| `utilizadores-e-saidas.md` | Perfis, registo, saída da equipa, palavras-passe |
| `perfis-e-permissoes.md` | Como funcionam os poderes e a RLS (o mecanismo) |
| `interface.md` | Entrada, estrutura do ecrã, convenções comuns a todas as páginas |
| `base-de-dados.md` | Referência técnica: enums, tabelas, gatilhos, funções, migrações |
| `edge-functions.md` | As três Edge Functions e os agendamentos |
| `operacao.md` | Publicar, migrar, verificar — **ler antes de qualquer deploy** |
| `testes.md` | As quatro camadas de teste, estado real de cada uma |
| `decisoes.md` | Registo cronológico de decisões do Gerente, com data |
| `regras.md` | Índice de todos os IDs de regra, por prefixo |
| `glossario.md` | Termos do projeto, definição curta |
| `limites-e-lacunas.md` | Registo consolidado de limites e lacunas conhecidos |

## Convenções de trabalho

- **Responder sempre em português de Portugal.**
- **Nunca publicar sem autorização explícita**: implementar e fazer commit local; perguntar antes de `git push` para `main` (é sempre um deploy de produção, salvo `[skip ci]`/`[skip netlify]` na mensagem do commit) e antes de publicar uma alteração a `supabase/functions/**`. Juntar pedidos pendentes num só push.
- **No fim de uma tarefa de implementação**, confirmar ao vivo (nunca de memória) e responder com os dois veredictos, neste vocabulário exato:
  - **Base de Dados:** Tudo implementado | Depende de autorização | Falta implementar
  - **Netlify:** Falta deploy | Tudo implementado | Falta implementar
- Uma pergunta de sim/não recebe **"Sim"** ou **"Não"** como primeira palavra.
- Mensagens de commit terminam com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`; um commit só de documentação pode levar `[skip ci]` na mensagem, para não gastar um deploy da Netlify.
- Uma alteração a uma regra de negócio atualiza o ficheiro `docs/` dono **na mesma alteração** que muda o código — nunca depois, à parte.
- Uma decisão nova do Gerente entra em `docs/decisoes.md` **e** no ficheiro que a aplica.

## Onde estão as coisas

- Código: `src/` (ecrã), `supabase/migrations/` (esquema, aplicado à mão), `supabase/functions/` (Edge Functions), `supabase/tests/` e `tests/` (as quatro camadas — `docs/testes.md`).
- Ligação direta à base de produção: `.db_conn` na raiz (gitignored) — ver `docs/operacao.md` antes de pedir credenciais.
- `README.md` descreve a stack e como correr o projeto localmente. `CRITERIOS_FUNCIONAIS.md`, `DEPLOY.md`, `ROLLOUT_PLAN.md` e `SECURITY_RECOMMENDATIONS.md` são documentos anteriores a este conjunto, hoje total ou parcialmente históricos — cada um diz, no topo, o que o substitui.

# Limites e lacunas conhecidos — registo consolidado

**Estado:** compilado a 2026-09-27 juntando a secção "Limites conhecidos"/"Limites e lacunas conhecidos" de cada ficheiro em `docs/`. **Este ficheiro é um índice**: cada linha tem uma frase curta e o ficheiro/ID onde está o detalhe completo — não se repete aqui o raciocínio todo. Existe um dossiê de segurança à parte (auditoria de IAM/RLS/DDL, publicado como documento próprio) com achados adicionais de infraestrutura; não duplicado neste ficheiro.
**Ler quando:** avaliar o risco de uma área antes de lhe mexer; responder "isto já se sabe que...?"; priorizar o que corrigir a seguir.

## 1. Risco operacional real (podem produzir um resultado errado sem ninguém notar)

- **A desativação automática por data de saída não está agendada em produção.** "Agendar saída" só grava a data; a conta continua ativa até alguém carregar em Desativar. Os textos do ecrã dizem o contrário. → `docs/edge-functions.md`, EDG-06; `docs/utilizadores-e-saidas.md`, USR-07.
- **O preenchimento anual pode deixar semanas sem H3, sem avisar bem:** o limite mensal é rígido (ninguém cabe → semana falha) e, se já existir uma única linha de escala do ano seguinte, a função inteira fica `IGNORADO`, sem etiqueta na barra de alertas. → `docs/preenchimento-anual-de-novembro.md`, secção 10; `docs/alarmes.md`, ALA-08.
- **`preencher_feriados_anual()` não tem nenhum teste automático** — só a função irmã da escala tem. → `docs/testes.md`, TES-03.
- **A Camada 4 de testes (stress/concorrência) não tem onde correr com segurança**: o único projeto Supabase é o de produção. → `docs/testes.md`, TES-05.
- **Os parâmetros do Headcount não têm validação de intervalos:** fechar um mês com eficiência ou cobertura de férias a 0 dá capacidade 0 nesse mês, sem aviso no ecrã de parâmetros. → `docs/headcount.md`, secção 10.
- **A auditoria e a lista de utilizadores (com emails) são legíveis, na base, por qualquer conta autenticada**, embora o ecrã as restrinja ao Gerente — a proteção real não existe para essas duas tabelas. → `docs/perfis-e-permissoes.md`, secção 7.
- **A base de dados ainda não impede uma linha de `escala_semanal` fora de um sábado.** Só o ecrã, a Sugestão automática e as trocas (desde a migração 0061) impõem a âncora de sábado; uma escrita direta na base (SQL manual, um novo caminho de código) podia criar uma linha solta que nenhum cálculo trata como semana. → `docs/calendario-h3.md`, SEM-01.

## 2. Comportamento que pode confundir, mas é desenho conhecido

- A Escala do Mês mostra a semana pela **data civil**; só o alarme "H3 por atribuir" já muda às 22h de sexta (a mesma hora em que o turno H3 ativa de facto). → `docs/calendario-h3.md`, SEM-14.
- O relatório semanal é uma **fotografia** do momento em que a página abre; não se atualiza sozinho. → `docs/relatorios.md`, secção 6.
- A Sugestão automática **ignora trocas por decidir e substitutos de férias**; o resultado é sempre o mesmo para os mesmos dados (não há "sugerir outra vez"). → `docs/sugestao-automatica.md`, secção 6.
- O Estudo de Cenários e o Relatório do Headcount só olham para os meses já fechados e a equipa de hoje — não projetam férias marcadas nem saídas agendadas. → `docs/headcount.md`, secção 10.
- O Histórico não pagina além das 200 linhas mais recentes de auditoria, e não tem exportação nem separador para trocas, férias ou utilizadores. → `docs/historico.md`, secção 4.
- Um plantonista ou substituto que sai da equipa faz a decisão "desaparecer" (a semana volta a "por decidir"); não há histórico dessa reversão no próprio ecrã. → `docs/ferias-e-plantoes.md`, FER-08.

## 3. Textos e comentários desatualizados (não mudam o comportamento, mas podem enganar quem lê)

- `src/auth/RequireAuth.tsx` cita uma função `desativar-saidas` que não existe (a real é `desactivar-saidos`) e diz que o corte é "a partir do dia seguinte"; seria, se corresse, no próprio dia. → `docs/edge-functions.md`, secção 8.
- Comentário de coluna `usuarios.elegivel_h2` cita nomes de pessoas de um backfill de agosto de 2026, sem efeito hoje. Comentário de `ferias.eh_operador_h3` cita uma exclusion constraint que já não existe. → `docs/base-de-dados.md`, secção 12.
- Comentário de `usuarios.limite_h3_mensal` na base ainda fala do "mês do sábado do ciclo"; a regra em vigor é o mês da maioria dos 7 dias. → `docs/preenchimento-anual-de-novembro.md`, secção 10.
- `src/styles/theme.css` descreve, no comentário do topo, um "dark mode corporativo" que já não é o aspeto real da aplicação. → `docs/interface.md`, secção 5.
- O comentário da função `quintaEscalaDe` (`src/lib/datas.ts`) ainda descreve uma "escala" Quinta-a-Quarta que já não existe (a `escala_semanal` é Sábado a Sexta desde sempre, `SEM-01`) — a função hoje só serve para ancorar o período do relatório semanal (`RelatoriosPage.tsx`), não a escala; o nome e o comentário ficaram por atualizar quando a âncora da escala mudou. Comportamento correto (verificado); só o comentário engana. → `docs/calendario-h3.md`, SEM-12; `docs/relatorios.md`.
- `tests/README.md` (o índice geral de testes) tem números e afirmações da fase inicial do projeto, hoje incorretos (fala em "54/54" e diz que a Camada 1 "não corre"). → `docs/testes.md`.
- `DEPLOY.md` e `ROLLOUT_PLAN.md`, na raiz do repositório, descrevem uma equipa, um calendário e um CI de 2026-07/08 que já não existem. → `docs/operacao.md`, secção 9.

## 4. Ecrã: botão visível sem permissão real, ou sem mensagem de erro

- "Submeter para aprovação" aparece a qualquer utilizador; só grava a quem tem permissão — sem aviso aos outros. → `docs/plano-de-fim-de-semana.md`, PLA-05.
- No Checklist, quem não é o operador do ciclo vê os mesmos botões e não recebe erro quando a gravação é recusada. → `docs/checklist.md`, secção 4.
- Em Definições, Desativar/Reativar/Incluída-Não incluída não mostram erro se falharem. → `docs/definicoes.md`, secção 5.
- Se a leitura da Escala do Mês falhar, a grelha aparece vazia, sem mensagem. → `docs/escala.md`, secção 4.

## 5. Sem ecrã para algo que só existe em SQL

- Alterar o tipo de fim de semana calculado à mão existe na base (`tipo_fim_semana_manual`) mas não tem ecrã. → `docs/calendario-h3.md`, SEM-09.
- Editar as tarefas modelo, os horários fixos de arranque/previsão, ou atribuir os estados "Em execução"/"Concluído" ao plano. → `docs/plano-de-fim-de-semana.md`, secção 7.
- Encurtar ou apagar uma delegação de aprovação. → `docs/trocas-e-delegacao.md`, secção 2.4.
- Registar uma licença (só férias têm formulário). → `docs/ferias-e-plantoes.md`, secção 1.
- Alterar nome, email, empresa, perfil ou limite mensal de H3 de um utilizador já registado. → `docs/utilizadores-e-saidas.md`, secção 4.

## 6. Como manter este ficheiro

Sempre que se escreve um "Limites conhecidos" novo num ficheiro de `docs/`, acrescenta-se aqui uma linha na categoria certa (1 a 5), com o ficheiro e o ID de origem — nunca o texto todo. Quando uma lacuna é corrigida, a linha sai daqui **e** do ficheiro de origem, na mesma alteração.

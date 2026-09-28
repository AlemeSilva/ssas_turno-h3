# Glossário

**Estado:** compilado a 2026-09-27 a partir dos termos usados em todos os ficheiros de `docs/`.
**Ler quando:** encontrar um termo do vocabulário do projeto e não ter a certeza do que significa. Cada entrada tem uma definição curta e o ficheiro com a explicação completa — nunca redefine a regra aqui.

**Acionamento (ao Gerente)** — registar em auditoria que um alarme foi escalado; não envia nada a ninguém. `docs/alarmes.md`.

**Ativação do H3** — as 22h de sexta-feira, o momento em que o turno H3 da nova semana H3 começa a valer. `docs/calendario-h3.md`.

**Auditoria** — o registo cronológico só de crescer (`logs_auditoria`) de ações relevantes em toda a aplicação: quem, quando, o quê. Lido por qualquer utilizador autenticado, mostrado ao Gerente e delegado na página Histórico. `docs/historico.md`.

**Banda de tolerância** — margem, em pessoas, à volta do Headcount Ideal dentro da qual a equipa é "Aceitável". `docs/headcount.md`.

**Bloqueio otimista** — grava só se o registo ainda for o mesmo que quando o ecrã abriu (por um carimbo `atualizado_em`); recusa se outra sessão o mudou entretanto. Usado na Escala do Mês e nas tarefas do Plano de Fim de Semana. `docs/escala.md`, `docs/plano-de-fim-de-semana.md`.

**Cadeia** — um processo de batch acompanhado por secção e por dia durante o fim de semana (ex.: GIR_FL, SD_FL). `docs/definicoes.md`, `docs/checklist.md`.

**Capacidade plena (por pessoa / da equipa)** — horas produtivas planeadas de uma pessoa ou da equipa num mês, com eficiência e reserva de férias já descontadas. **Capacidade presente** troca essa reserva fixa de férias pelas ausências reais desse mês, não é a mesma conta com uma subtração extra. `docs/headcount.md`.

**Carga** — total de horas de trabalho que a equipa tem de cobrir num mês (pedidos, batch, Olho Vivo, preparação de fim de semana, imparidade, recuperação de cadeia). `docs/headcount.md`.

**Checklist Ativo** — o ecrã onde o operador do ciclo acompanha, em tempo real, a execução do plano do fim de semana. `docs/checklist.md`.

**Ciclo** — o período de um Plano de Fim de Semana, de quinta-feira a segunda-feira (a segunda seguinte); a data que o identifica (`data_inicio_ciclo`) é sempre a quinta. Não confundir com a semana H3 (sábado a sexta). `docs/calendario-h3.md`.

**Cross-training** — formação cruzada entre `OPERADOR_H3`, para que mais do que três pessoas saibam cobrir o turno H3; citado como recomendação quando o risco de escala H3 dispara. `docs/headcount.md`.

**Delegação de aprovação** — período em que uma pessoa ativa recebe os poderes de Gerente, além dos seus, sem mudar de perfil. `docs/trocas-e-delegacao.md`.

**Delegado** — quem está, hoje, dentro de uma delegação de aprovação em vigor; tem quase todos os poderes de Gerente, exceto os exclusivos do titular. `docs/perfis-e-permissoes.md`.

**Destravar** — a única forma de corrigir um item de checklist ou uma tarefa já concluída (imutável): reabre-a, exige justificativa, fica em auditoria. `docs/checklist.md`.

**Dias úteis** — segunda a sexta. Para férias conta-se sem descontar feriados; para o Headcount conta-se descontando feriados (`dias_uteis_sem_feriados`). `docs/calendario-h3.md`, SEM-16.

**Edge Function** — código que corre no servidor da Supabase com privilégios que o browser não tem (criar contas, repor palavras-passe, sugerir escala). `docs/edge-functions.md`.

**Elegível a H2** — atributo de um `OPERADOR_H3` que decide se pode ser escolhido para o turno H2 na rotação automática. `docs/turnos-e-rotacao.md`.

**Escala do Mês** — a grelha mensal de turnos, com os painéis de férias, trocas e delegação. `docs/escala.md`.

**Escalonamento** — o momento em que um alarme, já em curso há tempo suficiente (a janela de tolerância, ou a própria hora-limite de um preditivo), fica elegível para o botão "Registar acionamento ao Gerente". Distinto de "Acionamento", que é só o clique que o regista. `docs/alarmes.md`.

**Estudo de Cenários** — o simulador "e se" do Headcount, efémero, nunca grava nada. `docs/headcount.md`.

**Feriado** — dia de `feriados_portugal`, nacional ou municipal de Lisboa; entra na escala, no Início e no cálculo de dias úteis do Headcount. `docs/preenchimento-anual-de-novembro.md`.

**Fim de semana de manutenção** — o último sábado do mês; ativa a checagem crítica das 15h (ALA-06) e um passo extra no Plano/Checklist. `docs/calendario-h3.md`, SEM-09.

**GIR_FL** — a cadeia cujo atraso ao sábado à noite dispara o alarme preditivo do mesmo nome. `docs/definicoes.md`, `docs/alarmes.md`.

**Gerente / Gerente titular** — o perfil `GERENTE`; só pode haver um ativo. `docs/utilizadores-e-saidas.md`, `docs/perfis-e-permissoes.md`.

**H1, H2, H3, H4** — os quatro turnos. H1 (07h-16h) e H4 (09h-18h) são turnos fixos ou de rotação secundária; H2 (14h-23h) e H3 (22h-07h) rodam entre `OPERADOR_H3`. Só o H3 trabalha aos fins de semana e feriados. `docs/turnos-e-rotacao.md`.

**Headcount Ideal** — o número de pessoas que a carga de trabalho e a estrutura de turnos justificam, comparado com a equipa real de hoje. `docs/headcount.md`.

**HR. LIMITE** — a hora-limite de uma tarefa do Plano de Fim de Semana; ultrapassá-la sem a tarefa concluída dispara o alarme reativo do mesmo nome. `docs/plano-de-fim-de-semana.md`, `docs/alarmes.md`.

**Ideal exato / Ideal por horas** — Ideal por horas é a carga média a dividir pela capacidade média; Ideal exato é o maior entre esse valor e o piso estrutural. `docs/headcount.md`.

**Janela de tendência** — os meses fechados que entram na média do Headcount Ideal (carga e capacidade). `docs/headcount.md`.

**Licença** — ausência aprovada fora do saldo de 22 dias de férias. `docs/ferias-e-plantoes.md`.

**Operador do ciclo** — o `OPERADOR_H3` ativo que tem H3 no sábado de um ciclo; pode criar, editar e aprovar o plano desse ciclo. `docs/perfis-e-permissoes.md`, `docs/plano-de-fim-de-semana.md`.

**Piso estrutural** — o mínimo de pessoas que a estrutura de turnos (H1+H2+H3) exige, independente da carga de trabalho. `docs/headcount.md`.

**Plano de Fim de Semana** — o plano de tarefas de um ciclo (quinta a segunda), com o checklist e as cadeias associadas. `docs/plano-de-fim-de-semana.md`.

**Plantão** — a cobertura do H3 num feriado em dia útil, das 07h00 ao fim da cadeia diária. Quem a faz é o **plantonista**. `docs/ferias-e-plantoes.md`.

**Plantonista** — a pessoa confirmada para o Plantão de um feriado. `docs/ferias-e-plantoes.md`.

**Preenchimento anual** — a geração automática, a 1 de novembro, da escala e dos feriados do ano seguinte; a única automação que corre sozinha (cron), sem intervenção humana. `docs/preenchimento-anual-de-novembro.md`.

**Rascunho** — dois sentidos: (1) do mês de Headcount, a linha de `headcount_mensal` de um mês já terminado mas ainda por fechar (`docs/headcount.md`); (2) do Plano de Fim de Semana, o estado inicial `RASCUNHO`, antes de submeter para aprovação (`docs/plano-de-fim-de-semana.md`) — o botão "Exportar Draft" usa o sinónimo inglês só nesse rótulo.

**RLS** ("Row-Level Security") — as políticas do Postgres que decidem, linha a linha, quem lê ou escreve cada tabela; é a proteção real da aplicação. `docs/perfis-e-permissoes.md`.

**Semana civil** — segunda a sexta; usada para decidir substitutos de férias. Não confundir com a semana H3. `docs/calendario-h3.md`.

**Semana H3** — sábado a sexta, identificada pelo sábado (`semana_ref`); é a semana da escala, das trocas e do alarme "H3 por atribuir". `docs/calendario-h3.md`.

**Sexta administrativa** — a sexta-feira que abre o período do relatório semanal (sexta a quinta seguinte). `docs/calendario-h3.md`, `docs/relatorios.md`.

**Substituto (de férias)** — quem cobre uma ausência aprovada, decidido por semana civil. Não confundir com o substituto de uma troca de H3, nem com o campo "Substituto" do painel de Delegação de Aprovação (candidato a Delegado). `docs/ferias-e-plantoes.md`.

**Sugestão automática** — a proposta de H1 a H4 para uma semana, gerada pela Edge Function `sugerir-escala`, seguindo as mesmas regras do preenchimento anual; nunca grava sozinha. `docs/sugestao-automatica.md`.

**Titular** — sinónimo de Gerente titular, usado para o distinguir de um delegado. `docs/perfis-e-permissoes.md`.

**Troca (de H3)** — passar o H3 de uma semana de um `OPERADOR_H3` (proponente) para outro (substituto), decidida por Gerente ou delegado. `docs/trocas-e-delegacao.md`.

**Turno fixo** — H1 ou H4, atributo de um `OPERADOR` (que não roda turnos). `docs/utilizadores-e-saidas.md`.

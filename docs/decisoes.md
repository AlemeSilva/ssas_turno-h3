# Registo de decisões do Gerente

**Estado:** compilado a 2026-09-27 a partir das secções "Estado" de cada ficheiro em `docs/` (cada uma cita a data e, quando existe, a migração). Substitui um rascunho anterior mais curto, que referia um único ficheiro de escala e trocas entretanto repartido em `docs/turnos-e-rotacao.md`, `docs/escala.md`, `docs/trocas-e-delegacao.md` e `docs/calendario-h3.md`.
**Ler quando:** perceber de onde vem um critério; antes de propor reabrir uma decisão já tomada; escrever a data de uma decisão nova.

Uma decisão nova regista-se aqui com a data **e** entra no ficheiro da área que a aplica — **o critério em si vive lá, não aqui**; esta tabela só diz o quê, quando e onde. Ordem: da mais antiga para a mais recente. Não lista toda migração técnica (correções, renomeações) — só decisões de regra ou de comportamento; a lista completa de migrações está em `docs/base-de-dados.md`, secção 11.

## 1. Decisões sobre o produto

| Data | Decisão | Onde vive |
| --- | --- | --- |
| 2026-07-29 | A base de dados é a proteção real; o ecrã só esconde. A delegação de aprovação é aditiva desde a conceção inicial (o titular nunca perde o seu próprio poder) | `docs/perfis-e-permissoes.md`, `docs/trocas-e-delegacao.md` (migração 0001) |
| 2026-07-31 | Férias e licença passam a tipos distintos; a restrição de não-sobreposição de ausências passa a aplicar-se só aos 3 `OPERADOR_H3` (antes impedia qualquer sobreposição entre quaisquer dois elementos da equipa) — o requisito original que a migração 0044/0045 mais tarde generaliza de novo a toda a equipa | `docs/regras-entre-colegas.md`, `docs/ferias-e-plantoes.md` (migração 0005) |
| 2026-07-31 | Confirmação de substituto para férias/licença aprovadas: desenho mínimo por decisão explícita — um botão "Confirmar" que só regista QUE a cobertura foi tratada, sem escolher QUEM substitui | `docs/ferias-e-plantoes.md` (migração 0008) |
| 2026-08-01 | Decisão revertida um dia depois: a página Início passa a apresentar a equipa para o Gerente escolher o substituto, que passa a gravar-se (`substituto_id`) | `docs/ferias-e-plantoes.md` (migração 0009) |
| 2026-08-03 | O preenchimento da escala do ano seguinte passa a automático, em novembro, e definitivo ("isto tem de ser definitivo a partir de agora"); confirmadas as regras de rotação H1/H2/H3/H4 | `docs/preenchimento-anual-de-novembro.md`, `docs/turnos-e-rotacao.md` (migração 0015) |
| 2026-08-03 | Pedido de férias/licença: só no ano corrente, um pendente de cada vez por pessoa; a decisão do Gerente nunca é bloqueada por isto | `docs/ferias-e-plantoes.md` (migração 0016) |
| 2026-08-03 | Com escala já atribuída, o pedido de férias não é impedido à partida: o mecanismo de substituto trata a cobertura | `docs/ferias-e-plantoes.md` (migração 0017) |
| 2026-08-03 | O preenchimento anual passa a registar sempre em auditoria, mesmo quando falha — antes falhava sem deixar rasto | `docs/preenchimento-anual-de-novembro.md` (migração 0019) |
| 2026-08-03 | Pedido do Gerente: os feriados do ano seguinte também passam a preencher-se automaticamente (depois de o 8 de dezembro e o Corpo de Deus terem ficado de fora do calendário de 2026) | `docs/preenchimento-anual-de-novembro.md` (migração 0020) |
| 2026-08-10 | Substituto de férias decide-se por semana civil (segunda a sexta), não pelo período inteiro do pedido | `docs/ferias-e-plantoes.md` (migração 0025) |
| 2026-08-11 | Trocar um plantonista de feriado já confirmado passa a ser exclusivo do Gerente titular; a primeira escolha continua aberta ao delegado | `docs/ferias-e-plantoes.md` (migração 0027) |
| 2026-08-12 | Turno fixo (H1/H4) passa a atributo do `OPERADOR`, não uma regra implícita | `docs/utilizadores-e-saidas.md` (migração 0029) |
| 2026-08-13 | No relatório semanal, uma ausência só conta como férias/licença se cobrir metade ou mais dos 7 dias do período | `docs/relatorios.md` |
| 2026-08-14 | Um operador do ciclo (não Gerente) deixa de poder alterar, por chamada direta à base, uma tarefa `TEMPLATE`/`MANUTENCAO` do plano — só as `EXCECIONAL`; cada tarefa passa a ter bloqueio otimista (`atualizado_em`) e cada edição fica em auditoria | `docs/plano-de-fim-de-semana.md` (migração 0031) |
| 2026-08-14 | Uma tarefa excecional passa a poder concluir-se a partir do Checklist Ativo e a entrar no alarme de hora-limite; a conclusão fica imutável, como um item de checklist | `docs/checklist.md`, `docs/plano-de-fim-de-semana.md`, `docs/alarmes.md` (migração 0032) |
| 2026-08-14 | O operador do ciclo pode aprovar o seu próprio Plano de Fim de Semana, não só o Gerente ou delegado ("são eles que planeiam... faz sentido também poderem aprovar"); nenhum perfil salta de Rascunho direto a Aprovado por chamada direta à base | `docs/plano-de-fim-de-semana.md` (migração 0033) |
| 2026-08-27 | Bloqueio de turno sobre férias relaxado: só bloqueia quando a semana é 100% férias (7 dias); antes bastava 1 dia em 7 para impedir mudar o turno na semana inteira. Regra partilhada pelos 3 caminhos que gravam `escala_semanal` (edição manual, Sugestão automática, preenchimento anual) | `docs/turnos-e-rotacao.md` (migração 0034) |
| 2026-08-27 | A rotação anual deixa de depender de nomes fixos: qualquer conjunto de `OPERADOR_H3` ativos (mínimo 3); quem pode ocupar H2 passa a atributo (`elegivel_h2`) por pessoa | `docs/turnos-e-rotacao.md`, `docs/utilizadores-e-saidas.md` (migração 0035) |
| 2026-08-27 | Uma semana do preenchimento anual que falha (ex.: férias a cobri-la inteira) deixa de arrastar o ano inteiro consigo — só essa semana falha, isolada | `docs/preenchimento-anual-de-novembro.md` (migração 0036) |
| 2026-08-27 | Um grupo vazio (H1 fixo, H4 fixo ou elegíveis a H2) deixa de ser silencioso: o preenchimento anual gera o ano na mesma, com aviso âmbar | `docs/preenchimento-anual-de-novembro.md` (migração 0037) |
| 2026-08-27 | Com mais de um Gerente ativo em simultâneo (situação de transição), só o mais antigo recebe H4 automaticamente no preenchimento anual — regra tornada defensiva três semanas depois pela proibição de dois titulares ativos | `docs/preenchimento-anual-de-novembro.md` (migração 0038) |
| 2026-09-04 | Criada a calculadora de Headcount Ideal, com uma reserva estrutural para a rotação de férias | `docs/headcount.md` (migrações 0039, 0040) |
| 2026-09-05 | Nunca mais do que um Gerente titular ativo em simultâneo | `docs/perfis-e-permissoes.md`, `docs/utilizadores-e-saidas.md` (migração 0042) |
| 2026-09-06 | Criado o Estudo de Cenários do Headcount ("e se"), efémero, sem gravar nada | `docs/headcount.md` |
| 2026-09-06 | Nenhuma sobreposição de férias ou licença entre quaisquer dois elementos da equipa, seja qual for o perfil (requisito original, reafirmado e generalizado) | `docs/ferias-e-plantoes.md` (migração 0044) |
| 2026-09-07 | Peer-review dedicado à sobreposição de férias: uma pessoa também não pode ter dois pedidos seus sobrepostos; encurtar um período nunca é bloqueado; rejeitar nunca verifica sobreposição nem saldo | `docs/ferias-e-plantoes.md`, `docs/regras-entre-colegas.md` (migração 0045) |
| 2026-09-10 | `calcular_headcount` passa a contar quem esteve presente pelo menos um dia do mês, não só quem está ativo hoje | `docs/headcount.md` (migração 0047) |
| 2026-09-10 | Desempate da rotação de H3/H2 passa a dois níveis (menos nos últimos 3 meses, depois menos desde 1 de janeiro) — corrige uma distribuição injusta encontrada num ensaio do preenchimento de 2027 | `docs/turnos-e-rotacao.md`, `docs/preenchimento-anual-de-novembro.md` (migração 0049) |
| 2026-09-11 | O limite mensal de H3 conta a semana no mês onde cai a maioria dos seus 7 dias | `docs/turnos-e-rotacao.md` (migração 0050) |
| 2026-09-11 | Piso estrutural contratual do Headcount Ideal: a equipa nunca pode ser menor do que a estrutura de turnos exige | `docs/headcount.md` (migração 0051) |
| 2026-09-11 | Capacidade plena passa a contar dias úteis (não corridos); criado o ecrã "Ver Cálculo" | `docs/headcount.md` (migração 0052) |
| 2026-09-14 | Criado o relatório em PDF do Headcount | `docs/headcount.md` |
| 2026-09-20 | Início do varrimento de toda a aplicação à procura de sítios que não verificavam se o utilizador estava ativo | `docs/utilizadores-e-saidas.md` (migrações 0053, 0054) |
| 2026-09-25 | **Quem saiu da equipa não pode ser contabilizado como ativo em nenhuma funcionalidade** — regra basilar (USR-01); ao desativar, apaga-se só o que a pessoa tinha marcado a partir da data de saída, mantendo o histórico anterior intacto | `docs/utilizadores-e-saidas.md` (migrações 0055-0058, 0060) |
| 2026-09-25 | O relatório semanal passa a excluir explicitamente quem já saiu da equipa | `docs/relatorios.md` |
| 2026-09-25 | Falha de segurança corrigida: `revogar_sessoes_utilizador` deixa de poder ser chamada por qualquer sessão autenticada — passa a exclusiva do servidor | `docs/base-de-dados.md`, `docs/edge-functions.md` (migração 0059) |
| 2026-09-25 | Se um `OPERADOR_H3` sai e uma semana fica sem H3 atribuído, a aplicação "tem de avisar" | `docs/alarmes.md` (ALA-07) |
| 2026-09-25 | Regra geral: **cada alarme tem de seguir obrigatoriamente o critério definido**, confirmado com o Gerente e testado com dados reais — depois de um alarme "H3 por atribuir" ter disparado por engano com uma linha solta que só existia nos dados reais | `docs/alarmes.md` |
| 2026-09-25 | A semana H3 (sábado a sexta, ativada às 22h de sexta-feira) fica formalmente definida como a âncora de referência de todo o calendário do turno | `docs/calendario-h3.md` |
| 2026-09-26 | Uma troca de H3 só pode incidir sobre um sábado (o início da semana H3) — antes uma referência a "quinta" podia deixar uma linha solta na escala | `docs/trocas-e-delegacao.md` (migração 0061) |
| 2026-09-26 | A hora-limite (HR. LIMITE) de uma tarefa passa a contar com o **dia** previsto de fim, não só a hora — um limite às 14h00 de sábado deixa de disparar às 15h00 de quinta | `docs/alarmes.md` |
| 2026-09-26 | A Sugestão automática de escala é reconstruída para seguir exatamente as mesmas regras já em prática em cada turno (as do preenchimento anual), em vez de uma lógica própria | `docs/sugestao-automatica.md` |
| 2026-09-28 | **Ninguém decide (aprova/rejeita) o seu próprio pedido de férias/licença ou a sua própria troca de H3** — nem por decisão direta, nem já a nascer decidido por INSERT; até aqui só o papel (Gerente/delegado) era verificado, nunca se essa pessoa era também a dona do pedido. Achado do stress-test de documentação, corrigido no mesmo dia | `docs/regras-entre-colegas.md` (COL-05, COL-12; migração 0062) |
| 2026-09-28 | **Um substituto de férias não pode ser a própria pessoa ausente; um delegado de aprovação não pode ser o próprio titular** — as duas regras já existiam, mas só como filtro do ecrã; passam a impostas na base. Achado do stress-test de documentação, corrigido no mesmo dia | `docs/regras-entre-colegas.md` (COL-06, COL-15; migração 0063) |

## 2. Decisões sobre como a equipa e a aplicação trabalham (processo)

| Data | Decisão | Onde vive |
| --- | --- | --- |
| 2026-09-25 | Todo o conhecimento da solução passa a viver em ficheiros Markdown de consulta obrigatória: um ficheiro mestre e um por funcionalidade, sempre lidos antes de qualquer alteração ou validação de regra | `CLAUDE.md`, `docs/` (este conjunto de ficheiros) |
| 2026-09-26 | Nenhuma alteração de código, de função do servidor ou de base de dados vai para produção sem autorização explícita, mesmo quando o pedido original era "implementa isto" — implementa-se e faz-se commit local, só se publica depois de perguntar | `docs/operacao.md`, OP-02 |
| 2026-09-27 | Confirmação em duas frases, sempre no fim de uma tarefa de implementação: o estado na Base de Dados e o estado no Netlify, verificados ao vivo | `docs/operacao.md`, OP-09 |

## 3. Como manter esta lista

- Uma decisão nova do Gerente entra aqui **e** no ficheiro que a aplica, na mesma alteração — nunca só num dos dois sítios.
- Uma decisão que **substitui** uma anterior não apaga a linha antiga: acrescenta-se a nova, por baixo, com a data de hoje; quem quiser o histórico completo lê as duas.
- As migrações que só corrigem um erro ou renomeiam algo, sem mudar uma regra vista pelo Gerente ou pela equipa, não entram aqui — ficam só no histórico do código e em `docs/base-de-dados.md`.

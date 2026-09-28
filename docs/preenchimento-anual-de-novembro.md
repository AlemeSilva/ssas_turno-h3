# Preenchimento anual de novembro (escala e feriados do ano seguinte)

**Estado:** levantado do código publicado e da base em produção a 2026-09-26; as regras vêm de decisões do Gerente (ver a secção 11). Ainda nunca correu em produção: a primeira execução real é a 1 de novembro de 2026, para 2027.
**Ler quando:** mexer em `preencher_escala_anual()` ou `preencher_feriados_anual()`, nos agendamentos de 1 de novembro, em `elegivel_h2`, `turno_fixo` ou `limite_h3_mensal`, no perfil `OPERADOR_H3`, ou preparar e verificar o 1 de novembro. Para os conceitos de semana H3 e sábado, ler antes `docs/calendario-h3.md`.

## 1. Em resumo

Todos os anos, a 1 de novembro, a base de dados prepara sozinha o calendário do ano seguinte:

1. às 02:00 (UTC) entram os **feriados** nacionais e o municipal de Lisboa do ano seguinte (15 linhas);
2. às 03:00 (UTC) entra a **escala** do ano seguinte inteiro: uma linha de escala por pessoa por semana (uma semana é de sábado a sexta), de 1 de janeiro a 31 de dezembro, com H1, H2, H3 e H4 atribuídos por regras fixas.

Não há botão nem ecrã para isto e ninguém tem de fazer nada para que aconteça. O resultado fica registado em `logs_auditoria`, e a barra de alertas avisa o Gerente se algo correu mal. Nada mais é criado ou alterado (não toca em férias, plantões, planos nem checklists).

## 2. Quando e como é disparado

| Agendamento (`pg_cron`) | Expressão | Hora (UTC) | Hora em Lisboa a 1 de novembro | Corre |
| --- | --- | --- | --- | --- |
| `preencher-feriados-anual` | `0 2 1 11 *` | 02:00 | 02:00 | `select preencher_feriados_anual();` |
| `preencher-escala-anual` | `0 3 1 11 *` | 03:00 | 03:00 | `select preencher_escala_anual();` |

- **NOV-01** O `pg_cron` da base trabalha em UTC. A 1 de novembro Portugal já está na hora de inverno (a mudança de hora é sempre no último domingo de outubro), por isso a hora local é igual à UTC.
- **NOV-02** O **ano-alvo** é sempre o ano da data de execução mais um (`extract(year from current_date) + 1`). Executada a 1 de novembro de 2026, preenche 2027.
- **NOV-03** As duas funções são independentes: a escala não lê os feriados e os feriados não leem a escala. O feriado corre uma hora antes só para ficarem na mesma janela de manutenção, fora de horas (migração 0020).
- Não há repetição automática. Se não correr ou falhar, só volta a correr se alguém a chamar à mão (secção 8).
- Ambos os agendamentos estão ativos. Verificado em 2026-09-26: ainda não existe nenhuma entrada de auditoria destes dois tipos, porque nunca correram.

## 3. Antes de 1 de novembro: o que tem de estar em ordem

A função lê a equipa **no momento em que corre**. Por isso, até ao fim de outubro, confirmar:

| O que | Onde se vê ou altera | Consequência se faltar |
| --- | --- | --- |
| **Pelo menos 3** utilizadores ativos com perfil `OPERADOR_H3` | Utilizadores | A escala **não é gerada** (registo `PREENCHIMENTO_AUTOMATICO_FALHOU`, alerta vermelho) |
| Pelo menos 1 `OPERADOR_H3` ativo com `elegivel_h2` | Utilizadores | H2 fica vazio todas as semanas (aviso âmbar) |
| Pelo menos 1 `OPERADOR` ativo com `turno_fixo` H1 | Utilizadores | H1 fica vazio o ano inteiro (aviso âmbar) |
| Pelo menos 1 `OPERADOR` ativo com `turno_fixo` H4, ou um Gerente ativo | Utilizadores | H4 fixo fica vazio (aviso âmbar) |
| `limite_h3_mensal` de cada `OPERADOR_H3` (vazio = sem limite) | Só se define ao registar; **não há ecrã para o alterar depois** | Ver **NOV-12**: se ninguém couber no limite, a semana falha |
| **Nenhuma** linha de `escala_semanal` no ano seguinte | Escala do Mês | Se existir uma só, a função **não faz nada** (**NOV-05**) |
| Férias ou licenças aprovadas que cubram uma semana inteira no início do ano seguinte | Escala do Mês | Essa semana falha (**NOV-15**) |

Estado de referência em 2026-09-26, só contagens: 3 `OPERADOR_H3` ativos (2 elegíveis a H2, todos com limite mensal: um de 1 e dois de 3), 2 `OPERADOR` ativos (um com `turno_fixo` H1 e um com H4), 1 Gerente ativo. A escala existente cobre as 52 semanas de 2026 (de 2026-01-03 a 2026-12-26) e a de 2027 ainda não existe.

## 4. Passo a passo: feriados (`preencher_feriados_anual`)

1. Calcula o ano-alvo (**NOV-02**).
2. **Guarda de idempotência (NOV-04):** se já existir qualquer feriado com `ano` igual ao ano-alvo, regista `PREENCHIMENTO_AUTOMATICO_IGNORADO` ("Já existiam feriados para AAAA — preenchimento automático não repetido.") e termina sem inserir nada.
3. Calcula a data da Páscoa gregoriana com `calcular_pascoa()` (algoritmo de Gauss/Meeus; verificado em 2024 = 31/03, 2025 = 20/04 e 2026 = 05/04).
4. Insere 15 feriados (`on conflict (data) do nothing`, porque `data` é única):

| Feriado | Data | Tipo |
| --- | --- | --- |
| Ano Novo | 1 de janeiro | NACIONAL |
| Carnaval | Páscoa − 47 dias | NACIONAL |
| Sexta-feira Santa | Páscoa − 2 dias | NACIONAL |
| Domingo de Páscoa | Páscoa | NACIONAL |
| Dia da Liberdade | 25 de abril | NACIONAL |
| Dia do Trabalho | 1 de maio | NACIONAL |
| Corpo de Deus | Páscoa + 60 dias | NACIONAL |
| Dia de Camões | 10 de junho | NACIONAL |
| Santo António (Lisboa) | 13 de junho | LISBOA (municipal) |
| Assunção de Maria | 15 de agosto | NACIONAL |
| Implantação da República | 5 de outubro | NACIONAL |
| Todos os Santos | 1 de novembro | NACIONAL |
| Restauração da Independência | 1 de dezembro | NACIONAL |
| Imaculada Conceição | 8 de dezembro | NACIONAL |
| Natal | 25 de dezembro | NACIONAL |

5. Regista `PREENCHIMENTO_AUTOMATICO` ("Feriados de AAAA preenchidos automaticamente — N linhas.").
6. Qualquer erro imprevisto regista `PREENCHIMENTO_AUTOMATICO_ERRO` ("Falhou a preencher feriados de AAAA: …") e a função devolve normalmente, sem relançar o erro (**NOV-06**: um `raise` desfaria a própria linha de auditoria).

Para que servem estes feriados: colunas rosa e "Feriado"/"Plantão" na Escala do Mês, lista de plantões no Início, vista `feriados_sem_plantao` e desconto de dias úteis no Headcount (`dias_uteis_sem_feriados`). Só entram feriados que a função conhece; não há feriados municipais fora de Lisboa, pontes nem tolerâncias de ponto. O Carnaval fica registado como feriado nacional.

## 5. Passo a passo: escala (`preencher_escala_anual`)

### 5.1 Preparação (uma vez por execução)

1. Calcula o ano-alvo (**NOV-02**) e o intervalo de 1 de janeiro a 31 de dezembro desse ano.
2. **Guarda de idempotência (NOV-05):** se existir **qualquer** linha em `escala_semanal` cuja `semana_ref` caia no ano-alvo, regista `PREENCHIMENTO_AUTOMATICO_IGNORADO` ("Já existiam dados de escala para AAAA — preenchimento automático não repetido.") e termina. Confirmado em 2026-09-26, numa transação revertida: com uma única linha de 2027 já gravada, a função não gerou mais nada.
3. Constrói os grupos de pessoas, sempre só com quem está **ativo**:
   - **Candidatos** = utilizadores `OPERADOR_H3` ativos.
   - **Elegíveis a H2** = candidatos com `elegivel_h2 = true`.
   - **H1 fixo** = utilizadores `OPERADOR` ativos com `turno_fixo = 'H1'`.
   - **H4 fixo** = utilizadores `OPERADOR` ativos com `turno_fixo = 'H4'`, mais o **Gerente titular ativo** (o de `criado_em` mais antigo; como a base só admite um Gerente ativo, é defensivo).
4. **Mínimo de 3 candidatos (NOV-07):** se houver menos de 3, regista `PREENCHIMENTO_AUTOMATICO_FALHOU` ("Só N OPERADOR_H3 ativo(s) ao preencher AAAA — mínimo de 3 para rodar H3/H2/H4. Preenchimento não avançou.") e termina sem gerar nada.
5. Prepara a lista de **avisos**, sem impedir nada: nenhum H1 fixo; nenhum H4 fixo nem Gerente; nenhum elegível a H2; mais de um Gerente ativo.

### 5.2 Ciclo semanal (uma vez por sábado do ano-alvo)

A função percorre **todos os sábados** de 1 de janeiro a 31 de dezembro do ano-alvo: 52 ou 53 semanas (em 2027 são 52, de 2027-01-02 a 2027-12-25). A semana identifica-se pelo seu sábado (`semana_ref`) e vai até à sexta seguinte. A semana que começa a 26 de dezembro de 2026 e acaba a 1 de janeiro de 2027 pertence a 2026, e a que começa a 25 de dezembro de 2027 (e acaba a 31 de dezembro) é a última de 2027.

**Cada semana é processada num bloco isolado (NOV-08).** Se algo falhar nessa semana, tudo o que essa semana já tinha inserido é desfeito, as outras semanas não são afetadas, e a falha fica anotada com o texto do erro. Antes desta regra (migração 0036), uma semana problemática desfazia o ano inteiro.

Em cada semana, pela ordem:

1. **Datas de referência.** Início da janela de 3 meses = sábado − 3 meses (como no Postgres: se o dia não existir, fica o último do mês). Mês-alvo = o mês do dia `semana_ref + 3`, ou seja, o mês onde cai a maioria dos 7 dias (**NOV-10**).
2. **Ordenar os candidatos a H3 (NOV-09).** Por esta ordem de critérios: (a) menos semanas de H3 nos últimos 3 meses (de `sábado − 3 meses` até à semana anterior); (b) menos semanas de H3 desde 1 de janeiro do ano-alvo; (c) o `id`, como último desempate — decide sempre que dois candidatos empatam nos dois critérios anteriores; na equipa de referência (secção 5.2) isso acontece repetidamente até meados de março, não só na primeira semana do ano. Conta também as semanas já geradas nesta mesma execução.
3. **Aplicar o limite mensal (NOV-10).** Para cada candidato, na ordem acima: conta as semanas de H3 dele no mesmo mês-alvo, **só as anteriores** a esta. Fica "dentro do limite" quem não tem limite (vazio) ou tem menos semanas do que o `limite_h3_mensal`.
4. **Escolher o H3.** O primeiro candidato dentro do limite. Se ninguém estiver dentro do limite, o código seleciona o primeiro da ordenação; mas essa inserção é **recusada** pelo trigger do limite, a semana falha e fica anotada (**NOV-12**). Ver o exemplo confirmado na secção 10.
5. **Inserir o H3** em `escala_semanal` (`criado_por` nulo, **NOV-16**). Todos os triggers da tabela se aplicam: além do limite mensal (NOV-12) e das férias (NOV-15), também `trg_valida_turno_h3` (exige `OPERADOR_H3` ativo) e `trg_valida_um_h3_por_semana` (máximo 1 H3 ativo por semana, versão da migração 0056) — inofensivos aqui porque a função já garante estas duas condições antes de inserir. Lista completa dos triggers da tabela em `docs/base-de-dados.md`.
6. **Escolher o H2 (NOV-11).** Entre os elegíveis a H2, **exceto** o H3 desta semana: menos semanas de H2 nos últimos 3 meses, depois menos desde 1 de janeiro, depois o `id`. Se não houver nenhum, a semana fica sem H2.
7. **Atribuir H4 aos restantes candidatos.** Todos os `OPERADOR_H3` que nesta semana não são H3 nem H2 ficam em H4.
8. **Inserir os fixos.** Cada H1 fixo fica em H1, e cada H4 fixo (mais o Gerente titular) fica em H4.
9. **Contar** a semana como preenchida, ou anotar a falha.

Com a equipa de referência, cada semana tem **6 linhas** (1 H3, 1 H2, 1 H4 do grupo rotativo, 1 H1 fixo, 1 H4 fixo e o Gerente em H4): 52 semanas dão 312 linhas. Ensaiado a 2026-09-26 contra os dados reais (numa transação revertida): 52 semanas geradas, 312 linhas, nenhuma falha.

Exemplo, com três operadores H3 (A: limite de 1 por mês e elegível a H2; B: limite de 3 e elegível a H2; C: limite de 3 e não elegível a H2), nas três primeiras semanas de 2027:

| Semana (sábado) | H3 | H2 | H4 (grupo rotativo) |
| --- | --- | --- | --- |
| 2027-01-02 | A | B | C |
| 2027-01-09 | C | A | B |
| 2027-01-16 | B | A | C |

H1 (fixo) e os H4 fixos (mais o Gerente) repetem-se todas as semanas. Ensaiado a 2026-09-10 (migração 0049): B e C ficaram com 20 semanas de H3 cada e A com 12 (o seu limite de 1 por mês é o que o trava).

### 5.3 Registo do resultado (uma vez por execução)

A função escreve **uma** linha em `logs_auditoria` (`referencia_tipo = 'ESCALA_ANUAL'`, `id_usuario` vazio), com uma de cinco classificações (**NOV-13**):

| `acao` | Quando | Descrição (resumo) |
| --- | --- | --- |
| `PREENCHIMENTO_AUTOMATICO` | Todas as semanas geradas e sem avisos | "Escala de AAAA preenchida automaticamente — N semanas." |
| `PREENCHIMENTO_AUTOMATICO_AVISO` | Todas as semanas geradas, mas com um ou mais avisos da preparação | Igual, mais "Atenção: …" com cada aviso |
| `PREENCHIMENTO_AUTOMATICO_ERRO` | Pelo menos uma semana falhou, ou um erro fora do ciclo semanal | Semana(s) falhada(s): "Escala de AAAA: N semana(s) preenchida(s), M falhou/falharam e precisam de preenchimento manual — AAAA-MM-DD: erro; …" (e os avisos, se os houver). Erro fora do ciclo semanal, antes de processar qualquer sábado: "Falhou a preencher AAAA antes do processamento semana a semana: erro" |
| `PREENCHIMENTO_AUTOMATICO_FALHOU` | Menos de 3 candidatos (nada gerado) | Ver 5.1, passo 4 |
| `PREENCHIMENTO_AUTOMATICO_IGNORADO` | Já havia linhas do ano-alvo | Ver 5.1, passo 2 |

Nota: as semanas falhadas nunca ficam meio preenchidas; ou têm as linhas todas, ou nenhuma.

## 6. Regras em que o procedimento assenta

| ID | Regra | Onde é imposta |
| --- | --- | --- |
| **NOV-01** | Os agendamentos correm em UTC, a 1 de novembro às 02:00 e às 03:00 | `cron.job` |
| **NOV-02** | Ano-alvo = ano da execução + 1; a escala é de todos os sábados de 1 de janeiro a 31 de dezembro desse ano | as duas funções |
| **NOV-03** | Feriados e escala são independentes | migração 0020 |
| **NOV-04** | Feriados: se o ano-alvo já tem feriados, não faz nada (`IGNORADO`) | `preencher_feriados_anual` |
| **NOV-05** | Escala: se o ano-alvo tem uma só linha de escala, não faz nada (`IGNORADO`) | `preencher_escala_anual` |
| **NOV-06** | As funções nunca relançam erros: registam-nos em `logs_auditoria` | migrações 0019 (escala) e 0020 (feriados, desde a criação) |
| **NOV-07** | Mínimo de 3 `OPERADOR_H3` ativos, senão não gera nada (`FALHOU`) | `preencher_escala_anual` (0035) |
| **NOV-08** | Cada semana é atómica: falha isolada, não perde as outras | migração 0036 |
| **NOV-09** | Rotação de H3: menos H3 em 3 meses, depois menos no ano, depois `id` | migração 0049 |
| **NOV-10** | Limite mensal: a semana conta no mês do dia `semana_ref + 3` | migração 0050 |
| **NOV-11** | H2 só entre `elegivel_h2`, nunca o H3 da semana, com as mesmas contagens de H2 | migrações 0035 e 0049 |
| **NOV-12** | Se ninguém couber no limite, a semana falha e fica para atribuição manual (não há exceção automática) | trigger `trg_valida_limite_h3_mensal` |
| **NOV-13** | Uma só entrada de auditoria por execução, com 5 classificações possíveis (as de 5.3) | migrações 0019, 0036, 0037 |
| **NOV-14** | H4 = restantes `OPERADOR_H3` + `OPERADOR` com `turno_fixo` H4 + Gerente titular (o mais antigo); H1 = `OPERADOR` com `turno_fixo` H1 | migrações 0029, 0035 e 0038 |
| **NOV-15** | Uma semana em que a pessoa a escalar tem férias ou licença aprovadas nos 7 dias falha | trigger `trg_valida_escala_sobre_ferias` |
| **NOV-16** | As linhas geradas têm `criado_por` vazio | `preencher_escala_anual` |

## 7. O que a equipa vê (interface)

- **Barra de alertas (topo, sempre visível).** Só o Gerente e o delegado veem estes avisos. Olha só para a **ação mais recente** de cada tipo (`ESCALA_ANUAL`, `FERIADOS_ANUAL`), sem filtrar por ano:
  - "Preenchimento automático de escala falhou" (vermelho) quando a última ação é `PREENCHIMENTO_AUTOMATICO_FALHOU` ou `PREENCHIMENTO_AUTOMATICO_ERRO`; ao passar o rato, mostra a descrição completa.
  - "Preenchimento automático de escala com aviso" (âmbar) quando é `PREENCHIMENTO_AUTOMATICO_AVISO` e não há falha.
  - "Preenchimento automático de feriados falhou" (vermelho) quando a última ação dos feriados é `FALHOU` ou `ERRO`. Os feriados não têm estado de aviso.
  - **`PREENCHIMENTO_AUTOMATICO_IGNORADO` não gera nenhum alerta** (ver a secção 10).
  - Um alerta desaparece sozinho quando uma execução posterior acabar em sucesso.
- **Histórico, separador Auditoria (só Gerente e delegado).** Mostra as últimas 200 ações, da mais recente para a mais antiga, com data/hora, ação, utilizador e descrição. Para as do 1 de novembro: escrever `PREENCHIMENTO` no campo "Tipo de ação (texto)" e pesquisar. O tipo de referência (`ESCALA_ANUAL`/`FERIADOS_ANUAL`) **não** aparece na tabela: distinguir pela descrição ("Escala de AAAA…" ou "Feriados de AAAA…"). O utilizador aparece como "—" porque quem escreve é a base.
- **Escala do Mês.** Com as setas de mês vai-se até janeiro do ano seguinte. Uma semana sem nenhuma linha (falhada) mostra as células dos dias úteis em branco, de propósito, para se ver a falta.
- O aviso "H3 por atribuir: N semanas" (barra de alertas) é uma segunda rede: aponta semanas que têm escala mas nenhum H3 ativo, a partir da semana em curso.

## 8. Depois de 1 de novembro: verificar e corrigir

Passos, por esta ordem (Gerente ou delegado):

1. Ver a barra de alertas: há alguma etiqueta de preenchimento automático?
2. Histórico, Auditoria, pesquisar `PREENCHIMENTO`: ler a entrada mais recente de escala e a de feriados. Confirmar que a de escala diz "N semanas" igual ao número de sábados do ano (52 ou 53) e que a de feriados diz "15 linhas".
3. Escala do Mês: navegar até janeiro (e algumas semanas de outros meses) do ano seguinte e conferir os seis lugares por semana (H1, H2, H3 e os H4).
4. **Se houver semanas falhadas:** a descrição do alerta lista cada `AAAA-MM-DD` com o motivo. Corrigir a causa (por exemplo, o limite mensal de uma pessoa ou umas férias que cobrem a semana toda) e depois preencher a semana com **Sugerir automaticamente** (Escala do Mês): escolher o sábado da semana, "Calcular sugestão" e "Aplicar à escala". A sugestão segue as mesmas regras do preenchimento (ver `docs/turnos-e-rotacao.md`). Clicar numa célula só edita linhas que já existem, por isso não serve para semanas falhadas.
5. Se a entrada for `IGNORADO` ou `FALHOU`, tratar a causa (secção 3) antes de qualquer outra coisa.

**Executar de novo à mão.** Chamar `select preencher_escala_anual();` (ou `preencher_feriados_anual()`) só tem efeito se o ano-alvo estiver **completamente vazio**. Depois de uma execução parcial já existem linhas, por isso a função regista `IGNORADO` e nada faz: as semanas em falta preenchem-se uma a uma. Refazer o ano do zero exigiria apagar todas as linhas desse ano em `escala_semanal`, o que é uma decisão do Gerente e não se faz sem o seu pedido expresso.

## 9. Operadores registados ou reativados em novembro e dezembro

O preenchimento do 1 de novembro não vê quem entra depois. Por isso, ao **registar** um utilizador com perfil `OPERADOR` e `turno_fixo` (função `gerir-utilizadores`) e ao **reativar** um `OPERADOR` com `turno_fixo` (botão "Reativar" em Utilizadores, feito pelo próprio browser), a aplicação compõe logo a escala dessa pessoa, com o turno fixo dela:

- do primeiro sábado a partir do dia seguinte ao registo (ou à reativação), inclusive, até 31 de dezembro do ano corrente;
- **e**, se isso acontecer em novembro ou dezembro, também **todos** os sábados do ano seguinte (do primeiro sábado em ou depois de 1 de janeiro até 31 de dezembro).

Isto só acontece para o perfil `OPERADOR`. Um `OPERADOR_H3` ou um Gerente novo (ou reativado) **não** recebe escala automaticamente; entra na rotação através do preenchimento anual seguinte, da Sugestão automática ou de edição manual. Se a composição falhar, a conta fica criada e a falha fica registada (`COMPOSICAO_ESCALA_FALHOU`) para preenchimento manual. Detalhes em `docs/utilizadores-e-saidas.md`.

**Interação com a secção 5.1, passo 2:** registar ou reativar um `OPERADOR` em novembro **antes** das 03:00 de dia 1 gravaria linhas do ano seguinte, e a função de escala ficaria `IGNORADA`. Na prática só há esse risco no próprio dia 1, antes da execução.

## 10. Limites, riscos e lacunas conhecidas

Todos confirmados por leitura do código ou por ensaio em transação revertida, a 2026-09-26.

- **`IGNORADO` não avisa ninguém.** Se existir uma única linha de escala do ano seguinte, a função nada faz e a barra de alertas fica sem etiqueta, porque só olha para `FALHOU`, `ERRO` e `AVISO`. Ensaio: com uma linha de 2027 gravada, ficou só essa linha e o registo `PREENCHIMENTO_AUTOMATICO_IGNORADO`. Rede parcial: o aviso "H3 por atribuir" apanharia as semanas sem H3.
- **O limite mensal é rígido.** Ensaio: com `limite_h3_mensal = 0` para todos os `OPERADOR_H3`, as 52 semanas falharam com "Utilizador já atingiu o limite de 0 H3/mês em 01/2027" e nenhuma linha foi gerada (registo `ERRO`). Quando ninguém cabe no limite de um mês, essa semana fica vazia à espera de atribuição manual. (A Sugestão automática, ao contrário, marca a proposta como "override" quando ninguém cabe no limite, mas o "Aplicar" cai no mesmo trigger.)
- **Férias não são consideradas na escolha.** A função pode escolher para H3 alguém que tenha férias durante essa semana. Só falha se as férias aprovadas cobrirem **os 7 dias**. O que fica coberto por um substituto decide-se depois, no Início (ver `docs/ferias-e-plantoes.md`). Como as férias só se pedem para o ano corrente, no dia 1 de novembro só podem existir férias que atravessem a viragem do ano.
- **Feriados sem teste automático.** A função `preencher_feriados_anual` e os dois agendamentos não têm teste pgTAP (só a escala tem).
- **Só corre uma vez por ano, sem repetição.** Se não correr no dia, ninguém é avisado de que não correu: a barra de alertas depende de existir uma linha de auditoria. Verificar sempre a 1 e 2 de novembro (secção 8).
- **Alterações à equipa depois de 1 de novembro** não voltam a rodar o ano. Uma saída apaga a escala futura da pessoa (regra de desativação; ver `docs/utilizadores-e-saidas.md`), o que deixa semanas sem essa pessoa; o aviso "H3 por atribuir" e a Sugestão automática servem para refazer essas semanas.
- **Comentários antigos.** Alguns comentários de colunas na base (por exemplo em `usuarios.limite_h3_mensal`, que diz "mês do sábado do ciclo") estão desatualizados face à regra do mês da maioria dos dias. Vale este documento.
- **O aviso "mais de um Gerente ativo" (secção 5.1, passo 5) está hoje inatingível.** É um dos avisos que a preparação sabe produzir, mas desde a migração 0042 (`ux_usuarios_gerente_titular_unico`, índice único parcial) a base nunca permite mais de um Gerente ativo em simultâneo — esta condição não pode ocorrer em produção. Mantido só como defesa em profundidade.

## 11. Origem das regras (decisões e migrações)

| Data | Decisão ou achado | Migração |
| --- | --- | --- |
| 2026-08-03 | O Gerente decide que o preenchimento do ano seguinte é automático e definitivo, a 1 de novembro; regras da rotação H3/H2/H4 confirmadas por ele (na altura por nome) | 0015 |
| 2026-08-03 | A função falhava sem deixar rasto: passa a registar sempre em `logs_auditoria` | 0019 |
| 2026-08-03 | Pedido do Gerente: feriados também automáticos, depois de o 8 de dezembro e o Corpo de Deus ficarem de fora do calendário de 2026 | 0020 |
| 2026-08-12 | `turno_fixo` passa a ser atributo da pessoa (não inferido do histórico) | 0029 |
| 2026-08-27 | Deixa de depender de nomes: qualquer conjunto de `OPERADOR_H3` ativos (mínimo 3); H2 passa a atributo `elegivel_h2` | 0035 |
| 2026-08-27 | Semana falhada deixa de arrastar o ano inteiro | 0036 |
| 2026-08-27 | Pool vazio de H1, H4 fixo ou H2 passa a aviso (âmbar) | 0037 |
| 2026-08-27 | Só o Gerente titular mais antigo recebe H4 | 0038 |
| 2026-09-10 | Desempate justo: 3 meses, depois ano, depois `id` | 0049 |
| 2026-09-11 | Limite mensal conta a semana no mês da maioria dos dias | 0050 |

## 12. Testes

Suite pgTAP (ver `docs/testes.md`), todos numa transação revertida contra a base real:

- `supabase/tests/14_preencher_escala_anual_trio_generico.sql`: grupo rotativo genérico (3 reais, menos de 3, mais de 3 com não elegíveis a H2).
- `supabase/tests/15_preencher_escala_anual_falha_isolada.sql`: uma semana com férias a cobri-la por inteiro falha sozinha; as outras são geradas; a auditoria fica `ERRO`.
- `supabase/tests/16_preencher_escala_anual_avisos.sql`: pool de H1 ou de H2 vazio gera o ano com aviso.
- `supabase/tests/17_preencher_escala_anual_gerente_titular.sql` e `19_gerente_titular_unico.sql`: o Gerente titular e a proibição de dois em simultâneo.
- Sem teste: o limite rígido (só ensaiado à mão), `preencher_feriados_anual` e os agendamentos.

## 13. Código

- Funções da base: `preencher_escala_anual()` e `preencher_feriados_anual()` (versões em vigor: as das migrações 0050 e 0048); `calcular_pascoa()`.
- Agendamentos: `cron.job` (criados nas migrações 0015 e 0020).
- Interface: `src/data/useSaudeAutomacaoAnual.ts`, `src/lib/alertas.ts` (`avaliarSaudeAutomacaoAnual`, `avaliarAvisoAutomacaoAnual`), `src/layout/AlertBar.tsx`, `src/pages/HistoricoPage.tsx`.
- Composição da escala de um operador novo: `src/lib/composicaoEscala.ts` e a cópia `supabase/functions/gerir-utilizadores/composicaoEscala.ts`.

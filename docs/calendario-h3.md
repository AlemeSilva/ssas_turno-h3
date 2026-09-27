# Calendário do Turno H3: semanas, âncoras e conversões

**Estado:** a semana H3 (sábado a sexta, ativada às 22h de sexta-feira) foi **definida pelo Gerente** a 2026-09-25 e confirmada pelos documentos de origem (`SAS/CheckList.xlsx`, `SAS/Escala_2026.xlsx`). O resto foi levantado do código e da base a 2026-09-26; os exemplos foram calculados com as funções reais.
**Ler quando:** qualquer tarefa que envolva semana, turno, sábado, sexta-feira, quinta-feira, 22h, ciclo, período, mês de uma semana, escala, trocas, plano, relatório ou alarme. **Regra de ouro: antes de escrever uma data, decidir qual das âncoras da secção 1 se aplica.**

## 1. Não existe uma só "semana": existem cinco âncoras

O Turno H3 mede o tempo de cinco maneiras diferentes, cada uma com o seu dono. Confundi-las foi a causa dos erros que já custaram a confiança do Gerente (a troca de turno pedida numa quinta, o falso aviso de semana sem H3). Nunca se misturam.

| # | Nome | Dias | Chave (o que se grava) | Onde vive |
| --- | --- | --- | --- | --- |
| 1 | **Semana H3 / escala** | **sábado a sexta** (7 dias) | `escala_semanal.semana_ref` = o **sábado**; o mesmo em `trocas_escala.semana_ref` | Escala do Mês, trocas, sugestão automática, preenchimento anual, alarme "H3 por atribuir" |
| 2 | **Ciclo do Plano de Fim de Semana** | **quinta a segunda** (5 dias) | `planos.data_inicio_ciclo` = a **quinta** | Plano de Fim de Semana, Checklist Ativo, barra de alertas |
| 3 | **Período do relatório semanal** | **sexta a quinta** (7 dias) | rótulo = a **sexta** ("sexta administrativa"); consulta a escala do sábado seguinte | Relatórios, cartão "Próxima semana" do Início |
| 4 | **Semana civil de férias** | **segunda a sexta** (5 dias úteis) | `ferias_semanas.semana_inicio` = a **segunda** | Substituto de uma ausência, Início, Escala do Mês |
| 5 | **Mês de uma semana H3** | o mês do dia `semana_ref + 3` | (calculado) | Limite mensal de H3 |

Regras basilares (as duas primeiras foram definidas pelo Gerente):

- **SEM-01** `escala_semanal.semana_ref` é **sempre um sábado**; a linha cobre de sábado a sexta. Uma linha noutro dia da semana **não é uma semana** e nenhum cálculo a trata como tal. A base recusa trocas que não sejam de um sábado (migração 0061), o ecrã e a sugestão só aceitam sábados, e o alarme "H3 por atribuir" ignora linhas fora de sábado. A base **não** impede ainda uma linha de escala fora de sábado (ver `docs/limites-e-lacunas.md`).
- **SEM-02** O turno H3 trabalha **22h00 às 07h00**. Por isso a semana se **ativa às 22h00 de sexta-feira**, na véspera do sábado do `semana_ref`, e dura até às 22h00 da sexta seguinte.
- **SEM-03** Até às 21h59 de uma sexta ainda é a semana H3 anterior; a partir das 22h00 já é a do sábado seguinte (`sabadoDaSemanaH3`, `ativacaoH3DaSemana`).
- **SEM-04** O ciclo do plano começa numa **quinta** e cobre quinta, sexta, sábado, domingo e segunda. O sábado desse ciclo é a `data_inicio_ciclo + 2`, e é a linha de escala que decide quem é o "operador do ciclo".
- **SEM-05** O relatório semanal e o cartão "Próxima semana" descrevem o período de **sexta a quinta**, rotulado pela sexta; o H3 só arranca às 22h dessa sexta. A escala consultada é a do **sábado seguinte** a essa sexta.
- **SEM-06** Férias e substitutos raciocinam por **semana civil, de segunda a sexta**; o substituto decide-se semana a semana.
- **SEM-07** Uma semana pertence ao **ano do seu sábado**: a semana de 2026-12-26 a 2027-01-01 é de 2026, e a de 2027-12-25 a 2027-12-31 é de 2027.
- **SEM-08** O **mês** de uma semana H3 (para o limite mensal) é o mês do 4.º dia da semana, `semana_ref + 3`, onde cai a maioria dos 7 dias (migração 0050). A semana de 2026-10-31 a 2026-11-06 é de novembro.
- **SEM-09** Um fim de semana é de **manutenção** quando o sábado do ciclo (`data_inicio_ciclo + 2`) é o **último sábado do mês** desse sábado (`calcula_tipo_fim_semana`). A base admite forçar o tipo à mão (`tipo_fim_semana_manual`), mas não há ecrã para isso.
- **SEM-10** Datas de calendário guardam-se como texto ISO local (`AAAA-MM-DD`), construídas a partir dos componentes locais. Nunca `toISOString()` para "hoje": converte para UTC e dá "um dia a menos" perto da meia-noite em Portugal.

## 2. Conversões entre as âncoras

Todas com a semana de exemplo do sábado **2026-10-17** (semana H3 de 17/10 a 23/10). O ciclo do plano correspondente começa na quinta **2026-10-15**.

| De | Para | Regra | Função | Exemplo |
| --- | --- | --- | --- | --- |
| Sábado da semana H3 | Momento em que o H3 dessa semana se ativa | sábado − 1 dia, às 22h00 | `ativacaoH3DaSemana` | 2026-10-17 → sexta 2026-10-16 22:00 |
| Sábado da semana H3 | Último dia da semana | sábado + 6 dias (sexta) | `descreverSemanaH3` | 2026-10-17 → 2026-10-23 |
| Sábado da semana H3 | Quinta do ciclo do plano | sábado − 2 dias | (aritmética) | 2026-10-17 → 2026-10-15 |
| Quinta do ciclo (`data_inicio_ciclo`) | Sábado da escala desse ciclo | quinta + 2 dias | `operador_do_ciclo`, `calcula_tipo_fim_semana`, `gerarTarefasTemplate` | 2026-10-15 → 2026-10-17 |
| Quinta do ciclo | Sexta, sábado, domingo, segunda | + 1, + 2, + 3, + 4 dias | `gerarTarefasTemplate`, `usePlanoCiclo` | 16, 17, 18, 19 de outubro |
| "Sexta administrativa" (rótulo do relatório) | Sábado da escala a consultar | sexta + 1 dia | `RelatoriosPage` | 2026-10-16 → 2026-10-17 |
| "Sexta administrativa" | Fim do período do relatório | sexta + 6 dias (quinta) | `RelatoriosPage`, `Início` | 2026-10-16 → quinta 2026-10-22 |
| Semana H3 | Mês da semana | mês de `semana_ref + 3` | `trg_valida_limite_h3_mensal`, `janelaDoMesH3` | 2026-10-31 → 2026-11-03 → novembro |
| Um dia qualquer | Linha de escala que o cobre | a linha com `semana_ref ≤ dia ≤ semana_ref + 6` | `linhaDoDia` (Escala do Mês, Início) | 2026-10-16 (sexta) → linha do sábado 2026-10-10 |
| Um dia qualquer | Segunda da semana civil | recua até à segunda | `segundaDaSemanaDe` | 2026-10-16 → 2026-10-12 |

### 2.1 De um dia qualquer à âncora certa (o dia de "hoje" varia; a âncora não)

Calculado com o código real. Coluna a coluna: **ciclo do plano** = `semanaRefDe`; **quinta do relatório** = `quintaEscalaDe`; **sexta administrativa** = `proximaSextaISO`; **segunda civil** = `segundaDaSemanaDe`; **semana H3 às 12h** e **às 22h** = `sabadoDaSemanaH3`.

| Dia | Ciclo do plano (quinta) | Quinta do relatório | Sexta administrativa | Segunda civil | Semana H3 às 12h | Semana H3 às 22h |
| --- | --- | --- | --- | --- | --- | --- |
| qua 2026-10-14 | 2026-10-15 (a próxima) | 2026-10-08 | 2026-10-16 | 2026-10-12 | 2026-10-10 | 2026-10-10 |
| qui 2026-10-15 | 2026-10-15 | 2026-10-15 | 2026-10-16 | 2026-10-12 | 2026-10-10 | 2026-10-10 |
| sex 2026-10-16 | 2026-10-15 | 2026-10-15 | 2026-10-16 (hoje) | 2026-10-12 | 2026-10-10 | **2026-10-17** |
| sáb 2026-10-17 | 2026-10-15 | 2026-10-15 | 2026-10-23 | 2026-10-12 | 2026-10-17 | 2026-10-17 |
| dom 2026-10-18 | 2026-10-15 | 2026-10-15 | 2026-10-23 | 2026-10-12 | 2026-10-17 | 2026-10-17 |
| seg 2026-10-19 | 2026-10-15 | 2026-10-15 | 2026-10-23 | 2026-10-19 | 2026-10-17 | 2026-10-17 |
| ter 2026-10-20 | 2026-10-22 (a próxima) | 2026-10-15 | 2026-10-23 | 2026-10-19 | 2026-10-17 | 2026-10-17 |
| qua 2026-10-21 | 2026-10-22 (a próxima) | 2026-10-15 | 2026-10-23 | 2026-10-19 | 2026-10-17 | 2026-10-17 |
| qui 2026-10-22 | 2026-10-22 | 2026-10-22 | 2026-10-23 | 2026-10-19 | 2026-10-17 | 2026-10-17 |
| sex 2026-10-23 | 2026-10-22 | 2026-10-22 | 2026-10-23 (hoje) | 2026-10-19 | 2026-10-17 | **2026-10-24** |

O que se lê daqui, sem erro possível:

- **SEM-11** `semanaRefDe` (ciclo do plano) recua para a quinta mais recente de quinta a segunda, mas **avança para a quinta seguinte** à terça e à quarta ("entre ciclos", ainda não há plano). Por isso o Plano e o Checklist só mudam de ciclo à terça.
- **SEM-12** `quintaEscalaDe` (relatório) **nunca avança até à própria quinta**: só muda de período às 00h00 de quinta-feira. O relatório da semana seguinte só aparece quando o Gerente o publica, na quinta.
- **SEM-13** `proximaSextaISO` devolve **hoje** se hoje for sexta, senão a sexta seguinte. É a "sexta administrativa" do cartão "Próxima semana" e do Início.
- **SEM-14** A semana H3 em curso muda **às 22h de sexta**, não à meia-noite. Só o alarme "H3 por atribuir" aplica esta regra das 22h; a Escala do Mês e o Início mostram a semana pela data civil do dia (na sexta à noite, depois das 22h, continuam a mostrar a linha do sábado anterior).

## 3. Dias úteis, fins de semana e feriados

- **SEM-15** "Fim de semana" é sábado e domingo. **Ao fim de semana só o H3 está escalado**: as células de H1, H2 e H4 ficam sem turno (dia "Folga"). (`ehFimDeSemana`, Escala do Mês, Início.)
- **SEM-16** **Dia útil** = segunda a sexta. Nas férias, o saldo de 22 dias conta dias úteis **sem descontar feriados** (`dias_uteis`); o Headcount conta dias úteis **descontando feriados** (`dias_uteis_sem_feriados`).
- **SEM-17** Um dia de férias só se marca na Escala do Mês em dia útil que não seja feriado; fins de semana e feriados dentro de um período de férias não se marcam como "F".
- **SEM-18** Num **feriado**, os turnos H1, H2 e H4 não trabalham: quem faz o plantão aparece como "Plantão" e os outros como "Feriado". O **H3 trabalha sempre**: ao fim de semana cobre o dia inteiro sozinho; num dia útil trabalha até às 07h00 e um plantonista rende-o daí até ao fim da cadeia diária. (Ver `docs/ferias-e-plantoes.md`.)

## 4. Fuso horário e relógio

- A **base de dados** trabalha em UTC (`TimeZone = UTC`). `current_date` é a data UTC; os agendamentos (`pg_cron`) também. Onde a data de Lisboa importa, a base converte-a de forma explícita: a limpeza da desativação usa `(now() at time zone 'Europe/Lisbon')::date`.
- O **browser** usa a hora local do utilizador (Portugal). Em testes de ecrã, o relógio pode ser fixado com `window.__TEST_TIME__` (função `agora()`); nunca com `page.clock`.
- O preenchimento anual de novembro corre às 02:00 e às 03:00 UTC, que a 1 de novembro coincidem com a hora de Lisboa (hora de inverno).
- O corte das saídas (`desactivar-saidos`) foi desenhado para correr todos os dias às 01:00 UTC, já depois da meia-noite de Lisboa; **hoje não está agendado** (`docs/edge-functions.md`, EDG-06).

## 5. Origem

| Facto | Fonte |
| --- | --- |
| Semana H3 de sábado a sexta; ativação às 22h de sexta | Gerente, 2026-09-25; `CheckList.xlsx` ("BATCH SEXTA PARA SÁBADO", 22h); `Escala_2026.xlsx` (blocos H3 de sábado a sexta, por exemplo 03/01 a 09/01/2026) |
| Ciclo do plano de quinta a segunda | `Plano_Fim_Semana.xlsx`; `gerarTarefasTemplate` |
| Período do relatório de sexta a quinta | Modelo real do relatório usado pelo Gerente; `gerarRelatorioSemanal.ts` |
| Mês da semana pela maioria dos dias | Gerente, 2026-09-11 (migração 0050) |
| Trocas só em sábados | Gerente, 2026-09-26 (migração 0061) |

## 6. Código e testes

- `src/lib/datas.ts` (todas as conversões do ecrã); `supabase/functions/sugerir-escala/algoritmo.ts` (`ehSabado`, `somarDias`, `subtrairMeses`, `mesDaSemanaH3`, `janelaDoMesH3`); SQL: `operador_do_ciclo`, `calcula_tipo_fim_semana`, `trg_valida_limite_h3_mensal`, `trg_valida_troca`.
- Testes: `tests/camada2-regras/datas.test.ts` (âncoras, ativação às 22h, virada de ano), `tests/camada2-regras/algoritmo-sugestao-h3.test.ts` (mês pela maioria dos dias, todos os sábados de 2026 a 2030), `supabase/tests/04_calcula_tipo_fim_semana.sql`, `supabase/tests/28_troca_semana_ao_sabado.sql`.

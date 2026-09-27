# Turnos H1 a H4, ciclos e rotação

**Estado:** horários e composição levantados do código e da base a 2026-09-26. A rotação e o limite mensal vêm de decisões do Gerente (2026-08-03, 2026-08-27, 2026-09-10 e 2026-09-11). Vale este ficheiro; onde o código o contradisser, é o código que está errado ou desatualizado e deve ser dito ao Gerente antes de mexer.
**Ler quando:** escala, turnos, rotação de H3 ou H2, limite mensal, sugestão automática, preenchimento anual, trocas, ou qualquer pergunta do tipo "quem trabalha quando". Para as datas, ler antes `docs/calendario-h3.md`; para as relações entre pessoas, `docs/regras-entre-colegas.md`.

## 1. Os quatro turnos

| Turno | Horário | Quem o ocupa | Nota |
| --- | --- | --- | --- |
| **H1** | 07h00 às 16h00 | `OPERADOR` com `turno_fixo = H1` (o mesmo todas as semanas) | Só dias úteis |
| **H2** | 14h00 às 23h00 | `OPERADOR_H3` elegível a H2 (`elegivel_h2`), em rotação | Só dias úteis |
| **H3** | 22h00 às 07h00 | `OPERADOR_H3`, em rotação; **um por semana** | O único turno que trabalha ao fim de semana e nos feriados |
| **H4** | 09h00 às 18h00 | `OPERADOR` com `turno_fixo = H4`; o Gerente titular; e os `OPERADOR_H3` que nessa semana não são H3 nem H2 | Só dias úteis |

- **TUR-01** Os horários são fixos e servem de rótulo no ecrã (Escala do Mês, Início, relatório semanal, registo de utilizadores). Nenhuma regra da base os aplica nem valida.
- **TUR-02** Cada pessoa tem **um só turno por semana** (`escala_semanal` é única por `semana_ref` e `usuario_id`). A mudança de turno faz-se sempre por semana inteira: o ecrã de edição altera "a semana inteira, não só o dia selecionado".
- **TUR-03** Ao fim de semana **só o H3 está escalado**; H1, H2 e H4 folgam (`docs/calendario-h3.md`, SEM-15). Nos feriados, o H3 trabalha e os restantes ficam "Feriado", ou "Plantão" quem foi escolhido para o plantão (SEM-18).
- O **Gerente** aparece na grelha com uma linha H4 fixa, mas **nunca** entra no relatório semanal ("Operação SAS" é só a equipa operacional).

## 2. Quem pode ocupar cada turno (o que a base impõe)

Só o H3 tem restrições de perfil na base. Os outros turnos seguem convenções da rotação automática, mas a edição manual não as impõe.

| ID | Regra | Imposta por |
| --- | --- | --- |
| **TUR-04** | Só um utilizador **ativo** com perfil `OPERADOR_H3` pode ser escalado para H3 ("Só utilizadores com perfil OPERADOR_H3 (ativos) podem ser escalados para H3.") | trigger `trg_valida_turno_h3` |
| **TUR-05** | Uma semana tem **no máximo um H3** ativo ("Já existe um H3 registado para a semana de …. Máximo 1 H3 por semana."). Um H3 já desativado não conta | trigger `trg_valida_um_h3_por_semana` |
| **TUR-06** | Limite mensal: um `OPERADOR_H3` com `limite_h3_mensal` não pode ter mais semanas de H3, no mesmo mês, do que esse limite ("Utilizador já atingiu o limite de N H3/mês em MM/AAAA."). O mês de uma semana é o do dia `semana_ref + 3`. Sem limite definido, não há trava | trigger `trg_valida_limite_h3_mensal` |
| **TUR-07** | Não se atribui turno a quem tem férias ou licença **aprovadas nos 7 dias** da semana. Com pelo menos um dia livre, o turno atribui-se ("Não é possível atribuir turno: operador está de férias/licença aprovadas a semana inteira.") | trigger `trg_valida_escala_sobre_ferias` |
| **TUR-08** | `turno_fixo` só pode ser H1 ou H4 e só existe em utilizadores com perfil `OPERADOR` | restrições `chk_turno_fixo_valores` e `chk_turno_fixo_so_operador` |
| **TUR-09** | `elegivel_h2` só pode ser verdadeiro em `OPERADOR_H3` | restrição `chk_elegivel_h2_so_operador_h3` |

Uma consequência do que **não** está imposto: a edição manual de uma célula pode pôr qualquer pessoa em H1, H2 ou H4, mesmo fora da regra da rotação.

## 3. Os ciclos

### 3.1 O ciclo semanal (sábado a sexta)

A escala é uma linha por pessoa por semana H3 (`semana_ref` = sábado). O H3 dessa semana ativa-se às 22h de sexta-feira e dura até às 22h da sexta seguinte. Os outros turnos trabalham nos dias úteis dessa mesma semana (segunda a sexta, contando a partir do sábado de `semana_ref`). Ver `docs/calendario-h3.md` para as datas exatas.

### 3.2 A rotação entre os `OPERADOR_H3`

É o mecanismo que decide quem é H3, H2 e H4 em cada semana. É **o mesmo** no preenchimento anual de novembro e na Sugestão automática:

- **TUR-10** **H3**: entre os `OPERADOR_H3` ativos, quem tem **menos semanas de H3 nos últimos 3 meses**; em empate, quem tem menos desde 1 de janeiro; em empate, o `id`. Respeita o limite mensal (TUR-06). A Sugestão evita ainda quem tem férias (aprovadas ou pendentes) a sobrepor a semana.
- **TUR-11** **H2**: entre os `OPERADOR_H3` ativos com `elegivel_h2`, **exceto o H3 dessa semana**, quem tem menos semanas de H2 nos últimos 3 meses; depois menos desde 1 de janeiro; depois o `id`.
- **TUR-12** **H4**: os `OPERADOR_H3` que nessa semana não são H3 nem H2; mais os `OPERADOR` com `turno_fixo` H4 e o Gerente titular (o ativo de `criado_em` mais antigo, hoje único).
- **TUR-13** **H1**: os `OPERADOR` com `turno_fixo` H1.
- **TUR-14** "Últimos 3 meses" = de `sábado − 3 meses` até à semana anterior (regra do Postgres: se o dia não existir, fica o último do mês). O desempate final pelo `id` só decide no início do ano, quando tudo está a zero.

Exemplo, com três `OPERADOR_H3` (A: limite de 1 por mês e elegível a H2; B: limite de 3 e elegível a H2; C: limite de 3 e não elegível a H2), um H1 fixo, um H4 fixo e o Gerente, nas três primeiras semanas de 2027 (calculado com o preenchimento real, numa transação revertida):

| Semana (sábado) | H3 | H2 | H4 (rotativo) | H1 | H4 (fixo e Gerente) |
| --- | --- | --- | --- | --- | --- |
| 2027-01-02 | A | B | C | fixo | fixo + Gerente |
| 2027-01-09 | C | A | B | fixo | fixo + Gerente |
| 2027-01-16 | B | A | C | fixo | fixo + Gerente |

Cada semana tem, com esta equipa, 6 linhas de escala (1 H3, 1 H2, 1 H4 rotativo, 1 H1, 1 H4 fixo e o Gerente).

### 3.3 O limite mensal

- **TUR-15** O limite conta semanas de H3 por **mês da semana** (SEM-08: o mês do dia `semana_ref + 3`), não pelo mês do sábado. A semana de 2026-10-31 a 2026-11-06 conta para novembro.
- **TUR-16** O limite é **rígido na base de dados**: quem já o atingiu não pode receber outro H3 nesse mês, nem à mão nem pelo preenchimento nem pela Sugestão. Se ninguém coube, a semana não se preenche sozinha (`docs/preenchimento-anual-de-novembro.md`, NOV-12). Uma exceção pontual só se faz por ação direta na base, a pedido do Gerente, e fica registada em auditoria.
- O limite define-se **ao registar** o utilizador; não há ecrã para o alterar depois.

### 3.4 O ciclo anual

A 1 de novembro a base preenche o ano seguinte inteiro com estas regras. Descrito, passo a passo, em `docs/preenchimento-anual-de-novembro.md`.

### 3.5 O ciclo do fim de semana (plano e checklist)

Independente da rotação: o plano de fim de semana vai de quinta a segunda e a operação do "operador do ciclo" (o H3 dessa semana) tem permissões especiais sobre o plano (`docs/plano-de-fim-de-semana.md`). O último sábado de cada mês é um fim de semana de **manutenção** (SEM-09).

## 4. Mudar quem faz o quê

| Mudança | Como | Quem | Efeito |
| --- | --- | --- | --- |
| Corrigir o turno de uma pessoa numa semana | Escala do Mês: clicar na célula, escolher o turno, Gravar | Gerente ou delegado | Muda a linha da semana inteira; só linhas que já existem |
| Preencher uma semana em falta | Escala do Mês, "Sugerir automaticamente" | Gerente ou delegado | Grava H1 a H4 dessa semana (`docs/sugestao-automatica.md`) |
| Passar o H3 de uma semana a outro `OPERADOR_H3` | Trocas de H3 (Escala do Mês) | Propõe um `OPERADOR_H3`; decide o Gerente ou delegado | Ao aprovar, o substituto fica com o H3 (`docs/trocas-e-delegacao.md`) |
| Cobrir uma ausência | Início, "Confirmar substituto" | Gerente ou delegado | Decide-se por semana civil (`docs/ferias-e-plantoes.md`) |
| Fixar H1 ou H4 de um `OPERADOR` | Utilizadores, seletor do turno fixo | Gerente ou delegado | Só vale para composições futuras, não para a escala já gerada |
| Tornar um `OPERADOR_H3` elegível a H2 | Utilizadores, seletor "H2: sim/não" | Gerente ou delegado | Só vale para composições futuras |

## 5. Testes e código

- Base: `supabase/tests/02_trigger_turno_h3.sql`, `13_trigger_escala_ferias_parcial.sql`, `14`, `15`, `16`, `17` (preenchimento anual), `24_inativos_deixam_de_contar_em_regras.sql`.
- Lógica de rotação: `supabase/functions/sugerir-escala/algoritmo.ts`, testes em `tests/camada2-regras/algoritmo-sugestao-h3.test.ts`.
- Ecrã: `src/pages/EscalaPage.tsx`, `src/lib/gerarRelatorioSemanal.ts` (`HORARIO_TURNO`).

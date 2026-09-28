# Início

**Estado:** levantado do código a 2026-09-26. A página é a primeira que qualquer utilizador vê ao entrar (`/inicio`; a raiz do site redireciona para aqui).
**Ler quando:** explicar ou mudar o que o utilizador vê ao entrar (saldo de férias, turno atual, próxima semana) ou o cockpit do Gerente (ausências, plantão de feriados, férias da equipa). Substitutos e plantão têm o procedimento completo em `docs/ferias-e-plantoes.md`.

## 1. Interface

Título **"Bem-vindo, NOME"** e, por baixo, três cartões. O conteúdo dos dois primeiros muda consoante o utilizador seja Gerente ou delegado (**vista do Gerente**) ou não (**vista pessoal**).

### 1.1 Vista pessoal (qualquer utilizador)

| Cartão | O que mostra |
| --- | --- |
| **Férias** | O total de dias úteis pedidos este ano, "N de 22 dias", uma barra de progresso e "X aprovados · Y por aprovar". A barra é **verde** abaixo de 75% do saldo (menos de 16,5 dias), **âmbar** a partir de 75% e **vermelha** com 22 ou mais |
| **Turno atual** | O turno (H1, H2, H3 ou H4) e o horário, com a data de hoje; ou "Férias" se hoje está dentro de férias aprovadas; ou "Fim de semana" ao sábado e domingo para quem não é H3; ou "—" se não há linha de escala |
| **Próxima semana** | O turno da semana seguinte, com o horário, e o intervalo "DD/MM/AAAA a DD/MM/AAAA" (de sexta a quinta) |

### 1.2 Vista do Gerente e do delegado

- O primeiro cartão passa a **"Férias aprovadas (equipa)"** e o segundo a **"Férias por aprovar (equipa)"**: uma lista de cada pessoa **ativa** (o Gerente não entra), com os dias úteis de cada uma, por ordem decrescente de dias e depois de nome. Os "por aprovar" a âmbar quando diferentes de zero.
- Clicar num nome abre um diálogo com **título** só o **NOME** e, por baixo, a **descrição** "Férias aprovadas em AAAA" (ou "Férias por aprovar em AAAA"), em duas linhas distintas, sem travessão; dentro, cada período ("DD/MM/AAAA a DD/MM/AAAA" e "Nd") e o **Total**, que passa a vermelho acima de 22 dias.
- O terceiro cartão, **Próxima semana**, mantém-se (com o turno do próprio utilizador).
- Por baixo, **"Visão do Gerente"**, com dois cartões: **Plantão de feriados** e **Ausências da equipa** (`docs/ferias-e-plantoes.md`, secções 4 e 5).

## 2. Regras

- **INI-01** O saldo de férias de cada pessoa conta **só** pedidos do tipo férias (`FERIAS`, não `LICENCA`), **aprovados e pendentes**, cuja **data de início é do ano corrente**, em **dias úteis** (segunda a sexta, sem descontar feriados). É a mesma conta do limite da base (COL-04).
- **INI-02** O **turno atual** é o da linha de escala que cobre a **data civil de hoje** (o intervalo de sábado a sexta). **Não aplica a regra das 22h de sexta** (SEM-14): na sexta à noite, depois das 22h00, ainda mostra a semana anterior.
- **INI-03** Ao **sábado e domingo**, quem não é H3 vê "Fim de semana" em vez do turno (ao fim de semana só o H3 trabalha). Nos feriados o cartão não muda (o plantão vê-se na Escala do Mês).
- **INI-04** A **próxima semana** usa a "sexta administrativa" (hoje, se for sexta, senão a sexta seguinte): o cartão descreve de sexta a quinta e mostra o turno da linha do **sábado imediatamente a seguir** a essa sexta (`docs/calendario-h3.md`, SEM-05 e SEM-13). Como a janela do rótulo (sexta a quinta) e a da escala (sábado a sexta) não coincidem, no dia da sexta o cartão anuncia já a semana que começa nessa noite.
- **INI-05** As listas do Gerente mostram **só equipa ativa** e excluem o próprio **Gerente**: "as férias do próprio Gerente são geridas fora desta app". Quem já saiu da equipa deixa de aparecer, mesmo com férias aprovadas.
- **INI-06** As ausências de "Hoje" são as **aprovadas** que cobrem hoje; as de "Próxima semana" tocam o intervalo de sexta a quinta seguinte e não repetem as de "Hoje".
- **INI-07** O plantão de feriados lista só feriados **do ano corrente, de hoje em diante e em dia útil**.

Todos os números atualizam-se em tempo real (subscrição das tabelas de férias, semanas de substituto, plantões e escala da própria pessoa).

## 3. Limites conhecidos

- O turno "atual" e a "próxima semana" só consideram a linha de escala **da própria pessoa**: um operador sem linha vê "—".
- O cartão "Férias" não mostra licenças nem períodos de anos anteriores.

## 4. Código e testes

- `src/pages/InicioPage.tsx`, `src/data/useResumoUsuario.ts` (vista pessoal), `src/data/useResumoGerente.ts` (vista do Gerente), `src/lib/gerarRelatorioSemanal.ts` (`HORARIO_TURNO`), `src/lib/datas.ts`.
- Testes: `tests/camada2-regras/datas.test.ts`; nenhum teste automático cobre a página em si.

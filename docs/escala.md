# Escala do Mês

**Estado:** levantado do código e da base a 2026-09-26. As convenções de fim de semana e de feriado (só o H3 trabalha) vêm de `SAS/Escala_2026.xlsx` e do Gerente.
**Ler quando:** mexer na grelha da escala, na edição de turnos, na apresentação de férias, substitutos, feriados e plantões, ou em qualquer coisa que dependa de "que turno tem esta pessoa neste dia". Os turnos e a rotação estão em `docs/turnos-e-rotacao.md`; as datas em `docs/calendario-h3.md`.

## 1. O que é

A grelha mensal de quem trabalha que turno em cada dia, com as ausências, os substitutos, os feriados e os plantões, mais os painéis de férias, trocas e delegação. É a página `/escala` ("Escala do Mês"), visível a todos os utilizadores; só o Gerente e o delegado editam.

Os dados carregam-se para o mês visível (as semanas cujo intervalo de sábado a sexta toca o mês, as férias aprovadas que o tocam, os feriados e os plantões) e **atualizam-se em tempo real** em todas as sessões abertas, sem recarregar a página (subscrição das tabelas `escala_semanal`, `ferias`, `ferias_semanas` e `plantao_voluntarios`).

## 2. Interface

### 2.1 Cabeçalho

- Setas **Mês anterior** e **Mês seguinte**, o título do mês em português ("Outubro de 2026") e o botão **Hoje**, que volta ao mês atual.
- **Ocultar fins de semana** / **Mostrar fins de semana**: esconde ou mostra as colunas de sábado e domingo (não se guarda entre visitas).
- **Sugerir automaticamente** (só Gerente e delegado): abre o painel da Sugestão automática (`docs/sugestao-automatica.md`).

### 2.2 A grelha

- **Linhas:** as pessoas **ativas**, por ordem alfabética do nome. Quem tem perfil `OPERADOR_H3` leva um distintivo **H3** com cadeado ao lado do nome. O nome fica fixo à esquerda quando se desliza para o lado.
- **Colunas:** um dia por coluna, com a abreviatura do dia da semana (Seg, Ter, Qua, Qui, Sex, Sáb, Dom) e o número. Os **feriados** têm o fundo rosa (com o nome do feriado ao passar o rato) e os **fins de semana** o fundo cinzento.
- **Células:** ver a secção 3.

### 2.3 Legenda (rodapé)

H1, H2, **H3 (restrito a NOME/NOME/...)**, H4, Folga / Férias, Substituição confirmada, Feriado, Plantão. A lista de nomes do H3 é a dos `OPERADOR_H3` **ativos** (primeiros nomes), por isso muda sozinha quando alguém entra ou sai. O Gerente e o delegado veem ainda "Clica numa célula para editar a semana".

### 2.4 Painéis à direita

Por esta ordem: **Férias** (todos), **Trocas de H3** (`OPERADOR_H3`, Gerente e delegado) e **Delegação de Aprovação** (só o Gerente titular). Descritos em `docs/ferias-e-plantoes.md` e `docs/trocas-e-delegacao.md`.

### 2.5 Editar o turno de uma semana (Gerente e delegado)

Clicar numa célula **editável** abre o diálogo **Editar turno**: "NOME — semana de DD/MM/AAAA a DD/MM/AAAA. A alteração aplica-se à semana inteira, não só ao dia selecionado.", um seletor de **Turno** (H1 — 07h00 às 16h00, H2 — 14h00 às 23h00, H3 — 22h00 às 07h00, H4 — 09h00 às 18h00) e os botões **Cancelar** e **Gravar**.

- A célula só é editável se **existir** uma linha de escala para essa pessoa nessa semana; não se cria uma linha nova por aqui (para semanas vazias, usa-se a Sugestão automática). Num **feriado** só é editável a célula de quem tem H3.
- Escolher o mesmo turno e gravar fecha o diálogo sem gravar nada.
- **Gravação com verificação de concorrência:** só grava se o turno ainda for o que era quando o diálogo abriu. Se outra pessoa o mudou entretanto, mostra "Este turno foi alterado por outra sessão entretanto. Fecha e reabre a célula para ver o valor atual.".
- As regras da base aplicam-se sempre (`docs/turnos-e-rotacao.md`, TUR-04 a TUR-07): por exemplo, passar alguém para H3 falha com "Só utilizadores com perfil OPERADOR_H3 (ativos) podem ser escalados para H3." ou "Já existe um H3 registado para a semana de …. Máximo 1 H3 por semana."; a mensagem aparece no diálogo.

## 3. O que cada célula mostra

Para cada pessoa e cada dia, por esta ordem de decisão:

1. **Férias ou licença aprovadas a cobrir o dia, num dia útil que não seja feriado** → **Férias** (etiqueta cinzenta tracejada); se existir substituto confirmado para essa semana civil e ele estiver ativo, mostra "seta + NOME" em violeta ("Férias — substituído por NOME").
2. **Feriado, e o valor não é H3** → **Plantão** (rosa, com sol) se essa pessoa é a plantonista confirmada, senão **Feriado** (rosa tracejado).
3. **Sem turno para esse dia:** ao **fim de semana** mostra **Folga**; num **dia útil** fica **em branco** (falta de dados, deixada visível de propósito como anomalia).
4. Caso contrário, o **turno** (H1 azul-claro, H2 âmbar, H3 índigo com cadeado, H4 verde).

O turno de um dia é o da linha de escala que o cobre, isto é, a linha com `semana_ref ≤ dia ≤ semana_ref + 6` (uma semana de sábado a sexta). Ao **fim de semana**, quem não é H3 não tem turno (célula vazia, "Folga"). Ver `docs/calendario-h3.md` para as conversões.

- **ESC-01** A grelha mostra **só pessoas ativas**; quem saiu da equipa desaparece da lista, e o histórico consulta-se em Histórico.
- **ESC-02** Fins de semana e feriados dentro de um período de férias **não** se marcam como férias; seguem as regras normais de fim de semana e de feriado.
- **ESC-03** Ao fim de semana **só o H3 está escalado**; nos feriados o H3 trabalha na mesma (ao fim de semana cobre o dia inteiro; num dia útil, até às 07h00, rendido depois por um plantonista até ao fim da cadeia diária) e os outros turnos ficam "Feriado", ou "Plantão" quem foi escolhido.
- **ESC-04** O substituto de uma ausência decide-se por **semana civil** (segunda a sexta): o nome mostrado na célula é o da decisão dessa semana. Um substituto que já saiu da equipa deixa de aparecer.
- **ESC-05** Só o **Gerente e o delegado** editam a escala, e só linhas que já existem (RLS `escala_write_gerente`; qualquer utilizador autenticado pode **ler**).
- **ESC-06** A edição muda a **semana inteira**: cada pessoa tem um só turno por semana (TUR-02).

## 4. Limites e lacunas conhecidos

- A grelha mostra a semana pela **data civil**: na sexta à noite, depois das 22h00, ainda mostra a linha da semana anterior (SEM-14).
- Não se pode criar nem apagar linhas de escala pela grelha; só editar o turno de uma linha existente.
- Num feriado que cai ao fim de semana, quem não é H3 vê "Feriado" (ou "Plantão") em vez de "Folga".
- Se a leitura dos dados falhar, a grelha aparece vazia, sem mensagem de erro.

## 5. Código e testes

- Ecrã: `src/pages/EscalaPage.tsx` (grelha, células, diálogo de edição), `src/data/useEscalaMes.ts` (carregamento e tempo real), `src/data/useUsuarios.ts`.
- Base: `escala_semanal`, `ferias`, `ferias_semanas`, `feriados_portugal`, `plantao_voluntarios`; triggers `trg_valida_turno_h3`, `trg_valida_um_h3_por_semana`, `trg_valida_limite_h3_mensal`, `trg_valida_escala_sobre_ferias`.
- Testes: `supabase/tests/02_trigger_turno_h3.sql`, `07_rls_permissoes.sql`, `13_trigger_escala_ferias_parcial.sql`; `tests/camada3-e2e/permissoes-perfil.spec.ts`.

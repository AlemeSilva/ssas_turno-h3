# Alarmes, avisos e acionamentos

**Estado:** os padrões (reativo e preditivo) e as janelas (20h, 15h, 22h) foram fechados no levantamento de requisitos; a hora-limite com dia é decisão do Gerente de 2026-09-26; "H3 por atribuir" foi decidido pelo Gerente a 2026-09-25 ("tem de avisar"). Levantado do código a 2026-09-26. **Cada alarme segue obrigatoriamente os critérios definidos** (instrução do Gerente, 2026-09-25).
**Ler quando:** criar, alterar ou validar **qualquer** alarme, aviso ou etiqueta de alerta; explicar por que apareceu ou não apareceu um aviso. **Antes de mexer num alarme:** confirmar o critério com o Gerente, escrevê-lo aqui, e testar com as linhas reais da produção, não só com dados inventados (foi o que faltou ao aviso "H3 por atribuir", que acusou uma semana sem H3 por causa de uma linha solta que só os dados reais tinham).

## 1. Onde aparecem

- **Barra de alertas** (faixa no topo de todas as páginas): "Próximo alerta" e as etiquetas dos avisos. Reavalia-se **de 30 em 30 segundos** — mas só recalcula os alarmes sobre os dados já carregados: `AlertBar.tsx` lê `tarefas_plano`/`planos` **uma só vez**, num `useEffect` sem canal realtime nem intervalo próprio, ao abrir a página; uma tarefa concluída ou criada noutra sessão só entra em conta depois de recarregar (F5).
- **Checklist Ativo, cartão "Alertas ativos"**: os alarmes em curso, com o botão **"Registar acionamento ao Gerente"** (`docs/checklist.md`). Só se redesenha quando o ecrã muda (não tem relógio próprio).

**Os alertas são só visuais.** Não há som nem notificações fora da aplicação (verificado a 2026-09-26: nada no código emite som).

## 2. Os dois padrões

- **ALA-01** Reativo (HR. LIMITE, checagens das 20h e das 15h): todos disparam **na hora de referência**. As checagens das 20h e das 15h ficam depois **em alerta** durante 30 minutos de tolerância antes de ficarem elegíveis para **escalonamento**; HR. LIMITE não tem essa fase intermédia — fica logo elegível para escalonamento no instante exato em que dispara, sem tolerância nenhuma.
- **ALA-02** Preditivo (GIR_FL): o aviso dispara **30 minutos antes** da hora de referência, para dar tempo de agir, e **escalona à própria hora**.

O painel "Alertas ativos" mostra um alarme desde que o seu estado seja diferente de "futuro" (isto é, desde a hora de disparo até ao fim do dia); não distingue visualmente "em alerta" de "escalonar".

## 3. Catálogo

| ID | Alarme | Critério | Quem vê | Código |
| --- | --- | --- | --- | --- |
| **ALA-03** | **HR. LIMITE ultrapassada** (tarefa atrasada) | Reativo. O **momento-limite** é o **dia previsto de fim** da tarefa (`dt_previsao`) ou, se estiver vazio, o **dia marcado** (`data_execucao`), mais a **hora-limite** (`hr_limite`). Alarma a partir desse momento **enquanto a tarefa não estiver concluída** (uma tarefa por concluir de ontem continua atrasada). Só tarefas com hora-limite definida | Etiqueta "N tarefa(s) excecional(is) atrasada(s)" na barra (só tarefas excecionais do ciclo em curso, para **todos**); e no cartão "Alertas ativos" do Checklist (qualquer tarefa do plano) | `estaHrLimiteEstourado` |
| **ALA-04** | **Risco GIR_FL** (colisão às 22h) | Preditivo. **Só ao sábado**, e só se alguma das cadeias marcadas como dependência (Definições) da secção *Batch Sábado → Domingo* **ainda não estiver concluída**. Avisa desde as 21h30 e escalona às 22h00. Texto: "Risco de colisão às 22h — blocos remanescentes de Sábado ainda não concluídos." | Quem abre o Checklist | `avaliarRiscoGirFl` |
| **ALA-05** | **Checagem das 20h** | Reativo. **Sábado e domingo**, a partir das 20h00. Texto: "Janela crítica das 20h (Sáb/Dom) em curso." | Quem abre o Checklist | `PainelAlertas` |
| **ALA-06** | **Checagem das 15h** | Reativo. **Só no sábado de fim de semana de manutenção**, a partir das 15h00. Texto: "Janela crítica das 15h (Sábado de manutenção) em curso." Um fim de semana normal nunca a mostra | Quem abre o Checklist | `PainelAlertas` |
| **ALA-07** | **H3 por atribuir** | Semanas H3 (de sábado) **a partir da semana em curso** que **têm escala mas nenhum H3 ativo**. Uma só etiqueta cobre todas essas semanas juntas; fica **vermelha** se **pelo menos uma** delas for a semana em curso ou ativar (22h de sexta) nos próximos 7 dias, **âmbar** se nenhuma for. **Linhas fora de sábado são ignoradas**. Semanas que ainda não foram geradas não contam | Gerente e delegado | `avaliarSemanasSemH3` |
| **ALA-08** | **Preenchimento automático da escala e dos feriados** | Olha só para a **ação mais recente** de cada tipo: **vermelho** se é `FALHOU` ou `ERRO`, **âmbar** (só escala) se é `AVISO`; desaparece na próxima execução com sucesso. `IGNORADO` **não avisa** | Gerente e delegado | `avaliarSaudeAutomacaoAnual`, `avaliarAvisoAutomacaoAnual` |
| **ALA-09** | **Headcount mensal por fechar** | **Âmbar**: o mês anterior por fechar, **a partir do dia 5**. **Vermelho**: há um mês mais antigo por fechar. O mês em curso nunca conta | Gerente e delegado | `avaliarAlertaHeadcountMensal` |
| **ALA-10** | **Próximo alerta** (barra) | O mais próximo de: **20h** (sábado e domingo), **15h** (só sábado de manutenção), **22h** (só sábado, a janela GIR_FL). Mostra "Próximo alerta: ROTULO às HH:MM · em N min"; sem nenhum, "Sem alertas agendados". Só conta horas **ainda por chegar** hoje | Todos | `calcularProximoAlerta` |

## 4. Detalhes de cada alarme

### 4.1 HR. LIMITE (ALA-03)

- O **dia** do limite conta: um limite às 14h00 de sábado **não** dispara na quinta às 15h00 (antes comparava-se só a hora do relógio). Um limite às 02h00 de domingo, com `dt_previsao` no domingo, não dispara no sábado à tarde.
- **Limite depois da meia-noite:** só se exprime com `dt_previsao` no dia seguinte. **O ecrã de tarefas excecionais só pede a hora-limite** (não pede o dia previsto), por isso, pelo ecrã, o limite conta sempre no dia da execução (`docs/plano-de-fim-de-semana.md`, PLA-09).
- A hora-limite vem da base com segundos (`14:00:00`) e conta como `14:00`.
- Hoje nenhuma tarefa tem hora-limite preenchida (verificado a 2026-09-26: 55 tarefas, nenhuma com HR. LIMITE), por isso o alarme não dispara na prática.
- Regista-se o **acionamento** com `ESCALONAMENTO_HR_LIMITE`.
- Os dados de tarefas e planos usados neste alarme (lidos por `AlertBar.tsx`) só são lidos uma vez, ao abrir a página; o tick de 30 segundos da barra de alertas recalcula os alarmes sobre essa lista já carregada, sem voltar a ler a base (secção 1).

### 4.2 GIR_FL (ALA-04)

- Só ao **sábado** (dia 6 da semana ISO). Depois da meia-noite já não se aplica.
- Precisa de pelo menos **uma cadeia dependente por concluir** (o código testa por prefixo: qualquer estado que não comece por `CONCLUIDO_` — hoje são `CONCLUIDO_AUTOMATICO` e `CONCLUIDO_MANUAL`). Sem cadeias marcadas como dependência, nunca dispara.
- Acionamento: `ESCALONAMENTO_GIR_FL`.

### 4.3 Checagens das 20h e das 15h (ALA-05, ALA-06)

- 20h: sábado e domingo. 15h: só sábado de **manutenção** (o último sábado do mês, SEM-09). O tipo de fim de semana vem do plano do ciclo em curso.
- Acionamentos: `ESCALONAMENTO_CHECAGEM_20H` e `ESCALONAMENTO_CHECAGEM_15H`.

### 4.4 H3 por atribuir (ALA-07)

- Etiqueta "H3 por atribuir: N semana(s)". O balão lista até 5 semanas ("Sem nenhum operador H3 ativo em: DD/MM/AAAA a DD/MM/AAAA · …, e mais N — atribui um H3 na Escala do Mês (ou usa "Sugerir automaticamente").") — **uma etiqueta e um balão só, para todas as semanas em falta juntas**; não há uma cor por semana. A cor (vermelha ou âmbar) é decidida por essa lista inteira: basta uma semana urgente para a etiqueta inteira ficar vermelha, mesmo que as outras não sejam urgentes.
- **Semana em curso** = a do último sábado, exceto a partir das 22h00 de sexta, em que já é a do sábado seguinte (SEM-03).
- **Só conta H3 de utilizadores `OPERADOR_H3` ativos.** Acontece quando um H3 sai da equipa: desativar apaga-lhe a escala de hoje em diante, e a semana em curso mantém a linha dele, que já não conta.
- Recarrega quando a escala muda e de 5 em 5 minutos (a lista de utilizadores não está em tempo real). Uma falha de rede **não** apaga um aviso que estava certo.

### 4.5 Automação anual (ALA-08)

Ver `docs/preenchimento-anual-de-novembro.md`, secção 7.

- `useSaudeAutomacaoAnual` lê `logs_auditoria` **uma só vez**, ao carregar a aplicação, sem canal realtime nem intervalo próprio: os avisos de falha ou de aviso da automação anual não se atualizam sozinhos depois disso (mesmo padrão da barra de alertas, secção 1).

### 4.6 Headcount mensal (ALA-09)

- O volume de pedidos de um mês só se conhece depois de ele acabar; por isso o Gerente tem até ao **dia 5 do mês seguinte** para preencher e fechar.
- **Só existe alerta se o rascunho do mês existir**: os rascunhos são criados quando o Gerente **abre a página Headcount** (função `garantir_rascunho_headcount_mensal`). Se ninguém abrir a página depois de o mês acabar, não há linha aberta e o alerta não aparece.
- O alerta lê os meses abertos uma vez ao carregar a aplicação.

### 4.7 Acionamento ao Gerente (todos os do Checklist)

- O botão **"Registar acionamento ao Gerente"** grava uma linha em `logs_auditoria` (ação `ESCALONAMENTO_*`, a pessoa que clicou, a descrição). Fica "Acionamento registado" e desativado, mas **só no ecrã aberto**: ao recarregar volta a "Registar". Um botão por alarme; uma pausa de 500 ms evita duplo clique.
- **Não envia nada a ninguém**: é só o registo de que se acionou o escalonamento.

## 5. Regras para criar ou alterar um alarme

- **ALA-11** Antes de criar ou alterar um alarme: **confirmar o critério com o Gerente** e escrevê-lo neste ficheiro.
- **ALA-12** Testar sempre com as **linhas reais** da produção (só leitura), não só com dados inventados.
- **ALA-13** Um alarme sobre semanas usa as âncoras certas (`docs/calendario-h3.md`) e só equipa **ativa** (USR-01).
- **ALA-14** A lógica do alarme vive em `src/lib/alertas.ts`, **pura** (sem ecrã nem base) e com testes; o ecrã só chama.

## 6. Limites conhecidos

- O painel "Alertas ativos" do Checklist não tem relógio próprio (secção 1).
- O alerta de headcount depende de a página Headcount ter sido aberta (4.6).
- `IGNORADO` da automação anual não gera aviso (ALA-08).
- Não há alertas por email nem por qualquer outro canal fora da aplicação.

## 7. Código e testes

- `src/lib/alertas.ts` (toda a lógica), `src/layout/AlertBar.tsx`, `src/components/checklist/PainelAlertas.tsx`, `src/data/useSaudeAutomacaoAnual.ts`, `useAlertaSemanasSemH3.ts`, `useAlertaHeadcountMensal.ts`.
- Testes: `tests/camada2-regras/alertas.test.ts` (padrões, HR. LIMITE com dia e hora, GIR_FL, próximo alerta, automação anual, headcount, "H3 por atribuir" com as linhas reais de 2026-09-25); `tests/camada3-e2e/alerta-sonoro-visual.spec.ts` e `alertas-condicionais.spec.ts` (precisam de uma base de teste; o nome "sonoro" é histórico: não há som).

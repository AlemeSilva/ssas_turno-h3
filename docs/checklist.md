# Checklist Ativo (itens, cadeias e tarefas excecionais)

**Estado:** levantado do código e da base a 2026-09-26. Os itens modelo refletem `SAS/CheckList.xlsx`; a imutabilidade e o "destravar" vêm das migrações 0001, 0031 e 0032.
**Ler quando:** marcar ou corrigir itens, cadeias ou tarefas durante o fim de semana; mexer nos itens modelo, nos estados das cadeias ou na imutabilidade. Os alarmes que aparecem neste ecrã estão em `docs/alarmes.md`; o catálogo de cadeias em `docs/definicoes.md`.

## 1. O que é

O ecrã onde o operador do ciclo acompanha, em tempo real, a execução do plano do fim de semana: itens a carimbar, cadeias a acompanhar dia a dia e tarefas excecionais. Trabalha sobre o **mesmo ciclo do Plano** (quinta a segunda; à terça e à quarta mostra o ciclo seguinte). Sem plano criado, mostra "Ainda não existe plano criado para o ciclo com início em DD/MM/AAAA. Cria o plano primeiro no separador 'Plano de Fim de Semana'.".

As alterações aparecem em tempo real em todas as sessões abertas (subscrição Realtime das tabelas `checklist_itens` e `cadeias_diarias`).

## 2. Interface, de cima para baixo

1. **Alertas ativos** (cartão com borda vermelha): só aparece quando há um alarme em curso (HR. LIMITE ultrapassada, risco GIR_FL, checagem das 20h ou das 15h). Cada linha tem o botão **"Registar acionamento ao Gerente"**, que fica "Acionamento registado" e desativado depois de clicado. Ver `docs/alarmes.md`.
2. **Resumo de pendências do ciclo** (cartão âmbar): **só à segunda-feira**, e só se houver algo por marcar: "N item(ns) de checklist e M cadeia(s) ficaram por marcar neste ciclo." (cadeias por marcar = as que ainda estão em `PENDENTE`).
3. **Tarefas excecionais** (só se o plano tiver alguma): uma linha por tarefa com a data, hora de arranque, descrição, equipa e "HR. LIMITE: hh:mm" se houver.
4. **Cinco secções**, por esta ordem, cada uma num cartão: *Preparação*, *Reunião de Planeamento*, *Batch Sexta → Sábado*, *Batch Sábado → Domingo*, *Batch Domingo → Segunda*. Cada secção mostra os seus **itens** e, nas três de batch, o bloco **"Acompanhamento das cadeias"** numa grelha de três colunas, por ordem alfabética.

### 2.1 Um item de checklist

- Por concluir: descrição e botão **Marcar concluído**. Um clique abre a confirmação (**Confirmar** / **Cancelar**): "Regista este item como concluído, com o teu nome e a hora atual, fica trancado depois".
- Concluído: etiqueta com cadeado **Concluído** e a linha "Carimbado por NOME em DD/MM/AAAA, hh:mm:ss".
- Ao Gerente e ao delegado aparece ainda **Destravar** (secção 3, CHK-02).

### 2.2 Uma tarefa excecional

Igual ao item, com **Marcar concluída** e "Concluída por NOME em …". A etiqueta é **Concluída**.

### 2.3 Uma cadeia

Uma linha com o nome (com ` *` ou ` **` no fim conforme a categoria), o estado como etiqueta clicável e o botão **Marcar atraso**.

- Clicar na etiqueta do estado **avança** para o estado seguinte (o balão diz para qual).
- **Marcar atraso** passa logo a `ATRASADO`, sem passar pelos estados intermédios. Desaparece quando a cadeia já está atrasada.
- Ao marcar atraso numa cadeia com asterisco, aparece uma caixa âmbar com a instrução, e o botão **Ok** fecha-a:
  - categoria `*` (**ASTERISCO**): "Sempre ao concluir com sucesso, esta cadeia tem um processo de cópia automática via crontab. Em caso de atraso: correr o script manualmente, validar os ficheiros no FTRANS da Cloud e executar a respetiva pipeline no Synapse.";
  - categoria `**` (**DUPLO_ASTERISCO**): "Sempre ao concluir com sucesso, esta cadeia gera dados de input automático para as soluções AML/MAB na Cloud (via crontab). Em caso de atraso, ou ao fim de semana: correr os scripts manualmente.".
  - Cadeias `NORMAL` não mostram instrução.

## 3. Regras

- **CHK-01** **Itens modelo** (`gerarChecklistTemplate`): *Preparação*: "Verificar espaço em disco" e "Encerrar no RTM as sessões ativas há mais de 5 dias"; *Reunião*: "Definir o planeamento do batch do fim de semana"; *Batch Sexta → Sábado* e *Batch Sábado → Domingo*: "Validar ficheiros das cadeias em destaque no /data/prd/ftrans"; *Batch Domingo → Segunda*: "Garantir o fluxo normal das cadeias diárias". Num plano de **manutenção** entra ainda, em *Batch Sábado → Domingo*, "Realizada manutenção mensal do ambiente SAS (OnPremise + Cloud)".
- **CHK-02** Um **item concluído é imutável**: depois de carimbado, nem o estado, nem quem o concluiu, nem a hora se alteram ("Item de checklist concluído é imutável. Use a função destravar_checklist_item para correções, com justificativa."). O mesmo vale para uma **tarefa concluída** ("Tarefa concluída é imutável. Use a função destravar_tarefa_plano para correções, com justificativa."). A **única** via de correção é **Destravar**: só o Gerente ou delegado, com uma **justificativa obrigatória**; volta a "por concluir", fica registado quem destravou, quando e porquê (`destravado_por`, `destravado_em`, `destravado_motivo`) e uma linha de auditoria (`OVERRIDE_CHECKLIST` ou `OVERRIDE_TAREFA`). O ecrã só deixa confirmar com a justificativa preenchida ("Justificativa do destravar (obrigatória)"). Triggers `trg_checklist_imutavel` e `trg_tarefas_plano_imutavel`; funções `destravar_checklist_item` e `destravar_tarefa_plano`.
- **CHK-03** **Estados de uma cadeia:** `PENDENTE`, `EM_ANDAMENTO`, `CONCLUIDO_AUTOMATICO`, `CONCLUIDO_MANUAL`, `ATRASADO`. O clique na etiqueta segue: `PENDENTE` → `EM_ANDAMENTO` → `CONCLUIDO_AUTOMATICO` → `PENDENTE`; `CONCLUIDO_MANUAL` → `PENDENTE`; `ATRASADO` → `CONCLUIDO_MANUAL`. Os estados de conclusão gravam quem e quando; os outros limpam esses dois campos. Ao contrário dos itens, **as cadeias não ficam imutáveis** ao concluir.
- **CHK-04** Cada cadeia aparece **uma só vez por secção e por plano** (`cadeias_diarias` é única por plano, secção e nome).
- **CHK-05** **As cadeias e as suas datas** geram-se ao criar o plano, uma por cadeia ativa do catálogo, só nas três secções de batch: *Sexta → Sábado* tem a data do **sábado** (quinta + 2), *Sábado → Domingo* a do **domingo** (+3), *Domingo → Segunda* a da **segunda** (+4). *Preparação* e *Reunião* não têm cadeias.
- **CHK-06** Só o **Gerente, o delegado e o operador do ciclo** gravam no checklist e nas cadeias (política RLS `pode_editar_plano`); os outros veem o ecrã com os mesmos botões, mas a gravação é recusada pela base. Só o Gerente ou delegado pode apagar itens.
- **CHK-07** As cadeias que atrasam o alerta GIR_FL vêm da configuração em Definições (`gir_fl_dependencias`); ver `docs/alarmes.md`, ALA-04.

## 4. Limites e lacunas conhecidos

- O painel **Alertas ativos** calcula a hora quando o ecrã se redesenha (abrir a página, ou chegar uma alteração em tempo real); não tem relógio próprio, ao contrário da barra de alertas do topo (que reavalia de 30 em 30 segundos). Por isso um alerta pode aparecer com atraso, até ao próximo redesenho.
- Não há ecrã para acrescentar itens ao checklist: os itens vêm só do modelo.
- Quem não pode gravar (operador que não é o do ciclo) vê os botões e não recebe mensagem de erro quando a gravação é recusada.

## 5. Código e testes

- Ecrã: `src/pages/ChecklistPage.tsx`, `src/components/checklist/` (`ItemChecklistLinha`, `CadeiaLinha`, `TarefaExcecionalLinha`, `PainelAlertas`), `src/data/useChecklistCiclo.ts`, `src/data/useCadeiasCatalogo.ts`, `src/lib/cadeiasInfo.ts`, `src/lib/templateChecklist.ts`.
- Base: tabelas `checklist_itens`, `cadeias_diarias`, `cadeias_catalogo`, `gir_fl_dependencias`; triggers `trg_checklist_imutavel`, `trg_tarefas_plano_imutavel`; funções `destravar_checklist_item`, `destravar_tarefa_plano`.
- Testes: `supabase/tests/05_checklist_imutavel.sql`, `08_gestao_cadeias.sql`, `11_tarefas_excecionais_conclusao.sql`; `tests/camada3-e2e/checklist-imutabilidade.spec.ts`, `gestao-cadeias.spec.ts`, `alertas-condicionais.spec.ts`.

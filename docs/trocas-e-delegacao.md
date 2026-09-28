# Trocas de H3 e delegação de aprovação

**Estado:** levantado do código e da base a 2026-09-26. Decisões do Gerente: trocas só em sábados (2026-09-26, migração 0061); troca exige proponente ativo (0054); delegação aditiva e sem sobreposição (0001, 0043, 0056). Aqui descrevem-se o ecrã e o procedimento; as regras entre colegas estão em `docs/regras-entre-colegas.md` (IDs `COL-`).
**Ler quando:** propor, aprovar ou rejeitar uma troca de H3; criar uma delegação; perceber quem tem poderes de Gerente e quando.

## 1. Trocas de H3

### 1.1 O que é

Uma troca passa o **H3 de uma semana** de um `OPERADOR_H3` (o **proponente**) para outro `OPERADOR_H3` (o **substituto**). Não há passo de aceitação do colega: o proponente propõe e o Gerente ou delegado decide. **O proponente e quem decide nunca podem ser a mesma pessoa:** `trg_valida_troca` recusa a decisão quando `auth.uid() = usuario_proponente`, mesmo para um delegado que seja também `OPERADOR_H3` a decidir a sua própria proposta (migração 0062 — ver COL-12 em `docs/regras-entre-colegas.md`).

### 1.2 Interface (painel "Trocas de H3", Escala do Mês)

O painel aparece a quem tem perfil `OPERADOR_H3` e ao Gerente e delegado.

**Formulário (só para quem tem perfil `OPERADOR_H3`):**

- **Semana H3 (o sábado em que começa)**: um seletor de data obrigatório. Ao escolher um sábado mostra por baixo o intervalo ("Sábado 17/10/2026 a sexta 23/10/2026"). Ao escolher outro dia mostra, a vermelho, "A semana do H3 começa ao sábado — escolhe um sábado." e não deixa enviar.
- **Substituto**: lista dos `OPERADOR_H3` **ativos**, sem o próprio.
- **Propor troca** ("A enviar…"). Antes de enviar valida a data ("A semana do H3 começa ao sábado — escolhe um sábado.") e o substituto ("Escolhe um substituto."). Depois de gravar, limpa os campos. Erros da base aparecem tal como vêm.

**Lista de propostas por decidir:** "DD/MM/AAAA: NOME → NOME" (proponente → substituto), só com trocas em que **ambos** estão ativos. Sem propostas: "Sem trocas propostas.".

- Para o Gerente e o delegado: **Aprovar** (balão: "Confirma a troca — o substituto passa a cobrir esta semana no lugar do proponente") e **Rejeitar** ("Recusa a troca — a escala original mantém-se sem alterações"), com pausa de 500 ms por troca. Um erro ao decidir aparece por baixo da linha.
- Para os outros: a etiqueta **PROPOSTA**.

As trocas já decididas **saem da lista**; o ecrã não mostra o histórico de trocas.

### 1.3 Regras

- **COL-09 a COL-13**, em `docs/regras-entre-colegas.md`. Em resumo: só um `OPERADOR_H3` ativo propõe, em seu nome; proponente e substituto têm de estar ativos e o substituto ser `OPERADOR_H3`; a semana é um **sábado**; só o Gerente ou delegado decide, e nunca o próprio proponente (COL-12) — ver 1.1; a aprovação passa o H3 dessa semana ao substituto e, se ele tinha outro turno nessa semana, o proponente fica com esse turno.
- **TRO-01** A troca age **na data exata** do `semana_ref`. Foi por isso que uma "quinta de referência" nunca alterava uma semana real e deixava uma linha solta na escala (o caso da troca de 15/10/2026, corrigido a 2026-09-26). A base agora só aceita sábados.
- **TRO-02** Uma troca **aprovada não tem "anular"** no ecrã: para repor, propõe-se e aprova-se outra troca em sentido contrário (ou corrige-se a célula na Escala do Mês).
- **TRO-03** `data_aprovacao` e `aprovado_por` de uma troca são gravados pelo **browser** de quem decide (não são forçados pela base, ao contrário do plano).
- **TRO-04** Quando um utilizador é desativado, as suas propostas **por decidir** de hoje em diante apagam-se; as já aprovadas ou rejeitadas ficam (USR-08).
- **TRO-05** A aprovação passa por todos os triggers da escala: se o substituto já atingiu o limite mensal, ou a semana já tem outro H3 que não é o proponente, ou o substituto tem férias aprovadas nos 7 dias, a aprovação **falha** com a mensagem da base e a proposta continua por decidir.

### 1.4 Efeito de uma aprovação (exemplo)

Semana de sábado 2026-10-17, com A em H3 e B em H2. O proponente é A, o substituto é B.

| | Antes | Depois |
| --- | --- | --- |
| A | H3 | H2 (o turno que B tinha) |
| B | H2 | H3 |

Se B **não tivesse linha** nessa semana, A perdia o H3 e B ficava com H3 (A ficava sem linha, à espera de nova atribuição).

## 2. Delegação de aprovação

### 2.1 O que é

O Gerente titular pode dar a outra pessoa **ativa**, por um período, o poder de aprovação de Gerente (`is_gerente_ou_delegado()`): aprovar férias e trocas, escolher substitutos, editar a escala, gerir utilizadores `OPERADOR` e `OPERADOR_H3`, etc. É **aditiva**: o titular mantém sempre o seu próprio poder.

### 2.2 Interface (painel "Delegação de Aprovação")

Só o **Gerente titular** vê o painel (os restantes não vêem nada).

- Texto: "Aditiva — mantém sempre o teu próprio poder de aprovar durante a janela."
- **Substituto** (lista das pessoas ativas, sem o titular), **De** e **Até** (datas obrigatórias) e o botão **Criar delegação** ("Dá à pessoa escolhida poder de aprovação de Gerente durante este período"). Sem substituto escolhido: "Escolhe um substituto.".
- Lista das delegações que ainda não terminaram (`data_fim` de hoje em diante), de substitutos ativos: "NOME · DD/MM/AAAA a DD/MM/AAAA". Sem nenhuma: "Sem delegações ativas.".

### 2.3 Regras

- **COL-14 a COL-17**, em `docs/regras-entre-colegas.md`. Em resumo: só o titular cria; aditiva; sem sobreposição entre delegações de substitutos ativos; o delegado não faz o que é exclusivo do titular.
- **TRO-06** O poder do delegado vale **de `data_inicio` a `data_fim`, ambos inclusive**, e **só enquanto ele estiver ativo**. A base avalia isto em cada operação, com a data UTC de hoje.
- **TRO-07** Cada linha de auditoria escrita por um delegado, em vigor a delegação, fica marcada com o `delegacao_id` (`trg_logs_auditoria_marca_delegacao`). **Lacuna menor:** a função que calcula esse `delegacao_id` (`delegacao_ativa_id()`) nunca foi atualizada para exigir `usuarios.ativo = true` do delegado, ao contrário de `is_gerente_ou_delegado()` (corrigida nas migrações 0053/0056) — um log escrito por um ex-delegado já inativo pode continuar marcado como "em vigor".
- **TRO-08** Uma delegação **já usada** (referida em auditoria) não se apaga quando o delegado ou o titular sai da equipa; as que ainda não começaram apagam-se e as que atravessam o dia da saída são cortadas até ao dia anterior (USR-08).

### 2.4 Limites conhecidos

- **Não há ecrã para encurtar nem apagar** uma delegação. A base permite ao titular fazê-lo (encurtar nunca é bloqueado), por SQL.
- O ecrã só reconhece que alguém passou a ser delegado, ou deixou de o ser, quando a **página é recarregada** ou a sessão reiniciada; a base aplica o poder de imediato.
- A tradução da mensagem "Já existe uma delegação ativa nesse período." não dispara (o texto da base começa por maiúscula e o teste do ecrã procura minúscula); aparece a mensagem original da base, "Já existe uma delegação de aprovação ativa nesse período.", que diz o mesmo.

## 3. Código e testes

- Ecrã: `src/components/escala/PainelTrocas.tsx`, `src/components/escala/PainelDelegacao.tsx`, `src/lib/datas.ts` (`ehSabadoISO`, `descreverSemanaH3`, `MENSAGEM_SEMANA_SABADO`), `src/auth/AuthContext.tsx`.
- Base: tabelas `trocas_escala`, `delegacoes_aprovacao`; triggers `trg_valida_troca`, `trg_aplica_troca_aprovada`, `trg_valida_delegacao`, `trg_logs_auditoria_marca_delegacao`; CHECK `chk_delegacao_substituto_diferente`; funções `is_gerente_ou_delegado`, `is_gerente_titular`, `delegacao_ativa_id`.
- Testes: `supabase/tests/06_trocas_e_delegacao.sql`, `07_rls_permissoes.sql`, `20_delegacao_id_auditoria.sql`, `28_troca_semana_ao_sabado.sql`, `29_ninguem_decide_o_proprio.sql`, `30_substituto_e_delegado_nao_proprio.sql`.

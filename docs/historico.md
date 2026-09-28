# Histórico / Consulta

**Estado:** levantado do código e da base a 2026-09-26.
**Ler quando:** consultar o que aconteceu (escala, planos, cadeias, auditoria), verificar o resultado das automações de 1 de novembro, ou mudar a página de Histórico.

## 1. O que é

Uma página de **consulta** (`/historico`), só para o Gerente e o delegado ("Esta área é reservada ao Gerente." para os outros), com quatro separadores. Só lê: nunca altera nada. Cada separador tem um pequeno formulário de filtros e um botão **Pesquisar**; **os resultados só aparecem depois de pesquisar** (a tabela começa vazia, com "Sem resultados — ajusta os filtros e pesquisa.").

Nas listas de pessoas (filtros "Pessoa"), quem já saiu continua a aparecer, marcado **"(inativo)"**: o histórico dele tem de poder ser consultado, mas não pode passar por equipa ativa. As listas de ações futuras (delegar, propor troca, atribuir turno) não mostram quem saiu.

## 2. Separadores

| Separador | Filtros | Colunas | Limite |
| --- | --- | --- | --- |
| **Escala** | Pessoa, Turno (H1 a H4), De, Até (sobre `semana_ref`) | Semana, Pessoa, Turno | Sem limite escolhido pelo ecrã (vale o limite por defeito da API); da semana mais recente para a mais antiga |
| **Plano** | Início do ciclo (De, Até) e Estado | Ciclo, Tipo F. Semana, Estado, Criado em | Sem limite escolhido pelo ecrã; do ciclo mais recente para o mais antigo |
| **Cadeias** | Data (De, Até) e Nome da cadeia (texto, "ex.: GIR_FL") | Data, Cadeia, Secção, Estado | 300 linhas, da data mais recente |
| **Auditoria** | Pessoa e Tipo de ação (texto, "ex.: ESCALONAMENTO") | Data/hora, Ação, Utilizador, Descrição | 200 linhas, da mais recente |

- Os estados dos planos mostram-se em português (Rascunho, Pendente, Aprovado, Em execução, Concluído) e os das cadeias com etiquetas de cor (verde concluída, vermelho atrasada, índigo em andamento, cinzento pendente).
- **HIS-01** O filtro de **texto** da Auditoria procura em **`acao`** (não no tipo de referência nem na descrição), sem distinguir maiúsculas. Para as automações de 1 de novembro, escrever `PREENCHIMENTO` (`docs/preenchimento-anual-de-novembro.md`).
- **HIS-02** A coluna **Utilizador** mostra "—" quando a ação foi feita pela própria base (por exemplo, as automações anuais, a limpeza de dados futuros de quem sai) e não por uma pessoa.
- **HIS-03** A tabela de auditoria **não mostra o tipo de referência** (`ESCALA_ANUAL`, `USUARIO`, `PLANO`, `HEADCOUNT_MENSAL`, …): distingue-se pela ação e pela descrição.
- **HIS-04** A auditoria é um **registo que só cresce**: as ações gravam-se, não se apagam pelo ecrã. As que o browser pode gravar são uma lista fechada (secção 3).

## 3. O que fica registado em auditoria

Tabela `logs_auditoria` (referência, ação, utilizador, descrição, hora, e a delegação em vigor se quem agiu era delegado). As ações que existem hoje, por tipo de referência:

| Tipo | Ações | Quem as escreve |
| --- | --- | --- |
| `ESCALA_ANUAL` | `PREENCHIMENTO_AUTOMATICO`, `_AVISO`, `_ERRO`, `_FALHOU`, `_IGNORADO` | A base, a 1 de novembro |
| `FERIADOS_ANUAL` | `PREENCHIMENTO_AUTOMATICO`, `_ERRO`, `_IGNORADO` | A base, a 1 de novembro |
| `ESCALA_SEMANAL` | Correções manuais da escala, feitas por ação direta na base a pedido do Gerente (por exemplo `EDICAO_MANUAL_LIMITE_IGNORADO`, `CORRECAO_LINHA_FORA_DE_SABADO`) | Quem faz a correção |
| `USUARIO` | `UTILIZADOR_CRIADO`, `UTILIZADOR_DESATIVADO`, `DESATIVACAO_AUTOMATICA`, `PASSWORD_REPOSTA`, `PASSWORD_ALTERADA_PROPRIA`, `LIMPEZA_DADOS_FUTUROS`, `COMPOSICAO_ESCALA_FALHOU`, `UTILIZADOR_FANTASMA` | Funções do servidor e o trigger de desativação |
| `PLANO` | `CONCLUSAO_TAREFA`, `EDICAO_TAREFA`, `REABERTURA_APROVACAO` | Trigger das tarefas |
| `TAREFA_PLANO` / `CHECKLIST_ITEM` | `OVERRIDE_TAREFA`, `OVERRIDE_CHECKLIST` | Funções de "destravar" |
| `HEADCOUNT_MENSAL` | `FECHO_MES`, correções manuais do fecho (`CORRECAO_MANUAL_FECHO`, `CORRECAO_RETROATIVA`) | Função de fecho e correções por SQL |
| `HEADCOUNT_PARAMETROS` | `ALTERACAO_PARAMETRO` (com o antes e o depois) | Trigger dos parâmetros |
| `PLANO`, `CADEIA`, `TAREFA_PLANO` | `ESCALONAMENTO_HR_LIMITE`, `ESCALONAMENTO_GIR_FL`, `ESCALONAMENTO_CHECAGEM_20H`, `ESCALONAMENTO_CHECAGEM_15H` | O browser, quando alguém clica "Registar acionamento ao Gerente" |

- **HIS-05** O **browser só pode gravar cinco ações** em auditoria, todas em nome do próprio utilizador: `PASSWORD_ALTERADA_PROPRIA` e os quatro `ESCALONAMENTO_*` (política RLS `logs_insert_proprio`). Tudo o resto vem de funções do servidor, triggers ou ações diretas na base.
- **HIS-06** Qualquer utilizador autenticado **pode ler** a tabela (política `logs_select_all`), embora o ecrã de consulta seja só do Gerente e do delegado.

## 4. Limites conhecidos

- Não há separador para **trocas**, **férias**, **headcount** nem **utilizadores**; essa informação consulta-se nos ecrãs respetivos ou por auditoria.
- A Auditoria não pagina: mostra as 200 mais recentes; para ir mais atrás, restringir a pessoa ou o texto da ação.
- O separador **Cadeias** também não pagina: mostra as 300 linhas mais recentes (mesmo risco de truncar em silêncio que a Auditoria); para ir mais atrás, restringir a data.
- `logs_auditoria.delegacao_id` (a delegação em vigor quando a ação foi feita por um delegado) fica gravada na base mas não é lida nem mostrada em nenhum ecrã, incluindo o separador Auditoria.
- Não há exportação.

## 5. Código e testes

- `src/pages/HistoricoPage.tsx`, `src/lib/usuarios.ts` (`nomeParaLista`).
- Base: tabelas `escala_semanal`, `planos`, `cadeias_diarias`, `logs_auditoria`; política `logs_insert_proprio`; trigger `trg_logs_auditoria_marca_delegacao`.
- Testes: `tests/camada2-regras/usuarios.test.ts` (`nomeParaLista`), `supabase/tests/20_delegacao_id_auditoria.sql`.

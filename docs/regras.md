# Índice de regras e princípios basilares

**Estado:** compilado a 2026-09-27, conferido contra o texto real de todos os ficheiros (22 prefixos, todos com uma gama contínua sem buracos nem duplicados).
**Ler quando:** procurar em que ficheiro vive uma regra a partir do seu ID; verificar se um ID novo já está a ser usado; perceber os poucos princípios que atravessam toda a aplicação.

## 1. Como funciona um ID de regra

- Cada regra tem um ID **único**, `PREFIXO-NN`, `NN` com dois dígitos a começar em `01`, sequencial e **sem buracos** dentro do seu ficheiro.
- **Cada ID é definido por extenso uma só vez, no ficheiro dono** (a tabela da secção 2). Outro ficheiro pode citá-lo (`(SEM-03)`, `ver COL-01`) ou reescrevê-lo em forma de resumo curto quando a legibilidade local pede isso — mas a explicação completa fica sempre só no dono. Se procurar um ID e o texto ao lado parecer incompleto, seguir para o ficheiro dono.
- **Um ID nunca se reatribui nem se renumera.** Uma regra que deixa de existir fica assinalada como tal no próprio texto (não se reaproveita o número para outra coisa); uma regra nova recebe sempre o número seguinte ao maior já usado no seu prefixo.
- Um prefixo pertence a **um único ficheiro dono** (coluna "Ficheiro" da secção 2); não há dois ficheiros a definir o mesmo prefixo.

## 2. Índice por prefixo

| Prefixo | Gama | Ficheiro dono | Tema |
| --- | --- | --- | --- |
| `SEM` | SEM-01 – SEM-18 | `docs/calendario-h3.md` | As cinco âncoras de data/hora e como converter entre elas |
| `TUR` | TUR-01 – TUR-16 | `docs/turnos-e-rotacao.md` | Os quatro turnos, composição e rotação |
| `COL` | COL-01 – COL-24 | `docs/regras-entre-colegas.md` | Regras entre pessoas: férias, substitutos, trocas, delegação, plantão, plano/checklist |
| `NOV` | NOV-01 – NOV-16 | `docs/preenchimento-anual-de-novembro.md` | O preenchimento automático anual (1 de novembro) |
| `PLA` | PLA-01 – PLA-12 | `docs/plano-de-fim-de-semana.md` | O Plano de Fim de Semana e as suas tarefas |
| `CHK` | CHK-01 – CHK-07 | `docs/checklist.md` | O Checklist Ativo e as cadeias do fim de semana |
| `ESC` | ESC-01 – ESC-06 | `docs/escala.md` | A grelha da Escala do Mês |
| `FER` | FER-01 – FER-12 | `docs/ferias-e-plantoes.md` | Férias, licenças, substitutos, plantões |
| `TRO` | TRO-01 – TRO-08 | `docs/trocas-e-delegacao.md` | Trocas de H3 e delegação de aprovação |
| `SUG` | SUG-01 – SUG-10 | `docs/sugestao-automatica.md` | A Sugestão automática de escala |
| `INI` | INI-01 – INI-07 | `docs/inicio.md` | A página Início |
| `REL` | REL-01 – REL-08 | `docs/relatorios.md` | O relatório semanal |
| `HIS` | HIS-01 – HIS-06 | `docs/historico.md` | A página Histórico e a auditoria |
| `DEF` | DEF-01 – DEF-07 | `docs/definicoes.md` | O catálogo de cadeias |
| `USR` | USR-01 – USR-14 | `docs/utilizadores-e-saidas.md` | Perfis, saídas da equipa, palavras-passe |
| `ALA` | ALA-01 – ALA-14 | `docs/alarmes.md` | Alarmes, avisos e acionamentos |
| `INT` | INT-01 – INT-10 | `docs/interface.md` | Entrada, estrutura do ecrã, convenções comuns |
| `HDC` | HDC-01 – HDC-27 | `docs/headcount.md` | Headcount Ideal, fecho mensal, Estudo de Cenários, relatório |
| `PER` | PER-01 – PER-04 | `docs/perfis-e-permissoes.md` | Como funcionam os poderes e a RLS |
| `EDG` | EDG-01 – EDG-12 | `docs/edge-functions.md` | As Edge Functions e os agendamentos |
| `OP` | OP-01 – OP-09 | `docs/operacao.md` | Publicar, migrar, verificar |
| `TES` | TES-01 – TES-05 | `docs/testes.md` | As quatro camadas de teste |

Ficheiros sem prefixo próprio, porque são índices ou inventário (não regras): `docs/base-de-dados.md`, `docs/decisoes.md`, `docs/glossario.md`, `docs/limites-e-lacunas.md`, este ficheiro, `CLAUDE.md`, `README.md`.

## 3. Princípios nunca violados

Uma dúzia de regras que atravessam toda a aplicação — quem só ler esta secção já sabe o que **nunca** se pode fazer sem verificar antes:

- **A base de dados é a proteção real; o ecrã só esconde.** Uma regra nova de negócio nunca fica só no React. → PER-01.
- **Quem saiu da equipa (`ativo = false`) não conta como ativo em nenhuma funcionalidade** — listas, relatórios, validações, alarmes. → USR-01.
- **As cinco âncoras de data nunca se misturam**: escala/H3 (sábado), plano (quinta), relatório (sexta administrativa), férias/substitutos (semana civil, segunda), mês de uma semana H3 (o do sábado+3). → `docs/calendario-h3.md`, secção 1.
- **Um alarme só existe depois de o seu critério estar escrito num ficheiro `docs/` e confirmado com o Gerente**, e só se testa com dados reais. → ALA-11, ALA-12.
- **Nenhum período de férias ou licença se sobrepõe ao de outro colega ativo**, seja qual for o perfil. → COL-01.
- **Uma semana só tem um `OPERADOR_H3` em H3**, e o preenchimento anual exige no mínimo 3 ativos. → TUR-05 (um só H3 por semana), NOV-07 (mínimo 3).
- **Um item de checklist ou uma tarefa concluída é imutável**; a única correção é "Destravar", com justificativa, reservado a Gerente ou delegado. → CHK-02.
- **O Headcount Ideal e o Estudo de Cenários nunca podem divergir no ponto de partida**: os dois usam a mesma sequência de cálculo. → HDC-20.
- **Nunca publicar (ecrã, funções ou base de dados) sem autorização explícita do Gerente**, mesmo quando o pedido foi "implementa isto". → OP-02.
- **Uma alteração à base de dados só se considera terminada depois de correr contra dados reais** (transação revertida) e provar por consulta que não sobrou resíduo — nunca só "verificado por leitura". → OP-04/OP-05.
- **Nunca simular condições em produção** (relógio, funções reescritas) para poupar tempo — só testes reais. → OP-07.
- **Nunca acionar ao vivo uma ação irreversível "só para verificar"** (ex.: Fechar Mês). → OP-08.
- **Antes de qualquer alteração ou validação de regra, ler primeiro o ficheiro `docs/` dono dessa regra.** Esta é a razão de existir de todo este conjunto de ficheiros (instrução do Gerente, 2026-09-25/26).

## 4. Antes de escrever um ID novo

1. Confirmar que a regra é mesmo nova (procurar o conceito no glossário, `docs/glossario.md`, e no ficheiro dono do tema).
2. Escolher o prefixo do ficheiro onde a regra vive; usar o número seguinte ao maior já lá.
3. Escrever a regra por extenso **uma vez**, nesse ficheiro; qualquer outro sítio que precise de a citar usa só o ID.
4. Se a regra vier de uma indicação direta do Gerente, acrescentar a data em `docs/decisoes.md` (secção 1 ou 2, conforme for produto ou processo).

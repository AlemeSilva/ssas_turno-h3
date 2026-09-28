# Headcount Ideal, fecho mensal e Estudo de Cenários

**Estado:** levantado do código e da base a 2026-09-26. Decisões do Gerente: calculadora de Headcount Ideal e reserva de férias (2026-09-04, migrações 0039 e 0040); Estudo de Cenários (2026-09-06); quem esteve presente no mês conta nesse mês (2026-09-10, migração 0047); piso estrutural contratual (2026-09-11, migração 0051); capacidade por dias úteis e ecrã "Ver Cálculo" (2026-09-11, migração 0052); relatório em PDF (2026-09-14). **Os valores dos parâmetros não são regras**: o Gerente titular afina-os em produção, por isso este ficheiro dá só o significado e o valor inicial de cada um; os valores em vigor consultam-se no ecrã Headcount.
**Ler quando:** mexer na fórmula, nos parâmetros, no veredito, no fecho mensal, no Estudo de Cenários ou no relatório PDF; explicar um veredito; perceber por que um mês não fecha ou por que um aviso de headcount aparece.

## 1. O que é

Uma ferramenta do Gerente e do delegado para responder a uma pergunta: **a equipa tem o tamanho certo?** Compara o número de pessoas de hoje com o **Ideal**, calculado a partir da carga de trabalho e da capacidade de cada pessoa nos últimos meses **já fechados**. É um instrumento de decisão: não altera escalas, alarmes, utilizadores nem nenhum outro ecrã (a única ligação é o alarme de mês por fechar, `docs/alarmes.md`, ALA-09).

## 2. Conceitos

- **Carga** (horas por mês): todo o trabalho que a equipa tem de cobrir num mês. Soma de oito parcelas (HDC-02).
- **Capacidade plena por pessoa** (horas por mês): quanto uma pessoa consegue produzir num mês, já com a eficiência e uma reserva estrutural para férias descontadas (HDC-04).
- **Janela de tendência**: os N meses fechados mais recentes (N é um parâmetro, 3 por omissão) usados para as médias.
- **Ideal por horas**: média da carga ÷ média da capacidade plena por pessoa, na janela.
- **Piso estrutural**: o mínimo de pessoas que a estrutura de turnos exige, seja qual for a carga (HDC-08).
- **Ideal exato**: o maior dos dois anteriores. Nunca se arredonda antes de comparar.
- **Banda de tolerância**: a margem, em pessoas, à volta do Ideal dentro da qual a equipa é "Aceitável".
- **Equipa real (hoje)**: as pessoas **ativas** com perfil `OPERADOR` ou `OPERADOR_H3`. O Gerente não conta.
- **Mês em rascunho / mês fechado**: um mês de que já passou o último dia e cujos dados ainda se podem editar / um mês definitivo, com todos os valores congelados.

## 3. Interface (página Headcount, `/headcount`)

Só o Gerente titular e o delegado a veem ("Esta área é reservada ao Gerente." para os outros). Enquanto carrega mostra "A carregar…". A página tem quatro cartões.

### 3.1 Cartão "Headcount Ideal"

- Texto: "Média da carga dos últimos N meses fechados, a dividir pela capacidade plena por pessoa — comparada com o headcount real de hoje."
- **Botões** (desativados, com balão a explicar, enquanto não houver veredito): **Ver Cálculo** (3.5), **Estudo de Cenários** (3.6) e **Relatório** (3.7, **só o Gerente titular** o vê).
- **Veredito:** um selo **Aceitável** (verde), **Sobre-dimensionado** (âmbar) ou **Sub-dimensionado** (vermelho) e a linha "Equipa real: N · Ideal: X pessoas · Tolerância: ±B" (o Ideal com uma casa decimal). Sem nenhum mês fechado: "Ainda sem nenhum mês fechado — fecha o primeiro mês para veres o veredito."
- **Linha do H3:** "Aviso: risco de escala H3 (N de 3 mínimos)" a âmbar se os `OPERADOR_H3` ativos são 3 ou menos; senão "Operador H3 ativo: N" a cinzento (HDC-11).
- **Capacidade presente** do último mês fechado: "Capacidade presente em MÊS: X% da plena" (HDC-12).

### 3.2 Cartão "Dados do mês" (só aparece se houver meses por fechar)

Uma linha por mês em rascunho, do mais recente para o mais antigo: o mês, **Volume de pedidos**, **Dias de recuperação de cadeia**, o botão **Guardar** e, **só para o titular**, **Fechar Mês**. O delegado vê o texto "Fechar o mês fica reservado ao Gerente titular.".

- **Fechar Mês** está desativado enquanto o mês não terminou ("Só é possível fechar depois de o mês terminar") ou o volume está vazio ("Preenche o volume de pedidos primeiro"); ativo diz "Torna este mês definitivo — sem reabertura depois".
- **Guardar** grava o volume (vazio fica sem valor) e os dias de recuperação (vazio conta como 0). Se outra pessoa alterou o mês entretanto: "Este mês foi alterado por outra pessoa entretanto — valores atualizados abaixo."

### 3.3 Cartão "Parâmetros"

Os 15 parâmetros (secção 6), cada um com um balão a explicar o que significa. O titular edita e carrega em **Guardar parâmetros**; qualquer alteração fica registada em auditoria ("Qualquer alteração fica registada em auditoria."). Os outros veem os campos desativados ("Só o Gerente titular pode alterar — consulta apenas."). Um erro da base aparece por baixo.

### 3.4 Cartão "Histórico"

Todos os meses fechados, do mais recente para o mais antigo: **Mês, Pedidos, Carga (h), Headcount real, Operador H3**. O "Headcount real" e o "Operador H3" são as fotografias tiradas no fecho de cada mês (HDC-05).

### 3.5 "Ver Cálculo" ("Como se chega ao veredito")

Um ecrã escuro, de alto contraste, que mostra **os números reais de hoje**: o veredito e a frase que o explica; a tabela dos meses da janela (carga e capacidade por pessoa) com a **média**; "Ideal por horas = Carga média ÷ Capacidade média", o **piso estrutural**, e o **Ideal exato = maior dos dois**, a dizer qual venceu; a decomposição da **carga** do mês mais recente nas oito parcelas, com a soma e a carga oficial gravada; e a decomposição da **capacidade plena por pessoa** desse mês. Se a soma recalculada difere da gravada em mais de 0,05 h, mostra a nota "Diferença de arredondamento…" (o valor oficial é sempre o gravado).

### 3.6 "Estudo de Cenários"

Ver a secção 7.

### 3.7 "Relatório" (PDF)

Ver a secção 8.

## 4. Regras de cálculo

- **HDC-01** O cálculo mensal (`calcular_headcount`) e a leitura de parâmetros e meses só existem para o Gerente titular e o delegado (RLS e verificação na função). O cálculo do Ideal, do veredito e do Estudo de Cenários faz-se **no ecrã**, sobre valores **já gravados** no fecho dos meses; nunca sobre dados ao vivo.
- **HDC-02** **Carga do mês** = soma de oito parcelas, com os parâmetros em vigor quando o mês é fechado:

| Parcela | Fórmula |
| --- | --- |
| Pedidos | volume de pedidos × tempo médio por pedido (min) ÷ 60 |
| Batch | horas de batch por dia × dias corridos do mês |
| Olho Vivo | minutos por dia ÷ 60 × dias corridos |
| Preparação de fim de semana | horas por semana × semanas do mês |
| Imparidade: calendário | horas fixas por mês |
| Imparidade: execução | horas por semana × semanas do mês |
| Imparidade: reportes | minutos por dia ÷ 60 × dias por mês com reportes |
| Recuperação de cadeia | dias de recuperação × 24 h (sempre dia inteiro) |

- **HDC-03** **Dias corridos** = os dias do calendário do mês (28 a 31); **semanas** = dias corridos ÷ 7 (30 dias dão 4,2857 semanas). O batch e o Olho Vivo contam **todos** os dias, incluindo fins de semana e feriados.
- **HDC-04** **Capacidade plena por pessoa** = **dias úteis** × capacidade-base (h/dia) × taxa de eficiência × taxa de cobertura de férias. Dias úteis são de segunda a sexta **descontando os feriados** de `feriados_portugal` (`docs/calendario-h3.md`, SEM-16); a função é `dias_uteis_sem_feriados`. A taxa de cobertura de férias não é a ausência real do mês: é uma reserva fixa, para o Ideal já vir dimensionado para absorver a rotação de férias. Ao fim de semana só o H3 trabalha, por isso só os dias úteis contam para a capacidade.
- **HDC-05** **A equipa de um mês** (para a fotografia "Headcount real" e para a capacidade da equipa) é composta pelas pessoas `OPERADOR` e `OPERADOR_H3` que **estiveram presentes pelo menos um dia nesse mês**: criadas até ao último dia do mês **e** (ativas **ou** com data de saída a partir do primeiro dia do mês). Quem entra ou sai a meio do mês conta como **uma pessoa inteira** nesse mês; quem saiu antes do mês não conta. O Gerente nunca conta. Isto vale para os meses fechados; a equipa de **hoje** conta só ativos (USR-01).
- **HDC-06** **Capacidade plena da equipa** = capacidade plena por pessoa × equipa do mês. **Capacidade presente da equipa** = soma, por pessoa, de (dias úteis do mês − dias úteis de ausência) × capacidade-base × eficiência, **sem** a taxa de cobertura de férias (as ausências reais já estão descontadas). A ausência conta os dias úteis, sem feriados, dentro do mês, das **férias e licenças aprovadas** de cada pessoa. Nenhum dos dois altera o veredito.
- **HDC-07** **Ideal por horas** = média da carga dos meses da janela ÷ média da capacidade plena por pessoa dos mesmos meses. É a divisão das duas **médias**, nunca a média dos quocientes mensais. Se não houver meses fechados, ou se a média da capacidade for 0, não há Ideal (o ecrã não mostra "NaN" nem "Infinito").
- **HDC-08** **Piso estrutural** = mínimo de turnos críticos ÷ garantia contratual. A equipa opera 24×7 e os turnos H1, H2 e H3 exigem sempre, em simultâneo, o mínimo de pessoas dado pelo parâmetro (1+1+1 = 3; o H4 não conta, absorve quem sobra nas transições). Contratualmente esse mínimo nunca pode passar a fração (por omissão 0,50) do total da equipa; por isso a equipa nunca pode ser inferior ao piso (3 ÷ 0,5 = 6 por omissão). **Ideal exato = o maior de "Ideal por horas" e "piso estrutural"**. Sem garantia contratual válida (zero ou negativa) não há piso: vale o Ideal por horas.
- **HDC-09** **Veredito**: compara-se a **equipa real de hoje** com o Ideal **exato** (nunca arredondado; arredondar deslocaria a banda para um lado só). Se |real − ideal| é **menor ou igual** à banda (fronteira incluída): **Aceitável**. Se real é maior: **Sobre-dimensionado**. Se é menor: **Sub-dimensionado**.
- **HDC-10** A equipa real de hoje são as pessoas ativas `OPERADOR` e `OPERADOR_H3`, lidas da lista de utilizadores no momento em que a página abre.
- **HDC-11** **Risco de escala H3:** aparece quando os `OPERADOR_H3` ativos são **3 ou menos** (inclui o limiar exato: 3 de 3 já é sem margem). O preenchimento anual da escala exige pelo menos 3 (`docs/preenchimento-anual-de-novembro.md`, NOV-07). O aviso é independente do veredito: mostra-se mesmo com a equipa "Aceitável".
- **HDC-12** **Capacidade presente (%)** do último mês fechado = capacidade presente ÷ capacidade plena da equipa × 100. É um indicador à parte: **pode passar de 100%**, porque a capacidade plena já reserva a cobertura de férias e a presente não. Sem capacidade plena, não se mostra.

### 4.1 Exemplo trabalhado (valores ilustrativos, não os da produção)

Um mês de 30 dias com 22 dias úteis, 120 pedidos, sem recuperação de cadeia, e os **valores iniciais** dos parâmetros (secção 6):

| Parcela | Conta | Horas |
| --- | --- | --- |
| Pedidos | 120 × 40 ÷ 60 | 80,0 |
| Batch | 15 × 30 | 450,0 |
| Olho Vivo | 30 ÷ 60 × 30 | 15,0 |
| Prep. de fim de semana | 2 × 4,2857 | 8,6 |
| Imparidade: calendário | fixo | 8,0 |
| Imparidade: execução | 1 × 4,2857 | 4,3 |
| Imparidade: reportes | 30 ÷ 60 × 15 | 7,5 |
| Recuperação de cadeia | 0 × 24 | 0,0 |
| **Carga** | | **573,4** |

Capacidade plena por pessoa = 22 × 8 × 0,85 × 0,90 = **134,6 h**. Com três meses iguais: Ideal por horas = 573,4 ÷ 134,6 = **4,26**; piso = 3 ÷ 0,5 = **6**; **Ideal exato = 6** (o piso venceu). Com banda ±1: equipa real de 4 é Sub-dimensionado; de **5, 6 e 7 é Aceitável** (5 e 7 estão exatamente na fronteira); de 8 é Sobre-dimensionado. Com 900 pedidos a carga sobe a 1093,4 h, o Ideal por horas passa a **8,12**, vence o piso, e uma equipa de 5 fica Sub-dimensionada.

## 5. Ciclo mensal: rascunho, dados, fecho

- **HDC-13** **Rascunhos:** quando o Gerente ou o delegado abre a página, a base cria uma linha em rascunho para cada mês **terminado** que ainda não a tem: do mês a seguir ao último fechado até ao mês anterior ao atual; se nenhum mês está fechado, só o mês anterior ao atual. **O mês em curso nunca tem rascunho.** Só quem abre a página cria rascunhos (e o alarme ALA-09 só existe se o rascunho existir).
- **HDC-14** Os **únicos dados manuais** de cada mês são o **volume de pedidos** e os **dias de recuperação de cadeia** (por omissão 0). Todo o resto vem dos parâmetros e do calendário. O volume só se conhece depois de o mês acabar; por isso o Gerente tem até ao dia 5 do mês seguinte antes de o alarme âmbar aparecer.
- **HDC-15** **Fechar um mês** (`fechar_mes_headcount`): **só o Gerente titular**; o mês tem de já ter terminado (a partir do dia 1 do mês seguinte; o ecrã usa a hora local, a base a data UTC); o volume de pedidos tem de estar **gravado**; o mês não pode já estar fechado. O fecho **congela** os 11 parâmetros de carga e capacidade em vigor nesse momento (secção 6), a carga, a capacidade plena por pessoa e da equipa, a capacidade presente, os dias úteis e as fotografias "Headcount real" e "Operador H3 ativo" (HDC-05); marca quem fechou e quando; regista `FECHO_MES` na auditoria com os números.
- **HDC-16** **Um mês fechado é definitivo** (regra do Gerente): não há reabertura no ecrã, um gatilho na base recusa qualquer atualização de uma linha fechada (mesmo a contas de serviço) e não existe nenhuma política que permita apagar meses. As correções excecionais feitas até hoje foram operações por SQL, com o gatilho desligado só dentro da transação e ligado logo a seguir, sempre com linha de auditoria (`CORRECAO_MANUAL_FECHO`, `CORRECAO_RETROATIVA`; 2026-09-04, 09-10 e 09-11).
- **HDC-17** **Mudar um parâmetro só afeta os meses fechados depois**, nos 11 parâmetros congelados: o histórico não muda retroativamente. Os **4 parâmetros do veredito** (banda de tolerância, janela de tendência, mínimo de turnos críticos e garantia contratual) **não se congelam**: leem-se ao vivo e aplicam-se de imediato a todo o histórico (o piso estrutural, por exemplo, é sempre o de hoje).
- **HDC-18** Só o titular altera parâmetros e fecha meses. O delegado **lê tudo** e pode **guardar o volume e a recuperação** de um mês em rascunho, mas não o fecha (`docs/regras-entre-colegas.md`, COL-17). Cada alteração de parâmetros fica em auditoria (`ALTERACAO_PARAMETRO`, com os valores antes e depois; ver `docs/historico.md`).

## 6. Parâmetros

Existe uma só linha de parâmetros (a base recusa uma segunda). "Congelado" quer dizer que fica gravado no mês quando ele fecha (HDC-17).

| Parâmetro | Significado | Valor inicial | Congelado |
| --- | --- | --- | --- |
| Capacidade-base (h/dia) | Horas de trabalho nominais de uma pessoa por dia | 8 | sim |
| Taxa de eficiência (0-1) | Fração do dia efetivamente produtiva | 0,85 | sim |
| Taxa de cobertura de férias (0-1) | Fração da capacidade que sobra depois de reservar a rotação de férias | 0,90 | sim |
| Batch (h/dia) | Processamento em lote, todos os dias | 15 | sim |
| Olho Vivo (min/dia) | Tarefa diária fixa | 30 | sim |
| Prep. fim de semana (h/semana) | Preparação do plano de fim de semana | 2 | sim |
| Tempo médio por pedido (min) | Duração média de um pedido | 40 | sim |
| Imparidade: calendário (h/mês) | Parte de calendário do Cálculo de Imparidade | 8 | sim |
| Imparidade: execução (h/semana) | Execução do Cálculo de Imparidade | 1 | sim |
| Imparidade: reportes (min/dia) | Reportes da Imparidade, nos dias em que os há | 30 | sim |
| Imparidade: reportes (dias/mês) | Dias por mês com reportes | 15 | sim |
| Banda de tolerância (pessoas) | Margem do veredito "Aceitável" | 1 | não (ao vivo) |
| Janela de tendência (meses) | Quantos meses fechados entram nas médias | 3 | não (ao vivo) |
| Mínimo de turnos críticos (pessoas) | Pessoas em simultâneo em H1+H2+H3 | 3 | não (ao vivo) |
| Garantia contratual (0-1) | Fração máxima do total que o mínimo pode ocupar | 0,50 | não (ao vivo) |

A base impõe só que a garantia contratual esteja entre 0 (exclusive) e 1, e que o mínimo de turnos críticos não seja negativo. **Os restantes parâmetros aceitam qualquer número** (o ecrã não limita intervalos).

## 7. Estudo de Cenários

Um simulador "e se" que **nunca grava nada**. Abre-se em "Estudo de Cenários" (Gerente e delegado).

- **HDC-19** É **efémero e só no ecrã**: nenhum dado vai para a base nem para o browser. Fechar descarta tudo; reabrir recomeça dos valores reais. Se houver ajustes, fechar pede confirmação ("Fechar sem guardar?": "Este estudo de cenários nunca é gravado — os ajustes que fizeste perdem-se ao fechar."; botões Cancelar e Fechar sem guardar).
- **HDC-20** **No ponto zero** (nada tocado) o Ideal simulado é **exatamente o da página** (incluindo o piso estrutural). A carga parte sempre da média da carga gravada; só os termos **tocados** entram na conta, como diferença face ao seu histórico. Assim a ferramenta nunca diverge do veredito real.
- **HDC-21** **Ajustáveis:** nove grandezas, mais o tamanho da equipa. A capacidade por pessoa, o tempo médio por pedido, a banda, a janela, o mínimo e a garantia **não** se ajustam: ficam nos valores reais.
- **HDC-22** **Tipo de slider, regra geral:** se a média histórica do termo (na janela) é **exatamente 0**, o slider é **absoluto** (de 0 a um máximo, na unidade do termo); senão é **percentual**, de **-100%** (termo eliminado) a **+200%** (triplica), sobre a média histórica. Nunca há termo negativo.

| Grandeza | Unidade | Máximo do slider absoluto |
| --- | --- | --- |
| Batch | h/dia | 24 |
| Olho Vivo | min/dia | 120 |
| Prep. de fim de semana | h/semana | 20 |
| Imparidade: calendário | h/mês | 40 |
| Imparidade: execução | h/semana | 20 |
| Imparidade: reportes (minutos) | min/dia | 120 |
| Imparidade: reportes (dias) | dias/mês | 31 |
| Volume de pedidos | pedidos/mês | 1000 |
| Recuperação de cadeia | dias/mês | 15 |

- **HDC-23** Os **reportes de Imparidade** são um produto de dois fatores (minutos × dias). Se os dois sliders se mexem, calcula-se **um só termo** com os valores efetivos dos dois, nunca dois deltas somados (perderia o termo cruzado).
- **HDC-24** **A equipa simulada** = dois contadores independentes, **Operadores** e **Operadores H3**, mínimo 0 cada, que começam nos valores de hoje (pessoas ativas `OPERADOR` e `OPERADOR_H3`). Passar uma pessoa de um contador para o outro simula "deixa o H3 mas fica na equipa" (o total não muda, só o risco H3); baixar só um simula "sai da equipa". O risco H3 aplica-se ao contador de H3 (HDC-11); o aviso mostra "não sobrepor férias entre H3, antecipar cross-training".
- **HDC-25** Mostra o veredito e o Ideal simulados, e um gráfico com duas barras (**Carga** e **Capacidade plena** da equipa simulada) e uma linha tracejada com a capacidade real de hoje. A escala do gráfico recalcula-se a cada ajuste (maior valor × 1,15), por isso nada é cortado. Com equipa simulada 0 não há erro: a capacidade é 0 e, **nos valores em vigor hoje** (piso = 6, banda ±1), o veredito é Sub-dimensionado.
- **HDC-26** Sem baseline válido (sem meses fechados, ou capacidade 0), mostra "Sem baseline válido para simular…". Na prática o botão já está desativado nesse caso.

**Exemplo** (o de 4.1, com 2 Operadores e 3 Operadores H3): no ponto zero, Ideal 6,0, Aceitável, com aviso de risco H3 (3 é o limiar). Baixar o batch para metade reduz a carga a 348 h, mas o Ideal continua 6,0: o piso manda. Baixar os Operadores H3 de 3 para 2 (sem subir os Operadores) dá equipa 4 e Sub-dimensionado, com o aviso de risco H3 — diferente de **passar** um H3 para Operador, que mantém o total em 5 (HDC-24).

## 8. Relatório em PDF

- **HDC-27** Só o **Gerente titular** o vê e o pede (botão "Relatório", "A gerar…"). Gera-se **no browser** (a biblioteca de PDF só se descarrega no clique) e descarrega-se como `Calculadora-Headcount-AAAA-MM-DD-HHhMM.pdf`. Não fica guardado em nenhum sítio. Usa a **mesma sequência de cálculo** da página (`calcularEstadoHeadcountAtual`), por isso nunca diverge do veredito do ecrã; sem Ideal calculável não gera ("Não foi possível gerar o relatório com os dados atuais.").
- Formato: A4; cabeçalho "Calculadora de Headcount | Operação SSAS Montepio | data | hora" em todas as páginas; rodapé "Página X de Y".
- Secções, por ordem: **Estado atual** (veredito, equipa real, Ideal, tolerância, frase do veredito, linha do H3 com o aviso de risco e capacidade presente do último mês fechado); **Leitura da situação** (dois parágrafos em linguagem simples sobre a carga e a capacidade da janela, com o mínimo e o máximo, a parcela dominante e a reserva de férias); **Parâmetros** (página nova; os 15, com valor e significado; "Valores em vigor no momento da geração deste relatório."); **Como se chega ao Ideal**; **Como se chega à Carga** do mês mais recente; **Como se chega à Capacidade plena por pessoa** desse mês; **Histórico** (página nova; os **5 meses fechados mais recentes**, com Mês, Pedidos, Carga e Operador H3, sem a coluna do headcount real, com uma nota que indica o total apenas quando excede os 5 meses mostrados). Onde um valor é desconhecido mostra "—", nunca "0".

## 9. Quem pode o quê

| | Operador / Operador H3 | Delegado | Titular |
| --- | --- | --- | --- |
| Ver a página, o Ideal, "Ver Cálculo", Estudo de Cenários | não | sim | sim |
| Guardar volume e recuperação de um mês em rascunho | não | sim | sim |
| Fechar um mês | não | não | sim |
| Alterar parâmetros | não | não | sim |
| Gerar o relatório PDF | não | não | sim |
| Ver o alarme de mês por fechar | não | sim | sim |

## 10. Limites e lacunas conhecidos

- **"Fechar Mês" usa os valores gravados**, não o que está escrito nos campos. É preciso carregar em **Guardar** antes de fechar; senão o fecho recusa ("Preenche o volume de pedidos antes de fechar o mês.") ou fecha com o valor gravado antes.
- **A ordem de fecho não é imposta:** é possível fechar um mês mais recente antes de um mais antigo (o alarme ALA-09 assinala o mais antigo por fechar).
- **Sem validação de intervalos nos parâmetros** (secção 6). Se se fechar um mês com eficiência ou cobertura a 0, a capacidade desse mês fica 0; se a média da janela for 0, o ecrã mostra a mensagem "Ainda sem nenhum mês fechado…" apesar de haver meses fechados.
- Quem entra ou sai a meio de um mês conta como pessoa inteira (HDC-05); a capacidade presente não desconta os dias antes da entrada nem depois da saída.
- Os **feriados** vêm da tabela `feriados_portugal` (`docs/preenchimento-anual-de-novembro.md`): se um ano ainda não tem feriados, os dias úteis desse ano contam feriados como dias de trabalho. O valor fica congelado no fecho.
- A página lê os dados uma vez ao abrir e depois de cada gravação; **não há atualização em tempo real** entre sessões (o "Guardar" de um mês protege contra edições simultâneas).
- O alarme mensal só existe se a página foi aberta depois de o mês terminar (HDC-13).
- O Estudo de Cenários e o Relatório só usam os meses da janela e a equipa de hoje; não projetam o futuro (férias marcadas, saídas agendadas).

## 11. Código e testes

- Ecrã: `src/pages/HeadcountPage.tsx`, `src/components/HeadcountExplicacaoDialog.tsx`, `src/components/HeadcountCenariosDialog.tsx`, `src/data/useHeadcountMensal.ts`, `useHeadcountParametros.ts`, `useAlertaHeadcountMensal.ts`.
- Lógica pura: `src/lib/headcount.ts` (médias, piso, veredito, decomposição, textos partilhados), `cenarios-headcount.ts`, `relatorio-headcount.ts`, `relatorio-headcount-pdf.ts` (o único ficheiro que importa a biblioteca de PDF, de forma dinâmica).
- Base: tabelas `headcount_parametros` (uma só linha) e `headcount_mensal` (uma linha por mês, dia 1 obrigatório); funções `calcular_headcount`, `fechar_mes_headcount`, `garantir_rascunho_headcount_mensal`, `dias_uteis_sem_feriados`; gatilhos `trg_headcount_mensal_bloqueia_reabertura`, `trg_headcount_mensal_atualizado_em`, `trg_headcount_parametros_before_update`; RLS: ler = Gerente ou delegado, atualizar meses = Gerente ou delegado **só em rascunho**, atualizar parâmetros = titular.
- Testes: `supabase/tests/18_headcount_ideal.sql`, `22_headcount_membro_ativo_no_mes.sql`; `tests/camada2-regras/headcount.test.ts`, `cenarios-headcount.test.ts`, `relatorio-headcount.test.ts`, `relatorio-headcount-pdf.test.ts`. Não há teste de ecrã (e2e) do Headcount.

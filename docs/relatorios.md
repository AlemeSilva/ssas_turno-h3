# Relatório semanal de escala

**Estado:** levantado do código a 2026-09-26. Reproduz o modelo de email que o Gerente usa hoje; a regra dos 50% de ausência é decisão do Gerente de 2026-08-13; as exclusões de quem saiu vêm de 2026-09-25.
**Ler quando:** gerar, explicar ou mudar o texto do relatório semanal; perceber por que uma pessoa aparece, não aparece ou aparece noutro turno; qualquer conversão entre o período do relatório (sexta a quinta) e a escala (sábado a sexta). Ler antes `docs/calendario-h3.md`.

## 1. O que é

Um texto pronto a **copiar e colar num email** com a escala da semana (quem está em cada turno) e as férias/licenças do período. A aplicação **nunca envia** o texto; o Gerente publica-o à mão, às quintas-feiras. Só o Gerente e o delegado acedem (`/relatorios`); os outros vêem "Esta área é reservada ao Gerente.".

## 2. Interface (página "Relatório Semanal de Escala")

- **Cabeçalho:** o título e, à direita, "Semana de DD/MM/AAAA" (a sexta que rotula o período).
- **Nota:** "Texto pronto a copiar/colar para envio manual por email — publicação semanal às quintas-feiras. As alterações que ocorrerem ficam sempre a cargo do Gerente."
- **Estados:** "A carregar…" enquanto lê a escala, as férias e os utilizadores; se a leitura falhar, "Não foi possível carregar os dados da escala/férias: MENSAGEM. Não copies um relatório gerado sem estes dados — tenta recarregar a página.".
- **Texto:** uma caixa de leitura com o relatório (letra de largura fixa) e o botão **Copiar texto** ("Copiado!" durante 2 segundos).

## 3. O texto gerado

```
Bom dia,                                   (Bom dia antes das 12h; Boa tarde até às 19h; Boa noite depois)

Segue atualização de turnos, conforme abaixo:

H1 – 07H00 ÀS 16H00
H2 – 14H00 ÀS 23H00
H3 – 22H00 ÀS 07H00
H4 – 09H00 ÀS 18H00

Segue escala e turnos referentes aos dias DD/MM/AAAA a DD/MM/AAAA.

Operação SAS
H1 - 07h00 às 16h00 – NOME / NOME
H2 - 14h00 às 23h00 – NOME
H3 - 22h00 às 07h00 – NOME
H4 - 09h00 às 18h00 – NOME / NOME

Férias/Licenças
NOME - DD/MM/AAAA à DD/MM/AAAA          (ou "—" se ninguém)
```

Um turno sem ninguém mostra "—". Uma pessoa com férias em parte da semana, mas sem chegar à regra dos 50%, aparece no seu turno com a nota "(ausente por férias em DD/MM/AAAA)" (ou "… em DD/MM/AAAA a DD/MM/AAAA e DD/MM/AAAA", agrupando dias seguidos).

## 4. Conversões (a parte que não se pode errar)

O relatório usa **três âncoras ao mesmo tempo**. Com hoje = quinta-feira **2026-10-15** (`docs/calendario-h3.md`, secção 2.1):

| O que | Valor | Como se obtém |
| --- | --- | --- |
| Quinta do ciclo | 2026-10-15 | `quintaEscalaDe(hoje)`: a quinta mais recente (hoje, se for quinta). **Muda às 00h00 de quinta** |
| Início do período e rótulo do relatório ("sexta administrativa") | sexta 2026-10-16 | quinta + 1 |
| Escala consultada (`escala_semanal.semana_ref`) | sábado 2026-10-17 | quinta + 2 |
| Fim do período | quinta 2026-10-22 | quinta + 7 (o período tem 7 dias: de sexta a quinta) |
| Semana civil dominante, para decidir substitutos | segunda 2026-10-19 | a segunda da semana civil que contém a sexta do rótulo + 3 dias |

Quarta 2026-10-14 ainda dá o período anterior (sexta 09/10 a quinta 15/10, escala do sábado 10/10).

## 5. Regras

- **REL-01** O período é **sexta a quinta seguinte (7 dias)**, rotulado pela sexta, e a escala descrita é a do **sábado imediatamente a seguir** a essa sexta (H3 só arranca às 22h da sexta). O período só avança para o ciclo seguinte às 00h00 de quinta (SEM-12).
- **REL-02** **Só entra equipa ativa:** quem saiu (`ativo = false`) não aparece em nenhuma parte do texto, nem no turno, nem em Férias/Licenças, nem como substituto. O **Gerente nunca aparece** ("Operação SAS" é só a equipa operacional), embora tenha uma linha H4 na escala.
- **REL-03** Uma ausência aprovada **conta como férias** neste relatório quando **cobre 50% ou mais dos 7 dias** do período **e** termina depois da sexta do rótulo (uma ausência que acaba nessa sexta já não afeta a semana nova). Decisão do Gerente, 2026-08-13: uma ausência de 1 ou 2 dias não justifica tirar a pessoa da linha do turno nem listá-la em Férias/Licenças (casos reais: uma pessoa ausente 1 dia e outra a começar férias no último dia do período).
- **REL-04** Quem está de férias segundo REL-03 **não aparece a trabalhar**. O seu **substituto da semana civil dominante** passa a constar no turno do ausente (e **deixa de constar no seu próprio turno** neste relatório), desde que o substituto não esteja também de férias nem tenha saído. Sem substituto confirmado (ou com a decisão "Nenhum"), o turno do ausente fica "—" para o Gerente decidir à mão.
- **REL-05** Quem tem alguns dias de férias no período, sem chegar aos 50%, mantém-se no seu turno com a nota de férias (secção 3).
- **REL-06** Em **Férias/Licenças**, cada pessoa aparece **uma vez**, com o período **ininterrupto** de ausência a que o registo pertence: vários pedidos aprovados seguidos ou sobrepostos, sem dia de intervalo, contam como um só período.
- **REL-07** A saudação depende da hora local de quem gera o texto (antes das 12h "Bom dia,", até às 19h "Boa tarde,", depois "Boa noite,").
- **REL-08** Os horários dos turnos são os fixos: H1 07h00–16h00, H2 14h00–23h00, H3 22h00–07h00, H4 09h00–18h00 (`HORARIO_TURNO`).

## 6. Limites conhecidos

- O período ininterrupto de REL-06 só junta pedidos que **tocam o período do relatório** (só esses são lidos). Um pedido contíguo que termine antes do início do período não é incluído, por isso a data de início mostrada pode ser posterior ao verdadeiro início da ausência.
- O substituto de REL-04 substitui o turno do ausente **para o relatório inteiro**, mesmo que a ausência só cubra parte do período.
- O texto reflete a base **no momento em que a página é aberta**; não se atualiza com alterações posteriores sem recarregar (só a lista de utilizadores é lida com o relatório).

## 7. Código e testes

- `src/pages/RelatoriosPage.tsx` (conversões e leitura), `src/lib/gerarRelatorioSemanal.ts` (texto e regras), `src/lib/datas.ts`.
- Testes: `tests/camada2-regras/export.test.ts` (o gerador do relatório: formato, inativos, férias parciais, substitutos, regra dos 50%, períodos ininterruptos).

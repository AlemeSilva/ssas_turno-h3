# Sugestão automática da escala

**Estado:** refeita a 2026-09-26 (commit `cfc8171`) por indicação do Gerente: "seja lá que sugestão este painel venha dar, que seja dentro das regras já estabelecidas e em prática para cada turno". Segue as regras do preenchimento anual (`docs/turnos-e-rotacao.md`). Verificada contra o preenchimento anual real: as 52 semanas de 2027 saíram iguais às da sugestão.
**Ler quando:** usar, alterar ou validar a Sugestão automática; preencher uma semana que ficou sem escala; perceber por que a sugestão propõe uma pessoa e não outra.

## 1. O que é

Um painel da Escala do Mês (só Gerente e delegado) que **calcula uma proposta** de H1, H2, H3 e H4 para **uma semana H3** e, se o Gerente quiser, a **grava** na escala. Calcular nunca grava nada. É a via para preencher uma semana em falta (por exemplo, depois de um H3 sair da equipa, ou de uma semana falhar no preenchimento anual).

## 2. Interface

O botão **Sugerir automaticamente** (na barra da Escala do Mês) abre um painel:

1. **Título** "Sugestão automática" e o botão de fechar (que descarta a proposta).
2. **Semana H3 (o sábado em que começa)**: seletor de data. Por omissão propõe o **sábado da próxima quinta-feira** (ver SUG-03). Ao escolher um sábado mostra o intervalo ("Sábado 07/11/2026 a sexta 13/11/2026"); com outro dia mostra "A semana do H3 começa ao sábado — escolhe um sábado." e não calcula.
3. **Calcular sugestão** ("A calcular…"), com o balão "Só calcula uma proposta para a semana escolhida — ainda não altera a escala real".
4. **A proposta**, numa tabela: **H1**, **H2**, **H4** (um ou vários nomes separados por vírgula, ou "—" se ninguém) e **H3** (com cadeado; o nome, e "⚠ override" quando a proposta ultrapassa o limite mensal).
5. **Aplicar à escala**, com o balão "Grava esta proposta em Escala do Mês, substituindo o que já lá estiver nessa semana". Depois de aplicar mostra "Aplicado à escala." Se a gravação falhar, mostra o erro da base (por exemplo, o do limite mensal, o de férias que cobrem a semana toda ou o do H3 único).

## 3. Regras

- **SUG-01** A proposta segue **as mesmas regras de cada turno** do preenchimento anual de novembro: H3 e H2 em rotação; H4 = restantes `OPERADOR_H3` + fixos H4 + Gerente titular; H1 = fixos H1 (`docs/turnos-e-rotacao.md`, TUR-10 a TUR-14). Só entram pessoas **ativas**.
- **SUG-02** A semana é sempre um **sábado**. O ecrã não deixa calcular outro dia e a função recusa-o com erro 400 ("semana_ref tem de ser um sábado (AAAA-MM-DD)"), para um ecrã por atualizar nunca propor uma "quinta" (o erro antigo).
- **SUG-03** A semana proposta por omissão é o **sábado do ciclo da próxima quinta-feira**: da segunda à quarta, o sábado dessa semana; da quinta ao domingo, o sábado da semana seguinte. Exemplos: quarta 14/10 → sábado 17/10; quinta 15/10 → sábado 24/10; sábado 17/10 → sábado 24/10.
- **SUG-04** **H3:** entre os `OPERADOR_H3` ativos, quem tem menos H3 nos últimos 3 meses; depois menos no ano; depois o `id` (desempate estável, sem depender da ordem em que a base devolve as linhas). **Quem tem férias** (aprovadas ou pendentes) a sobrepor a semana **não é proposto** para H3 (o preenchimento anual, ao contrário, não olha para férias). Se ninguém sobrar, o H3 fica "—".
- **SUG-05** **Limite mensal:** conta as semanas de H3 de cada pessoa no **mesmo mês da semana** (o mês do dia `semana_ref + 3`, SEM-08), **todas** as outras semanas desse mês, anteriores e seguintes, exceto a própria semana: é o critério do trigger da base, para a sugestão não propor o que a base depois recusa. Quem já atingiu o limite não é proposto; se **ninguém** couber, propõe-se na mesma o primeiro da ordenação, marcado **"⚠ override"**. Atenção: o "Aplicar" dessa proposta é **recusado pela base** (TUR-16), por isso o "override" só serve de aviso.
- **SUG-06** **H2:** entre os `OPERADOR_H3` ativos com `elegivel_h2`, exceto o H3 proposto: menos H2 nos últimos 3 meses, depois menos no ano, depois o `id`. Sem elegíveis, fica "—". As férias **não** excluem ninguém de H2, H4 ou H1.
- **SUG-07** **Janelas de contagem:** "últimos 3 meses" vai de `sábado − 3 meses` até à véspera da semana (com o ajuste do Postgres ao fim do mês: 30 de maio − 3 meses = 28 de fevereiro); "no ano" começa a 1 de janeiro do ano da semana. Só contam linhas de H3 e de H2 anteriores à semana.
- **SUG-08** **Aplicar** grava, **numa só operação**, uma linha por pessoa da proposta (H1, H2, H4 e, por último, H3), substituindo a linha que essas pessoas já tenham nessa semana (chave: pessoa e semana). O **H3 entra por último** para que, se a semana já tem outro H3, esse passe primeiro ao seu novo turno na mesma gravação e só depois entre o novo (um H3 por semana). Se **uma** linha falhar (limite, férias a cobrir a semana toda, H3 duplicado), **nenhuma** é gravada e o erro aparece no painel.
- **SUG-09** Aplicar **não apaga** as linhas de quem não está na proposta: uma pessoa com linha nessa semana que a proposta não inclui (por exemplo, uma que a proposta deixou sem turno) mantém a linha que tinha.
- **SUG-10** A proposta **não olha** para a linha que a semana já tem: pode propor outro H3 diferente do atual. É uma proposta, não uma leitura do que existe.

## 4. Exemplo

Com a equipa de referência (três `OPERADOR_H3` A, B, C, dos quais A e B elegíveis a H2; um H1 fixo; um H4 fixo; o Gerente), para o sábado 2026-11-07 a função devolveu: H3 = C, H2 = A, H4 = B mais o fixo e o Gerente, H1 = o fixo. (Resultado obtido a 2026-09-26 na função publicada, idêntico ao algoritmo local sobre os dados reais.)

## 5. Onde corre

- O cálculo faz-se numa **Edge Function** (`sugerir-escala`), não no browser: lê utilizadores ativos, o histórico de H3 e H2, as semanas do mês e as férias, e devolve `{ semana_ref, H3, H2, H1, H4 }`. A lógica pura, sem acesso à base, está em `supabase/functions/sugerir-escala/algoritmo.ts` (partilhada com os testes).
- A função é publicada pelo fluxo `deploy-functions.yml` quando algo em `supabase/functions/**` muda e chega ao `main`.
- Se a função devolver uma resposta antiga (uma só pessoa em H1 e H4), o ecrã aceita as duas formas.

## 6. Limites e lacunas conhecidos

- A proposta ignora as **trocas** por decidir e as decisões de **substituto**.
- Não há forma de pedir outra proposta para a mesma semana (o resultado é determinístico: com os mesmos dados dá o mesmo).
- O botão "Aplicar" pode ser recusado pela base (limite mensal, férias); o painel mostra o erro mas não sugere alternativa.

## 7. Código e testes

- Ecrã: `PainelSugestao` em `src/pages/EscalaPage.tsx`.
- Função: `supabase/functions/sugerir-escala/index.ts` e `algoritmo.ts`.
- Testes: `tests/camada2-regras/algoritmo-sugestao-h3.test.ts` (rotação, limites, férias, Gerente titular, mês pela maioria dos dias em todos os sábados de 2026 a 2030).

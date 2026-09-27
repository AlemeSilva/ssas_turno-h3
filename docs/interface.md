# Interface: entrada, estrutura do ecrã e convenções

**Estado:** levantado do código a 2026-09-26. Este ficheiro descreve o que é **comum** a todos os ecrãs (entrada, barra de alertas, menu, convenções). O conteúdo de cada página está no ficheiro da sua funcionalidade (tabela da secção 3).
**Ler quando:** mexer no menu, na entrada, na barra de topo, nos balões ou nas confirmações; criar uma página nova; perceber por que um botão aparece ou não a um perfil; decidir como um ecrã novo deve comportar-se.

## 1. O que é a aplicação, do ponto de vista de quem a usa

Uma aplicação web chamada **"Gestão de Turnos"** (Accenture · Banco Montepio) para a equipa de operação: escala dos turnos H1 a H4, férias, trocas de H3, plano e checklist do fim de semana, relatório semanal e dimensionamento da equipa. Está feita para **computador**: a largura mínima é de 1180 px e não há versão para telemóvel. A língua é o **português de Portugal**; as datas mostram-se como **DD/MM/AAAA** e as horas como **HH:MM**. O aspeto é claro, com a fonte Geist, os componentes shadcn/ui sobre Tailwind e as cores de marca (roxo Accenture, âmbar Montepio) só no logótipo.

## 2. Entrada e sessão

- **Ecrã de entrada:** cartão "Gestão de Turnos · Accenture · Banco Montepio" com **Email**, **Palavra-passe** e o botão **Entrar** ("A entrar…"). Um erro mostra sempre a mesma frase: "Credenciais inválidas ou conta inexistente. Contacte o Gerente para provisionamento de acesso." (INT-01).
- **Estados antes do conteúdo** (`RequireAuth`): "A carregar…" enquanto se conhece a sessão e o perfil; sem sessão, o ecrã de entrada; com sessão de uma conta **desativada**, "Esta conta foi desativada. Contacte o Gerente." e o botão **Sair** (USR-01).
- **Ao entrar**, a aplicação lê o perfil da pessoa e pergunta à base se é Gerente ou delegado (`docs/perfis-e-permissoes.md`). Esse resultado só se atualiza quando a sessão muda (entrar, sair ou a plataforma renovar a sessão) ou a página recarrega.
- A raiz do site (`/`) e qualquer endereço desconhecido levam a **Início** (`/inicio`).
- **INT-01** **Não há registo público nem recuperação de palavra-passe por email:** as contas são criadas e repostas pelo Gerente (USR-14). O erro de entrada não distingue "palavra-passe errada" de "conta inexistente".

## 3. Estrutura do ecrã e menu

Todas as páginas partilham a mesma moldura (`AppShell`), de cima para baixo:

1. **Barra de alertas** (`docs/alarmes.md`): "Próximo alerta" e as etiquetas de aviso. Reavalia-se de 30 em 30 segundos.
2. **Cabeçalho:** o logótipo e "Gestão de Turnos / Accenture · Banco Montepio"; o **menu** (separadores); o nome de quem está com sessão e o perfil (`GERENTE`, `OPERADOR_H3` ou `OPERADOR`, com " · substituto do Gerente" para um delegado); o botão **Alterar Senha** (`docs/utilizadores-e-saidas.md`, USR-13); o botão **Sair**.
3. **Conteúdo** da página (com deslocação própria).

| Separador | Endereço | Quem o vê no menu | Descrição completa |
| --- | --- | --- | --- |
| **Início** | `/inicio` | todos | `docs/inicio.md` |
| **Plano de Fim de Semana** | `/plano` | todos | `docs/plano-de-fim-de-semana.md` |
| **Checklist Ativo** | `/checklist` | todos | `docs/checklist.md` |
| **Escala do Mês** | `/escala` | todos | `docs/escala.md`, `docs/ferias-e-plantoes.md`, `docs/trocas-e-delegacao.md`, `docs/sugestao-automatica.md` |
| **Relatórios** | `/relatorios` | Gerente e delegado | `docs/relatorios.md` |
| **Histórico** | `/historico` | Gerente e delegado | `docs/historico.md` |
| **Definições** | `/definicoes` | Gerente e delegado | `docs/definicoes.md` |
| **Utilizadores** | `/utilizadores` | Gerente e delegado | `docs/utilizadores-e-saidas.md` |
| **Headcount** | `/headcount` | Gerente e delegado | `docs/headcount.md` |

- **INT-02** Os cinco últimos separadores **não aparecem** a quem não é Gerente nem delegado. Se essa pessoa escrever o endereço à mão, a página mostra "Esta área é reservada ao Gerente." e não carrega dados. Mesmo assim, **a proteção real está na base de dados** (`docs/perfis-e-permissoes.md`, PER-01).
- O separador ativo fica destacado a índigo. Um delegado passa a ver os cinco separadores quando o ecrã relê o seu perfil (ao recarregar a página ou quando a sessão se renova).

## 4. Convenções que todos os ecrãs seguem

- **INT-03** **Balões de ajuda.** Todo o botão, parâmetro ou controlo cuja função não é óbvia tem um balão (aparece ao fim de 400 ms) que diz **o que acontece** ao usá-lo, em linguagem simples ("Recusa a troca: a escala original mantém-se sem alterações"). Um botão desativado explica **porquê** no balão (ex.: "Só é possível fechar depois de o mês terminar"). Um controlo novo leva o seu balão.
- **INT-04** **Convenção de cores:** **verde** = concluído, aprovado ou aceitável; **âmbar** = atenção ou a aguardar decisão (férias e plano pendentes, avisos); **vermelho** = problema (atrasado, recusado, crítico, sub-dimensionado); **índigo** = em andamento (e o destaque do separador ativo); **cinzento** = neutro ou sem dados (inclui o "pendente" das cadeias). Um estado novo reutiliza estas cores em vez de inventar outras.
- **INT-05** **Ações críticas protegem-se contra duplo clique:** os botões de decidir férias, trocas e alertas têm uma pausa de **500 ms por item** (`useDebounce`); apagar um pedido de férias pede **confirmação em dois cliques** ("Confirmar?", 4 segundos). Ações irreversíveis dizem-no no balão.
- **INT-06** **Mensagens de erro:** as do servidor aparecem por baixo da ação que as causou, **traduzidas para linguagem simples** quando a causa é conhecida (ex.: saldo de férias esgotado) e tal como vêm quando não é. Uma gravação recusada por falta de permissão pode não mostrar erro nenhum (`docs/perfis-e-permissoes.md`, secção 7).
- **INT-07** **Estados vazios e de espera** dizem o que falta e o que fazer: "A carregar…", "Sem trocas propostas.", "Ainda não existe plano criado para o ciclo com início em… Cria o plano primeiro…". Nas páginas de consulta (Histórico), a tabela começa vazia até se carregar em **Pesquisar**.
- **INT-08** **Atualização automática** só onde a tabela está publicada para tempo real (lista em `docs/perfis-e-permissoes.md`, secção 4): escala, férias, substitutos, trocas, plantão, plano, tarefas, checklist e cadeias. Utilizadores, delegações, auditoria e Headcount lêem-se ao abrir o ecrã e depois de cada gravação; outra pessoa a alterá-los não aparece sem recarregar.
- **INT-09** **A hora da aplicação** vem de uma só função (`agora()`); nos testes de ecrã pode ser fixada (`window.__TEST_TIME__`). O ecrã usa a hora local do computador e a base trabalha em UTC (`docs/calendario-h3.md`, secção "Fuso horário e relógio").
- **INT-10** **O nome dos ecrãs, botões e mensagens deste projeto é o do vocabulário do Gerente** (Escala do Mês, Sugestão automática, Alterar Senha, Repor password, "H3 por atribuir"…). Alterá-lo exige o mesmo cuidado que alterar uma regra: os ficheiros `docs/` e os testes de ecrã citam-no à letra.

## 5. Limites e lacunas conhecidos

- Só computador (1180 px de largura mínima); não há tema escuro nem versão para telemóvel.
- Um ficheiro de estilos (`src/styles/theme.css`) ainda descreve, no comentário do topo, um "dark mode corporativo" que já não é o aspeto real; o que vale são os componentes Tailwind e shadcn. As cores de marca desse ficheiro continuam a ser usadas no logótipo.
- O menu não indica quantos avisos há em cada separador; os avisos vivem só na barra de alertas.
- Há botões que uma pessoa sem permissão vê e a base recusa, sem mensagem (`docs/plano-de-fim-de-semana.md`, PLA-05; `docs/checklist.md`, CHK-06).

## 6. Código e testes

- `src/App.tsx` (rotas), `src/layout/AppShell.tsx`, `src/layout/AlertBar.tsx`, `src/layout/AlterarSenhaDialog.tsx`, `src/auth/` (`AuthContext`, `RequireAuth`, `Login`), `src/components/ui/` (componentes de base), `src/lib/hooks/useDebounce.ts`, `src/lib/datas.ts`.
- Testes de ecrã: `tests/camada3-e2e/` (precisam de uma base de teste; ver `docs/testes.md`).

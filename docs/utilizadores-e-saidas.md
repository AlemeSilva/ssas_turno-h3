# Utilizadores, saídas da equipa e palavras-passe

**Estado:** levantado do código e da base a 2026-09-26, reconfirmado a 2026-09-27. Decisões do Gerente: "quem saiu não pode ser contabilizado como ativo em nenhuma funcionalidade" e "ao desativar apaga-se só o que estava marcado a partir da data" (2026-09-25, migrações 0055 a 0060); varrimento das verificações de "ativo" (2026-09-20, migrações 0053, 0054); um só Gerente titular (2026-09-05, migração 0042); turno fixo e elegibilidade a H2 como atributos (2026-08-12 e 2026-08-27, migrações 0029 e 0035).
**Ler quando:** registar, desativar, reativar ou agendar a saída de alguém; repor ou alterar palavras-passe; criar qualquer lista, regra, validação ou alarme que envolva pessoas (a regra USR-01 é a que mais se esquece); mexer nos perfis.

## 1. Perfis

| Perfil | Papel | Turno | Vê os ecrãs do Gerente |
| --- | --- | --- | --- |
| `GERENTE` | O titular. Um só ativo. Não roda turnos; tem uma linha H4 gerada automaticamente no preenchimento anual de novembro (não na reativação — ver USR-10) | H4 (fixo) | sim |
| `OPERADOR_H3` | Roda entre H3, H2 e H4; pode propor trocas; pode ter limite mensal de H3 e ser elegível a H2 | rotação | não |
| `OPERADOR` | Turno fixo H1 ou H4 | H1 ou H4 | não |

Uma pessoa com uma **delegação** em vigor ganha os poderes de Gerente sem mudar de perfil (`docs/trocas-e-delegacao.md`).

## 2. Interface (página "Gestão de Utilizadores")

Só o Gerente e o delegado a veem ("Esta área é reservada ao Gerente." para os outros).

- **Tabela** com uma linha por utilizador (também os inativos): Nome, Email, **Perfil**, Empresa, **Estado** e as ações.
  - **Perfil:** para um `OPERADOR`, o rótulo com um seletor do **turno fixo** (H1/H4; balão "Turno fixo — só muda a partir da próxima composição automática, não afeta a escala já gerada"); para um `OPERADOR_H3`, um seletor **"H2: sim / H2: não"** (balão "Elegível para H2 na rotação automática — só afeta composições futuras, não a escala já gerada").
  - **Estado:** **Ativo** ou **Desativado**; para um ativo com saída agendada, **"Sai em DD/MM/AAAA"** (balão "Desativação automática agendada — corre todos os dias às 01h00"); para um desativado com data, **"Saiu em DD/MM/AAAA · N anos e M meses"** (balão "Tempo de permanência na equipa, desde o registo até à saída").
  - **Ações:** um ícone de chave, **Repor password**; **Desativar** (para um ativo) ou **Reativar** (para um desativado); **Agendar saída** ou **Cancelar saída**. Um delegado **não** tem ações nem seletores sobre contas `GERENTE` (aparece "—").
- **Registar utilizador** (botão no topo): diálogo "Cria a conta de acesso e o perfil, num só passo." com Nome, Email, **Password inicial** (mínimo 6 caracteres), Empresa (por omissão "Accenture") e Perfil (Operador, Operador H3, e Gerente **só para o titular**). Conforme o perfil: para `OPERADOR_H3`, "Limite de H3 por mês (opcional)" e "Elegível para H2 na rotação automática?" (Não/Sim); para `OPERADOR`, **Turno fixo** (H1 — 07h00 às 16h00, H4 — 09h00 às 18h00; obrigatório: "Escolhe o turno fixo (H1 ou H4) deste Operador.").
- **Repor password:** "NOME — define uma nova password. Indica-a a esta pessoa por outro canal (não fica visível depois de fechar)." Campo "Nova password" (mínimo 6).
- **Agendar saída:** "NOME — a partir desta data, a conta é desativada automaticamente (corre todos os dias às 01h00), sem precisares de voltar cá nesse dia. A escala futura desta pessoa é removida no momento da desativação." Campo "Data de saída", a partir de amanhã.

## 3. Regras

### 3.1 Quem saiu não conta (a regra mais importante)

- **USR-01** **Quem saiu da equipa (`ativo = false`) não pode ser contabilizado como ativo em nenhuma funcionalidade.** Em tudo o que olha para o futuro (listas para escolher, relatórios, validações, alarmes, regras de escala e de sobreposição) só entra equipa **ativa**; o histórico mantém-se e consulta-se, com "(inativo)". Ao criar qualquer lista, regra, validação ou alarme novo que envolva pessoas, filtrar por `ativo` é obrigatório. Onde a regra está hoje imposta:

| Onde | Como |
| --- | --- |
| Base | `is_gerente_ou_delegado()` (titular ativo; delegado ativo), `operador_do_ciclo()` (só H3 ativo), `trg_valida_turno_h3`, `trg_valida_um_h3_por_semana` (um H3 já desativado não conta), `trg_valida_troca`, `trg_valida_ferias` e `trg_valida_delegacao` (períodos e delegações de inativos não bloqueiam), vista `feriados_sem_plantao` |
| Função do servidor | `sugerir-escala` só lê utilizadores ativos |
| Ecrãs | Escala do Mês, painéis de férias, trocas e delegação, Início (ausências, plantão, listas de férias), relatório semanal, headcount (equipa atual), alarme "H3 por atribuir"; o Histórico mostra "(inativo)" |
| Acesso | `RequireAuth` bloqueia uma sessão de uma conta inativa ("Esta conta foi desativada. Contacte o Gerente.") |

### 3.2 Perfis e registo

- **USR-02** Só se cria um utilizador pela função `gerir-utilizadores`, chamada pelo Gerente ou delegado. **Só o Gerente titular** cria contas `GERENTE`. A conta de acesso (email já confirmado) e o perfil criam-se num só passo; se o perfil falhar, a conta de acesso é removida (se essa limpeza falhar, fica registado `UTILIZADOR_FANTASMA`, a exigir remoção manual). Fica registado `UTILIZADOR_CRIADO`. O email é único.
- **USR-03** **Só pode haver um `GERENTE` ativo** (índice único `ux_usuarios_gerente_titular_unico`). Para passar o testemunho, desativa-se o titular antes de ativar o novo.
- **USR-04** Um `OPERADOR` tem de ter **turno fixo** H1 ou H4 (obrigatório ao registar); só um `OPERADOR` pode ter `turno_fixo`; só um `OPERADOR_H3` pode ser `elegivel_h2` (restrições da base). O **limite mensal de H3** define-se **só ao registar**; não há ecrã para o alterar depois.
- **USR-05** **Alterar o turno fixo ou a elegibilidade a H2** só vale para composições futuras (reativação, preenchimento anual); não muda a escala já gerada.

### 3.3 Saída e desativação

- **USR-06** Há três formas de sair: **Desativar** (imediato), **Agendar saída** (uma data futura) e o **corte automático**. A data de saída de um utilizador ativo tem de ser **hoje ou depois** (restrição da base; o ecrã só oferece a partir de amanhã). Ao "Desativar" sem data prévia, a base regista a data de saída de hoje.
- **USR-07** **Desativação automática por data de saída** (regra do Gerente): quem tem `data_saida` **até hoje** e ainda está ativo deve ficar desativado sem intervenção de ninguém. A função `desactivar-saidos` faz isto quando corre: desativa essas contas (data de execução em UTC: quem tem saída a 10/10 ficaria desativado nas primeiras horas de 10/10), regista `DESATIVACAO_AUTOMATICA` por pessoa e termina as sessões abertas; foi desenhada para correr todos os dias às 01:00 UTC. **Hoje nada a agenda** (`docs/edge-functions.md`, EDG-06, verificado a 2026-09-27): uma saída agendada só se cumpre se alguém carregar em **Desativar** (ou chamar a função à mão).
- **USR-08** **Ao desativar** (por qualquer caminho, em `usuarios.ativo` de verdadeiro para falso) a base apaga, **de hoje em diante** (data de Lisboa), o que a pessoa tinha marcado, mantendo o histórico anterior:
  - as linhas de **escala** com `semana_ref` de hoje em diante;
  - as **férias** (pendentes e aprovadas) que **começam** de hoje em diante (e as decisões de substituto que as acompanham); as que **atravessam** hoje ficam cortadas até ao dia anterior;
  - as semanas em que era **substituto** de outra pessoa;
  - os **plantões** de feriado de hoje em diante;
  - as **delegações** que começam de hoje em diante (as que já tenham sido usadas, referidas em auditoria, não se apagam) e corta as que atravessam hoje;
  - as **trocas por decidir** (propostas) em que participa, de hoje em diante.

  Fica um registo `LIMPEZA_DADOS_FUTUROS` com a contagem, se algo foi removido. **A semana em curso mantém a linha da pessoa** (começa antes de hoje); essa linha deixa de contar (USR-01), e se era o H3, aparece o aviso "H3 por atribuir". O trigger `trg_usuarios_desativado_limpa_futuro` só corre a função de limpeza, que é exclusiva do servidor (não a executa o browser).
- **USR-09** **Desativar termina as sessões abertas** da pessoa (`revogar_sessoes_utilizador`, exclusiva do servidor). Um delegado **não** pode desativar o Gerente titular.
- **USR-10** **Reativar** põe a pessoa ativa e **limpa `data_saida`** (senão o corte automático desfaria a reativação no dia seguinte). **Não repõe** o que foi apagado ao desativar. Para um `OPERADOR` com turno fixo compõe logo a escala dele (do primeiro sábado a partir de amanhã até 31 de dezembro; e, em novembro ou dezembro, também o ano seguinte inteiro). Para `OPERADOR_H3` e `GERENTE` **não** compõe nada. Se a composição falhar, mostra "Reativado, mas falhou compor a escala: …".
- **USR-11** **Cancelar saída** limpa a data agendada, por isso a desativação por data (USR-07) deixa de se aplicar a esta conta.

### 3.4 Palavras-passe

- **USR-12** **Repor a palavra-passe de outra pessoa:** Gerente ou delegado, mínimo 6 caracteres; a nova palavra-passe comunica-se à pessoa por outro canal e não fica visível depois. Um delegado **não** repõe a do Gerente titular. Fica registado `PASSWORD_REPOSTA`.
- **USR-13** **Alterar a própria palavra-passe** (botão **Alterar Senha**, no topo, qualquer utilizador): mínimo 6 caracteres, com confirmação; ao alterar, **termina as sessões noutros dispositivos** (a atual mantém-se) e regista `PASSWORD_ALTERADA_PROPRIA`. Se as outras sessões não puderem terminar, avisa "Senha alterada, mas não foi possível terminar as outras sessões: …".
- **USR-14** Não há registo público nem recuperação por email na aplicação: as contas são criadas e repostas pelo Gerente. O ecrã de entrada diz "Credenciais inválidas ou conta inexistente. Contacte o Gerente para provisionamento de acesso.".

## 4. Limites e lacunas conhecidos

- Não há ecrã para alterar o nome, o email, a empresa, o perfil nem o limite mensal de H3 de um utilizador depois de registado.
- **A desativação automática por data não está agendada** (USR-07, `docs/edge-functions.md` EDG-06): "Agendar saída" só grava a data, e os textos do ecrã ("corre todos os dias às 01h00") prometem o que hoje não acontece. Quem sai tem de ser desativado à mão.
- O comentário de `RequireAuth.tsx` diz que o corte é "a partir do dia seguinte à data_saida"; a função, quando corre, desativa **no próprio dia** da data de saída.
- A palavra-passe mínima de 6 caracteres é a do ecrã; a regra final é a do serviço de autenticação.

## 5. Código e testes

- Ecrã: `src/pages/UtilizadoresPage.tsx`, `src/layout/AlterarSenhaDialog.tsx`, `src/auth/` (`AuthContext`, `RequireAuth`, `Login`), `src/lib/composicaoEscala.ts`, `src/lib/usuarios.ts`.
- Servidor: `supabase/functions/gerir-utilizadores/` (`criar`, `reset_password`, `desativar`), `supabase/functions/desactivar-saidos/`; funções `limpar_dados_futuros_de_utilizador`, `revogar_sessoes_utilizador`; trigger `trg_usuarios_desativado_limpa_futuro`.
- Testes: `supabase/tests/19_gerente_titular_unico.sql`, `23_ferias_sobreposicao_ignora_inativos.sql`, `24_inativos_deixam_de_contar_em_regras.sql`, `25_desativar_apaga_dados_futuros.sql`, `26_revogar_sessoes_so_service_role.sql`, `27_feriados_sem_plantao_ignora_inativos.sql`; `tests/camada2-regras/usuarios.test.ts`, `composicaoEscala.test.ts`.

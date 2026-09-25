-- =====================================================================
-- Aplica a limpeza da 0057 a quem já estava desativado antes de ela
-- existir: para cada um, apaga o que ficou marcado a partir da data de
-- saída (ou de hoje, se nunca teve data de saída), e só isso — o
-- histórico anterior fica. À data desta migração é só o Pedro (data de
-- saída 2026-08-21): as férias aprovadas de 28/09-02/10, 06-09/10 e
-- 21-24/12, e a linha da escala de 22/08.
--
-- Separada da 0057 de propósito: a 0057 é a regra daqui para a frente;
-- esta apaga dados que já lá estão. Cada apagamento fica registado em
-- logs_auditoria (LIMPEZA_DADOS_FUTUROS).
-- =====================================================================

select limpar_dados_futuros_de_utilizador(id, coalesce(data_saida, (now() at time zone 'Europe/Lisbon')::date))
  from usuarios
 where ativo = false;

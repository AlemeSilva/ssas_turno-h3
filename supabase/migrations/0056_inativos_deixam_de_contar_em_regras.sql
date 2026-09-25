-- =====================================================================
-- Quem sai da equipa (ativo = false) deixa de contar como ativo em
-- qualquer regra da base de dados. Continuação da 0053/0054/0055 —
-- mesma auditoria de 2026-09-25, depois de as férias aprovadas do Pedro
-- (desligado a 21/08) continuarem a aparecer no relatório semanal e a
-- bloquear pedidos de colegas: procura, regra a regra, de tudo o que
-- CONTA pessoas ou lhes dá direitos sem cruzar com ativo.
--
-- Quatro regras ainda contavam quem já saiu:
--
-- 1) trg_valida_delegacao(): a sobreposição entre delegações olhava só
--    para as datas. Uma delegação a alguém que entretanto saiu não dá
--    poder nenhum (is_gerente_ou_delegado() exige o delegado ativo,
--    0053), mas continuava a ocupar a janela e a recusar qualquer nova
--    delegação nesse período — e a app não tem forma de revogar. Passa a
--    contar só delegações cujo delegado está ativo.
--
-- 2) operador_do_ciclo(): devolvia o H3 da semana sem olhar para o
--    estado dele, e é dele que is_operador_do_ciclo() / pode_editar_plano()
--    tiram o direito de editar o plano e a checklist do ciclo. Um H3
--    desativado a meio do ciclo (a linha da semana em curso não é
--    apagada, só as futuras) continuava a ter esse direito. Passa a
--    devolver só um H3 ativo.
--
-- 3) escala_diaria_gerente_all (escala_semanal): política antiga, de
--    antes de is_gerente_ou_delegado(), que dava escrita total a
--    qualquer utilizador com perfil GERENTE, sem ativo. Um Gerente
--    desativado (ex.: o anterior titular, depois de substituído) ficava
--    com poder de gravar a escala com um token ainda válido. A
--    escala_write_gerente já cobre o Gerente ativo e os delegados, por
--    isso basta apertar esta com ativo = true — nada muda para quem está
--    ativo.
--
-- 4) trg_valida_um_h3_por_semana(): "máximo 1 H3 por semana" contava
--    também a linha de quem já saiu. Desativar alguém só apaga a escala
--    futura, não a da semana em curso, por isso um H3 que saísse a meio
--    da semana continuava a ocupar o lugar de H3 dessa semana — e a base
--    recusava escalar o substituto ("Já existe um H3 registado…"), sem que
--    a app mostrasse nem permitisse remover a linha de quem já saiu (a
--    grelha só lista a equipa ativa). Passa a contar só H3 ativos: o H3
--    que saiu deixa de ser "o H3 da semana" e o Gerente escala outro
--    OPERADOR_H3 ativo (trg_valida_turno_h3 continua a exigir perfil
--    OPERADOR_H3 e ativo). A linha de quem saiu fica como histórico da
--    semana, só que já não conta. O que assume um único H3 por semana
--    (operador_do_ciclo(), acima) devolve sempre o ativo.
-- =====================================================================

create or replace function trg_valida_delegacao() returns trigger as $$
begin
    if exists (
        select 1 from delegacoes_aprovacao d
        join usuarios u on u.id = d.substituto
        where d.id <> coalesce(new.id, -1)
          and u.ativo = true
          and daterange(d.data_inicio, d.data_fim, '[]') && daterange(new.data_inicio, new.data_fim, '[]')
    ) then
        raise exception 'Já existe uma delegação de aprovação ativa nesse período.';
    end if;
    return new;
end;
$$ language plpgsql;

create or replace function operador_do_ciclo(p_data_inicio_ciclo date) returns uuid as $$
    select e.usuario_id
      from escala_semanal e
      join usuarios u on u.id = e.usuario_id
     where e.semana_ref = p_data_inicio_ciclo + 2
       and e.turno = 'H3'
       and u.ativo = true
     limit 1;
$$ language sql stable;

alter policy escala_diaria_gerente_all on escala_semanal
    using (exists (select 1 from usuarios where id = auth.uid() and perfil = 'GERENTE' and ativo = true))
    with check (exists (select 1 from usuarios where id = auth.uid() and perfil = 'GERENTE' and ativo = true));

create or replace function trg_valida_um_h3_por_semana() returns trigger as $$
begin
    if new.turno = 'H3' then
        if exists (
            select 1 from escala_semanal e
            join usuarios u on u.id = e.usuario_id
            where e.semana_ref = new.semana_ref
              and e.turno = 'H3'
              and e.usuario_id <> new.usuario_id
              and u.ativo = true
        ) then
            raise exception 'Já existe um H3 registado para a semana de %. Máximo 1 H3 por semana.', new.semana_ref;
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

-- =====================================================================
-- Reconcilia a base de dados viva com o schema desenhado em 0001.
--
-- Numa sessão anterior, escala_semanal foi renomeada ad-hoc para
-- escala_diaria (coluna semana_ref -> data, status adicionado, 3
-- triggers customizados hardcoded ao Caique), sem atualizar migrations
-- nem o código do frontend — que sempre consultou escala_semanal e
-- nunca escala_diaria. Esta migração reverte a estrutura para o design
-- original e substitui os 3 triggers por versões adaptadas à semana,
-- usando o limite_h3_mensal genérico de usuarios (já previsto em 0001)
-- em vez de um UUID fixo do Caique.
--
-- Não idempotente da forma tradicional (rename table falha em re-run
-- se já tiver corrido) — assume-se execução única, já aplicada em
-- produção em 2026-07-31.
-- =====================================================================

alter table escala_diaria rename to escala_semanal;
alter table escala_semanal rename column data to semana_ref;
alter table escala_semanal drop column status;

alter table escala_semanal rename constraint escala_diaria_data_usuario_unique to escala_semanal_semana_ref_usuario_id_key;
alter index idx_escala_diaria_data rename to idx_escala_semanal_semana;
alter index idx_escala_diaria_usuario rename to idx_escala_semanal_usuario;
drop index if exists idx_escala_diaria_status;
alter index idx_escala_diaria_data_turno rename to idx_escala_semanal_semana_turno;

-- ---------------------------------------------------------------------
-- Substitui os 3 triggers ad-hoc (escala_diaria, turno='H3' por dia,
-- Caique hardcoded) por versões adaptadas à semana.
-- ---------------------------------------------------------------------
drop trigger if exists trg_escala_diaria_valida_caique_max_h3 on escala_semanal;
drop trigger if exists trg_escala_diaria_valida_ferias_h3 on escala_semanal;
drop trigger if exists trg_escala_diaria_valida_um_h3 on escala_semanal;
drop function if exists trg_valida_caique_max_h3_mes();
drop function if exists trg_valida_ferias_sobre_h3();
drop function if exists trg_valida_um_h3_por_dia();

-- Limite mensal de H3 genérico — usa usuarios.limite_h3_mensal (NULL = sem trava)
create or replace function trg_valida_limite_h3_mensal() returns trigger as $$
declare
    v_limite int;
    v_count int;
begin
    if new.turno = 'H3' then
        select limite_h3_mensal into v_limite from usuarios where id = new.usuario_id;
        if v_limite is not null then
            select count(*) into v_count from escala_semanal
            where usuario_id = new.usuario_id
              and turno = 'H3'
              and id <> coalesce(new.id, -1)
              and extract(month from semana_ref) = extract(month from new.semana_ref)
              and extract(year from semana_ref) = extract(year from new.semana_ref);
            if v_count >= v_limite then
                raise exception 'Utilizador já atingiu o limite de % H3/mês em %/%.', v_limite,
                    extract(month from new.semana_ref), extract(year from new.semana_ref);
            end if;
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

create or replace trigger trg_escala_semanal_valida_limite_h3_mensal
before insert or update on escala_semanal
for each row execute function trg_valida_limite_h3_mensal();

-- Máx 1 H3 por semana (nenhuma equivalente existia em 0001)
create or replace function trg_valida_um_h3_por_semana() returns trigger as $$
begin
    if new.turno = 'H3' then
        if exists (
            select 1 from escala_semanal
            where semana_ref = new.semana_ref and turno = 'H3' and usuario_id <> new.usuario_id
        ) then
            raise exception 'Já existe um H3 registado para a semana de %. Máximo 1 H3 por semana.', new.semana_ref;
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

create or replace trigger trg_escala_semanal_valida_um_h3
before insert or update on escala_semanal
for each row execute function trg_valida_um_h3_por_semana();

-- Não atribuir turno a quem já tem férias/licença aprovadas nesse período
-- (a versão antiga verificava o inverso, e só dentro de escala_diaria)
create or replace function trg_valida_escala_sobre_ferias() returns trigger as $$
begin
    if exists (
        select 1 from ferias f
        where f.usuario_id = new.usuario_id
          and f.status = 'APROVADA'
          and daterange(f.data_inicio, f.data_fim, '[]') && daterange(new.semana_ref, new.semana_ref + 6, '[]')
    ) then
        raise exception 'Não é possível atribuir turno: operador tem férias/licença aprovadas nesse período.';
    end if;
    return new;
end;
$$ language plpgsql;

create or replace trigger trg_escala_semanal_valida_ferias
before insert or update on escala_semanal
for each row execute function trg_valida_escala_sobre_ferias();

-- Caique: confirmado nesta sessão como máx 1 H3/mês (os outros dois
-- operadores H3 mantêm o valor genérico de 3, nunca atingido na prática).
update usuarios set limite_h3_mensal = 1 where id = '8d7dcdb7-17c1-413b-a7fa-28d151fe5250';

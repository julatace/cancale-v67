-- 033 — Les points de restauration « Revenir en arrière » (11 novembre 2026).
-- ÉCRITE, PAS APPLIQUÉE (geste de Julien : l'appliquer quand VRM est peu sollicité).
-- Récit : docs/passation/2026-11-11-restauration.md · règle : src/restauration.js.
--
-- L'app range chaque point dans une ligne DÉDIÉE de `app_data`, sous SON
-- propriétaire : `restore_0` … `restore_23` (24 emplacements par compte, un point
-- neuf reprend un emplacement vide, expiré — 30 jours — ou le plus ancien). Ni la
-- ligne `main`, ni une autre table ; la liste se lit par la colonne `meta` (004).
--
-- Ce que cette migration AJOUTE (rien d'autre, aucune donnée touchée) : la base
-- tient elle-même le quota, sans dépendre de ce que fait un navigateur :
--   · un id `restore_…` hors des 24 emplacements est refusé (`vrm_point_emplacement`) ;
--   · un point de plus de 1,1 Mo est refusé (`vrm_point_trop_gros`).
-- Sans elle, l'app tient déjà ces deux bornes (scripts/audit-restauration.cjs, G) ;
-- avec elle, un appareil ancien ou abîmé ne peut pas les dépasser.
-- Retour arrière : `drop trigger vrm_garde_points on public.app_data;
--                   drop function public.vrm_garde_points();`

create or replace function public.vrm_garde_points()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  n int;
begin
  if new.id is null or left(new.id, 8) <> 'restore_' then return new; end if;
  if new.id !~ '^restore_[0-9]{1,2}$' then
    raise exception using errcode = 'P0001', message = 'vrm_point_emplacement', detail = 'emplacement de point invalide : ' || new.id;
  end if;
  n := substr(new.id, 9)::int;
  if n < 0 or n >= 24 then
    raise exception using errcode = 'P0001', message = 'vrm_point_emplacement', detail = 'au plus 24 points par compte (restore_0 … restore_23)';
  end if;
  if octet_length(coalesce(new.data, '{}'::jsonb)::text) > 1100000 then
    raise exception using errcode = 'P0001', message = 'vrm_point_trop_gros', detail = 'un point de restauration pèse au plus 1,1 Mo';
  end if;
  return new;
end;
$$;

revoke all on function public.vrm_garde_points() from public, anon, authenticated;

drop trigger if exists vrm_garde_points on public.app_data;
create trigger vrm_garde_points before insert or update of data, id on public.app_data
  for each row execute function public.vrm_garde_points();

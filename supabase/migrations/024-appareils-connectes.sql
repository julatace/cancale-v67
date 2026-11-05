-- ═══════════════════════════════════════════════════════════════════════════
-- 024 — APPAREILS CONNECTÉS (4 nov. 2026)
-- Paramètres → Mon compte → « Appareils connectés » : la liste des navigateurs
-- connectés au VRM du vendeur, avec la dernière activité, et « Déconnecter »
-- par appareil.
--
-- Supabase ne montre pas `auth.sessions` au navigateur (le schéma `auth` n'est
-- pas exposé). Deux fonctions, appelables par la CLÉ DE SERVICE SEULE (la route
-- `/api/compte?mode=appareils` les appelle avec l'identifiant tiré du jeton
-- vérifié par Supabase — jamais un identifiant envoyé par le navigateur) :
--   · vrm_sessions_de(p_user)          : SES sessions, sans l'adresse IP ;
--   · vrm_fermer_session(p_user, p_id) : ferme UNE de SES sessions (le jeton de
--     renouvellement part avec elle, `ON DELETE CASCADE`) ; une session d'un
--     autre utilisateur ⇒ 0 ligne, rien n'est touché.
-- Aucune donnée n'est écrite par cette migration. Réversible :
--   drop function public.vrm_sessions_de(uuid);
--   drop function public.vrm_fermer_session(uuid, uuid);
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.vrm_sessions_de(p_user uuid)
returns table (id uuid, cree_le timestamptz, actif_le timestamptz, user_agent text, aal text)
language sql
security definer
set search_path = ''
stable
as $$
  select s.id,
         s.created_at,
         greatest(s.created_at, s.updated_at, s.refreshed_at::timestamptz),
         left(s.user_agent, 400),
         s.aal::text
    from auth.sessions s
   where s.user_id = p_user
     and p_user is not null
     and (s.not_after is null or s.not_after > now())
   order by 3 desc nulls last
   limit 50;
$$;

create or replace function public.vrm_fermer_session(p_user uuid, p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  if p_user is null or p_id is null then return 0; end if;
  delete from auth.sessions s where s.id = p_id and s.user_id = p_user;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.vrm_sessions_de(uuid) from public, anon, authenticated;
revoke all on function public.vrm_fermer_session(uuid, uuid) from public, anon, authenticated;
grant execute on function public.vrm_sessions_de(uuid) to service_role;
grant execute on function public.vrm_fermer_session(uuid, uuid) to service_role;

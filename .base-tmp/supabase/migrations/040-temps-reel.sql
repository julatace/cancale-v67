-- ════════════════════════════════════════════════════════════════════════════
--  040 — CE QUE L'EXTENSION CAPTE ARRIVE DANS VRM SANS RECHARGER (11 nov. 2026)
--  Branche `claude/agent2-temps-reel` · src/tempsReel.js · récit
--  docs/passation/2026-11-11-temps-reel.md. GESTE DE JULIEN (pas appliquée).
-- ════════════════════════════════════════════════════════════════════════════
--  Sans cette migration, l'app sonde les VERSIONS des lignes du vendeur toutes
--  les 25 s (onglet visible) : tout marche déjà, avec ≤ 25 s de retard.
--  Avec elle, l'app est PRÉVENUE dans la seconde (Supabase Realtime, diffusion
--  privée) et le sondage ralentit à 2 min (il reste en filet).
--
--  Pourquoi PAS « ajouter app_data à la publication supabase_realtime » :
--  `postgres_changes` enverrait la LIGNE ENTIÈRE (colonne `data` : jusqu'à
--  plusieurs Mo, PDF de bordereau compris) à chaque écriture — l'inverse du §4.4.
--  Ici, un déclencheur n'envoie que l'`id` et la VERSION (scalaires de `meta`,
--  la même que `SEL_VERSION` du lot K), sur le sujet privé `vrm-lignes:<owner>`.
--
--  Garde-fous :
--   · une erreur de diffusion n'empêche JAMAIS l'écriture (bloc `exception`) ;
--   · rien n'est envoyé pour une ligne sans propriétaire ;
--   · la règle de `realtime.messages` ne laisse un connecté recevoir QUE son
--     sujet (`vrm-lignes:` || son uid) ; l'app vérifie en plus `owner` ;
--   · aucun droit d'écriture donné sur `realtime.messages` (personne ne peut
--     diffuser au nom de la base).
--  Annuler : voir le bas du fichier.
-- ════════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '3s';

create or replace function public.vrm_signal_ligne() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.owner is null then return null; end if;
  begin
    perform realtime.send(
      jsonb_build_object(
        'id', new.id,
        'owner', new.owner::text,
        'updated_at', new.updated_at,
        'cap', new.meta->>'capturedAt',
        'rev', new.meta->>'rev',
        'sup', new.meta->>'supprime',
        'pg', new.meta->>'purgedAt'),
      'ligne',
      'vrm-lignes:' || new.owner::text,
      true);
  exception when others then
    null;   -- la diffusion est un confort : l'écriture passe toujours
  end;
  return null;
end $$;
revoke all on function public.vrm_signal_ligne() from public, anon, authenticated;

drop trigger if exists vrm_signal_ligne on public.app_data;
create trigger vrm_signal_ligne after insert or update on public.app_data
  for each row execute function public.vrm_signal_ligne();

drop policy if exists vrm_lignes_recevoir on realtime.messages;
create policy vrm_lignes_recevoir on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast'
         and (select realtime.topic()) = 'vrm-lignes:' || (select auth.uid())::text);

-- L'app ne tente la connexion Realtime QUE si cette fonction répond `true` (une lecture
-- GET, à l'ouverture) : avant la migration, et dans les bancs, aucune prise n'est ouverte.
create or replace function public.vrm_temps_reel() returns boolean
language sql stable set search_path = '' as $$ select true $$;
revoke all on function public.vrm_temps_reel() from public, anon;
grant execute on function public.vrm_temps_reel() to authenticated;

commit;

-- ── Annuler (si besoin) ──────────────────────────────────────────────────────
-- begin;
-- drop trigger if exists vrm_signal_ligne on public.app_data;
-- drop function if exists public.vrm_signal_ligne();
-- drop policy if exists vrm_lignes_recevoir on realtime.messages;
-- drop function if exists public.vrm_temps_reel();
-- commit;

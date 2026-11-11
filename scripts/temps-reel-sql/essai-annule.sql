-- ESSAI ANNULÉ de la migration 040 (temps réel) : tout se fait dans une transaction ANNULÉE.
-- Aucune donnée de vendeur lue ni écrite. Coller d'un bloc dans l'éditeur SQL de Supabase
-- (jamais pas à pas : le déclencheur prend un verrou court sur app_data, lock_timeout 3 s).
-- Attendu : une ligne `essai` = {"trig":1,"pol":1,"msg":1}, puis trig_reste = 0 et pol_reste = 0.
-- Le corps est celui de supabase/migrations/040-temps-reel.sql (vérifié par scripts/audit-temps-reel.cjs).
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

select realtime.send('{"id":"essai"}'::jsonb, 'ligne', 'vrm-lignes:essai-annule', true);
select json_build_object(
  'trig', (select count(*) from pg_trigger where tgname = 'vrm_signal_ligne' and tgrelid = 'public.app_data'::regclass),
  'pol',  (select count(*) from pg_policy where polname = 'vrm_lignes_recevoir'),
  'msg',  (select count(*) from realtime.messages where topic = 'vrm-lignes:essai-annule')) as essai;
rollback;

select (select count(*) from pg_trigger where tgname = 'vrm_signal_ligne') as trig_reste,
       (select count(*) from pg_policy where polname = 'vrm_lignes_recevoir') as pol_reste;

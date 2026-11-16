-- ════════════════════════════════════════════════════════════════════════════
--  044 — RETIRER LE PDF D'UN BORDEREAU SANS RELIRE NI RÉÉCRIRE SA LIGNE
--        (15 nov. 2026) — PAS ENCORE APPLIQUÉE (geste de Julien).
--  Récit : docs/passation/2026-11-15-purge-bordereaux.md.
-- ════════════════════════════════════════════════════════════════════════════
--  Décision de Julien (15 nov.) : « Tu supprimes les bordereaux lorsque la vente
--  est finalisée et que on a reçu l'argent. » La RÈGLE est côté serveur
--  (api/_lib/purge-bordereaux.js, cron du matin) ; cette fonction n'est que
--  l'ÉCRITURE, bornée :
--    · une seule ligne (owner, id), et seulement un id de bordereau de VENTE :
--      `email_bord_{tx}`, `harvest_{uid}_label_{tx|latest}`, `vc_label_{produit}`
--      (jamais `email_bordretour_*`, jamais une autre famille) ;
--    · le changement ne peut QUE mettre à null `pdfB64` / `pdfTamponneB64` / `b64`
--      et poser `pdfPurged` (vrai), `pdfPurgedAt`, `pdfPurgeRaison` (textes courts) :
--      toute autre clé ⇒ refus, rien écrit ;
--    · `data || patch` DANS la base : les autres champs (n° de suivi, transporteur,
--      date limite, filename, tx, item…) ne quittent jamais la base et restent
--      tels quels — ni `select=data` (§4.4), ni ligne entière renvoyée ;
--    · seulement si la ligne porte ENCORE un PDF dans un des champs retirés, et
--      si elle porte l'identité attendue (`data @> p_attendu`, ex. sa transaction) ;
--    · rend la taille avant / après (le journal de la purge).
--  Sans cette migration, le serveur reçoit 404 (PGRST202) et n'écrit RIEN.
--  SECURITY INVOKER + exécutable par la seule clé de service (le cron).
--  Annuler : drop function public.vrm_bordereau_retirer_pdf(uuid, text, jsonb, jsonb);
-- ════════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '3s';

create or replace function public.vrm_bordereau_retirer_pdf(p_owner uuid, p_id text, p_patch jsonb, p_attendu jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  k text;
  v_pdf text[] := '{}';
  v_avant integer;
  v_apres integer;
begin
  if p_owner is null or p_id is null
     or p_id !~ '^(email_bord_[0-9]{6,20}|harvest_[0-9]{1,20}_label_([0-9]{6,20}|latest)|vc_label_[0-9A-Za-z_-]{1,64})$' then
    return jsonb_build_object('etat', 'refus', 'raison', 'identifiant');
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object'
     or jsonb_typeof(coalesce(p_attendu, '{}'::jsonb)) <> 'object' then
    return jsonb_build_object('etat', 'refus', 'raison', 'forme');
  end if;
  for k in select jsonb_object_keys(p_patch) loop
    if k in ('pdfB64', 'pdfTamponneB64', 'b64') then
      if p_patch -> k <> 'null'::jsonb then return jsonb_build_object('etat', 'refus', 'raison', k); end if;
      v_pdf := v_pdf || k;
    elsif k = 'pdfPurged' then
      if p_patch -> k <> 'true'::jsonb then return jsonb_build_object('etat', 'refus', 'raison', k); end if;
    elsif k in ('pdfPurgedAt', 'pdfPurgeRaison') then
      if jsonb_typeof(p_patch -> k) <> 'string' or length(p_patch ->> k) > 40 then return jsonb_build_object('etat', 'refus', 'raison', k); end if;
    else
      return jsonb_build_object('etat', 'refus', 'raison', 'cle');
    end if;
  end loop;
  if cardinality(v_pdf) = 0 or not (p_patch ? 'pdfPurged') then
    return jsonb_build_object('etat', 'refus', 'raison', 'rien-a-retirer');
  end if;
  select pg_column_size(a.data) into v_avant
    from public.app_data a
   where a.owner = p_owner and a.id = p_id
     and a.data @> coalesce(p_attendu, '{}'::jsonb)
     and exists (select 1 from unnest(v_pdf) c where coalesce(a.data ->> c, '') not in ('', 'None'))
   for update;
  if not found then return jsonb_build_object('etat', 'rien'); end if;
  update public.app_data a
     set data = a.data || p_patch, updated_at = now()
   where a.owner = p_owner and a.id = p_id
  returning pg_column_size(a.data) into v_apres;
  return jsonb_build_object('etat', 'ok', 'avant', v_avant, 'apres', v_apres);
end $$;
revoke all on function public.vrm_bordereau_retirer_pdf(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.vrm_bordereau_retirer_pdf(uuid, text, jsonb, jsonb) to service_role;

commit;

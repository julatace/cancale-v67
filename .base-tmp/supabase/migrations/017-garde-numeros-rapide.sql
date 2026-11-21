-- 017 — Le garde-fou des numéros, rendu rapide (18 octobre 2026).
--
-- MESURÉ en production (journaux Postgres, lecture seule) : depuis la conversion
-- du 11 octobre 14:58, CHAQUE écriture de la ligne `main` par un navigateur est
-- annulée au bout de 8 s (« canceling statement due to statement timeout »,
-- 57014), dans `vrm_garde_numeros()` ligne 59 : la jointure des fiches anciennes
-- et nouvelles (`jsonb_each … join jsonb_each … on w.k2 = o.k`). Le filtre qui ne
-- dépend que du côté nouveau (`vrm_cle_num(nv -> 'numero')`) est poussé dans le
-- balayage intérieur de la boucle imbriquée : ~450 × 450 appels de `vrm_cle_num`
-- (non « inlinable » : elle fixe `search_path`). Conséquence : sa ligne `main`
-- n'est plus enregistrée depuis le 11 octobre — fiches N°25+, prix d'achat et
-- réglages ne vivent que dans ses navigateurs.
--
-- Correctif : MÊME règle, mêmes refus, mêmes messages ; chaque côté est calculé
-- UNE fois (CTE matérialisées), la clé est calculée une fois par fiche, puis
-- jointure sur l'identifiant. Seul le corps de la fonction change : ni le
-- déclencheur, ni les droits, ni une donnée. Retour arrière : réappliquer le
-- corps de la 013 (section 7).
create or replace function public.vrm_garde_numeros()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  m jsonb;
  arch text;
  coup text;
  perdus int;
  n int;
  ex text;
  carte text;
begin
  if new.id <> 'main' or current_user not in ('authenticated', 'anon') then return new; end if;
  -- Le marqueur : celui de la base, toujours.
  if old.data ? 'vrm_numerotation' then
    new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object('vrm_numerotation', old.data -> 'vrm_numerotation');
  elsif coalesce(new.data, '{}'::jsonb) ? 'vrm_numerotation' then
    new.data := new.data - 'vrm_numerotation';
  end if;
  -- Le pool ne rétrécit jamais.
  if jsonb_typeof(old.data -> 'vinted_used_numeros') = 'array' then
    select count(*), min(c) into perdus, ex from (
      select public.vrm_cle_num(e) c from jsonb_array_elements(old.data -> 'vinted_used_numeros') e
      except
      select public.vrm_cle_num(e) from jsonb_array_elements(case when jsonb_typeof(new.data -> 'vinted_used_numeros') = 'array'
                                                                  then new.data -> 'vinted_used_numeros' else '[]'::jsonb end) e) z
     where c is not null and c <> '';
    if perdus > 0 then
      raise exception using errcode = 'P0001', message = 'vrm_pool_retreci',
        detail = perdus || ' numéro(s) disparaîtrai(en)t du pool (ex. ' || ex || ') — cet appareil a une version ancienne de tes numéros',
        hint = 'Recharge l''app : elle relira tes numéros.';
    end if;
  end if;
  m := old.data -> 'vrm_numerotation';
  if m is null or coalesce((m ->> 'annule')::boolean, false) or coalesce(m ->> 'archive', '') = '' then return new; end if;
  arch := m ->> 'archive';
  -- Une saisie à la main FAITE APRÈS la conversion (pas après la date de coupure :
  -- un appareil périmé a pu saisir entre les deux) est un geste, pas une reprise.
  coup := coalesce(m ->> 'appliqueLe', m ->> 'coupure', '');

  -- Une fiche ou une vente « B230 » qui repasse à « 230 » (sauf à la main, après la coupure).
  foreach carte in array array['vinted_annonce_numeros', 'vinted_sale_overrides'] loop
    with o as materialized (
           select k, ov, public.vrm_cle_num(ov -> 'numero') c
             from jsonb_each(case when jsonb_typeof(old.data -> carte) = 'object' then old.data -> carte else '{}' end) e(k, ov)
            where jsonb_typeof(ov) = 'object'),
         w as materialized (
           select k2, nv, public.vrm_cle_num(nv -> 'numero') c
             from jsonb_each(case when jsonb_typeof(new.data -> carte) = 'object' then new.data -> carte else '{}' end) e(k2, nv)
            where jsonb_typeof(nv) = 'object')
    select count(*), min(o.k) into n, ex
      from o join w on w.k2 = o.k
     where o.c ~ ('^' || arch || '[0-9]+(\+' || arch || '[0-9]+)*$')
       and w.c ~ '^[0-9]+(\+[0-9]+)*$'
       and not (coalesce(w.nv ->> 'manuelAt', '') > coup and coalesce(w.nv ->> 'manuelAt', '') is distinct from coalesce(o.ov ->> 'manuelAt', ''));
    if n > 0 then
      raise exception using errcode = 'P0001', message = 'vrm_numeros_perimes',
        detail = n || ' ancien(s) numéro(s) « ' || arch || '… » repasserai(en)t en chiffres (' || carte || ', ex. ' || ex || ') — cet appareil a été chargé avant la remise à zéro',
        hint = 'Recharge l''app.';
    end if;
  end loop;
  -- Une fiche ou une vente devenue « 1 » qui repasserait à son numéro PROVISOIRE
  -- (« 553 », donné avant la conversion à une annonce republiée après la coupure) :
  -- `renum` du marqueur dit lequel était devenu quoi.
  if jsonb_typeof(m -> 'renum') = 'object' then
    foreach carte in array array['vinted_annonce_numeros', 'vinted_sale_overrides'] loop
      with o as materialized (
             select k, public.vrm_cle_num(ov -> 'numero') c
               from jsonb_each(case when jsonb_typeof(old.data -> carte) = 'object' then old.data -> carte else '{}' end) e(k, ov)
              where jsonb_typeof(ov) = 'object'),
           w as materialized (
             select k2, public.vrm_cle_num(nv -> 'numero') c
               from jsonb_each(case when jsonb_typeof(new.data -> carte) = 'object' then new.data -> carte else '{}' end) e(k2, nv)
              where jsonb_typeof(nv) = 'object')
      select count(*), min(o.k) into n, ex
        from o join w on w.k2 = o.k
       where (m -> 'renum') ? coalesce(w.c, '')
         and (m -> 'renum' ->> w.c) = o.c;
      if n > 0 then
        raise exception using errcode = 'P0001', message = 'vrm_numeros_perimes',
          detail = n || ' paire(s) republiée(s) reprendrai(en)t leur numéro provisoire (' || carte || ', ex. ' || ex || ') — cet appareil a été chargé avant la remise à zéro',
          hint = 'Recharge l''app.';
      end if;
    end loop;
    select count(*), min(k) into n, ex
      from jsonb_object_keys(case when jsonb_typeof(new.data -> 'vinted_buyprice_by_num') = 'object' then new.data -> 'vinted_buyprice_by_num' else '{}' end) k
     where (m -> 'renum') ? k
       and not (coalesce(old.data -> 'vinted_buyprice_by_num', '{}'::jsonb) ? k)
       and coalesce(old.data -> 'vinted_buyprice_by_num', '{}'::jsonb) ? (m -> 'renum' ->> k)
       and not (coalesce(new.data -> 'vinted_buyprice_by_num', '{}'::jsonb) ? (m -> 'renum' ->> k));
    if n > 0 then
      raise exception using errcode = 'P0001', message = 'vrm_numeros_perimes',
        detail = n || ' prix d''achat repasserai(en)t sous un numéro provisoire (ex. ' || ex || ')', hint = 'Recharge l''app.';
    end if;
  end if;
  -- Une clé « B385 » qui redevient « 385 ».
  foreach carte in array array['vinted_buyprice_by_num', 'vinted_pairs_lost'] loop
    select count(*), min(k) into n, ex
      from jsonb_object_keys(case when jsonb_typeof(old.data -> carte) = 'object' then old.data -> carte else '{}' end) k
     where public.vrm_cle_num(to_jsonb(k)) ~ ('^' || arch || '[0-9]+$')
       and not (coalesce(new.data -> carte, '{}'::jsonb) ? k)
       and exists (select 1 from jsonb_object_keys(case when jsonb_typeof(new.data -> carte) = 'object' then new.data -> carte else '{}' end) k2
                    where public.vrm_cle_num(to_jsonb(k2)) = substr(public.vrm_cle_num(to_jsonb(k)), length(arch) + 1));
    if n > 0 then
      raise exception using errcode = 'P0001', message = 'vrm_numeros_perimes',
        detail = n || ' clé(s) « ' || arch || '… » repasserai(en)t en chiffres (' || carte || ', ex. ' || ex || ') — cet appareil a été chargé avant la remise à zéro',
        hint = 'Recharge l''app.';
    end if;
  end loop;
  with o as materialized (
         select k, public.vrm_cle_num(ov) c
           from jsonb_each(case when jsonb_typeof(old.data -> 'vrm_lbc_liens') = 'object' then old.data -> 'vrm_lbc_liens' else '{}' end) e(k, ov)),
       w as materialized (
         select k2, public.vrm_cle_num(nv) c
           from jsonb_each(case when jsonb_typeof(new.data -> 'vrm_lbc_liens') = 'object' then new.data -> 'vrm_lbc_liens' else '{}' end) e(k2, nv))
  select count(*), min(o.k) into n, ex
    from o join w on w.k2 = o.k
   where o.c ~ ('^' || arch || '[0-9]+$') and w.c ~ '^[0-9]+$';
  if n > 0 then
    raise exception using errcode = 'P0001', message = 'vrm_numeros_perimes',
      detail = n || ' lien(s) Leboncoin repasserai(en)t en chiffres (ex. ' || ex || ')', hint = 'Recharge l''app.';
  end if;
  -- Une fiche numérotée qui disparaît : l'appareil ne la connaissait pas.
  select count(*), min(o.k) into n, ex
    from jsonb_each(case when jsonb_typeof(old.data -> 'vinted_annonce_numeros') = 'object' then old.data -> 'vinted_annonce_numeros' else '{}' end) o(k, ov)
   where jsonb_typeof(ov) = 'object' and coalesce(btrim(ov ->> 'numero'), '') <> ''
     and not (coalesce(new.data -> 'vinted_annonce_numeros', '{}'::jsonb) ? o.k)
     and not exists (select 1 from jsonb_each(case when jsonb_typeof(new.data -> 'vinted_annonce_numeros') = 'object' then new.data -> 'vinted_annonce_numeros' else '{}' end) w(k2, nv)
                      where jsonb_typeof(nv) = 'object' and nv ->> 'repriseDe' = o.k);
  if n > 0 then
    raise exception using errcode = 'P0001', message = 'vrm_fiche_perdue',
      detail = n || ' paire(s) numérotée(s) disparaîtrai(en)t (ex. annonce ' || ex || ') — un autre appareil les a numérotées depuis le chargement de celui-ci',
      hint = 'Recharge l''app : elle relira tes numéros.';
  end if;
  if upper(regexp_replace(coalesce(new.data ->> 'vrm_num_prefixe', ''), '[^A-Za-z]', '', 'g')) = arch then
    raise exception using errcode = 'P0001', message = 'vrm_prefixe_archive',
      detail = 'la série « ' || arch || ' » est celle de tes anciens numéros', hint = 'Choisis une autre lettre, ou des chiffres.';
  end if;
  return new;
end
$$;
revoke all on function public.vrm_garde_numeros() from public, anon, authenticated;

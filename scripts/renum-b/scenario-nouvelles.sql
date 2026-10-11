-- SCÉNARIO « IL A REPOSTÉ AVANT LA MIGRATION » (10 octobre) — DONNÉES INVENTÉES.
-- L'app, ouverte pendant qu'il republiait, a numéroté automatiquement ses
-- nouvelles annonces 553, 554, 555 — PAS dans l'ordre de mise en ligne (le
-- compte de la 553 a été capté en premier). Attendu : 554 → 1, 555 → 2, 553 → 3.
-- :'NIV' = 1 : ces trois-là seulement ; 2 : plus les cas de bord ci-dessous.
update public.app_data set data = jsonb_set(jsonb_set(data,
    '{vinted_used_numeros}', (data -> 'vinted_used_numeros') || '[553, 554, 555]'::jsonb),
    '{vinted_annonce_numeros}', (data -> 'vinted_annonce_numeros') || '{
      "8000000001": {"numero": "553", "auto": true, "title": "Nouvelle inventée A", "numberedAt": "2026-10-10T08:31:00.000Z"},
      "8000000002": {"numero": "554", "auto": true, "title": "Nouvelle inventée B", "numberedAt": "2026-10-10T08:31:00.000Z"},
      "8000000003": {"numero": "555", "auto": true, "title": "Nouvelle inventée C", "numberedAt": "2026-10-10T08:31:00.000Z"}}'::jsonb)
 where owner = :'J' and id = 'main';
-- Le dressing recapté ce matin : les trois nouvelles annonces, avec l'heure de
-- dépôt de leur photo (secondes) — B à 08:10, C à 08:20, A à 08:30.
insert into public.app_data (owner, id, data, updated_at) values (:'J', 'harvest_1002_listings', '{"capturedAt":"2026-10-10T08:35:00.000Z","payload":{"code":0,"pagination":{},"items":[
  {"id":8000000001,"title":"Nouvelle inventée A","photo":{"url":"x","high_resolution":{"timestamp":1791621000}}},
  {"id":8000000002,"title":"Nouvelle inventée B","photo":{"url":"x","high_resolution":{"timestamp":1791619800}}},
  {"id":8000000003,"title":"Nouvelle inventée C","photo":{"url":"x","high_resolution":{"timestamp":1791620400}}}]}}', now());

-- NIVEAU 2 : les cas de bord.
--  • 8000000004 : nouvelle, numérotée 556 à 09:00, AUCUNE date lisible (pas dans le
--    dressing, pas dans les dates) ⇒ jugée par `numberedAt`, et c'est dit ⇒ 5 ;
--  • 8000000005 : une paire REPRISE à la main après la coupure (♻️, repriseAt) sur
--    son ancien N°230 : en ligne à 08:40 ⇒ nouvelle ⇒ 4 ; le 230 reste B230 ;
--  • 9000000300 : ANCIENNE (numérotée en juillet) dont la photo a été redéposée
--    après la coupure ⇒ contradiction ⇒ reste ancienne (B), et c'est compté ;
--  • une vente rattachée par sa TRANSACTION à A (le 553) ⇒ suit A ⇒ 3 ;
--  • une vente SANS rattachement qui porte 554 (donné à la seule B) ⇒ suit B ⇒ 1 ;
--  • une vente rattachée par transaction à la paire reprise, qui porte « 230 » :
--    elle suit la PAIRE (→ 4), pas la valeur (sinon B230) ;
--  • un prix d'achat saisi sous « 553 » ⇒ « 3 » ;
--  • un bordereau rattaché par transaction à A ⇒ 3 ; un autre qui porte 555 ⇒ 2.
update public.app_data set data = jsonb_set(jsonb_set(jsonb_set(jsonb_set(data,
    '{vinted_used_numeros}', (data -> 'vinted_used_numeros') || '[556]'::jsonb),
    '{vinted_annonce_numeros}', (data -> 'vinted_annonce_numeros') || jsonb_build_object(
      '8000000004', '{"numero": "556", "auto": true, "title": "Nouvelle sans date", "numberedAt": "2026-10-10T09:00:00.000Z"}'::jsonb,
      '8000000005', '{"numero": "230", "auto": false, "title": "Reprise inventée", "numberedAt": "2026-08-01T10:00:00.000Z", "repriseAt": "2026-10-10T08:45:00.000Z"}'::jsonb)),
    '{vinted_sale_overrides}', (data -> 'vinted_sale_overrides') || '{
      "22000000777": {"numero": "553", "autoAssigned": false},
      "22000000778": {"numero": "554", "autoAssigned": true, "autoShip": true},
      "22000000780": {"numero": "230", "autoAssigned": false}}'::jsonb),
    '{vinted_buyprice_by_num}', (data -> 'vinted_buyprice_by_num') || '{"553": "40"}'::jsonb)
 where owner = :'J' and id = 'main' and :NIV >= 2;
update public.app_data set data = jsonb_set(data, '{payload,items}', (data -> 'payload' -> 'items') || '[
  {"id":8000000005,"title":"Reprise inventée","photo":{"url":"x","high_resolution":{"timestamp":1791621600}}},
  {"id":9000000300,"title":"Paire inventée 300","photo":{"url":"x","high_resolution":{"timestamp":1791622000}}}]'::jsonb)
 where owner = :'J' and id = 'harvest_1002_listings' and :NIV >= 2;
insert into public.app_data (owner, id, data, updated_at)
select :'J', x.id, x.d::jsonb, now() from (values
  ('harvest_1002_txn_22000000777', '{"payload":{"transaction":{"id":22000000777,"item_id":8000000001,"status":200,"status_title":"Le paiement a été validé"}}}'),
  ('harvest_1002_txn_22000000780', '{"payload":{"transaction":{"id":22000000780,"item_id":8000000005,"status":200,"status_title":"Le paiement a été validé"}}}')) x(id, d)
 where :NIV >= 2;
insert into public.app_data (owner, id, data, updated_at)
select :'J', x.id, x.d::jsonb, now() from (values
  ('email_bord_22000000777', '{"numero":"553","transaction":"22000000777","receivedAt":"2026-10-10T09:10:00.000Z","filename":"n.pdf","pdfB64":"JVBERi0xLjQKnew"}'),
  ('email_bord_22000000779', '{"numero":"555","transaction":"22000000779","receivedAt":"2026-10-10T09:12:00.000Z","filename":"m.pdf","pdfB64":"JVBERi0xLjQKnew2"}')) x(id, d)
 where :NIV >= 2;

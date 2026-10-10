-- DONNÉES INVENTÉES pour l'audit de la migration 013 (scripts/audit-renum-b.cjs).
-- Aucune donnée réelle : des titres « Paire inventée N », des identifiants
-- fabriqués. Seule la FORME est celle de la vraie base, mesurée en lecture seule
-- le 9 et le 10 octobre 2026 :
--   pool 552 ENTIERS JSON 1…552 · 401 fiches (`numero` chaîne, 13 numéros portés
--   deux fois, max 540, 384 `auto`, 8 `buyPrice`, 4 `mp`, 17 `repriseAt`) ·
--   500 ventes surchargées (`numero` chaîne, 132 `autoAssigned`+`autoShip`, 2 clés
--   « mail:… ») · `vinted_stock_vinted` "1"…"1815" (l'ANCIEN catalogue) ·
--   `vinted_buyprice_by_num` {"385"} · `vinted_pairs_lost` 26 clés 23…540 ·
--   `vrm_lbc_liens` 3 valeurs · `vrm_room` : une pile de 26 (le 143 deux fois,
--   start 116) + 3 cases · 118 `email_bord_*` numérotés + 63 vides · 1
--   `email_sale_*` « 99001 » et 1 `email_final_*` « 2079 » (lus dans un TITRE,
--   absents du pool) · `email_journal` (3 numéros, rien ne le relit) ·
--   `lbc_listings` 1 `ref` « 266 » + des annonces qui ne sont pas à lui ·
--   `vrm_local` sans repère · `ebay_brouillons` absente.
-- Et, pour couvrir des formes que sa base n'a PAS aujourd'hui mais qui peuvent
-- apparaître d'ici la coupure : une entrée déjà à lettres (C3), un lot
-- « 40+41 », un lien de bordereau, un achat hors Vinted, une case du garage 2D,
-- un pointage du stock, une pile sans liste (numérotée depuis `start`), une
-- boîte seule, un repère de « Mon local », un brouillon eBay, un SKU eBay.
insert into public.vrm_reglages values ('proprietaire', :'J'), ('abonnement_obligatoire', '0');
with
pool as (select jsonb_agg(to_jsonb(g) order by g) || '["C3"]'::jsonb p from generate_series(1, 552) g),
nums as (select g, case when g <= 388 then ((g * 7) % 540) + 1 else (((g - 388) * 7) % 540) + 1 end n from generate_series(1, 401) g),
fiches as (select jsonb_object_agg((9000000000 + g)::text, jsonb_build_object(
  'numero', n::text, 'auto', g <= 384, 'title', 'Paire inventée ' || g, 'photo', 'https://images1.vinted.net/t/0' || g || '_x/f800/' || (1700000000 + g) || '.jpeg?s=z',
  'photoK', '0' || g || '_x/' || (1700000000 + g), 'price', '45.0', 'accountId', '1000' || (g % 9), 'size', case when g % 2 = 0 then '42' else null end,
  'numberedAt', to_char(timestamp '2026-07-22 21:20:36' + (g * interval '4 hours'), 'YYYY-MM-DD"T"HH24:MI:SS".000Z"'))
  || case when g <= 8 then jsonb_build_object('buyPrice', '30') else '{}'::jsonb end
  || case when g between 9 and 12 then jsonb_build_object('mp', jsonb_build_object('lbc', true)) else '{}'::jsonb end
  || case when g between 13 and 29 then jsonb_build_object('repriseAt', '2026-09-01T10:00:00.000Z') else '{}'::jsonb end)
  || jsonb_build_object('9000000999', jsonb_build_object('numero', 'C3', 'auto', false, 'title', 'Paire inventée à lettres', 'numberedAt', '2026-09-02T10:00:00.000Z')) f from nums),
ventes as (select jsonb_object_agg(case when g <= 498 then (22000000000 + g)::text else 'mail:1700000000' || g || ':2026-09-01T00:00:00.000Z:paire inventée' end,
  jsonb_build_object('numero', (((g * 11) % 548) + 1)::text, 'autoAssigned', g <= 132) || case when g <= 132 then jsonb_build_object('autoShip', true) else '{}'::jsonb end
  || case when g between 200 and 276 then jsonb_build_object('buyPrice', '25') else '{}'::jsonb end)
  || jsonb_build_object('22000000999', jsonb_build_object('numero', '40+41', 'autoAssigned', false)) v from generate_series(1, 500) g),
stock as (select jsonb_agg(to_jsonb(g::text) order by g) s from generate_series(1, 1815) g),
perdues as (select jsonb_object_agg((23 + g * 19)::text, jsonb_build_object('at', '2026-09-10T00:00:00Z', 'title', 'perdue ' || g)) l from generate_series(0, 25) g)
insert into public.app_data (owner, id, data) select :'J', 'main', jsonb_build_object(
  'vinted_used_numeros', pool.p, 'vinted_annonce_numeros', fiches.f, 'vinted_sale_overrides', ventes.v,
  'vinted_stock_vinted', stock.s, 'vinted_buyprice_by_num', '{"385":"30"}'::jsonb, 'vinted_pairs_lost', perdues.l,
  'vrm_lbc_liens', '{"2900000001":"233","2900000002":"250","2900000003":"271"}'::jsonb,
  'vinted_bord_links', '{"22000000400":{"numero":"77"}}'::jsonb,
  'vinted_offvinted_buys', '[{"id":"ob_1","numero":"88","title":"achat inventé","price":"20"},{"id":"ob_2","numero":"","title":"sans numéro"}]'::jsonb,
  'vinted_garage_grid', '{"A1":["9"],"A2":[]}'::jsonb,
  'vrm_inventaire_pointage', '{"debut":"2026-10-01T08:00:00.000Z","pointes":{"116":1759305600000,"14":1759305700000}}'::jsonb,
  'vinted_txn_link', '{"22000000001":"9000000001"}'::jsonb, 'vinted_autonum', true, 'vrm_prenom', 'Prénom inventé',
  'vinted_ship_done', '{"22000000010":true}'::jsonb, 'vrm_urssaf_declare', '{}'::jsonb,
  'vinted_sales', '[]'::jsonb, 'vrm_widget_token', 'jeton-invente')
from pool, fiches, ventes, stock, perdues;
insert into public.app_data (owner, id, data) values (:'J', 'vrm_room', '{"rooms":[{"id":"r1","name":"Pièce","room":{"h":10,"w":17},"items":[
  {"id":"f1","type":"pile","cols":7,"rows":4,"start":116,"slots":{},"nums":["116","117","118","119","120","121","122","123","125","126","127","128","130","131","132","133","134","135","136","137","138","139","140","141","143","143"]},
  {"id":"f2","type":"grille","cols":4,"rows":9,"slots":{"7_3":["15"],"8_3":["20"]}},
  {"id":"f3","type":"etagere","cols":3,"rows":4,"slots":{"1_0":["14"]}},
  {"id":"f4","type":"table","slots":{}},
  {"id":"f5","type":"pile","cols":1,"rows":3,"start":600,"slots":{}},
  {"id":"f6","type":"carton","num":"88","slots":{}}]},{"id":"r2","name":"Autre","room":{"h":8,"w":10},"items":[]}],"active":"r1"}'::jsonb);
insert into public.app_data (owner, id, data) values
  (:'J', 'vrm_local', '{"photos":[{"id":"ph1","name":"Zone 1","img":"data:image/jpeg;base64,AAAA","pins":[{"id":"p1","numero":"116","x":0.2,"y":0.4},{"id":"p2","numero":"","x":0.5,"y":0.5}]}]}'),
  (:'J', 'ebay_brouillons', '{"items":{"b-1":{"numero":"30","titre":"brouillon inventé"},"b-2":{"titre":"sans numéro"}},"majAt":1759305600000}');
insert into public.app_data (owner, id, data, updated_at)
select :'J', 'email_bord_' || (22000000000 + g), jsonb_build_object('numero', case when g <= 118 then (((g * 13) % 530) + 1)::text else '' end,
  'transaction', (22000000000 + g)::text, 'receivedAt', '2026-09-20T10:00:00.000Z', 'filename', 'b.pdf', 'pdfB64', 'JVBERi0xLjQK' || repeat('A', 2000)),
  timestamptz '2026-09-20 10:00:00+00'
from generate_series(1, 181) g;
insert into public.app_data (owner, id, data, updated_at) values
  (:'J', 'email_bord_lot', '{"numero":"40+41","transaction":"22000000999","receivedAt":"2026-09-21T10:00:00.000Z","filename":"lot.pdf","pdfB64":"JVBERi0xLjQKlot"}', '2026-09-21 10:00:00+00'),
  (:'J', 'email_sale_aaaa', '{"numero":"99001","prix":"40","receivedAt":"2026-09-01T10:00:00.000Z"}', '2026-09-01 10:00:00+00'),
  (:'J', 'email_sale_bbbb', '{"numero":"","prix":"40"}', '2026-09-01 10:00:00+00'),
  (:'J', 'email_final_cccc', '{"numero":"2079","montant":"40"}', '2026-09-01 10:00:00+00'),
  (:'J', 'email_final_dddd', '{"numero":""}', '2026-09-01 10:00:00+00'),
  (:'J', 'email_journal', '{"entries":[{"numero":"241"},{"numero":""},{"numero":"274"},{"numero":"220"}]}', '2026-09-01 10:00:00+00'),
  (:'J', 'lbc_listings', '{"items":{"2900000001":{"id":"2900000001","ref":"266","subject":"x"},"2900000099":{"id":"2900000099","subject":"chalet"}}}', now()),
  (:'J', 'ebay_listings', '{"items":[{"itemId":"1","sku":""},{"itemId":"2"},{"itemId":"3","sku":"VRM-12"}]}', now()),
  (:'J', 'coffre_1000_9000000001', '{"title":"x","photos":[]}', now()),
  (:'T', 'main', '{"vrm_prenom":"essai","vinted_dark":true,"vinted_used_numeros":[1,2,3]}', now()),
  (:'T', 'vrm_room', '{"rooms":[{"id":"r1","items":[{"id":"x","type":"pile","nums":["1","2"]}]}],"active":"r1"}', now());

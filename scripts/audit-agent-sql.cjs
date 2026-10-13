#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DE LA MIGRATION 014 — LA MÉMOIRE DE L'AGENT eBAY (chantier K3)
//  node scripts/audit-agent-sql.cjs              (le contrôle)
//  node scripts/audit-agent-sql.cjs --prouve     (chaque règle réaffaiblie doit
//                                                 faire passer l'audit au ROUGE)
//  node scripts/audit-agent-sql.cjs --mutation=nom
//
//  La migration (supabase/migrations/014-agent.sql) est EXÉCUTÉE pour de vrai,
//  sur un Postgres JETABLE lancé par cet audit, qui imite la production (forme
//  mesurée le 11 octobre, scripts/agent-sql/supabase-min.sql) : `postgres` n'y
//  est PAS superutilisateur, les droits par défaut ouvrent toute table neuve à
//  anon et authenticated, et les migrations 005, 006, 007 et 013 du dépôt y
//  sont appliquées telles quelles. Aucune donnée réelle, aucune connexion à la
//  vraie base. Les rôles sont joués comme PostgREST les joue (`set role` + les
//  revendications du jeton dans `request.jwt.claims`). Le serveur joue sur
//  HORLOGE SIMULÉE (`vrm.horloge_simulee = '1'`, comme le banc de vie de K5),
//  sauf dans la section qui prouve que, sans elle, l'heure reçue ne compte pas.
//
//  Ce qu'il prouve (spec-finale §5.1-5.2, K3, synthèse §15.2-1, et la revue du
//  11 octobre au soir) : deux preneurs ne prennent jamais la même tâche ni deux
//  tâches d'un même compte eBay — battements ET clics — ; un arriéré n'affame
//  personne ; un battement ne bloque pas derrière un autre ; le bail expiré se
//  reprend ; une écriture de commande hors du bail de CETTE commande, ou
//  périmée, rend 0 ligne, et le rang ne descend jamais ; « pas su » ne détruit
//  jamais une tâche ; une sonnette n'est jamais perdue ; une clé de geste
//  GLOBALE ne dit « première fois » qu'une fois ; un compte eBay n'a qu'un
//  titulaire et son index le suit ; une réservation compte 115 % et 50
//  réservations simultanées ne dépassent jamais un plafond, que la purge ne
//  rouvre pas ; l'heure reçue ne compte que sur horloge simulée ; « Fermer mon
//  compte » efface TOUT et ferme la porte ; le journal n'a qu'une réécriture ;
//  R18 tient sur ce qui a une forme ; un navigateur ne lit QUE ses lignes,
//  n'écrit RIEN (TRUNCATE compris), ne touche jamais `ebay_tokens*` ; qui ne
//  paie plus ne voit plus rien ; et `--verifier` voit chaque garde touchée.
//  Et la revue du 12 octobre (second tour) : « Fermer mon compte » est
//  SÉRIALISÉ avec chaque écrivain du vendeur (une sonnette, une note, un clic,
//  un quota, une écriture directe — en vol ou arrivés pendant : rien ne survit,
//  rien n'est accepté après) ; une ligne restée au nom d'un vendeur effacé ne
//  fait jamais lever le battement des autres ; le bail (≤ 600 s), la prochaine
//  fois et la sonnette (≤ 1 an) sont bornés ; READ COMMITTED est exigé ; la
//  forme compare le TEXTE des contraintes, et `--verifier` voit une garde
//  affaiblie sous le MÊME nom (déclencheur, contrainte, droit de colonne,
//  volatilité). Les courses sont jouées sur un ÉTAT observé (une transaction
//  tenue dans sa fenêtre, un appel qui attend un verrou), jamais sur un délai.
//
//  ⚠️ S'il ne trouve pas Postgres, il le DIT et sort en 1 : un audit qui ne
//     peut pas tourner n'est jamais vert par défaut.
//  ⚠️ Un audit ne meurt pas, il rapporte : chaque bloc passe par `essaie`.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync, spawn, execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const MIG = path.join(RACINE, 'supabase/migrations/014-agent.sql');
const MIN = path.join(__dirname, 'agent-sql/supabase-min.sql');
const OUTIL_SRC = path.join(__dirname, 'agent-sql/essai-annule.cjs');
const SOCLE = ['005-abonnements.sql', '006-acces-abonnement.sql', '007-droits-minimaux.sql', '013-anciens-numeros-en-b.sql']
  .map((f) => path.join(RACINE, 'supabase/migrations', f));
const J = '11111111-1111-1111-1111-111111111111';   // un vendeur (inventé)
const V = '22222222-2222-2222-2222-222222222222';   // un autre vendeur (inventé)
const N = '00000000-0000-0000-0000-000000000000';   // le propriétaire neutre
const T0 = '2026-10-12T08:00:00Z';                  // l'heure simulée
const t = (s) => `'${new Date(Date.parse(T0) + s * 1000).toISOString()}'::timestamptz`;
const JOUR = 86400;

const args = process.argv.slice(2);
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);
const PROUVE = args.includes('--prouve');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + String(d).replace(/\s*\n\s*/g, ' ') : '')); };
const essaie = async (nom, f) => { try { return await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); return undefined; } };

// ── LES MUTATIONS : chacune réaffaiblit UNE règle. `--prouve` exige que
//    l'audit sorte en ROUGE pour chacune (« la fonction n'existait pas avant »
//    n'est pas une preuve). `sql` change la migration, `apres` défait une garde
//    après l'installation, `outil` change la vérification. ──────────────────
const remplace = (s, avant, apres, nom) => {
  const n = s.split(avant).length - 1;
  if (n !== 1) throw new Error('mutation ' + nom + ' : ancre introuvable (' + n + ' occurrence(s))');
  return s.split(avant).join(apres);
};
const MUTATIONS = {
  // ── les six de la spécification (K3) ──
  'skip-locked': { sql: (s) => remplace(s, '       for update of f skip locked;\n    continue when not found;', '       for update of f;\n    continue when not found;', 'skip-locked') },
  // (la version est exigée DEUX fois, à la lecture verrouillée et à l'écriture : la mutation retire les deux)
  'version': { sql: (s) => remplace(remplace(s, '     and c.version = p_version_lue\n     for update of c;', '     for update of c;', 'version'),
    '     and c.version = p_version_lue\n  returning c.version into v;', '  returning c.version into v;', 'version') },
  'bail-ecrire': { sql: (s) => remplace(s, "   where f.owner = p_owner and f.cle = k_cle and f.bail_jeton = p_jeton and f.bail_jusqua > maintenant\n     for share of f;\n  if not found then return null; end if;\n",
    "   where f.owner = p_owner and f.cle = k_cle\n     for share of f;\n", 'bail-ecrire') },
  'groupe-en-vol': { sql: (s) => remplace(remplace(s, `         and not exists (select 1 from public.vrm_agent_file g
                          where g.owner = f.owner and g.groupe = f.groupe and g.bail_jusqua >= maintenant)
`, '', 'groupe-en-vol'), `    continue when exists (select 1 from public.vrm_agent_file g
                           where g.owner = c.owner and g.groupe = c.groupe and g.cle <> c.cle
                             and g.bail_jusqua >= maintenant);
`, '', 'groupe-en-vol') },
  'ecriture-navigateur': { apres: `create policy ecrit_soi on public.vrm_agent_commandes for insert to authenticated with check (owner = (select auth.uid()));
grant insert on public.vrm_agent_commandes to authenticated;` },
  'horloge-absente': { sql: (s) => remplace(s, `insert into public.vrm_agent_horloge (id, dernier_tic, dernier_battement, dernier_succes)
values (1, '-infinity', '-infinity', '-infinity')
on conflict (id) do nothing;`, '', 'horloge-absente') },
  // ── les règles ajoutées par K3 ──
  'verrou-groupe': { sql: (s) => remplace(s, "    continue when not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtext('vrm_agent_groupe'), pg_catalog.hashtext(k));\n", '', 'verrou-groupe') },
  // (le bail de la tâche elle-même est honoré à TROIS endroits — candidats, exclusion du groupe qui la compte,
  //  revérification de la ligne : la mutation les retire tous les trois)
  'bail-prendre': { sql: (s) => remplace(remplace(remplace(s, "         and coalesce(f.bail_jusqua, '-infinity'::timestamptz) < maintenant\n         and not exists", "         and not exists", 'bail-prendre'),
    "                          where g.owner = f.owner and g.groupe = f.groupe and g.bail_jusqua >= maintenant)", "                          where g.owner = f.owner and g.groupe = f.groupe and g.cle <> f.cle and g.bail_jusqua >= maintenant)", 'bail-prendre'),
    "       and coalesce(f.bail_jusqua, '-infinity'::timestamptz) < maintenant\n       for update of f skip locked;", "       for update of f skip locked;", 'bail-prendre') },
  'deux-par-vendeur': { sql: (s) => remplace(remplace(s, "    continue when coalesce((par_vendeur ->> c.owner::text)::integer, 0) >= 2;\n", '', 'deux-par-vendeur'), '     where x.rang_vendeur <= 4\n', '', 'deux-par-vendeur') },
  'clic-vole': { sql: (s) => remplace(s, `   where f.owner = p_owner and f.cle = p_cle
     and coalesce(f.bail_jusqua, '-infinity'::timestamptz) < maintenant;
  if found then return true; end if;`, `   where f.owner = p_owner and f.cle = p_cle;
  if found then return true; end if;`, 'clic-vole') },
  'rendre-sans-jeton': { sql: (s) => remplace(s, `  select * into r from public.vrm_agent_file f
   where f.owner = p_owner and f.cle = p_cle and f.bail_jeton = p_jeton
     for update;`, `  select * into r from public.vrm_agent_file f
   where f.owner = p_owner and f.cle = p_cle
     for update;`, 'rendre-sans-jeton').split("   where f.owner = p_owner and f.cle = p_cle and f.bail_jeton = p_jeton;\n  return true;").join("   where f.owner = p_owner and f.cle = p_cle;\n  return true;") },
  'reveil-perdu': { sql: (s) => remplace(s, "else least(coalesce(p_prochain, maintenant + interval '15 minutes'), coalesce(r.reveil, 'infinity'::timestamptz)) end,", "else coalesce(p_prochain, maintenant + interval '15 minutes') end,", 'reveil-perdu') },
  'cle-par-vendeur': { sql: (s) => remplace(s, "  if p_cle ~ '^(achat|msg|eval|offre):' then o := '00000000-0000-0000-0000-000000000000'; end if;\n", '', 'cle-par-vendeur') },
  'memos-14-jours': { sql: (s) => remplace(s, "  delete from public.vrm_agent_memos x where x.expire < maintenant;", "  delete from public.vrm_agent_memos x where x.expire < maintenant or x.at < maintenant - interval '14 days';", 'memos-14-jours') },
  'sans-marge': { sql: (s) => remplace(s, '  montant := (p_centimes_ttc::bigint * 115 + 99) / 100;', '  montant := p_centimes_ttc;', 'sans-marge') },
  'rendue-deux-fois': { sql: (s) => remplace(s, `  delete from public.vrm_agent_compteurs x
   where x.owner = p_owner and x.cle like 'resa:' || p_reservation::text || '|%'
  returning x.cle, x.centimes into k, c;`, `  select x.cle, x.centimes into k, c from public.vrm_agent_compteurs x
   where x.owner = p_owner and x.cle like 'resa:' || p_reservation::text || '|%';`, 'rendue-deux-fois') },
  'reservation-sans-verrou': { sql: (s) => remplace(s, '  perform 1 from public.vrm_agent_compteurs k where k.owner = p_owner and k.cle in (cj, cm) order by k.cle for update;\n', '  perform pg_sleep(0.02);\n', 'reservation-sans-verrou') },
  'quota-sans-seuil': { sql: (s) => remplace(s, "when 'confort' then 0.6", "when 'confort' then 1.0", 'quota-sans-seuil') },
  'titulaire-libre': { sql: (s) => remplace(s, `    on conflict (cle_ebay) do nothing
    returning true into ok;`, `    on conflict (cle_ebay) do update set owner = excluded.owner
    returning true into ok;`, 'titulaire-libre') },
  'index-vole': { sql: (s) => remplace(s, `
   where i.owner = excluded.owner
      or not exists (select 1 from public.vrm_ebay_titulaires t where t.owner = i.owner and t.compte = i.compte);`, ';', 'index-vole') },
  'preuve-deplacee': { sql: (s) => remplace(s, `  on conflict (owner, numero_cle, source, ref) do nothing;`, `  on conflict (owner, numero_cle, source, ref) do update set vue_le = excluded.vue_le;`, 'preuve-deplacee') },
  'journal-reecrit': { apres: 'alter table public.vrm_agent_journal disable trigger vrm_agent_journal_garde;' },
  'ebay-tokens-libre': { apres: 'alter table public.app_data disable trigger vrm_garde_ebay_tokens_ajout; alter table public.app_data disable trigger vrm_garde_ebay_tokens_maj; alter table public.app_data disable trigger vrm_garde_ebay_tokens_retrait;' },
  'ebay-tokens-role-seul': { sql: (s) => remplace(s, "  if coalesce(auth.role(), '') in ('authenticated', 'anon') or current_user in ('authenticated', 'anon') then", "  if current_user in ('authenticated', 'anon') then", 'ebay-tokens-role-seul') },
  'abonnement-ignore': { sql: (s) => remplace(s, `    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'abonnement_requis') then
      execute format('create policy abonnement_requis on public.%I as restrictive for all to authenticated '
                     'using ((select public.vrm_acces_ok())) with check ((select public.vrm_acces_ok()))', t);
    end if;
`, '', 'abonnement-ignore') },
  'droits-par-defaut': { sql: (s) => remplace(s, "    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);\n", '', 'droits-par-defaut') },
  'fonctions-ouvertes': { sql: (s) => remplace(s, "    execute format('revoke all on function %s from public, anon, authenticated', f);\n", '', 'fonctions-ouvertes') },
  // ── la revue du 11 octobre au soir ──
  // [1] La commande sous le bail de N'IMPORTE QUELLE tâche du vendeur.
  'commande-bail-quelconque': { sql: (s) => remplace(s, '   where f.owner = p_owner and f.cle = k_cle and f.bail_jeton = p_jeton and f.bail_jusqua > maintenant\n',
    '   where f.owner = p_owner and f.bail_jeton = p_jeton and f.bail_jusqua > maintenant\n', 'commande-bail-quelconque') },
  // [1] Une création sous le bail d'un AUTRE compte eBay du vendeur.
  'creation-autre-compte': { sql: (s) => remplace(s, '     where f.owner = p_owner and f.groupe = p_compte and f.bail_jeton = p_jeton and f.bail_jusqua > maintenant\n',
    '     where f.owner = p_owner and f.bail_jeton = p_jeton and f.bail_jusqua > maintenant\n', 'creation-autre-compte') },
  // [1] Le rang qui descend.
  'rang-descend': { sql: (s) => remplace(s, '  if neuf.rang < ligne.rang then\n', '  if false then\n', 'rang-descend') },
  // [R1-18] Le bail lu sans verrou pendant l'écriture : un preneur le reprend.
  'sans-share': { sql: (s) => remplace(s, "   where f.owner = p_owner and f.cle = k_cle and f.bail_jeton = p_jeton and f.bail_jusqua > maintenant\n     for share of f;",
    "   where f.owner = p_owner and f.cle = k_cle and f.bail_jeton = p_jeton and f.bail_jusqua > maintenant;", 'sans-share') },
  // [2] L'heure de l'appelant crue sans horloge simulée.
  'heure-recue': { sql: (s) => remplace(s, "  select case when pg_catalog.current_setting('vrm.horloge_simulee', true) = '1'\n              then coalesce(p, pg_catalog.now()) else pg_catalog.now() end",
    '  select coalesce(p, pg_catalog.now())', 'heure-recue') },
  // [R1-23] L'heure d'une ligne de journal prise dans l'entrée.
  'noter-heure-recue': { sql: (s) => remplace(s, '  select p_owner, x.compte, maintenant, x.geste,', '  select p_owner, x.compte, coalesce(x.at, maintenant), x.geste,', 'noter-heure-recue') },
  // [3] Pas de pierre tombale : un battement en vol réécrit au nom du vendeur effacé.
  'sans-pierre-tombale': { sql: (s) => remplace(s, "  insert into public.vrm_agent_effaces (owner, le) values (p_owner, pg_catalog.now()) on conflict (owner) do nothing;\n", '', 'sans-pierre-tombale') },
  // [3] Les quotas par compte qui le nomment, gardés.
  'effacer-quotas': { sql: (s) => remplace(s, "   where x.owner = '00000000-0000-0000-0000-000000000000' and x.cle like '%|' || p_owner::text || '|%';", "   where false;", 'effacer-quotas') },
  // [R1-16] Une table oubliée par « Fermer mon compte ».
  'effacer-coffre': { sql: (s) => remplace(s, "  delete from public.vrm_coffre x where x.owner = p_owner;", "  delete from public.vrm_coffre x where false;", 'effacer-coffre') },
  'effacer-commandes': { sql: (s) => remplace(s, "  delete from public.vrm_agent_commandes x where x.owner = p_owner;", "  delete from public.vrm_agent_commandes x where false;", 'effacer-commandes') },
  'effacer-preuves': { sql: (s) => remplace(s, "  delete from public.vrm_agent_preuves x where x.owner = p_owner;", "  delete from public.vrm_agent_preuves x where false;", 'effacer-preuves') },
  'effacer-index': { sql: (s) => remplace(s, "  delete from public.vrm_ebay_annonces_index x where x.owner = p_owner;", "  delete from public.vrm_ebay_annonces_index x where false;", 'effacer-index') },
  // [4] La vérification aveugle aux déclencheurs suspendus, aux droits, à la forme.
  'verifier-declencheurs': { outil: (s) => remplace(s, "where not tg.tgisinternal and tg.tgenabled = 'O'", 'where not tg.tgisinternal', 'verifier-declencheurs') },
  'verifier-droits': { outil: (s) => remplace(s, "    droits: `(e.j -> 'droits')::jsonb = ${lit(JSON.stringify([...DROITS].sort()))}::jsonb`,\n", '', 'verifier-droits') },
  'verifier-fonctions': { outil: (s) => remplace(s, "    fonctions: `(e.j -> 'fonctions')::jsonb = ${lit(JSON.stringify(FONCTIONS_ATTENDUES))}::jsonb`,\n", '', 'verifier-fonctions') },
  // [4] Une table d'une forme ancienne réutilisée en silence.
  'forme-ignoree': { sql: (s) => remplace(s, "    if v is distinct from a then\n      select pg_catalog.string_agg(k.conname", "    if false then\n      select pg_catalog.string_agg(k.conname", 'forme-ignoree') },
  // [5] R18 : la forme ancienne des noms de clés, data sans garde, codes libres, anonymisation du seul texte, raison brute.
  'r18-shipto': { contraintes: true, sql: (s) => remplace(s, "    and array_to_string(cles_shipto, '|', '?') ~ '^((contactAddress[.]|primaryPhone[.])?(fullName|companyName|email|contactAddress|primaryPhone|addressLine1|addressLine2|city|stateOrProvince|postalCode|countryCode|county|phoneNumber)([|]|$))*$')));",
    "    and array_to_string(cles_shipto, '|') ~ '^[A-Za-z][A-Za-z0-9_.]{0,63}(\\|[A-Za-z][A-Za-z0-9_.]{0,63})*$')));", 'r18-shipto') },
  'r18-data': { contraintes: true, sql: (s) => remplace(s, "  constraint vrm_agent_commandes_data check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 4096\n    and public.vrm_agent_sans_acheteur(data)),",
    "  constraint vrm_agent_commandes_data check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 4096),", 'r18-data') },
  'r18-codes': { contraintes: true, sql: (s) => remplace(s, "    and (voie is null or voie ~ '^[a-z0-9_.:-]{1,64}$') and (transporteur is null or transporteur ~ '^[a-z0-9_.:-]{1,64}$')\n", '', 'r18-codes') },
  'r18-journal': { contraintes: true, sql: (s) => remplace(s, " and (ref is null or ref ~ '^[A-Za-z0-9_.:/#-]{1,120}$')),", '),', 'r18-journal') },
  'anonymiser-texte-seul': { sql: (s) => remplace(s, '  update public.vrm_agent_journal j set texte = null, ref = null, defaire = null, texte_retire_le = maintenant', '  update public.vrm_agent_journal j set texte = null, texte_retire_le = maintenant', 'anonymiser-texte-seul') },
  'raison-brute': { sql: (s) => remplace(s, "                       else 'raison-illisible' end", "                       else left(p_raison, 64) end", 'raison-brute') },
  // [6] « Pas de prochaine fois » retire la tâche, même en échec.
  'rendre-null-efface': { sql: (s) => remplace(s, "  fini boolean := coalesce(p_fini, false) and p_prochain is null and not coalesce(p_echec, false);", '  fini boolean := p_prochain is null;', 'rendre-null-efface') },
  // [7] Une sonnette sous un bail EXPIRÉ pas encore repris est perdue.
  'reveil-bail-vivant': { sql: (s) => remplace(s, '         reveil = case when f.bail_jeton is not null\n', '         reveil = case when f.bail_jeton is not null and f.bail_jusqua >= p_maintenant\n', 'reveil-bail-vivant') },
  // [8] Le clic ignore le compte eBay déjà en vol.
  'clic-sans-groupe': { sql: (s) => remplace(s, `  if exists (select 1 from public.vrm_agent_file f
              where f.owner = p_owner and f.groupe = grp and f.cle <> p_cle and f.bail_jusqua >= maintenant) then
    return false;
  end if;
`, '', 'clic-sans-groupe') },
  // [9] La fenêtre brute triée par échéance (un arriéré affame les autres).
  'fenetre-brute': { sql: (s) => remplace(s, `    with dues as (
      select f.owner, f.cle, f.groupe, f.prochain
        from public.vrm_agent_file f
       where f.prochain <= maintenant
         and coalesce(f.bail_jusqua, '-infinity'::timestamptz) < maintenant
         and not exists (select 1 from public.vrm_agent_file g
                          where g.owner = f.owner and g.groupe = f.groupe and g.bail_jusqua >= maintenant)
         and not exists (select 1 from public.vrm_agent_effaces e where e.owner = f.owner)
    ), une_par_groupe as (
      select distinct on (d.owner, d.groupe) d.owner, d.cle, d.groupe, d.prochain
        from dues d
       order by d.owner, d.groupe, d.prochain, d.cle
    ), classees as (
      select u.owner, u.cle, u.groupe, u.prochain,
             row_number() over (partition by u.owner order by u.prochain, u.cle) as rang_vendeur
        from une_par_groupe u
    )
    select x.owner, x.cle, x.groupe
      from classees x
     where x.rang_vendeur <= 4
     order by x.prochain, x.owner, x.cle
     limit least(p_lim, 100) * 4`, `    select f.owner, f.cle, f.groupe
      from public.vrm_agent_file f
     where f.prochain <= maintenant
       and coalesce(f.bail_jusqua, '-infinity'::timestamptz) < maintenant
       and not exists (select 1 from public.vrm_agent_effaces e where e.owner = f.owner)
     order by f.prochain, f.owner, f.cle
     limit least(p_lim, 100) * 25`, 'fenetre-brute') },
  // [10] Quota : un vendeur inconnu passe hors obligation.
  'quota-owner-null': { sql: (s) => remplace(s, "  if p_priorite <> 'obligation' and p_owner is null then return false; end if;\n", '', 'quota-owner-null').split("  if p_priorite <> 'obligation' then\n    cc :=").join("  if p_priorite <> 'obligation' and p_owner is not null then\n    cc :=") },
  // [11] L'index reste sous l'ancien libellé ; libérer le garde ; indexer sans être titulaire ; une ligne périmée jamais reprise.
  'titulaire-index-reste': { sql: (s) => remplace(s, '    update public.vrm_ebay_annonces_index i set compte = p_compte where i.owner = p_owner and i.compte = ancien;\n', '', 'titulaire-index-reste') },
  'liberer-garde-index': { sql: (s) => remplace(s, '  delete from public.vrm_ebay_annonces_index i where i.owner = p_owner and i.compte = c;\n', '', 'liberer-garde-index') },
  'index-sans-titulaire': { sql: (s) => remplace(s, `  if not exists (select 1 from public.vrm_ebay_titulaires t where t.owner = p_owner and t.compte = p_compte) then
    return jsonb_build_object('indexees', 0, 'retirees', 0, 'refusees', n_brut, 'raison', 'pas-titulaire');
  end if;
`, '', 'index-sans-titulaire') },
  'index-perime-garde': { sql: (s) => remplace(s, `   where i.owner = excluded.owner
      or not exists (select 1 from public.vrm_ebay_titulaires t where t.owner = i.owner and t.compte = i.compte);`, '   where i.owner = excluded.owner;', 'index-perime-garde') },
  // [12] La garde du journal ouverte par une variable de session.
  'journal-variable': { sql: (s) => remplace(s, `    if exists (select 1 from public.vrm_agent_marques m
                where m.xid = pg_catalog.txid_current() and m.quoi = 'purger' and old.at < m.avant) then
      return old;
    end if;`, `    if coalesce(current_setting('vrm.agent_purger_avant', true), '') <> '' and old.at < current_setting('vrm.agent_purger_avant', true)::timestamptz then
      return old;
    end if;`, 'journal-variable') },
  // [R1-17] La durée de vie des compteurs, et la garde du mois en cours.
  'compteurs-1-jour': { sql: (s) => remplace(s, "   where x.maj < maintenant - interval '400 days'", "   where x.maj < maintenant - interval '1 day'", 'compteurs-1-jour') },
  'compteurs-mois-courant': { sql: (s) => remplace(s, "     and x.cle !~ ('(' || mois_gardes || ')');", '     and true;', 'compteurs-mois-courant') },
  // [25] La purge de l'historique de pg_cron sans filet : un droit qui manque fait échouer toute la purge.
  'cron-sans-filet': { sql: (s) => remplace(s, `    begin
      execute 'delete from cron.job_run_details where end_time < $1' using maintenant - interval '7 days';
      get diagnostics n = row_count; r := r || jsonb_build_object('cron', n);
    exception when others then
      r := r || jsonb_build_object('cron', null);
    end;`, `    execute 'delete from cron.job_run_details where end_time < $1' using maintenant - interval '7 days';
    get diagnostics n = row_count; r := r || jsonb_build_object('cron', n);`, 'cron-sans-filet') },
  // [R1-13] Des droits de plus : TRUNCATE au navigateur, écriture et TRUNCATE au serveur.
  'truncate-nav': { apres: 'grant truncate on public.vrm_agent_commandes, public.vrm_agent_file, public.vrm_agent_journal to authenticated;' },
  'insert-serveur': { apres: 'grant insert on public.vrm_agent_journal, public.vrm_agent_memos, public.vrm_agent_file to service_role;' },
  'truncate-serveur': { apres: 'grant truncate on public.vrm_agent_commandes, public.vrm_agent_file, public.vrm_agent_memos to service_role;' },
  // [R1-23] La garde des jetons qui ne regarde que le jeton (pas le rôle courant).
  'garde-tokens-sans-role-courant': { sql: (s) => remplace(s, "  if coalesce(auth.role(), '') in ('authenticated', 'anon') or current_user in ('authenticated', 'anon') then", "  if coalesce(auth.role(), '') in ('authenticated', 'anon') then", 'garde-tokens-sans-role-courant') },
  // ── la revue du 12 octobre (second tour) ──
  // [R2-1, R2-4] L'effacement sans son verrou EXCLUSIF : la pierre tombale n'est visible qu'au COMMIT.
  'effacer-sans-verrou': { sql: (s) => remplace(s, "  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_agent_vendeur'), pg_catalog.hashtext(p_owner::text));\n", '', 'effacer-sans-verrou') },
  // [R2-1, R2-3, R2-4] Les écrivains sans le verrou PARTAGÉ : ils lisent la pierre tombale sans attendre l'effacement.
  'efface-sans-verrou': { sql: (s) => remplace(s, "  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtext('vrm_agent_vendeur'), pg_catalog.hashtext(p_owner::text));\n", '', 'efface-sans-verrou') },
  // [R2-4] La pierre tombale STABLE : relue sur l'instantané d'AVANT l'attente du verrou.
  'efface-stable': { sql: (s) => remplace(s, "returns boolean\nlanguage plpgsql\nvolatile\nsecurity definer\nset search_path = ''\nas $$\nbegin\n  if p_owner is null then return false; end if;\n",
    "returns boolean\nlanguage plpgsql\nstable\nsecurity definer\nset search_path = ''\nas $$\nbegin\n  if p_owner is null then return false; end if;\n", 'efface-stable') },
  // [R2-3] Le déclencheur relit la pierre tombale validée SANS verrou : une écriture DIRECTE en vol survit.
  'refuser-sans-verrou': { sql: (s) => remplace(s, "  if tg_op = 'INSERT' then\n    efface := public.vrm_agent_efface(new.owner);\n",
    "  if tg_op = 'INSERT' then\n    efface := exists (select 1 from public.vrm_agent_effaces e where e.owner = new.owner);\n", 'refuser-sans-verrou') },
  // [R2-3] Le quota revérifie la pierre tombale APRÈS les verrous du compteur (et a déjà écrit `cc`).
  'quota-sans-verrou': { sql: (s) => remplace(remplace(s, "  if p_owner is not null and public.vrm_agent_efface(p_owner) then return false; end if;\n  lim := floor", '  lim := floor', 'quota-sans-verrou'),
    '  perform 1 from public.vrm_agent_compteurs k where k.owner = neutre and k.cle in (p_cle, cc) order by k.cle for update;\n',
    '  perform 1 from public.vrm_agent_compteurs k where k.owner = neutre and k.cle in (p_cle, cc) order by k.cle for update;\n  if p_owner is not null and public.vrm_agent_efface(p_owner) then return false; end if;\n', 'quota-sans-verrou') },
  // [R2-1, R2-4] `prendre` n'écarte plus les vendeurs effacés : une ligne restée à leur nom fait LEVER le battement de tous.
  'prendre-zombie': { sql: (s) => remplace(remplace(s, '         and not exists (select 1 from public.vrm_agent_effaces e where e.owner = f.owner)\n', '', 'prendre-zombie'),
    '    continue when exists (select 1 from public.vrm_agent_effaces e where e.owner = c.owner);\n', '', 'prendre-zombie') },
  // [R2-4] Une transaction REPEATABLE READ relit la pierre tombale sur un instantané d'avant le verrou.
  'isolation-ignoree': { sql: (s) => { const a = "if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then"; if (s.split(a).length !== 3) throw new Error('mutation isolation-ignoree : ancre introuvable (' + (s.split(a).length - 1) + ' occurrence(s))'); return s.split(a).join('if false then'); } },
  // [R2-2] Le bail non borné (120 000 « s » = 33 h de gel) ; la prochaine fois et la sonnette non bornées (l'an 58 748).
  'bail-non-borne': { sql: (s) => { const a = ' or p_bail_s > 600'; if (s.split(a).length !== 3) throw new Error('mutation bail-non-borne : ancre introuvable (' + (s.split(a).length - 1) + ' occurrence(s))'); return s.split(a).join(''); } },
  'prochain-non-borne': { sql: (s) => remplace(remplace(s, " or p_prochain > maintenant + interval '1 year'", '', 'prochain-non-borne'), " or p_quand > maintenant + interval '1 year'", '', 'prochain-non-borne') },
  // [R2-5] La forme ne compare que les NOMS des contraintes (l'expression ET l'empreinte : la vérification les relit).
  'forme-noms-seuls': { sql: (s) => {
    const avant = "string_agg(k.conname || '=' || pg_catalog.substr(pg_catalog.md5(pg_catalog.replace(pg_catalog.pg_get_constraintdef(k.oid), 'public.', '')), 1, 12), ', ' order by k.conname)";
    const x = remplace(s, avant, "string_agg(k.conname, ', ' order by k.conname)", 'forme-noms-seuls');
    const m = /\$empreinte\$(\{[\s\S]*?\})\$empreinte\$/.exec(x);
    if (!m || !/=[0-9a-f]{12}/.test(m[1])) throw new Error('mutation forme-noms-seuls : ancre introuvable (empreinte)');
    return x.slice(0, m.index) + m[0].replace(/=[0-9a-f]{12}/g, '') + x.slice(m.index + m[0].length);
  } },
  // [R2-5] La vérification aveugle à la définition des déclencheurs (moment, évènements, WHEN, UPDATE OF).
  'verifier-declencheurs-def': { outil: (s) => {
    const x = remplace(s, "    return m[4] + ':' + m[1] + ':' + m[7] + ':' + type + ':' + normWhen(m[6]);", "    return m[4] + ':' + m[1] + ':' + m[7];", 'verifier-declencheurs-def');
    const a = x.indexOf("\n                                            || ':' || tg.tgtype::int"), b = x.indexOf("and tg.tgattr::text = '' and tg.tgnargs = 0)),");
    if (a < 0 || b < a) throw new Error('mutation verifier-declencheurs-def : ancre introuvable');
    return x.slice(0, a) + ' = e)),' + x.slice(b + "and tg.tgattr::text = '' and tg.tgnargs = 0)),".length);
  } },
  // [R2-5] La vérification aveugle aux droits de COLONNE, et à la volatilité des fonctions.
  'verifier-droits-colonnes': { outil: (s) => remplace(s, "    droits_colonnes: `(e.j ->> 'droits_colonnes') is null`,\n", '', 'verifier-droits-colonnes') },
  'verifier-volatilite': { outil: (s) => remplace(remplace(s, ', vol: f.vol', '', 'verifier-volatilite'), "'vol', (array_agg(p.provolatile::text))[1], ", '', 'verifier-volatilite') },
};

if (PROUVE) {
  // Quatre mutations à la fois (chacune a SON Postgres jetable), le bilan dans l'ordre.
  const noms = Object.keys(MUTATIONS);
  const une = (nom) => new Promise((fin) => {
    const p = spawn(process.execPath, [__filename, '--mutation=' + nom]);
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => fin({ nom, status: code, stdout: out, stderr: err }));
  });
  (async () => {
    const res = {}; let i = 0;
    await Promise.all(Array.from({ length: 4 }, async () => { while (i < noms.length) { const nom = noms[i++]; res[nom] = await une(nom); } }));
    let rouges = 0;
    for (const nom of noms) {
      const r = res[nom];
      const n = (r.stdout.match(/^❌ /mg) || []).length;
      const sautee = /audit NON exécuté|ancre introuvable/.test(r.stdout + r.stderr);
      const bon = r.status !== 0 && n > 0 && !sautee;
      if (bon) rouges++;
      console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » → ${bon ? n + ' contrôle(s) au rouge' : (sautee ? 'audit non exécuté ou ancre introuvable' : 'RESTE VERTE : le contrôle ne mord pas')}`);
      if (bon) for (const l of r.stdout.split('\n').filter((x) => x.startsWith('❌ ')).slice(0, 2)) console.log('      ' + l.slice(0, 220));
      else if (sautee) console.log('      ' + (r.stdout + r.stderr).split('\n').filter((x) => /ancre|NON/.test(x)).slice(0, 1).join(''));
    }
    console.log(`\n${rouges}/${noms.length} mutations attrapées.`);
    process.exit(rouges === noms.length ? 0 : 1);
  })();
}

if (!PROUVE) principal();

function principal() {
// ── TROUVER POSTGRES ─────────────────────────────────────────────────────────
function trouverBin() {
  const avec = (d) => d && fs.existsSync(path.join(d, 'initdb')) && fs.existsSync(path.join(d, 'pg_ctl')) && fs.existsSync(path.join(d, 'postgres'));
  if (avec(process.env.PG_BIN)) return process.env.PG_BIN;
  try { const v = fs.readdirSync('/usr/lib/postgresql').filter((x) => avec(path.join('/usr/lib/postgresql', x, 'bin'))).sort((a, b) => Number(b) - Number(a)); if (v.length) return path.join('/usr/lib/postgresql', v[0], 'bin'); } catch (_) {}
  try { const d = execFileSync('pg_config', ['--bindir'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); if (avec(d)) return d; } catch (_) {}
  return null;
}
const BIN = trouverBin();
const PSQL = (() => { if (BIN && fs.existsSync(path.join(BIN, 'psql'))) return path.join(BIN, 'psql'); try { return execFileSync('which', ['psql']).toString().trim() || null; } catch (_) { return null; } })();
if (!BIN || !PSQL) {
  console.log('❌ Postgres introuvable (initdb, pg_ctl, postgres, psql) — audit NON exécuté. Installe postgresql (16+), ou donne PG_BIN=/chemin/vers/bin.');
  process.exit(1);
}
const ROOT = typeof process.getuid === 'function' && process.getuid() === 0;
let UIDG = null;
if (ROOT) {
  try { UIDG = { uid: Number(execFileSync('id', ['-u', 'postgres']).toString().trim()), gid: Number(execFileSync('id', ['-g', 'postgres']).toString().trim()) }; }
  catch (_) { console.log('❌ lancé en root sans utilisateur système « postgres » — audit NON exécuté.'); process.exit(1); }
}
const DIR = fs.mkdtempSync(path.join(ROOT ? '/tmp' : os.tmpdir(), 'vrm-agent-sql-'));
if (ROOT) fs.chownSync(DIR, UIDG.uid, UIDG.gid);
const PORT = String(56432 + (process.pid % 2000));
const serveur = (cmd, a) => spawnSync(path.join(BIN, cmd), a, { encoding: 'utf8', ...(UIDG || {}) });
let demarre = false;
const arreter = () => { if (demarre) { serveur('pg_ctl', ['-D', DIR + '/data', '-m', 'immediate', 'stop']); demarre = false; } try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (_) {} };
process.on('exit', arreter);
process.on('SIGINT', () => { arreter(); process.exit(1); });
{
  // Le superutilisateur s'appelle comme en production ; `postgres` ne l'est PAS.
  const r = serveur('initdb', ['-D', DIR + '/data', '-U', 'supabase_admin', '--auth=trust', '-E', 'UTF8', '--locale=C', '--no-sync']);
  if (r.status !== 0) { console.log('❌ initdb a échoué — audit NON exécuté : ' + (r.stderr || r.stdout).slice(0, 300)); process.exit(1); }
  const s = serveur('pg_ctl', ['-D', DIR + '/data', '-o', `-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off -c max_connections=200 -c timezone=UTC`, '-l', DIR + '/journal', '-w', 'start']);
  if (s.status !== 0) { console.log('❌ Postgres ne démarre pas — audit NON exécuté : ' + (s.stderr || s.stdout).slice(0, 300)); process.exit(1); }
  demarre = true;
}

// ── PSQL ─────────────────────────────────────────────────────────────────────
const argsPsql = (role, db) => ['-h', DIR, '-p', PORT, '-U', role, '-d', db, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'];
const run = (sql, o = {}) => {
  const r = spawnSync(PSQL, argsPsql(o.role || 'postgres', o.db || 'postgres'), { input: sql, encoding: 'utf8', maxBuffer: 64 << 20 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};
const runAsync = (sql, o = {}) => new Promise((ok) => {
  const debut = Date.now();
  const p = spawn(PSQL, argsPsql(o.role || 'postgres', o.db || 'postgres'));
  let out = '', err = '';
  p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => ok({ ok: code === 0, out: out.trim(), err: err.trim(), ms: Date.now() - debut }));
  p.stdin.end(sql);
});
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
// Attendre qu'une condition lue par le banc (superutilisateur) devienne vraie : les courses se jouent sur un
// ÉTAT observé (une transaction est dans sa fenêtre, un appel attend un verrou), jamais sur un délai deviné —
// sous la charge de `--prouve` (quatre audits à la fois), un délai fixe rendrait le contrôle vacant.
const attendreQue = async (sql, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (Q(sql, { role: 'supabase_admin' }) === 't') return true; await attendre(40); } return false; };
const enSommeil = (s) => `select exists (select 1 from pg_stat_activity where query like 'select pg_sleep(${s})%' and state = 'active')`;
// Les rôles, joués comme PostgREST les joue. Le serveur tourne sur HORLOGE
// SIMULÉE (le banc de vie de K5 fera de même) ; `serveurReel` sans elle.
const COMME = {
  serveur: `set role service_role; set "request.jwt.claims" = '{"role":"service_role"}'; set vrm.horloge_simulee = '1';\n`,
  serveurReel: `set role service_role; set "request.jwt.claims" = '{"role":"service_role"}';\n`,
  vendeur: (u) => `set role authenticated; set "request.jwt.claims" = '{"sub":"${u}","role":"authenticated"}';\n`,
  anon: `set role anon; set "request.jwt.claims" = '{"role":"anon"}';\n`,
};
let DB = 'gabarit';
const Q = (sql, o = {}) => { const r = run(sql, { db: DB, ...o }); if (!r.ok) throw new Error(r.err.slice(0, 400)); return r.out; };
const QJ = (sql, o) => JSON.parse(Q(sql, o) || 'null');
const S = (sql) => Q(COMME.serveur + sql);              // le serveur (clé de service), horloge simulée
const SR = (sql) => Q(COMME.serveurReel + sql);         // le serveur, à l'heure réelle
const A = (sql) => Q(sql, { role: 'supabase_admin' });  // le banc (superutilisateur)
const refuse = (r, motif) => !r.ok && motif.test(r.err);
const fraiche = (nom, modele = 'gabarit') => { Q(`drop database if exists ${nom}`, { db: 'postgres', role: 'supabase_admin' }); Q(`create database ${nom} template ${modele} owner postgres`, { db: 'postgres', role: 'supabase_admin' }); DB = nom; };
// Une tâche à la main (le banc seulement : le superutilisateur passe outre les droits).
const tache = (owner, cle, groupe, prochainS = -60, bail = null) => A(
  `insert into public.vrm_agent_file (owner, cle, groupe, prochain, bail_jeton, bail_jusqua) values ('${owner}', '${cle}', '${groupe}', ${t(prochainS)}, ${bail ? `'${bail.jeton}'` : 'null'}, ${bail ? t(bail.jusqua) : 'null'})`);
const prendre = (lim, jeton, s = 0, bail = 120) => QJ(COMME.serveur + `select coalesce(json_agg(x order by x.owner, x.cle), '[]') from public.vrm_agent_prendre(${lim}, '${jeton}', ${bail}, ${t(s)}) x;`);
const uuid = (i) => `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`;
const groupesDe = (l) => l.map((x) => x.owner + '|' + x.groupe);
const js = (o) => `'${JSON.stringify(o).replace(/'/g, "''")}'`;
const ecrire = (o, jeton, compte, cmd, version, cols, s = 1) => run(COMME.serveur + `select public.vrm_agent_ecrire_commande('${o}', '${jeton}', '${compte}', '${cmd}', ${version === null ? 'null' : version}, ${js(cols)}, 'ebay', ${t(s)});`, { db: DB });
const ecrit = (o, jeton, compte, cmd, version, cols, s = 1) => { const r = ecrire(o, jeton, compte, cmd, version, cols, s); if (!r.ok) throw new Error(r.err.slice(0, 300)); return r.out; };

// La vérification : l'outil (ou sa mutation) écrit le SQL, on le lance.
let OUTIL = OUTIL_SRC;
const verifier = (FMIG, db) => {
  const ver = spawnSync(process.execPath, [OUTIL, '--verifier', '--migration=' + FMIG], { encoding: 'utf8' });
  if (ver.status !== 0) throw new Error('verifier : ' + ver.stderr.slice(0, 200));
  const r = run(ver.stdout, { db });
  if (!r.ok) throw new Error('verifier (SQL) : ' + r.err.slice(0, 200));
  return JSON.parse(r.out.split('\n').filter(Boolean).pop());
};

// ════════════════════════════════════════════════════════════════════════════
(async () => {
  console.log(`(Postgres jetable dans ${DIR}${MUTATION ? ' · MUTATION « ' + MUTATION + ' »' : ''})\n`);

  // ── LE SOCLE : la forme de la production, puis 005-007 et 013 TELLES QUELLES ──
  let SQL = null;
  await essaie('préparer le socle (rôles, droits par défaut, 005-007, 013)', () => {
    let r = run(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'postgres') then create role postgres login nosuperuser bypassrls inherit; end if; end $$;\ncreate database socle owner postgres;`, { role: 'supabase_admin' });
    if (!r.ok) throw new Error('rôle/base : ' + r.err);
    r = run(fs.readFileSync(MIN, 'utf8'), { role: 'supabase_admin', db: 'socle' });
    if (!r.ok) throw new Error('supabase-min : ' + r.err);
    for (const f of SOCLE) { r = run(fs.readFileSync(f, 'utf8'), { db: 'socle' }); if (!r.ok) throw new Error(path.basename(f) + ' : ' + r.err.slice(0, 300)); }
    r = run('create database gabarit template socle owner postgres;', { role: 'supabase_admin' });
    if (!r.ok) throw new Error('gabarit : ' + r.err);
    dit(Q("select rolsuper from pg_roles where rolname = 'postgres'") === 'f', 'le socle imite la production : `postgres` n\'est PAS superutilisateur (la migration tourne avec ses vrais droits)');
    dit(Q("select count(*) from pg_trigger where tgrelid = 'public.app_data'::regclass and tgname in ('vrm_garde_numeros', 'vrm_garde_garage')") === '2', 'les gardes de la 013 sont sur app_data, comme en production (la 014 s\'y ajoute)');
  });

  console.log('\n1. L\'INSTALLATION');
  await essaie('la migration existe', () => { dit(fs.existsSync(MIG), 'supabase/migrations/014-agent.sql existe'); if (fs.existsSync(MIG)) SQL = fs.readFileSync(MIG, 'utf8'); });
  const m = MUTATION ? MUTATIONS[MUTATION] : null;
  if (MUTATION && !m) { console.log('❌ mutation inconnue : ' + MUTATION); process.exit(1); }
  if (SQL && m && m.sql) SQL = m.sql(SQL);   // une ancre introuvable lève ici : « ancre introuvable », jamais vert
  // Une mutation qui change le TEXTE d'une contrainte change son empreinte : sans recalage, le bloc 1c refuserait
  // l'installation de la migration mutée elle-même, et la mutation passerait au rouge pour une MAUVAISE raison
  // (« vrm_agent_forme ») — sans prouver que le contrôle R18 mord. On recalcule donc l'empreinte de la migration
  // mutée (installée une fois, forme neutralisée, sur une base jetable) : c'est le contrôle R18 qui doit tomber.
  if (SQL && m && m.contraintes) await essaie('recaler l\'empreinte de la migration mutée (le texte de ses contraintes change)', () => {
    Q('drop database if exists empreinte', { db: 'postgres', role: 'supabase_admin' });
    Q('create database empreinte template socle owner postgres', { db: 'postgres', role: 'supabase_admin' });
    const r = run(remplace(SQL, '    if v is distinct from a then\n', '    if false then\n', 'recaler'), { db: 'empreinte' });
    if (!r.ok) throw new Error('migration mutée : ' + r.err.slice(0, 200));
    const forme = /\n {4}select (coalesce\(\(select string_agg\(x\.attname[\s\S]*?)\n {6}into v\n/.exec(SQL);
    const bloc = /\$empreinte\$(\{[\s\S]*?\})\$empreinte\$/.exec(SQL);
    if (!forme || !bloc) throw new Error('forme ou empreinte introuvable dans la migration mutée');
    const tabs = Object.keys(JSON.parse(bloc[1]));
    const v = run(`select json_object_agg(t, (select ${forme[1]} from pg_catalog.pg_class c where c.oid = pg_catalog.to_regclass('public.' || t))) from unnest(array[${tabs.map((x) => `'${x}'`).join(',')}]::text[]) t;`, { db: 'empreinte' });
    if (!v.ok) throw new Error('empreinte : ' + v.err.slice(0, 200));
    const e = JSON.parse(v.out);
    const neuf = '{\n' + tabs.map((x) => '    ' + JSON.stringify(x) + ': ' + JSON.stringify(e[x])).join(',\n') + '\n  }';
    SQL = SQL.slice(0, bloc.index) + '$empreinte$' + neuf + '$empreinte$' + SQL.slice(bloc.index + bloc[0].length);
  });
  if (m && m.outil) { OUTIL = path.join(DIR, 'essai-annule.cjs'); fs.writeFileSync(OUTIL, m.outil(fs.readFileSync(OUTIL_SRC, 'utf8'))); }
  const FMIG = path.join(DIR, 'migration.sql');
  await essaie('appliquer la migration', () => {
    if (!SQL) throw new Error('migration absente');
    fs.writeFileSync(FMIG, SQL);
    const r = run(SQL, { db: 'gabarit' });
    dit(r.ok, 'la migration s\'applique, en tant que `postgres` (non superutilisateur), en une transaction', r.ok ? '' : r.err.slice(0, 300));
    const r2 = run(SQL, { db: 'gabarit' });
    dit(r2.ok, 'la réinstaller une seconde fois ne lève rien', r2.ok ? '' : r2.err.slice(0, 200));
  });
  await essaie('ce que le fichier ne contient pas', () => {
    const sansCommentaires = (SQL || '').split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
    dit(!!SQL && !/\bdrop\s+(table|function|trigger|policy|schema|index|extension|view|type)\b/i.test(sansCommentaires), 'aucune instruction DROP (l\'outil SQL attend une confirmation humaine pour un DROP)');
    dit(!!SQL && !/create\s+extension|cron\.schedule|net\.http_/i.test(sansCommentaires), 'ni pg_cron ni pg_net : l\'horloge est la 015, sur le oui de Julien');
  });
  await essaie('le réglage et l\'horloge', () => {
    dit(Q("select valeur from public.vrm_reglages where cle = 'agent_ebay'") === '0', 'vrm_reglages.agent_ebay vaut \'0\' (rien ne tourne)');
    const h = Q("select id || '|' || dernier_tic || '|' || dernier_battement || '|' || dernier_succes from public.vrm_agent_horloge");
    dit(h === '1|-infinity|-infinity|-infinity', 'la ligne d\'horloge existe, à « -infinity » partout [D14]', h || '(aucune ligne)');
    A("update public.vrm_reglages set valeur = 'proprietaire' where cle = 'agent_ebay'");
    const r = run(SQL, { db: 'gabarit' });
    dit(r.ok && Q("select valeur from public.vrm_reglages where cle = 'agent_ebay'") === 'proprietaire', 'un réglage déjà posé n\'est jamais écrasé par une réinstallation');
    A("update public.vrm_reglages set valeur = '0' where cle = 'agent_ebay'");
  });
  await essaie('une table d\'une forme ANCIENNE n\'est jamais réutilisée en silence', () => {
    if (!SQL) throw new Error('migration absente');
    fraiche('ancienne', 'socle');
    // La file d'une version plus ancienne (sans `reveil`), comme le rapporte la revue.
    Q(`create table public.vrm_agent_file (owner uuid not null, cle text not null, groupe text not null, prochain timestamptz not null,
         bail_jeton uuid, bail_jusqua timestamptz, essais integer not null default 0, raison text, primary key (owner, cle));`);
    const r = run(SQL, { db: 'ancienne' });
    dit(refuse(r, /vrm_agent_forme/) && /vrm_agent_file/.test(r.err), 'la migration REFUSE de s\'installer sur une table d\'une autre forme, et la nomme (« vrm_agent_forme »)', r.ok ? 'installée' : r.err.slice(0, 160));
    dit(Q("select count(*) from pg_class where relname in ('vrm_agent_journal', 'vrm_agent_commandes')") === '0' && Q("select count(*) from pg_proc where proname like 'vrm\\_agent\\_%'") === '0',
      'et elle n\'a RIEN installé (une transaction)');
    // [revue 2] Les MÊMES colonnes et les MÊMES noms de contraintes, mais des contraintes R18 vides de sens
    // (une version d'avant) : la forme ne comparait que les NOMS — la table était réutilisée en silence, et la
    // vérification rendait ok pendant qu'une commande rangeait l'adresse de l'acheteur.
    fraiche('ancienne2', 'socle');
    const ddl = SQL.slice(SQL.indexOf('create table if not exists public.vrm_agent_commandes'), SQL.indexOf('create table if not exists public.vrm_agent_journal'))
      .replace(/constraint vrm_agent_commandes_data check \([\s\S]*?\),\n  constraint vrm_agent_commandes_en_cours/, "constraint vrm_agent_commandes_data check (jsonb_typeof(data) = 'object'),\n  constraint vrm_agent_commandes_en_cours")
      .replace(/constraint vrm_agent_commandes_shipto check \([\s\S]*?\)\)\);\s*$/, 'constraint vrm_agent_commandes_shipto check (true));\n');
    Q('create function public.vrm_agent_sans_acheteur(j jsonb) returns boolean language sql immutable as $$ select true $$;\n' + ddl);
    const posees = Q(`select string_agg(pg_get_constraintdef(oid), ' | ' order by conname) from pg_constraint where conrelid = 'public.vrm_agent_commandes'::regclass and conname in ('vrm_agent_commandes_data', 'vrm_agent_commandes_shipto')`);
    if (!/jsonb_typeof\(data\) = 'object'::text\)\) \| CHECK \(true\)$/.test(posees)) throw new Error('la table d\'avant n\'a pas la forme voulue (contrôle vacant) : ' + posees);
    const r2 = run(SQL, { db: 'ancienne2' });
    dit(refuse(r2, /vrm_agent_forme/) && /vrm_agent_commandes/.test(r2.err), 'une table d\'avant aux MÊMES noms de contraintes mais d\'un autre TEXTE (`check (true)` sous le nom R18) : la migration REFUSE de s\'installer, et nomme la table [revue 2]', r2.ok ? 'installée' : r2.err.slice(0, 200));
    dit(Q("select count(*) from pg_class where relname = 'vrm_agent_journal'") === '0' && Q("select count(*) from pg_proc where proname like 'vrm\\_agent\\_%' and proname <> 'vrm_agent_sans_acheteur'") === '0',
      'et elle n\'a RIEN installé (une transaction)');
    DB = 'gabarit';
  });
  // La mutation posée APRÈS l'installation (une réinstallation la défait : `create or replace trigger`).
  if (m && m.apres) await essaie('poser la mutation', () => Q(m.apres));
  await essaie('l\'essai annulé (la méthode de la 013), la vérification, les morceaux', () => {
    if (!SQL) throw new Error('migration absente');
    const essai = spawnSync(process.execPath, [OUTIL, '--migration=' + FMIG], { encoding: 'utf8' });
    if (essai.status !== 0) throw new Error('essai-annule : ' + essai.stderr.slice(0, 200));
    dit(Buffer.byteLength(essai.stdout) < 92000, `l'essai tient sous les 92 Ko que l'outil SQL a refusés d'un bloc pour la 013 (${Buffer.byteLength(essai.stdout)} octets, indentation et commentaires retirés ; NON mesuré que l'outil l'accepte — sinon, les morceaux)`);
    Q('create database essai template socle owner postgres;', { db: 'postgres', role: 'supabase_admin' });
    const r = run(essai.stdout, { db: 'essai' });
    const j = r.ok ? JSON.parse(r.out.split('\n').filter(Boolean).pop()) : null;
    dit(!!j && j.tables === 16 && j.rls_force === 16 && j.agent_ebay === '0' && j.horloge === 1 && j.marques === 0 && j.navigateur_ecrit === null && j.fonctions_ouvertes === null,
      'l\'essai installe tout et rend son rapport (16 tables à RLS forcé, horloge, réglage, aucun droit de navigateur)', r.ok ? JSON.stringify(j).slice(0, 240) : r.err.slice(0, 200));
    const reste = run(`select (select count(*) from pg_class where relname like 'vrm\\_agent\\_%' or relname like 'vrm\\_ebay\\_%' or relname = 'vrm_coffre') || '|' || (select count(*) from pg_trigger where tgname like 'vrm\\_garde\\_ebay%') || '|' || (select count(*) from public.vrm_reglages where cle = 'agent_ebay') || '|' || (select count(*) from pg_proc where proname like 'vrm\\_agent\\_%')`, { db: 'essai' });
    dit(reste.ok && reste.out === '0|0|0|0', 'l\'essai ne laisse RIEN derrière lui (ROLLBACK)', reste.ok ? reste.out : reste.err.slice(0, 160));
    const v = verifier(FMIG, 'gabarit');
    dit(v.ok === true, 'la vérification (lecture seule) rend ok sur la base installée : forme, RLS forcé, droits exacts, règles, fonctions (md5, SECURITY DEFINER, une seule version), déclencheurs actifs', JSON.stringify(v.ok ? v.ecarts : { e: v.ecarts, f: v.fonctions_differentes, fo: v.formes_differentes, d: v.declencheurs_absents, dr: v.etat && v.etat.droits }).slice(0, 400));
    // Le repli si l'outil SQL refuse le bloc entier : trois transactions, chaque objet né FERMÉ.
    const DM = path.join(DIR, 'morceaux');
    const mo = spawnSync(process.execPath, [OUTIL, '--morceaux', '--dossier=' + DM, '--migration=' + FMIG], { encoding: 'utf8' });
    if (mo.status !== 0) throw new Error('morceaux : ' + mo.stderr.slice(0, 200));
    Q('create database morceaux template socle owner postgres;', { db: 'postgres', role: 'supabase_admin' });
    const ouverts = [], tailles = [];
    const verMorceaux = spawnSync(process.execPath, [OUTIL, '--verifier', '--migration=' + FMIG], { encoding: 'utf8' }).stdout;
    for (let i = 1; i <= 3; i++) {
      const f = fs.readFileSync(path.join(DM, `014-morceau-${i}.sql`), 'utf8');
      tailles.push(Buffer.byteLength(f));
      const a = run(f, { db: 'morceaux' }), b = run(f, { db: 'morceaux' });
      if (!a.ok || !b.ok) { ouverts.push(`morceau ${i} : ${(a.err || b.err).slice(0, 120)}`); continue; }
      const e = run(verMorceaux, { db: 'morceaux' });
      const je = e.ok ? JSON.parse(e.out.split('\n').filter(Boolean).pop()) : null;
      if (!je || je.etat.navigateur_ecrit !== null || je.etat.fonctions_ouvertes !== null) ouverts.push(`après le morceau ${i} : ${e.ok ? JSON.stringify({ n: je.etat.navigateur_ecrit, f: je.etat.fonctions_ouvertes }) : e.err.slice(0, 120)}`);
      if (i === 3) dit(!!je && je.ok === true, 'appliquée en trois morceaux, la vérification rend ok', je ? JSON.stringify(je.ecarts) : '');
    }
    dit(ouverts.length === 0, 'en morceaux, aucun objet n\'est jamais ouvert au navigateur entre deux transactions, et chaque morceau se réapplique sans lever', ouverts.join(' · ').slice(0, 300));
    dit(tailles.length === 3 && tailles.every((x) => x < 46000), `chaque morceau fait moins de 46 Ko (${tailles.join(' · ')} octets)`);
  });
  await essaie('la vérification voit CHAQUE garde touchée [revue : « ok » sur une installation dénaturée]', () => {
    const cas = [
      ['la garde des jetons suspendue (le retour arrière documenté)', 'alter table public.app_data disable trigger vrm_garde_ebay_tokens_maj;', 'declencheurs'],
      ['la garde du journal suspendue', 'alter table public.vrm_agent_journal disable trigger vrm_agent_journal_garde;', 'declencheurs'],
      ['la pierre tombale suspendue sur le coffre', 'alter table public.vrm_coffre disable trigger vrm_agent_pierre_tombale;', 'declencheurs'],
      ['la trace des écritures suspendue', 'alter table public.vrm_agent_commandes disable trigger vrm_noter_ecriture;', 'declencheurs'],
      ['abonnement_requis retirée des commandes', 'drop policy abonnement_requis on public.vrm_agent_commandes;', 'regles'],
      ['la lecture de soi élargie à tous', 'alter policy agent_lecture_soi on public.vrm_agent_journal using (true);', 'regles'],
      ['reserver passée en SECURITY INVOKER', 'alter function public.vrm_agent_reserver(uuid, text, integer, integer, integer, integer, integer, timestamptz) security invoker;', 'fonctions'],
      ['prendre sans search_path figé', 'alter function public.vrm_agent_prendre(integer, uuid, integer, timestamptz) reset search_path;', 'fonctions'],
      ['une seconde version de noter', 'create function public.vrm_agent_noter(p uuid) returns bigint language sql as $$ select 1::bigint $$;', 'fonctions'],
      ['l\'aide « heure » exécutable par le serveur', 'grant execute on function public.vrm_agent_heure(timestamptz) to service_role;', 'fonctions'],
      ['la file sans FORCE RLS', 'alter table public.vrm_agent_file no force row level security;', 'rls'],
      ['le coffre lisible par un navigateur', 'grant select on public.vrm_coffre to authenticated;', 'droits'],
      ['le journal écrit directement par le serveur', 'grant insert on public.vrm_agent_journal to service_role;', 'droits'],
      ['les commandes vidées par un navigateur (TRUNCATE)', 'grant truncate on public.vrm_agent_commandes to authenticated;', 'droits'],
      ['la séquence du journal au serveur', 'grant usage on sequence public.vrm_agent_journal_id_seq to service_role;', 'sequence'],
      ['une colonne de plus dans la file', 'alter table public.vrm_agent_file add column z integer;', 'formes'],
      ['les codes R18 retirés des commandes', 'alter table public.vrm_agent_commandes drop constraint vrm_agent_commandes_codes;', 'formes'],
      ['une marque de transaction laissée', "insert into public.vrm_agent_marques (xid, quoi, avant) values (1, 'purger', 'infinity');", 'marques'],
      ['l\'horloge simulée posée sur la base', 'alter database {db} set vrm.horloge_simulee = \'1\';', 'simulee'],
      // [revue 2] Une garde affaiblie sous le MÊME nom : condition ou évènements d'un déclencheur, texte d'une
      // contrainte, droit de COLONNE, volatilité de la pierre tombale.
      ['la garde des jetons recréée sous le même nom, WHEN (false)', 'create or replace trigger vrm_garde_ebay_tokens_maj before update on public.app_data for each row when (false) execute function public.vrm_garde_ebay_tokens();', 'declencheurs'],
      ['la garde du journal recréée pour UPDATE seulement (plus DELETE)', 'create or replace trigger vrm_agent_journal_garde before update on public.vrm_agent_journal for each row execute function public.vrm_agent_journal_garde();', 'declencheurs'],
      ['la garde du journal recréée « UPDATE OF texte » (contournée en ne touchant pas texte)', 'create or replace trigger vrm_agent_journal_garde before update of texte or delete on public.vrm_agent_journal for each row execute function public.vrm_agent_journal_garde();', 'declencheurs'],
      ['la pierre tombale de la file recréée pour INSERT seulement', 'create or replace trigger vrm_agent_pierre_tombale before insert on public.vrm_agent_file for each row execute function public.vrm_agent_refuser_efface();', 'declencheurs'],
      ['R18 : la contrainte des données de commande recréée sous le même nom, check (true)', 'alter table public.vrm_agent_commandes drop constraint vrm_agent_commandes_data; alter table public.vrm_agent_commandes add constraint vrm_agent_commandes_data check (true);', 'formes'],
      ['les 100 jours des mémos recréés sous le même nom, check (true)', 'alter table public.vrm_agent_memos drop constraint vrm_agent_memos_cent_jours; alter table public.vrm_agent_memos add constraint vrm_agent_memos_cent_jours check (true);', 'formes'],
      ['les mémos écrits DIRECTEMENT par le serveur (droit de COLONNE)', 'grant insert (owner, cle, at, expire) on public.vrm_agent_memos to service_role;', 'droits_colonnes'],
      ['un bail volé DIRECTEMENT par le serveur (droit de COLONNE)', 'grant update (bail_jeton, bail_jusqua) on public.vrm_agent_file to service_role;', 'droits_colonnes'],
      ['la pierre tombale relue sur un instantané figé (STABLE)', 'alter function public.vrm_agent_efface(uuid) stable;', 'fonctions'],
    ];
    const vus = [];
    cas.forEach(([nom, sql, partie], i) => {
      fraiche('denat' + i);
      Q(sql.replace('{db}', DB), { role: 'supabase_admin' });
      const v = verifier(FMIG, DB);
      if (v.ok !== false || !(v.ecarts || []).includes(partie)) vus.push(`${nom} → ok=${v.ok} ${JSON.stringify(v.ecarts)}`);
    });
    dit(vus.length === 0, `la vérification rend ok = false, en nommant ce qui diffère, pour chacune des ${cas.length} dénaturations (déclencheurs suspendus OU recréés sous le même nom, règles, fonctions et leur volatilité, RLS, droits de table ET de colonne, séquence, forme et texte des contraintes, marque, horloge simulée)`, vus.join(' · ').slice(0, 500));
    DB = 'gabarit';
  });
  const TABLES = ['vrm_agent_vendeurs', 'vrm_agent_commandes', 'vrm_agent_journal', 'vrm_agent_file', 'vrm_agent_compteurs', 'vrm_agent_vus',
    'vrm_agent_memos', 'vrm_agent_routes', 'vrm_agent_horloge', 'vrm_ebay_cles_publiques', 'vrm_coffre', 'vrm_ebay_titulaires',
    'vrm_ebay_annonces_index', 'vrm_agent_preuves', 'vrm_agent_effaces', 'vrm_agent_marques'];
  const LISIBLES = ['vrm_agent_vendeurs', 'vrm_agent_commandes', 'vrm_agent_journal'];
  const SERVEUR = TABLES.filter((x) => !LISIBLES.includes(x));
  const FONCTIONS = ['vrm_agent_prendre', 'vrm_agent_prendre_cle', 'vrm_agent_rendre', 'vrm_agent_planifier', 'vrm_agent_ecrire_commande',
    'vrm_agent_premiere_fois', 'vrm_agent_vu', 'vrm_agent_reserver', 'vrm_agent_rendre_reservation', 'vrm_agent_quota',
    'vrm_agent_quota_recaler', 'vrm_agent_noter', 'vrm_agent_anonymiser_journal', 'vrm_agent_horloge_battre', 'vrm_agent_horloge_succes',
    'vrm_agent_titulaire', 'vrm_agent_titulaire_liberer', 'vrm_ebay_indexer_annonces', 'vrm_agent_preuve_vue', 'vrm_agent_effacer_vendeur',
    'vrm_agent_purger'];
  await essaie('le catalogue', () => {
    const rls = Q(`select string_agg(relname, ',' order by relname) from pg_class where relnamespace = 'public'::regnamespace and relname = any(array[${TABLES.map((x) => `'${x}'`).join(',')}]) and relrowsecurity and relforcerowsecurity`);
    dit(rls.split(',').filter(Boolean).length === TABLES.length, `RLS activé ET forcé sur les ${TABLES.length} tables de l'agent`, rls);
    const pol = Q(`select coalesce(string_agg(tablename || ':' || policyname || ':' || permissive || ':' || cmd, ' ' order by tablename, policyname), '') from pg_policies where schemaname = 'public' and tablename = any(array[${TABLES.map((x) => `'${x}'`).join(',')}])`);
    const attendu = LISIBLES.slice().sort().map((x) => `${x}:abonnement_requis:RESTRICTIVE:ALL ${x}:agent_lecture_soi:PERMISSIVE:SELECT`).join(' ');
    dit(pol === attendu, 'les tables lisibles n\'ont QUE la lecture de soi et la restrictive abonnement_requis ; les tables du serveur n\'ont AUCUNE règle', pol.slice(0, 300));
    const f = QJ(`select json_agg(json_build_object('n', p.proname, 'def', p.prosecdef, 'cfg', p.proconfig, 'acl', coalesce(p.proacl::text, ''))) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any(array[${FONCTIONS.map((x) => `'${x}'`).join(',')}])`) || [];
    const noms = new Set(f.map((x) => x.n));
    dit(FONCTIONS.every((x) => noms.has(x)) && f.length === FONCTIONS.length, `les ${FONCTIONS.length} fonctions existent, une version chacune`, FONCTIONS.filter((x) => !noms.has(x)).join(', ') + ' ' + f.length);
    const fautives = f.filter((x) => !x.def || !(x.cfg || []).includes('search_path=""') || /(^|[{,])(=|anon=|authenticated=)X/.test(x.acl) || !/service_role=X/.test(x.acl));
    dit(f.length > 0 && fautives.length === 0, 'chacune : SECURITY DEFINER, search_path vide, exécutable par service_role SEULEMENT', fautives.map((x) => x.n + ' ' + x.acl).join(' · '));
    const aides = QJ(`select json_agg(p.proname) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('vrm_agent_heure', 'vrm_agent_efface', 'vrm_agent_sans_acheteur', 'vrm_agent_refuser_efface', 'vrm_agent_journal_garde', 'vrm_garde_ebay_tokens')
                        and (has_function_privilege('service_role', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))`);
    dit(aides === null, 'les aides internes (heure, pierre tombale, R18, gardes) ne sont exécutables par PERSONNE', JSON.stringify(aides));
  });

  // ── 2. QUI LIT, QUI ÉCRIT ─────────────────────────────────────────────────
  console.log('\n2. QUI LIT, QUI ÉCRIT (RLS, droits, abonnement)');
  await essaie('préparer', () => {
    fraiche('droits');
    A(`insert into public.vrm_agent_vendeurs (owner, actif) values ('${J}', true), ('${V}', true);
       insert into public.vrm_agent_commandes (owner, compte, commande, etape, rang) values ('${J}', 's1', 'O-J1', 'payee', 1), ('${J}', 's1', 'O-J2', 'payee', 1), ('${V}', 's9', 'O-V1', 'payee', 1);
       insert into public.vrm_agent_file (owner, cle, groupe, prochain) values ('${J}', 'ebay:s1:veille', 's1', now());
       insert into public.vrm_coffre (owner, compte, fournisseur, v, nonce, chiffre, tag) values ('${J}', 's1', 'ebay', 1, '\\x000102030405060708090a0b', '\\x00', '\\x000102030405060708090a0b0c0d0e0f');`);
    S(`select public.vrm_agent_noter('${J}', '{"geste":"retrait","resultat":"fait","cible":"O-J1","texte":"retirée d''eBay"}', ${t(0)}); select public.vrm_agent_noter('${V}', '{"geste":"retrait","resultat":"fait","cible":"O-V1"}', ${t(0)});`);
  });
  await essaie('le vendeur lit SES lignes, jamais celles d\'un autre', () => {
    const lu = (u) => Q(COMME.vendeur(u) + `select (select count(*) from public.vrm_agent_vendeurs) || '|' || (select count(*) from public.vrm_agent_commandes) || '|' || (select count(*) from public.vrm_agent_journal) || '|' || (select count(*) from public.vrm_agent_commandes where owner <> '${u}');`);
    dit(lu(J) === '1|2|1|0', 'le vendeur J lit 1 réglage, SES 2 commandes, SON journal, et aucune ligne d\'un autre', lu(J));
    dit(lu(V) === '1|1|1|0', 'le vendeur V lit les siennes seulement', lu(V));
  });
  await essaie('le vendeur ne lit RIEN de ce qui est au serveur', () => {
    const lues = SERVEUR.filter((x) => run(COMME.vendeur(J) + `select count(*) from public.${x};`, { db: DB }).ok);
    dit(lues.length === 0, 'file, compteurs, mémos, vus, routes, horloge, clés, coffre, titulaires, index, preuves, pierres tombales, marques : « permission refusée » pour le navigateur', lues.join(', '));
    const anon = TABLES.filter((x) => run(COMME.anon + `select count(*) from public.${x};`, { db: DB }).ok);
    dit(anon.length === 0, 'la clé publique (anon) ne lit RIEN, pas même les tables lisibles', anon.join(', '));
  });
  await essaie('le navigateur n\'écrit RIEN — TRUNCATE compris', () => {
    const ecrit = [];
    for (const x of TABLES) {
      const col = x === 'vrm_agent_horloge' ? 'id' : x === 'vrm_ebay_cles_publiques' ? 'kid' : x === 'vrm_agent_marques' ? 'xid' : 'owner';
      const essais = [`insert into public.${x} default values;`, `update public.${x} set ${col} = ${col};`, `delete from public.${x};`, `truncate public.${x};`];
      if (x === 'vrm_agent_commandes') essais.unshift(`insert into public.vrm_agent_commandes (owner, compte, commande, etape, rang) values ('${J}', 's1', 'O-FAUX', 'payee', 1);`);
      if (x === 'vrm_agent_vendeurs') essais.unshift(`update public.vrm_agent_vendeurs set actif = false where owner = '${J}';`);
      for (const qui of [COMME.vendeur(J), COMME.anon]) {
        for (const sql of essais) {
          const r = run(qui + sql, { db: DB });
          if (r.ok || !/permission denied|row-level security|violates|null value|not-null/.test(r.err)) ecrit.push(x + ' ← ' + sql.slice(0, 40) + (r.ok ? ' (passé)' : ' (' + r.err.slice(0, 60) + ')'));
        }
      }
    }
    // L'issue qui compte : la base n'a pas bougé.
    const apres = A(`select (select count(*) from public.vrm_agent_commandes where commande = 'O-FAUX') || '|' || (select count(*) from public.vrm_agent_vendeurs where actif) || '|' || (select count(*) from public.vrm_agent_commandes) || '|' || (select count(*) from public.vrm_agent_journal)`);
    dit(ecrit.length === 0 && apres === '0|2|3|2', 'ni un vendeur connecté ni la clé publique ne peuvent créer, modifier, effacer ou VIDER (TRUNCATE) une ligne d\'aucune table de l\'agent (pas même SES commandes)', (ecrit.join(' · ') + ' ' + apres).slice(0, 400));
  });
  await essaie('le navigateur n\'appelle aucune fonction', () => {
    const appels = [`select public.vrm_agent_prendre(8, '${uuid(1)}', 120);`, `select public.vrm_agent_premiere_fois('${J}', 'msg:O1:x');`,
      `select public.vrm_agent_titulaire('0123456789abcdef', '${J}', 's1');`, `select public.vrm_agent_reserver('${J}', 's1', 100, 9999, 9, 9999, 9999);`,
      `select public.vrm_agent_effacer_vendeur('${V}');`, `select public.vrm_agent_horloge_battre();`, `select public.vrm_agent_heure(now());`];
    const passes = appels.filter((sql) => run(COMME.vendeur(J) + sql, { db: DB }).ok || run(COMME.anon + sql, { db: DB }).ok);
    dit(passes.length === 0, 'aucune fonction de l\'agent n\'est exécutable par un navigateur (connecté ou non)', passes.join(' · '));
  });
  await essaie('le serveur n\'écrit les tables à garantie QUE par leurs fonctions — ni INSERT, ni TRUNCATE', () => {
    const lignes = {
      vrm_agent_file: `(owner, cle, groupe, prochain) values ('${J}', 'zz', 'g', now())`,
      vrm_agent_commandes: `(owner, compte, commande, etape, rang) values ('${J}', 's1', 'OZ', 'payee', 1)`,
      vrm_agent_journal: `(owner, geste, resultat, at) values ('${J}', 'x', 'fait', '2020-01-01')`,
      vrm_agent_compteurs: `(owner, cle) values ('${J}', 'zz')`,
      vrm_agent_memos: `(owner, cle, at, expire) values ('${N}', 'achat:OZ', '2020-01-01', '2020-06-01')`,
      vrm_ebay_titulaires: `(cle_ebay, owner, compte) values ('ffffffffffffffff', '${J}', 'zz')`,
      vrm_ebay_annonces_index: `(listing_id, owner, compte) values ('123456789', '${J}', 's1')`,
      vrm_agent_preuves: `(owner, numero_cle, source, ref) values ('${J}', '1', 'v', 'r')`,
      vrm_agent_horloge: `(id) values (1)`,
      vrm_agent_effaces: `(owner) values ('${V}')`,
      vrm_agent_marques: `(xid, quoi, avant) values (1, 'purger', 'infinity')`,
    };
    const passe = [];
    for (const [x, ligne] of Object.entries(lignes)) {
      const col = x === 'vrm_agent_horloge' ? 'id' : x === 'vrm_agent_marques' ? 'xid' : 'owner';
      for (const sql of [`insert into public.${x} ${ligne};`, `update public.${x} set ${col} = ${col};`, `delete from public.${x};`, `truncate public.${x};`]) {
        const r = run(COMME.serveur + sql, { db: DB });
        if (r.ok || !/permission denied/.test(r.err)) passe.push(x + ' ← ' + sql.slice(0, 24) + (r.ok ? ' (passé)' : ' (' + r.err.slice(0, 50) + ')'));
      }
    }
    dit(passe.length === 0, 'même la clé de service ne peut ni insérer, ni réécrire, ni effacer, ni vider la file, les commandes, le journal, les compteurs, les mémos, les titulaires, l\'index, les preuves, l\'horloge, les pierres tombales, les marques sans passer par leurs fonctions', passe.join(' · ').slice(0, 400));
    dit(!run(COMME.serveur + 'select count(*) from public.vrm_agent_marques;', { db: DB }).ok, 'les marques de transaction ne se lisent pas, même par le serveur');
    const r = run(COMME.serveur + `update public.vrm_agent_vendeurs set pouls = '{"vu":1}' where owner = '${J}'; select count(*) from public.vrm_agent_file;`, { db: DB });
    dit(r.ok && r.out === '1', 'l\'autre sens : le serveur LIT tout, et écrit les réglages et le pouls d\'un vendeur', r.ok ? r.out : r.err.slice(0, 120));
  });
  await essaie('qui ne paie plus ne voit plus rien (abonnement_requis)', () => {
    A(`update public.vrm_reglages set valeur = '1' where cle = 'abonnement_obligatoire'; update public.vrm_reglages set valeur = '${J}' where cle = 'proprietaire';`);
    const lu = (u) => Q(COMME.vendeur(u) + `select (select count(*) from public.vrm_agent_vendeurs) || '|' || (select count(*) from public.vrm_agent_commandes) || '|' || (select count(*) from public.vrm_agent_journal);`);
    dit(lu(V) === '0|0|0', 'abonnement obligatoire, V sans abonnement : il ne voit ni son pouls, ni ses commandes, ni son journal', lu(V));
    dit(lu(J) === '1|2|1', 'l\'autre sens : le propriétaire de l\'installation voit toujours les siennes', lu(J));
    A(`insert into auth.users (id) values ('${V}') on conflict do nothing; insert into public.abonnements (owner, statut) values ('${V}', 'active');`);
    dit(lu(V) === '1|1|1', 'et V voit les siennes dès qu\'il paie', lu(V));
    A(`update public.vrm_reglages set valeur = '0' where cle = 'abonnement_obligatoire';`);
  });
  await essaie('la trace des écritures (le jumeau de noter_ecriture)', () => {
    const n = A(`select string_agg(distinct tbl, ',' order by tbl) from sauvegarde.journal_ecritures where tbl like 'vrm_agent_%'`);
    dit(n === 'vrm_agent_commandes,vrm_agent_journal,vrm_agent_vendeurs', 'chaque écriture des trois tables lisibles laisse sa trace dans sauvegarde.journal_ecritures', n);
    const id = A(`select count(*) from sauvegarde.journal_ecritures where tbl = 'vrm_agent_commandes' and row_id = '${J}|ebay:s1:O-J1'`);
    dit(id === '1', 'la trace nomme la ligne (vendeur|plateforme:compte:commande)', id);
  });

  // ── 3. LA GARDE DES JETONS eBAY ───────────────────────────────────────────
  console.log('\n3. LA GARDE D\'ÉCRITURE SUR ebay_tokens*');
  await essaie('le navigateur', () => {
    fraiche('jetons');
    S(`insert into public.app_data (owner, id, data) values ('${J}', 'ebay_tokens', '{"refresh_token":"VIEUX"}'), ('${J}', 'main', '{}');`);
    const essais = {
      'créer ebay_tokens_{cle}': `insert into public.app_data (owner, id, data) values ('${J}', 'ebay_tokens_0123456789abcdef', '{"refresh_token":"VOLE"}');`,
      'réécrire ebay_tokens': `update public.app_data set data = '{"refresh_token":"VOLE"}' where owner = '${J}' and id = 'ebay_tokens';`,
      'effacer ebay_tokens': `delete from public.app_data where owner = '${J}' and id = 'ebay_tokens';`,
      'renommer main en ebay_tokens_x': `update public.app_data set id = 'ebay_tokens_x' where owner = '${J}' and id = 'main';`,
      'upsert comme l\'app': `insert into public.app_data (owner, id, data) values ('${J}', 'ebay_tokens', '{"refresh_token":"VOLE"}') on conflict (owner, id) do update set data = excluded.data;`,
    };
    const passes = Object.entries(essais).filter(([, sql]) => !refuse(run(COMME.vendeur(J) + sql, { db: DB }), /vrm_ebay_tokens_serveur/)).map(([k]) => k);
    dit(passes.length === 0, 'un vendeur connecté ne peut ni créer, ni réécrire, ni effacer, ni renommer une ligne ebay_tokens* (refus nommé « vrm_ebay_tokens_serveur »)', passes.join(' · '));
    dit(A(`select data->>'refresh_token' from public.app_data where owner = '${J}' and id = 'ebay_tokens'`) === 'VIEUX'
      && A(`select count(*) from public.app_data where id like 'ebay\\_tokens%'`) === '1', 'le jeton rangé n\'a pas bougé');
    // Le jeton dit « authenticated » même quand le rôle courant est un autre (fonction SECURITY DEFINER) :
    const r = run(`set "request.jwt.claims" = '{"sub":"${J}","role":"authenticated"}'; update public.app_data set data = '{"refresh_token":"VOLE"}' where owner = '${J}' and id = 'ebay_tokens';`, { db: DB });
    dit(refuse(r, /vrm_ebay_tokens_serveur/), 'une écriture qui porte un jeton de navigateur est refusée même sous un autre rôle (auth.role())', r.ok ? 'passée' : r.err.slice(0, 80));
    // Et l'autre moitié : le RÔLE courant, quand le jeton ne dit pas son rôle.
    const r2 = run(`set role authenticated; set "request.jwt.claims" = '{"sub":"${J}"}'; update public.app_data set data = '{"refresh_token":"VOLE"}' where owner = '${J}' and id = 'ebay_tokens';`, { db: DB });
    dit(refuse(r2, /vrm_ebay_tokens_serveur/) && A(`select data->>'refresh_token' from public.app_data where owner = '${J}' and id = 'ebay_tokens'`) === 'VIEUX',
      'une écriture sous le rôle « authenticated » dont le jeton ne dit pas son rôle est refusée aussi (rôle courant)', r2.ok ? 'passée' : r2.err.slice(0, 80));
  });
  await essaie('l\'autre sens', () => {
    const r1 = run(COMME.vendeur(J) + `update public.app_data set data = '{"a":1}' where owner = '${J}' and id = 'main'; insert into public.app_data (owner, id, data) values ('${J}', 'ebay_listings', '{}');`, { db: DB });
    dit(r1.ok, 'le navigateur écrit toujours ses autres lignes (main, ebay_listings) : la garde ne vise que les jetons', r1.ok ? '' : r1.err.slice(0, 120));
    const r2 = run(COMME.serveur + `update public.app_data set data = '{"refresh_token":"NEUF"}' where owner = '${J}' and id = 'ebay_tokens';
      insert into public.app_data (owner, id, data) values ('${J}', 'ebay_tokens_0123456789abcdef', '{"refresh_token":"AUTRE"}');
      delete from public.app_data where owner = '${J}' and id = 'ebay_tokens_0123456789abcdef';`, { db: DB });
    dit(r2.ok && A(`select data->>'refresh_token' from public.app_data where owner = '${J}' and id = 'ebay_tokens'`) === 'NEUF', 'le serveur (clé de service) crée, réécrit et efface les jetons', r2.ok ? '' : r2.err.slice(0, 120));
  });

  // ── 4. LA FILE : PRENDRE, BAIL, GROUPE ────────────────────────────────────
  console.log('\n4. LA FILE (prendre, bail, un appel en vol par compte eBay)');
  await essaie('un battement : ≤ 1 par groupe, ≤ 2 par vendeur', () => {
    fraiche('file1');
    tache(J, 'a1', 'g1', -50); tache(J, 'a2', 'g1', -49); tache(J, 'b1', 'g2', -48); tache(J, 'c1', 'g3', -47); tache(V, 'v1', 'g1', -46);
    const l = prendre(8, uuid(1));
    const g = groupesDe(l);
    dit(l.length === 3 && new Set(g).size === g.length, 'jamais deux tâches d\'un même compte eBay dans un battement', JSON.stringify(l.map((x) => x.cle)));
    dit(l.filter((x) => x.owner === J).length === 2, 'au plus 2 tâches par vendeur et par battement : le second vendeur n\'attend pas derrière le premier', JSON.stringify(l.map((x) => x.cle)));
    dit(l.some((x) => x.owner === V), 'le second vendeur est servi dans le même battement');
  });
  await essaie('une tâche EN VOL dans un autre battement exclut son groupe [S24, D15]', () => {
    const l2 = prendre(8, uuid(2), 5);
    dit(!l2.some((x) => x.owner === J && x.groupe === 'g1') && !l2.some((x) => x.owner === V && x.groupe === 'g1'), 'le battement 2 ne prend AUCUNE tâche d\'un compte qui a déjà une tâche en vol', JSON.stringify(l2.map((x) => x.cle)));
    dit(l2.some((x) => x.cle === 'c1'), 'l\'autre sens : il prend la tâche d\'un compte libre', JSON.stringify(l2.map((x) => x.cle)));
  });
  await essaie('un arriéré n\'affame personne [revue : la fenêtre de candidats]', () => {
    fraiche('famine');
    A(`insert into public.vrm_agent_file (owner, cle, groupe, prochain) select '${J}', 'ebay:g1:cmd:O' || i, 'g1', ${t(-7200)} + i * interval '1 second' from generate_series(1, 250) i;
       insert into public.vrm_agent_file (owner, cle, groupe, prochain) values ('${V}', 'ebay:v1:veille', 'v1', ${t(-30)}), ('${J}', 'ebay:g2:veille', 'g2', ${t(-20)});`);
    const l = prendre(8, uuid(60));
    dit(l.some((x) => x.owner === V) && l.some((x) => x.groupe === 'g2') && l.filter((x) => x.groupe === 'g1').length === 1,
      'avec 250 tâches en retard sur UN compte, le même battement sert aussi l\'autre vendeur et l\'autre compte du vendeur', JSON.stringify(l.map((x) => x.cle)));
    fraiche('famine2');
    A(`insert into public.vrm_agent_file (owner, cle, groupe, prochain) select '${J}', 'ebay:g1:cmd:O' || i, 'g1', ${t(-7200)} + i * interval '1 second' from generate_series(1, 200) i;
       insert into public.vrm_agent_file (owner, cle, groupe, prochain, bail_jeton, bail_jusqua) values ('${J}', 'ebay:g1:cmd:CLIC', 'g1', ${t(-7300)}, '${uuid(61)}', ${t(60)});
       insert into public.vrm_agent_file (owner, cle, groupe, prochain) values ('${V}', 'ebay:v1:cmd:VENTE', 'v1', ${t(-60)});`);
    const l2 = prendre(8, uuid(62));
    dit(l2.length === 1 && l2[0].owner === V, 'un compte tenu par un clic, avec 200 tâches dues derrière lui : la tâche due de l\'autre vendeur est prise quand même', JSON.stringify(l2.map((x) => x.cle)));
  });
  await essaie('un bail expiré se reprend, un bail vivant non', () => {
    fraiche('file2');
    tache(J, 'vive', 'g1', -60, { jeton: uuid(7), jusqua: 60 });
    tache(J, 'morte', 'g2', -60, { jeton: uuid(8), jusqua: -1 });
    const l = prendre(8, uuid(9));
    dit(l.some((x) => x.cle === 'morte'), 'une tâche au bail EXPIRÉ (battement coupé) est reprise');
    dit(!l.some((x) => x.cle === 'vive'), 'une tâche au bail VIVANT n\'est jamais reprise', JSON.stringify(l.map((x) => x.cle)));
    dit(A(`select bail_jeton from public.vrm_agent_file where cle = 'morte'`) === uuid(9), 'le bail porte le jeton du battement qui l\'a prise');
  });
  await essaie('deux battements SIMULTANÉS', async () => {
    fraiche('file3');
    tache(J, 'a1', 'g1', -50); tache(J, 'a2', 'g1', -49); tache(J, 'b1', 'g2', -48); tache(J, 'b2', 'g2', -47); tache(J, 'c1', 'g3', -46); tache(J, 'd1', 'g4', -45);
    tache(V, 'v1', 'g1', -44); tache(V, 'v2', 'g1', -43);
    const sel = (jeton) => `select 'R:' || coalesce(jsonb_agg(x)::text, '[]') from public.vrm_agent_prendre(8, '${jeton}', 120, ${t(0)}) x;\n`;
    const Ap = runAsync(COMME.serveur + 'begin;\n' + sel(uuid(11)) + 'select pg_sleep(2.5);\ncommit;\n', { db: DB });
    await attendre(700);
    const B = await runAsync(COMME.serveur + sel(uuid(12)), { db: DB });
    const a = await Ap;
    const lit = (r) => { const l = r.out.split('\n').find((x) => x.startsWith('R:')); try { return JSON.parse(l ? l.slice(2) : '[]'); } catch (e) { throw new Error('sortie illisible : ' + JSON.stringify(r).slice(0, 400)); } };
    const la = lit(a), lb = lit(B);
    dit(a.ok && B.ok, 'les deux battements répondent', (a.err + ' ' + B.err).slice(0, 200));
    dit(B.ms < 1500, `un battement ne BLOQUE pas derrière un autre (skip locked) : ${B.ms} ms pendant que l'autre tient ses lignes 2,5 s`);
    const cles = la.map((x) => x.owner + x.cle), clesB = lb.map((x) => x.owner + x.cle);
    dit(la.length > 0 && lb.length > 0 && !clesB.some((k) => cles.includes(k)), 'jamais la même tâche dans deux battements', JSON.stringify({ A: la.map((x) => x.cle), B: lb.map((x) => x.cle) }));
    const ga = groupesDe(la);
    dit(!groupesDe(lb).some((g) => ga.includes(g)), 'jamais deux tâches d\'un même compte eBay EN VOL dans deux battements simultanés (verrou consultatif)', JSON.stringify({ A: la.map((x) => x.cle), B: lb.map((x) => x.cle) }));
  });
  await essaie('un battement pendant qu\'un CLIC tient sa tâche', async () => {
    fraiche('file4');
    tache(J, 'x1', 'g5', -50); tache(J, 'y1', 'g6', -40);
    const Ap = runAsync(COMME.serveur + `begin;\nselect 'R:' || public.vrm_agent_prendre_cle('${J}', 'x1', '${uuid(13)}', 120, ${t(0)});\nselect pg_sleep(2.5);\ncommit;\n`, { db: DB });
    await attendre(700);
    const B = await runAsync(COMME.serveur + `select 'R:' || coalesce(jsonb_agg(x)::text, '[]') from public.vrm_agent_prendre(8, '${uuid(14)}', 120, ${t(0)}) x;\n`, { db: DB });
    const a = await Ap;
    const lb = JSON.parse(((B.out.split('\n').find((l) => l.startsWith('R:')) || 'R:[]').slice(2)));
    dit(a.ok && B.ok && /R:t/.test(a.out), 'le clic tient sa tâche, le battement répond', (a.out + ' ' + a.err + ' ' + B.err).slice(0, 200));
    dit(B.ms < 1500, `le battement n'attend pas derrière la ligne tenue par le clic (skip locked) : ${B.ms} ms`);
    dit(!lb.some((x) => x.cle === 'x1') && lb.some((x) => x.cle === 'y1'), 'il saute la tâche tenue et prend l\'autre', JSON.stringify(lb.map((x) => x.cle)));
  });
  await essaie('le chemin « clic » prend le même bail [S15, R8]', () => {
    fraiche('clic');
    tache(J, 'ebay:s1:cmd:O1', 's1', -60, { jeton: uuid(20), jusqua: 60 });   // tenue par un battement
    tache(J, 'ebay:s2:cmd:O2', 's2', 3600);                                   // libre, pas encore due
    const pc = (cle, jeton, groupe) => S(`select public.vrm_agent_prendre_cle('${J}', '${cle}', '${jeton}', 120, ${t(0)}${groupe ? `, '${groupe}'` : ''});`);
    dit(pc('ebay:s1:cmd:O1', uuid(21)) === 'f', 'une tâche tenue par un battement est REFUSÉE au clic (la route répond 409)');
    dit(A(`select bail_jeton from public.vrm_agent_file where cle = 'ebay:s1:cmd:O1'`) === uuid(20), 'et le bail du battement est intact');
    dit(pc('ebay:s2:cmd:O2', uuid(22)) === 't', 'une tâche libre est prise par le clic');
    dit(pc('ebay:s2:cmd:O2', uuid(23)) === 'f', 'un double clic : le second est refusé');
    dit(pc('ebay:s3:cmd:O3', uuid(24), 's3') === 't' && pc('ebay:s4:cmd:O4', uuid(25)) === 'f', 'une tâche absente est créée tenue si le groupe est donné, refusée sinon');
    const l = prendre(8, uuid(26), 0);
    dit(!l.some((x) => x.cle.startsWith('ebay:s')), 'un battement ne reprend pas une tâche tenue par un clic', JSON.stringify(l.map((x) => x.cle)));
  });
  await essaie('le clic respecte le compte eBay EN VOL [revue : « jamais deux appels en vol »]', async () => {
    fraiche('clicgroupe');
    tache(J, 'ebay:s1:veille', 's1', -60); tache(J, 'ebay:s1:cmd:O1', 's1', 3600);
    const l = prendre(8, uuid(70));
    dit(l.length === 1 && l[0].cle === 'ebay:s1:veille', 'un battement tient la veille du compte s1');
    const pc = (cle, jeton, groupe) => S(`select public.vrm_agent_prendre_cle('${J}', '${cle}', '${jeton}', 120, ${t(1)}${groupe ? `, '${groupe}'` : ''});`);
    const r1 = pc('ebay:s1:cmd:O1', uuid(71)), r2 = pc('ebay:s1:cmd:O2', uuid(72), 's1'), r3 = pc('ebay:s2:cmd:O9', uuid(73), 's2');
    const enVol = A(`select count(*) from public.vrm_agent_file where owner = '${J}' and groupe = 's1' and bail_jusqua >= ${t(1)}`);
    dit(r1 === 'f' && r2 === 'f' && enVol === '1', 'le clic ne prend NI une commande existante NI une nouvelle commande d\'un compte dont la veille est en vol : un appel en vol par compte', `O1=${r1} O2=${r2} en vol=${enVol}`);
    dit(r3 === 't', 'l\'autre sens : un autre compte eBay du même vendeur reste libre');
    S(`select public.vrm_agent_rendre('${J}', 'ebay:s1:veille', '${uuid(70)}', ${t(3600)}, p_maintenant => ${t(2)});`);
    dit(pc('ebay:s1:cmd:O1', uuid(74)) === 't', 'la veille rendue, le clic prend sa commande');
    // La course : un preneur qui n'a pas encore validé tient le verrou du compte.
    fraiche('clicgroupe2');
    tache(J, 'ebay:s1:veille', 's1', -60);
    const Ap = runAsync(COMME.serveur + `begin;\nselect count(*) from public.vrm_agent_prendre(8, '${uuid(75)}', 120, ${t(0)});\nselect pg_sleep(2.5);\ncommit;\n`, { db: DB });
    await attendre(700);
    const B = await runAsync(COMME.serveur + `select 'R:' || public.vrm_agent_prendre_cle('${J}', 'ebay:s1:cmd:O5', '${uuid(76)}', 120, ${t(0)}, 's1');`, { db: DB });
    await Ap;
    dit(B.ok && /R:f/.test(B.out) && B.ms < 1500, `pendant qu'un battement prend la veille (pas encore validé), le clic sur le même compte est refusé sans attendre (verrou consultatif) : ${B.ms} ms`, B.out + ' ' + B.err.slice(0, 100));
  });
  await essaie('rendre une tâche', () => {
    fraiche('rendre');
    tache(J, 'k', 'g1', -60, { jeton: uuid(30), jusqua: 60 });
    const r = (jeton, prochain, echec = false) => S(`select public.vrm_agent_rendre('${J}', 'k', '${jeton}', ${prochain === null ? 'null' : t(prochain)}, ${echec}, 'raison', p_maintenant => ${t(1)});`);
    dit(r(uuid(31), 600) === 'f' && A(`select bail_jeton from public.vrm_agent_file where cle = 'k'`) === uuid(30), 'un autre jeton ne rend pas la tâche (le bail reste)');
    dit(r(uuid(30), 600, true) === 't', 'le bon jeton la rend');
    dit(A(`select (bail_jeton is null) || '|' || essais || '|' || (prochain = ${t(600)}) from public.vrm_agent_file where cle = 'k'`) === 'true|1|true', 'bail libéré, prochaine fois fixée, échec compté');
  });
  await essaie('« pas su » ne détruit jamais une tâche [revue : rendre(NULL) en échec]', () => {
    fraiche('rendrenull');
    const rd = (cle, jeton, extra) => S(`select public.vrm_agent_rendre('${J}', '${cle}', '${jeton}', null, ${extra}, p_maintenant => ${t(10)});`);
    tache(J, 'ebay:s1:cmd:O5', 's1', -60, { jeton: uuid(80), jusqua: 60 });
    rd('ebay:s1:cmd:O5', uuid(80), `p_echec => true, p_raison => 'ebay-503'`);
    dit(A(`select (prochain = ${t(10)} + interval '15 minutes') || '|' || essais || '|' || raison from public.vrm_agent_file where cle = 'ebay:s1:cmd:O5'`) === 'true|1|ebay-503',
      'un ÉCHEC sans prochaine fois garde la tâche (dans 15 min), avec son code : les rappels et le suivi de la commande ne disparaissent pas');
    tache(J, 'ebay:s1:cmd:O6', 's1', -60, { jeton: uuid(81), jusqua: 60 });
    rd('ebay:s1:cmd:O6', uuid(81), 'p_echec => false');
    dit(A(`select count(*) from public.vrm_agent_file where cle = 'ebay:s1:cmd:O6'`) === '1', 'pas de prochaine fois SANS « fini » explicite : la tâche reste');
    tache(J, 'ebay:s1:cmd:O7', 's1', -60, { jeton: uuid(82), jusqua: 60 });
    rd('ebay:s1:cmd:O7', uuid(82), 'p_fini => true');
    dit(A(`select count(*) from public.vrm_agent_file where cle = 'ebay:s1:cmd:O7'`) === '0', 'l\'autre sens : « fini » explicite, sans échec, retire la tâche');
    tache(J, 'ebay:s1:cmd:O8', 's1', -60, { jeton: uuid(83), jusqua: 60 });
    rd('ebay:s1:cmd:O8', uuid(83), `p_echec => true, p_fini => true`);
    dit(A(`select count(*) from public.vrm_agent_file where cle = 'ebay:s1:cmd:O8'`) === '1', '« fini » ET échec : la tâche reste (l\'échec gagne)');
    tache(J, 'ebay:s1:cmd:O9', 's1', -60, { jeton: uuid(84), jusqua: 60 });
    S(`select public.vrm_agent_rendre('${J}', 'ebay:s1:cmd:O9', '${uuid(84)}', ${t(600)}, true, 'Réponse brute : Jean Dupont, 12 rue des Lilas 35260 Cancale', p_maintenant => ${t(10)});`);
    dit(A(`select raison from public.vrm_agent_file where cle = 'ebay:s1:cmd:O9'`) === 'raison-illisible', 'une raison qui n\'est pas un CODE (une réponse brute, adresse comprise) n\'est jamais gardée (R18)');
  });
  await essaie('une sonnette pendant le bail n\'est jamais perdue', () => {
    fraiche('reveil');
    tache(J, 'k', 'g1', -60, { jeton: uuid(40), jusqua: 60 });
    S(`select public.vrm_agent_planifier('${J}', 'k', 'g1', ${t(5)}, ${t(2)});`);
    S(`select public.vrm_agent_rendre('${J}', 'k', '${uuid(40)}', ${t(3600)}, false, null, p_maintenant => ${t(10)});`);
    dit(A(`select prochain = ${t(5)} from public.vrm_agent_file where cle = 'k'`) === 't', 'la tâche rendue « dans 1 h » repasse à l\'heure de la sonnette arrivée pendant son bail');
    tache(J, 'k2', 'g1', -60, { jeton: uuid(41), jusqua: 60 });
    S(`select public.vrm_agent_planifier('${J}', 'k2', 'g1', ${t(5)}, ${t(2)});`);
    S(`select public.vrm_agent_rendre('${J}', 'k2', '${uuid(41)}', null, false, null, true, ${t(10)});`);
    dit(A(`select count(*) from public.vrm_agent_file where cle = 'k2'`) === '1', 'une tâche « finie » avec une sonnette en attente n\'est pas retirée');
    tache(J, 'k3', 'g1', -60, { jeton: uuid(42), jusqua: 60 });
    S(`select public.vrm_agent_rendre('${J}', 'k3', '${uuid(42)}', null, false, null, true, ${t(10)});`);
    dit(A(`select count(*) from public.vrm_agent_file where cle = 'k3'`) === '0', 'l\'autre sens : une tâche finie sans sonnette est retirée');
    S(`select public.vrm_agent_planifier('${J}', 'p', 'g9', ${t(100)}, ${t(0)}); select public.vrm_agent_planifier('${J}', 'p', 'g9', ${t(5000)}, ${t(0)});`);
    dit(A(`select prochain = ${t(100)} from public.vrm_agent_file where cle = 'p'`) === 't', 'planifier ne recule jamais une échéance (« au plus tard à »)');
  });
  await essaie('une sonnette sous un bail EXPIRÉ mais pas encore repris (appel lent, S15) n\'est pas perdue', () => {
    fraiche('reveil2');
    S(`select public.vrm_agent_planifier('${J}', 'ebay:s1:cmd:O3', 's1', ${t(-3600)}, ${t(-3600)});`);
    const l = prendre(8, uuid(43), 0);
    dit(l.length === 1, 'prise à 08:00:00, bail de 120 s');
    S(`select public.vrm_agent_planifier('${J}', 'ebay:s1:cmd:O3', 's1', ${t(150)}, ${t(150)});`);   // 08:02:30 : l'annulation sonne
    S(`select public.vrm_agent_rendre('${J}', 'ebay:s1:cmd:O3', '${uuid(43)}', ${t(160 + 6 * 3600)}, false, null, p_maintenant => ${t(160)});`);   // 08:02:40 : « dans 6 h »
    dit(A(`select prochain = ${t(150)} from public.vrm_agent_file where cle = 'ebay:s1:cmd:O3'`) === 't', 'le travailleur lent qui rend « dans 6 h » ne perd pas la sonnette de 08:02:30', A(`select prochain from public.vrm_agent_file where cle = 'ebay:s1:cmd:O3'`));
  });

  await essaie('le bail et l\'échéance sont BORNÉS [revue 2 : des millisecondes lues comme des secondes gelaient un compte 33 h]', () => {
    fraiche('bornes');
    tache(J, 'ebay:s1:veille', 's1', -60); tache(J, 'ebay:s1:cmd:O1', 's1', 3600);
    const l = prendre(8, uuid(110), 0, 120000);
    const libre = A(`select coalesce(bail_jusqua::text, 'libre') from public.vrm_agent_file where cle = 'ebay:s1:veille'`);
    dit(l.length === 0 && libre === 'libre', 'un bail de 120 000 « secondes » (des millisecondes : 33 h 20) est REFUSÉ : rien n\'est pris, le compte eBay n\'est pas gelé', `${l.length} prise(s) · ${libre}`);
    const l601 = prendre(8, uuid(111), 0, 601), l600 = prendre(8, uuid(112), 0, 600);
    dit(l601.length === 0 && l600.length === 1, 'la borne est 10 minutes : 601 s refusé, 600 s pris', JSON.stringify([l601.length, l600.map((x) => x.cle)]));
    const pc = (cle, bail, groupe) => S(`select public.vrm_agent_prendre_cle('${J}', '${cle}', '${uuid(113)}', ${bail}, ${t(1)}, '${groupe}');`);
    dit(pc('ebay:s2:veille', 2147483647, 's2') === 'f' && A(`select count(*) from public.vrm_agent_file where cle = 'ebay:s2:veille'`) === '0',
      'le clic aussi : un bail de 2 147 483 647 s (jusqu\'en 2094) est refusé, et aucune tâche n\'est créée tenue');
    dit(pc('ebay:s2:veille', 120, 's2') === 't', 'l\'autre sens : un bail de 120 s est pris');
    // « dans 15 min » écrit en millisecondes : l'an 58 748.
    tache(J, 'ebay:s3:veille', 's3', -60, { jeton: uuid(114), jusqua: 120 });
    const r = S(`select public.vrm_agent_rendre('${J}', 'ebay:s3:veille', '${uuid(114)}', to_timestamp((extract(epoch from ${t(10)}) + 900) * 1000), p_maintenant => ${t(10)});`);
    const e = A(`select (bail_jeton = '${uuid(114)}') || '|' || (prochain = ${t(-60)}) from public.vrm_agent_file where cle = 'ebay:s3:veille'`);
    dit(r === 'f' && e === 'true|true', 'rendre « dans 15 min » écrit en millisecondes (l\'an 58 748) est REFUSÉ : la veille reste tenue, son échéance intacte', `${r} · ${e}`);
    const l2 = prendre(8, uuid(115), 121);
    dit(l2.some((x) => x.cle === 'ebay:s3:veille'), 'et elle revient à la fin de son bail : aucune veille ne disparaît', JSON.stringify(l2.map((x) => x.cle)));
    dit(S(`select public.vrm_agent_rendre('${J}', 'ebay:s3:veille', '${uuid(115)}', ${t(121 + 20 * JOUR)}, p_maintenant => ${t(122)});`) === 't', 'l\'autre sens : rendre « dans 20 jours » passe');
    const p1 = S(`select coalesce(public.vrm_agent_planifier('${J}', 'ebay:s4:veille', 's4', ${t(2 * 365 * JOUR)}, ${t(0)})::text, 'null');`);
    dit(p1 === 'null' && A(`select count(*) from public.vrm_agent_file where cle = 'ebay:s4:veille'`) === '0', 'planifier dans 2 ans est refusé (NULL) : aucune tâche rangée hors du temps — le secours la voit « manquante » et la recrée', p1);
    const p2 = S(`select public.vrm_agent_planifier('${J}', 'ebay:s1:cmd:O1', 's1', ${t(2 * 365 * JOUR)}, ${t(0)}) is null;`);
    dit(p2 === 't' && A(`select prochain = ${t(3600)} from public.vrm_agent_file where cle = 'ebay:s1:cmd:O1'`) === 't', 'une sonnette à 2 ans sur une tâche existante : refusée, son échéance ne bouge pas');
    dit(S(`select public.vrm_agent_planifier('${J}', 'ebay:s5:veille', 's5', ${t(20 * JOUR)}, ${t(0)}) = ${t(20 * JOUR)};`) === 't', 'l\'autre sens : planifier dans 20 jours passe');
  });

  // ── 5. LES COMMANDES : VERSION ET BAIL ────────────────────────────────────
  console.log('\n5. L\'ÉTAT D\'UNE COMMANDE (le bail de CETTE commande, la version, le rang)');
  await essaie('écrire sous version et sous bail', () => {
    fraiche('cmd');
    const JE = uuid(50);
    S(`select public.vrm_agent_prendre_cle('${J}', 'ebay:s1:cmd:O1', '${JE}', 120, ${t(0)}, 's1');`);
    dit(ecrit(J, JE, 's1', 'O1', null, { etape: 'payee', rang: 1, numero: '1', pays: 'FR' }) === '1', 'création : version 1');
    dit(ecrit(J, JE, 's1', 'O1', null, { etape: 'payee', rang: 1 }) === '', 'une seconde création rend 0 ligne (elle existe déjà)');
    dit(ecrit(J, JE, 's1', 'O1', 1, { etape: 'a_expedier', rang: 2, voie: 'ebay' }) === '2', 'écriture sur la version lue : version 2');
    dit(ecrit(J, JE, 's1', 'O1', 1, { etape: 'historique', rang: 2 }) === '', 'écriture sur une version PÉRIMÉE : 0 ligne, on relit, on n\'écrase jamais');
    dit(A(`select etape || '|' || rang || '|' || numero || '|' || pays || '|' || version from public.vrm_agent_commandes where commande = 'O1'`) === 'a_expedier|2|1|FR|2', 'l\'état est celui de la bonne écriture, et les colonnes non envoyées sont gardées');
    dit(ecrit(J, uuid(51), 's1', 'O1', 2, { etape: 'historique', rang: 2 }) === '', 'un autre jeton (le bail n\'est pas à lui) : 0 ligne');
    dit(ecrit(J, JE, 's1', 'O1', 2, { etape: 'historique', rang: 2 }, 500) === '', 'le bail EXPIRÉ (coupé en plein geste) : 0 ligne');
    dit(A(`select version from public.vrm_agent_commandes where commande = 'O1'`) === '2', 'la commande n\'a pas bougé');
  });
  await essaie('le bail de CETTE commande, et d\'elle seule [revue : n\'importe quel bail du vendeur passait]', () => {
    fraiche('cmdbail');
    const VEILLE = uuid(90), CLIC = uuid(91);
    // Posées à la main (défense en profondeur : même si la règle « un appel en vol par compte » était contournée).
    tache(J, 'ebay:s1:veille', 's1', -60, { jeton: VEILLE, jusqua: 120 });
    tache(J, 'ebay:s1:cmd:O1', 's1', -60, { jeton: CLIC, jusqua: 120 });
    ecrit(J, CLIC, 's1', 'O1', null, { etape: 'a_expedier', rang: 2 });
    ecrit(J, CLIC, 's1', 'O1', 1, { etape: 'etiquette_en_cours', rang: 3, en_cours: { geste: 'acheter', cle: 'achat:O1' } });
    // Même rang (la règle du rang n'y est pour rien) : c'est le bail qui doit refuser.
    const r = ecrit(J, VEILLE, 's1', 'O1', 2, { etape: 'a_expedier', rang: 3, en_cours: null }, 4);
    const etat = A(`select etape || '|' || rang || '|' || coalesce(en_cours->>'geste', 'EFFACÉ') || '|' || version from public.vrm_agent_commandes where commande = 'O1'`);
    dit(r === '' && etat === 'etiquette_en_cours|3|acheter|2', 'la veille du compte ne réécrit PAS une commande qu\'un clic est en train d\'acheter (en_cours et rang intacts)', `${r} · ${etat}`);
    dit(ecrit(J, VEILLE, 's1', 'O3', null, { etape: 'payee', rang: 1 }) === '1', 'la veille CRÉE une commande de son compte');
    dit(ecrit(J, VEILLE, 's2', 'O9', null, { etape: 'payee', rang: 1 }) === '' && A(`select count(*) from public.vrm_agent_commandes where commande = 'O9'`) === '0', 'mais jamais une commande d\'un AUTRE compte eBay');
    const desc = ecrire(J, CLIC, 's1', 'O1', 2, { etape: 'a_expedier', rang: 2 }, 5);
    dit(refuse(desc, /vrm_rang_descend/) && A(`select rang || '|' || version from public.vrm_agent_commandes where commande = 'O1'`) === '3|2', 'le rang ne descend jamais : l\'écriture est refusée et DITE (« vrm_rang_descend »)', desc.ok ? 'passée' : desc.err.slice(0, 100));
    dit(ecrit(J, CLIC, 's1', 'O1', 2, { etape: 'etiquette_incertaine', rang: 3 }, 6) === '3', 'l\'autre sens : même rang, autre étape : écrite');
  });
  await essaie('le bail reste tenu PENDANT l\'écriture (FOR SHARE) [revue : non prouvé]', async () => {
    fraiche('cmdshare');
    const E = uuid(95);
    S(`select public.vrm_agent_prendre_cle('${J}', 'ebay:s1:cmd:O1', '${E}', 120, ${t(0)}, 's1');`);
    ecrit(J, E, 's1', 'O1', null, { etape: 'payee', rang: 1 }, 1);
    const Ap = runAsync(COMME.serveur + `begin;\nselect 'W:' || public.vrm_agent_ecrire_commande('${J}', '${E}', 's1', 'O1', 1, '{"etape":"a_expedier","rang":2}', 'ebay', ${t(119)});\nselect pg_sleep(2.5);\ncommit;\n`, { db: DB });
    await attendre(700);
    const B = await runAsync(COMME.serveur + `select 'R:' || coalesce(jsonb_agg(x.cle)::text, '[]') from public.vrm_agent_prendre(8, '${uuid(96)}', 120, ${t(121)}) x;`, { db: DB });
    const a = await Ap;
    dit(a.ok && /W:2/.test(a.out), 'l\'écriture à t+119 s passe (bail encore tenu)', (a.out + a.err).slice(0, 120));
    dit(B.ok && /R:\[\]/.test(B.out) && B.ms < 1500, `un battement à t+121 s ne reprend PAS la tâche pendant que l'écriture n'est pas validée (et n'attend pas) : ${B.ms} ms`, B.out + ' ' + B.err.slice(0, 100));
  });
  await essaie('ce que la commande ne garde jamais (R18) [revue : vert sur une forme qui arrange]', () => {
    fraiche('r18');
    const JE = uuid(52);
    S(`select public.vrm_agent_prendre_cle('${J}', 'ebay:s1:cmd:O9', '${JE}', 120, ${t(0)}, 's1');`);
    const cree = (cols) => ecrire(J, JE, 's1', 'O9', null, cols);
    const refuses = {
      'un pays qui n\'est pas un code ISO 2': { pays: 'France' },
      'des valeurs à la place des noms de clés (avec espace)': { cles_shipto: ['Jean Dupont', '12 rue des Lilas'] },
      'des valeurs d\'UN mot à la place des noms de clés': { cles_shipto: ['Dupont', 'Cancale', 'Rennes'] },
      'l\'acheteur recopié dans data': { data: { acheteur: { nom: 'Dupont', rue: '12 rue des Lilas', cp: '35260', ville: 'Cancale', tel: '0612345678', email: 'jean@exemple.fr' } } },
      'le shipTo d\'eBay recopié dans data': { data: { shipTo: { fullName: 'Jean Dupont', contactAddress: { city: 'Cancale' } } } },
      'une adresse email en valeur dans data': { data: { note: 'jean.dupont@exemple.fr' } },
      'un nom et un téléphone comme transporteur': { transporteur: 'Jean Dupont 06 12 34 56 78' },
      'une phrase comme voie': { voie: 'Mondial Relay chez Paul' },
      'l\'acheteur dans en_cours': { en_cours: { geste: 'acheter', destinataire: 'Jean Dupont' } },
      'une commande recopiée entière (plus de 4 Ko)': { data: { commande: 'x'.repeat(5000) } },
      'une politique d\'étiquette inconnue': { politique_etiquette: 'EBAY' },
    };
    // Refusée PAR UNE CONTRAINTE : une erreur d'appel (fonction absente) ne compte pas comme un refus.
    const passes = Object.entries(refuses).filter(([, c]) => !refuse(cree({ etape: 'payee', rang: 1, ...c }), /violates check constraint/)).map(([k]) => k);
    dit(passes.length === 0, `la base refuse chacune des ${Object.keys(refuses).length} formes d'une donnée d'acheteur (noms de clés d'un mot, clés d'adresse à toute profondeur, email, téléphone, phrases)`, passes.join(' · '));
    const r = cree({ etape: 'payee', rang: 1, pays: 'FR', cles_shipto: ['fullName', 'contactAddress.city', 'primaryPhone.phoneNumber', 'email'], politique_etiquette: 'aucune', transporteur: 'mondial_relay', voie: 'ebay',
      data: { transitions: [], devis: { ville: 'Rennes', prixCentimes: 840 } } });
    dit(r.ok && r.out === '1', 'l\'autre sens : un code ISO 2, des NOMS de clés eBay, des codes, et la ville d\'un devis (effacée avec lui) passent', r.ok ? r.out : r.err.slice(0, 160));
  });
  await essaie('ce que le journal ne garde jamais (R18)', () => {
    const n = (e) => run(COMME.serveur + `select public.vrm_agent_noter('${J}', ${js(e)}, ${t(0)});`, { db: DB });
    const refuses = {
      'une adresse comme référence': { geste: 'bordereau', resultat: 'fait', ref: 'Jean Dupont, 12 rue des Lilas 35260 Cancale' },
      'un « défaire » de 200 Ko': { geste: 'prix', resultat: 'fait', defaire: { x: 'y'.repeat(200000) } },
      'l\'acheteur dans « défaire »': { geste: 'prix', resultat: 'fait', defaire: { acheteur: { nom: 'Dupont' } } },
      'une phrase comme source': { geste: 'prix', resultat: 'fait', source: 'réponse de Boxtal pour Jean' },
    };
    const passes = Object.entries(refuses).filter(([, e]) => !refuse(n(e), /violates check constraint/)).map(([k]) => k);
    dit(passes.length === 0, 'le journal refuse une adresse en référence, un « défaire » trop gros ou qui nomme l\'acheteur, une phrase en source', passes.join(' · '));
    const r = n({ geste: 'bordereau', resultat: 'fait', ref: 'vrm-12-12345-12345', source: 'boxtal', defaire: { prixAvantCentimes: 5000 } });
    dit(r.ok && /^\d+$/.test(r.out), 'l\'autre sens : une référence d\'envoi, un code de source et un « défaire » sobre passent', r.ok ? r.out : r.err.slice(0, 120));
  });

  // ── 6. MÉMOS ET VUS ───────────────────────────────────────────────────────
  console.log('\n6. « PREMIÈRE FOIS » (mémos de gestes) ET « DÉJÀ VU »');
  await essaie('les mémos', async () => {
    fraiche('memos');
    const pf = (o, cle, s = 0, exp = null) => S(`select public.vrm_agent_premiere_fois('${o}', '${cle}', ${exp === null ? 'null' : t(exp)}, ${t(s)});`);
    dit(pf(J, 'msg:O1:merci') === 't' && pf(J, 'msg:O1:merci') === 'f', 'true UNE fois, puis false');
    dit(pf(V, 'msg:O1:merci') === 'f', 'une clé de geste GLOBALE appelée par un SECOND vendeur : false (un seul « merci » pour une commande eBay) [S5]');
    dit(pf(J, 'achat:O2') === 't' && pf(V, 'achat:O2') === 'f' && pf(V, 'eval:L1') === 't' && pf(J, 'eval:L1') === 'f', 'achat, évaluation : globaux aussi');
    dit(A(`select owner from public.vrm_agent_memos where cle = 'msg:O1:merci'`) === N, 'rangés sous le propriétaire neutre');
    dit(pf(J, 'push:vente:O3') === 't' && pf(V, 'push:vente:O3') === 't', 'l\'autre sens : une notification de vente reste PAR vendeur (chacun ses appareils)');
    const res = await Promise.all(Array.from({ length: 50 }, () => runAsync(COMME.serveur + `select public.vrm_agent_premiere_fois('${J}', 'msg:O5:relais', null, ${t(0)});`, { db: DB })));
    const vrais = res.filter((r) => r.ok && r.out === 't').length;
    dit(vrais === 1 && res.every((r) => r.ok), `50 appels simultanés : ${vrais} « première fois » (attendu : 1)`);
    pf(J, 'offre:I1', 0, 86400);
    dit(A(`select expire >= ${t(0)} + interval '100 days' from public.vrm_agent_memos where cle = 'offre:I1'`) === 't', 'un mémo demandé pour 1 jour est gardé au moins 100 jours [S25, R12]');
  });
  await essaie('les vus et la purge', () => {
    S(`select public.vrm_agent_vu('${J}', 'notif:N1', ${t(0)});`);
    dit(S(`select public.vrm_agent_vu('${J}', 'notif:N1', ${t(1)});`) === 'f', 'une notification déjà vue : false');
    S(`select public.vrm_agent_purger(${t(15 * JOUR)});`);
    dit(A(`select count(*) from public.vrm_agent_vus`) === '0', 'les vus partent à 14 jours');
    dit(A(`select count(*) from public.vrm_agent_memos where cle = 'msg:O1:merci'`) === '1', 'les mémos de GESTES restent à 14 jours (un message est permis 90 jours)');
    S(`select public.vrm_agent_purger(${t(101 * JOUR)});`);
    dit(A(`select count(*) from public.vrm_agent_memos where cle = 'msg:O1:merci'`) === '0', 'et partent passé leur échéance (100 jours)');
  });

  // ── 7. L'ARGENT ───────────────────────────────────────────────────────────
  console.log('\n7. RÉSERVER DE L\'ARGENT (115 %, plafonds, une fois, et la purge ne les rouvre pas)');
  const resa = (o, ttc, pl = {}, s = 0, compte = 's1') => QJ(COMME.serveur + `select public.vrm_agent_reserver('${o}', '${compte}', ${ttc}, ${pl.geste ?? 2500}, ${pl.n ?? 10}, ${pl.jour ?? 8000}, ${pl.mois ?? 30000}, ${t(s)});`);
  await essaie('la marge et les plafonds', () => {
    fraiche('argent');
    const r = resa(J, 1000);
    dit(r && r.ok === true && r.centimes === 1150, 'un devis de 10,00 € TTC réserve 11,50 € (+15 %) [S9, R15]', JSON.stringify(r));
    dit(resa(J, 2200).raison === 'geste', 'un devis dont la réservation passe le plafond du geste est refusé (« à confirmer »)');
    dit(QJ(COMME.serveur + `select public.vrm_agent_reserver('${J}', 's1', 1000, null, 10, 8000, 30000, ${t(0)});`).raison === 'pas-su', 'un plafond inconnu : refusé (« pas su » n\'agit jamais)');
    const k = A(`select n || '|' || centimes from public.vrm_agent_compteurs where owner = '${J}' and cle = 'argent:jour:s1:2026-10-12'`);
    dit(k === '1|1150', 'le compteur du jour porte ce qui est réservé', k);
    dit(S(`select public.vrm_agent_rendre_reservation('${J}', '${r.reservation}', ${t(10)});`) === 't', 'une réservation se rend (refus prouvé)');
    dit(S(`select public.vrm_agent_rendre_reservation('${J}', '${r.reservation}', ${t(11)});`) === 'f', 'mais une seule fois');
    const k2 = A(`select n || '|' || centimes from public.vrm_agent_compteurs where owner = '${J}' and cle = 'argent:jour:s1:2026-10-12'`);
    dit(k2 === '0|0', 'le compteur revient à zéro, pas en dessous', k2);
    const nuit = resa(J, 100, {}, 15 * 3600);   // 23:00 UTC = 01:00 à Paris le 13
    dit(nuit && nuit.jour === '2026-10-13', 'le jour est celui de PARIS', JSON.stringify(nuit));
  });
  await essaie('50 réservations SIMULTANÉES', async () => {
    fraiche('argent2');
    const lot = await Promise.all(Array.from({ length: 50 }, () => runAsync(COMME.serveur + `select (public.vrm_agent_reserver('${J}', 's1', 1000, 2500, 10, 1000000, 1000000, ${t(0)}) ->> 'ok');`, { db: DB })));
    const pris = lot.filter((r) => r.ok && r.out === 'true').length;
    const k = A(`select n || '|' || centimes from public.vrm_agent_compteurs where owner = '${J}' and cle = 'argent:jour:s1:2026-10-12'`);
    dit(pris === 10 && k === '10|11500' && lot.every((r) => r.ok), `plafond de 10 bordereaux par jour : ${pris} réservés sur 50 demandes simultanées, compteur ${k}`);
    const lot2 = await Promise.all(Array.from({ length: 50 }, () => runAsync(COMME.serveur + `select (public.vrm_agent_reserver('${J}', 's2', 1000, 2500, 1000, 1000000, 30000, ${t(0)}) ->> 'ok');`, { db: DB })));
    const mois = A(`select centimes from public.vrm_agent_compteurs where owner = '${J}' and cle = 'argent:mois:2026-10'`);
    dit(Number(mois) <= 30000 && lot2.every((r) => r.ok), `plafond du mois (300 €) : ${mois} centimes réservés au total, jamais plus`);
  });
  await essaie('la purge ne rouvre jamais un plafond [revue : « 400 jours » jamais testé]', () => {
    fraiche('argent3');
    const r1 = resa(J, 20000, { geste: 30000, jour: 1000000, mois: 30000 }, 0);
    S(`select public.vrm_agent_purger(${t(2 * JOUR)});`);
    const r2 = resa(J, 20000, { geste: 30000, jour: 1000000, mois: 30000 }, 2 * JOUR);
    dit(r1 && r1.ok === true && r2 && r2.ok === false && r2.raison === 'mois', 'plafond du mois à 300 € : 230 € réservés, la purge passe, 230 € de plus dans le même mois sont REFUSÉS', JSON.stringify([r1 && r1.ok, r2]));
    // Les deux règles, chacune prouvée seule.
    A(`insert into public.vrm_agent_compteurs (owner, cle, n, centimes, maj) values
         ('${V}', 'argent:mois:2026-10', 1, 999, ${t(-500 * JOUR)}), ('${V}', 'argent:mois:2026-09', 1, 999, ${t(-500 * JOUR)}),
         ('${V}', 'argent:mois:2025-01', 1, 999, ${t(-100 * JOUR)}), ('${V}', 'argent:mois:2024-01', 1, 999, ${t(-500 * JOUR)})`);
    S(`select public.vrm_agent_purger(${t(0)});`);
    const reste = A(`select string_agg(cle, ',' order by cle) from public.vrm_agent_compteurs where owner = '${V}'`);
    dit(/2026-10/.test(reste) && /2026-09/.test(reste), 'un compteur du mois en cours ou du mois précédent n\'est JAMAIS purgé, même intouché depuis 500 jours', reste);
    dit(/2025-01/.test(reste), 'un compteur intouché depuis 100 jours reste (400 jours de garde)', reste);
    dit(!/2024-01/.test(reste), 'l\'autre sens : un vieux compteur d\'un mois révolu, intouché depuis 500 jours, part', reste);
  });
  await essaie('le quota d\'appels', () => {
    fraiche('quota');
    const q = (prio, o = null, c = null) => S(`select public.vrm_agent_quota('trading:2026-10-12', '${prio}', 1, 100, ${o ? `'${o}'` : 'null'}, ${c ? `'${c}'` : 'null'}, ${t(0)});`);
    let n = 0; while (n < 200 && q('confort', J, 'c' + n) === 't') n++;
    dit(n === 60, `le confort s'arrête à 60 % du quota (${n} appels sur 100)`);
    n = 0; while (n < 200 && q('detection', J, 'd' + n) === 't') n++;
    dit(n === 20, `la détection va jusqu'à 80 % (${n} de plus)`);
    n = 0; while (n < 200 && q('obligation') === 't') n++;
    dit(n === 20, `les obligations gardent les 20 % restants (${n} de plus)`);
    dit(q('inconnue') === 'f', 'une priorité inconnue est refusée');
    fraiche('quota2');
    const r1 = q('confort', J, 's1'), r2 = q('confort', J, 's1'), r3 = q('confort', J, 's2'), r4 = q('obligation', J, 's1');
    dit(r1 === 't' && r2 === 'f' && r3 === 't' && r4 === 't', 'hors obligation, au plus 1 % par compte et par jour ; une obligation passe quand même', [r1, r2, r3, r4].join(''));
    dit(q('confort') === 'f' && q('detection') === 'f' && q('obligation') === 't', 'un vendeur INCONNU (pas su) n\'est jamais plus permissif : refusé hors obligation [revue]');
    S(`select public.vrm_agent_quota_recaler('trading:2026-10-12', 99, ${t(0)}); select public.vrm_agent_quota_recaler('trading:2026-10-12', 5, ${t(1)});`);
    dit(A(`select n from public.vrm_agent_compteurs where cle = 'trading:2026-10-12'`) === '99', 'le recalage sur eBay ne fait que monter');
  });

  // ── 8. LES TITULAIRES ET L'INDEX ──────────────────────────────────────────
  console.log('\n8. UN COMPTE eBAY, UN VENDEUR ; L\'INDEX DES ANNONCES');
  const ti = (cle, o, c = 's1') => S(`select public.vrm_agent_titulaire('${cle}', '${o}', '${c}', ${t(0)});`);
  const ix = (o, c, l) => QJ(COMME.serveur + `select public.vrm_ebay_indexer_annonces('${o}', '${c}', ${l === null ? 'null' : `array[${l.map((x) => `'${x}'`).join(',')}]::text[]`}, ${t(0)});`);
  await essaie('les titulaires [S5, R10]', async () => {
    fraiche('titulaires');
    dit(ti('0123456789abcdef', J) === 't' && ti('0123456789abcdef', J) === 't', 'le premier vendeur devient titulaire (et le reste)');
    dit(ti('0123456789abcdef', V) === 'f', 'un SECOND vendeur VRM qui relie le même compte eBay est refusé');
    dit(A(`select owner from public.vrm_ebay_titulaires where cle_ebay = '0123456789abcdef'`) === J, 'le titulaire n\'a pas changé');
    dit(ti('PAS-UNE-CLE', J) === 'f' && ti('fedcba9876543210', N) === 'f', 'une clé qui n\'est pas une identité eBay, ou le propriétaire neutre : refusés');
    dit(ti('1111111111111111', J, 's1') === 'f', 'un second compte eBay sous le MÊME libellé chez le même vendeur est refusé (le libellé nomme ses tâches)');
    const lot = await Promise.all([J, V, J, V, V, J].map((o) => runAsync(COMME.serveur + `select '${o}:' || public.vrm_agent_titulaire('aaaaaaaaaaaaaaaa', '${o}', 's2', ${t(0)});`, { db: DB })));
    const gagnants = new Set(lot.filter((r) => r.out.endsWith(':true')).map((r) => r.out.split(':')[0]));
    dit(gagnants.size === 1, 'deux vendeurs qui relient le même compte au même instant : un seul gagne', [...gagnants].join(','));
    dit(S(`select public.vrm_agent_titulaire_liberer('0123456789abcdef', '${V}');`) === 'f', 'seul le titulaire libère son compte');
    dit(S(`select public.vrm_agent_titulaire_liberer('0123456789abcdef', '${J}');`) === 't' && ti('0123456789abcdef', V, 's7') === 't', 'libéré, il peut être relié ailleurs');
  });
  await essaie('l\'index des annonces [D13]', () => {
    fraiche('index');
    ti('0123456789abcdef', J, 's1'); ti('fedcba9876543210', V, 's9');
    const r1 = ix(J, 's1', ['128086452103', '128127336988']);
    dit(r1 && r1.indexees === 2, 'les annonces d\'un compte sont indexées par son titulaire', JSON.stringify(r1));
    const r2 = ix(V, 's9', ['128086452103', '199999999999']);
    dit(r2 && r2.refusees === 1 && A(`select owner from public.vrm_ebay_annonces_index where listing_id = '128086452103'`) === J, 'une annonce déjà à un AUTRE vendeur encore titulaire n\'est jamais prise', JSON.stringify(r2));
    const r3 = ix(J, 's1', ['128127336988', 'pas-un-id']);
    dit(r3 && r3.retirees === 1 && r3.refusees === 1, 'relecture complète : l\'annonce disparue sort de l\'index, un identifiant malformé est refusé', JSON.stringify(r3));
    dit(ix(J, 's1', null) === null && A(`select count(*) from public.vrm_ebay_annonces_index where owner = '${J}'`) === '1', 'une lecture ratée (NULL) ne touche à rien');
    const r4 = ix(J, 'pas-a-lui', ['128000000077']);
    dit(r4 && r4.indexees === 0 && r4.raison === 'pas-titulaire' && A(`select count(*) from public.vrm_ebay_annonces_index where listing_id = '128000000077'`) === '0', 'un vendeur qui n\'est pas titulaire de ce compte n\'indexe rien [revue]', JSON.stringify(r4));
  });
  await essaie('l\'index suit le compte : changement de libellé, libération, ligne périmée [revue]', () => {
    fraiche('index2');
    const A1 = '88888888-8888-8888-8888-888888888888', B1 = '99999999-9999-9999-9999-999999999999';
    dit(ti('abcdefabcdef0123', A1, '') === 't', 'A devient titulaire du compte X (libellé vide, le compte d\'avant les plusieurs comptes)');
    dit((ix(A1, '', ['128000000001', '128000000002']) || {}).indexees === 2, 'A indexe ses 2 annonces');
    dit(ti('abcdefabcdef0123', A1, 'abcdefabcdef0123') === 't', 'le libellé du compte X change');
    dit(A(`select string_agg(distinct compte, ',') from public.vrm_ebay_annonces_index where owner = '${A1}'`) === 'abcdefabcdef0123', 'l\'index SUIT le nouveau libellé', A(`select string_agg(compte, ',') from public.vrm_ebay_annonces_index where owner = '${A1}'`));
    S(`select public.vrm_agent_titulaire_liberer('abcdefabcdef0123', '${A1}');`);
    dit(A(`select count(*) from public.vrm_ebay_annonces_index where owner = '${A1}'`) === '0', 'libéré, TOUT son index d\'annonces part avec lui');
    dit(ti('abcdefabcdef0123', B1, 'x1') === 't' && (ix(B1, 'x1', ['128000000001', '128000000002']) || {}).indexees === 2, 'B, nouveau titulaire, indexe les annonces du compte');
    dit(A(`select string_agg(distinct owner::text, ',') from public.vrm_ebay_annonces_index where listing_id in ('128000000001', '128000000002')`) === B1, 'et les sonnettes vont chez B, pas chez l\'ancien titulaire');
    A(`insert into public.vrm_ebay_annonces_index (listing_id, owner, compte, maj) values ('128000000009', '${A1}', 'vieux', now())`);
    const r = ix(B1, 'x1', ['128000000001', '128000000002', '128000000009']);
    dit(r && r.indexees === 3 && A(`select owner from public.vrm_ebay_annonces_index where listing_id = '128000000009'`) === B1, 'une ligne laissée par un vendeur qui n\'est PLUS titulaire est reprise', JSON.stringify(r));
  });
  await essaie('les preuves de vente : la première fois ne bouge pas', () => {
    const p = (s) => S(`select public.vrm_agent_preuve_vue('${J}', '1', 'vinted', 'tx-1', ${t(s)}) = ${t(0)};`);
    dit(p(0) === 't' && p(3600) === 't', 'relue une heure plus tard, la preuve garde l\'heure où l\'agent l\'a VUE la première fois (décision 2)');
  });

  // ── 9. LE JOURNAL ─────────────────────────────────────────────────────────
  console.log('\n9. LE JOURNAL (une seule réécriture possible) [S26, R19]');
  await essaie('le journal', () => {
    fraiche('journal');
    const id = S(`select public.vrm_agent_noter('${J}', '{"geste":"message","resultat":"fait","cible":"O1","numero":"1","texte":"Bonjour Paul, ton colis est au relais.","ref":"vrm-O1","defaire":{"prixAvantCentimes":5000}}', ${t(0)});`);
    S(`select public.vrm_agent_noter('${J}', '{"geste":"message","resultat":"fait","cible":"O2","texte":"Autre acheteur"}', ${t(0)});`);
    dit(/^\d+$/.test(id), 'une ligne s\'ajoute');
    dit(!run(COMME.serveur + `select public.vrm_agent_noter('${J}', '{"geste":"x","resultat":"peut-etre"}', ${t(0)});`, { db: DB }).ok, 'un résultat hors liste est refusé');
    const tente = {
      'réécrire le texte': `update public.vrm_agent_journal set texte = 'autre chose' where id = ${id};`,
      'changer le résultat': `update public.vrm_agent_journal set resultat = 'refuse' where id = ${id};`,
      'effacer le texte ET changer la cible': `update public.vrm_agent_journal set texte = null, ref = null, defaire = null, texte_retire_le = now(), cible = 'O9' where id = ${id};`,
      'supprimer une ligne': `delete from public.vrm_agent_journal where id = ${id};`,
      'vider la table': `truncate public.vrm_agent_journal;`,
    };
    const passes = Object.entries(tente).filter(([, sql]) => run(sql, { db: DB }).ok).map(([k]) => k);
    dit(passes.length === 0, 'le propriétaire de la table lui-même ne peut ni réécrire, ni supprimer, ni vider le journal par une écriture ordinaire', passes.join(' · '));
    const variables = {
      'la variable de la purge': `set vrm.agent_purger_avant = 'infinity'; delete from public.vrm_agent_journal;`,
      'la variable de l\'effacement': `set vrm.agent_effacer = '${J}'; delete from public.vrm_agent_journal where owner = '${J}';`,
    };
    const ouvertes = Object.entries(variables).filter(([, sql]) => run(sql, { db: DB }).ok).map(([k]) => k);
    dit(ouvertes.length === 0 && A(`select count(*) from public.vrm_agent_journal`) === '2', 'une variable de SESSION n\'ouvre plus le journal (seule une marque de transaction posée par la purge ou l\'effacement le fait) [revue]', ouvertes.join(' · '));
    dit(!run(COMME.serveur + `update public.vrm_agent_journal set texte = null where id = ${id};`, { db: DB }).ok, 'le serveur non plus (aucun droit d\'écriture directe)');
    const an = run(COMME.serveur + `select public.vrm_agent_anonymiser_journal('${J}', 'O1', ${t(60)});`, { db: DB });
    dit(an.ok && an.out === '1', 'l\'effacement à la demande d\'eBay passe', an.ok ? an.out : an.err.slice(0, 120));
    dit(A(`select (texte is null) || '|' || (ref is null) || '|' || (defaire is null) || '|' || (texte_retire_le is not null) || '|' || geste || '|' || numero from public.vrm_agent_journal where id = ${id}`) === 'true|true|true|true|message|1',
      'le texte, la référence et le « défaire » sont retirés, la trace du geste reste [revue : la référence restait]');
    dit(A(`select texte from public.vrm_agent_journal where cible = 'O2'`) === 'Autre acheteur', 'les autres entrées ne bougent pas');
    const idAt = S(`select public.vrm_agent_noter('${J}', '{"geste":"message","resultat":"fait","at":"2020-01-01T00:00:00Z"}', ${t(0)});`);
    const at = A(`select at = ${t(0)} from public.vrm_agent_journal where id = ${Number(idAt) || 0}`);
    dit(at === 't', 'l\'heure d\'une ligne est celle du serveur : un « at » glissé dans l\'entrée est ignoré');
    S(`select public.vrm_agent_purger(${t(14 * 31 * JOUR)});`);
    dit(A(`select count(*) from public.vrm_agent_journal`) === '0', 'la purge retire le journal de plus de 13 mois');
  });

  // ── 10. L'HORLOGE ET L'HEURE ──────────────────────────────────────────────
  console.log('\n10. L\'HORLOGE (l\'anti-rafale sur une ligne neuve) [D14, D4] ET L\'HEURE REÇUE');
  await essaie('l\'horloge', () => {
    fraiche('horloge');
    dit(S(`select public.vrm_agent_horloge_battre(${t(0)});`) === 't', 'sur une horloge NEUVE, le premier battement travaille (la ligne rend une ligne)');
    dit(S(`select public.vrm_agent_horloge_battre(${t(5)});`) === 'f', '5 s plus tard : ignoré (anti-rafale)');
    dit(S(`select public.vrm_agent_horloge_battre(${t(21)});`) === 't', '21 s plus tard : il travaille');
    S(`select public.vrm_agent_horloge_succes(${t(30)}); select public.vrm_agent_horloge_succes(${t(10)});`);
    dit(A(`select dernier_succes = ${t(30)} from public.vrm_agent_horloge`) === 't', 'le dernier succès ne recule jamais');
  });
  await essaie('sans horloge simulée, l\'heure de l\'appelant ne compte pas [revue : une heure fausse arrêtait l\'agent et purgeait tout]', () => {
    fraiche('heure');
    SR(`select public.vrm_agent_noter('${J}', '{"geste":"bordereau","resultat":"fait","cible":"O1","centimes":840}', now());
        select public.vrm_agent_noter('${V}', '{"geste":"retrait","resultat":"fait","cible":"I9"}', now());
        select public.vrm_agent_premiere_fois('${J}', 'achat:O1', null, now());`);
    SR(`select public.vrm_agent_purger(now() + interval '2 years');`);
    dit(A(`select count(*) from public.vrm_agent_journal`) === '2' && SR(`select public.vrm_agent_premiere_fois('${J}', 'achat:O1', null, now());`) === 'f',
      'purger(+2 ans) n\'efface ni le journal ni les mémos : un second achat reste impossible');
    SR(`select public.vrm_agent_horloge_battre(now() + interval '1 year'); select public.vrm_agent_horloge_succes(now() + interval '1 year');`);
    dit(A(`select (dernier_battement <= now() + interval '1 minute') || '|' || (dernier_succes <= now() + interval '1 minute') from public.vrm_agent_horloge`) === 'true|true',
      'une heure à +1 an n\'arrête pas l\'horloge et ne rend pas l\'alarme « 30 min sans succès » muette', A(`select dernier_battement || ' ' || dernier_succes from public.vrm_agent_horloge`));
    A(`insert into public.vrm_agent_file (owner, cle, groupe, prochain, bail_jeton, bail_jusqua) values ('${J}', 'ebay:s1:veille', 's1', now() - interval '1 minute', '${uuid(97)}', now() + interval '120 seconds')`);
    const vole = SR(`select count(*) from public.vrm_agent_prendre(8, '${uuid(98)}', 120, now() + interval '200 seconds');`);
    dit(vole === '0' && A(`select bail_jeton from public.vrm_agent_file where cle = 'ebay:s1:veille'`) === uuid(97), 'prendre(+200 s) ne vole pas un bail vivant', vole);
    const idAt = SR(`select public.vrm_agent_noter('${J}', '{"geste":"message","resultat":"fait"}', now() + interval '1 year');`);
    const at = A(`select at <= now() + interval '1 minute' from public.vrm_agent_journal where id = ${Number(idAt) || 0}`);
    dit(at === 't', 'noter(+1 an) écrit l\'heure du serveur');
    const simule = S(`select count(*) from public.vrm_agent_prendre(8, '${uuid(99)}', 120, now() + interval '200 seconds');`);
    dit(simule === '1', 'l\'autre sens : sur horloge SIMULÉE (le banc), l\'heure reçue compte — c\'est elle qui fait le banc de vie', simule);
  });

  // ── 11. EFFACER UN VENDEUR, COMPACTER ─────────────────────────────────────
  console.log('\n11. « FERMER MON COMPTE » (tout part, et la porte se ferme) ET LA PURGE');
  await essaie('effacer un vendeur : les 12 tables, et les quotas qui le nomment', () => {
    fraiche('effacer');
    const peupler = (o, cleEbay, jeton) => {
      A(`insert into public.vrm_agent_vendeurs (owner) values ('${o}');
         insert into public.vrm_agent_routes (k, owner, compte, fournisseur) values ('${o.replace(/-/g, '')}zzzzzzzzzz', '${o}', 's1', 'boxtal');
         insert into public.vrm_coffre (owner, compte, fournisseur, v, nonce, chiffre, tag) values ('${o}', 's1', 'boxtal', 1, '\\x000102030405060708090a0b', '\\x00', '\\x000102030405060708090a0b0c0d0e0f');`);
      S(`select public.vrm_agent_prendre_cle('${o}', 'ebay:s1:cmd:O1', '${jeton}', 120, ${t(0)}, 's1');
         select public.vrm_agent_ecrire_commande('${o}', '${jeton}', 's1', 'O1', null, '{"etape":"payee","rang":1}', 'ebay', ${t(1)});
         select public.vrm_agent_noter('${o}', '{"geste":"retrait","resultat":"fait","texte":"Bonjour Paul Martin"}', ${t(0)});
         select public.vrm_agent_reserver('${o}', 's1', 1000, 2500, 10, 8000, 30000, ${t(0)});
         select public.vrm_agent_quota('trading:2026-10-12', 'confort', 1, 5000, '${o}', 's1', ${t(0)});
         select public.vrm_agent_vu('${o}', 'notif:N1', ${t(0)});
         select public.vrm_agent_premiere_fois('${o}', 'push:vente:O1', null, ${t(0)});
         select public.vrm_agent_premiere_fois('${o}', 'msg:${o.slice(0, 4)}:merci', null, ${t(0)});
         select public.vrm_agent_titulaire('${cleEbay}', '${o}', 's1', ${t(0)});
         select public.vrm_ebay_indexer_annonces('${o}', 's1', array['12800000${o.slice(0, 4)}'], ${t(0)});
         select public.vrm_agent_preuve_vue('${o}', '1', 'vinted', 'tx-1', ${t(0)});`);
    };
    peupler(J, '0123456789abcdef', uuid(100)); peupler(V, 'fedcba9876543210', uuid(101));
    const TABLES_OWNER = ['vrm_agent_vendeurs', 'vrm_agent_commandes', 'vrm_agent_journal', 'vrm_agent_file', 'vrm_agent_compteurs', 'vrm_agent_vus',
      'vrm_agent_memos', 'vrm_agent_routes', 'vrm_coffre', 'vrm_ebay_titulaires', 'vrm_ebay_annonces_index', 'vrm_agent_preuves'];
    const compte = (o) => TABLES_OWNER.map((x) => x.replace(/^vrm_(agent_|ebay_)?/, '') + ':' + A(`select count(*) from public.${x} where owner = '${o}'`));
    const avant = compte(J);
    dit(avant.every((x) => !x.endsWith(':0')), 'avant : le vendeur a une ligne dans CHACUNE des 12 tables de l\'agent', avant.join(' '));
    const r = QJ(COMME.serveur + `select public.vrm_agent_effacer_vendeur('${J}');`);
    const apres = compte(J);
    dit(apres.every((x) => x.endsWith(':0')), 'après : plus RIEN dans aucune des 12 tables, coffre (ses clés de prestataire), commandes, preuves et index compris [revue : 5 tables sur 12 étaient vérifiées]', apres.filter((x) => !x.endsWith(':0')).join(' ') + ' ' + JSON.stringify(r));
    dit(A(`select count(*) from public.vrm_agent_compteurs where owner = '${N}' and cle like '%${J}%'`) === '0', 'les quotas par compte qui le NOMMENT, rangés sous le neutre, partent aussi');
    const autre = compte(V);
    dit(autre.every((x) => !x.endsWith(':0')) && A(`select count(*) from public.vrm_agent_compteurs where owner = '${N}' and cle like '%${V}%'`) === '1', 'rien de l\'autre vendeur ne bouge', autre.join(' '));
    dit(A(`select count(*) from public.vrm_agent_memos where owner = '${N}'`) === '2', 'les mémos GLOBAUX restent (ils ne disent que « ce geste a été fait pour cette commande eBay »)');
    dit(S(`select public.vrm_agent_effacer_vendeur('${N}') is null;`) === 't', 'le propriétaire neutre ne s\'efface pas');
  });
  await essaie('« Fermer mon compte » FERME LA PORTE : un battement en vol n\'écrit plus rien à son nom [revue]', () => {
    // Suite de la base « effacer » : J est effacé, V ne l'est pas.
    const tente = {
      'noter (R5 : sans bail)': [`select public.vrm_agent_noter('${J}', '{"geste":"message","resultat":"fait","cible":"O7","texte":"Bonjour Paul Martin, ton colis part demain"}', ${t(30)}) is null;`, 't'],
      'planifier': [`select public.vrm_agent_planifier('${J}', 'ebay:s1:veille', 's1', ${t(60)}, ${t(40)}) is null;`, 't'],
      'prendre_cle': [`select public.vrm_agent_prendre_cle('${J}', 'ebay:s1:cmd:O8', '${uuid(102)}', 120, ${t(42)}, 's1');`, 'f'],
      'premiere_fois (par vendeur)': [`select public.vrm_agent_premiere_fois('${J}', 'push:vente:O7', null, ${t(43)});`, 'f'],
      'premiere_fois (globale)': [`select public.vrm_agent_premiere_fois('${J}', 'msg:O9:merci', null, ${t(43)});`, 'f'],
      'vu': [`select public.vrm_agent_vu('${J}', 'notif:N9', ${t(44)});`, 'f'],
      'ecrire_commande': [`select public.vrm_agent_ecrire_commande('${J}', '${uuid(100)}', 's1', 'O8', null, '{"etape":"payee","rang":1}', 'ebay', ${t(45)}) is null;`, 't'],
      'reserver': [`select public.vrm_agent_reserver('${J}', 's1', 100, 2500, 10, 8000, 30000, ${t(46)}) ->> 'raison';`, 'efface'],
      'quota (confort)': [`select public.vrm_agent_quota('trading:2026-10-12', 'confort', 1, 5000, '${J}', 's1', ${t(47)});`, 'f'],
      'quota (obligation)': [`select public.vrm_agent_quota('trading:2026-10-12', 'obligation', 1, 5000, '${J}', 's1', ${t(47)});`, 'f'],
      'titulaire': [`select public.vrm_agent_titulaire('0123456789abcdef', '${J}', 's1', ${t(48)});`, 'f'],
      'indexer': [`select public.vrm_ebay_indexer_annonces('${J}', 's1', array['128000099999'], ${t(49)}) is null;`, 't'],
      'preuve_vue': [`select public.vrm_agent_preuve_vue('${J}', '2', 'vinted', 'tx-2', ${t(50)}) is null;`, 't'],
    };
    const ouverts = Object.entries(tente).filter(([, [sql, attendu]]) => { const r = run(COMME.serveur + sql, { db: DB }); return !r.ok || r.out !== attendu; }).map(([k]) => k);
    dit(ouverts.length === 0, 'noter, planifier, prendre_cle, premiere_fois, vu, ecrire_commande, reserver, quota, titulaire, indexer, preuve_vue : tous refusent un vendeur effacé', ouverts.join(' · '));
    const directs = {
      vrm_agent_vendeurs: `(owner, actif) values ('${J}', true)`,
      vrm_coffre: `(owner, compte, fournisseur, v, nonce, chiffre, tag) values ('${J}', 's1', 'ebay', 1, '\\x000102030405060708090a0b', '\\x00', '\\x000102030405060708090a0b0c0d0e0f')`,
      vrm_agent_vus: `(owner, cle) values ('${J}', 'notif:N10')`,
      vrm_agent_routes: `(k, owner, fournisseur) values ('${'z'.repeat(40)}', '${J}', 'boxtal')`,
    };
    const passes = Object.entries(directs).filter(([x, ligne]) => !refuse(run(COMME.serveur + `insert into public.${x} ${ligne};`, { db: DB }), /vrm_vendeur_efface/)).map(([x]) => x);
    dit(passes.length === 0, 'les écritures DIRECTES du serveur (pouls, coffre, vus, routes) sont refusées aussi (« vrm_vendeur_efface »)', passes.join(' · '));
    const reste = ['vrm_agent_journal', 'vrm_agent_file', 'vrm_agent_memos', 'vrm_agent_vendeurs', 'vrm_coffre', 'vrm_agent_commandes'].map((x) => A(`select count(*) from public.${x} where owner = '${J}'`)).join('');
    dit(reste === '000000' && A(`select count(*) from public.vrm_agent_compteurs where cle like '%${J}%' or owner = '${J}'`) === '0', 'et rien ne renaît : ni journal (texte de l\'acheteur compris), ni tâche, ni mémo, ni compteur', reste);
    dit(S(`select public.vrm_agent_noter('${V}', '{"geste":"retrait","resultat":"fait"}', ${t(51)}) is not null;`) === 't', 'l\'autre sens : l\'autre vendeur écrit toujours');
  });
  // ── La revue du 12 octobre (second tour) : la pierre tombale n'était visible qu'au COMMIT de l'effacement.
  //    Chaque course est jouée sur un ÉTAT observé : la transaction d'effacement (ou de l'écrivain) est tenue
  //    ouverte après son travail, et l'autre partie n'est lancée qu'une fois cette fenêtre atteinte.
  await essaie('« Fermer mon compte » PENDANT une sonnette, une note et un clic : rien ne survit, et le battement des autres ne lève jamais [revue 2]', async () => {
    fraiche('course');
    tache(J, 'ebay:s1:veille', 's1', -60); tache(V, 'ebay:s9:veille', 's9', -30);
    S(`select public.vrm_agent_noter('${J}', '{"geste":"retrait","resultat":"fait","texte":"merci"}', ${t(0)});`);
    // L'effacement a fini de supprimer, mais n'est pas encore validé : la fenêtre où la pierre tombale ne se voyait pas.
    const E = runAsync(COMME.serveur + `begin;\nselect 'E:' || public.vrm_agent_effacer_vendeur('${J}')::text;\nselect pg_sleep(1.51);\ncommit;\n`, { db: DB });
    const fenetre = await attendreQue(enSommeil('1.51'));
    const B = runAsync(COMME.serveur + `select 'B:' || coalesce(public.vrm_agent_planifier('${J}', 'ebay:s1:cmd:O9', 's1', ${t(0)}, ${t(0)})::text, 'null');`, { db: DB });
    const C = runAsync(COMME.serveur + `select 'C:' || coalesce(public.vrm_agent_noter('${J}', '{"geste":"message","resultat":"fait","cible":"O7","texte":"Bonjour Paul Martin, 12 rue des Lilas, ton colis part demain"}', ${t(0)})::text, 'null');`, { db: DB });
    const D = runAsync(COMME.serveur + `select 'D:' || public.vrm_agent_prendre_cle('${J}', 'ebay:s1:cmd:O8', '${uuid(120)}', 120, ${t(0)}, 's1');`, { db: DB });
    const [e, b, c, d] = await Promise.all([E, B, C, D]);
    if (!fenetre) throw new Error('l\'effacement n\'a jamais atteint sa fenêtre (contrôle vacant) : ' + (e.out + ' ' + e.err).slice(0, 200));
    dit(e.ok && b.ok && c.ok && d.ok, 'l\'effacement, la sonnette, la note et le clic répondent tous, sans erreur', [e.err, b.err, c.err, d.err].join(' ').slice(0, 300));
    dit(/B:null/.test(b.out) && /C:null/.test(c.out) && /D:f/.test(d.out), 'arrivés PENDANT l\'effacement, la sonnette, la note et le clic attendent sa fin, puis sont REFUSÉS (la pierre tombale est relue APRÈS le verrou)', [b.out, c.out, d.out].join(' '));
    const reste = ['vrm_agent_file', 'vrm_agent_journal'].map((x) => A(`select count(*) from public.${x} where owner = '${J}'`)).join('|');
    dit(reste === '0|0', 'et rien ne survit à son nom : ni tâche, ni ligne de journal (le texte de l\'acheteur compris) — « Fermer mon compte » ne rend plus « fait » sur une porte restée ouverte', reste + ' ' + A(`select coalesce(string_agg(texte, ' · '), '') from public.vrm_agent_journal where owner = '${J}'`));
    const p = run(COMME.serveur + `select coalesce(json_agg(x.owner || ' ' || x.cle), '[]') from public.vrm_agent_prendre(8, '${uuid(121)}', 120, ${t(5)}) x;`, { db: DB });
    dit(p.ok && p.out.includes(V) && !p.out.includes(J), 'le battement suivant ne lève pas, et prend la veille de l\'autre vendeur', p.ok ? p.out : p.err.slice(0, 200));
  });
  await essaie('une ligne restée au nom d\'un vendeur effacé ne fait JAMAIS échouer le battement des autres [revue 2]', () => {
    // Suite de la base « course » : J est effacé. Une ligne orpheline posée par le banc (déclencheur suspendu le
    // temps de la poser : ce que la sérialisation empêche désormais), sur un compte LIBRE et PLUS en retard que la
    // tâche de l'autre vendeur : elle est la première candidate.
    A(`alter table public.vrm_agent_file disable trigger vrm_agent_pierre_tombale;
       insert into public.vrm_agent_file (owner, cle, groupe, prochain) values ('${J}', 'ebay:s7:veille', 's7', ${t(-7200)});
       alter table public.vrm_agent_file enable trigger vrm_agent_pierre_tombale;`);
    tache(V, 'ebay:s8:veille', 's8', -60);
    const p = run(COMME.serveur + `select coalesce(json_agg(x.owner || ' ' || x.cle), '[]') from public.vrm_agent_prendre(8, '${uuid(122)}', 120, ${t(10)}) x;`, { db: DB });
    dit(p.ok && p.out.includes('ebay:s8:veille') && !p.out.includes(J), 'prendre ÉCARTE le vendeur effacé (il levait `vrm_vendeur_efface` pour tout le monde, à chaque battement) et sert l\'autre vendeur', p.ok ? p.out : p.err.slice(0, 200));
    dit(A(`select bail_jeton is null from public.vrm_agent_file where owner = '${J}' and cle = 'ebay:s7:veille'`) === 't', 'la ligne orpheline n\'est pas prise');
  });
  await essaie('« Fermer mon compte » PENDANT une écriture DIRECTE du serveur (coffre, pouls, vus) : elle part avec le reste [revue 2]', async () => {
    fraiche('course2');
    const W = runAsync(COMME.serveur + `begin;
insert into public.vrm_coffre (owner, compte, fournisseur, v, nonce, chiffre, tag) values ('${J}', 's1', 'boxtal', 1, '\\x000102030405060708090a0b', '\\x00', '\\x000102030405060708090a0b0c0d0e0f');
insert into public.vrm_agent_vendeurs (owner, actif) values ('${J}', true);
insert into public.vrm_agent_vus (owner, cle) values ('${J}', 'notif:N7');
select pg_sleep(1.52);
commit;
`, { db: DB });
    const enVol = await attendreQue(enSommeil('1.52'));
    const e = await runAsync(COMME.serveur + `select 'E:' || public.vrm_agent_effacer_vendeur('${J}')::text;`, { db: DB });
    const w = await W;
    if (!enVol) throw new Error('l\'écriture n\'a jamais atteint sa fenêtre (contrôle vacant) : ' + w.err.slice(0, 200));
    dit(w.ok && e.ok, 'l\'écriture en vol et l\'effacement répondent', (w.err + ' ' + e.err).slice(0, 200));
    const reste = ['vrm_coffre', 'vrm_agent_vendeurs', 'vrm_agent_vus'].map((x) => A(`select count(*) from public.${x} where owner = '${J}'`)).join('|');
    dit(reste === '0|0|0', 'l\'effacement ATTEND l\'écriture directe en vol (le déclencheur prend le verrou du vendeur), puis l\'efface : rien ne reste à son nom', reste + ' ' + e.out.slice(0, 200));
  });
  await essaie('« Fermer mon compte » PENDANT un battement qui écrit par les fonctions (journal, mémos, preuve, vu, réservation) [revue 2]', async () => {
    fraiche('course3');
    const W = runAsync(COMME.serveur + `begin;
select public.vrm_agent_noter('${J}', '{"geste":"message","resultat":"fait","cible":"O7","texte":"Bonjour Paul Martin, ton colis part demain"}', ${t(0)});
select public.vrm_agent_premiere_fois('${J}', 'push:vente:O7', null, ${t(0)});
select public.vrm_agent_preuve_vue('${J}', '7', 'vinted', 'tx-7', ${t(0)});
select public.vrm_agent_vu('${J}', 'notif:N7', ${t(0)});
select public.vrm_agent_reserver('${J}', 's1', 840, 2500, 10, 8000, 30000, ${t(0)});
select pg_sleep(1.53);
commit;
`, { db: DB });
    const enVol = await attendreQue(enSommeil('1.53'));
    const e = await runAsync(COMME.serveur + `select 'E:' || public.vrm_agent_effacer_vendeur('${J}')::text;`, { db: DB });
    const w = await W;
    if (!enVol) throw new Error('le battement n\'a jamais atteint sa fenêtre (contrôle vacant) : ' + w.err.slice(0, 200));
    dit(w.ok && e.ok, 'le battement en vol et l\'effacement répondent', (w.err + ' ' + e.err).slice(0, 200));
    const reste = ['vrm_agent_journal', 'vrm_agent_memos', 'vrm_agent_preuves', 'vrm_agent_vus', 'vrm_agent_compteurs'].map((x) => A(`select count(*) from public.${x} where owner = '${J}'`)).join('|');
    dit(reste === '0|0|0|0|0', 'l\'effacement attend la fin du battement, et ses lignes partent avec le reste : journal, mémos, preuve, vu, réservation', reste + ' ' + e.out.slice(0, 200));
  });
  await essaie('« Fermer mon compte » PENDANT un quota qui attend le compteur du jour : aucun compteur ne survit, et le quota ne répond jamais vrai APRÈS l\'effacement [revue 2]', async () => {
    fraiche('course4');
    // V tient la ligne globale du jour (la contention normale : tous les appels de l'installation la verrouillent).
    const Vq = runAsync(COMME.serveur + `begin;\nselect 'V:' || public.vrm_agent_quota('trading:2026-10-12', 'confort', 1, 5000, '${V}', 's9', ${t(0)});\nselect pg_sleep(1.54);\ncommit;\n`, { db: DB });
    const tenu = await attendreQue(enSommeil('1.54'));
    const Jq = runAsync(COMME.serveur + `select 'J:' || public.vrm_agent_quota('trading:2026-10-12', 'confort', 1, 5000, '${J}', 's1', ${t(0)});`, { db: DB });
    const attend = await attendreQue(`select exists (select 1 from pg_stat_activity where query like '%vrm_agent_quota%${J}%' and wait_event_type = 'Lock')`);
    const e = await runAsync(COMME.serveur + `select 'E:' || public.vrm_agent_effacer_vendeur('${J}')::text;`, { db: DB });
    const [v, j] = await Promise.all([Vq, Jq]);
    if (!tenu || !attend) throw new Error('la course n\'a pas eu lieu (contrôle vacant) : ' + JSON.stringify({ tenu, attend, v: v.out, j: j.out }));
    dit(v.ok && j.ok && e.ok, 'les deux quotas et l\'effacement répondent', (v.err + ' ' + j.err + ' ' + e.err).slice(0, 200));
    const cc = A(`select count(*) from public.vrm_agent_compteurs where cle like '%${J}%'`);
    const quotas = (/"quotas": (\d+)/.exec(e.out) || [])[1];
    dit(cc === '0', 'aucun compteur qui NOMME le vendeur ne survit (il est rangé sous le neutre, où le déclencheur ne le voit pas)', `${cc} · ${j.out} · quotas=${quotas}`);
    dit(!/J:t/.test(j.out) || Number(quotas) >= 1, 'un quota qui a répondu vrai l\'a fait AVANT l\'effacement, qui l\'a vu et effacé (jamais un « vrai » validé après)', `${j.out} · quotas=${quotas}`);
    dit(S(`select public.vrm_agent_quota('trading:2026-10-12', 'confort', 1, 5000, '${J}', 's2', ${t(1)});`) === 'f', 'et l\'appel suivant est refusé');
  });
  await essaie('READ COMMITTED exigé : la relecture après le verrou n\'a lieu que là [revue 2]', () => {
    const rr = run(COMME.serveur + `begin isolation level repeatable read;\nselect public.vrm_agent_noter('${V}', '{"geste":"retrait","resultat":"fait"}', ${t(0)});\ncommit;\n`, { db: DB });
    const rr2 = run(COMME.serveur + `begin isolation level repeatable read;\nselect public.vrm_agent_effacer_vendeur('${V}');\ncommit;\n`, { db: DB });
    dit(refuse(rr, /vrm_agent_isolation/) && refuse(rr2, /vrm_agent_isolation/) && A(`select count(*) from public.vrm_agent_effaces where owner = '${V}'`) === '0',
      'une écriture ou un effacement en REPEATABLE READ (la pierre tombale y serait relue sur un instantané d\'avant le verrou) est refusé (« vrm_agent_isolation »)', (rr.err + ' ' + rr2.err).slice(0, 200));
    dit(S(`select public.vrm_agent_noter('${V}', '{"geste":"retrait","resultat":"fait"}', ${t(0)}) is not null;`) === 't', 'l\'autre sens : en READ COMMITTED (le défaut de PostgREST), elle passe');
  });
  await essaie('compacter les commandes closes depuis 90 jours', () => {
    fraiche('compacter');
    A(`insert into public.vrm_agent_commandes (owner, compte, commande, etape, rang, maj, data) values
         ('${J}', 's1', 'VIEILLE', 'close', 10, ${t(-100 * JOUR)}, '{"transitions":[1,2,3],"bordereau":{"prixCentimes":840},"preuve":{"suivi":"X1"},"devis":{"ville":"Rennes"}}'),
         ('${J}', 's1', 'EN-COURS', 'a_expedier', 2, ${t(-100 * JOUR)}, '{"transitions":[1]}');`);
    S(`select public.vrm_agent_purger(${t(0)});`);
    const d = QJ(`select json_object_agg(commande, data) from public.vrm_agent_commandes`, { role: 'supabase_admin' });
    dit(d && d.VIEILLE && d.VIEILLE.bordereau && d.VIEILLE.preuve && !d.VIEILLE.transitions && !d.VIEILLE.devis, 'une commande close depuis 90 jours ne garde que son bordereau et sa preuve (jamais supprimée)', JSON.stringify(d && d.VIEILLE));
    dit(d && d['EN-COURS'] && d['EN-COURS'].transitions, 'une commande en cours n\'est pas touchée');
  });
  await essaie('l\'historique de pg_cron (à la forme Supabase) : purgé, et sans jamais faire échouer le reste', () => {
    fraiche('cron');
    A(`create schema cron; create table cron.job_run_details (runid bigint primary key, end_time timestamptz);
       grant usage on schema cron to postgres; grant all on all tables in schema cron to postgres;
       insert into cron.job_run_details values (1, ${t(-10 * JOUR)}), (2, ${t(-1 * JOUR)});`);
    const r = QJ(COMME.serveur + `select public.vrm_agent_purger(${t(0)});`);
    dit(r && r.cron === 1 && A('select count(*) from cron.job_run_details') === '1', 'les exécutions de plus de 7 jours partent', JSON.stringify(r));
    A(`revoke delete on cron.job_run_details from postgres; insert into public.vrm_agent_vus (owner, cle, at) values ('${J}', 'notif:vieille', ${t(-30 * JOUR)});`);
    const r2 = run(COMME.serveur + `select public.vrm_agent_purger(${t(0)});`, { db: DB });
    dit(r2.ok && A(`select count(*) from public.vrm_agent_vus`) === '0', 'un droit qui manque sur l\'historique ne fait pas échouer la purge des vus, mémos, journal (« cron » : pas su)', r2.ok ? r2.out : r2.err.slice(0, 120));
  });

  console.log(`\n${ok + ko} contrôles, ${ko} au rouge.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l\'audit a levé : ' + String(e && e.stack || e).slice(0, 500)); process.exit(1); });
}

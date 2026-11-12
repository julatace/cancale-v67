// Migration 038 (tables typées remplies à côté d'app_data) sur PostgreSQL JETABLE,
// jamais sur Supabase. Modèle : scripts/audit-politiques-uniques-sql.cjs.
//
// On rebâtit app_data telle que la production la porte (owner, id, data JSONB,
// meta remplie par le VRAI déclencheur de la 004, la VRAIE clé des N° de la 013,
// la garde des N° de la 017, la permissive de la 021), et vinted_accounts avec
// ses jetons. On y verse des lignes INVENTÉES de la vraie forme (data.payload.items,
// payload.my_orders, payload.transaction, bordereaux avec PDF, email_bord_*,
// email_track_*, main.vinted_used_numeros / vinted_annonce_numeros), dont des
// formes inconnues et des éléments sans identité, puis :
//   1. app_data et vinted_accounts sont IDENTIQUES avant et après (rien retiré, aucun N° changé) ;
//   2. chaque ligne de forme connue a sa (ses) ligne(s) typée(s), comptes exacts ;
//   3. remplissage rejoué deux fois (et ré-écriture à l'identique) = même résultat ;
//   4. une forme inconnue n'écrit rien (la copie d'avant reste) et est comptée ;
//   5. RLS : un vendeur ne voit jamais l'autre, n'écrit rien, n'appelle pas la recopie ;
//   6. les N° sont append-only (ni modifiés, ni retirés, même si main perd un N°) ;
//   7. une erreur de recopie ne fait jamais échouer l'écriture d'app_data ;
//   8. mesure du temps sur 50 000 lignes (remplissage, surcoût d'une écriture, lecture).
// Mutations (le banc sait échouer) : politique `using (true)`, garde des N° retirée,
// enveloppe d'erreur retirée, forme inconnue qui efface, N° « do update ».
// Usage : node scripts/audit-tables-typees-sql.cjs [--petit]  (--petit : sans la mesure 50 000)
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync, execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const PETIT = process.argv.includes('--petit');
const candidats = [process.env.PG_BIN];
try { for (const v of fs.readdirSync('/usr/lib/postgresql')) candidats.push(`/usr/lib/postgresql/${v}/bin`); } catch (_) {}
const BIN = candidats.find(d => d && ['initdb', 'pg_ctl', 'postgres', 'psql'].every(n => fs.existsSync(path.join(d, n))));
if (!BIN) { console.error('PostgreSQL absent : audit NON exécuté (PG_BIN requis).'); process.exit(1); }
let identite = {};
if (process.getuid?.() === 0) { try { identite = { uid: Number(execFileSync('id', ['-u', 'postgres'])), gid: Number(execFileSync('id', ['-g', 'postgres'])) }; } catch (_) { console.error('Utilisateur postgres absent : audit NON exécuté.'); process.exit(1); } }
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-tables-typees-'));
if (identite.uid !== undefined) fs.chownSync(DIR, identite.uid, identite.gid);
const PORT = String(55000 + process.pid % 1000);
const serveur = (n, args) => spawnSync(path.join(BIN, n), args, { encoding: 'utf8', ...identite });
let demarre = false;
const nettoyer = () => { if (demarre) { serveur('pg_ctl', ['-D', DIR + '/data', '-m', 'immediate', 'stop']); demarre = false; } fs.rmSync(DIR, { recursive: true, force: true }); };
process.on('exit', nettoyer); process.on('SIGINT', () => process.exit(1)); process.on('SIGTERM', () => process.exit(1));
let BASE = 'postgres';
const run = (sql, db = BASE) => { const r = spawnSync(path.join(BIN, 'psql'), ['-h', DIR, '-p', PORT, '-U', 'postgres', '-d', db, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8', maxBuffer: 1 << 30 }); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: r.stderr || '' }; };
const Q = (sql, db) => { const r = run(sql, db); if (!r.ok) throw Error(r.err.slice(0, 2000)); return r.out; };

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333', D = '44444444-4444-4444-8444-444444444444';
const lire = f => fs.readFileSync(path.join(RACINE, 'supabase/migrations', f), 'utf8');
const M038 = lire('038-tables-typees.sql');
const M004 = lire('004-meta-et-rls-rapide.sql');
const M013 = lire('013-anciens-numeros-en-b.sql');
const M017 = lire('017-garde-numeros-rapide.sql');
const M021 = lire('021-confidentialite-boutiques.sql');
// Les VRAIS morceaux : meta (004), clé des N° (013). (Le reste de la 013 est la migration de données d'octobre.)
const META_SQL = M004.slice(M004.indexOf('create or replace function public.vrm_meta('), M004.indexOf('-- Rattrapage'));
const i013 = M013.indexOf('create or replace function public.vrm_cle_num(');
const CLE_SQL = M013.slice(i013, M013.indexOf('$$;', M013.indexOf('$$', M013.indexOf('as $$', i013) + 5)) + 3);
if (!META_SQL.includes('vrm_meta_trigger') || !CLE_SQL.includes('ltrim')) { console.error('extraction 004/013 ratée'); process.exit(1); }

// ── Données inventées de la VRAIE forme ───────────────────────────────────
function prng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const cleNum = v => { if (v == null || typeof v === 'object') return null; let s = String(v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^[0-9]+$/.test(s)) s = s.replace(/^0+/, '') || '0'; return s || null; };
const PDF = 'JVBERi0xLjQK' + 'A'.repeat(3000);
function generer(nOwners, taille) {
  const rnd = prng(42), rows = [], comptes = [];
  const att = { annonces: 0, ventes: 0, achats: 0, transactions: 0, colis: 0, emails: 0, numeros: 0, numeros_fiches: 0, comptes: 0 };
  const parOwner = {}; // owner → { table: n }
  const ecarts = { forme: 0, meta_absente: 0, sans_identite: 0 };
  let seqItem = 9000000000, seqTx = 7000000000, seqUid = 10000000;
  const owners = [A, B, C, D];
  for (let i = owners.length; i < nOwners; i++) owners.push(`${(0x50000000 + i).toString(16)}-0000-4000-8000-${String(i).padStart(12, '0')}`);
  const T = taille;
  for (const o of owners) {
    const po = parOwner[o] = { annonces: 0, ventes: 0, achats: 0, transactions: 0, colis: 0, emails: 0, numeros: 0, numeros_fiches: 0, comptes: 0 };
    const add = (t, n = 1) => { att[t] += n; po[t] += n; };
    const itemIds = [];
    for (let c = 0; c < 2; c++) {
      const uid = String(seqUid++);
      comptes.push({ owner: o, uid, login: `shop_${uid}`, domain: 'www.vinted.fr' }); add('comptes');
      const cap = new Date(Date.UTC(2026, 10, 10, 8, c)).toISOString();
      // Annonces (articleMaigre). A : 50 paires IDENTIQUES (même titre, marque, taille) — 50 lignes, 50 identités.
      const items = [];
      for (let k = 0; k < T.annonces; k++) {
        const id = ++seqItem; itemIds.push(id);
        const pareil = o === A && c === 0 && k < 50;
        items.push({ id, title: pareil ? 'Nike Air Max 90 · 42' : `Sneaker ${k}`, price: { amount: o === A && c === 0 && k === 0 ? '25.5' : (o === A && c === 0 && k === 1 ? '25,50' : String(20 + (k % 90))), currency_code: 'EUR' },
          url: `https://www.vinted.fr/items/${id}`, brand_title: pareil ? 'Nike' : 'Adidas', size_title: '42', status: 'Très bon état',
          view_count: k, favourite_count: k % 7, is_hidden: k % 31 === 0, is_closed: false, is_draft: false, is_reserved: false,
          created_at_ts: 1760000000 + k, photo: { url: `https://images1.vinted.net/t/${id}.jpg` }, nPhotos: 5, descLen: 120,
          ...(k % 10 === 0 ? { numEcrit: { n: String(k), ou: 'description' } } : {}) });
      }
      let nAnn = items.length;
      if (o === B && c === 0) { items.push({ title: 'sans id', price: { amount: '10' } }); items.push('pas un objet'); ecarts.sans_identite += 2; }
      if (o === B && c === 0) { items.push({ ...items[0] }); } // la même annonce lue deux fois : une seule ligne
      const listingsDeC = o === C && c === 1;
      rows.push({ owner: o, id: `harvest_${uid}_listings`, data: listingsDeC ? { type: 'listings', uid, capturedAt: cap, payload: { code: 0 } } : { type: 'listings', uid, domain: 'www.vinted.fr', capturedAt: cap, nItems: items.length, payload: { code: 0, pagination: { total_entries: items.length }, items } } });
      if (listingsDeC) ecarts.forme++; else add('annonces', nAnn);
      // Ventes / achats (commandeMaigre).
      for (const [type, table, n] of [['orders_sold', 'ventes', T.ventes], ['orders_purchased', 'achats', T.achats]]) {
        const lst = [];
        for (let k = 0; k < n; k++) {
          const tx = ++seqTx;
          lst.push({ date: new Date(Date.UTC(2026, 9, 1 + (k % 28), 10)).toISOString(), price: { amount: String(30 + (k % 50)) + '.00', currency_code: 'EUR' },
            title: o === A && k < 20 ? 'Nike Air Max 90 · 42' : `Commande ${k}`, status: k % 5 ? 'Commande finalisée' : 'Colis en route',
            transaction_id: tx, conversation_id: 500000000 + tx % 100000, transaction_user_status: k % 9 === 0 ? 'needs_action' : 'completed',
            item_id: itemIds[k % itemIds.length], photo: { url: `https://images1.vinted.net/t/o${tx}.jpg` } });
        }
        let nCmd = lst.length;
        if (o === B && type === 'orders_sold' && c === 0) { lst.push({ title: 'sans n°', price: { amount: '12' } }); ecarts.sans_identite++; lst.push({ ...lst[0] }); }
        const casse = o === C && type === 'orders_purchased' && c === 0;
        rows.push({ owner: o, id: `harvest_${uid}_${type}`, data: casse ? 'texte au lieu d’un objet' : { type, uid, domain: 'www.vinted.fr', capturedAt: cap, nItems: lst.length, payload: { pagination: { total_entries: lst.length }, my_orders: lst } } });
        if (casse) ecarts.forme++; else add(table, nCmd);
      }
      // Transactions (une ligne par transaction).
      for (let k = 0; k < T.txn; k++) {
        const tx = ++seqTx;
        const vide = o === C && c === 0 && k === 0;
        rows.push({ owner: o, id: `harvest_${uid}_txn_${tx}`, data: { type: 'transaction', uid, domain: 'www.vinted.fr', capturedAt: cap,
          payload: vide ? {} : { transaction: { id: tx, item_id: itemIds[k % itemIds.length], status: k % 3 ? 450 : 230, status_title: k % 3 ? 'Commande finalisée' : 'Colis en route', status_updated_at: cap, shipment: { status_title: 'Livré' } } } } });
        if (vide) ecarts.forme++; else add('transactions');
      }
      // Bordereaux Vinted (avec PDF), + « le dernier capté » (pas une identité).
      for (let k = 0; k < T.labels; k++) {
        const tx = 7100000000 + k + c * 1000 + owners.indexOf(o) * 10000;
        const faux = o === C && c === 0 && k === 0;
        rows.push({ owner: o, id: `harvest_${uid}_label_${tx}`, data: { uid, url: 'https://www.vinted.fr/label.pdf', capturedAt: cap, pdfB64: PDF, tx: String(faux ? tx + 1 : tx) } });
        if (faux) ecarts.forme++; else add('colis');
      }
      rows.push({ owner: o, id: `harvest_${uid}_label_latest`, data: { uid, url: 'x', capturedAt: cap, pdfB64: PDF } });
      // Hors périmètre (conversations, profil) : jamais recopiés.
      for (let k = 0; k < T.conv; k++) rows.push({ owner: o, id: `harvest_${uid}_conv_${seqTx + k}`, data: { type: 'conversation', uid, capturedAt: cap, payload: { conversation: { id: k, messages: [{ entity_type: 'message', entity: { body: 'Bonjour' } }] } } } });
      rows.push({ owner: o, id: `harvest_${uid}_profile`, data: { type: 'profile', uid, capturedAt: cap, payload: { id: Number(uid), login: `shop_${uid}` } } });
    }
    // E-mails : bordereaux (PDF), suivis, ventes ; un journal (hors périmètre).
    for (let k = 0; k < T.emails; k++) {
      const tx = 7200000000 + k + owners.indexOf(o) * 10000, suivi = `MR${tx}`;
      rows.push({ owner: o, id: `email_bord_${tx}`, data: { type: 'bordereau', article: 'Nike Air Max 90', modele: 'Air Max', numero: String(k + 1), taille: '42', suivi, transaction: String(tx), dateLimite: '14 novembre', transporteur: 'Mondial Relay', account: 'shop', uid: '', pdfB64: PDF, filename: 'b.pdf', posKnown: true, receivedAt: '2026-11-10T09:00:00.000Z' } });
      add('emails'); add('colis');
      const sansSuivi = o === B && k === 0;
      rows.push({ owner: o, id: `email_track_mondialrelay_${sansSuivi ? 'h' + k : suivi}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi: sansSuivi ? '' : suivi, status: 'available', statusLabel: 'Disponible', subject: 'Votre colis est disponible', receivedAt: '2026-11-10T10:00:00.000Z', emailAt: '2026-11-10T09:58:00.000Z', code: String(100000 + k), lieu: 'Tabac du port', limite: '2026-11-20' } });
      add('emails'); if (sansSuivi) ecarts.sans_identite++; else add('colis');
      rows.push({ owner: o, id: `email_sale_${tx}`, data: { type: 'vente', subject: 'Ça y est, vendu !', transaction: String(tx), receivedAt: '2026-11-10T08:00:00.000Z' } });
      add('emails');
    }
    rows.push({ owner: o, id: 'email_journal', data: { lignes: [] } });
    rows.push({ owner: o, id: 'lbc_listings', data: { annonces: [] } });
    // main : le pool (nombres, « 007 », « B125 », doublons d'écriture) et les fiches.
    const pool = []; for (let n = 1; n <= T.pool; n++) pool.push(n);
    pool.push('007', ' 42 ', 'B125', 'b-126', '', null);
    const fiches = {};
    itemIds.slice(0, T.fiches).forEach((id, k) => { fiches[String(id)] = { numero: k % 4 === 0 ? String(k + 1) : k + 1, ...(k % 3 === 0 ? { manuelAt: '2026-11-01T10:00:00Z' } : {}) }; });
    fiches['sans-numero'] = { numero: '' }; fiches['pas-objet'] = 12;
    const poolCasse = o === C;
    rows.push({ owner: o, id: 'main', data: { vinted_used_numeros: poolCasse ? { a: 1 } : pool, vinted_annonce_numeros: fiches, vinted_buyprice_by_num: { 1: 30 }, vinted_dark: true, gros: 'x'.repeat(T.mainOctets) } });
    if (poolCasse) ecarts.forme++; else add('numeros', new Set(pool.map(cleNum).filter(Boolean)).size);
    add('numeros_fiches', Object.keys(fiches).length - 2);
  }
  return { rows, comptes, att, parOwner, ecarts, owners };
}
const csv = s => '"' + String(s).replace(/"/g, '""') + '"';
function verser(gen) {
  let txt = 'copy public.app_data(owner,id,data) from stdin with (format csv);\n';
  for (const r of gen.rows) txt += `${r.owner},${csv(r.id)},${csv(JSON.stringify(r.data))}\n`;
  txt += '\\.\n';
  txt += 'insert into public.vinted_accounts(owner,vinted_user_id,login,domain,access_token,refresh_token,csrf_token) values\n' +
    gen.comptes.map(c => `('${c.owner}',${c.uid},'${c.login}','${c.domain}','JETON-SECRET-${c.uid}','REFRESH-${c.uid}','csrf')`).join(',\n') + ';\n';
  Q(txt);
}

let nBase = 0;
function batir() {
  const db = 'essai' + (++nBase); Q(`create database ${db}`, 'postgres'); BASE = db;
  Q(`create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  do $r$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; create role authenticated; create role service_role bypassrls; end if; end $r$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  -- Comme Supabase : tout objet neuf de public est ouvert par défaut à anon / authenticated.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create table public.app_data(owner uuid not null, id text not null, data jsonb, updated_at timestamptz default now(), primary key(owner,id));
  create table public.vinted_accounts(owner uuid not null, vinted_user_id bigint not null, login text, domain text, access_token text, refresh_token text, csrf_token text, anon_id text, primary key(owner, vinted_user_id));
  grant all on public.app_data, public.vinted_accounts to anon, authenticated, service_role;
  alter table public.app_data enable row level security; alter table public.vinted_accounts enable row level security;
  create policy "chacun ses lignes" on public.app_data using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
  create policy "chacun ses comptes" on public.vinted_accounts using (owner = (select auth.uid())) with check (owner = (select auth.uid()));`);
  Q(META_SQL); Q(CLE_SQL); Q(M017);
  Q(`create trigger vrm_garde_numeros before update of data on public.app_data for each row when (new.id = 'main') execute function public.vrm_garde_numeros();`);
  Q(M021);
  return db;
}
const comme = a => a === 'anon' ? `set local role anon;` : a === 'vide' ? `set local role authenticated;` : `set local role authenticated;set local "request.jwt.claim.sub"='${a}';`;
const op = (a, sql) => { const r = run(`begin;${comme(a)}${sql};rollback;`); return r.ok ? (r.out.split('\n').pop() || '∅') : 'REFUS'; };
const TABLES = ['annonces', 'ventes', 'achats', 'transactions', 'colis', 'emails', 'numeros', 'numeros_fiches', 'comptes'];
const SANS_HORODATAGE = `- 'projete_le' - 'vu_le'`;
const empreinteTables = () => TABLES.concat(['vrm_projection_sources', 'vrm_projection_ecarts']).map(t =>
  t + ':' + Q(`select count(*)||':'||coalesce(md5(string_agg(j, '|' order by j)),'') from (select (to_jsonb(x) ${SANS_HORODATAGE})::text j from public.${t} x) z`)).join(' ');
const empreinteSource = () => Q(`select count(*)||':'||md5(string_agg(owner::text||id||coalesce(data::text,'')||coalesce(meta::text,'')||updated_at::text, '|' order by owner, id)) from public.app_data`) + ' / ' +
  Q(`select md5(string_agg(to_jsonb(v)::text, '|' order by owner, vinted_user_id)) from public.vinted_accounts v`);
const remplir = (lot = 2000) => { let tours = 0, t0 = Date.now(), tot = { traitees: 0, recopiees: 0, inconnues: 0, erreurs: 0 };
  for (;;) { tours++; const [n, ok, inc, err, fini] = Q(`select traitees, recopiees, inconnues, erreurs, fini from public.vrm_tables_remplir(${lot})`).split('|');
    tot.traitees += +n; tot.recopiees += +ok; tot.inconnues += +inc; tot.erreurs += +err; if (fini === 't' || tours > 10000) break; }
  return { ...tot, tours, ms: Date.now() - t0 }; };

// ── La suite (rend la liste des contrôles) ─────────────────────────────────
function suite(sql038, { taille, nOwners, mesurer }) {
  const res = []; const dit = (c, n) => res.push({ c: !!c, n });
  batir();
  const gen = generer(nOwners, taille); verser(gen);
  const avant = empreinteSource();
  const nLignes = +Q(`select count(*) from public.app_data`);
  let t0 = Date.now(); const ap = run(sql038);
  dit(ap.ok, `la 038 s’applique (${Date.now() - t0} ms)` + (ap.ok ? '' : ' — ' + ap.err.slice(0, 300)));
  if (!ap.ok) return res;
  dit(Q(`select count(*) from public.annonces`) === '0' && Q(`select count(*) from public.comptes`) === '0', 'juste après la 038 : tables vides (le remplissage est un geste à part)');
  const R1 = remplir(); const e1 = empreinteTables();
  dit(R1.erreurs === 0, `remplissage : ${R1.traitees} lignes recopiées en ${R1.tours} lots, ${R1.ms} ms, ${R1.erreurs} erreur(s)` + (R1.erreurs ? ' — ' + Q(`select string_agg(source||' '||detail, ' ; ') from (select * from public.vrm_projection_ecarts where raison='erreur' limit 3) z`) : ''));
  if (mesurer) dit(true, `  mesure : ${nLignes} lignes dans app_data, remplissage ${R1.ms} ms (${Math.round(R1.ms / Math.max(1, R1.traitees) * 1000)} µs par ligne recopiée)`);
  // 1. Rien n'a bougé dans app_data / vinted_accounts.
  dit(empreinteSource() === avant, `app_data et vinted_accounts identiques avant / après (${nLignes} lignes, empreinte data+meta+updated_at)`);
  // 2. Chaque ligne de forme connue a sa ligne typée, comptes exacts.
  for (const t of TABLES) { const n = +Q(`select count(*) from public.${t}`); dit(n === gen.att[t] && n > 0, `${t} : ${n} lignes typées (attendu ${gen.att[t]})`); }
  const pasSource = Q(`select count(*) from public.app_data a where public.vrm_t_famille(a.id) is not null
     and not exists (select 1 from public.vrm_projection_sources s where s.owner=a.owner and s.source=a.id)
     and not exists (select 1 from public.vrm_projection_ecarts e where e.owner=a.owner and e.source=a.id and e.raison in ('forme','meta_absente','erreur'))`);
  dit(pasSource === '0', `chaque ligne d’une famille recopiée est soit recopiée, soit en écart nommé (${pasSource} sans trace)`);
  dit(Q(`select count(*) from public.vrm_projection_sources where source like 'harvest_%_label_latest' or source in ('email_journal','lbc_listings') or source like 'harvest_%_conv_%' or source like 'harvest_%_profile'`) === '0', 'hors périmètre (conversations, profil, « dernier bordereau », journal, Leboncoin) : rien recopié');
  // Champs lus à la bonne forme (prix objet, identités, pas de jeton).
  dit(Q(`select string_agg(prix::text, ',' order by annonce_id) from (select prix, annonce_id from public.annonces where owner='${A}' order by annonce_id limit 2) z`) === '25.5,25.50', 'prix lu dans l’OBJET {amount} (« 25.5 », « 25,50 » ⇒ 25,50)');
  dit(Q(`select count(*)||'/'||count(distinct annonce_id) from public.annonces where owner='${A}' and titre='Nike Air Max 90 · 42'`) === '50/50', '50 paires identiques (titre, marque, taille) = 50 lignes, 50 identités — jamais fondues');
  dit(Q(`select count(*) from public.annonces where owner='${B}' and annonce_id=(select min(annonce_id) from public.annonces where owner='${B}')`) === '1', 'la même annonce lue deux fois dans une liste : une seule ligne');
  dit(Q(`select count(*) from information_schema.columns where table_schema='public' and table_name='comptes' and (column_name like '%token%' or column_name like '%csrf%')`) === '0' &&
      Q(`select count(*) from public.comptes where login like 'JETON%' or domaine like 'JETON%'`) === '0', 'comptes : login et domaine, AUCUN jeton recopié');
  dit(Q(`select count(*) filter (where a_pdf)||'/'||count(*) from public.colis where origine='vinted_bordereau'`) === `${nOwners * 2 * taille.labels - 1}/${nOwners * 2 * taille.labels - 1}`, 'bordereaux Vinted : « a un PDF » lu dans meta, le PDF jamais recopié');
  dit(Q(`select count(*) from information_schema.columns where table_schema='public' and table_name in ('colis','emails') and column_name ilike '%b64%'`) === '0', 'aucune colonne PDF dans colis / emails');
  dit(Q(`select statut_code||' '||statut_titre from public.transactions where owner='${A}' order by transaction_id limit 1`) === '230 Colis en route', 'transaction : état (code, titre) lu depuis meta (004)');
  dit(Q(`select limite_texte||' '||coalesce(limite_texte::text,'') from public.colis where owner='${A}' and origine='email_bordereau' limit 1`).startsWith('14 novembre'), 'date limite en français gardée en texte, jamais devinée en date');
  dit(Q(`select count(*) from public.ventes v join public.annonces a on a.owner=v.owner and a.annonce_id=v.item_id where v.owner='${A}'`) === String(gen.parOwner[A].ventes), 'vente ↔ annonce reliées par l’id d’annonce (identité), toutes');
  // 3. Rejouable.
  Q(`select public.vrm_tables_remplir_recommencer()`); const R2 = remplir(); const e2 = empreinteTables();
  dit(e1 === e2 && R2.erreurs === 0, `remplissage rejoué une 2e fois : tables identiques (${R2.ms} ms)`);
  Q(`update public.app_data set data = data where id ~ '^(harvest_|email_|main$)'`);
  dit(empreinteTables() === e2, 'chaque ligne réécrite à l’identique (déclencheur) : tables identiques');
  dit(empreinteSource().split(' / ')[1] === avant.split(' / ')[1], 'vinted_accounts toujours identique');
  // 4. Formes inconnues : rien écrit, comptées.
  const ec = r => +Q(`select coalesce(sum(case when raison='sans_identite' then n else 1 end),0) from public.vrm_projection_ecarts where raison='${r}'`);
  dit(ec('forme') === gen.ecarts.forme, `formes inconnues comptées : ${ec('forme')} (attendu ${gen.ecarts.forme})`);
  dit(ec('sans_identite') === gen.ecarts.sans_identite, `éléments sans identité sautés et comptés : ${ec('sans_identite')} (attendu ${gen.ecarts.sans_identite})`);
  dit(Q(`select count(*) from public.numeros where owner='${C}'`) === '0' && Q(`select count(*) from public.achats where owner='${C}' and compte=(select min(compte) from public.ventes where owner='${C}')`) === '0', 'forme inconnue : rien écrit (pool de C, achats de C)');
  const cAnn = Q(`select min(compte) from public.annonces where owner='${C}'`);
  const nAvant = Q(`select count(*) from public.annonces where owner='${C}' and compte='${cAnn}'`);
  Q(`update public.app_data set data = jsonb_build_object('type','listings','payload','{}'::jsonb) where owner='${C}' and id='harvest_${cAnn}_listings'`);
  dit(Q(`select count(*) from public.annonces where owner='${C}' and compte='${cAnn}'`) === nAvant && +nAvant > 0 && Q(`select count(*) from public.vrm_projection_ecarts where owner='${C}' and source='harvest_${cAnn}_listings' and raison='forme'`) === '1',
    `une bonne liste puis une forme inconnue : les ${nAvant} annonces d’avant restent, l’écart est compté`);
  Q(`alter table public.app_data disable trigger vrm_meta_maj; insert into public.app_data(owner,id,data) values('${D}','email_sale_sansmeta','{"type":"vente"}'); alter table public.app_data enable trigger vrm_meta_maj;`);
  dit(Q(`select raison from public.vrm_projection_ecarts where source='email_sale_sansmeta'`) === 'meta_absente' && Q(`select count(*) from public.emails where source='email_sale_sansmeta'`) === '0', 'ligne sans meta : rien deviné, comptée « meta_absente »');
  // 5. RLS.
  for (const t of TABLES) {
    const voit = op(A, `select count(*) filter (where owner<>'${A}')||'/'||count(*) from public.${t}`);
    dit(voit === `0/${gen.parOwner[A][t]}`, `RLS ${t} : A voit ses ${gen.parOwner[A][t]} lignes, 0 d’un autre (${voit})`);
  }
  dit(op(B, `select count(*) from public.ventes where owner='${A}'`) === '0' && op(B, `select count(*) from public.numeros where owner='${A}'`) === '0', 'RLS : B ne voit rien de A (ventes, numeros)');
  dit(op('anon', `select count(*) from public.ventes`) === 'REFUS' && op('anon', `select count(*) from public.numeros`) === 'REFUS', 'anonyme : refusé');
  dit(op('vide', `select count(*) from public.ventes`) === '0', 'identité absente : rien');
  const ecrire = [`insert into public.ventes(owner,plateforme,compte,transaction_id,empreinte) values('${A}','vinted','1','x','e')`,
    `update public.ventes set titre='x' where owner='${A}'`, `delete from public.ventes where owner='${A}'`,
    `insert into public.numeros(owner,cle_num,valeur) values('${A}','99999','99999')`, `delete from public.numeros_fiches where owner='${A}'`,
    `select public.vrm_projeter('${B}','harvest_1_listings','{"payload":{"items":[{"id":1}]}}',null,null,false)`,
    `select public.vrm_projeter_sur('${B}','harvest_1_listings','{"payload":{"items":[{"id":1}]}}',null,null,false)`,
    `select * from public.vrm_tables_remplir(10)`, `select public.vrm_tables_effacer_vendeur('${B}')`, `select public.vrm_tables_remplir_recommencer()`];
  const passe = ecrire.filter(s => op(A, s) !== 'REFUS');
  dit(passe.length === 0, `A ne peut ni écrire les tables typées ni appeler la recopie / le remplissage / l’effacement (${ecrire.length} essais)` + (passe.length ? ' — PASSÉ : ' + passe.join(' ; ') : ''));
  // 6. Live : l'écriture d'un vendeur se recopie toute seule.
  const cA = Q(`select min(compte) from public.ventes where owner='${A}'`);
  const txA = Q(`select min(transaction_id) from public.ventes where owner='${A}' and compte='${cA}'`);
  let r = run(`begin;${comme(A)}update public.app_data set data = jsonb_set(data, '{payload,my_orders}', (data->'payload'->'my_orders') || '[{"transaction_id":123456789012,"title":"Neuve","price":{"amount":"55.00","currency_code":"EUR"},"date":"2026-11-11T09:00:00Z","status":"Commande finalisée"}]'::jsonb) where id='harvest_${cA}_orders_sold';commit;`);
  dit(r.ok && Q(`select prix||' '||titre from public.ventes where owner='${A}' and transaction_id='123456789012'`) === '55.00 Neuve', 'A écrit une vente neuve (sa session) : elle apparaît dans ventes');
  r = run(`begin;${comme(A)}update public.app_data set data = jsonb_set(data, '{payload,my_orders}', (select coalesce(jsonb_agg(o),'[]') from jsonb_array_elements(data->'payload'->'my_orders') o where o->>'transaction_id' <> '${txA}')) where id='harvest_${cA}_orders_sold';commit;`);
  dit(r.ok && Q(`select count(*) from public.ventes where owner='${A}' and transaction_id='${txA}'`) === '0', 'une vente retirée de la ligne sort de la table (miroir)');
  // 7. Les N° : append-only.
  const nNumA = Q(`select count(*) from public.numeros where owner='${A}'`);
  r = run(`begin;${comme(A)}update public.app_data set data = jsonb_set(data, '{vinted_used_numeros}', (data->'vinted_used_numeros') || '["B127", 9999]'::jsonb) where id='main';commit;`);
  dit(r.ok && +Q(`select count(*) from public.numeros where owner='${A}'`) === +nNumA + 2 && Q(`select valeur from public.numeros where owner='${A}' and cle_num='B127'`) === 'B127', 'A ajoute deux N° au pool : ils entrent dans numeros, les autres ne bougent pas');
  Q(`update public.app_data set data = jsonb_set(data, '{vinted_used_numeros}', '[1,2]'::jsonb) where owner='${A}' and id='main'`); // clé de service : la 017 ne la garde pas
  dit(Q(`select count(*) from public.numeros where owner='${A}'`) === String(+nNumA + 2), `main perd des N° (écriture de service) : numeros garde les ${+nNumA + 2}`);
  dit(Q(`select valeur from public.numeros where owner='${A}' and cle_num='7'`) === '7', '« 7 » et « 007 » : un N° (clé 013), la première écriture gardée');
  for (const [nom, s] of [['modifier', `update public.numeros set valeur='x' where owner='${A}'`], ['retirer', `delete from public.numeros where owner='${A}'`], ['vider', `truncate public.numeros`]]) {
    const x = run(s); dit(!x.ok && /vrm_numero_immuable/.test(x.err), `numeros : ${nom} refusé même par la clé de service (vrm_numero_immuable)`);
  }
  const nAutres = Q(`select count(*) from public.numeros where owner<>'${D}'`);
  Q(`select public.vrm_tables_effacer_vendeur('${D}')`);
  dit(Q(`select count(*) from public.numeros where owner='${D}'`) === '0' && Q(`select count(*) from public.numeros where owner<>'${D}'`) === nAutres && Q(`select count(*) from public.app_data where owner='${D}'`) !== '0', 'effacement d’un vendeur : ses N° seulement, app_data intacte');
  // 8. Une erreur de recopie ne casse jamais l'écriture.
  Q(`alter table public.ventes add constraint essai_boum check (titre is distinct from 'BOUM')`);
  const nAv = Q(`select count(*) from public.ventes where owner='${A}'`);
  r = run(`begin;${comme(A)}update public.app_data set data = jsonb_set(data, '{payload,my_orders}', (data->'payload'->'my_orders') || '[{"transaction_id":999,"title":"BOUM"}]'::jsonb) where id='harvest_${cA}_orders_sold';commit;`);
  dit(r.ok && Q(`select count(*) from public.app_data where owner='${A}' and id='harvest_${cA}_orders_sold' and data::text like '%BOUM%'`) === '1', 'recopie en erreur : l’écriture d’app_data passe quand même');
  dit(Q(`select count(*) from public.ventes where owner='${A}'`) === nAv && Q(`select count(*) from public.vrm_projection_ecarts where owner='${A}' and raison='erreur'`) === '1', '… la table garde l’état d’avant, l’erreur est notée');
  Q(`alter table public.ventes drop constraint essai_boum; update public.app_data set data=data where owner='${A}' and id='harvest_${cA}_orders_sold'`);
  dit(Q(`select count(*) from public.vrm_projection_ecarts where owner='${A}' and raison='erreur'`) === '0' && Q(`select count(*) from public.ventes where owner='${A}' and transaction_id='999'`) === '1', '… et se rattrape à l’écriture suivante');
  // Effacement de la ligne d'origine.
  r = run(`begin;${comme(A)}delete from public.app_data where id='harvest_${cA}_orders_sold';commit;`);
  dit(r.ok && Q(`select count(*) from public.ventes where owner='${A}' and compte='${cA}'`) === '0', 'la ligne d’origine effacée : ses ventes sortent de la table');
  dit(Q(`select count(*) from public.numeros where owner='${A}'`) === String(+nNumA + 2), '… les N°, eux, jamais');
  // Comptes : suit vinted_accounts (jeton changé ⇒ rien ; login changé ⇒ suivi).
  Q(`update public.vinted_accounts set access_token='NOUVEAU' where owner='${B}'`);
  r = run(`begin;${comme(B)}update public.vinted_accounts set login='nouveau_login' where vinted_user_id=(select min(vinted_user_id) from public.vinted_accounts where owner='${B}');commit;`);
  dit(r.ok && Q(`select count(*) from public.comptes where owner='${B}' and login='nouveau_login'`) === '1', 'comptes suit vinted_accounts (login changé par le vendeur)');
  // Couverture lisible.
  const cov = Q(`select famille||'='||lignes||'/'||recopiees||'/'||en_ecart from public.vrm_tables_couverture()`).split('\n');
  dit(cov.some(l => l.startsWith('hors périmètre=')) && cov.some(l => l.startsWith('ventes_vinted=')), 'vrm_tables_couverture() : une ligne par famille (lignes / recopiées / en écart)');
  if (mesurer) mesures(res, gen, cA);
  return res;
}

function mesures(res, gen, cA) {
  const dit = (c, n) => res.push({ c: !!c, n });
  // Surcoût d'une écriture : la ligne des ventes d'un gros compte (2 000 commandes), une commande change à chaque fois.
  const uid = '99999999';
  const lst = []; for (let k = 0; k < 2000; k++) lst.push({ date: '2026-10-01T10:00:00.000Z', price: { amount: '40.00', currency_code: 'EUR' }, title: `Cmd ${k}`, status: 'Commande finalisée', transaction_id: 8000000000 + k, conversation_id: k, transaction_user_status: 'completed', item_id: 1, photo: { url: 'https://x/y.jpg' } });
  Q(`insert into public.app_data(owner,id,data) values('${B}','harvest_${uid}_orders_sold',${"'" + JSON.stringify({ type: 'orders_sold', uid, capturedAt: '2026-11-11T00:00:00Z', payload: { my_orders: lst } }).replace(/'/g, "''") + "'"})`);
  const boucle = n => `do $b$ declare i int; begin for i in 1..${n} loop
     update public.app_data set data = jsonb_set(jsonb_set(data, '{payload,my_orders,0,price,amount}', to_jsonb((40+i)::text)), '{capturedAt}', to_jsonb(clock_timestamp()::text)) where owner='${B}' and id='harvest_${uid}_orders_sold';
   end loop; end $b$;`;
  const chrono = sql => { const t = Date.now(); Q(sql); return Date.now() - t; };
  const N = 50;
  const avec = chrono(`begin;${comme(B)}${boucle(N)}commit;`);
  Q(`alter table public.app_data disable trigger vrm_projection_ecrit`);
  const sans = chrono(`begin;${comme(B)}${boucle(N)}commit;`);
  Q(`alter table public.app_data enable trigger vrm_projection_ecrit`);
  dit(true, `  mesure : écrire la ligne de 2 000 ventes (une change) — ${(sans / N).toFixed(1)} ms sans la recopie, ${(avec / N).toFixed(1)} ms avec (+${((avec - sans) / N).toFixed(1)} ms par écriture)`);
  dit((avec - sans) / N < 400, '  surcoût d’une écriture de 2 000 ventes < 400 ms (le délai Supabase du rôle authenticated est de 8 s)');
  const main = chrono(`begin;${comme(A)}do $b$ declare i int; begin for i in 1..${N} loop update public.app_data set data = jsonb_set(data, '{vinted_dark}', to_jsonb(i % 2 = 0)) where id='main'; end loop; end $b$;commit;`);
  Q(`alter table public.app_data disable trigger vrm_projection_ecrit`);
  const mainSans = chrono(`begin;${comme(A)}do $b$ declare i int; begin for i in 1..${N} loop update public.app_data set data = jsonb_set(data, '{vinted_dark}', to_jsonb(i % 2 = 0)) where id='main'; end loop; end $b$;commit;`);
  Q(`alter table public.app_data enable trigger vrm_projection_ecrit`);
  dit(true, `  mesure : écrire main (${Math.round(+Q(`select octet_length(data::text) from public.app_data where owner='${A}' and id='main'`) / 1024)} Ko, N° inchangés) — ${(mainSans / N).toFixed(1)} ms sans, ${(main / N).toFixed(1)} ms avec`);
  // Lecture : retrouver une vente par son n° de transaction, et compter les ventes d'octobre.
  const tx = Q(`select max(transaction_id) from public.ventes where owner='${B}' and compte='${uid}'`);
  const tps = sql => { const out = Q(`begin;${comme(B)}explain (analyze, format json) ${sql};rollback;`); try { return JSON.parse(out)[0]['Execution Time']; } catch (_) { return NaN; } };
  const tJson = tps(`select o from public.app_data a, jsonb_array_elements(a.data->'payload'->'my_orders') o where a.id like 'harvest_%_orders_sold' and o->>'transaction_id' = '${tx}'`);
  const tTab = tps(`select * from public.ventes where transaction_id = '${tx}'`);
  dit(tTab < tJson, `  mesure : une vente par son n° — app_data ${tJson.toFixed(2)} ms, table ventes ${tTab.toFixed(2)} ms`);
  const cJson = tps(`select count(*) from public.app_data a, jsonb_array_elements(a.data->'payload'->'my_orders') o where a.id like 'harvest_%_orders_sold' and o->>'date' >= '2026-10-01' and o->>'date' < '2026-11-01'`);
  const cTab = tps(`select count(*) from public.ventes where date_commande >= '2026-10-01' and date_commande < '2026-11-01'`);
  dit(true, `  mesure : compter ses ventes d’octobre — app_data ${cJson.toFixed(2)} ms, table ventes ${cTab.toFixed(2)} ms`);
}

// ── Lancement ───────────────────────────────────────────────────────────────
const PETITE = { annonces: 60, ventes: 40, achats: 12, txn: 12, labels: 4, conv: 4, emails: 4, pool: 80, fiches: 30, mainOctets: 2000 };
const GRANDE = { annonces: 60, ventes: 250, achats: 60, txn: 150, labels: 20, conv: 50, emails: 25, pool: 400, fiches: 100, mainOctets: 400000 };
let ok = 0, ko = 0;
try {
  let r = serveur('initdb', ['-D', DIR + '/data', '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C', '--no-sync']); if (r.status !== 0) throw Error(r.stderr);
  r = serveur('pg_ctl', ['-D', DIR + '/data', '-o', `-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off -c shared_buffers=256MB`, '-l', DIR + '/journal', '-w', 'start']); if (r.status !== 0) throw Error(r.stderr); demarre = true;
  const montre = (titre, res) => { console.log(`\n── ${titre}`); for (const x of res) { x.c ? ok++ : ko++; console.log(`${x.c ? '✅' : '❌'} ${x.n}`); } };
  montre(PETIT ? 'suite (petite base)' : 'suite sur ~50 000 lignes inventées', suite(M038, PETIT ? { taille: PETITE, nOwners: 6, mesurer: false } : { taille: GRANDE, nOwners: 94, mesurer: true }));
  // Mutations : chacune doit faire rougir au moins un contrôle.
  const MUT = [
    ['politique using (true)', s => s.replace("using (owner = (select auth.uid()))', t);", "using (true)', t);")],
    ['garde des N° retirée', s => s.replace(/create trigger vrm_numeros_immuable before update or delete[^;]+;/, '')],
    ['enveloppe d’erreur retirée (recopie directe)', s => s.replace('perform public.vrm_projeter_sur(new.owner, new.id,', 'perform public.vrm_projeter(new.owner, new.id,')],
    ['forme inconnue qui efface la copie d’avant', s => s.replace("perform public.vrm_t_ecart(p_owner, p_id, fam, 'forme', 1, 'payload.items absent');", "delete from public.annonces where owner = p_owner and compte = v_compte; perform public.vrm_t_ecart(p_owner, p_id, fam, 'forme', 1, 'payload.items absent');")],
    ['N° réécrits (do update au lieu de do nothing)', s => s.replace('on conflict (owner, cle_num) do nothing', 'on conflict (owner, cle_num) do update set valeur = excluded.valeur')],
    ['jetons recopiés dans comptes', s => s.replace("login text, domaine text,\n  empreinte", "login text, domaine text, access_token text,\n  empreinte").replace("insert into public.comptes as c (owner, plateforme, compte_id, login, domaine, empreinte)\n  select p_owner, 'vinted', public.vrm_t_texte(j -> 'vinted_user_id'), public.vrm_t_texte(j -> 'login'),", "insert into public.comptes as c (owner, plateforme, compte_id, login, domaine, access_token, empreinte)\n  select p_owner, 'vinted', public.vrm_t_texte(j -> 'vinted_user_id'), public.vrm_t_texte(j -> 'login'), j ->> 'access_token',")],
  ];
  console.log('\n── mutations (petite base) : chacune doit rougir');
  for (const [nom, f] of MUT) {
    const m = f(M038);
    if (m === M038) { ko++; console.log(`❌ mutation « ${nom} » : le texte visé n’existe plus dans la 038`); continue; }
    const rr = suite(m, { taille: PETITE, nOwners: 6, mesurer: false });
    const rouges = rr.filter(x => !x.c);
    rouges.length ? ok++ : ko++;
    console.log(`${rouges.length ? '✅' : '❌'} mutation « ${nom} » : ${rouges.length} rouge(s)${rouges.length ? ' — ' + rouges.slice(0, 2).map(x => x.n.slice(0, 90)).join(' | ') : ''}`);
  }
} catch (e) { ko++; console.log('❌ ' + String(e.message || e).slice(0, 2000)); }
console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
process.exit(ko ? 1 : 0);

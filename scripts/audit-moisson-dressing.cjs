// ════════════════════════════════════════════════════════════════════════════
//  « JE VIENS DE SUPPRIMER BEAUCOUP DE PAIRES ET ELLES SONT ENCORE MARQUÉES
//  DANS LES ANNONCES » (Julien, 9 octobre 18:40) — POURQUOI LA MOISSON NE
//  RÉÉCRIVAIT PAS LE DRESSING (extension 5.165).
//
//  MESURÉ avant de coder (journaux de la base, 9 octobre) : la moisson de
//  llloollllaa a bien LU chez Vinted (18:38:21 et 18:38:29), puis toutes ses
//  écritures ont été refusées (`POST app_data → 400`, aucune session VRM : une
//  ligne sans propriétaire ne passe pas RLS) — et la garde de 5 min, posée
//  AVANT, n'était jamais rendue. Cinq comptes sont restés figés sur leur lecture
//  du 8 octobre, ~41 annonces affichées « en ligne » qu'il venait de supprimer.
//
//  On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`), avec une base qui se
//  comporte comme la sienne (une ligne écrite sans `owner` ⇒ 400) et un Vinted
//  à état, et on juge ce qui est RANGÉ et ce qui part chez Vinted :
//   1. sans session VRM : rien ne part chez Vinted, la garde n'est pas prise,
//      et la session revenue, la page suivante range le dressing ;
//   2. écritures refusées : ni « rafraîchi », ni repli, et la garde est RENDUE
//      (nouvel essai à 60 s) — sauf pendant une pause demandée par Vinted ;
//   3. un dressing vidé, lu EN ENTIER par son propriétaire, est rangé vide ;
//      l'autre sens : un vide passif n'efface rien (§4.1) ;
//   4. §4.2 reste vrai : une page qui échoue en route, ou un total que la
//      pagination n'atteint pas, n'écrase JAMAIS une liste complète ;
//   5. il change de compte pendant la moisson : rien n'est rangé (§5) ;
//   6. le dressing d'un AUTRE membre, capté en passant, n'est jamais le sien ;
//   7. sans onglet ni cookie : AUCUN compte n'est moissonné avec ses jetons (§3) ;
//   8. la page navigue pendant la moisson : le repli par cookie range quand même.
//  Données inventées (le dépôt est public). Aucune requête réseau.
//  Usage : node scripts/audit-moisson-dressing.cjs [--src f] [--mutation nom]
//  `--mutation` réaffaiblit UNE règle dans une copie du fichier : le contrôle
//  correspondant doit repasser au rouge (§6.1).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), os = require('os'), path = require('path');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

const MUTATIONS = {
  // une page qui ÉCHOUE en route compterait comme la fin de la liste
  pagepartielle: [[`            if (!lot) break;
            if (!listings) listings = r; else listings.items = listings.items.concat(lot);`, `            if (!lot) { listingsComplet = true; break; }
            if (!listings) listings = r; else listings.items = listings.items.concat(lot);`]],
  // le total annoncé par Vinted ne compterait plus
  totalignore: [[`  if (pg.total_entries != null && pg.total_entries !== '' && isFinite(total)) return items.length >= total;`, `  if (false) return items.length >= total;`]],
  // la garde des 5 min ne serait plus rendue
  garde: [[`    if (!ok) await rendreGardeVisite(uid, marqueVisite);`, `    if (false) await rendreGardeVisite(uid, marqueVisite);`]],
  // plus de contrôle de session avant de lire chez Vinted
  session: [[`    if (await sansSessionPourEcrire()) { noterDiag('visite_sans_session'); return; }`, ``],
    [`  if (await sansSessionPourEcrire()) { noterDiag('moisson_sans_session'); return false; }`, ``]],
  // on compterait comme rangé ce que la base a refusé
  range: [[`    if (r === 'ecrit' || r === 'plus-pauvre' || r === 'hors-sujet') stored = true; else ratees++;`, `    stored = true;`]],
  // le compte qui change en route ne serait plus vu
  compte: [[`  if (String(uid) !== String(activeUid0)) { noterDiag('moisson_compte_change'); return 'abandon'; }`, ``]],
  // le dressing d'un autre membre passerait
  autremembre: [[`    if (!pid || id == null || String(id) !== pid) { noterDiag('ignore_dressing_autre_membre'); return; }`, ``]],
};
function sourceAJuger() {
  const src = cheminSource();
  const i = process.argv.indexOf('--mutation');
  if (i < 0) return { src, mutation: '' };
  const nom = process.argv[i + 1];
  const regles = MUTATIONS[nom];
  if (!regles) { console.log(`mutation inconnue : ${nom} (${Object.keys(MUTATIONS).join(', ')})`); process.exit(2); }
  let s = fs.readFileSync(src, 'utf8');
  for (const [de, vers] of regles) {
    const n = s.split(de).length - 1;
    if (n !== 1) { console.log(`❌ mutation ${nom} : ancre trouvée ${n} fois — la règle a changé de forme, mets la mutation à jour`); process.exit(1); }
    s = s.replace(de, vers);
  }
  const f = path.join(os.tmpdir(), `vrm-mut-${nom}-${process.pid}.js`);
  fs.writeFileSync(f, s);
  return { src: f, mutation: nom };
}
const { src: SRC, mutation } = sourceAJuger();
console.log(`source : ${path.relative(process.cwd(), SRC) || SRC}${mutation ? ` (mutation « ${mutation} »)` : ''}`);

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const info = (t) => console.log(`  ·  ${t}`);
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`); return null; } };

const HIER = new Date(Date.now() - 20 * 3600e3).toISOString();
const PID = { A: 9001, B: 9002, C: 9003 };
const TOK = { A: 'jeton_A', B: 'jeton_B', C: 'jeton_C' };
const COMPTES = Object.keys(PID).map((k) => ({ vinted_user_id: k, login: 'compte_' + k, domain: 'www.vinted.fr', access_token: TOK[k] }));
const article = (id, ferme) => ({ id, title: 'Paire ' + id, price: { amount: '40.0', currency_code: 'EUR' }, brand_title: 'Marque', size_title: '42',
  is_closed: !!ferme, is_hidden: false, is_draft: false, photos: [{ url: 'https://images1.vinted.net/t/x/f800/' + id }], photo: { url: 'https://images1.vinted.net/t/x/f800/' + id } });
const dressing = (ouverts, fermes, base) => [...Array.from({ length: ouverts }, (_, i) => article(base + i, false)), ...Array.from({ length: fermes }, (_, i) => article(base + 500 + i, true))];
const vente = (tx) => ({ transaction_id: tx, title: 'Vente ' + tx, status: "Commande finalisée - l'acheteur a validé la commande", date: HIER, price: { amount: '40.0' } });
const ligneDressing = (items) => ({ type: 'listings', capturedAt: HIER, nItems: items.length, payload: { items, pagination: { total_entries: items.length, total_pages: 1 } } });
const ligneProfil = (k) => ({ type: 'profile', capturedAt: HIER, payload: { user: { id: PID[k], login: 'compte_' + k } } });

// Une base + un Vinted À ÉTAT. `etat.dressing[k]` = ce que Vinted rend MAINTENANT.
//  · `etat.parPage` découpe le dressing en pages ; `etat.pageKO` fait échouer une page (500) ;
//  · `etat.totalForce[k]` force `total_entries` (une pagination qui se contredit).
function monter({ lignes, etat, onglets }) {
  const f = faireFond({ src: SRC, lignes, comptes: COMPTES, onglets: onglets || [{ id: 7, url: 'https://www.vinted.fr/member/1', status: 'complete' }],
    vinted: (r) => repondre(r) });
  const req = [], refus = [];
  let courant = null;
  function repondre(r) {
    const c = courant, ch = r.chemin;
    if (!c) return { status: 401, body: { message: 'unauthorized' } };
    if (/\/api\/v2\/users\/current/.test(ch)) return { status: 200, body: { user: { id: PID[c], login: 'compte_' + c } } };
    const w = /\/api\/v2\/wardrobe\/(\d+)\/items/.exec(ch);
    if (w) {
      const k = Object.keys(PID).find((x) => String(PID[x]) === w[1]);
      const tous = (etat.dressing[k] || []);
      const page = Number((/[?&]page=(\d+)/.exec(ch) || [])[1] || 1);
      if (etat.pageKO && etat.pageKO === page) return { status: 500, body: { message: 'erreur' } };
      const per = etat.parPage || 1000;
      const items = tous.slice((page - 1) * per, page * per);
      const total = etat.totalForce && etat.totalForce[k] != null ? etat.totalForce[k] : tous.length;
      const pagination = { current_page: page, total_pages: Math.ceil(tous.length / per), total_entries: total, per_page: per };
      if (etat.sansTotal) delete pagination.total_entries;      // une réponse qui ne dit pas son total
      return { status: 200, body: { items, pagination } };
    }
    if (/\/api\/v2\/my_orders\?type=sold/.test(ch)) return { status: 200, body: { my_orders: [vente(c + '1'), vente(c + '2')], pagination: { total_entries: 2, total_pages: 1 } } };
    if (/\/api\/v2\/my_orders/.test(ch)) return { status: 200, body: { my_orders: [], pagination: { total_entries: 0, total_pages: 0 } } };
    if (/\/api\/v2\/inbox/.test(ch)) return { status: 200, body: { conversations: [], pagination: { current_page: 1, total_entries: 0 } } };
    return { status: 404, body: {} };
  }
  const fetch0 = f.ctx.fetch;
  f.ctx.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (/^\//.test(u)) { courant = etat.pageCompte || etat.cookie; req.push({ origine: 'page', compte: courant, chemin: u }); }
    else if (/^https:\/\/[^/]*vinted\./.test(u)) {
      const a = String((opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || '');
      courant = /^Bearer /.test(a) ? Object.keys(TOK).find((k) => TOK[k] === a.slice(7)) || null : etat.cookie;
      req.push({ origine: /^Bearer /.test(a) ? 'jeton' : 'cookie', compte: courant, chemin: u.replace(/^https:\/\/[^/]+/, '') });
    } else if (/\/rest\/v1\//.test(u) && String(opts.method || 'GET').toUpperCase() === 'POST') {
      let rows = []; try { rows = JSON.parse(opts.body || '[]'); } catch (_) {}
      // LA BASE DE JULIEN : clé (owner, id) + RLS. Une ligne sans propriétaire
      // (écrite sans session) est refusée — mesuré : `POST app_data?on_conflict=id → 400`.
      if (etat.baseRefuse || rows.some((r) => r && !r.owner)) {
        refus.push(rows.map((r) => r && r.id).join(','));
        return { ok: false, status: 400, headers: { get: () => 'application/json' }, json: async () => ({ code: '42P10' }), text: async () => '{"code":"42P10"}', clone() { return this; } };
      }
    }
    return fetch0(url, opts);
  };
  // Le compte du cookie Vinted, et la session VRM, tels qu'ils sont À CET INSTANT.
  f.ctx.activeUidForDomain = async () => etat.cookie || null;
  f.ctx.activeAccountId = async () => etat.cookie || null;
  f.ctx.isCloisonne = async () => true;
  f.ctx.authToken = async () => (etat.session ? { access_token: 'session_vrm', user_id: 'PROPRIO', expires_at: Date.now() + 3600e3 } : null);
  const dressingDe = (k) => (f.lignes[`harvest_${k}_listings`] || {});
  const lectDressing = (k) => req.filter((x) => x.compte === k && /\/wardrobe\//.test(x.chemin)).length;
  return { f, req, refus, dressingDe, lectDressing };
}
const nDe = (m, k) => { const d = m.dressingDe(k); return ((d.payload || {}).items || []).length; };

(async () => {
  console.log('\n── 1. Sans session VRM (9 oct. 18:38, llloollllaa)');
  await essaie('sans session', async () => {
    const etat = { cookie: 'A', session: false, dressing: { A: dressing(0, 48, 1000) } };   // il a supprimé les 13 en ligne
    const m = monter({ etat, lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: ligneDressing(dressing(13, 48, 1000)) } });
    await m.f.ctx.visiteVinted();
    const vinted1 = m.req.filter((x) => x.compte === 'A').length;
    info(`visite sans session : ${vinted1} requête(s) Vinted, ${m.refus.length} écriture(s) refusée(s) ; dressing en base : ${nDe(m, 'A')}`);
    dit(vinted1 === 0, 'sans session, RIEN ne part chez Vinted (chaque lecture serait jetée — §3)', `${vinted1} requête(s) Vinted`);
    const garde = Number((m.f.store.vrmDerniereVisite || {}).A || 0);
    dit(!garde || Date.now() - garde > 4 * 60000, 'sans session, la garde des 5 min n’est PAS consommée', `garde posée il y a ${Math.round((Date.now() - garde) / 1000)} s`);
    dit(!m.f.j.journal.some((t) => /Données rafraîchies/.test(t)), 'le journal ne dit pas « Données rafraîchies » quand rien n’a été rangé', JSON.stringify(m.f.j.journal));
    etat.session = true;                                   // il se reconnecte
    await m.f.ctx.visiteVinted();                          // la page suivante
    dit(nDe(m, 'A') === 48, 'session revenue : la page suivante relit et RANGE le dressing (48, sans les 13 supprimées)', `en base : ${nDe(m, 'A')}`);
  });

  console.log('\n── 2. Écritures refusées AVEC session (base qui hoquette)');
  await essaie('base refuse', async () => {
    const etat = { cookie: 'A', session: true, baseRefuse: true, dressing: { A: dressing(0, 48, 1000) } };
    const m = monter({ etat, lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: ligneDressing(dressing(13, 48, 1000)) } });
    await m.f.ctx.visiteVinted();
    dit(!m.f.j.journal.some((t) => /Données rafraîchies/.test(t)), 'une moisson dont TOUTES les écritures sont refusées ne se dit pas « rafraîchie »', JSON.stringify(m.f.j.journal.slice(0, 2)));
    // (le repli relirait le PROFIL et le DRESSING hors de la page ; la vente rapide
    //  et les lecteurs de photos passent par leurs propres chemins)
    const repli = m.req.filter((x) => x.origine !== 'page' && /wardrobe|users\/current/.test(x.chemin));
    dit(repli.length === 0, 'pas de seconde moisson de repli quand c’est la BASE qui refuse', `${repli.length} requête(s) : ${repli.map((x) => x.origine + ' ' + x.chemin).join(' · ')}`);
    etat.baseRefuse = false;
    const st = m.f.store.vrmDerniereVisite || {};
    st.A = Number(st.A || 0) - 61000;                      // 61 s plus tard
    m.f.store.vrmDerniereVisite = st;
    await m.f.ctx.visiteVinted();
    dit(nDe(m, 'A') === 48, 'la garde est RENDUE (nouvel essai à 60 s, pas 5 min) : le dressing est rangé au passage suivant', `en base : ${nDe(m, 'A')}`);
    // ⚠️ l'autre sens : relâcher n'est pas effacer — pendant une pause, la garde reste entière.
    const marque = Date.now() - 1000;
    const m2 = monter({ etat: { cookie: 'A', session: true, dressing: {} }, lignes: {} });
    m2.f.store.vrmDerniereVisite = { A: marque };
    m2.f.store.vrmPauseVinted = { jusqua: Date.now() + 15 * 60000, niveau: 1, statut: 429 };
    if (typeof m2.f.ctx.rendreGardeVisite !== 'function') { dit(false, 'pendant une pause demandée par Vinted, la garde reste ENTIÈRE', 'rendreGardeVisite absente'); return; }
    await m2.f.ctx.rendreGardeVisite('A', marque);
    dit(Number(m2.f.store.vrmDerniereVisite.A) === marque, 'pendant une pause demandée par Vinted, la garde reste ENTIÈRE (§3)', JSON.stringify(m2.f.store.vrmDerniereVisite));
  });

  console.log('\n── 3. Un compte dont il supprime TOUTES les annonces');
  await essaie('dressing vide', async () => {
    const etat = { cookie: 'C', session: true, dressing: { C: [] } };
    const m = monter({ etat, lignes: { harvest_C_profile: ligneProfil('C'), harvest_C_listings: ligneDressing(dressing(5, 0, 3000)) } });
    await m.f.ctx.visiteVinted();
    dit(nDe(m, 'C') === 0, 'un dressing vidé, lu EN ENTIER par son propriétaire (total_entries = 0), est rangé vide', `en base : ${nDe(m, 'C')} article(s) « en ligne » pour toujours`);
    const m2 = monter({ etat, lignes: { harvest_C_profile: ligneProfil('C'), harvest_C_listings: ligneDressing(dressing(5, 0, 3000)) } });
    await m2.f.ctx.storeHarvest('www.vinted.fr', 'listings', String(PID.C), JSON.stringify({ items: [], pagination: { total_entries: 0 } }));
    dit(nDe(m2, 'C') === 5, 'l’autre sens : une liste vide venue de la PAGE (capture passive) n’efface rien (§4.1)', `en base : ${nDe(m2, 'C')}`);
  });

  console.log('\n── 4. §4.2 reste vrai : une page partielle n’écrase pas une liste complète');
  await essaie('page partielle', async () => {
    // 61 articles en 4 pages de 20 ; la page 2 répond 500 : la moisson n'a lu que 20 articles.
    const etat = { cookie: 'A', session: true, parPage: 20, pageKO: 2, dressing: { A: dressing(13, 48, 1000) } };
    const m = monter({ etat, lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: ligneDressing(dressing(13, 48, 1000)) } });
    await m.f.ctx.visiteVinted();
    dit(nDe(m, 'A') === 61, 'une page qui échoue en route (20 articles sur 61) n’écrase PAS le dressing complet', `en base : ${nDe(m, 'A')}`);
    // La même, sur une réponse qui ne dit PAS son total : seule la fin de la pagination parle.
    const etatB = { cookie: 'A', session: true, parPage: 20, pageKO: 2, sansTotal: true, dressing: { A: dressing(13, 48, 1000) } };
    const mB = monter({ etat: etatB, lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: ligneDressing(dressing(13, 48, 1000)) } });
    await mB.f.ctx.visiteVinted();
    dit(nDe(mB, 'A') === 61, 'et sans total annoncé non plus : une page manquée n’est jamais « la fin de la liste »', `en base : ${nDe(mB, 'A')}`);
    // Toutes les pages lues, mais Vinted annonce 61 pour 48 rendus : la pagination se contredit.
    const etat2 = { cookie: 'A', session: true, dressing: { A: dressing(0, 48, 1000) }, totalForce: { A: 61 } };
    const m2 = monter({ etat: etat2, lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: ligneDressing(dressing(13, 48, 1000)) } });
    await m2.f.ctx.visiteVinted();
    dit(nDe(m2, 'A') === 61, 'un total que la pagination n’atteint pas (48 lus, 61 annoncés) n’écrase pas non plus', `en base : ${nDe(m2, 'A')}`);
    // Et la page passive de 20 annonces (ce que la page dressing charge) ne passe toujours pas.
    const m3 = monter({ etat: { cookie: 'A', session: true, dressing: {} }, lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: ligneDressing(dressing(13, 48, 1000)) } });
    await m3.f.ctx.storeHarvest('www.vinted.fr', 'listings', String(PID.A), JSON.stringify({ items: dressing(13, 7, 1000), pagination: { total_entries: 61, total_pages: 4 } }));
    dit(nDe(m3, 'A') === 61, 'la page 1 du dressing captée en passant (20 sur 61) ne passe toujours pas', `en base : ${nDe(m3, 'A')}`);
    // L'autre sens : complète et plus courte (61 → 48), total cohérent : rangée.
    const etat4 = { cookie: 'A', session: true, parPage: 20, dressing: { A: dressing(0, 48, 1000) } };
    const m4 = monter({ etat: etat4, lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: ligneDressing(dressing(13, 48, 1000)) } });
    await m4.f.ctx.visiteVinted();
    dit(nDe(m4, 'A') === 48, 'l’autre sens : complète en 3 pages et plus courte (61 → 48), elle est rangée', `en base : ${nDe(m4, 'A')}`);
  });

  console.log('\n── 5. Il change de compte pendant que la page moissonne');
  await essaie('compte change', async () => {
    const etat = { cookie: 'A', pageCompte: 'A', session: true, dressing: { A: dressing(0, 48, 1000), B: dressing(10, 0, 2000) } };
    const m = monter({ etat, lignes: { harvest_A_profile: ligneProfil('A'), harvest_B_profile: ligneProfil('B'), harvest_B_listings: ligneDressing(dressing(10, 0, 2000)) } });
    const exec0 = m.f.ctx.chrome.scripting.executeScript;
    m.f.ctx.chrome.scripting.executeScript = async (o) => { const r = await exec0(o); etat.cookie = 'B'; etat.pageCompte = null; return r; };
    await m.f.ctx.pageActiveFetch();
    const ids = ((m.dressingDe('B').payload || {}).items || []).map((x) => x.id);
    const deA = ids.filter((id) => id >= 1000 && id < 2000).length;
    dit(deA === 0, 'les annonces du compte A ne sont JAMAIS rangées sous le compte B (§5)', `${deA} annonce(s) de A dans harvest_B_listings`);
  });

  console.log('\n── 6. Capture passive : le dressing d’un AUTRE membre');
  await essaie('autre membre', async () => {
    const etat = { cookie: 'A', session: true, dressing: {} };
    const m = monter({ etat, lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: ligneDressing(dressing(13, 48, 1000)) } });
    await m.f.ctx.storeHarvest('www.vinted.fr', 'listings', '777777', JSON.stringify({ items: dressing(15, 0, 7000), pagination: { total_entries: 15, total_pages: 1 } }));
    const ids = ((m.dressingDe('A').payload || {}).items || []).map((x) => x.id);
    dit(!ids.some((id) => id >= 7000), 'le dressing d’un autre membre n’écrase JAMAIS le sien (§5)', `${ids.filter((id) => id >= 7000).length} article(s) de l’autre membre dans harvest_A_listings`);
    const m2 = monter({ etat, lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: ligneDressing(dressing(13, 48, 1000)) } });
    await m2.f.ctx.storeHarvest('www.vinted.fr', 'listings', String(PID.A), JSON.stringify({ items: dressing(0, 48, 1000), pagination: { total_entries: 48, total_pages: 1 } }));
    dit(nDe(m2, 'A') === 48, 'l’autre sens : SON dressing complet, vu en passant, est toujours rangé', `en base : ${nDe(m2, 'A')}`);
  });

  console.log('\n── 7. Aucun onglet Vinted, aucun cookie : runActive');
  await essaie('tous comptes', async () => {
    const etat = { cookie: null, session: true, dressing: { A: dressing(0, 48, 1000), B: dressing(10, 0, 2000), C: [] } };
    const lignes = {};
    for (const k of Object.keys(PID)) { lignes[`harvest_${k}_profile`] = ligneProfil(k); lignes[`harvest_${k}_listings`] = ligneDressing(dressing(3, 0, 4000)); }
    const m = monter({ etat, lignes, onglets: [] });
    await m.f.ctx.runActive();
    const parCompte = {};
    for (const x of m.req) parCompte[x.compte] = (parCompte[x.compte] || 0) + 1;
    dit(Object.keys(parCompte).filter((k) => k !== 'null').length === 0, 'aucune requête Vinted au nom d’un compte connecté nulle part (§3 : jamais tous les comptes d’un coup)', `requêtes par compte : ${JSON.stringify(parCompte)}`);
  });

  console.log('\n── 8. La page navigue pendant la moisson (il supprime) : executeScript rend null');
  await essaie('navigation', async () => {
    const etat = { cookie: 'A', session: true, dressing: { A: [] } };
    const m = monter({ etat, lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: ligneDressing(dressing(13, 0, 1000)) } });
    m.f.ctx.chrome.scripting.executeScript = async () => [{ result: null }];
    const r = await m.f.ctx.runActive();
    dit(r === true && nDe(m, 'A') === 0, 'le repli par cookie du service worker range quand même le dressing — vide compris, lu en entier', `runActive=${r}, en base ${nDe(m, 'A')}`);
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();

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
//  Revue de la 5.165 (11 octobre), horloge du service worker PILOTÉE :
//   9. notre base refuse TOUT (RLS 403) ou ne répond plus (522) : le recul tient
//      la moisson (au plus 2 en 5 min, 5 en 30 min), y compris pour `runActive`
//      appelé hors visite ; un échec passager répété ne rend la garde qu'UNE
//      fois ; et l'autre sens : la base revenue, la visite suivante range ;
//  10. le repli par COOKIE : il change de compte en route ⇒ rien de B sous A,
//      et le dressing vide de B n'efface pas celui de A ;
//  11. §4.2 : le compteur `nItems` illisible (lecture KO, écriture OK) ⇒ une
//      page partielle n'écrase rien, ni en passant ni par la moisson active.
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
  // la garde des 5 min ne serait plus rendue sur un refus de la base (le recul seul ne suffit pas)
  garde: [[`  if (r === 'base' || r === 'recul') { await rendreGardeVisite(uid, marque, 0); return; }`, `  if (r === 'base' || r === 'recul') return;`]],
  // revue 5.165 : la garde rendue à CHAQUE échec, sans les compter
  durable: [[`  if (avant === 0) await rendreGardeVisite(uid, marque);
  else noterDiag('visite_echec_repete');`, `  await rendreGardeVisite(uid, marque);`]],
  // revue 5.165 : plus de recul quand NOTRE base refuse tout
  recul: [[`    return reste > 0 ? Object.assign({}, r, { resteMs: reste }) : null;
  } catch (_) { return null; }
}
// Économie`, `    return null;
  } catch (_) { return null; }
}
// Économie`]],
  // revue 5.165 : le repli par cookie ne relirait plus le compte en route
  cookie: [[`      if (!(await memeCompte())) return 'abandon';
      const r = await storeHarvestRow`, `      const r = await storeHarvestRow`],
    [`    if (pidRange && profileId != null && String(profileId) !== pidRange) { noterDiag('moisson_compte_change'); return 'abandon'; }
    if (!(await memeCompte())) return 'abandon';`, ``]],
  // revue 5.165 : compteur illisible ⇒ « on écrit » (§4.2 violé)
  lecturepassu: [[`    if (!r.ok) return passu();                    // pas su : on n'écrase rien`, `    if (!r.ok) return true;`]],
  // plus de contrôle de session avant de lire chez Vinted
  session: [[`    if (await sansSessionPourEcrire()) { noterDiag('visite_sans_session'); return; }`, ``],
    [`  if (await sansSessionPourEcrire()) { noterDiag('moisson_sans_session'); return false; }`, ``]],
  // on compterait comme rangé ce que la base a refusé
  range: [[`    if (r === 'ecrit' || r === 'plus-pauvre' || r === 'hors-sujet') stored = true; else ratees++;
  };`, `    stored = true;
  };`]],
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
//  · `etat.basePanne` : NOTRE base ne répond plus (522 partout, lectures comprises —
//    du 9 au 12 septembre) ; `etat.baseRLS` : elle lit `[]` et REFUSE toute écriture
//    (403 42501 — abonnement coupé, règle refusée) ; `etat.nItemsKO` : seule la
//    lecture du compteur `nItems` échoue (lecture KO, écriture OK — §4.2).
//  · L'horloge du service worker est PILOTÉE (`m.avance(ms)`) : la garde, le recul
//    et les marques vivent dans le même temps, comme dans Chrome.
function monter({ lignes, etat, onglets }) {
  const f = faireFond({ src: SRC, lignes, comptes: COMPTES, onglets: onglets || [{ id: 7, url: 'https://www.vinted.fr/member/1', status: 'complete' }],
    vinted: (r) => repondre(r), lectureKO: (u) => !!(etat.nItemsKO && /select=n:data->>nItems/.test(u)) });
  require('vm').runInContext('(function(){ var r = Date.now; Date.now = function(){ return r() + (globalThis.__decalage || 0); }; })();', f.ctx);
  f.ctx.__decalage = 0;
  const req = [], refus = [];
  let courant = null;
  function repondre(r) {
    const c = courant, ch = r.chemin;
    if (!c || etat.vinted401) return { status: 401, body: { message: 'unauthorized' } };
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
    } else if (/\/rest\/v1\//.test(u) && etat.basePanne) {
      return { ok: false, status: 522, headers: { get: () => 'text/html' }, json: async () => { throw new Error('html'); }, text: async () => '<html>522</html>', clone() { return this; } };
    } else if (/\/rest\/v1\//.test(u) && etat.baseRLS && String(opts.method || 'GET').toUpperCase() === 'POST') {
      refus.push('rls');
      return { ok: false, status: 403, headers: { get: () => 'application/json' }, json: async () => ({ code: '42501' }), text: async () => '{"code":"42501","message":"new row violates row-level security policy"}', clone() { return this; } };
    } else if (/\/rest\/v1\/app_data\?/.test(u) && etat.baseRLS) {
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => [], text: async () => '[]', clone() { return this; } };
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
  // `etat.bascule = { apres: n, vers }` : il change de compte JUSTE APRÈS la n-ième lecture du cookie.
  f.ctx.activeUidForDomain = async () => { etat.lectures = (etat.lectures || 0) + 1; const v = etat.cookie; if (etat.bascule && etat.lectures === etat.bascule.apres) etat.cookie = etat.bascule.vers; return v || null; };
  f.ctx.activeAccountId = async () => etat.cookie || null;
  f.ctx.isCloisonne = async () => true;
  f.ctx.authToken = async () => (etat.session ? { access_token: 'session_vrm', user_id: 'PROPRIO', expires_at: Date.now() + 3600e3 } : null); f.ctx.loadSession=f.ctx.authToken;
  const dressingDe = (k) => (f.lignes[`harvest_${k}_listings`] || {});
  const lectDressing = (k) => req.filter((x) => x.compte === k && /\/wardrobe\//.test(x.chemin)).length;
  const avance = (ms) => { f.ctx.__decalage += ms; };
  const moissons = () => req.filter((x) => /\/api\/v2\/users\/current/.test(x.chemin)).length;
  return { f, req, refus, dressingDe, lectDressing, avance, moissons };
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
    // Les ventes rapides (90 s) ont déjà été relues : on juge la MOISSON seule.
    m.f.store.vrmDerniereVente = { A: Date.now() };
    await m.f.ctx.visiteVinted();
    dit(!m.f.j.journal.some((t) => /Données rafraîchies/.test(t)), 'une moisson dont TOUTES les écritures sont refusées ne se dit pas « rafraîchie »', JSON.stringify(m.f.j.journal.slice(0, 2)));
    // (le repli relirait le PROFIL et le DRESSING hors de la page ; la vente rapide
    //  et les lecteurs de photos passent par leurs propres chemins)
    const repli = m.req.filter((x) => x.origine !== 'page' && /wardrobe|users\/current/.test(x.chemin));
    dit(repli.length === 0, 'pas de seconde moisson de repli quand c’est la BASE qui refuse', `${repli.length} requête(s) : ${repli.map((x) => x.origine + ' ' + x.chemin).join(' · ')}`);
    etat.baseRefuse = false;
    m.avance(61000);                                       // 61 s plus tard
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

  // ════════════════════════════════════════════════════════════════════════
  // Revue de la 5.165 (11 octobre) — trois défauts reproduits par les relecteurs
  // ════════════════════════════════════════════════════════════════════════
  // Il navigue sur Vinted : une page toutes les `pas` ms pendant `duree` ms.
  // On compte les moissons COMPLÈTES lancées (une visite qui a demandé
  // `/users/current`, par la page ou par le cookie).
  const naviguer = async (m, pas, duree) => {
    let n = 0;
    for (let t = 0; t < duree; t += pas) {
      if (t) m.avance(pas);
      const a = m.moissons();
      await m.f.ctx.visiteVinted();
      if (m.moissons() > a) n++;
    }
    return n;
  };
  console.log('\n── 9. Échec DURABLE de notre base : la garde n’est pas rendue à chaque échec');
  await essaie('base refuse toujours', async () => {
    // RLS : lectures `[]`, écritures 403 42501 (abonnement coupé) — à chaque passage.
    const etat = { cookie: 'A', session: true, baseRLS: true, dressing: { A: dressing(13, 48, 1000) } };
    const m = monter({ etat, lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: ligneDressing(dressing(13, 48, 1000)) } });
    const n5 = await naviguer(m, 61000, 5 * 61000);
    dit(n5 <= 2, 'écritures refusées à CHAQUE passage (RLS 403) : au plus 2 moissons en 5 min de navigation (pas une par minute)', `${n5} moisson(s)`);
    const m2 = monter({ etat: { ...etat, dressing: { A: dressing(13, 48, 1000) } }, lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: ligneDressing(dressing(13, 48, 1000)) } });
    const n30 = await naviguer(m2, 15000, 30 * 60000);
    dit(n30 <= 5 && m2.req.length <= 40, 'RLS sur 30 min de navigation (une page toutes les 15 s) : au plus 5 moissons, 40 requêtes chez Vinted', `${n30} moisson(s), ${m2.req.length} requête(s) Vinted`);
    const etatP = { cookie: 'A', session: true, basePanne: true, dressing: { A: dressing(13, 48, 1000) } };
    const m3 = monter({ etat: etatP, lignes: {} });
    const nP = await naviguer(m3, 15000, 30 * 60000);
    dit(nP <= 5 && m3.req.length <= 40, 'base en PANNE (522 partout, comme du 9 au 12 septembre) sur 30 min : au plus 5 moissons, 40 requêtes chez Vinted', `${nP} moisson(s), ${m3.req.length} requête(s) Vinted`);
    // L'alarme des 20 min et le changement de cookie appellent `runActive` SANS la
    // garde de la visite : la règle doit vivre là aussi.
    const m4 = monter({ etat: { ...etatP }, lignes: {} });
    await m4.f.ctx.runActive(); m4.avance(30000);
    const a4 = m4.moissons();
    await m4.f.ctx.runActive();
    dit(m4.moissons() === a4, 'et `runActive` appelé hors visite (alarme, cookie) 30 s après un refus de la base ne relit pas Vinted', `${m4.moissons() - a4} moisson(s) de plus`);
    // L'autre sens : la base revient, la capture passive range une ligne ⇒ la visite suivante moissonne.
    etatP.basePanne = false;
    await m3.f.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', JSON.stringify({ my_orders: [vente('Z1'), vente('Z2'), vente('Z3')], pagination: { total_entries: 3, total_pages: 1 } }));
    m3.avance(6 * 60000);
    const a3 = m3.moissons();
    await m3.f.ctx.visiteVinted();
    dit(m3.moissons() > a3 && nDe(m3, 'A') === 61, 'l’autre sens : la base revenue (une capture rangée), la visite suivante relit et RANGE le dressing', `${m3.moissons() - a3} moisson(s), dressing en base ${nDe(m3, 'A')}`);
  });
  await essaie('échec passager répété', async () => {
    // La session Vinted est cassée (401 partout, cookie présent) : rien n'est lu.
    const etat = { cookie: 'A', session: true, vinted401: true, dressing: { A: dressing(13, 48, 1000) } };
    const m = monter({ etat, lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: ligneDressing(dressing(13, 48, 1000)) } });
    const n = await naviguer(m, 61000, 5 * 61000);
    dit(n <= 2, 'un échec répété côté Vinted (401) : la garde n’est rendue qu’UNE fois — au plus 2 moissons en 5 min', `${n} moisson(s)`);
  });

  console.log('\n── 10. Repli par cookie : il change de compte pendant la moisson');
  const dressingA61 = () => ligneDressing(dressing(13, 48, 1000));
  const basculer = async (apres, bVide, quand) => {
    const etat = { cookie: 'A', session: true, dressing: { A: dressing(13, 48, 1000), B: bVide ? [] : dressing(4, 0, 2000) } };
    const m = monter({ etat, onglets: [], lignes: { harvest_A_profile: ligneProfil('A'), harvest_B_profile: ligneProfil('B'), harvest_A_listings: dressingA61(),
      harvest_A_orders_sold: { type: 'orders_sold', capturedAt: HIER, nItems: 1, payload: { my_orders: [vente('A0')], pagination: { total_entries: 1 } } } } });
    if (quand === 'dressing') {
      const f0 = m.f.ctx.fetch;
      m.f.ctx.fetch = async (u, o) => { const r = await f0(u, o); if (/wardrobe/.test(String(u))) etat.cookie = 'B'; return r; };
    } else etat.bascule = { apres, vers: 'B' };
    const r = await m.f.ctx.activeFetchActiveAccount();
    const items = ((m.dressingDe('A').payload || {}).items || []);
    const pidA = ((((m.f.lignes.harvest_A_profile || {}).payload || {}).user) || {}).id;
    const ventesA = (((m.f.lignes.harvest_A_orders_sold || {}).payload || {}).my_orders || []).map((o) => o.transaction_id);
    return { r, n: items.length, deB: items.filter((x) => x.id >= 2000 && x.id < 3000).length, pidA, ventesA };
  };
  await essaie('bascule cookie', async () => {
    const a = await basculer(1, false, 'profil');
    dit(a.deB === 0 && a.n === 61 && a.pidA === PID.A && !a.ventesA.some((t) => /^B/.test(t)), 'bascule AVANT le profil : ni le profil, ni le dressing, ni les ventes de B rangés sous A (§5)', JSON.stringify(a));
    const b = await basculer(0, false, 'dressing');
    dit(b.deB === 0 && b.n === 61 && !b.ventesA.some((t) => /^B/.test(t)), 'bascule APRÈS le dressing : les ventes de B ne sont pas rangées sous A', JSON.stringify(b));
    const c = await basculer(1, true, 'profil');
    dit(c.n === 61, 'B vient d’être VIDÉ : son dressing vide n’efface PAS les 61 annonces de A', JSON.stringify(c));
    // L'autre sens : sans bascule, le repli range toujours.
    const etat = { cookie: 'A', session: true, dressing: { A: dressing(0, 48, 1000) } };
    const m = monter({ etat, onglets: [], lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: dressingA61() } });
    const r = await m.f.ctx.activeFetchActiveAccount();
    dit(r === true && nDe(m, 'A') === 48, 'l’autre sens : même compte du début à la fin, le repli range (61 → 48)', `r=${r}, en base ${nDe(m, 'A')}`);
  });

  console.log('\n── 11. §4.2 : la lecture du compteur échoue (lecture KO, écriture OK)');
  await essaie('compteur illisible', async () => {
    const etat = { cookie: 'A', session: true, nItemsKO: true, dressing: {} };
    const m = monter({ etat, lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: dressingA61() } });
    await m.f.ctx.storeHarvest('www.vinted.fr', 'listings', String(PID.A), JSON.stringify({ items: dressing(13, 7, 1000), pagination: { total_entries: 61, total_pages: 4 } }));
    dit(nDe(m, 'A') === 61, 'capture PASSIVE : la page 1 (20 sur 61) n’écrase pas le dressing quand le compteur n’a pas pu être lu', `en base : ${nDe(m, 'A')}`);
    const etat2 = { cookie: 'A', session: true, nItemsKO: true, parPage: 20, pageKO: 2, dressing: { A: dressing(13, 48, 1000) } };
    const m2 = monter({ etat: etat2, lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: dressingA61() } });
    await m2.f.ctx.visiteVinted();
    dit(nDe(m2, 'A') === 61, 'moisson ACTIVE incomplète (page 2 en échec) : n’écrase pas non plus', `en base : ${nDe(m2, 'A')}`);
    const etat3 = { cookie: 'A', session: true, nItemsKO: true, parPage: 20, dressing: { A: dressing(0, 48, 1000) } };
    const m3 = monter({ etat: etat3, lignes: { harvest_A_profile: ligneProfil('A'), harvest_A_listings: dressingA61() } });
    await m3.f.ctx.visiteVinted();
    dit(nDe(m3, 'A') === 48, 'l’autre sens : lu EN ENTIER (total atteint), il est rangé sans avoir besoin du compteur', `en base : ${nDe(m3, 'A')}`);
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();

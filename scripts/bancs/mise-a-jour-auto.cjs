// ════════════════════════════════════════════════════════════════════════════
//  MISE À JOUR SANS RELANCER (25 nov. 2026) — Julien : « ça doit se mettre à jour
//  tout seul car je dois fermer l'app et la rouvrir pour avoir les nouvelles
//  infos » ; « elle doit se mettre à jour si elle reçoit un mail ou que quelque
//  chose se met à jour sur Vinted ».
//
//  La page est ouverte (390 px, base inventée de `vitesse.cjs`), on attend le calme,
//  puis le banc CHANGE les lignes servies, comme le feraient l'extension et la route
//  des e-mails — rien n'est rechargé :
//    1. VINTED, page visible : une vente neuve dans `harvest_{uid}_orders_sold`
//       (capturedAt de maintenant) ⇒ elle doit apparaître dans Ventes ;
//    2. E-MAIL, page visible : un bordereau `email_bord_{tx}` rangé pour cette vente
//       (ce qu'écrit api/email-inbound.js) ⇒ elle doit passer « prête à imprimer »
//       (`data-pret`/« Imprimer ») sans recharger ;
//    3. RETOUR AU PREMIER PLAN : la page est cachée (`visibilitychange`), une
//       seconde vente arrive pendant qu'elle est cachée, la page revient ⇒ la vente
//       doit être là en quelques secondes (la PWA de l'iPhone reste en mémoire).
//  Mesuré aussi : lectures et octets par minute, page ouverte et laissée tranquille.
//  Rouge si une des trois n'apparaît pas dans `MAJ_DELAI_MS` (45 s par défaut).
//
//  Lancer : npm run build && node scripts/bancs/mise-a-jour-auto.cjs
//  Autres : `VITESSE_DIST=dossier` (le code d'avant : il doit être rouge) ·
//  `MAJ_DELAI_MS` · `MAJ_JSON=fichier`.
// ════════════════════════════════════════════════════════════════════════════
if (!process.env.VITESSE_CPU) process.env.VITESSE_CPU = '1';
const fs = require('fs');
const V = require('./vitesse.cjs');
const DELAI = Number(process.env.MAJ_DELAI_MS) || 45000;
const REPOS_MS = Number(process.env.MAJ_REPOS_MS) || 120000;

const ligneVentes = () => V.base.rows.find((r) => /_orders_sold$/.test(r.id));
function nouvelleVente(titre, tx) {
  const r = ligneVentes();
  const p = r.data.payload;
  const modele = p.my_orders[0];
  const v = { ...modele, transaction_id: tx, item_id: tx + 5, title: titre, status: 'Bordereau d\'envoi envoyé à l\'acheteur', transaction_user_status: 'needs_action', date: new Date().toISOString(), price: { amount: '77.0', currency_code: 'EUR' } };
  // Une nouvelle capture ENTIÈRE (comme l'extension) : la liste + 1, l'heure de maintenant.
  r.data = { ...r.data, capturedAt: new Date().toISOString(), nItems: (r.data.nItems || p.my_orders.length) + 1, payload: { ...p, my_orders: [v, ...p.my_orders] } };
  return { uid: /^harvest_(\d+)_/.exec(r.id)[1] };
}
function bordereauEmail(tx) {
  const modele = V.base.rows.find((r) => /^email_bord_/.test(r.id));
  V.base.rows.push({ id: `email_bord_${tx}`, data: { ...modele.data, transaction: String(tx), filename: `bordereau-${tx}.pdf`, receivedAt: new Date().toISOString(), suivi: 'XW' + tx, numero: String(tx).slice(-3), capturedAt: new Date().toISOString() } });
}

async function attendreTexte(pg, re, ms) {
  const t0 = Date.now();
  try { await pg.waitForFunction((s) => new RegExp(s).test(document.body.innerText), re.source, { timeout: ms, polling: 250 }); return Date.now() - t0; } catch (_) { return null; }
}
async function cacher(pg, cache) {
  await pg.evaluate((c) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (c ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => c });
    document.dispatchEvent(new Event('visibilitychange'));
    if (!c) { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); }
  }, cache);
}

(async () => {
  await V.demarrer();
  const b = await V.chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const res = {};
  let tRepos = null;
  const r = await V.ouvrir(b, { width: 390, height: 844 }, 'ventes', () => /vente/i.test(document.body.innerText), null, {
    apres: async (pg) => {
      const t = (x) => x;
      // 0. Au repos : la page ouverte, personne n'y touche (ce que coûte la mise à jour).
      tRepos = [Date.now(), null];
      await pg.waitForTimeout(REPOS_MS);
      tRepos[1] = Date.now();
      // 1. Vinted, page visible.
      nouvelleVente('Zebulon Neuve Banc', 23999000001);
      res.vinted = await attendreTexte(pg, /Zebulon Neuve Banc/, DELAI);
      // 2. E-mail : le bordereau de cette vente.
      const avantPret = await pg.evaluate(() => { const l = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /Zebulon Neuve Banc/.test(e.textContent)); const row = l && l.closest('[data-pret],[data-fiche-ligne],li,[role="button"]'); return row ? row.outerHTML.length : 0; }).catch(() => 0);
      bordereauEmail(23999000001);
      const t0 = Date.now();
      res.email = null;
      for (let i = 0; i < DELAI / 500; i++) {
        await pg.waitForTimeout(500);
        const vu = await pg.evaluate(() => [...document.querySelectorAll('[data-pret="1"],[data-pret="true"],[data-pret=""]')].some((e) => /Zebulon Neuve Banc/.test(e.textContent))
          || [...document.querySelectorAll('[data-tx="23999000001"],[data-vente="23999000001"]')].some((e) => /imprimer|prêt|bordereau/i.test(e.textContent) && !/en attente du bordereau/i.test(e.textContent))).catch(() => false);
        if (vu) { res.email = Date.now() - t0; break; }
      }
      res.emailAvant = avantPret;
      // 3. Retour au premier plan.
      await cacher(pg, true);
      await pg.waitForTimeout(3000);
      nouvelleVente('Yvonne Cachee Banc', 23999000002);
      await pg.waitForTimeout(40000);   // assez long pour qu'un minuteur ait pu tourner : il ne doit pas (onglet caché)
      res.cacheVu = await pg.evaluate(() => /Yvonne Cachee Banc/.test(document.body.innerText));
      await cacher(pg, false);
      res.retour = await attendreTexte(pg, /Yvonne Cachee Banc/, Math.min(DELAI, 15000));
      return t(res);
    },
  });
  await b.close(); await V.fermer();
  const gets = r.req.filter((x) => x.m === 'GET');
  const t0Page = r.req.length ? 0 : 0;
  // Les lectures pendant le repos (heures relatives au début de la page).
  const debutRepos = tRepos ? tRepos[0] : 0, finRepos = tRepos ? tRepos[1] : 0;
  const premiere = gets.length ? Math.min(...gets.map((x) => x.debut)) : 0;
  void t0Page; void premiere;
  // `debut` est relatif à t0 de la page ; on retrouve t0 par l'horloge : ouvrir() pose t0 juste avant goto.
  const enRepos = gets.filter((x) => x.debutAbs >= debutRepos && x.debutAbs < finRepos);
  const minutes = (finRepos - debutRepos) / 60000;
  const parMin = enRepos.length / minutes, koParMin = enRepos.reduce((a, x) => a + x.octets, 0) / 1024 / minutes;
  console.log(`MISE À JOUR SANS RELANCER — Ventes, 390 px`);
  console.log(`  au repos (${Math.round(minutes * 10) / 10} min, page visible) : ${parMin.toFixed(1)} lectures/min · ${koParMin.toFixed(1)} Ko/min`);
  for (const x of enRepos.slice(0, 40)) if (process.env.MAJ_DETAIL) console.log('     ', decodeURIComponent(x.url.replace(/^.*\/rest\/v1\//, '')).slice(0, 160), x.octets);
  const r_ = r.apres || {};
  let ko = 0;
  const dit = (ok, m) => { if (!ok) ko++; console.log((ok ? '  ✅ ' : '  ❌ ') + m); };
  dit(r_.vinted != null, `Vinted (vente captée, page visible) : ${r_.vinted != null ? 'à l\'écran en ' + (r_.vinted / 1000).toFixed(1) + ' s' : 'jamais vue en ' + DELAI / 1000 + ' s'}`);
  dit(r_.email != null, `E-mail (bordereau rangé, page visible) : ${r_.email != null ? 'vente prête à imprimer en ' + (r_.email / 1000).toFixed(1) + ' s' : 'jamais vu en ' + DELAI / 1000 + ' s'}`);
  dit(r_.retour != null, `Retour au premier plan : ${r_.retour != null ? 'vente arrivée pendant l\'absence vue en ' + (r_.retour / 1000).toFixed(1) + ' s' : 'pas vue'}${r_.cacheVu ? ' (déjà là pendant que la page était cachée)' : ''}`);
  if (process.env.MAJ_JSON) fs.writeFileSync(process.env.MAJ_JSON, JSON.stringify({ ...r_, parMin, koParMin }, null, 1));
  console.log(ko ? `❌ ${ko} mise(s) à jour manquée(s)` : '✅ l\'app se met à jour seule');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

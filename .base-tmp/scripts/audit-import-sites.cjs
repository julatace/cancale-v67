// ════════════════════════════════════════════════════════════════════════════
//  L'HISTORIQUE LEBONCOIN ET VESTIAIRE (extension 5.365, lot import-historique-sites)
//
//  Julien : « récupérer TOUT l'historique de ventes et d'achats sur Leboncoin,
//  eBay et Vestiaire, comme pour Vinted ». On EXÉCUTE le vrai `background.js`
//  (`_fond-vm.cjs`) devant deux FAUX SITES (la page de l'onglet répond aux
//  ordres `vcImportPage` / `lbcImportPage` comme vc-inject.js / lbc-inject.js) :
//   1. Vestiaire, compte neuf : 3 pages par passage, dans l'ordre du modèle
//      (seul `offset` change), pause ALÉATOIRE 3–8 s, une page à la fois ;
//      rangées dans `vc_ventes` ; SA ligne dit « 60 sur 230 » ;
//   2. l'heure : 12 lectures au plus pour ce compte (DANS les 20) ; pause « rythme » ;
//   3. jusqu'au bout : 230 ventes + 70 achats, chacun une fois, une vente déjà
//      rangée hors des pages reste ; « fini » ; plus aucune lecture ensuite ;
//   4. sans modèle (aucune page 2 vue) : aucune lecture ;
//   5. un autre compte dans l'onglet : aucune lecture ;
//   6. 429 : la série s'arrête, pause 30 min ; ensuite reprise À LA MÊME page ;
//   7. notre base refuse la page : elle n'avance pas ;
//   8. forme inconnue : rien écrit, rien n'avance ;
//   9. Leboncoin : 130 transactions, chacune relue en DÉTAIL (vendeur/acheteur,
//      prix final) ; une annulée n'est pas relue ; une déjà en détail en base non plus ;
//  10. Leboncoin : un site qui ignore la pagination (même page) ⇒ fini, pas de boucle ;
//  11. le budget de lecture des comptes Vinted n'est pas touché ;
//  12. « Tout récupérer » (app) : repart de la 1re page ; sans onglet : refusé ;
//  13. le modèle n'est rangé que pour le compte prouvé de l'onglet.
//  §6.1 : rouge sur origin/main (`--src <copie>`), et par MUTATION (`--mutations`).
//  Données inventées. Usage : node scripts/audit-import-sites.cjs [--src f] [--mutations]
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), os = require('os'), path = require('path');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

const VC = 'c42', LBC = 'a1b2c3d4-0000-4000-8000-000000000001';
const TAB_VC = 21, TAB_LBC = 22;
const N_VV = 230, N_VA = 70, N_LBC = 130;
const VV = Array.from({ length: N_VV }, (_, i) => ({ id: 'S' + (900000 - i), productId: String(70000 + i), etat: 'completed', date: '2026-01-01', titre: 'Paire ' + i }));
const VA = Array.from({ length: N_VA }, (_, i) => ({ id: 'A' + (800000 - i), productId: String(60000 + i), nom: 'Achat ' + i, etat: 'delivered' }));
const TX = Array.from({ length: N_LBC }, (_, i) => ({ id: { purchase_id: String(400000000 + i) }, item: { title: 'Paire ' + i, price: 3000 }, created_at: new Date(Date.UTC(2025, 0, 1) + i * 864e5).toISOString(), step: { status: i === 5 ? 'cancelled' : 'done' } }));
const MODELE_VV = 'https://apiv2.vestiairecollective.com/users/me/sales?limit=20&offset=20';
const MODELE_VA = 'https://apiv2.vestiairecollective.com/users/me/orders?limit=20&offset=20';
const MODELE_LBC = 'https://api.leboncoin.fr/api/consumergoods/proxy/v3/pages/transactions?page=2';

// Le faux Vestiaire (la page de l'onglet) : sert une page du modèle, ou refuse.
function fauxSites(o = {}) {
  const j = { ordres: [], enVol: 0, maxEnVol: 0 };
  const repondre = async (tabId, m) => {
    j.ordres.push({ tabId, action: m.action, url: m.url, compte: m.compte });
    j.enVol++; j.maxEnVol = Math.max(j.maxEnVol, j.enVol);
    await new Promise((r) => setTimeout(r, 1));
    j.enVol--;
    const u = new URL(m.url);
    if (m.action === 'vcImportPage') {
      if (tabId !== TAB_VC) return { ok: true, statut: 0, erreur: 'pas-vestiaire' };
      const moi = o.moiVc || VC;
      if (m.compte !== moi && !o.pageLaxiste) return { ok: true, statut: 0, erreur: 'autre-compte', moi };
      const st = o.statut ? o.statut(u) : 200;
      if (st !== 200) return { ok: true, statut: st };
      if (o.inconnu) return { ok: true, statut: 200, quoi: m.quoi, moi, paquet: { source: 'ventes', ventes: [], offset: 0, total: null, lus: 0, forme: [], inconnu: ['data.x:string'], moi } };   // la forme que rend vc-inject (`listeConnue` faux)
      const off = Number(u.searchParams.get('offset')), lim = Number(u.searchParams.get('limit'));
      const liste = m.quoi === 'ventes' ? VV : VA;
      const lot = liste.slice(off, off + lim);
      const paquet = m.quoi === 'ventes' ? { source: 'ventes', ventes: lot, offset: off, total: liste.length, lus: lot.length, forme: [], moi } : { achats: lot, offset: off, total: liste.length, lus: lot.length, page: '/orders', forme: [], moi };
      return { ok: true, statut: 200, quoi: m.quoi, moi, paquet };
    }
    if (m.action === 'lbcImportPage') {
      if (tabId !== TAB_LBC) return { ok: true, statut: 0, erreur: 'pas-leboncoin' };
      if (m.compte !== LBC) return { ok: true, statut: 0, erreur: 'autre-compte' };
      const det = /transactions\/(\d+)$/.exec(u.pathname);
      if (det) {
        j.details = (j.details || []).concat(det[1]);
        const i = TX.findIndex((t) => t.id.purchase_id === det[1]);
        const corps = JSON.stringify({ id: { purchase_id: det[1] }, is_seller: i % 3 !== 0, item: { id: 9000 + i, title: 'Paire ' + i, prices: { final: 2500 } }, step: { status: 'done', label: 'Terminée' } });
        return { ok: true, statut: 200, url: m.url, corps, session: 'lbc-account:' + LBC, moi: LBC };
      }
      const p = o.memePage ? 1 : Number(u.searchParams.get('page'));
      const corps = JSON.stringify(TX.slice((p - 1) * 20, p * 20));
      return { ok: true, statut: 200, url: m.url, corps, session: 'lbc-account:' + LBC, moi: LBC };
    }
    return { ok: false, code: 'invalide' };
  };
  return { j, repondre };
}

const ongletsDe = () => [{ id: 7, url: 'https://www.vinted.fr/', status: 'complete' }, { id: TAB_VC, url: 'https://fr.vestiairecollective.com/members/sales', status: 'complete' }, { id: TAB_LBC, url: 'https://www.leboncoin.fr/compte/part/mes-transactions', status: 'complete' }];
const lignesBase = () => ({ lbc_accounts: { accounts: { ['lbc-account:' + LBC]: { name: 'Toto', preuveCompte: 'membre-prive-v1' } } } });
const storeDe = (o = {}) => Object.assign({
  vrmVcOnglets: { [TAB_VC]: { compte: o.compteOnglet || VC, at: Date.now() } },
  vrmLbcTransport: { [TAB_LBC]: { source: 'prive', compte: 'lbc-account:' + LBC, at: Date.now() } },
}, o.modeles === false ? {} : { vrmImportModeles: Object.assign({},
  o.lbc ? { ['leboncoin:' + LBC]: { transactions: { k: { url: MODELE_LBC, at: 1 } } } } : {},
  o.vc === false ? {} : { ['vestiaire:' + VC]: { ventes: { k: { url: MODELE_VV, at: 1 } }, achats: { k2: { url: MODELE_VA, at: 1 } } } }) });
const ventesVc = (f) => Object.keys(((f.lignes.vc_ventes || {}).ventes) || {});
const achatsVc = (f) => Object.keys(((f.lignes.vc_achats || {}).achats) || {});
const ligne = (f, site, c) => f.lignes[`import_${site}_${c}`] || null;
const etat = (f, site, c) => ((f.store.vrmImportSites || {})[`${site}:${c}`]) || null;
const offsets = (s) => s.j.ordres.filter((x) => x.action === 'vcImportPage').map((x) => { const u = new URL(x.url); return `${/sales/.test(u.pathname) ? 'v' : 'a'}${u.searchParams.get('offset')}`; });
const uneHeure = (f) => { delete f.store.vrmLectures; delete f.store.vrmImportSitesLus; };

async function controles(SRC, dit) {
  const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { dit(false, quoi + ' — a levé : ' + (e && e.stack || e)); } };
  const fond = (o = {}) => {
    const s = fauxSites(o.sites || {});
    const f = faireFond(Object.assign({ src: SRC, onglets: ongletsDe(), lignes: Object.assign(lignesBase(), o.lignes || {}), store: storeDe(o) }, o.fond || {}));
    f.ctx.__vrmPausesVues = [];
    // (12 nov., 5.356+) Le délai des requêtes à la base (`signalDelai`, 10–20 s par `setTimeout`) :
    // le banc ramène tout minuteur à 2 ms, la fausse base répond en 3 ms ⇒ des lectures/écritures
    // « coupées » au hasard. Cet audit juge les PAGES de l'historique, pas ce délai (jugé par
    // audit-robustesse-extension F1/F2) : sans signal ici.
    if (typeof f.ctx.signalDelai === 'function') f.ctx.signalDelai = () => undefined;
    f.ctx.chrome.tabs.sendMessage = (id, m) => (m && m.__vmrEvt ? Promise.resolve() : s.repondre(id, m));
    return { f, s };
  };

  await essaie('1. Vestiaire, compte neuf', async () => {
    const { f, s } = fond();
    await f.ctx.tickImportSites();
    dit(offsets(s).join(' ') === 'v0 v20 v40', '1. 3 pages au premier passage, dans l’ordre (seul `offset` change)', offsets(s).join(' '));
    dit(s.j.ordres.every((x) => /limit=20/.test(x.url) && x.compte === VC && x.tabId === TAB_VC), '1. le modèle recopié tel quel, au nom du compte de l’onglet');
    const ps = (f.ctx.__vrmPausesVues || []).filter((x) => x[0] === 'impsite').map((x) => x[1]);
    dit(ps.length === 2 && ps.every((ms) => ms >= 3000 && ms <= 8000), '1. une pause de 3 à 8 s entre deux pages', JSON.stringify(ps));
    dit(s.j.maxEnVol === 1, '1. une page à la fois', String(s.j.maxEnVol));
    dit(ventesVc(f).length === 60, '1. les 60 ventes lues sont rangées dans `vc_ventes`', String(ventesVc(f).length));
    const l = ligne(f, 'vestiaire', VC);
    dit(!!l && l.etat === 'encours' && l.types.ventes.lus === 60 && l.types.ventes.total === N_VV, '1. SA ligne dit « 60 sur 230 »', JSON.stringify(l && l.types));
    dit(!f.j.posts.flat().includes('main'), '1. jamais la ligne `main`');
  });

  await essaie('2. l’heure', async () => {
    const { f, s } = fond();
    for (let i = 0; i < 6; i++) await f.ctx.tickImportSites();
    dit(s.j.ordres.length === 12, '2. six passages dans l’heure : 12 lectures, pas une de plus', String(s.j.ordres.length));
    const lu = ((f.store.vrmLectures || {})['vestiaire:' + VC] || []).length;
    dit(lu === 12, '2. comptées dans le budget de LECTURE du compte (12 sur 20 : 8 gardées)', String(lu));
    const st = etat(f, 'vestiaire', VC);
    dit(!!st && st.pause && ['rythme', 'budget'].includes(st.pause.cause), '2. l’état dit « en pause »', JSON.stringify(st && st.pause));
    dit((ligne(f, 'vestiaire', VC) || {}).etat === 'pause', '2. SA ligne aussi');
  });

  await essaie('3. jusqu’au bout', async () => {
    const lignes = { vc_ventes: { ventes: { ANCIENNE: { productId: '1', etat: 'completed', sources: ['ventes'] } } } };
    const { f, s } = fond({ lignes });
    for (let h = 0; h < 8; h++) { uneHeure(f); for (let i = 0; i < 4; i++) await f.ctx.tickImportSites(); const l = ligne(f, 'vestiaire', VC); if (l && l.etat === 'fini') break; }
    const v = ventesVc(f), a = achatsVc(f);
    dit(VV.every((x) => v.includes(x.id)) && v.length === N_VV + 1, '3. les 230 ventes rangées, chacune une fois', String(v.length));
    dit(v.includes('ANCIENNE'), '3. la vente déjà rangée hors des pages reste');
    dit(a.length === N_VA, '3. les 70 achats rangés', String(a.length));
    const l = ligne(f, 'vestiaire', VC);
    dit(!!l && l.etat === 'fini' && l.types.ventes.fini && l.types.achats.fini && l.types.achats.lus === N_VA, '3. « fini » : 230 ventes, 70 achats', JSON.stringify(l && { e: l.etat, t: l.types }));
    const off = offsets(s);
    dit(new Set(off).size === off.length, '3. aucune page lue deux fois', `${off.length} / ${new Set(off).size}`);
    const avant = s.j.ordres.length; uneHeure(f); await f.ctx.tickImportSites();
    dit(s.j.ordres.length === avant, '3. fini : plus aucune lecture', String(s.j.ordres.length - avant));
  });

  await essaie('4. sans modèle', async () => {
    const { f, s } = fond({ modeles: false });
    await f.ctx.tickImportSites();
    dit(s.j.ordres.length === 0, '4. aucune page 2 vue : aucune lecture (rien n’est deviné)', String(s.j.ordres.length));
  });

  await essaie('5. autre compte', async () => {
    const { f, s } = fond({ compteOnglet: 'autre9' });
    await f.ctx.tickImportSites();
    dit(s.j.ordres.length === 0, '5. l’onglet est sur un autre compte : aucune lecture', String(s.j.ordres.length));
    const g = fond({ sites: { moiVc: 'autre9', pageLaxiste: true } });   // une page qui ne refuserait pas : le fond refuse quand même
    await g.f.ctx.tickImportSites();
    dit(ventesVc(g.f).length === 0 && g.s.j.ordres.length === 1, '5. la page dit un autre compte : rien rangé, la série s’arrête', `${g.s.j.ordres.length} ordre(s)`);
  });

  await essaie('6. 429', async () => {
    let refuse = true;
    const { f, s } = fond({ sites: { statut: (u) => (refuse && u.searchParams.get('offset') === '20' ? 429 : 200) } });
    await f.ctx.tickImportSites();
    dit(offsets(s).join(' ') === 'v0 v20', '6. un 429 : la série s’arrête', offsets(s).join(' '));
    const st = etat(f, 'vestiaire', VC);
    dit(!!st && st.pause && st.pause.cause === 'vestiaire' && st.pause.jusqua - Date.now() > 25 * 60000, '6. pause de 30 min', JSON.stringify(st && st.pause));
    await f.ctx.tickImportSites();
    dit(s.j.ordres.length === 2, '6. rien ne part pendant la pause', String(s.j.ordres.length));
    refuse = false; f.store.vrmImportSites['vestiaire:' + VC].pause.jusqua = Date.now() - 1;
    await f.ctx.tickImportSites();
    dit(offsets(s)[2] === 'v20', '6. après : reprise À LA page refusée', offsets(s).join(' '));
  });

  await essaie('7. base refuse', async () => {
    const { f, s } = fond({ fond: { ecritureKO: (id) => id === 'vc_ventes' } });
    await f.ctx.tickImportSites();
    await f.ctx.tickImportSites();
    dit(offsets(s).every((x) => x === 'v0'), '7. la base refuse : la page n’avance pas (relue au passage suivant)', offsets(s).join(' '));
  });

  await essaie('8. forme inconnue', async () => {
    const { f, s } = fond({ sites: { inconnu: true } });
    await f.ctx.tickImportSites(); await f.ctx.tickImportSites();
    dit(!f.lignes.vc_ventes && offsets(s).every((x) => x === 'v0'), '8. forme inconnue : rien écrit, rien n’avance', offsets(s).join(' '));
    const st = etat(f, 'vestiaire', VC);
    dit(!!st && !Object.values(st.ventes.listes).some((l) => l.fini), '8. une forme inconnue ne passe JAMAIS pour « la fin de la liste »');
  });

  await essaie('9. Leboncoin', async () => {
    const lignes = { lbc_ventes: { ventes: { [TX[0].id.purchase_id]: { txId: TX[0].id.purchase_id, isSeller: true, account: 'lbc-account:' + LBC, price: 1000 } } } };
    const { f, s } = fond({ lbc: true, vc: false, lignes });
    for (let h = 0; h < 20; h++) { uneHeure(f); for (let i = 0; i < 4; i++) await f.ctx.tickImportSites(); const l = ligne(f, 'leboncoin', LBC); if (l && l.etat === 'fini') break; }
    const v = ((f.lignes.lbc_ventes || {}).ventes) || {};
    dit(TX.every((t) => v[t.id.purchase_id]) && Object.keys(v).length === N_LBC, '9. les 130 transactions rangées par n°, chacune une fois', String(Object.keys(v).length));
    const det = s.j.details || [];
    dit(!det.includes(TX[5].id.purchase_id), '9. une transaction annulée n’est pas relue en détail');
    dit(!det.includes(TX[0].id.purchase_id), '9. une transaction déjà en détail en base n’est pas relue');
    dit(det.length === N_LBC - 2 && new Set(det).size === det.length, '9. chaque autre transaction relue UNE fois en détail', String(det.length));
    dit(v[TX[3].id.purchase_id] && v[TX[3].id.purchase_id].isSeller === false && v[TX[4].id.purchase_id].isSeller === true && v[TX[4].id.purchase_id].price === 2500, '9. vendeur/acheteur et prix final viennent du détail', JSON.stringify(v[TX[4].id.purchase_id]));
    dit(Object.values(v).every((x) => x.account === 'lbc-account:' + LBC), '9. rangées au compte privé de l’onglet');
    const l = ligne(f, 'leboncoin', LBC);
    dit(!!l && l.etat === 'fini' && l.types.details.lus === N_LBC - 2 && l.types.details.total === N_LBC - 2, '9. SA ligne : « fini », détails 128 sur 128', JSON.stringify(l && l.types));
    const pages = s.j.ordres.filter((x) => !/transactions\/\d+$/.test(new URL(x.url).pathname)).map((x) => new URL(x.url).searchParams.get('page'));
    dit(pages.join(',') === '1,2,3,4,5,6,7,8', '9. la liste lue page 1 à 8 (la dernière, vide, l’arrête)', pages.join(','));
  });

  await essaie('10. pagination ignorée', async () => {
    const { f, s } = fond({ lbc: true, vc: false, sites: { memePage: true } });
    for (let i = 0; i < 3; i++) { uneHeure(f); await f.ctx.tickImportSites(); }
    const pages = s.j.ordres.filter((x) => !/transactions\/\d+$/.test(new URL(x.url).pathname)).length;
    const st = etat(f, 'leboncoin', LBC);
    dit(pages === 2 && st && Object.values(st.transactions.listes).every((l) => l.fini), '10. la même page deux fois : la liste est finie, pas de boucle', `${pages} page(s)`);
  });

  await essaie('11. budget Vinted', async () => {
    const { f } = fond();
    for (let i = 0; i < 3; i++) await f.ctx.tickImportSites();
    dit(!((f.store.vrmLectures || {})['111']), '11. le budget de lecture des comptes Vinted n’est pas touché');
  });

  await essaie('12. Tout récupérer', async () => {
    const { f, s } = fond();
    await f.ctx.tickImportSites();
    const r = await f.envoyer({ from: 'vmr-bridge', action: 'cmd', cmd: 'importSiteTout', site: 'vestiaire', compte: VC });
    await new Promise((ok) => setTimeout(ok, 300));
    const off = offsets(s);
    dit(!!r && r.accepte === true && off[3] === 'v0', '12. « Tout récupérer » : repart de la première page', JSON.stringify({ r: r && r.accepte, off }));
    const n = s.j.ordres.length;
    const r2 = await f.envoyer({ from: 'vmr-bridge', action: 'cmd', cmd: 'importSiteTout', site: 'vestiaire', compte: 'inconnu7' });
    await new Promise((ok) => setTimeout(ok, 100));
    dit(!!r2 && r2.accepte === false && s.j.ordres.length === n, '12. un compte sans onglet : refusé, rien ne part', JSON.stringify(r2));
  });

  await essaie('14. un passage à la fois', async () => {
    const { f, s } = fond();
    await Promise.all([f.ctx.tickImportSites(), f.ctx.tickImportSites(), f.ctx.importerSite('vestiaire', VC)]);
    dit(s.j.maxEnVol === 1 && s.j.ordres.length === 3, '14. trois départs en même temps : un seul passage, une page à la fois', `${s.j.ordres.length} ordre(s), ${s.j.maxEnVol} en vol`);
  });

  await essaie('15. sans onglet', async () => {
    const { f, s } = fond();
    f.store.vrmVcOnglets = {};
    await f.ctx.importerSite('vestiaire', VC);
    dit(s.j.ordres.length === 0, '15. aucun onglet de ce compte : aucune lecture', String(s.j.ordres.length));
  });

  await essaie('13. modèle', async () => {
    const { f } = fond({ modeles: false });
    const ok = await f.envoyer({ from: 'cancale-vc', action: 'vcImportModele', quoi: 'ventes', url: MODELE_VV, moi: VC }, { id: 'x', frameId: 0, tab: { id: TAB_VC, url: 'https://fr.vestiairecollective.com/members/sales' } });
    const non = await f.envoyer({ from: 'cancale-vc', action: 'vcImportModele', quoi: 'ventes', url: MODELE_VV, moi: 'autre9' }, { id: 'x', frameId: 0, tab: { id: TAB_VC, url: 'https://fr.vestiairecollective.com/members/sales' } });
    const m = (f.store.vrmImportModeles || {});
    dit(!!ok && ok.ok === true && m['vestiaire:' + VC] && !m['vestiaire:autre9'], '13. Vestiaire : rangé pour le compte de l’onglet ET de la page seulement', JSON.stringify({ ok, non, cles: Object.keys(m) }));
    const sans = await f.envoyer({ from: 'cancale-vc', action: 'vcImportModele', quoi: 'ventes', url: 'https://apiv2.vestiairecollective.com/users/me/sales', moi: VC }, { id: 'x', frameId: 0, tab: { id: TAB_VC, url: 'https://fr.vestiairecollective.com/' } });
    dit(Object.keys(m['vestiaire:' + VC].ventes).length === 1 && sans && sans.ok === false, '13. une adresse sans pagination n’est pas un modèle');
    const l1 = await f.envoyer({ from: 'cancale-lbc', action: 'lbcImportModele', url: MODELE_LBC, moi: LBC }, { id: 'x', frameId: 0, tab: { id: TAB_LBC, url: 'https://www.leboncoin.fr/compte/part/mes-transactions' } });
    const l2 = await f.envoyer({ from: 'cancale-lbc', action: 'lbcImportModele', url: MODELE_LBC, moi: 'zz-autre' }, { id: 'x', frameId: 0, tab: { id: TAB_LBC, url: 'https://www.leboncoin.fr/compte/part/mes-transactions' } });
    const m2 = (f.store.vrmImportModeles || {});
    dit(!!l1 && l1.ok === true && !!m2['leboncoin:' + LBC] && !m2['leboncoin:zz-autre'] && l2 && l2.ok === false, '13. Leboncoin : rangé pour le compte privé de l’onglet seulement', JSON.stringify({ l1, l2 }));
  });
}

async function lancer(SRC) {
  let ko = 0, ok = 0;
  await controles(SRC, (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } });
  return { ko, ok };
}

const MUTATIONS = [
  ['3 pages par passage → 30', 'const IMPSITE_PAR_PASSAGE = 3;', 'const IMPSITE_PAR_PASSAGE = 30;'],
  ['plafond horaire retiré', 'const IMPSITE_MAX_HEURE = 12;', 'const IMPSITE_MAX_HEURE = 99;'],
  ['pause retirée', 'if (n > 0) await pauseImpSite();', ''],
  ['page avancée même refusée par la base', "if (ok !== true) return { ok: false, cause: 'base' };\n  return { ok: true, n: lot.length", "return { ok: true, n: lot.length"],
  ['429 sans pause', "if (r.refus) st.pause = { jusqua: Date.now() + IMPSITE_PAUSE_REFUS_MS, cause: site };", ''],
  ['forme inconnue acceptée', "if (!p || Array.isArray(p.inconnu) || !rep.quoi) return { ok: false, cause: 'forme' };", "if (!p) return { ok: false, cause: 'forme' };"],
  ['compte de la page pas vérifié', "if (!moi || moi !== String(compte)) return { ok: false, cause: 'autre-compte' };", ''],
  ['détails déjà en base relus', 'const aLire = manq === null ? neufs : manq;', 'const aLire = neufs;'],
  ['annulées relues', "const neufs = (r.ids || []).filter((id, i) => !/cancel/i.test((r.etats || [])[i] || ''));", 'const neufs = (r.ids || []);'],
  ['même page = pas fini (boucle)', "if (!r.n || (empreinte && empreinte === l.dernier)) l.fini = true;", 'if (!r.n) l.fini = true;'],
  ['modèle sans pagination accepté', "if (!IMPSITE_TYPES[site] || !compteImpOk(compte) || !paginationModele(url)) return false;", 'if (!IMPSITE_TYPES[site] || !compteImpOk(compte)) return false;'],
  ['verrou retiré', "if (_impSiteEnCours) { try { noterDiag('impsite_deja_en_cours'); } catch (_) {} return _impSiteEnCours.then(() => 0, () => 0); }", ''],
  ['onglet du compte pas exigé', 'if (tabId == null) return 0;\n  const st = await departImpSite', 'const st = await departImpSite'],
];

(async () => {
  const SRC = cheminSource();
  const r = await lancer(SRC);
  console.log(r.ko ? `\n❌ historique Leboncoin / Vestiaire : ${r.ok} vert(s), ${r.ko} rouge(s)` : `\n✅ historique Leboncoin / Vestiaire : ${r.ok} vert(s), 0 rouge(s)`);
  let koMut = 0;
  if (process.argv.includes('--mutations')) {
    const texte = fs.readFileSync(SRC, 'utf8');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-mut-impsite-'));
    for (const [nom, de, vers] of MUTATIONS) {
      if (!texte.includes(de)) { koMut++; console.log(`❌ mutation « ${nom} » : la ligne est introuvable — le contrôle ne prouve rien`); continue; }
      const f = path.join(dir, 'background.js');
      fs.writeFileSync(f, texte.replace(de, vers));
      const log = console.log; console.log = () => {};
      let m; try { m = await lancer(f); } finally { console.log = log; }
      if (m.ko > 0) console.log(`✅ mutation « ${nom} » : ${m.ko} rouge(s) — le contrôle mord`);
      else { koMut++; console.log(`❌ mutation « ${nom} » : tout reste vert`); }
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  process.exit(r.ko || koMut ? 1 : 0);
})();

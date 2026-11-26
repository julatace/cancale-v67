// ════════════════════════════════════════════════════════════════════════════
//  L'ONGLET DE TRAVAIL OUVERT D'ABORD (21 nov., ext. 5.410.7)
//
//  Julien : « fais en sorte que ça ouvre un autre onglet pour travailler ». Avant (5.410.5) : une petite FENÊTRE
//  popup, ouverte seulement au premier envoi réel ; quand le serveur refusait la file, rien ne s'ouvrait et il croyait
//  que rien ne marchait. On EXÉCUTE le VRAI background.js (scripts/_fond-vm.cjs), serveur VRM inventé :
//   O1. « Confirmer l'envoi » (`lancer`, confirme) ⇒ un ONGLET vinted.fr s'ouvre AVANT la demande au serveur, dans SA
//       fenêtre, juste à droite de l'onglet d'où il a touché, épinglé, sans prendre le focus ; aucune fenêtre popup ;
//   O2. le 2e lancement RÉUTILISE le même onglet (aucun second onglet) ;
//   O3. le serveur refuse la file ⇒ l'onglet reste ouvert, le bandeau porte la raison, la réponse nomme les favoris
//       concernés (`ids`) pour la carte ;
//   O4. l'onglet de travail fermé pendant l'envoi ⇒ la file est ARRÊTÉE chez VRM et c'est dit (`travail_ferme`) ;
//   O5. chaque favori du lot a son état (copie de la file du serveur, `jobs`) pour les rangées de la carte ;
//   O6. sans « confirme », rien ne s'ouvre ni ne part ;
//   O7. (5.410.8) ouvert sur vinted.fr/inbox (comme Bleam) ; le VOILE reposé à chaque page chargée de l'onglet de travail ;
//   O8. « Reprendre » une file restée active chez VRM : ce navigateur la mène (onglet de travail d'abord), rien d'autre lancé ;
//   O9. « Annuler l'ancienne file et envoyer ces N » : `arreter` chez VRM AVANT `lancer`.
//  `--src <ancien background.js>` ⇒ rouge. `--prouve` : chaque mutation rend l'audit rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const iSrc = args.indexOf('--src');
const SRC0 = iSrc >= 0 ? path.resolve(args[iSrc + 1]) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const MUTATIONS = {
  popup: { a: "try { t = await chrome.tabs.create({ url, active: false, pinned: true,", b: "try { t = null; void ({ url, active: false, pinned: true," },
  apres: { a: "    const ot = await travailDabord(o, sender);\n", b: "    const ot = null;\n" },
  index: { a: "...(ici && Number.isInteger(ici.index) ? { index: ici.index + 1 } : {})", b: '' },
  ferme: { a: "if (st.travail != null && (await travailFermeDepuis(st.debut, st.travail))) {", b: 'if (false) {' },
  inbox: { a: "opts.chemin : '/inbox'}`;", b: "opts.chemin : '/'}`;" },
  voile: { a: "if (m && m.tabId === tabId && !(Number(m.fermeAt) > 0)) await marquerOngletTravail(tabId, m.raison || '');", b: '' },
  remplacer: { a: "if (msg.remplacer === true) { const ar = await apiFavorisCarte(o.uid, 'arreter');", b: "if (false) { const ar = await apiFavorisCarte(o.uid, 'arreter');" },
  ids: { a: "return { ok: false, code, raison, ids: sel.slice(0, FAVORIS_CARTE_TOUS), travail: ot && ot.tabId != null }; };", b: "return { ok: false, code, raison }; };" },
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`); if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
let SRC = SRC0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) { const M = MUTATIONS[mut]; const s = fs.readFileSync(SRC0, 'utf8'); if (!s.includes(M.a)) { console.log('mutation introuvable : ' + mut); process.exit(2); } SRC = path.join(os.tmpdir(), `bg-onglet-travail-${mut}-${process.pid}.js`); fs.writeFileSync(SRC, s.split(M.a).join(M.b)); }
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 400) : ''}`); } };
const UID = '111', MIN = 60000;
const SENDER = { tab: { id: 7, url: 'https://www.vinted.fr/member/111', index: 3, windowId: 1 } };
const SEL = ['n1', 'n2', 'n3'];
function monde(o = {}) {
  const onglets = [{ id: 7, url: 'https://www.vinted.fr/member/111', status: 'complete', index: 3, windowId: 1 }];
  const h = { lancers: [], arrets: 0, ordre: [] };
  let F = null;
  const vue = (etats) => ({ active: true, lot: 'L1', prochain: 0, jobs: SEL.map((id, i) => ({ id: 'j' + i, notificationId: id, etat: etats[i], lot: 'L1', ...(i === 0 && etats[i] === 'envoye' ? { offre: { mode: 'pct', valeur: 10 } } : {}) })) });
  h.vrm = async (req) => {
    if (req.mode !== 'favoris') return { status: 404, body: {} };
    const c = req.corps || {};
    if (req.methode === 'GET') return { status: 200, body: { ok: true, uid: UID, vue: vue(['envoye', 'attente', 'attente']), carte: { total: 3, envoyes: 1, active: true }, serveur: Date.now() } };
    if (c.action === 'lancer') { h.lancers.push(c); h.ordre.push('lancer:' + ((F && F.j.ongletsCrees) || []).length); return o.refus ? { status: 409, body: { message: 'Ces destinataires ont déjà été préparés pour ces articles. Aucun nouvel envoi.' } } : { status: 200, body: { ok: true, uid: UID, vue: vue(['attente', 'attente', 'attente']), carte: { total: 3, envoyes: 0, active: true }, serveur: Date.now() } }; }
    if (c.action === 'arreter') { h.arrets++; h.ordre.push('arreter'); return { status: 200, body: { ok: true, uid: UID, vue: Object.assign(vue(['envoye', 'annule', 'annule']), { active: false }), carte: { total: 3, envoyes: 1, active: false }, serveur: Date.now() } }; }
    return { status: 200, body: { ok: true, uid: UID, serveur: Date.now() } };
  };
  F = faireFond({ src: SRC, connecte: UID, onglets, vrm: h.vrm, store: { vrmFavorisApercu: { [UID]: { at: Date.now() - MIN, etat: 'pret', total: 3, cochables: SEL } } } });
  F.onglets = onglets; F.h = h;
  return F;
}
const lancer = (F, extra) => F.envoyer(Object.assign({ from: 'vrm-badge', action: 'favorisCarte', quoi: 'lancer', uid: UID, selection: SEL, reglages: { version: 1, message: 'Bonjour' }, confirme: true, items: [] }, extra || {}), SENDER);
(async () => {
  console.log('\nO1/O2. « Confirmer l’envoi » ⇒ l’onglet de travail d’abord, puis réutilisé');
  {
    const F = monde();
    const r = await lancer(F);
    const o1 = (F.j.ongletsOptions || [])[0] || {}, cree = (F.j.ongletsCrees || [])[0] || {};
    dit(r && r.ok === true, 'le lancement passe', JSON.stringify(r).slice(0, 200));
    dit((F.j.ongletsCrees || []).length === 1 && o1.active === false && o1.pinned === true && o1.index === 4 && o1.windowId === 1 && /^https:\/\/www\.vinted\.fr\//.test(String(o1.url)), 'un ONGLET vinted.fr épinglé, sans focus, dans SA fenêtre, juste à droite de l’onglet touché', JSON.stringify(o1));
    dit(F.h.ordre[0] === 'lancer:1', 'ouvert AVANT la demande au serveur', JSON.stringify(F.h.ordre));
    dit((F.store.vrmOngletTravail || {}).tabId === cree.id, 'retenu comme onglet de travail', JSON.stringify(F.store.vrmOngletTravail));
    const st = F.store.vrmFavorisCarte || {};
    dit(st.travail === cree.id && Array.isArray(st.jobs) && st.jobs.map((x) => x[0] + ':' + x[1]).join(',') === 'n1:attente,n2:attente,n3:attente', 'O5 · l’état de chaque favori du lot (copie de la file) pour les rangées', JSON.stringify({ t: st.travail, jobs: st.jobs }));
    // O2 : la file finie, un second lancement ⇒ le même onglet
    st.actif = false; st.fin = { at: Date.now(), raison: 'fini' }; F.store.vrmFavorisCarte = st;
    F.store.vrmFavorisApercu = { [UID]: { at: Date.now() - MIN, etat: 'pret', total: 3, cochables: SEL } };   // l'aperçu relu (comme la carte le fait)
    const r2 = await lancer(F);
    dit(r2 && r2.ok === true && (F.j.ongletsCrees || []).length === 1 && (F.store.vrmFavorisCarte || {}).travail === cree.id, 'O2 · le 2e lancement réutilise le même onglet (aucun second)', JSON.stringify({ r2: r2 && r2.ok, n: (F.j.ongletsCrees || []).length }));
  }
  console.log('\nO3. Le serveur refuse la file ⇒ l’onglet reste, la raison est dite (bandeau + rangées)');
  {
    const F = monde({ refus: true });
    let marque = null; const ex = F.ctx.chrome.scripting.executeScript;
    F.ctx.chrome.scripting.executeScript = async (o) => { if (o && Array.isArray(o.args) && typeof o.args[0] === 'string' && o.args[0]) marque = { tab: o.target && o.target.tabId, raison: o.args[0] }; return ex(o); };
    const r = await lancer(F);
    const cree = (F.j.ongletsCrees || [])[0] || {};
    dit(r && r.ok === false && /déjà été préparés/.test(r.raison) && Array.isArray(r.ids) && r.ids.join(',') === SEL.join(',') && r.travail === true, 'la réponse dit la raison du serveur et nomme les favoris concernés', JSON.stringify(r));
    dit(F.onglets.some((t) => t.id === cree.id) && (F.store.vrmOngletTravail || {}).tabId === cree.id, 'l’onglet de travail reste ouvert', '');
    dit(marque && marque.tab === cree.id && /déjà été préparés/.test(marque.raison), 'le bandeau de l’onglet de travail porte la raison', JSON.stringify(marque));
    dit(!F.store.vrmFavorisCarte || !F.store.vrmFavorisCarte.actif, 'aucune file active', JSON.stringify(F.store.vrmFavorisCarte));
  }
  console.log('\nO4. L’onglet de travail fermé pendant l’envoi ⇒ arrêt, dit');
  {
    const F = monde();
    await lancer(F);
    const cree = (F.j.ongletsCrees || [])[0] || {};
    // (26 nov.) Fermé APRÈS le lancement : `travailFermeDepuis` compare `fermeAt > debut` (strict) ; fermé dans la MÊME
    // milliseconde que le lancement (le banc est plus rapide qu'une main), la fermeture ne comptait pas — 1 rouge sur
    // 15 à 40, seul comme en parallèle (mesuré : debut 1795726666944, fermeAt 1795726666944). On attend que l'horloge ait
    // passé `debut`, puis que le fond ait NOTÉ la fermeture (une condition, pas un délai fixe).
    const debut = Number((F.store.vrmFavorisCarte || {}).debut) || 0;
    while (Date.now() <= debut) await new Promise((r) => setTimeout(r, 1));
    const i = F.onglets.findIndex((t) => t.id === cree.id); if (i >= 0) F.onglets.splice(i, 1);
    for (const f of F.j.surFerme || []) f(cree.id, {});
    for (let k = 0; k < 400 && !(F.store.vrmOngletTravail || {}).fermeAt; k++) await new Promise((r) => setTimeout(r, 5));
    await F.ctx.tickFavorisCarte();
    const st = F.store.vrmFavorisCarte || {};
    dit(st.actif === false && st.fin && st.fin.raison === 'travail_ferme' && F.h.arrets === 1, 'la file est arrêtée chez VRM, la fin dit « onglet de travail fermé »', JSON.stringify({ actif: st.actif, fin: st.fin, arrets: F.h.arrets }));
  }
  console.log('\nO7. Sur /inbox, et le voile reposé à chaque page');
  {
    const F = monde();
    await lancer(F);
    const cree = (F.j.ongletsCrees || [])[0] || {};
    dit(/^https:\/\/www\.vinted\.fr\/inbox$/.test(String(cree.url)), 'l’onglet de travail s’ouvre sur vinted.fr/inbox (comme Bleam)', cree.url);
    const n0 = F.j.injections;
    F.ongletMaj(cree.id, { status: 'complete' }, { id: cree.id });
    await new Promise((r) => setTimeout(r, 80));
    const n1 = F.j.injections;
    F.ongletMaj(7, { status: 'complete' }, { id: 7 });
    await new Promise((r) => setTimeout(r, 80));
    dit(n1 === n0 + 1 && F.j.injections === n1, 'une page chargée dans l’onglet de travail ⇒ le voile reposé ; dans un autre onglet ⇒ rien', JSON.stringify({ n0, n1, n2: F.j.injections }));
  }
  console.log('\nO8. « Reprendre » la file restée chez VRM');
  {
    const F = monde();
    const r = await F.envoyer({ from: 'vrm-badge', action: 'favorisCarte', quoi: 'continuer', uid: UID }, SENDER);
    const st = F.store.vrmFavorisCarte || {};
    dit(r && r.ok === true && st.actif === true && (F.j.ongletsCrees || []).length === 1 && st.travail === (F.j.ongletsCrees[0] || {}).id && !F.h.lancers.length && Array.isArray(st.jobs) && st.jobs.length === 3, 'ce navigateur mène la file d’hier (onglet de travail d’abord), rien de neuf n’est lancé', JSON.stringify({ r, actif: st.actif, jobs: st.jobs }));
  }
  console.log('\nO9. « Annuler l’ancienne file et envoyer ces N »');
  {
    const F = monde();
    const r = await lancer(F, { remplacer: true });
    dit(r && r.ok === true && F.h.ordre.join(',') === 'arreter,lancer:1', 'l’ancienne file est arrêtée chez VRM AVANT le lancement', JSON.stringify(F.h.ordre));
  }
  console.log('\nO6. Sans « Confirmer l’envoi » : rien ne s’ouvre');
  {
    const F = monde();
    const r = await lancer(F, { confirme: false });
    dit(r && r.ok === false && !(F.j.ongletsCrees || []).length && !F.h.lancers.length, 'sans confirme, aucun onglet, rien ne part', JSON.stringify(r));
  }
  if (mut) { try { fs.unlinkSync(SRC); } catch (_) {} }
  console.log(`\n${ko ? '❌' : '✅'} audit-onglet-travail : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();

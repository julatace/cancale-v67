// ════════════════════════════════════════════════════════════════════════
//  AUDIT « LE PANNEAU RESTE OUVERT » ET « IMPRIMER LE BORDEREAU » — sur le VRAI background.js (ext. 5.410.2)
//
//  Julien, 20 nov. : « Parfois l'extension se ferme toute seule sur Vinted. » et « Quand j'ai fait une vente, on doit
//  pouvoir imprimer le bordereau, avoir le livreur. »
//  Exécute `panneauEtatCarte` et `bordereauCarte` dans un `vm` (scripts/_fond-vm.cjs), base et stockages à état :
//   A. l'état du panneau est rangé PAR ONGLET, dans chrome.storage.session, et RELU par un service worker NEUF
//      (vm jeté puis refait sur les mêmes stockages — §4.9 : rien en mémoire de module) ; un autre onglet ne le voit
//      pas ; « fermer » l'oublie ; normalisé (page inconnue ⇒ Accueil, ids bornés) ; 12 h au plus ; une autre origine
//      ou un cadre ⇒ refusé ; sans storage.session ⇒ storage.local ;
//   B. le bordereau : le PDF capté (`harvest_{compte}_label_{tx}`) du COMPTE DE L'ONGLET, sinon l'e-mail du bordereau de
//      CE compte (sa version tamponnée d'abord) ; celui d'un autre compte jamais ; une page qui n'est pas un PDF ⇒
//      « manque » ; base muette ⇒ « passu » (jamais « manque ») ; aucune requête vers Vinted, jamais `select=data` ;
//      hors d'un onglet Vinted ⇒ refusé ; plus de 10 ⇒ refusé.
//  `--prouve` : 6 mutations du fond, chacune doit rougir.  `--src <background.js>` : une autre copie (le code d'avant).
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

const PDF = Buffer.from('%PDF-1.4\n' + 'b'.repeat(300) + '\n%%EOF').toString('base64');
const PDF2 = Buffer.from('%PDF-1.7\n' + 't'.repeat(300) + '\n%%EOF').toString('base64');
const HTML = Buffer.from('<html><body>' + 'e'.repeat(300) + '</body></html>').toString('base64');
const TAB = (id, url = 'https://www.vinted.fr/catalog', frameId = 0) => ({ tab: { id, url }, frameId, url });

async function juger(src) {
  const res = [];
  const dit = (bon, quoi, detail) => res.push({ bon: !!bon, quoi, detail });
  const stores = { local: {}, session: {} };
  const fond = (opts = {}) => {
    const lus = [];
    const f = faireFond({ src, store: stores.local, lignes: opts.lignes || {}, lectureKO: (u) => { lus.push(u); return opts.ko ? opts.ko(u) : false; } });
    if (opts.sansSession !== true) {
      const S = stores.session;
      f.ctx.chrome.storage.session = {
        get(k, cb) { const cles = Array.isArray(k) ? k : typeof k === 'string' ? [k] : Object.keys(k || {}); const out = {}; for (const c of cles) if (S[c] !== undefined) out[c] = JSON.parse(JSON.stringify(S[c])); if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set(o, cb) { Object.assign(S, JSON.parse(JSON.stringify(o))); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
      };
    }
    f.ctx.compteConnecte = async () => '111';
    f.lus = lus;
    return f;
  };
  // ── A. l'état du panneau
  let f = fond();
  if (typeof f.ctx.panneauEtatCarte !== 'function') { dit(false, 'A. `panneauEtatCarte` existe dans background.js'); }
  else {
    const etat = { ouvert: true, page: 'ventes', sel: ['7001', 'x y', '7002'], selV: ['91000000001', 'abc'], fiche: 'v:91000000001', conv: '60000', defil: { corps6: 412, ventes: 30, 'mal nommé': 9 } };
    const p = await f.envoyer({ from: 'vrm-badge', action: 'panneauEtat', quoi: 'poser', etat }, TAB(7));
    dit(p && p.ok === true, 'A. poser l’état du panneau de l’onglet 7', JSON.stringify(p));
    dit(stores.session.vrmPanneauEtat && stores.session.vrmPanneauEtat['7'] && !stores.local.vrmPanneauEtat, 'A. rangé dans chrome.storage.session (pas dans storage.local quand session existe)', JSON.stringify(Object.keys(stores.session)));
    f = fond();   // le service worker est tué : un vm NEUF, les mêmes stockages
    const l = await f.envoyer({ from: 'vrm-badge', action: 'panneauEtat', quoi: 'lire' }, TAB(7));
    const e = l && l.etat;
    dit(e && e.ouvert === true && e.page === 'ventes' && JSON.stringify(e.sel) === '["7001","7002"]' && JSON.stringify(e.selV) === '["91000000001"]' && e.fiche === 'v:91000000001' && e.conv === '60000' && e.defil.corps6 === 412 && e.defil['mal nommé'] === undefined,
      'A. un service worker NEUF relit le même état (page, sélections, fiche, conversation, défilement), nettoyé', JSON.stringify(l));
    const autre = await f.envoyer({ from: 'vrm-badge', action: 'panneauEtat', quoi: 'lire' }, TAB(8));
    dit(autre && autre.ok && autre.etat === null, 'A. un autre onglet ne voit pas cet état', JSON.stringify(autre));
    const bad = await f.envoyer({ from: 'vrm-badge', action: 'panneauEtat', quoi: 'poser', etat: { ouvert: true, page: 'pirate', sel: Array.from({ length: 500 }, (_, i) => String(i)) } }, TAB(9));
    const lb = await f.envoyer({ from: 'vrm-badge', action: 'panneauEtat', quoi: 'lire' }, TAB(9));
    dit(bad && bad.ok && lb.etat && lb.etat.page === 'accueil' && lb.etat.sel.length === 200, 'A. page inconnue ⇒ Accueil ; 200 ids au plus', JSON.stringify(lb.etat && { page: lb.etat.page, n: lb.etat.sel.length }));
    const ailleurs = await f.envoyer({ from: 'vrm-badge', action: 'panneauEtat', quoi: 'lire' }, TAB(7, 'https://exemple.com/'));
    const cadre = await f.envoyer({ from: 'vrm-badge', action: 'panneauEtat', quoi: 'lire' }, TAB(7, 'https://www.vinted.fr/', 3));
    dit(ailleurs && ailleurs.code === 'origine' && cadre && cadre.code === 'origine', 'A. une autre origine, un cadre ⇒ refusé', JSON.stringify([ailleurs, cadre]));
    { const x = stores.session.vrmPanneauEtat && stores.session.vrmPanneauEtat['9']; if (x) x.at = Date.now() - 13 * 3600000; }
    const vieux = await f.envoyer({ from: 'vrm-badge', action: 'panneauEtat', quoi: 'lire' }, TAB(9));
    dit(vieux && vieux.ok && vieux.etat === null, 'A. un état de plus de 12 h est oublié', JSON.stringify(vieux));
    const fe = await f.envoyer({ from: 'vrm-badge', action: 'panneauEtat', quoi: 'fermer' }, TAB(7));
    const apres = await fond().envoyer({ from: 'vrm-badge', action: 'panneauEtat', quoi: 'lire' }, TAB(7));
    dit(fe && fe.ok && apres && apres.etat === null, 'A. son × (« fermer ») l’oublie — un worker neuf ne le rouvre pas', JSON.stringify(apres));
    const fl = fond({ sansSession: true });
    await fl.envoyer({ from: 'vrm-badge', action: 'panneauEtat', quoi: 'poser', etat: { ouvert: true, page: 'messages' } }, TAB(11));
    const ll = await fond({ sansSession: true }).envoyer({ from: 'vrm-badge', action: 'panneauEtat', quoi: 'lire' }, TAB(11));
    dit(ll && ll.etat && ll.etat.page === 'messages' && stores.local.vrmPanneauEtat, 'A. sans storage.session (Orion) ⇒ storage.local, relu par un worker neuf', JSON.stringify(ll));
  }
  // ── B. le bordereau
  const lignes = {
    harvest_111_label_9001: { uid: '111', tx: '9001', pdfB64: PDF },
    email_bord_9002: { type: 'bordereau', transaction: '9002', uid: '111', pdfB64: PDF, pdfTamponneB64: PDF2 },
    email_bord_9003: { type: 'bordereau', transaction: '9003', uid: '222', pdfB64: PDF },   // un AUTRE compte
    harvest_222_label_9004: { uid: '222', tx: '9004', pdfB64: PDF },                         // un AUTRE compte
    harvest_111_label_9005: { uid: '111', tx: '9005', pdfB64: HTML },                        // pas un PDF
  };
  f = fond({ lignes });
  if (typeof f.ctx.bordereauCarte !== 'function') dit(false, 'B. `bordereauCarte` existe dans background.js');
  else {
    const r = await f.envoyer({ from: 'vrm-badge', action: 'bordereauCarte', txs: ['9001', '9002', '9003', '9004', '9005', '9006'] }, TAB(7));
    const par = Object.fromEntries(((r && r.pdfs) || []).map((p) => [p.tx, p.b64]));
    dit(r && r.ok && par['9001'] === PDF, 'B. le PDF capté du compte de l’onglet', JSON.stringify(Object.keys(par)));
    dit(par['9002'] === PDF2, 'B. sinon l’e-mail du bordereau de CE compte, sa version tamponnée du N° d’abord');
    dit(!par['9003'] && !par['9004'] && (r.manque || []).includes('9003') && (r.manque || []).includes('9004'), 'B. le bordereau d’un AUTRE compte n’est jamais donné', JSON.stringify(r && r.manque));
    dit(!par['9005'] && (r.manque || []).includes('9005'), 'B. une page qui n’est pas un PDF ⇒ « pas encore de bordereau »');
    dit((r.manque || []).includes('9006'), 'B. aucun bordereau rangé ⇒ « pas encore de bordereau »');
    dit(f.j.vinted.length === 0, 'B. aucune requête vers Vinted', String(f.j.vinted.length));
    const lourdes = f.lus.filter((u) => /select=(?:[^&]*,)?data(?:[,&]|$)/.test(u));
    dit(!lourdes.length && f.lus.some((u) => /select=pdf:data->>pdfB64/.test(u)), 'B. jamais `select=data` : la projection du seul champ du PDF', JSON.stringify(lourdes));
    const fk = fond({ lignes, ko: (u) => /label_9001/.test(u) });
    const rk = await fk.envoyer({ from: 'vrm-badge', action: 'bordereauCarte', txs: ['9001'] }, TAB(7));
    dit(rk && rk.ok && (rk.passu || []).includes('9001') && !(rk.manque || []).includes('9001'), 'B. la base muette ⇒ « pas su », jamais « pas encore de bordereau »', JSON.stringify(rk));
    const lbc = await f.envoyer({ from: 'vrm-badge', action: 'bordereauCarte', txs: ['9001'] }, TAB(7, 'https://www.leboncoin.fr/'));
    const trop = await f.envoyer({ from: 'vrm-badge', action: 'bordereauCarte', txs: Array.from({ length: 11 }, (_, i) => String(9100 + i)) }, TAB(7));
    dit(lbc && lbc.ok === false && lbc.code === 'origine' && trop && trop.ok === false, 'B. hors d’un onglet Vinted ⇒ refusé ; plus de 10 ⇒ refusé', JSON.stringify([lbc, trop]));
  }
  return res;
}

const MUTATIONS = [
  ['l’état n’est plus par onglet', (s) => s.replace("const maintenant = Date.now(), k = String(tab.id);", "const maintenant = Date.now(), k = '0';")],
  ['l’état en mémoire de module (perdu quand le worker meurt)', (s) => s.replace("function zonePanneauEtat() {", "const _memPanneau = {}; function zonePanneauEtat() { return { get: async (k) => ({ [k]: _memPanneau[k] }), set: async (o) => { Object.assign(_memPanneau, o); } };")],
  ['« fermer » n’oublie plus', (s) => s.replace("else if (msg.quoi === 'fermer') delete tout[k];", "else if (msg.quoi === 'fermer') void 0;")],
  ['l’e-mail d’un autre compte accepté', (s) => s.replace("b64 = l && !(l.uid && String(l.uid) !== u) ?", "b64 = l ?")],
  ['une page HTML prise pour un PDF', (s) => s.replace("b64.length > 100 && b64.startsWith('JVBERi0');", "b64.length > 100;")],
  ['hors de Vinted accepté', (s) => s.replace("if (!o || o.fenetre || plateformeDe(o.url) !== 'vinted') return { ok: false, code: 'origine' };", "if (!o) return { ok: false, code: 'origine' };")],
];

(async () => {
  const src = cheminSource();
  const out = await juger(src);
  let ko = 0;
  for (const r of out) { if (!r.bon) ko++; console.log(`  ${r.bon ? '✅' : '❌'} ${r.quoi}${!r.bon && r.detail ? ' — ' + String(r.detail).slice(0, 240) : ''}`); }
  console.log(`\n${out.length - ko} ✅ · ${ko} ❌`);
  if (process.argv.includes('--prouve')) {
    const base = fs.readFileSync(src, 'utf8');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-panneau-'));
    let rouges = 0;
    for (const [nom, m] of MUTATIONS) {
      const mut = m(base);
      if (mut === base) { console.log(`  ⚠️ mutation sans effet : ${nom}`); continue; }
      const p = path.join(dir, 'background.js'); fs.writeFileSync(p, mut);
      const r = await juger(p);
      const rouge = r.some((x) => !x.bon);
      if (rouge) rouges++;
      console.log(`  ${rouge ? '🟥' : '⬜'} mutation « ${nom} » ${rouge ? 'rougit' : 'NE ROUGIT PAS'}`);
    }
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`\nmutations : ${rouges}/${MUTATIONS.length} rouges`);
    if (rouges !== MUTATIONS.length) ko++;
  }
  process.exit(ko ? 1 : 0);
})();

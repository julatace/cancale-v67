// ════════════════════════════════════════════════════════════════════════
//  AUDIT — UNE VENTE VESTIAIRE ⇒ SON ANNONCE VINTED MASQUÉE (21 nov., lot vestiaire-messages)
//  Julien : « j'ai déjà mis des annonces aujourd'hui sur Vestiaire, prépare les ventes ».
//  La chaîne ENTIÈRE, avec les vraies règles :
//    vc_ventes (lu par l'extension) → retraitsVestiaire (api/_lib/vestiaire-regle.js, N° par IDENTITÉ :
//    lien VRM, référence « VRM-n° », annonce créée par VRM — jamais le titre) → articlesVendusAilleurs
//    (src/bilanSynchronisation.js) → listeMasquerAilleurs (src/reglesAuto.js, publiée dans
//    `vinted_masquer_ailleurs`) → le VRAI background.js (scripts/_fond-vm.cjs) : masquerAilleursTick
//    masque l'annonce Vinted du compte de L'ONGLET, geste appris seulement, PUT is_hidden (jamais DELETE).
//  Contrôles :
//    V1 une vente Vestiaire reliée au N° 12 ⇒ l'annonce Vinted N° 12 dans la liste (site « Vestiaire ») ;
//    V2 50 annonces Vinted au MÊME titre, la vente Vestiaire au même titre sans identité ⇒ rien, et nommée ;
//    V3 vente Vestiaire annulée ⇒ rien (et un démasquage possible : la liste ne la porte plus) ;
//    V4 un autre N° ⇒ rien ; V5 la référence « VRM-12 » lue sur la vente (`ref` = 12, sans lien) suffit ;
//    F1 le fond masque l'annonce (PUT /api/v2/items/{id}/is_hidden {is_hidden:true}), aucune suppression ;
//    F2 l'onglet sur un AUTRE compte Vinted ⇒ rien ne part ; F3 geste jamais appris ⇒ rien ne part.
//  `--prouve` : chaque mutation doit rougir.
//  Aucune donnée réelle : tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const { faireFond } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');
const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
const H = 3600000, J = 864e5;
const MOI = '0b0b0b0b-0000-4000-8000-00000000000b';
const UID = '111', UID2 = '222';
const iso = (t) => new Date(t).toISOString();

// Les modules ESM dans un dossier à part (pour les mutations) : api/_lib entier + les deux fichiers de src.
async function chargerRegles(mut = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-ailleurs-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  fs.mkdirSync(path.join(dir, 'api', '_lib'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  const lib = path.join(RACINE, 'api', '_lib');
  for (const f of fs.readdirSync(lib)) if (f.endsWith('.js')) {
    let t = fs.readFileSync(path.join(lib, f), 'utf8');
    if (mut[f]) t = mut[f](t);
    fs.writeFileSync(path.join(dir, 'api', '_lib', f), t);
  }
  // api/_lib lit aussi des fichiers de src : tout src (les .js), puis les deux fichiers jugés par-dessus.
  fs.cpSync(path.join(RACINE, 'src'), path.join(dir, 'src'), { recursive: true, filter: (s) => fs.statSync(s).isDirectory() || s.endsWith('.js') });
  for (const f of ['bilanSynchronisation.js', 'reglesAuto.js']) {
    let t = fs.readFileSync(path.join(RACINE, 'src', f), 'utf8');
    if (mut[f]) t = mut[f](t);
    fs.writeFileSync(path.join(dir, 'src', f), t);
  }
  const vc = await import(pathToFileURL(path.join(dir, 'api', '_lib', 'vestiaire-regle.js')).href);
  const bs = await import(pathToFileURL(path.join(dir, 'src', 'bilanSynchronisation.js')).href);
  const ra = await import(pathToFileURL(path.join(dir, 'src', 'reglesAuto.js')).href);
  return { vc, bs, ra, dir };
}

// Ce que `chargerRetraitsMulti` (App.jsx) assemble : les fiches, les annonces Vinted, puis la part Vestiaire.
function donnees(R, { ventesVc, listings, vinted }) {
  const numeros = {}, annonces = [], ventes = [], manques = [];
  for (const a of vinted) { numeros[a.id] = { numero: a.numero, accountId: a.compte }; annonces.push({ id: a.id, numero: a.numero, plateforme: 'Vinted', compte: a.compte, titre: a.titre, active: true }); }
  const rv = R.vc.retraitsVestiaire({ lst: listings, ventes: ventesVc });
  annonces.push(...rv.annonces); ventes.push(...rv.ventes); manques.push(...rv.manques);
  return { numeros, annonces, ventes, manques, memes: [] };
}
const liste = (R, d) => R.ra.listeMasquerAilleurs(d, R.bs.articlesVendusAilleurs(d));

const T0 = Date.now();
const LST = (o = {}) => Object.assign({ capturedAt: iso(T0 - 10 * 60000), complet: true, liens: { 71000001: '12' }, items: {
  71000001: { titre: 'Nike Dunk Low Panda', statut: 'sold', compte: '55554444', prix: { valeur: 120, devise: 'EUR', cle: 'price' } } } }, o);
const VENTE = (o = {}) => Object.assign({ productId: '71000001', aExpedier: true, etat: 'ACTION_NEEDED', titre: 'Nike Dunk Low Panda', date: iso(T0 - 2 * H), compte: '55554444' }, o);
const A12 = '91030012';
const VINTED = [{ id: A12, numero: '12', compte: UID, titre: 'Nike Dunk Low Panda' }];

async function fond({ src, items, appris = true, connecte = UID, listeMasq }) {
  const st = {};
  st.vrmSession = { access_token: 'jeton.vrm.banc', refresh_token: 'rt', expires_at: Date.now() + H, user_id: MOI, email: 'banc@exemple.fr' };
  st.vrmCloisonne = true;
  const lignes = {
    main: { vrm_securite_comptes: { plateformes: { vinted: { repos: { actif: false } } } }, vinted_masquer_ailleurs: listeMasq },
    [`harvest_${UID}_listings`]: { capturedAt: iso(Date.now() - 10 * 60000), payload: { items } },
    [`harvest_${UID2}_listings`]: { capturedAt: iso(Date.now() - 10 * 60000), payload: { items } },
  };
  if (appris) lignes[`harvest_${UID2}_wreq_api_v2_items_id_is_hidden`] = { uid: UID2, method: 'PUT', path: '/api/v2/items/10432215694/is_hidden', body: '{"is_hidden":true}', capturedAt: iso(Date.now() - 5 * J) };
  const vinted = (e) => {
    const h = /^\/api\/v2\/items\/(\d+)\/is_hidden$/.exec(e.chemin);
    if (h && e.methode === 'PUT') { let v = null; try { v = JSON.parse(e.corps).is_hidden; } catch (_) {} return { status: 200, body: { item: { id: Number(h[1]), is_hidden: v } } }; }
    return { status: 404, body: {} };
  };
  const comptes = [{ vinted_user_id: UID, login: 'compte_un', domain: 'www.vinted.fr', access_token: 'j1' }, { vinted_user_id: UID2, login: 'compte_deux', domain: 'www.vinted.fr', access_token: 'j2' }];
  const f = faireFond({ src, lignes, store: st, vinted, connecte, comptes });
  f.ctx.activeAccountId = async () => connecte;
  f.ctx.activeUidForDomain = async () => connecte;
  const r = typeof f.ctx.masquerAilleursTick === 'function' ? await f.ctx.masquerAilleursTick('banc') : { absent: true };
  return { r, appels: f.j.vinted.map((v) => ({ m: v.methode, c: v.chemin, corps: v.corps })) };
}
const itemV = (id, o = {}) => Object.assign({ id: Number(id), title: 'Nike Dunk Low Panda', price: { amount: '99', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false }, o);

async function controles({ mut = {}, src = BG } = {}) {
  const res = [];
  const dit = (ok, m, d) => res.push({ ok: !!ok, m, d: d == null ? '' : (typeof d === 'string' ? d : JSON.stringify(d)) });
  let R;
  try { R = await chargerRegles(mut); } catch (e) { dit(false, 'les règles se chargent', String(e && e.message)); return res; }
  try {
    // V1
    const l1 = liste(R, donnees(R, { ventesVc: { V1: VENTE() }, listings: LST(), vinted: VINTED }));
    dit(l1.items.length === 1 && l1.items[0].id === A12 && l1.items[0].uid === UID && l1.items[0].site === 'Vestiaire', 'V1 vente Vestiaire reliée au N° 12 ⇒ l’annonce Vinted N° 12 à masquer (site « Vestiaire »)', l1.items);
    // V2 : 50 annonces Vinted identiques, la vente Vestiaire sans identité.
    const v50 = Array.from({ length: 50 }, (_, i) => ({ id: String(91040000 + i), numero: String(200 + i), compte: UID, titre: 'Nike Dunk Low Panda' }));
    const d2 = donnees(R, { ventesVc: { V1: VENTE({ productId: '71000077' }) }, listings: LST({ liens: {}, items: { 71000077: { titre: 'Nike Dunk Low Panda', statut: 'sold' } } }), vinted: v50 });
    const l2 = liste(R, d2);
    dit(l2.items.length === 0 && d2.manques.some((m) => /sans référence VRM/.test(m)) && l2.complet === false, 'V2 50 annonces Vinted au même titre, vente Vestiaire sans identité ⇒ AUCUNE masquée, la vente est nommée, liste « pas complète »', { items: l2.items.length, manques: d2.manques });
    // V3 : annulée
    const l3 = liste(R, donnees(R, { ventesVc: { V1: VENTE({ aExpedier: false, etat: 'CANCELLED' }) }, listings: LST(), vinted: VINTED }));
    dit(l3.items.length === 0, 'V3 vente Vestiaire annulée ⇒ l’annonce Vinted n’est pas (plus) à masquer', l3.items);
    // V4 : autre N°
    const l4 = liste(R, donnees(R, { ventesVc: { V1: VENTE() }, listings: LST({ liens: { 71000001: '13' } }), vinted: VINTED }));
    dit(l4.items.length === 0, 'V4 la vente Vestiaire porte le N° 13 ⇒ l’annonce Vinted N° 12 reste en vue', l4.items);
    // V5 : la référence VRM-12 de la vente (sans lien) suffit
    const l5 = liste(R, donnees(R, { ventesVc: { V1: VENTE({ ref: '12' }) }, listings: LST({ liens: {} }), vinted: VINTED }));
    dit(l5.items.length === 1 && l5.items[0].id === A12, 'V5 la référence « VRM-12 » lue sur la vente Vestiaire (ref 12, sans lien) est une identité : masquée', l5.items);
    // F : le vrai fond
    const lm = Object.assign({}, l1, { at: Date.now() - 60000 });
    const f1 = await fond({ src, items: [itemV(A12)], listeMasq: lm });
    const put = f1.appels.filter((a) => a.m === 'PUT' && a.c === `/api/v2/items/${A12}/is_hidden`);
    dit(put.length === 1 && /"is_hidden":true/.test(put[0].corps || '') && !f1.appels.some((a) => a.m === 'DELETE'), 'F1 le VRAI fond masque l’annonce Vinted (PUT is_hidden true), aucune suppression', { r: f1.r, appels: f1.appels });
    const f2 = await fond({ src, items: [itemV(A12)], listeMasq: lm, connecte: UID2 });
    dit(!f2.appels.some((a) => a.m === 'PUT'), 'F2 l’onglet est sur un AUTRE compte Vinted ⇒ rien ne part', { r: f2.r, appels: f2.appels });
    const f3 = await fond({ src, items: [itemV(A12)], listeMasq: lm, appris: false });
    dit(!f3.appels.some((a) => a.m === 'PUT') && f3.r && f3.r.saute === 'pas-appris', 'F3 le geste « masquer » jamais appris ⇒ rien ne part, et c’est dit', { r: f3.r });
  } finally { try { fs.rmSync(R.dir, { recursive: true, force: true }); } catch (_) {} }
  return res;
}

(async () => {
  const res = await controles();
  for (const r of res) console.log(`${r.ok ? '✅' : '❌'} ${r.m}${r.ok ? '' : ' — ' + r.d}`);
  const rouges = res.filter((r) => !r.ok).length;
  if (process.argv.includes('--prouve')) {
    const remplace = (a, b) => (t) => { if (!t.includes(a)) throw new Error('mutation introuvable : ' + a.slice(0, 60)); return t.split(a).join(b); };
    const MUT = [
      ['annulée comptée', { 'vestiaire-regle.js': remplace('if (!objet(v) || vcVenteAnnulee(v)) continue;\n    const num = numVcVente', 'if (!objet(v)) continue;\n    const num = numVcVente') }],
      ['titre pris pour identité', { 'vestiaire-regle.js': remplace("export const numVcVente = (v, liens, auto) => cleNum(", "export const numVcVente = (v, liens, auto) => (v && v.titre ? 'X' : '') || cleNum(") , 'bilanSynchronisation.js': remplace('const groupeUn = (n) => {\n    if (!n) return null;', 'const groupeUn = (n) => {\n    if (n === "X") return n;\n    if (!n) return null;') }],
      ['ventes ailleurs ignorées', { 'reglesAuto.js': remplace("v.plateforme && v.plateforme !== 'Vinted'", "v.plateforme && v.plateforme === 'eBay'") }],
      ['N° pas comparé', { 'bilanSynchronisation.js': remplace('(v.plateforme !== a.plateforme && croise(groupe(v.numero), n))', '(v.plateforme !== a.plateforme)') }],
    ];
    let tenu = 0;
    for (const [nom, mut] of MUT) {
      let r2; try { r2 = await controles({ mut }); } catch (e) { r2 = [{ ok: false, m: 'a levé ' + e.message }]; }
      const rouge = r2.some((x) => !x.ok);
      console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ${rouge ? 'rougit' : 'NE ROUGIT PAS'}`);
      if (rouge) tenu++;
    }
    // Le fond : le compte de l'onglet ignoré, le geste appris ignoré.
    const bg = fs.readFileSync(BG, 'utf8');
    const MUTF = [
      ['compte de l’onglet ignoré', bg.replace("if (!e || typeof e !== 'object' || !/^\\d{4,15}$/.test(String(e.id)) || String(e.uid) !== u) continue;\n    dans.add", "if (!e || typeof e !== 'object' || !/^\\d{4,15}$/.test(String(e.id))) continue;\n    dans.add").replace("const stop = await gardeStricte(uid, acc, { reserve: RESERVE_GESTES, recu, sorte: 'masquer'", "const stop = null && await gardeStricte(uid, acc, { reserve: RESERVE_GESTES, recu, sorte: 'masquer'")],
      ['geste pas appris ignoré', bg.replace("if (!masquerAppris(wr)) { await noterAppris(false);", "if (false) { await noterAppris(false);")],
    ];
    for (const [nom, texte] of MUTF) {
      if (texte === bg) { console.log(`❌ mutation « ${nom} » introuvable`); continue; }
      const p = path.join(os.tmpdir(), `bg-vc-ailleurs-${process.pid}.js`); fs.writeFileSync(p, texte);
      let r2; try { r2 = await controles({ src: p }); } catch (e) { r2 = [{ ok: false }]; }
      fs.rmSync(p, { force: true });
      const rouge = r2.some((x) => !x.ok);
      console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ${rouge ? 'rougit' : 'NE ROUGIT PAS'}`);
      if (rouge) tenu++;
    }
    if (tenu !== MUT.length + MUTF.length) { console.log(`❌ ${MUT.length + MUTF.length - tenu} mutation(s) ne rougissent pas`); process.exit(1); }
  }
  console.log(rouges ? `❌ ${rouges} contrôle(s) rouge(s)` : '✅ vente Vestiaire ⇒ annonce Vinted masquée : tout est vert');
  process.exit(rouges ? 1 : 0);
})();

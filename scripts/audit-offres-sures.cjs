// ════════════════════════════════════════════════════════════════════════════
//  OFFRES AUTOMATIQUES « SÛRES » — l'écran et l'anti-blocage (11 nov., lot DJ8)
//
//  A. La règle de l'aperçu (src/offresSures.js) EXÉCUTÉE : seuils lus comme le
//     moteur (« 45,5 » ignoré par l'extension), écriture normalisée, décision par
//     offre, aperçu, historique (identité du compte prise sur la ligne, piège du
//     LIKE), alerte avant le plafond, journée calme après un frein.
//  B. LA MÊME DÉCISION QUE LE VRAI MOTEUR : chaque cas de la table est joué par
//     `autoAccepterOffres` de background.js (vm, faux Vinted qui compte) ET par
//     `decisionMoteur` ; accepter ⇔ un PUT …/accept, refuser ⇔ un PUT …/reject,
//     tout le reste ⇔ rien. Un écart = l'écran ment sur ce qui partira.
//  C. Le branchement : l'écran est dans Favoris & offres, la carte d'annonce écrit
//     des seuils lisibles, l'écran n'envoie RIEN chez Vinted, « Tout arrêter »
//     n'emploie que des actions qui ÉTEIGNENT.
//
//  --prouve : mutations (chacune doit rendre un rouge) ; --src dossier : l'audit
//  sur un autre arbre (origin/main : le module n'existe pas ⇒ rouge).
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os'), url = require('url');
const { faireFond } = require('./_fond-vm.cjs');

const iSrc = process.argv.indexOf('--src');
const RAC = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const F = {
  regle: path.join(RAC, 'src', 'offresSures.js'),
  ecran: path.join(RAC, 'src', 'OffresAuto.jsx'),
  app: path.join(RAC, 'src', 'App.jsx'),
  garde: path.join(RAC, 'src', 'offresGarde.js'),
  bg: path.join(RAC, 'vinted-sync-extension', 'background.js'),
};
const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const MUTATIONS = {
  virgule_lue: { f: 'regle', m: (s) => s.replace("  const n = Number(v);\n  return Number.isFinite(n) && n > 0 ? n : null;\n}\n// Ce que l'écran", "  const n = Number(String(v).replace(',', '.'));\n  return Number.isFinite(n) && n > 0 ? n : null;\n}\n// Ce que l'écran") },
  ecriture_brute: { f: 'regle', m: (s) => s.replace('  return String(Math.round(n * 100) / 100);', '  return brut;') },
  refus_avant_accept: { f: 'regle', m: (s) => s.replace("  if (refuse != null && prix < refuse) return { quoi: 'refuser', raison: '', refuse };\n", '').replace("  const min = seuilMoteur(f.min), refuse = seuilMoteur(f.refuse);\n", "  const min = seuilMoteur(f.min), refuse = seuilMoteur(f.refuse);\n  if (refuse != null && prix < refuse) return { quoi: 'refuser', raison: '', refuse };\n") },
  sans_garde: { f: 'regle', m: (s) => s.replace("    const r = gardeRefuse(garde, item, maintenant);\n", "    const r = null;\n") },
  strict_mini: { f: 'regle', m: (s) => s.replace('if (min != null && prix >= min) {', 'if (min != null && prix > min) {') },
  achat_compte: { f: 'regle', m: (s) => s.replace("    if (!o || o.side === 'buyer') continue;\n", '    if (!o) continue;\n') },
  like_piege: { f: 'regle', m: (s) => s.replace("/^journal_vrm_(\\d{1,20})_[A-Za-z0-9-]{1,64}$/", "/^journal_vrm_(\\d{1,20})/") },
  journal_tout: { f: 'regle', m: (s) => s.replace("      if (!e || !SORTES_OFFRE[e.s]) continue;\n", '      if (!e) continue;\n') },
  rate_vaut_vide: { f: 'regle', m: (s) => s.replace('  if (!Array.isArray(rows)) return null;\n  const vus', '  if (!Array.isArray(rows)) return [];\n  const vus') },
  plafond_tard: { f: 'regle', m: (s) => s.replace('export const PLAFOND_PROCHE = 40;', 'export const PLAFOND_PROCHE = 50;') },
  calme_oublie: { f: 'regle', m: (s) => s.replace('  if (maintenant - dernier >= CALME_MS) return null;', '  if (maintenant - dernier >= 60000) return null;') },
  carte_brute: { f: 'app', m: (s) => s.replace('onCommit={v=>updatePair(item,{min:montantSeuil(v)})}', 'onCommit={v=>updatePair(item,{min:v})}') },
  carte_refus_brute: { f: 'app', m: (s) => s.replace('onCommit={v=>updatePair(item,{refuse:montantSeuil(v)})}', 'onCommit={v=>updatePair(item,{refuse:v})}') },
  ecran_absent: { f: 'app', m: (s) => s.replace("zoneFav==='offres' && <OffresAuto ", "zoneFav==='offres' && false && <OffresAuto ") },
  ecran_envoie: { f: 'ecran', m: (s) => s.replace("eteindreOffres && eteindreOffres();", "eteindreOffres && eteindreOffres(); vmrCmd({ cmd: 'accepterOffre' });") },
  arret_allume: { f: 'ecran', m: (s) => s.replace("JSON.stringify({ action: 'auto_stop' })", "JSON.stringify({ action: 'auto_regler' })") },
  // 5.342 — le vrai moteur réaffaibli :
  ext_virgule_ignoree: { f: 'bg', m: (s) => s.replace("const t = String(v).replace(/\\s|€/g, '').replace(',', '.');", "const t = String(v);") },
  ext_depuis_le_fond: { f: 'bg', m: (s) => s.replace("const r = await vintedPage(acc, 'PUT', chemin, null, { timeoutMs: 12000 });", "const r = await vintedSend(acc, 'PUT', chemin, null);") },
  ext_sans_onglet_faite: { f: 'bg', m: (s) => s.replace("        break;\n      }\n      st[o.oid] = Date.now();", "      }\n      st[o.oid] = Date.now();") },
  ext_frein_ignore: { f: 'bg', m: (s) => s.replace("if (await lireFreinRepub(uid)) { noterDiag('offre_auto_frein'); return 0; }", "") },
  ext_refus_en_serie: { f: 'bg', m: (s) => s.replace("      } else { break; }                                 // garde-fou atteint", "      } else if (r && r.code) { break; }                                 // garde-fou atteint") },
  ext_geste_fond: { f: 'bg', m: (s) => s.replace("const rp = await vintedPage(acc, methode, msg.endpoint, msg.body, { timeoutMs: 12000 });", "const rp = { sansPage: 'onglet' };") },
  ext_geste_bloque: { f: 'bg', m: (s) => s.replace("if (rp && rp.sansPage && !rp.pause) return vintedSend(acc, methode, msg.endpoint, msg.body);", "") },
  ecran_virgule_toujours: { f: 'ecran', m: (s) => s.replace("virgule: virguleLue === true });\n", "virgule: true });\n") },
};

async function chargerRegle(src) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offres-sures-'));
  fs.writeFileSync(path.join(dir, 'offresGarde.js'), src.garde);
  const f = path.join(dir, 'offresSures.mjs');
  fs.writeFileSync(f, src.regle.replace("from './offresGarde.js'", "from './offresGarde.js'"));
  try { return await import(url.pathToFileURL(f).href); } finally { setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }, 2000); }
}

// ── Le VRAI moteur : une offre, son mini/refus, une garde ⇒ ce qui part chez Vinted.
const UID = '111';
const GARDE_OK = () => ({ v: 1, at: Date.now(), items: [], complet: true, manques: [], ambigus: 0 });
function conv({ item, tx, oid, price, user = 500 }) {
  return { capturedAt: new Date().toISOString(), payload: { conversation: {
    id: 'c' + oid, description: 'Paire', opposite_user: { id: user, login: 'acheteur' }, transaction: { item_id: String(item) },
    messages: [{ entity_type: 'offer_request_message', entity: { user_id: user, current: true, status: 10, status_title: '', price: { amount: String(price), currency_code: 'EUR' }, transaction_id: Number(tx), offer_request_id: Number(oid) } }],
  } } };
}
let BG_SRC = null;   // le fond à exécuter (chemin), remplacé par une mutation
async function moteur({ prix, min, refuse, garde, onglets, frein, deux, refusVinted }) {
  const item = 444, tx = 9001, oid = 7001;
  const lignes = { [`harvest_${UID}_conv_${oid}`]: conv({ item, tx, oid, price: prix }) };
  const fiche = { num: '7' }; if (min !== undefined) fiche.min = min; if (refuse !== undefined) fiche.refuse = refuse;
  lignes.main = { capturedAt: new Date().toISOString(), vinted_offres_auto: true, vinted_annonce_numeros: { [String(item)]: fiche }, vinted_offre_refus_msg: '', vrm_securite_comptes: { plateformes: { vinted: { repos: { actif: false } } } } };
  if (deux) lignes[`harvest_${UID}_conv_${oid + 1}`] = conv({ item, tx: tx + 1, oid: oid + 1, price: prix, user: 501 });
  lignes.main.vinted_offres_garde = garde === undefined ? GARDE_OK() : garde;
  const store = frein ? { vrmFreinRepub: { [UID]: { jusqua: Date.now() + 3600000, restreint: false, status: 422, at: Date.now() } } } : {};
  const f = faireFond({ src: BG_SRC || undefined, lignes, store, connecte: UID, ...(onglets ? { onglets } : {}),
    vinted: (e) => (refusVinted && /\/offer_requests\//.test(e.chemin) ? { status: 422, body: { message: 'expired' } } : { status: 200, body: {} }) });
  try { await f.ctx.autoAccepterOffres(UID); } catch (_) {}
  const pv = f.store.vrmOffresPrevues || {}; for (const k in pv) if (pv[k]) pv[k].at = Date.now() - 1000;
  try { await f.ctx.autoAccepterOffres(UID); } catch (_) {}
  const offres = f.j.vinted.filter((v) => v.methode === 'PUT' && /\/offer_requests\/\d+\/(accept|reject)$/.test(v.chemin));
  const acc = offres.filter((v) => /accept$/.test(v.chemin)).length;
  const rej = offres.filter((v) => /reject$/.test(v.chemin)).length;
  const fond = offres.filter((v) => v.origine !== 'page' || Object.keys(v.entetes || {}).some((k) => /^authorization$/i.test(k)) || v.credentials === 'omit').length;
  const faites = Object.keys(f.store.vrmOffresFaites || {}).length, prevues = Object.keys(f.store.vrmOffresPrevues || {}).length;
  return { quoi: acc ? 'accepter' : rej ? 'refuser' : 'rien', n: offres.length, fond, faites, prevues };
}
const CAS = [
  { nom: 'offre = mini', prix: 40, min: '40' },
  { nom: 'offre > mini', prix: 45, min: '40' },
  { nom: 'offre < mini, pas de refus', prix: 35, min: '40' },
  { nom: 'sous le refus', prix: 20, min: '40', refuse: '30' },
  { nom: 'entre refus et mini', prix: 35, min: '40', refuse: '30' },
  { nom: 'refus seul, au-dessus', prix: 35, refuse: '30' },
  { nom: 'refus seul, dessous', prix: 25, refuse: '30' },
  { nom: 'mini à virgule (« 45,5 »)', prix: 50, min: '45,5' },
  { nom: 'mini à point (« 45.5 »)', prix: 50, min: '45.5' },
  { nom: 'refus à virgule', prix: 20, refuse: '30,5' },
  { nom: 'mini vide', prix: 50, min: '' },
  { nom: 'refus ≥ mini : l’acceptation passe d’abord', prix: 45, min: '40', refuse: '50' },
  { nom: 'garde nomme l’annonce', prix: 45, min: '40', garde: { ...GARDE_OK(), items: ['444'] } },
  { nom: 'garde incomplète', prix: 45, min: '40', garde: { ...GARDE_OK(), complet: false } },
  { nom: 'garde absente, refus permis', prix: 20, refuse: '30', garde: null },
  { nom: 'garde absente, acceptation retenue', prix: 45, min: '40', garde: null },
];

async function auditer(src, { parite = true } = {}) {
  const out = []; const dit = (ok, m, d) => out.push({ ok: !!ok, m, d });
  // ── A : la règle, exécutée ──
  let R = null;
  try { R = src.regle ? await chargerRegle(src) : null; } catch (e) { dit(false, 'A0 src/offresSures.js se charge', e.message); }
  dit(!!R, 'A0 la règle de l’écran existe (src/offresSures.js)');
  if (R) {
    dit(R.seuilMoteur('45,5') === null && R.seuilMoteur('45.5') === 45.5 && R.seuilMoteur('') === null && R.seuilMoteur(null) === null && R.seuilMoteur('0') === null, 'A1 extension d’avant 5.342 : « 45,5 » ignoré (comme elle)');
    dit(R.seuilMoteur('45,5', true) === 45.5 && R.seuilMoteur('', true) === null && R.seuilMoteur('abc', true) === null && R.seuilMoteur('0', true) === null, 'A1b extension 5.342 : « 45,5 » lu 45,5 (comme elle)');
    dit(R.montantSeuil('45,5 €') === '45.5' && R.montantSeuil(' 40 ') === '40' && R.montantSeuil('') === '' && R.montantSeuil('abc') === 'abc', 'A2 l’écriture rend un seuil que le moteur lit (« 45,5 € » ⇒ « 45.5 »), illisible gardé tel quel', JSON.stringify([R.montantSeuil('45,5 €'), R.montantSeuil(' 40 '), R.montantSeuil('abc')]));
    const ill = R.seuilsIllisibles({ 1: { min: '45,5' }, 2: { min: '40' }, 3: { refuse: '30,5', min: '50' } });
    dit(ill.length === 2 && ill.some((x) => x.id === '1' && x.champ === 'min') && ill.some((x) => x.id === '3' && x.champ === 'refuse'), 'A3 les seuils affichés mais ignorés par le moteur sont comptés', JSON.stringify(ill));
    const g = { v: 1, at: Date.now(), items: [], complet: true };
    dit(R.decisionMoteur({ prix: 45, item: '1' }, { min: '40' }, g).quoi === 'accepter'
      && R.decisionMoteur({ prix: 45, item: '1' }, { min: '40' }, { ...g, items: ['1'] }).quoi === 'garde'
      && R.decisionMoteur({ prix: 20, item: '1' }, { min: '40', refuse: '30' }, g).quoi === 'refuser'
      && R.decisionMoteur({ prix: 35, item: '1' }, { min: '40', refuse: '30' }, g).quoi === 'toi'
      && R.decisionMoteur({ prix: 35, item: null }, { min: '30' }, g).quoi === 'sans', 'A4 décision par offre : accepter · garde · refuser · à toi · sans (annonce pas identifiée)');
    const off = new Map([['111_1', { prix: 45, item: '9', titre: 'A' }], ['111_2', { prix: 45, item: '9', titre: 'Mon achat', side: 'buyer' }], ['222_3', { prix: 10, item: '8' }], ['bad', { prix: 1 }]]);
    const ap = R.apercuMoteur({ offres: off, numeros: { 9: { min: '40', numero: '12' }, 8: { refuse: '20' } }, garde: g, comptes: new Set(['111', '222']) });
    dit(ap && ap.lignes.length === 2 && ap.accepter === 1 && ap.refuser === 1 && ap.lignes[0].numero === '12' && R.apercuMoteur({ offres: null }) === null && R.apercuMoteur({ offres: undefined }) === undefined, 'A5 aperçu : ses ventes seulement (pas une offre reçue quand il ACHÈTE), « pas su » ⇒ null', JSON.stringify(ap && ap.lignes.map((l) => l.quoi)));
    const rows = [
      { id: 'journal_vrm_111_abcdef0123456789', e: [{ t: 2000, s: 'offre_acceptee', a: '9', x: '55', p: 52, auto: true }, { t: 3000, s: 'baisse_prix', a: '9' }, { t: 1000, s: 'offre_refusee', x: '56', p: 20 }] },
      { id: 'journal_vrm_1111_abcdef0123456789', e: [{ t: 4000, s: 'offre_acceptee', x: '57', p: 60 }] },
      { id: 'journal_vrm_111abc', e: [{ t: 5000, s: 'offre_acceptee', x: '58', p: 61 }] },
    ];
    const h = R.journalOffres(rows, { uids: new Set(['111']) });
    dit(Array.isArray(h) && h.length === 2 && h[0].sorte === 'acceptee' && h[0].auto === true && h[0].prix === 52 && h[1].sorte === 'refusee', 'A6 historique : les offres NOTÉES du compte, jamais celles du compte 1111 (piège du LIKE), ni les autres gestes', JSON.stringify(h));
    dit(R.journalOffres(null) === null && R.journalOffres(undefined) === undefined, 'A7 historique pas lu ⇒ null (« — »), jamais une liste vide');
    dit(R.alertePlafond({ n: 39, max: 50, pourApp: 45 }) === null && (R.alertePlafond({ n: 40, max: 50, pourApp: 45 }) || {}).niveau === 'proche' && (R.alertePlafond({ n: 45, max: 50, pourApp: 45 }) || {}).niveau === 'atteint' && R.alertePlafond(null) === null, 'A8 alerte à 40/50, « VRM attend » à 45 (aucun plafond nouveau)');
    const t0 = 1e12;
    const l1 = R.noterPause([], { jusqua: t0 + 15 * 60000 }, t0);
    const l2 = R.noterPause(l1, { jusqua: t0 + 15 * 60000 }, t0 + 60000);
    dit(l1.length === 1 && l2.length === 1 && R.noterPause(l1, null, t0).length === 1, 'A9 un frein vu est noté UNE fois');
    dit(R.journeeCalme(l1, t0 + 3600000) && !R.journeeCalme(l1, t0 + 25 * 3600000) && R.journeeCalme([], t0) === null, 'A10 journée calme conseillée 24 h après le dernier frein, puis plus rien');
    // ── B : la parité avec le VRAI moteur ──
    if (parite) {
      let fond = 0, n = 0;
      for (const c of CAS) {
        const v = await moteur(c); fond += v.fond; n += v.n;
        const d = R.decisionMoteur({ prix: c.prix, item: '444' }, { min: c.min, refuse: c.refuse }, c.garde === undefined ? GARDE_OK() : c.garde, Date.now(), { virgule: true }).quoi;
        const ecran = d === 'accepter' ? 'accepter' : d === 'refuser' ? 'refuser' : 'rien';
        dit(v.quoi === ecran, `B ${c.nom} : moteur 5.342 « ${v.quoi} », écran « ${d} »`);
      }
      // 5.342 (P1) : chaque réponse part de l'ONGLET vinted.fr, jamais du fond (Bearer, sans cookies).
      dit(n > 0 && fond === 0, `B1 les ${n} réponses du moteur partent de l’onglet vinted.fr (aucune du fond, aucun Authorization)`, { n, fond });
      const sans = await moteur({ prix: 45, min: '40', onglets: [] });
      dit(sans.n === 0 && sans.faites === 0 && sans.prevues === 1, 'B2 sans onglet vinted.fr : rien ne part, l’offre reste prévue (pas « faite »)', sans);
      const fr = await moteur({ prix: 45, min: '40', frein: true });
      dit(fr.n === 0, 'B3 compte freiné par Vinted : le moteur ne répond à aucune offre', fr);
      const serie = await moteur({ prix: 45, min: '40', deux: true, refusVinted: true });
      dit(serie.n === 1, 'B4 un refus de Vinted arrête le passage (pas de refus en série)', serie);
      // 5.342 (P1) : SON geste depuis l'app (répondre) part de l'onglet quand il est ouvert ;
      // sans onglet (téléphone), il part comme avant — un geste humain, un à la fois.
      const geste = async (onglets) => {
        const f = faireFond({ src: BG_SRC || undefined, lignes: { main: { capturedAt: new Date().toISOString() } }, connecte: UID, ...(onglets ? { onglets } : {}), vinted: () => ({ status: 200, body: {} }) });
        let r = null; try { r = await f.ctx.executerPourApp({ uid: UID, method: 'POST', endpoint: '/api/v2/conversations/55/replies', body: { message: 'ok' } }, { origin: 'https://vrm.center' }); } catch (e) { r = { err: e.message }; }
        const w = f.j.vinted.filter((v) => v.methode === 'POST' && /\/replies$/.test(v.chemin));
        return { ok: !!(r && r.ok), n: w.length, origine: w.map((v) => v.origine).join(','), auth: w.some((v) => Object.keys(v.entetes || {}).some((k) => /^authorization$/i.test(k))) };
      };
      const gp = await geste(null), gs = await geste([]);
      dit(gp.ok && gp.n === 1 && gp.origine === 'page' && !gp.auth, 'B5 son geste « Répondre » part de l’onglet vinted.fr quand il est ouvert', gp);
      dit(gs.ok && gs.n === 1 && gs.origine === 'fond', 'B6 sans onglet (téléphone), son geste part quand même, un seul', gs);
    }
  }
  // ── C : le branchement ──
  const app = sansCommentaires(src.app || ''), ecran = sansCommentaires(src.ecran || '');
  dit(/zoneFav==='offres' && <OffresAuto /.test(app) && /options=\{\[\{ v: 'favoris', l: 'Favoris' \}, \{ v: 'offres', l: 'Offres auto' \}\]\}/.test(app), 'C1 Messages → Favoris & offres → « Offres auto » est monté');
  dit(/prendreVue\('offresauto'\)\) \{ setZoneMessages\('favoris'\); setZoneFav\('offres'\); \}/.test(app) && /data-offres-auto-regler="" onClick=\{\(\)=>\{ setAnnToolsOpen\(false\); demanderVue\('offresauto'\);/.test(app), 'C2 la carte d’Annonces → Outils ouvre directement « Offres auto »');
  dit(/<EnLigne data="min" value=\{e\.min\?\?''\} onCommit=\{v=>updatePair\(item,\{min:montantSeuil\(v\)\}\)\}/.test(app) && /<EnLigne data="refuse" value=\{e\.refuse\?\?''\} onCommit=\{v=>updatePair\(item,\{refuse:montantSeuil\(v\)\}\)\}/.test(app), 'C3 la carte d’annonce écrit « Accepter dès » / « Refuser sous » lisibles par le moteur');
  dit(!!ecran && !/vmrCmd|vmrExec|executerCommande|offer_requests|\/api\/v2\//.test(ecran), 'C4 l’écran n’envoie rien chez Vinted (aperçu seulement)');
  const actions = [...ecran.matchAll(/action: '([a-z_]+)'/g)].map((m) => m[1]);
  dit(actions.length >= 2 && actions.every((a) => a === 'auto_stop' || a === 'arreter'), '« Tout arrêter » n’emploie que des actions qui ÉTEIGNENT (auto_stop, arreter)'.replace(/^/, 'C5 '), actions.join(','));
  dit(/basculer=\{basculerOffresAuto\}/.test(app) && /onClick=\{basculer\}/.test(ecran), 'C6 l’interrupteur est LE même (confirmation qui dit le risque, éteint par défaut)');
  dit(/select=id,e:data->e/.test(ecran) && !/select=data[&'`]/.test(ecran), 'C7 l’historique se lit en projection (jamais select=data)');
  dit(/virguleLue=\{extSait\('offrespage'\)==='ok'\}/.test(app) && /apercuMoteur\(\{[^)]*virgule: virguleLue === true \}\)/.test(ecran), 'C8 la virgule n’est lue dans l’aperçu QUE pour une extension 5.342 (capacité offrespage), jamais supposée');
  return out;
}

(async () => {
  const base = { regle: lire(F.regle), ecran: lire(F.ecran), app: lire(F.app), garde: lire(F.garde), bg: lire(F.bg) };
  const bgTmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'offres-sures-bg-')), 'background.js');
  const avecBg = async (bg, fn) => { if (bg === base.bg) { BG_SRC = F.bg; } else { fs.writeFileSync(bgTmp, bg); BG_SRC = bgTmp; } try { return await fn(); } finally { BG_SRC = null; } };
  if (process.argv.includes('--prouve')) {
    let rouges = 0, n = 0;
    for (const [nom, { f, m }] of Object.entries(MUTATIONS)) {
      n++;
      const s = { ...base, [f]: m(base[f]) };
      if (s[f] === base[f]) { console.log(`⚠️  mutation ${nom} : l’ancre ne correspond plus`); continue; }
      let r; try { r = await avecBg(s.bg, () => auditer(s, { parite: true })); } catch (e) { r = [{ ok: false, m: 'plante : ' + e.message }]; }
      const ko = r.filter((x) => !x.ok);
      if (ko.length) rouges++;
      console.log(`${ko.length ? '✅' : '❌'} mutation ${nom} : ${ko.length} rouge(s)${ko.length ? ' — ' + ko[0].m : ''}`);
    }
    console.log(`\n${rouges}/${n} mutations attrapées`);
    process.exit(rouges === n ? 0 : 1);
  }
  let r; try { r = await avecBg(base.bg, () => auditer(base)); } catch (e) { console.log('❌ l’audit plante : ' + e.message); process.exit(1); }
  for (const x of r) console.log(`${x.ok ? '✅' : '❌'} ${x.m}${x.d !== undefined && x.d !== '' && !x.ok ? ' — ' + x.d : ''}`);
  const ko = r.filter((x) => !x.ok).length;
  console.log(ko ? `\n❌ audit-offres-sures : ${ko} rouge(s) sur ${r.length}` : `\n✅ audit-offres-sures : ${r.length} contrôles — l’écran dit ce que le moteur fera, et n’envoie rien`);
  process.exit(ko ? 1 : 0);
})();

// ════════════════════════════════════════════════════════════════════════════
//  « CHANGER LE PRIX » SANS GESTE À LA MAIN (19 nov., extension 5.409) — EXÉCUTÉ
//      node scripts/audit-prix-attente.cjs [--prouve] [--recopie] [--src background.js]
//
//  Julien, capture de son iPhone (N°134, 59 → 58) : « c'est à l'extension de baisser
//  les prix, c'est pas à moi ». Décision du 19 nov. : « Appliquer » est SON clic ; la
//  baisse part par le chemin d'extension existant, ou ATTEND dans sa base (ligne
//  `cmd_prix_*`) qu'un de ses navigateurs ouvre le site sur le bon compte.
//
//  Ce qui tourne ici, jamais une phrase :
//   · la règle de l'app (src/prixPartout.js + src/prixAttente.js), importée ;
//   · le VRAI background.js dans un vm (scripts/_fond-vm.cjs) : faux Vinted qui COMPTE
//     chaque requête, fausse base à état (propriétaire + écriture conditionnelle),
//     `chrome.storage.local` à état.
//
//   A  la règle : baisse Vinted sur « Appliquer » ⇒ UNE commande `baisserPrixVinted`
//      (prix vu joint, confirmée), « fait » seulement RELU ; plus d'état « proposé » ;
//   B  l'extension ne peut pas agir maintenant (absente, autre compte, pas d'onglet,
//      plafond, pause, pas de réponse) ⇒ UNE ligne en attente, pas de second geste ;
//   C  hausse ⇒ aucune commande, aucune ligne ; même prix ⇒ rien ;
//   D  Leboncoin / Vestiaire : le même geste, recette pas apprise ⇒ refus dit, pas d'attente ;
//   E  la forme d'une ligne (`nouvelleCommandePrix`), la vue (`vueCommandePrix` : périmée
//      après 24 h même si personne ne l'a écrit), déposer remplace l'ancienne, annuler ;
//   F  le bloc <prix-attente-regle> de l'extension est la copie exacte de l'app ;
//   G  extension : sans session ⇒ aucune requête ; ligne d'un autre vendeur ⇒ rien ;
//   H  site ouvert sur le bon compte ⇒ prise, GET → PUT → GET, « fait » avec le prix
//      RELU, UNE action comptée ; rejouée (worker redémarré, ligne remise) ⇒ JAMAIS deux fois ;
//   I  autre compte dans l'onglet · pas d'onglet · pause ⇒ la ligne n'est PAS touchée,
//      0 requête Vinted ; exécutée une seule fois au retour du bon compte ;
//   J  périmée (24 h) ⇒ « expirée », 0 requête ; annulée ⇒ jamais relevée ;
//   K  le prix a changé sur Vinted entre-temps ⇒ aucun PUT, refus `prix-change` avec le
//      prix lu ; déjà au prix voulu ⇒ « fait » sans PUT ;
//   L  plafond 45/h ⇒ 0 requête, REMISE en attente (bornée), puis partie quand une place
//      se libère ; hausse ou sans confirmation dans une ligne ⇒ refusée ;
//   M  deux lignes pour la même annonce ⇒ la plus récente seule part ; une par passage ;
//   N  « Tout arrêter » ⇒ refusée et dite, jamais une attente ;
//   O  la feuille (src/PrixPartout.jsx) n'a plus ni « proposé », ni second bouton, ni
//      « Appliquer à nouveau » ; les 5 langues n'ont plus les textes morts.
//  `--prouve` : chaque mutation rougit au moins un contrôle ; sur le code d'origin/main
//  (sans `prixAttenteTick`, Vinted « proposé »), A, B et H sont rouges.
//  Aucune donnée réelle : tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
const F_ATT = path.join(RACINE, 'src', 'prixAttente.js');
const BLOC_RE = /\/\/ <prix-attente-regle>[^\n]*\n([\s\S]*?)\/\/ <\/prix-attente-regle>/;

if (process.argv.includes('--recopie')) {
  const app = fs.readFileSync(F_ATT, 'utf8'), bg = fs.readFileSync(BG, 'utf8');
  const m = BLOC_RE.exec(app);
  if (!m || !BLOC_RE.test(bg)) { console.error('bloc <prix-attente-regle> introuvable'); process.exit(1); }
  fs.writeFileSync(BG, bg.replace(BLOC_RE, () => '// <prix-attente-regle> — COPIE de src/prixAttente.js (scripts/audit-prix-attente.cjs --recopie). Ne pas modifier ici.\n' + m[1] + '// </prix-attente-regle>'));
  console.log('bloc <prix-attente-regle> recopié dans background.js');
  process.exit(0);
}

const { faireFond } = require('./_fond-vm.cjs');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');

// ── LA RÈGLE DE L'APP, importée d'une copie (mutable) ───────────────────────
// `sources` : { 'src/prixPartout.js': texte, 'src/prixAttente.js': texte } — les autres
// modules importés (src/publierPartout.js et les siens) sont copiés tels quels.
async function chargerApp(sources) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prix-attente-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  const faits = new Set();
  const copier = (rel) => {
    if (faits.has(rel)) return; faits.add(rel);
    const txt = sources[rel] != null ? sources[rel] : lire(rel);
    const dest = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, txt);
    for (const m of txt.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"\n]*?from\s+['"](\.{1,2}\/[^'"]+\.js)['"]/g)) copier(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])));
  };
  copier('src/prixPartout.js'); copier('src/prixAttente.js');
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  try {
    const P = await import(pathToFileURL(path.join(dir, 'src', 'prixPartout.js')).href);
    let A = null; try { A = await import(pathToFileURL(path.join(dir, 'src', 'prixAttente.js')).href); } catch (_) { A = null; }
    return { P, A };
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
}

// ── L'EXTENSION : le vrai background.js, une base qui connaît le propriétaire ──
const MOI = '0b0b0b0b-0000-4000-8000-00000000000a', AUTRE = '0c0c0c0c-0000-4000-8000-00000000000b';
const UID = '111', UID2 = '222', ID = '91010001', ID2 = '91010002';
const H = 3600000;
const corpsAnnonce = (id, prix, titre = 'Nike P-6000 noire') => ({ item: { id: Number(id), title: titre, description: 'Très bon état', price: { amount: String(prix), currency_code: 'EUR' }, catalog_id: 1234, assigned_photos: [{ id: 501, orientation: 0 }, { id: 502, orientation: 0 }] } });
const lueAnnonce = (id, prix, titre = 'Nike P-6000 noire') => ({ item: { id: Number(id), title: titre, description: 'Très bon état', price: { amount: String(prix), currency_code: 'EUR' }, photos: [{ id: 501 }, { id: 502 }] } });
let seq = 0;
const ligneCmd = ({ id = ID, uid = UID, prix = 58, prixAvant = 59, il_y_a = 5000, owner = MOI, pour = MOI, site = 'vinted', extra = {} } = {}) => {
  const t = Date.now() - il_y_a;
  const args = site === 'vinted' ? { uid, id, prix, prixAvant } : { id, prix, prixAvant };
  return { id: 'cmd_prix_' + (t + (seq++)).toString(36) + 'banc' + String(seq).padStart(4, '0'), owner,
    data: Object.assign({ v: 1, site, args, confirme: true, pour, demandeLe: t, expire: t + 24 * H, etat: 'attente', reports: 0, cle: site + ':' + id, prix, prixAvant, num: '134' }, extra) };
};
function monterExt({ src, lignesCmd = [], session = true, connecte = UID, prixVinted = { [ID]: 59, [ID2]: 80 }, actions = 0, onglets, lectureFileKO = false, store = null } = {}) {
  const st = store || {};
  if (session) st.vrmSession = { access_token: 'jeton.vrm.banc', refresh_token: 'rt', expires_at: Date.now() + H, user_id: MOI, email: 'banc@exemple.fr' };
  else { delete st.vrmSession; st.__sansSession = true; }
  st.vrmCloisonne = true;
  if (actions) { const t = Date.now() - 60000; st.vrmActions = { [UID]: Array.from({ length: actions }, (_, i) => t + i) }; }
  const lignes = {};
  for (const id of [ID, ID2]) { lignes[`coffre_${UID}_${id}`] = { id, photos: ['a', 'b'] }; }
  lignes.vrm_vinted_modele = { [ID]: { corps: JSON.stringify(corpsAnnonce(ID, 59)), at: new Date().toISOString(), uid: UID }, [ID2]: { corps: JSON.stringify(corpsAnnonce(ID2, 80)), at: new Date().toISOString(), uid: UID } };
  const prix = Object.assign({}, prixVinted);
  const etat = { connecte };
  const vinted = (e) => {
    const m = /^\/api\/v2\/item_upload\/items\/(\d+)$/.exec(e.chemin);
    if (!m || prix[m[1]] === undefined) return { status: 404, body: {} };
    if (e.methode === 'GET') return { status: 200, body: lueAnnonce(m[1], prix[m[1]]) };
    if (e.methode === 'PUT') { try { prix[m[1]] = Number(JSON.parse(e.corps).item.price.amount); } catch (_) {} return { status: 200, body: {} }; }
    return { status: 404, body: {} };
  };
  const comptes = [{ vinted_user_id: UID, login: 'compte_un', domain: 'www.vinted.fr', access_token: 'j1' }, { vinted_user_id: UID2, login: 'compte_deux', domain: 'www.vinted.fr', access_token: 'j2' }];
  const f = faireFond({ src, lignes, store: st, vinted, connecte, comptes, ...(onglets ? { onglets } : {}) });
  f.ctx.activeAccountId = async () => etat.connecte;
  f.ctx.activeUidForDomain = async () => etat.connecte;
  const table = {};
  for (const r of lignesCmd) table[r.id] = JSON.parse(JSON.stringify(r));
  const reseau = { base: 0, patch: [], lectures: 0 };
  const orig = f.ctx.fetch;
  const rep = (status, body) => ({ ok: status >= 200 && status < 400, status, headers: { get: () => 'application/json' }, json: async () => body, text: async () => JSON.stringify(body) });
  f.ctx.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    if (/\/rest\/v1\//.test(u)) reseau.base++;
    const m = (opts.method || 'GET').toUpperCase();
    if (/\/rest\/v1\/app_data\?/.test(u) && /cmd_prix_/.test(u)) {
      const eq = /[?&]id=eq\.([^&]+)/.exec(u), like = /[?&]id=like\.cmd_prix_/.test(u);
      if (m === 'GET') {
        reseau.lectures++;
        if (like && lectureFileKO) return rep(522, '<html>522</html>');
        let rows = like ? Object.values(table) : (eq && table[eq[1]] ? [table[eq[1]]] : []);
        if (/meta->>etat=eq\.attente/.test(u)) rows = rows.filter((r) => r.data.etat === 'attente');
        rows.sort((a, b) => a.id.localeCompare(b.id));
        const lim = /[?&]limit=(\d+)/.exec(u); if (lim) rows = rows.slice(0, Number(lim[1]));
        return rep(200, rows.map((r) => ({ id: r.id, owner: r.owner, data: JSON.parse(JSON.stringify(r.data)) })));
      }
      if (m === 'PATCH') {
        const own = (/[?&]owner=eq\.([^&]+)/.exec(u) || [])[1];
        const cond = (/meta->>etat=eq\.([^&]+)/.exec(u) || [])[1];
        const r = eq && table[eq[1]];
        let corps = {}; try { corps = JSON.parse(opts.body || '{}'); } catch (_) {}
        reseau.patch.push({ id: eq && eq[1], cond: cond || null, etat: corps.data && corps.data.etat });
        if (!r || (own && r.owner !== own) || (cond && r.data.etat !== cond)) return rep(200, []);
        r.data = corps.data;
        return rep(200, [{ id: r.id }]);
      }
    }
    return orig(url, opts);
  };
  return Object.assign(f, { table, reseau, prix, etat });
}
const tick = async (f) => (typeof f.ctx.prixAttenteTick === 'function' ? f.ctx.prixAttenteTick('banc') : { absent: true });
const puts = (f) => f.j.vinted.filter((v) => v.methode === 'PUT');
const actionsDe = (f) => ((f.store.vrmActions || {})[UID] || []).filter((x) => Date.now() - x < H).length;
const sansEspace = (f) => { delete f.store.vrmPrixAttSuivant; };

async function controles({ bg, sources = {} }) {
  const res = [];
  const dit = (ok, m, d) => res.push({ ok: !!ok, m, d: d == null ? '' : (typeof d === 'string' ? d : JSON.stringify(d)) });
  const essaie = async (m, fn) => { try { await fn(); } catch (e) { dit(false, m + ' — a levé', String(e && e.message)); } };
  let P = null, A = null;
  try { ({ P, A } = await chargerApp(sources)); } catch (e) { dit(false, 'A0 src/prixPartout.js se charge', e.message); }

  // ══ A–E : LA RÈGLE DE L'APP ══
  // L'annonce Vinted telle que la règle la rend (par identité) : sur le code d'avant, elle sort « proposée ».
  const sVinted = () => P.sitesDuNumero('134', { rn: { annonces: [{ id: ID, etat: 'en-ligne', accountId: UID, price: { amount: '59.0' }, title: 'Nike P-6000 noire' }], manques: [], annoncesEbay: [] }, fiches: {}, lbcItems: {}, vcItems: {} }, {}).sites[0];
  const jouer = async (reponse, { prix = '58', site = sVinted(), ici = true, depot = 'ok', modeP = null } = {}) => {
    const appels = [], deposes = [];
    const dep = { appelEbay: async () => ({}), resultatReviseEbay: () => ({ etat: 'ok' }), corpsCompteEbay: () => ({}), sansReponse: 'pas de réponse',
      vmrCmdSuivi: async (cmd) => { appels.push(cmd); return typeof reponse === 'function' ? reponse(cmd) : reponse; },
      ici: () => ici, saitAttendre: () => true,
      deposer: async (c) => { deposes.push(c); return depot === 'ok' ? { id: 'cmd_prix_banc0001', data: { cle: site.cle } } : null; } };
    const s = modeP ? { ...site, mode: modeP } : site;
    const etats = [];
    const r = await P.appliquerPrix({ sites: [s], coches: new Set([s.cle]), prix, envoyer: P.envoisPrix(dep), surEtat: (c, e) => etats.push(e.etat) });
    return { e: (r.res || {})[s.cle] || {}, appels, deposes, etats, r };
  };
  if (P && typeof P.appliquerPrix === 'function') {
    await essaie('A', async () => {
      const x = await jouer({ accepte: true, etape: 'fait', prixVu: 58, ancien: 59 });
      const c = x.appels[0] || {};
      dit(x.appels.length === 1 && c.cmd === 'baisserPrixVinted' && c.uid === UID && c.id === ID && c.prix === 58 && c.prixAvant === 59 && c.confirme === true,
        'A1 baisse Vinted sur « Appliquer » ⇒ UNE commande `baisserPrixVinted` (compte, annonce, prix voulu, prix VU, confirmée)', { n: x.appels.length, c });
      dit(x.e.etat === 'fait' && x.e.relu === true && x.e.prixRelu === 58 && x.deposes.length === 0, 'A2 … « fait » avec le prix RELU par Vinted, rien de rangé', x.e);
      dit(!x.etats.includes('propose') && !('avant' in x.e), 'A3 aucun état intermédiaire « proposé » : pas de second geste', x.etats);
      const y = await jouer({ accepte: true, etape: 'fait', prixVu: null });
      dit(y.e.etat === 'fait' && y.e.relu === false, 'A4 « fait » sans prix relu ne dit jamais « relu »', y.e);
      const z = await jouer({ accepte: true, etape: 'ecart', prixVu: 59, raison: 'Vinted montre 59 €' });
      dit(z.e.etat === 'incertain' && z.deposes.length === 0, 'A5 Vinted montre un autre prix après ⇒ « pas sûr », jamais « fait »', z.e);
      const w = await jouer({ accepte: true, etape: 'echec', status: 422, raison: 'Vinted a refusé (422)' });
      dit(w.e.etat === 'refuse' && w.deposes.length === 0, 'A6 refus de Vinted ⇒ « refusé », dit, pas d’attente', w.e);
      if (typeof P.sitesDuNumero === 'function') {
        const rn = { annonces: [{ id: ID, etat: 'en-ligne', accountId: UID, price: { amount: '59.0' }, title: 'x' }], manques: [], annoncesEbay: [] };
        const v = P.sitesDuNumero('134', { rn, fiches: {}, lbcItems: {}, vcItems: {} }, {}).sites[0] || {};
        dit(v.mode === 'ext' && v.prix === 59, 'A7 une annonce Vinted en ligne est en mode « par l’extension » (plus « proposé »)', v.mode);
      }
    });
    await essaie('B', async () => {
      const cas = [['extension absente ici', { accepte: false, envoye: false }], ['pas de réponse', { sansReponse: true }], ['autre compte dans l’onglet', { accepte: false, code: 'vinted-autre' }],
        ['aucun compte Vinted ouvert', { accepte: false, code: 'vinted-absent' }], ['pas d’onglet vinted.fr', { accepte: false, code: 'onglet-vinted' }], ['plafond de l’heure', { accepte: false, code: 'plafond-bordereaux', attendreMs: 60000 }],
        ['plafond du jour', { accepte: false, code: 'plafond-jour' }], ['pause 429/403', { accepte: false, code: 'vinted-pause' }], ['prudence', { accepte: false, code: 'prudence' }],
        ['deux extensions', { accepte: false, code: 'plusieurs' }], ['code d’extension périmé', { accepte: false, code: 'perime' }], ['repos (sécurité des comptes)', { accepte: false, code: 'secu-repos' }]];
      const rates = [];
      for (const [nom, rep] of cas) {
        const x = await jouer(rep);
        const d = x.deposes[0] || {};
        if (!(x.e.etat === 'attente' && x.deposes.length === 1 && d.site === 'vinted' && d.uid === UID && d.id === ID && d.prix === 58 && d.prixAvant === 59 && x.appels.length === 1 && x.e.idCmd)) rates.push(nom + ':' + x.e.etat);
      }
      dit(!rates.length, `B1 l’extension ne peut pas agir maintenant (${cas.length} cas) ⇒ UNE ligne rangée (prix voulu + prix vu), état « attente », aucun second geste`, rates.join(' · '));
      const sans = await jouer({ accepte: true, etape: 'fait', prixVu: 58 }, { ici: false });
      dit(sans.appels.length === 0 && sans.deposes.length === 1 && sans.e.etat === 'attente', 'B2 pas d’extension capable sur CET appareil (iPhone) ⇒ rien n’est tenté d’ici, la baisse est rangée', { appels: sans.appels.length, e: sans.e });
      const ko = await jouer({ accepte: false, code: 'vinted-autre' }, { depot: 'ko' });
      dit(ko.e.etat === 'refuse' && ko.e.code === 'base', 'B3 la base ne prend pas la ligne ⇒ « refusé : rien n’est parti », jamais « en attente »', ko.e);
      const ko2 = await jouer({ sansReponse: true }, { depot: 'ko' });
      dit(ko2.e.etat === 'incertain', 'B4 pas de réponse ET ligne pas rangée ⇒ « pas sûr » (jamais « fait », jamais « en attente »)', ko2.e);
      const ch = await jouer({ accepte: false, code: 'prix-change', prixVu: 55, raison: 'sur Vinted le prix est maintenant 55 €' });
      dit(ch.e.etat === 'refuse' && ch.e.code === 'prix-change' && ch.e.prixRelu === 55 && ch.deposes.length === 0, 'B5 le prix a changé sur Vinted ⇒ rien ne part, le prix LU est dit, pas d’attente', ch.e);
      const dj = await jouer({ accepte: false, code: 'prix-change', prixVu: 58 });
      dit(dj.e.etat === 'fait' && dj.e.relu === true && dj.deposes.length === 0, 'B6 Vinted montre DÉJÀ le prix voulu ⇒ « fait · relu » (une baisse n’est jamais refaite)', dj.e);
      const ar = await jouer({ accepte: false, code: 'tout-arrete', raison: 'Tout est arrêté' });
      const vf = await jouer({ accepte: false, code: 'verification', raison: 'vérification' });
      const rb = await jouer({ accepte: false, code: 'secu-robot', raison: 'contrôle anti-robot' });
      const mo = await jouer({ accepte: false, code: 'modele-absent', raison: 'format jamais vu' });
      dit(ar.e.etat === 'refuse' && vf.e.etat === 'refuse' && rb.e.etat === 'refuse' && mo.e.etat === 'refuse' && ar.deposes.length + vf.deposes.length + rb.deposes.length + mo.deposes.length === 0, 'B7 « Tout arrêter », vérification anti-robot, format jamais appris ⇒ refusé et dit, JAMAIS rangé', [ar.e.etat, vf.e.etat, mo.e.etat]);
      const hl = await jouer({ ok: false, error: 'hors ligne', horsLigne: true });
      dit(hl.e.etat === 'refuse' && hl.deposes.length === 0, 'B8 hors ligne ⇒ refusé, rien de rangé', hl.e);
    });
    await essaie('C', async () => {
      const h = await jouer({ accepte: true, etape: 'fait', prixVu: 62 }, { prix: '62' });
      dit(h.e.etat === 'hausse' && h.appels.length === 0 && h.deposes.length === 0, 'C1 une HAUSSE sur Vinted ⇒ aucune commande, aucune ligne : « hausse à faire sur Vinted »', { e: h.e, n: h.appels.length });
      const m = await jouer({ accepte: true, etape: 'fait', prixVu: 59 }, { prix: '59' });
      dit(m.e.etat === 'fait' && m.e.inchange === true && m.appels.length === 0 && m.deposes.length === 0, 'C2 même prix ⇒ rien ne part', m.e);
      const si = await jouer({ accepte: true, etape: 'fait', prixVu: 58 }, { modeP: 'site' });
      dit(si.e.etat === 'a-faire' && si.appels.length === 0 && si.deposes.length === 0, 'C3 annonce que VRM ne peut pas changer (mode « site ») ⇒ aucune commande', si.e);
      dit(typeof P.toutEstDit === 'function' && P.toutEstDit({ a: { etat: 'fait' }, b: { etat: 'attente' }, c: { etat: 'ignore' } }) === true && P.toutEstDit({ a: { etat: 'fait' }, b: { etat: 'refuse' } }) === false && P.toutEstDit({ a: { etat: 'hausse' } }) === false && P.toutEstDit({ a: { etat: 'ignore' } }) === false,
        'C4 la feuille se ferme seule si tout est fait ou en attente ; elle reste s’il y a un refus, un « pas sûr » ou une hausse à lire');
    });
    await essaie('D', async () => {
      const sL = { cle: 'leboncoin:2890011223', site: 'leboncoin', id: '2890011223', prix: 61, mode: 'ext', lien: 'https://www.leboncoin.fr/ad/2890011223' };
      const sV = { cle: 'vestiaire:55012345', site: 'vestiaire', id: '55012345', prix: 120, mode: 'ext', lien: 'https://fr.vestiairecollective.com/' };
      const l = await jouer({ accepte: true, etape: 'fait', prixVu: 58 }, { site: sL });
      const cl = l.appels[0] || {};
      dit(l.appels.length === 1 && cl.cmd === 'lbcPrix' && cl.id === '2890011223' && cl.prix === 58 && cl.prixAvant === 61 && cl.confirme === true && l.e.etat === 'fait' && l.e.relu, 'D1 Leboncoin : le même geste — UNE commande `lbcPrix` (prix vu joint, confirmée), « fait » relu', { cl, e: l.e });
      const v = await jouer({ accepte: true, etape: 'fait', prixVu: 110 }, { site: sV, prix: '110' });
      const cv = v.appels[0] || {};
      dit(v.appels.length === 1 && cv.cmd === 'vcPrix' && cv.produit === '55012345' && cv.avantCents === 12000 && cv.apresCents === 11000 && v.e.etat === 'fait', 'D2 Vestiaire : UNE commande `vcPrix` (centimes, prix vu joint)', { cv, e: v.e });
      const pa = await jouer({ accepte: false, code: 'pas-appris', raison: 'jamais vu' }, { site: sL });
      dit(pa.e.etat === 'refuse' && pa.e.code === 'pas-appris' && pa.deposes.length === 0, 'D3 recette pas apprise ⇒ refus dit (une phrase), jamais rangé', pa.e);
      const at = await jouer({ accepte: false, code: 'lbc-absent' }, { site: sL });
      dit(at.e.etat === 'attente' && at.deposes.length === 1 && at.deposes[0].site === 'leboncoin', 'D4 Leboncoin pas ouvert ⇒ la baisse attend', at.e);
      const pe = await jouer({ accepte: false, code: 'perime', prixVu: 60, raison: 'le prix a changé' }, { site: sL });
      dit(pe.e.etat === 'refuse' && pe.e.code === 'prix-change' && pe.deposes.length === 0, 'D5 Leboncoin : le prix a changé depuis l’aperçu ⇒ rien ne part, dit', pe.e);
      // Le « format appris » d'une annonce Vinted : jamais appris ⇒ dit AVANT d'appliquer, aucune commande, aucune attente.
      if (typeof P.sitesDuNumero === 'function') {
        const src = { rn: { annonces: [{ id: ID, etat: 'en-ligne', accountId: UID, price: { amount: '59.0' }, title: 'x' }], manques: [], annoncesEbay: [] }, fiches: {}, lbcItems: {}, vcItems: {} };
        const sans = P.sitesDuNumero('134', src, { formats: { [ID]: false } }).sites[0] || {}, avec = P.sitesDuNumero('134', src, { formats: { [ID]: true } }).sites[0] || {}, passu = P.sitesDuNumero('134', src, { formats: null }).sites[0] || {};
        const x = await jouer({ accepte: true, etape: 'fait', prixVu: 58 }, { site: sans });
        dit(sans.mode === 'site' && sans.raison === 'format' && avec.mode === 'ext' && passu.mode === 'ext' && x.e.etat === 'a-faire' && x.appels.length === 0 && x.deposes.length === 0,
          'D8 annonce Vinted dont le format n’a jamais été appris ⇒ dit avant d’appliquer, AUCUNE commande ni attente ; appris ou pas su ⇒ le geste part', { sans: sans.mode + ':' + sans.raison, avec: avec.mode, passu: passu.mode, e: x.e.etat });
      }
      const hv = await jouer({ accepte: true, etape: 'fait' }, { site: sV, prix: '130' });
      dit(hv.e.etat === 'hausse' && hv.appels.length === 0, 'D6 hausse Leboncoin / Vestiaire ⇒ aucune commande', hv.e);
      if (typeof P.sitesDuNumero === 'function') {
        const num = () => '134';
        const src = { rn: { annonces: [], manques: [], annoncesEbay: [] }, fiches: {}, lbcItems: { 2890011223: { status: 'active', price: 61, subject: 'x' } }, vcItems: { 55012345: { statut: 'published', prix: { valeur: 120 }, titre: 'y' } } };
        const sans = P.sitesDuNumero('134', src, { numLbc: num, numVc: num, recettes: { leboncoin: false, vestiaire: false } }).sites;
        const avec = P.sitesDuNumero('134', src, { numLbc: num, numVc: num, recettes: { leboncoin: true, vestiaire: null } }).sites;
        dit(sans.length === 2 && sans.every((x) => x.mode === 'site' && x.raison === 'recette') && avec.every((x) => x.mode === 'ext'), 'D7 recette CONNUE pas apprise ⇒ dit avant même d’appliquer ; apprise ou pas su ⇒ le geste part', [sans.map((x) => x.mode + ':' + x.raison), avec.map((x) => x.mode)]);
      }
    });
  }
  if (A && typeof A.nouvelleCommandePrix === 'function') {
    await essaie('E', async () => {
      const t0 = 1763500000000;
      const c = A.nouvelleCommandePrix({ site: 'vinted', uid: UID, id: ID, prix: 58, prixAvant: 59, num: '134', owner: MOI, maintenant: t0, alea: 'ab12cd34' });
      dit(c && /^cmd_prix_[a-z0-9]{8,40}$/.test(c.id) && c.data.etat === 'attente' && c.data.confirme === true && c.data.pour === MOI && c.data.expire === t0 + 24 * H && c.data.cle === 'vinted:' + ID && c.data.prix === 58 && c.data.prixAvant === 59 && c.data.args.uid === UID,
        'E1 une ligne = une commande = un prix = une annonce : confirmée, à SON vendeur, périmée à 24 h, la clé et les deux prix à plat', c && c.data);
      dit(A.nouvelleCommandePrix({ site: 'vinted', uid: UID, id: ID, prix: 62, prixAvant: 59, owner: MOI }) === null && A.nouvelleCommandePrix({ site: 'vinted', uid: UID, id: ID, prix: 59, prixAvant: 59, owner: MOI }) === null
        && A.nouvelleCommandePrix({ site: 'vinted', uid: '', id: ID, prix: 58, prixAvant: 59, owner: MOI }) === null && A.nouvelleCommandePrix({ site: 'ebay', id: ID, prix: 58, prixAvant: 59, owner: MOI }) === null && A.nouvelleCommandePrix({ site: 'vinted', uid: UID, id: ID, prix: 58, prixAvant: 59 }) === null,
        'E2 hausse, même prix, compte absent, autre site, sans propriétaire ⇒ aucune ligne');
      const v = (l, t) => A.vueCommandePrix(l, t);
      const base = { id: c.id, etat: 'attente', cle: c.data.cle, prix: '58', prixAvant: '59', demandeLe: String(t0), expire: String(t0 + 24 * H) };
      dit(v(base, t0 + H).etat === 'attente' && v(base, t0 + 24 * H + 1).etat === 'perimee', 'E3 après 24 h, une commande encore « en attente » est dite PÉRIMÉE (même si aucune extension ne l’a écrit)', v(base, t0 + 25 * H));
      dit(v({ ...base, etat: 'pris', prisLe: String(t0 + 1000) }, t0 + 60000).etat === 'pris' && v({ ...base, etat: 'pris', prisLe: String(t0 + 1000) }, t0 + 11 * 60000).etat === 'incertain', 'E4 prise sans issue depuis 10 min ⇒ « pas sûr », jamais « fait »');
      const f = v({ ...base, etat: 'fait', prixVu: '58', finiLe: String(t0 + 5000) }, t0 + 6000);
      dit(f.etat === 'fait' && f.relu === true && f.prixVu === 58 && v({ ...base, etat: 'fait', prixVu: null }, t0).relu === false, 'E5 « fait » n’est « relu » qu’avec le prix lu');
      const vues = [v({ ...base, id: 'cmd_prix_a0000000', etat: 'remplacee' }, t0), v({ ...base, id: 'cmd_prix_b0000000', demandeLe: String(t0 + 10) }, t0 + 20)];
      dit(A.commandeCourante(vues, c.data.cle, t0 + 20).id === 'cmd_prix_b0000000' && A.commandeCourante(vues, 'vinted:999', t0) === null, 'E6 la commande qui parle pour une annonce : celle qui attend ; une remplacée ne dit rien');
      // déposer / annuler sur une fausse base (PATCH conditionnel)
      const table = { cmd_prix_ancienne1: { owner: MOI, data: { ...c.data, etat: 'attente', prix: 57 } } };
      let lectureKO = false; const posts = [];
      const fetchF = async (url, o = {}) => {
        const u = decodeURIComponent(String(url)); const m = (o.method || 'GET').toUpperCase();
        const rep = (s, b) => ({ ok: s >= 200 && s < 300, status: s, json: async () => b });
        const eq = /[?&]id=eq\.([^&]+)/.exec(u);
        if (m === 'GET') {
          if (lectureKO) return rep(522, null);
          if (eq) return rep(200, table[eq[1]] ? [{ data: table[eq[1]].data }] : []);
          return rep(200, Object.entries(table).filter(([, r]) => !/cle=in/.test(u) || u.includes('"' + r.data.cle + '"')).map(([id, r]) => ({ id, etat: r.data.etat, cle: r.data.cle, prix: String(r.data.prix), prixAvant: String(r.data.prixAvant), demandeLe: String(r.data.demandeLe), expire: String(r.data.expire) })));
        }
        if (m === 'PATCH') { const r = eq && table[eq[1]]; const cond = (/meta->>etat=eq\.([^&]+)/.exec(u) || [])[1]; if (!r || (cond && r.data.etat !== cond)) return rep(200, []); r.data = JSON.parse(o.body).data; return rep(200, [{ id: eq[1] }]); }
        if (m === 'POST') { const rows = JSON.parse(o.body); posts.push(rows[0].id); table[rows[0].id] = { owner: MOI, data: rows[0].data }; return rep(201, null); }
        return rep(404, null);
      };
      const dep = { fetch: fetchF, base: 'https://base.test/rest/v1', entetes: () => ({}), ligne: (l) => l, conflit: 'owner,id' };
      const d = await A.deposerPrixAttente(dep, c, t0);
      dit(d && posts.length === 1 && table.cmd_prix_ancienne1.data.etat === 'remplacee' && table[c.id].data.etat === 'attente', 'E7 déposer : la baisse qui attendait déjà pour CETTE annonce est remplacée, puis UNE ligne écrite', { posts, ancienne: table.cmd_prix_ancienne1.data.etat });
      lectureKO = true; posts.length = 0;
      const c2 = A.nouvelleCommandePrix({ site: 'vinted', uid: UID, id: ID, prix: 57, prixAvant: 59, owner: MOI, maintenant: t0 + 5, alea: 'zz99zz99' });
      dit((await A.deposerPrixAttente(dep, c2, t0 + 5)) === null && posts.length === 0, 'E8 lecture ratée ⇒ rien n’est rangé (jamais deux baisses en attente pour une annonce)');
      lectureKO = false;
      dit((await A.annulerPrixAttente(dep, c.id, t0 + 9)) === true && table[c.id].data.etat === 'annulee', 'E9 annuler : la ligne qui attend passe « annulée »');
      table[c.id].data.etat = 'pris';
      dit((await A.annulerPrixAttente(dep, c.id, t0 + 9)) === false && table[c.id].data.etat === 'pris', 'E10 annuler une commande déjà PRISE ne change rien (dit « non »)');
    });
  } else dit(false, 'E0 src/prixAttente.js existe (la file des prix en attente)', 'absent');

  // ══ F : UNE règle, deux endroits ══
  { const app = BLOC_RE.exec(sources['src/prixAttente.js'] != null ? sources['src/prixAttente.js'] : (fs.existsSync(F_ATT) ? fs.readFileSync(F_ATT, 'utf8') : '')), ext = BLOC_RE.exec(fs.readFileSync(bg, 'utf8'));
    dit(!!app && !!ext && app[1].trim() === ext[1].trim(), 'F1 le bloc <prix-attente-regle> de background.js est la copie exacte de src/prixAttente.js', !ext ? 'absent de l’extension' : 'différent : --recopie'); }

  // ══ G–N : L'EXTENSION (le vrai background.js) ══
  { const f = monterExt({ src: bg }); dit(typeof f.ctx.prixAttenteTick === 'function', 'G0 l’extension sait relever les prix en attente (`prixAttenteTick`)'); }
  await essaie('G', async () => {
    const r1 = ligneCmd();
    const f = monterExt({ src: bg, lignesCmd: [r1], session: false });
    const avant = f.reseau.base; await tick(f);
    dit(f.reseau.base === avant && f.j.vinted.length === 0 && f.table[r1.id].data.etat === 'attente', 'G1 sans session VRM : aucune requête, pas même vers notre base', { base: f.reseau.base - avant });
    const r2 = ligneCmd({ owner: AUTRE, pour: AUTRE }), r3 = ligneCmd({ pour: AUTRE });
    const g = monterExt({ src: bg, lignesCmd: [r2, r3] }); await tick(g);
    dit(g.j.vinted.length === 0 && g.table[r2.id].data.etat === 'attente' && g.table[r3.id].data.etat === 'attente', 'G2 ligne d’un AUTRE vendeur (propriétaire ou destinataire) ⇒ jamais exécutée, jamais touchée', { v: g.j.vinted.length });
    const h = monterExt({ src: bg, lignesCmd: [ligneCmd()], lectureFileKO: true }); await tick(h);
    dit(h.j.vinted.length === 0 && h.reseau.patch.length === 0, 'G3 lecture de la file ratée ⇒ rien n’est exécuté ni écrit');
  });
  await essaie('H', async () => {
    const r = ligneCmd();
    const f = monterExt({ src: bg, lignesCmd: [r] });
    await tick(f);
    const d = f.table[r.id].data, p = puts(f);
    let prixEnvoye = null; try { prixEnvoye = JSON.parse(p[0].corps).item.price.amount; } catch (_) {}
    dit(d.etat === 'fait' && d.prixVu === 58 && f.prix[ID] === 58, 'H1 Vinted ouvert sur le bon compte ⇒ la baisse part SEULE : « fait », prix RELU 58 écrit dans la ligne', { etat: d.etat, prixVu: d.prixVu, code: d.code, raison: d.raison });
    dit(f.j.vinted.map((v) => v.methode).join(',') === 'GET,PUT,GET' && p.length === 1 && prixEnvoye === '58', 'H2 … par le chemin de baisse existant : lire le prix → UN PUT → RELIRE', f.j.vinted.map((v) => v.methode).join(','));
    dit(f.j.vinted.every((v) => v.origine === 'page' && !Object.keys(v.entetes || {}).some((k) => /authorization/i.test(k))), 'H3 tout part de l’onglet vinted.fr, aucun `Authorization`');
    dit(actionsDe(f) === 1, 'H4 une baisse en attente = UNE action comptée dans l’heure du compte', actionsDe(f));
    dit(f.reseau.patch.some((x) => x.cond === 'attente' && x.etat === 'pris') && !!(f.store.vrmPrixAttVus || {})[r.id], 'H5 prise par une écriture CONDITIONNELLE (attente → pris) et notée dans le stockage avant d’agir');
    // rejouée : la ligne remise « en attente » (base restaurée, autre navigateur…) et le worker redémarré
    const n0 = f.j.vinted.length;
    f.table[r.id].data = { ...r.data }; f.prix[ID] = 59; sansEspace(f);
    await tick(f);
    dit(f.j.vinted.length === n0, 'H6 la même ligne remise en attente ⇒ JAMAIS exécutée deux fois par ce navigateur', { req: f.j.vinted.length - n0 });
    const g = monterExt({ src: bg, lignesCmd: [JSON.parse(JSON.stringify(r))], store: JSON.parse(JSON.stringify(f.store)) });
    sansEspace(g); await tick(g);
    dit(g.j.vinted.length === 0, 'H7 service worker redémarré (même stockage) ⇒ toujours pas rejouée');
    const j = (f.j.journal || []).join(' | ');
    dit(/Prix baissé/.test(j), 'H8 le geste accepté est noté (activité) comme une baisse faite sur son clic', j.slice(0, 120));
  });
  await essaie('I', async () => {
    const r = ligneCmd();
    const f = monterExt({ src: bg, lignesCmd: [r], connecte: UID2 });
    await tick(f);
    dit(f.j.vinted.length === 0 && f.table[r.id].data.etat === 'attente' && f.reseau.patch.length === 0 && actionsDe(f) === 0, 'I1 un AUTRE compte dans l’onglet ⇒ 0 requête Vinted, la ligne n’est pas touchée (elle attend)', { v: f.j.vinted.length, patch: f.reseau.patch });
    f.etat.connecte = UID; await tick(f);
    dit(f.table[r.id].data.etat === 'fait' && puts(f).length === 1, 'I2 … le bon compte revient ⇒ exécutée, UNE seule fois', { etat: f.table[r.id].data.etat, puts: puts(f).length });
    sansEspace(f); await tick(f); await tick(f);
    dit(puts(f).length === 1, 'I3 … et plus jamais ensuite', puts(f).length);
    const r2 = ligneCmd();
    const g = monterExt({ src: bg, lignesCmd: [r2], onglets: [] }); await tick(g);
    dit(g.j.vinted.length === 0 && g.table[r2.id].data.etat === 'attente', 'I4 pas d’onglet vinted.fr ⇒ elle attend, rien ne part');
    const r3 = ligneCmd();
    const h = monterExt({ src: bg, lignesCmd: [r3], store: { vrmPauseVinted: { jusqua: Date.now() + 20 * 60000, statut: 429, depuis: Date.now() } } }); await tick(h);
    dit(h.j.vinted.length === 0 && h.table[r3.id].data.etat === 'attente', 'I5 pause 429/403 en cours ⇒ elle attend, 0 requête', { v: h.j.vinted.length, e: h.table[r3.id].data.etat });
    const r4 = ligneCmd();
    const k = monterExt({ src: bg, lignesCmd: [r4], connecte: null }); await tick(k);
    dit(k.j.vinted.length === 0 && k.table[r4.id].data.etat === 'attente', 'I6 compte de l’onglet pas su ⇒ rien (pas su ≠ oui)');
  });
  await essaie('J', async () => {
    const r = ligneCmd({ il_y_a: 25 * H });
    const f = monterExt({ src: bg, lignesCmd: [r] }); await tick(f);
    dit(f.j.vinted.length === 0 && f.table[r.id].data.etat === 'expiree', 'J1 demandée il y a 25 h ⇒ « expirée », JAMAIS exécutée en retard', f.table[r.id].data.etat);
    const r2 = ligneCmd({ il_y_a: 2 * H, extra: { expire: Date.now() + 30 * 24 * H } }); r2.data.demandeLe = Date.now() - 30 * H;
    const g = monterExt({ src: bg, lignesCmd: [r2] }); await tick(g);
    dit(g.j.vinted.length === 0 && g.table[r2.id].data.etat === 'expiree', 'J2 une échéance allongée à la main ne vaut rien : 24 h au plus après la demande');
    const r3 = ligneCmd({ extra: { etat: 'annulee' } });
    const h = monterExt({ src: bg, lignesCmd: [r3] }); await tick(h);
    dit(h.j.vinted.length === 0 && h.table[r3.id].data.etat === 'annulee', 'J3 annulée ⇒ jamais relevée');
    // annulée ENTRE la lecture et la prise : la prise conditionnelle échoue
    const r4 = ligneCmd();
    const k = monterExt({ src: bg, lignesCmd: [r4] });
    const orig = k.ctx.fetch; let fait = false;
    k.ctx.fetch = async (url, o = {}) => { const res = await orig(url, o); if (!fait && (o.method || 'GET') === 'GET' && /id=like\.cmd_prix_/.test(decodeURIComponent(String(url)))) { fait = true; k.table[r4.id].data.etat = 'annulee'; } return res; };
    await tick(k);
    dit(k.j.vinted.length === 0 && k.table[r4.id].data.etat === 'annulee', 'J4 annulée juste après la lecture de la file ⇒ la prise conditionnelle échoue, rien ne part', { v: k.j.vinted.length });
  });
  await essaie('K', async () => {
    const r = ligneCmd();
    const f = monterExt({ src: bg, lignesCmd: [r], prixVinted: { [ID]: 55 } }); await tick(f);
    const d = f.table[r.id].data;
    dit(puts(f).length === 0 && d.etat === 'refuse' && d.code === 'prix-change' && d.prixVu === 55 && actionsDe(f) === 0, 'K1 le prix a changé sur Vinted entre-temps (55 ≠ 59 vu) ⇒ AUCUN PUT, refus dit avec le prix lu, place rendue', { etat: d.etat, code: d.code, prixVu: d.prixVu, puts: puts(f).length });
    const r2 = ligneCmd();
    const g = monterExt({ src: bg, lignesCmd: [r2], prixVinted: { [ID]: 58 } }); await tick(g);
    dit(puts(g).length === 0 && g.table[r2.id].data.etat === 'fait' && g.table[r2.id].data.prixVu === 58, 'K2 Vinted montre déjà le prix voulu ⇒ « fait » SANS PUT (jamais baissé deux fois)', g.table[r2.id].data.etat);
  });
  await essaie('L', async () => {
    const r = ligneCmd();
    const f = monterExt({ src: bg, lignesCmd: [r], actions: 45 }); await tick(f);
    const d = f.table[r.id].data;
    dit(f.j.vinted.length === 0 && d.etat === 'attente' && d.reports === 1 && Number(d.pasAvant) > Date.now(), 'L1 plafond (45 actions dans l’heure, 50 − réserve 5) ⇒ 0 requête, REMISE en attente avec un « pas avant »', { etat: d.etat, reports: d.reports, v: f.j.vinted.length });
    sansEspace(f); await tick(f);
    dit(f.j.vinted.length === 0, 'L2 … tant que le « pas avant » court, elle n’est pas retentée');
    f.table[r.id].data.pasAvant = Date.now() - 1000; delete f.store.vrmActions; sansEspace(f); await tick(f);
    dit(f.table[r.id].data.etat === 'fait' && puts(f).length === 1, 'L3 … une place se libère ⇒ elle part, une fois', f.table[r.id].data.etat);
    const r2 = ligneCmd({ extra: { reports: 40 } });
    const g = monterExt({ src: bg, lignesCmd: [r2], actions: 45 }); await tick(g);
    dit(g.j.vinted.length === 0 && g.table[r2.id].data.etat === 'refuse' && g.table[r2.id].data.code === 'reports', 'L4 jamais une boucle sans fin : après 40 remises, refusée et dite');
    const h1 = ligneCmd({ prix: 62 }), h2 = ligneCmd({ id: ID2, prix: 70, prixAvant: 80, extra: { confirme: false } }), h3 = ligneCmd({ site: 'ebay' });
    const h = monterExt({ src: bg, lignesCmd: [h1, h2, h3] }); await tick(h);
    dit(h.j.vinted.length === 0 && h.table[h1.id].data.etat === 'refuse' && h.table[h1.id].data.code === 'hausse' && h.table[h2.id].data.code === 'confirmation' && h.table[h3.id].data.code === 'non-autorise',
      'L5 une ligne qui porte une HAUSSE, sans confirmation ou pour un autre site ⇒ refusée, 0 requête', [h.table[h1.id].data.code, h.table[h2.id].data.code, h.table[h3.id].data.code]);
    const r5 = ligneCmd();
    const k = monterExt({ src: bg, lignesCmd: [r5] });
    k.store.vrmRythme = { [UID]: { phase: 'calme', jusqua: Date.now() + 10 * 60000, at: Date.now() } };
    await tick(k);
    dit(k.j.vinted.length === 0 && k.table[r5.id].data.etat === 'attente' && k.table[r5.id].data.attend === 'discretion', 'L6 moment calme (rythme irrégulier) ⇒ elle attend : une baisse rangée suit le rythme, comme une baisse programmée', k.table[r5.id].data.attend);
  });
  await essaie('M', async () => {
    const a = ligneCmd({ prix: 57, il_y_a: 60000 }), b = ligneCmd({ prix: 58, il_y_a: 5000 });
    const f = monterExt({ src: bg, lignesCmd: [a, b] }); await tick(f);
    dit(f.table[a.id].data.etat === 'remplacee' && f.table[b.id].data.etat === 'fait' && f.prix[ID] === 58 && puts(f).length === 1, 'M1 deux lignes pour la même annonce ⇒ la plus récente seule part, l’autre est « remplacée »', [f.table[a.id].data.etat, f.table[b.id].data.etat, f.prix[ID]]);
    const c = ligneCmd({ il_y_a: 60000 }), d = ligneCmd({ id: ID2, prix: 75, prixAvant: 80, il_y_a: 5000 });
    const g = monterExt({ src: bg, lignesCmd: [c, d] }); await tick(g);
    dit(puts(g).length === 1 && g.table[c.id].data.etat === 'fait' && g.table[d.id].data.etat === 'attente', 'M2 UNE baisse au plus par passage (la plus ancienne d’abord)', puts(g).length);
    await tick(g);
    dit(puts(g).length === 1 && Number(g.store.vrmPrixAttSuivant) > Date.now() + 20000, 'M3 … la suivante attend 25 à 90 s (jamais en rafale)', { puts: puts(g).length, dans: Number(g.store.vrmPrixAttSuivant) - Date.now() });
    sansEspace(g); await tick(g);
    dit(puts(g).length === 2 && g.table[d.id].data.etat === 'fait' && g.j.maxEnVol === 1, 'M4 … puis part ; jamais deux requêtes Vinted en vol', { puts: puts(g).length, vol: g.j.maxEnVol });
    const e = ligneCmd();
    const h = monterExt({ src: bg, lignesCmd: [e] });
    await Promise.all([tick(h), tick(h), tick(h)]);
    dit(puts(h).length === 1, 'M5 trois passages lancés ensemble ⇒ un seul travaille', puts(h).length);
  });
  await essaie('N', async () => {
    const r = ligneCmd();
    const f = monterExt({ src: bg, lignesCmd: [r] });
    if (typeof f.ctx.poserToutArrete === 'function') await f.ctx.poserToutArrete(true);
    await tick(f);
    const d = f.table[r.id].data;
    dit(f.j.vinted.length === 0 && d.etat === 'refuse' && /arret/.test(d.code || ''), 'N1 « Tout arrêter » ⇒ refusée et dite, 0 requête — un arrêt n’est jamais une attente', { etat: d.etat, code: d.code });
  });

  // ══ O : LA FEUILLE ET LES TEXTES ══
  { const jsx = sansCommentaires(sources['src/PrixPartout.jsx'] != null ? sources['src/PrixPartout.jsx'] : lire('src/PrixPartout.jsx'));
    dit(!/propose/i.test(jsx) && !/onProposer|data-prix-proposer/.test(jsx), 'O1 la feuille n’a plus d’état « proposé » ni de second bouton de baisse');
    dit(!/nouveau'\s*\)\s*:\s*tr\('prixPartout\.appliquer|Appliquer à nouveau|appliquerEncore|\bfini\b/.test(jsx) && (jsx.match(/className="pp-plein"/g) || []).length === 1, 'O2 UN seul plein, qui ne change pas de nom après un envoi');
    dit(/toutEstDit\(r\.res\)/.test(jsx) && /onFermer\(\)/.test(jsx), 'O3 après « Appliquer », la feuille se ferme si tout est fait ou en attente');
    const app = sansCommentaires(sources['src/App.jsx'] != null ? sources['src/App.jsx'] : lire('src/App.jsx'));
    dit(!/onProposer/.test(app) && !/nom="baisse-coque"/.test(app), 'O4 l’app n’ouvre plus la feuille « Baisser le prix » par-dessus « Changer le prix »');
    const morts = [];
    for (const l of ['fr', 'en', 'es', 'it', 'de']) { const d = lire(`src/i18n/langues/${l}.js`); for (const k of ['prixPartout.propose', 'prixPartout.baisser']) if (d.includes(`"${k}"`)) morts.push(l + ':' + k); }
    dit(!morts.length, 'O5 les textes morts (« Proposé : à toi de confirmer », « Baisser sur Vinted ») sont retirés des 5 langues', morts.join(' ')); }
  return res;
}

const MUT = {
  // ── l'extension ──
  'ext : sans propriétaire': ['bg', "if (String(row.owner || '') !== moi || String(d.pour || '') !== moi) { noterDiag('prix_attente_autre_vendeur'); issues.push('proprietaire'); continue; }", ''],
  'ext : rejouée': ['bg', "if (vus[id]) { issues.push('deja'); continue; }                      // prise par ce navigateur : JAMAIS rejouée", ''],
  'ext : périmée exécutée': ['bg', "if (!dem || !fin || t > fin || dem > t + 120000) {", 'if (false) {'],
  'ext : échéance crue': ['bg', "return dem ? Math.min(Number(d.expire) || dem + PRIX_ATT_MS, dem + PRIX_ATT_MS) : 0;", 'return dem ? (Number(d.expire) || dem + PRIX_ATT_MS) : 0;', 'les-deux'],
  'ext : part sur un autre compte': ['bg', "if (!uid || String(uid) !== c.uid) return false;", ''],
  'ext : prise sans condition': ['bg', "const pris = await relaisEcrire(x.id, moi, dPris, 'attente');", 'const pris = await relaisEcrire(x.id, moi, dPris, null);'],
  'ext : hausse acceptée': ['bg', "if (!(vouluC < avantC)) return { refus: 'hausse' };", '', 'les-deux'],
  'ext : sans confirmation': ['bg', "if (d.confirme !== true) return { refus: 'confirmation' };", '', 'les-deux'],
  'ext : en rafale': ['bg', "if (t < suivant && suivant - t < 10 * 60000) return { lu: true, n: rows.length, issues, attend: 'espace' };", ''],
  'ext : plusieurs par passage': ['bg', "    try { await chrome.storage.local.set({ [PRIX_ATT_SUIVANT]: Date.now() + tirerEntre(25000, 90000) }); } catch (_) {}\n    break;", "    try { await chrome.storage.local.set({ [PRIX_ATT_SUIVANT]: Date.now() + tirerEntre(25000, 90000) }); } catch (_) {}"],
  'ext : plafond = refus': ['bg', "if (i.etat === 'attendre' && reports < PRIX_ATT_REPORTS) {", 'if (false) {'],
  'ext : boucle sans fin': ['bg', "if (i.etat === 'attendre' && reports < PRIX_ATT_REPORTS) {", "if (i.etat === 'attendre') {"],
  'ext : la plus ancienne gagne': ['bg', "const vieux = (Number(deja.d.demandeLe) || 0) <= dem ? deja : { id, d, c };", 'const vieux = { id, d, c };'],
  'ext : arrêt = attente': ['bg', "  if (PRIX_ATT_ARRETS.test(c)) return false;\n", '', 'les-deux'],
  'ext : prix changé ignoré': ['bg', "if (centimesBaisse(lue.prix) !== avant) {", 'if (false) {'],
  'ext : sans le rythme': ['bg', "baisserPrixVinted(Object.assign({}, msg, { programme: true }))", 'baisserPrixVinted(Object.assign({}, msg, { programme: false }))'],
  // ── la règle de l'app ──
  'app : Vinted proposé (l’ancien état)': ['src/prixPartout.js', "    if (s.mode === 'ext' && s.prix != null && cible > s.prix) {", "    if (s.mode === 'ext' && s.site === 'vinted') { dire(s.cle, { etat: 'propose', raison: null, prix: cible, avant: s.prix }); continue; }\n    if (s.mode === 'ext' && s.prix != null && cible > s.prix) {"],
  'app : format jamais appris envoyé': ['src/prixPartout.js', "mode: compteOk && prixLu != null && !sansFormat ? 'ext' : 'site',", "mode: compteOk && prixLu != null ? 'ext' : 'site',"],
  'app : hausse envoyée': ['src/prixPartout.js', "if (s.mode === 'ext' && s.prix != null && cible > s.prix) { dire(s.cle, { etat: 'hausse', raison: null, prix: cible }); continue; }", ''],
  'app : sans le prix vu': ['src/prixPartout.js', "({ cmd: 'baisserPrixVinted', uid: s.compte, id: s.id, prix: p, prixAvant: s.prix, confirme: true })", "({ cmd: 'baisserPrixVinted', uid: s.compte, id: s.id, prix: p, confirme: true })"],
  'app : sans confirmation': ['src/prixPartout.js', "({ cmd: 'baisserPrixVinted', uid: s.compte, id: s.id, prix: p, prixAvant: s.prix, confirme: true })", "({ cmd: 'baisserPrixVinted', uid: s.compte, id: s.id, prix: p, prixAvant: s.prix })"],
  'app : pas rangée': ['src/prixPartout.js', "try { d = dep.deposer ? await dep.deposer({ site, uid: s.compte || '', id: s.id, prix: p, prixAvant: s.prix }) : null; } catch (_) { d = null; }", 'd = null;'],
  'app : attente dite sans ligne': ['src/prixPartout.js', "if (!d) return r && r.sansReponse ? { etat: 'incertain', raison: dep.sansReponse || 'pas de réponse', code: 'sans-reponse' } : { etat: 'refuse', raison: null, code: 'base' };", "if (!d) d = { id: null };"],
  'app : tente depuis l’iPhone': ['src/prixPartout.js', "if (!dep.ici || dep.ici(site)) {", 'if (true) {'],
  'app : arrêt rangé': ['src/prixAttente.js', "  if (PRIX_ATT_ARRETS.test(c)) return false;\n", '', 'app-seule'],
  'app : fait sans relecture': ['src/prixPartout.js', "relu: etat === 'fait' && relu != null,", 'relu: etat === \'fait\','],
  'app : périmée jamais dite': ['src/prixAttente.js', "if (brut === 'attente' && fin && maintenant > fin) etat = 'perimee';\n  else if", 'if'],
  'app : deux baisses en attente': ['src/prixAttente.js', "for (const v of avant) if (v.etat === 'attente') { const ok = await changerSiAttente(dep, v.id, 'remplacee', maintenant); if (ok === null) return null; }", ''],
  'app : rangée sur lecture ratée': ['src/prixAttente.js', "  if (avant === null) return null;\n  for (const v of avant)", "  for (const v of (avant || []))"],
  'app : se ferme sur un refus': ['src/prixPartout.js', "return l.length > 0 && l.every((e) => e.etat === 'fait' || e.etat === 'attente');", 'return l.length > 0;'],
  // (19 nov.) la feuille est la Feuille du natif : son plein est un <Bouton variante="plein" className="pp-plein">.
  'feuille : second bouton': ['src/PrixPartout.jsx', '<Bouton variante="plein" className="pp-plein"', '<Bouton variante="teinte" attrs={{ \'data-prix-proposer\': \'\' }}>x</Bouton><Bouton variante="plein" className="pp-plein"'],
  'feuille : plein renommé': ['src/PrixPartout.jsx', ">{tr('prixPartout.appliquer')}</Bouton>", ">{etats.x ? 'Appliquer à nouveau' : tr('prixPartout.appliquer')}</Bouton>"],
};

(async () => {
  const ecrire = (txt) => { const f = path.join(os.tmpdir(), `bg-prix-att-${process.pid}-${Math.random().toString(36).slice(2)}.js`); fs.writeFileSync(f, txt); return f; };
  const iSrc = process.argv.indexOf('--src');
  const bgBase = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : BG;
  const base = await controles({ bg: bgBase });
  let ko = 0;
  for (const c of base) { if (!c.ok) ko++; console.log((c.ok ? '✅ ' : '❌ ') + c.m + (c.ok || !c.d ? '' : '  → ' + c.d)); }
  if (process.argv.includes('--prouve')) {
    console.log('\n── preuve : mutations (chacune doit faire rougir au moins un contrôle) ──');
    const bgSrc = fs.readFileSync(BG, 'utf8');
    let tenues = 0;
    for (const [nom, [ou, de, vers, portee]] of Object.entries(MUT)) {
      let rouges = null;
      if (ou === 'bg') {
        if (!bgSrc.includes(de)) { console.log(`❌ mutation ${nom} : le texte visé est introuvable`); ko++; continue; }
        const f = ecrire(bgSrc.split(de).join(vers));
        const sources = {};
        // Une mutation du bloc partagé est jouée des DEUX côtés (sinon seul F1 rougirait : la preuve ne dirait rien de la règle).
        if (portee === 'les-deux') { const a = lire('src/prixAttente.js'); if (!a.includes(de)) { console.log(`❌ mutation ${nom} : introuvable côté app`); ko++; continue; } sources['src/prixAttente.js'] = a.split(de).join(vers); }
        rouges = (await controles({ bg: f, sources })).filter((x) => !x.ok); try { fs.unlinkSync(f); } catch (_) {}
      } else {
        const src = lire(ou);
        if (!src.includes(de)) { console.log(`❌ mutation ${nom} : le texte visé est introuvable`); ko++; continue; }
        rouges = (await controles({ bg: BG, sources: { [ou]: src.split(de).join(vers) } })).filter((x) => !x.ok && (portee !== 'app-seule' || !/^F1/.test(x.m)));
      }
      if (rouges.length) tenues++; else ko++;
      console.log(`${rouges.length ? '✅' : '❌'} mutation ${nom} : ${rouges.length} rouge(s)${rouges.length ? ' — ' + rouges[0].m : ''}`);
    }
    console.log(`${tenues}/${Object.keys(MUT).length} mutations tenues`);
    // §6.1 : le code d'AVANT (origin/main) — Vinted « proposé », pas de file : A, B, E, G0, H doivent être rouges.
    const git = (ref) => { try { return cp.execFileSync('git', ['show', ref], { cwd: process.env.VRM_GIT || RACINE, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch (_) { return null; } };
    const refAvant = process.env.VRM_REF_PUBLIEE || 'origin/main';
    const avBg = git(`${refAvant}:vinted-sync-extension/background.js`), avRegle = git(`${refAvant}:src/prixPartout.js`), avJsx = git(`${refAvant}:src/PrixPartout.jsx`), avApp = git(`${refAvant}:src/App.jsx`);
    if (avBg == null || avRegle == null) console.log(`— ${refAvant} illisible ici : preuve sur le code d’avant non jouée (dit, pas conclu)`);
    else if (/function prixAttenteTick/.test(avBg)) console.log(`— ${refAvant} porte déjà \`prixAttenteTick\` (fusionné) : preuve d’avant sans objet`);
    else {
      const f = ecrire(avBg);
      const r = await controles({ bg: f, sources: { 'src/prixPartout.js': avRegle, 'src/prixAttente.js': '', 'src/PrixPartout.jsx': avJsx || '', 'src/App.jsx': avApp || '' } }); try { fs.unlinkSync(f); } catch (_) {}
      const rouges = r.filter((x) => !x.ok).map((x) => x.m.split(' ')[0]);
      const attendus = ['A1', 'A3', 'B1', 'G0', 'H1', 'O1', 'O2', 'O4'];
      const manque = attendus.filter((k) => !rouges.includes(k));
      console.log(`${manque.length ? '❌' : '✅'} §6.1 sur le code de ${refAvant} : ${rouges.length} rouge(s) — ${rouges.join(' ')}${manque.length ? ' ; attendus aussi : ' + manque.join(' ') : ''}`);
      if (manque.length) ko++;
    }
  }
  console.log(ko ? `\n❌ audit-prix-attente : ${ko} rouge(s)` : `\n✅ audit-prix-attente : ${base.length} contrôles — « Appliquer » envoie la baisse par l’extension ou la range ; une seule fois, 24 h au plus, annulable, prix relu`);
  process.exit(ko ? 1 : 0);
})();

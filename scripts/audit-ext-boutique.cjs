#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT 5.371 (12 nov., lot agent2-ext-boutique) — le VRAI background.js en VM
//  (scripts/_fond-vm.cjs), tout inventé (dépôt public) :
//   A. « Nouvelle version disponible » : version servie (vrm.center) plus récente
//      et installée à la main ⇒ `nouvelle` + le paquet servi ; venue d'une
//      BOUTIQUE (`update_url`) ⇒ rien à télécharger, la boutique est priée de
//      vérifier ; servie illisible ⇒ « pas su » (null), jamais « à jour ».
//   B. La jauge de la carte : heure + jour de TOUS les Chrome du compte ; ligne
//      partagée pas lue ⇒ `complet: false` (la carte dit « au moins »).
//   C. « Réparer » : refusé pendant une republication (témoin) ; une commande
//      « en cours » muette depuis 15 min est arrêtée et dite ; session perdue ⇒
//      renouvelée ; canal de page absent ⇒ l'onglet est rechargé.
//   D. « Envoyer un rapport » : AUCUN e-mail, pseudo, montant, n° long planté dans
//      le stockage ne sort ; le serveur rejoue sa liste blanche (api/_lib/rapport-extension.js).
//   E. La file « en attente de réseau » : hors ligne au départ ⇒ gardé (sans le
//      texte dans ce que voit l'app) ; un geste qui vend la paire n'est jamais
//      gardé ; au retour du réseau il part par la MÊME porte (compte de l'onglet
//      revérifié : autre compte ⇒ il reste) ; échu après 24 h ⇒ il sort.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE. `BG_SRC=<fichier>` :
//  juger une autre copie (la branche de départ).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const SRC0 = process.env.BG_SRC ? path.resolve(process.env.BG_SRC) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');

const MUTATIONS = {
  boutique: ["if (m && typeof m.update_url === 'string'", "if (false && m && typeof m.update_url === 'string'"],
  servie: ['const nouvelle = servie && VERSION_RE.test(installee) ? versionPlusRecente(servie, installee) : null;', 'const nouvelle = VERSION_RE.test(installee) ? versionPlusRecente(servie || installee, installee) : null;'],
  autres: ['h: local.length + (autres ? Number(autres.n) || 0 : 0), maxH,', 'h: local.length, maxH,'],
  temoin: ["if (await republicationEnCours()) return { ok: false, code: 'republication'", "if (false) return { ok: false, code: 'republication'"],
  bloquee: ['if (avant.includes(\'file\')) {', 'if (false) {'],
  etiquette: ["if (!/^[a-z0-9_.:-]*$/.test(x) || /\\.[a-z]{2,}/.test(x)) return 'masque';\n  return x.replace", "return x.replace"],
  horsligne: ['if (ecriture && horsLigne()) {', 'if (false) {'],
  vend: ['if (permis.confirmer) return { ok: false, code: \'hors-ligne\'', 'if (false) return { ok: false, code: \'hors-ligne\''],
  echu: ['l = l.filter((x) => Number(x.exp) > t);', 'l = l.filter((x) => true);'],
  passager: ['if (r && (r.enAttente || REFUS_PASSAGERS.test(String(r.code || \'\')))) {', 'if (r && r.enAttente) {'],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
let SRC = SRC0;
const VCODE = (/const CODE_VERSION = '([^']+)'/.exec(fs.readFileSync(SRC0, 'utf8')) || [])[1];   // la version du code lu (5.372 : plus de numéro en dur)
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut];
  const s = fs.readFileSync(SRC0, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  SRC = path.join(os.tmpdir(), `bg-ext-boutique-${mut}-${process.pid}.js`);
  fs.writeFileSync(SRC, s.replace(a, b));
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 400) : '')); } };
const essai = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom + ' — exception', e && e.stack); } };
const UID = '111', NAV2 = 'aaaaaaaaaaaaaaaa';
const MIN = 60000, H = 3600000;
const jourParis = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));

// Un fond, avec `navigator` (en ligne ou pas), un manifeste, la version servie.
function fond({ enLigne = true, servie = '9.0.0', manifeste = {}, ...o } = {}) {
  const nav = { onLine: enLigne, userAgent: 'Mozilla/5.0 Chrome/130.0' };
  const f = faireFond({ src: SRC, connecte: UID, globales: { navigator: nav }, ...o });
  f.nav = nav;
  const C = f.ctx;
  const m0 = C.chrome.runtime.getManifest;
  C.chrome.runtime.getManifest = () => Object.assign({}, m0 ? m0() : {}, { version: '5.371.0' }, manifeste);
  f.verifs = 0;
  C.chrome.runtime.requestUpdateCheck = (cb) => { f.verifs++; if (cb) cb('no_update'); };
  const f0 = C.fetch;
  f.lecturesServie = 0;
  C.fetch = async (u, opts) => {
    if (/^https:\/\/vrm\.center\/extension-version\.json/.test(String(u))) {
      f.lecturesServie++;
      if (servie === null) return { ok: false, status: 503, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ version: servie }) };
    }
    return f0(u, opts);
  };
  if (f.lignes.main === undefined) f.lignes.main = {};
  return f;
}

(async () => {
  // ── 0. LA VERSION SERVIE = le manifeste = EXT_ATTENDUE (une version publiée se lit là) ──
  if (!mut) {
    const R = path.join(__dirname, '..');
    let vs = null; try { vs = JSON.parse(fs.readFileSync(path.join(R, 'public', 'extension-version.json'), 'utf8')).version; } catch (_) {}
    const vm = JSON.parse(fs.readFileSync(path.join(R, 'vinted-sync-extension', 'manifest.json'), 'utf8')).version;
    const ea = (/const EXT_ATTENDUE\s*=\s*'([^']+)'/.exec(fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8')) || [])[1];
    dit(vs && vs === vm && vs === ea, '0 public/extension-version.json = manifeste = EXT_ATTENDUE (à monter avec chaque version)', `${vs} / ${vm} / ${ea}`);
  }
  // ── A. NOUVELLE VERSION ──────────────────────────────────────────────────
  await essai('A', async () => {
    const f = fond({ servie: '5.372.0' });
    const m = await f.ctx.etatMiseAJour({ attendre: true });
    dit(m && m.nouvelle === true && m.origine === 'main' && m.servie === '5.372.0' && m.lien === 'https://vrm.center/VRM-extension.zip', 'A installée à la main, 5.372 servie ⇒ « Nouvelle version » + le zip servi', JSON.stringify(m));
    dit(f.verifs === 0, 'A à la main : la boutique n’est pas sollicitée', f.verifs);
    const g = fond({ servie: '5.372.0', manifeste: { update_url: 'https://clients2.google.com/service/update2/crx' } });
    const mb = await g.ctx.etatMiseAJour({ attendre: true });
    dit(mb && mb.origine === 'boutique' && g.verifs === 1, 'A venue de la boutique ⇒ origine « boutique », la boutique est priée de vérifier (rien à télécharger)', JSON.stringify(mb) + ' verifs=' + g.verifs);
    const h = fond({ servie: '5.371.0' });
    const me = await h.ctx.etatMiseAJour({ attendre: true });
    dit(me && me.nouvelle === false, 'A même version servie ⇒ rien à dire', JSON.stringify(me));
    const k = fond({ servie: null });
    const mk = await k.ctx.etatMiseAJour({ attendre: true });
    dit(mk && mk.nouvelle === null && mk.servie === null, 'A version servie illisible ⇒ « pas su » (null), jamais « à jour »', JSON.stringify(mk));
    await k.ctx.etatMiseAJour({ attendre: true });
    dit(k.lecturesServie === 1, 'A après un échec, pas de nouvelle lecture avant 15 min', k.lecturesServie);
    const p = fond({ servie: '5.372.0' });
    await p.ctx.etatMiseAJour({ attendre: true }); await p.ctx.etatMiseAJour({ attendre: true });
    dit(p.lecturesServie === 1, 'A une version lue sert 6 h (une lecture)', p.lecturesServie);
  });

  // ── B. LA JAUGE DE LA CARTE ──────────────────────────────────────────────
  await essai('B', async () => {
    const t = Date.now();
    const lignes = { [`actions_compte_${UID}_${NAV2}`]: { uid: UID, ts: [t - 5 * MIN, t - 10 * MIN], jour: { d: jourParis(t), n: 9 } } };
    const f = fond({ lignes, store: { vrmActions: { [UID]: [t - MIN, t - 2 * MIN, t - 3 * MIN, t - 2 * H] }, vrmActionsJour: { [UID]: [t - MIN, t - 2 * MIN, t - 3 * MIN] } } });
    const j = await f.ctx.jaugePourCarte(UID);
    dit(j && j.h === 5 && j.j === 12 && j.maxH === 50 && j.complet === true, 'B jauge = ce Chrome + les autres Chrome du compte (3+2 cette heure, 3+9 aujourd’hui), plafond 50', JSON.stringify(j));
    dit(j && Number(j.maxJ) > 5, 'B le plafond du jour est dit', JSON.stringify(j));
    const g = fond({ lignes, lectureKO: (u) => /actions_compte_/.test(u), store: { vrmActions: { [UID]: [t - MIN] }, vrmActionsJour: { [UID]: [t - MIN] } } });
    const jg = await g.ctx.jaugePourCarte(UID);
    dit(jg && jg.complet === false && jg.h === 1, 'B ligne partagée pas lue ⇒ « au moins » (complet: false), jamais un total qui se dit complet', JSON.stringify(jg));
    const e = await f.ctx.etatSite('https://www.vinted.fr/member/1', 7);
    dit(e && e.site && e.site.jauge && e.site.jauge.h === 5 && e.maj && 'aReparer' in e && e.enAttenteReseau === 0, 'B l’état de la carte porte la jauge, la mise à jour, ce qui est à réparer et la file réseau', JSON.stringify(e && { jauge: e.site && e.site.jauge, maj: e.maj, aReparer: e.aReparer, file: e.enAttenteReseau }));
  });

  // ── C. RÉPARER ──────────────────────────────────────────────────────────
  await essai('C', async () => {
    const t = Date.now();
    const f = fond({ store: { vrmRepubVivante: t - MIN, vrmCmds: { 'pub:9': { etape: 'file', at: t - 30 * MIN } } } });
    const r = await f.ctx.reparerExtension(7);
    dit(r && r.ok === false && r.code === 'republication' && /republication/.test(r.raison), 'C une republication en cours ⇒ rien n’est touché, et c’est dit', JSON.stringify(r));
    dit(f.store.vrmCmds['pub:9'].etape === 'file', 'C … la commande en cours n’a pas été touchée', JSON.stringify(f.store.vrmCmds));
    const g = fond({ store: { vrmCmds: { 'pub:9': { etape: 'file', at: t - 30 * MIN }, 'pub:8': { etape: 'file', at: t - 2 * MIN } } } });
    g.ctx.chrome.tabs.sendMessage = (id, m, cb) => { cb && cb({ canal: true, douteux: false }); };
    const rg = await g.ctx.reparerExtension(7);
    const c9 = g.store.vrmCmds['pub:9'], c8 = g.store.vrmCmds['pub:8'];
    dit(rg && rg.ok && rg.avant.includes('file') && c9.etape === 'echec' && c9.code === 'repare' && c8.etape === 'file', 'C une commande muette depuis 15 min est arrêtée et dite ; une récente est laissée', JSON.stringify({ rg, c9, c8 }));
    const h = fond({ store: { vrmSession: { access_token: 'x', refresh_token: 'r', user_id: 'u', expires_at: t - MIN } } });
    let renouv = 0;
    h.ctx.authEtatRapide = async () => ({ connecte: false, expiree: true });
    h.ctx.renouvelerSession = async () => { renouv++; return { access_token: 'neuf' }; };
    h.ctx.chrome.tabs.sendMessage = (id, m, cb) => { cb && cb({ canal: true, douteux: false }); };
    const rh = await h.ctx.reparerExtension(7);
    dit(renouv === 1 && rh.fait.some((x) => x.quoi === 'session' && x.ok), 'C session VRM perdue ⇒ renouvelée (une fois)', JSON.stringify(rh));
    const k = fond();
    let recharge = 0;
    k.ctx.chrome.tabs.get = async (id) => ({ id, url: 'https://www.vinted.fr/member/1' });
    k.ctx.chrome.tabs.sendMessage = (id, m, cb) => { cb && cb({ canal: false }); };
    k.ctx.chrome.tabs.reload = async () => { recharge++; };
    const rk = await k.ctx.reparerExtension(7);
    dit(recharge === 1 && rk.avant.includes('canal'), 'C canal de la page absent ⇒ l’onglet Vinted est rechargé (jamais un second canal)', JSON.stringify(rk) + ' recharges=' + recharge);
  });

  // ── D. LE RAPPORT ───────────────────────────────────────────────────────
  await essai('D', async () => {
    const t = Date.now();
    const f = fond({ store: {
      vrmFlux: { vinted: { okAt: t - MIN, koAt: t - 2 * MIN, koStatut: '503', refus: [{ at: t - 2 * MIN, statut: 'jean.dupont@exemple.fr', famille: 'offre 45,50 € tx 123456789' }] }, inconnu: { okAt: 1 } },
      vrmDiagRecents: [{ k: 'label_fetch_403', at: t - MIN }, { k: 'conversation_9876543210_marie.l@exemple.fr', at: t - MIN }],
      vrmDiagBuf: { n: { 'pseudo Sophie_B 12345678': 2, page_ok: 3, ecriture_ratee_harvest_45678901: 1 } },
      vrmCmds: { 'exec:1': { etape: 'fait', at: t, texte: 'Bonjour Sophie, je vous propose 45 €' } },
    } });
    const r = await f.ctx.construireRapport();
    const txt = JSON.stringify(r);
    dit(r && r.version === VCODE && r.flux && r.flux.vinted && r.flux.vinted.koStatut === '503' && !r.flux.inconnu, 'D le rapport porte la version, la dernière lecture et son résultat', txt.slice(0, 300));
    dit(!/@|exemple|123456789|9876543210|12345678|45678901|Bonjour|Sophie|45,50|€/.test(txt) && /page_ok/.test(txt) && /ecriture_ratee_harvest_#/.test(txt), 'D aucun e-mail, pseudo, texte, montant ou n° long ne sort (tout ce qui est planté est tombé)', txt);
    dit(r && r.files && r.files.commandes && r.files.commandes.fait === 1, 'D les files sont comptées (jamais leur contenu)', JSON.stringify(r && r.files));
    let corps = null;
    f.ctx.authToken = async () => ({ access_token: 'jeton' });
    const f0 = f.ctx.fetch;
    f.ctx.fetch = async (u, o) => { if (/mode=rapport-extension/.test(String(u))) { corps = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ ok: true }) }; } return f0(u, o); };
    const e = await f.ctx.envoyerRapport();
    dit(e && e.ok && corps && corps.version === VCODE, 'D « Envoyer un rapport » poste à /api/compte?mode=rapport-extension avec la session', JSON.stringify(e));
    const S = await import(path.join(__dirname, '..', 'api', '_lib', 'rapport-extension.js'));
    const n = S.normaliserRapportExt({ ...r, texte: 'Bonjour', pseudo: 'sophie_b', email: 'a@b.fr', flux: { vinted: { okAt: t, koStatut: 'tx 4455667788' } }, compteurs: { 'achat_12,50_€': 1 } }, t);
    const tn = JSON.stringify(n);
    dit(n && !/Bonjour|sophie|a@b|4455667788|€/.test(tn) && !('texte' in n) && !('pseudo' in n), 'D le serveur rejoue sa liste blanche : champs inconnus et données tombent', tn.slice(0, 300));
    dit(S.normaliserRapportExt({ version: 'abc' }, t) === null, 'D un corps sans version lisible n’est pas rangé', '');
  });

  // ── E. LA FILE « EN ATTENTE DE RÉSEAU » ─────────────────────────────────
  await essai('E', async () => {
    const f = fond({ enLigne: false });
    const rep = { uid: UID, method: 'POST', endpoint: '/api/v2/conversations/42/replies', body: { reply: { body: 'Bonjour, oui elle est dispo' } } };
    const r = await f.ctx.executerPourApp(rep, { origin: 'https://vrm.center' });
    const file = f.store.vrmFileReseau || [];
    dit(r && r.enAttente === true && r.code === 'en-attente-reseau' && file.length === 1 && f.j.vinted.length === 0, 'E hors ligne au départ ⇒ le geste attend (rien n’est parti vers Vinted)', JSON.stringify({ r, file: file.length, vinted: f.j.vinted.length }));
    const vue = f.ctx.vueFileReseau(file);
    dit(!/Bonjour|dispo/.test(JSON.stringify(vue)) && vue[0].sorte && vue[0].exp - vue[0].at === 24 * H, 'E ce que voit l’app : sorte et heures (24 h), jamais le texte', JSON.stringify(vue));
    const acc = await f.ctx.executerPourApp({ uid: UID, method: 'PUT', endpoint: '/api/v2/transactions/5/offer_requests/6/accept', confirme: true }, { origin: 'https://vrm.center' });
    dit(acc && acc.code === 'hors-ligne' && (f.store.vrmFileReseau || []).length === 1, 'E accepter une offre (vend la paire) n’est JAMAIS gardé pour plus tard', JSON.stringify(acc));
    const lec = await f.ctx.executerPourApp({ uid: UID, method: 'GET', endpoint: '/api/v2/conversations/42' }, { origin: 'https://vrm.center' });
    dit(!(lec && lec.enAttente) && (f.store.vrmFileReseau || []).length === 1, 'E une lecture n’est pas gardée', JSON.stringify(lec));
    // Retour du réseau, mais un AUTRE compte dans l'onglet : il reste.
    f.nav.onLine = true;
    f.ctx.compteConnecte = async () => '999';
    const v1 = await f.ctx.viderFileReseau();
    dit(v1 && v1.parti === 0 && (f.store.vrmFileReseau || []).length === 1 && f.j.vinted.filter((x) => /replies/.test(x.url || x.chemin || '')).length === 0, 'E au retour du réseau, compte de l’onglet revérifié AU DÉPART : autre compte ⇒ rien ne part, il reste en file', JSON.stringify({ v1, file: f.store.vrmFileReseau, vinted: f.j.vinted.slice(-3) }));
    // Le bon compte : il part par la même porte.
    f.ctx.compteConnecte = async () => UID;
    f.ctx.vintedPage = async () => ({ status: 200, ok: true, json: { id: 1 }, viaPage: true });
    f.ctx.attendreEcriture = async () => ({ ok: true });
    const v2 = await f.ctx.viderFileReseau();
    dit(v2 && v2.parti === 1 && (f.store.vrmFileReseau || []).length === 0, 'E bon compte ⇒ le geste part et quitte la file', JSON.stringify({ v2, file: f.store.vrmFileReseau }));
    // Échu après 24 h.
    const g = fond({ enLigne: true, store: { vrmFileReseau: [{ id: 'r1', uid: UID, method: 'POST', endpoint: '/api/v2/conversations/42/replies', body: null, sorte: 'reponse', at: Date.now() - 25 * H, exp: Date.now() - H }] } });
    let parti = 0; g.ctx.executerPourApp = async () => { parti++; return { ok: true }; };
    await g.ctx.viderFileReseau();
    dit(parti === 0 && (g.store.vrmFileReseau || []).length === 0, 'E un geste en attente depuis plus de 24 h sort sans partir', JSON.stringify({ parti, file: g.store.vrmFileReseau }));
    // Pause de Vinted au retour : il reste.
    const h = fond({ enLigne: true, store: { vrmFileReseau: [{ id: 'r2', uid: UID, method: 'POST', endpoint: '/api/v2/conversations/42/replies', body: null, sorte: 'reponse', at: Date.now(), exp: Date.now() + H }] } });
    h.ctx.executerPourApp = async () => ({ ok: false, code: 'vinted-pause' });
    await h.ctx.viderFileReseau();
    dit((h.store.vrmFileReseau || []).length === 1 && h.store.vrmFileReseau[0].essais === 1, 'E Vinted demande une pause au retour ⇒ le geste reste en file', JSON.stringify(h.store.vrmFileReseau));
    const annule = await f.ctx.annulerFileReseau('inexistant');
    dit(annule && annule.ok === false, 'E annuler un geste inconnu ne fait rien', JSON.stringify(annule));
  });

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();

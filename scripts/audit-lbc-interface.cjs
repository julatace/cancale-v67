// ════════════════════════════════════════════════════════════════════════════
//  « ON NE FAIT PLUS LES REQUÊTES » — LEBONCOIN (Julien, 21 nov., ext. 5.416.0 — `lbcinterface`)
//        node scripts/audit-lbc-interface.cjs [--src background.js] [--inject f] [--relay f] [--ecrire f] [--lbc f] [--prouve]
//
//  Une ÉCRITURE chez Leboncoin (méthode ≠ GET) ne part plus JAMAIS d'une requête fabriquée par VRM : la mise en
//  pause, la suppression, le prix et la réponse se font par la PAGE (lbc-ecrire.js clique et tape dans un onglet
//  de travail leboncoin.fr ; la page envoie ; lbc-inject.js VOIT l'envoi). Les LECTURES (GET, et la relecture
//  des pages de « Mes annonces » que le site a lui-même demandées) restent.
//   S1  statique : lbc-inject.js n'envoie aucune écriture (seule méthode ≠ GET permise : la relecture des pages
//       de SA liste `dashboard/v1/search`, une RECHERCHE, dans `completerListe`) ; plus aucune recette rejouée
//   S2  statique : lbc-inject.js n'exécute plus les ordres `pause`, `supprime`, `repondre`, `prix`
//   S3  statique : lbc-relay.js ne porte plus d'ordre d'écriture (seuls `importpage` et `etat`, deux lectures)
//   S4  statique : lbc-ecrire.js n'envoie rien lui-même (ni fetch, ni XHR, ni beacon, ni socket) ; lbc.js non plus
//   S5  statique : le fond n'envoie aucune écriture à Leboncoin, et ses quatre gestes passent par `gesteLbcInterface`
//   S6  statique : lbc-ecrire.js est déclaré pour leboncoin.fr, dans le monde ISOLÉ (pas MAIN), cadre principal
//   V1–V13 exécuté (VRAI background.js dans `_fond-vm.cjs`) : chaque geste ouvre un onglet de travail à l'adresse
//       APPRISE, vérifie le compte de CET onglet, envoie `lbcGesteUI` (jamais une requête), « fait » sur la preuve
//       seule, place rendue si rien n'est parti, onglet refermé, pause 403/429, arrêt sur une vérification, rien
//       sans geste appris ; la base ne reçoit que « appris ».
//  `--prouve` : chaque règle réaffaiblie doit faire rougir l'audit.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const EXT = path.join(__dirname, '..', 'vinted-sync-extension');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F = {
  src: arg('--src', path.join(EXT, 'background.js')),
  inject: arg('--inject', path.join(EXT, 'lbc-inject.js')),
  relay: arg('--relay', path.join(EXT, 'lbc-relay.js')),
  ecrire: arg('--ecrire', path.join(EXT, 'lbc-ecrire.js')),
  lbc: arg('--lbc', path.join(EXT, 'lbc.js')),
};

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['recetteRevenue', 'inject', 'const RECETTES_REQUETE_LBC = false;', 'const RECETTES_REQUETE_LBC = true;'],
    ['ecritureCapteur', 'inject', "  try { surOrdre((d) => {\n    if (!d || d.__tag !== 'CANCALE_LBC_ORDRE' || d.kind !== 'etat') return;", "  try { surOrdre((d) => { if (d && d.kind === 'pause') origFetch.call(window, 'https://api.leboncoin.fr/api/pintad/v1/public/manual/pause/ads', { method: 'PUT', body: '{}' }); }); } catch (_) {}\n  try { surOrdre((d) => {\n    if (!d || d.__tag !== 'CANCALE_LBC_ORDRE' || d.kind !== 'etat') return;"],
    ['ordreRelais', 'relay', "  const ecoutesEcrire=[];", "  const ecoutesEcrire=[];\n  try{chrome.runtime.onMessage.addListener((msg)=>{if(msg&&msg.action==='lbcPauseAnnonce')versCapteur({__tag:'CANCALE_LBC_ORDRE',kind:'pause',id:msg.id});});}catch(_){}"],
    ['ecrireFetch', 'ecrire', "  const cliquer = async (el) => {", "  const envoyerDirect = (u, b) => fetch(u, { method: 'PUT', body: b });\n  const cliquer = async (el) => {"],
    ['pauseRequete', 'src', "    const g = await gesteLbcInterface('pause', compte, url, { id }, 60000);", "    const g = { rep: await avecDelai(chrome.tabs.sendMessage(o.tabId || 1, { from: 'vrm-fond', action: 'lbcPauseAnnonce', id, compte }, { frameId: 0 }), 25000, null) };"],
    ['sansCompteOnglet', 'src', "    if (c.compte !== 'lbc-account:' + compte) return { rien: true, code: 'autre-compte', autre: idCompteLbc(c.compte) };\n", ''],
    ['faitSansPreuve', 'src', "  if (rep.envoye === true) return { etat: 'incertain', defi: rep.defi === true || rep.erreur === 'verification' };", "  if (rep.envoye === true) return { etat: 'vu', statut: 200 };"],
    ['sansApprentissage', 'src', "    if (!ui) return { accepte: false, code: 'pas-appris', raison: raisonPasApprisLbc('pause') };\n    const url = adresseUiLbc(ui, { ad: id });\n    if (!url) return { accepte: false, code: 'pas-appris', raison: raisonPasApprisLbc('pause') };", "    const url = 'https://www.leboncoin.fr/compte/part/mes-annonces';"],
    ['ongletGarde', 'src', "  } finally { try { await chrome.tabs.remove(t.id); } catch (_) {} }", '  } finally { }'],
    ['placeGardee', 'src', "  if (g.rien) { await rendreActions('lbc:' + compte, depuisLbc, 1); return g.code === 'autre-compte'", "  if (g.rien) { return g.code === 'autre-compte'"],
    ['sansFrein403', 'src', "  if (statut === 429 || statut === 403) { await poserPauseLbcMsg(statut); return { accepte: true, etape: 'refuse', statut, raison: `Leboncoin a refusé (${statut}) — VRM se met en pause 30 min sur Leboncoin` }; }", ''],
    ['sansVerification', 'src', "  if (is.defi) { await secuObserver('leboncoin', compte, { status: 403, defi: true }); await poserPauseLbcMsg(403); }", ''],
    ['baseSignature', 'src', "data: { appris, mode: 'interface', raison, at: new Date().toISOString(), ver: CODE_VERSION } }], 'id');", "data: { appris, mode: 'interface', raison, ui, at: new Date().toISOString(), ver: CODE_VERSION } }], 'id');"],
    ['prixSansId', 'src', "    if (!url || !url.includes(id)) return { accepte: false, code: 'pas-rejouable',", "    if (!url) return { accepte: false, code: 'pas-rejouable',"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-lbc-interface-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    const fichier = path.join(tmp, nom + '-' + path.basename(F[cle]));
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const args = [__filename, '--' + cle, fichier];
    for (const k of Object.keys(F)) if (k !== cle) args.push('--' + k, F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 600000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + String(d).slice(0, 700) : '')); } };
// Les commentaires retirés (§6.4 : juger la règle, pas son orthographe) ; les chaînes gardées.
function sansCommentaires(s) {
  let out = '', i = 0, q = null;
  while (i < s.length) {
    const c = s[i], n = s[i + 1];
    if (q) { out += c; if (c === '\\') { out += n || ''; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '/' && /[=(,:;!&|?{}\[]\s*$/.test(out.slice(-3)) ) { // une expression régulière littérale : copiée telle quelle
      out += c; i++; let cl = false; while (i < s.length) { const d = s[i]; out += d; i++; if (d === '\\') { out += s[i] || ''; i++; continue; } if (d === '[') cl = true; else if (d === ']') cl = false; else if (d === '/' && !cl) break; else if (d === '\n') break; }
      continue;
    }
    out += c; i++;
  }
  return out;
}
const lire = (k) => { try { return sansCommentaires(fs.readFileSync(F[k], 'utf8')); } catch (_) { return ''; } };
const ligneDe = (s, k) => s.slice(0, k).split('\n').length;
function corpsFonction(s, nom) {
  const i = s.search(new RegExp(`(?:async\\s+)?function\\s+${nom}\\s*\\(`));
  if (i < 0) return '';
  let q = s.indexOf('(', i), pp = 0; for (; q < s.length; q++) { if (s[q] === '(') pp++; else if (s[q] === ')') { pp--; if (!pp) break; } }
  let k = s.indexOf('{', q), p = 0;
  for (let j = k; j < s.length; j++) { if (s[j] === '{') p++; else if (s[j] === '}') { p--; if (!p) return s.slice(i, j + 1); } }
  return s.slice(i);
}
const METHODE_ECRITE = /\bmethod\s*:\s*([^,}\n]+)/g;

// ── S1 / S2
{ const S = lire('inject');
  const faux = [];
  let m; METHODE_ECRITE.lastIndex = 0;
  const lecturePermise = (() => { const i = S.indexOf('const completerListe = async'); const j = S.indexOf('\n  };', i); return i >= 0 && j > i ? [i, j] : [-1, -1]; })();
  while ((m = METHODE_ECRITE.exec(S))) {
    const v = m[1].trim();
    if (/^'GET'$/.test(v)) continue;
    // La seule autre : la relecture des pages de SA liste (une RECHERCHE `dashboard/v1/search` que le site a faite).
    if (v === "'POST'" && m.index > lecturePermise[0] && m.index < lecturePermise[1]) continue;
    faux.push(`l.${ligneDe(S, m.index)} method: ${v}`);
  }
  const xhr = (S.match(/new\s+(?:window\.)?XMLHttpRequest\s*\(|sendBeacon\s*\(|new\s+WebSocket\s*\(/g) || []).length;
  dit(!faux.length && !xhr, 'S1 — lbc-inject.js n’envoie AUCUNE écriture (seule exception : la relecture de SA liste, une recherche)', JSON.stringify({ faux, xhr }));
  dit(/const RECETTES_REQUETE_LBC = false;/.test(S) && /function noteEnvoiMsgLbc[^{]*\{\s*if \(!RECETTES_REQUETE_LBC\) return;/.test(S) && /function noteEnvoiPrixLbc[^{]*\{\s*if \(!RECETTES_REQUETE_LBC\) return;/.test(S), 'S1 — plus aucune recette apprise pour être rejouée (message, prix)');
  const kinds = [];
  const re = /d\.kind\s*!==?\s*'([a-z]+)'|hasOwnProperty\.call\(\s*ORDRES_LBC|ORDRES_LBC\s*=/g; let k;
  while ((k = re.exec(S))) kinds.push(k[1] || 'ORDRES_LBC');
  const ordresEcriture = kinds.filter((x) => /^(pause|supprime|repondre|prix|ORDRES_LBC)$/.test(x));
  dit(!ordresEcriture.length && !/manual\/pause\/ads'|manual\/delete\/ads'/.test(S.replace(/RETRAIT_PAGE[^;]+;/, '')), 'S2 — lbc-inject.js n’exécute plus les ordres « pause », « supprime », « répondre », « prix » (ni adresse d’écriture écrite en dur)', JSON.stringify({ kinds, ordresEcriture }));
  dit(/gesteVuLbc\(url, meth,/.test(S) && /gesteVuLbc\(url, this\.__lbcMeth,/.test(S) && /kind: 'lbcgestevu'/.test(S) && /versRelais\(\{ kind: 'lbcgestevu'/.test(S) && !/post\(\{ kind: 'lbcgestevu'/.test(S), 'S2 — le capteur REGARDE les écritures de la page (fetch et XHR) et le dit par le canal PRIVÉ seulement', ''); }
// ── S3
{ const S = lire('relay');
  const ecouteEcriture = /msg\.action\s*!==?\s*'(lbcPauseAnnonce|lbcSupprimeAnnonce|lbcRepondre|lbcPrixAnnonce)'/.test(S);
  const kinds = [...S.matchAll(/versCapteur\(\{__tag:'CANCALE_LBC_ORDRE',kind:'?([a-z]+)'?/g)].map((x) => x[1]);
  dit(!ecouteEcriture && kinds.length && kinds.every((x) => x === 'importpage' || x === 'etat') && !/kind:msg\.action/.test(S), 'S3 — lbc-relay.js ne porte plus d’ordre d’écriture (seuls « importpage » et « etat », deux lectures)', JSON.stringify({ ecouteEcriture, kinds })); }
// ── S4
{ const E = lire('ecrire'), L = lire('lbc');
  const appels = (E.match(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|\.open\s*\(/g) || []);
  const fauxL = []; let m; METHODE_ECRITE.lastIndex = 0;
  while ((m = METHODE_ECRITE.exec(L))) if (!/^'GET'$/.test(m[1].trim())) fauxL.push(`l.${ligneDe(L, m.index)} ${m[1]}`);
  dit(E.length > 1000 && /lbcGesteUI/.test(E) && !appels.length, 'S4 — lbc-ecrire.js n’envoie rien lui-même : il clique et tape, la page envoie', JSON.stringify(appels));
  dit(!fauxL.length && !/XMLHttpRequest|sendBeacon/.test(L), 'S4 — lbc.js (le dépôt par le formulaire) n’envoie aucune écriture', JSON.stringify(fauxL)); }
// ── S5
{ const B = lire('src');
  const anciens = (B.match(/action:\s*'(lbcPauseAnnonce|lbcSupprimeAnnonce|lbcRepondre|lbcPrixAnnonce)'/g) || []);
  const fauxF = []; const re = /\bfetch\s*\(/g; let m;
  while ((m = re.exec(B))) {
    let p = 0, j = m.index + m[0].length - 1; for (; j < B.length; j++) { if (B[j] === '(') p++; else if (B[j] === ')') { p--; if (!p) break; } }
    const a = B.slice(m.index, j + 1);
    if (!/leboncoin|URL_PDF_LBC|lbc/i.test(a.slice(0, 160))) continue;
    const mm = /\bmethod\s*:\s*([^,}\n]+)/.exec(a);
    if (mm && !/^\s*'GET'\s*$/.test(mm[1])) fauxF.push(`l.${ligneDe(B, m.index)} ${a.slice(0, 120)}`);
  }
  dit(!anciens.length && !fauxF.length, 'S5 — le fond n’envoie plus aucun ordre de requête à la page, ni aucune écriture à Leboncoin', JSON.stringify({ anciens, fauxF }));
  const gestes = { pauseLbcDepuisApp: 'pause', supprimeLbcDepuisApp: 'supprime', baisserPrixLbc: 'prix', repondreLeboncoin: 'message' };
  const sans = Object.entries(gestes).filter(([fn, q]) => { const c = corpsFonction(B, fn); return !c.includes(`gesteLbcInterface('${q}',`) || /chrome\.tabs\.sendMessage\(/.test(c); });
  dit(!sans.length, 'S5 — pause, suppression, prix, réponse : chacun passe par `gesteLbcInterface` (l’onglet de travail), aucun ne parle à la page lui-même', JSON.stringify(sans.map((x) => x[0])));
  const g = corpsFonction(B, 'gesteLbcInterface');
  dit(/action: 'lbcGesteUI'/.test(g) && /attendreSessionOnglet\(/.test(g) && /chrome\.tabs\.remove\(t\.id\)/.test(g) && /finally/.test(g), 'S5 — `gesteLbcInterface` : la session de CET onglet lue, `lbcGesteUI` envoyé, l’onglet refermé quoi qu’il arrive'); }
// ── S6
{ let man = null; try { man = JSON.parse(fs.readFileSync(path.join(path.dirname(F.ecrire), 'manifest.json'), 'utf8')); } catch (_) {}
  const cs = ((man && man.content_scripts) || []).filter((c) => (c.js || []).includes('lbc-ecrire.js'));
  dit(cs.length === 1 && cs[0].world !== 'MAIN' && cs[0].all_frames === false && (cs[0].matches || []).every((x) => /leboncoin\.fr/.test(x)), 'S6 — lbc-ecrire.js : leboncoin.fr seulement, monde ISOLÉ, cadre principal', JSON.stringify(cs)); }

// ── V : le VRAI fond, exécuté
const MON = '8442aaaa-0000-4000-8000-000000000001', AUTRE = 'faf3bbbb-0000-4000-8000-000000000002';
const ID = '3290000104', CONV = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const UI = {
  pause: { etapes: [{ sig: { tag: 'button', ce: false, attrs: { 'aria-label': 'Plus d’options' } }, portee: 'ligne' }, { sig: { tag: 'button', ce: false, attrs: { role: 'menuitem' }, mot: 'Désactiver' }, portee: 'page' }, { sig: { tag: 'button', ce: false, attrs: {}, mot: 'Confirmer' }, portee: 'page' }], page: { modele: '/compte/part/mes-annonces', recherche: '', porte: false } },
  supprime: { etapes: [{ sig: { tag: 'button', ce: false, attrs: { 'aria-label': 'Plus d’options' } }, portee: 'ligne' }, { sig: { tag: 'button', attrs: {}, mot: 'Supprimer' }, portee: 'page' }, { sig: { tag: 'button', attrs: {}, mot: 'Supprimer définitivement' }, portee: 'page' }], page: { modele: '/compte/part/mes-annonces', recherche: '', porte: false } },
  prix: { champ: { tag: 'input', ce: false, attrs: { name: 'price' } }, sep: '.', etapes: [{ sig: { tag: 'button', attrs: {}, mot: 'Valider les modifications' }, portee: 'page' }], page: { modele: '/compte/part/annonce/{ad}/modifier', recherche: '', porte: true } },
  message: { champ: { tag: 'textarea', ce: false, attrs: { 'aria-label': 'Écrire un message' } }, envoi: { sig: { tag: 'button', attrs: {}, mot: 'Envoyer' } }, page: { modele: '/messages/id/{conv}', recherche: '', porte: true } },
};
const lignes = () => ({
  lbc_listings: { items: { [ID]: { id: ID, subject: 'Nike shox TL noir', account: MON, status: 'active', price: 120, ref: '18' } } },
  lbc_accounts: { accounts: { ['lbc-account:' + MON]: { id: MON, name: 'Totomondu' }, ['lbc-account:' + AUTRE]: { id: AUTRE, name: 'ShopAutre' } } },
  ['lbc_fil_' + CONV]: { v: 1, conv: CONV, compte: MON, messages: [{ id: 'm1', t: 'Bonjour', deMoi: false, at: '2026-11-21T08:00:00Z' }], n: 1 },
});
function fond({ ui = UI, compteTravail = MON, reponse = () => ({ ok: true, statut: 200, confirme: true, geste: true }), store = {} } = {}) {
  const st = Object.assign({ vrmLbcUi: ui, vrmLbcTransport: { 1: { source: 'prive', compte: 'lbc-account:' + MON, at: Date.now() } } }, store);
  const f = faireFond({ src: F.src, lignes: lignes(), store: st, onglets: [{ id: 1, url: 'https://www.leboncoin.fr/compte/part/mes-annonces', status: 'complete' }] });
  const T = f.ctx.chrome.tabs, journal = { crees: [], fermes: [], ordres: [] };
  let prochain = 100;
  T.create = async (o = {}) => { const id = prochain++; journal.crees.push({ id, url: o.url, active: o.active }); f.store.vrmLbcTransport = Object.assign({}, f.store.vrmLbcTransport, { [id]: { source: 'prive', compte: 'lbc-account:' + compteTravail, at: Date.now() } }); return { id, url: o.url }; };
  T.get = async (id) => { if (id === 1) return { id: 1, url: 'https://www.leboncoin.fr/compte/part/mes-annonces' }; const c = journal.crees.find((x) => x.id === id); if (!c || journal.fermes.includes(id)) throw new Error('No tab'); return { id, url: c.url }; };
  T.remove = async (id) => { journal.fermes.push(id); };
  T.sendMessage = async (id, msg) => { journal.ordres.push({ id, msg: JSON.parse(JSON.stringify(msg)) }); if (msg.action === 'lbcEcrirePret') return { ok: true, canal: true }; if (msg.action === 'lbcGesteUI') return reponse(msg); return undefined; };
  f.ctx.attendreSessionOnglet = async (tabId) => { const c = (f.store.vrmLbcTransport || {})[tabId]; return c && c.source === 'prive' ? c : null; };
  f.ctx.avecDelai = (p, ms, d) => Promise.race([p, new Promise((r) => setTimeout(() => r(d), Math.min(ms, 3000)))]);
  return Object.assign(f, { journal, gestes: () => journal.ordres.filter((o) => o.msg.action === 'lbcGesteUI') });
}
const ecrituresLbc = (f) => [...(f.j.ailleurs || []), ...(f.j.horsVinted || [])].filter((x) => /leboncoin/.test(String(x.url)) && String(x.methode || 'GET') !== 'GET');
const item = (f) => (((f.lignes.lbc_listings || {}).items || {})[ID]) || {};

(async () => {
  // V1 — pause : onglet de travail à l'adresse apprise, compte de CET onglet, `lbcGesteUI`, « fait » sur la preuve
  { const f = fond();
    const r = await f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID });
    const g = f.gestes();
    dit(r && r.etape === 'fait' && r.statut === 200, 'V1 — pause : « fait » (la page a envoyé la pause, vue par le capteur)', JSON.stringify(r));
    dit(f.journal.crees.length === 1 && f.journal.crees[0].url === 'https://www.leboncoin.fr/compte/part/mes-annonces' && f.journal.crees[0].active === false, 'V1 — un onglet de TRAVAIL en arrière-plan, à la page apprise', JSON.stringify(f.journal.crees));
    dit(g.length === 1 && g[0].id === 100 && g[0].msg.quoi === 'pause' && g[0].msg.id === ID && g[0].msg.compte === MON && Object.keys(g[0].msg).sort().join() === 'action,compte,from,id,quoi', 'V1 — UN ordre d’INTERFACE (`lbcGesteUI`) à l’onglet de travail : l’annonce par son identifiant, le compte attendu', JSON.stringify(g));
    dit(f.journal.fermes.includes(100) && !!item(f).pauseAt && !ecrituresLbc(f).length, 'V1 — l’onglet de travail est refermé ; la pause notée ; AUCUNE requête d’écriture du fond vers Leboncoin', JSON.stringify({ f: f.journal.fermes, it: item(f) })); }
  // V2 — pas appris ⇒ rien (aucun onglet, aucune place prise)
  { const f = fond({ ui: {} });
    const r = await f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID });
    dit(r && r.accepte === false && r.code === 'pas-appris' && /à la main|toi-même/.test(r.raison) && !f.journal.crees.length && !((f.store.vrmActions || {})['lbc:' + MON] || []).length, 'V2 — interface jamais apprise : rien (aucun onglet, aucune place), et le geste à faire une fois à la main est dit', JSON.stringify(r)); }
  // V3 — l'onglet de travail est sur un AUTRE compte ⇒ rien, place rendue, onglet refermé
  { const f = fond({ compteTravail: AUTRE });
    const r = await f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID });
    dit(r && r.code === 'autre-compte' && /ShopAutre/.test(r.raison) && !f.gestes().length && f.journal.fermes.includes(100) && !((f.store.vrmActions || {})['lbc:' + MON] || []).length, 'V3 — l’onglet de travail est connecté sur un autre compte : aucun geste, place rendue, onglet refermé, les comptes nommés', JSON.stringify({ r, a: f.store.vrmActions })); }
  // V4 — la page n'a pas montré une étape ⇒ arrêt avant, l'élément nommé, rien de noté
  { const f = fond({ reponse: () => ({ ok: true, statut: 0, erreur: 'etape-introuvable', etape: 3, element: 'Supprimer définitivement', derniere: true, geste: true }) });
    const r = await f.ctx.supprimeLbcDepuisApp({ cmd: 'lbcSupprime', id: ID, confirme: true, sansRetour: true });
    dit(r && r.accepte === false && r.code === 'etape-introuvable' && /Supprimer définitivement/.test(r.raison) && /rien n'est parti/.test(r.raison) && item(f).status === 'active' && !((f.store.vrmActions || {})['lbc:' + MON] || []).length, 'V4 — un bouton pas apparu : arrêt AVANT le geste final, l’élément nommé, place rendue, rien de noté', JSON.stringify(r)); }
  // V5 — clic final fait, rien vu ⇒ « je ne sais pas », jamais « fait »
  { const f = fond({ reponse: () => ({ ok: true, statut: 0, erreur: 'pas-vu', envoye: true, geste: true }) });
    const r = await f.ctx.supprimeLbcDepuisApp({ cmd: 'lbcSupprime', id: ID, confirme: true, sansRetour: true });
    dit(r && r.etape === 'incertain' && item(f).status === 'active' && !item(f).supprimeeAt, 'V5 — la page n’a pas été vue envoyer : « je ne sais pas », jamais « fait », rien de noté', JSON.stringify(r)); }
  // V6 — 403 vu ⇒ refusé + pause 30 min ; la suivante ne part pas (aucun onglet)
  { const f = fond({ reponse: () => ({ ok: true, statut: 403, confirme: false, geste: true }) });
    const r = await f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID });
    const n = f.journal.crees.length;
    const r2 = await f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID });
    dit(r && r.etape === 'refuse' && r.statut === 403 && !item(f).pauseAt && r2 && r2.accepte === false && (r2.code === 'lbc-pause' || /prudence|ralentir/i.test(r2.raison || '')) && f.journal.crees.length === n, 'V6 — Leboncoin refuse (403, vu sur la page) : « pas fait », pause posée, la suivante ne part pas', JSON.stringify({ r, r2 })); }
  // V7 — une vérification VISIBLE ⇒ ce compte s'arrête (anti-robot)
  { const f = fond({ reponse: () => ({ ok: true, statut: 0, erreur: 'verification', defi: true }) });
    const r = await f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID });
    const r2 = await f.ctx.baisserPrixLbc({ id: ID, prixAvant: 120, prix: 100, confirme: true });
    dit(r && r.accepte === false && r.code === 'verification' && r2 && r2.accepte === false && f.gestes().length === 1, 'V7 — une vérification visible : arrêt, et plus rien ne part sur ce compte (anti-robot)', JSON.stringify({ r, r2 })); }
  // V8 — supprimer : confirmation exigée ; confirmée ⇒ par l'interface, notée supprimée sur la preuve
  { const f = fond();
    const r0 = await f.ctx.supprimeLbcDepuisApp({ cmd: 'lbcSupprime', id: ID, confirme: true });
    const r = await f.ctx.supprimeLbcDepuisApp({ cmd: 'lbcSupprime', id: ID, confirme: true, sansRetour: true });
    const g = f.gestes();
    dit(r0 && r0.code === 'sans-retour' && r && r.etape === 'fait' && g.length === 1 && g[0].msg.quoi === 'supprime' && item(f).status === 'deleted', 'V8 — Supprimer reste SON clic confirmé (« sans retour ») ; confirmé : par l’interface, notée supprimée sur la preuve', JSON.stringify({ r0: r0 && r0.code, r, g })); }
  // V9 — prix : la FICHE de l'annonce (son identifiant dans l'adresse), le prix lu et le nouveau, « fait » si la page envoie CE prix
  { const f = fond({ reponse: () => ({ ok: true, statut: 200, confirme: true, prixVu: 100, geste: true }) });
    const r = await f.ctx.baisserPrixLbc({ id: ID, prixAvant: 120, prix: 100, confirme: true });
    const g = f.gestes();
    dit(r && r.etape === 'fait' && r.prixVu === 100 && f.journal.crees[0].url === `https://www.leboncoin.fr/compte/part/annonce/${ID}/modifier` && g[0].msg.prix === 100 && g[0].msg.prixAvant === 120, 'V9 — prix : la fiche de CETTE annonce (son identifiant dans l’adresse), prix lu + nouveau, « fait » quand la page envoie CE prix', JSON.stringify({ r, c: f.journal.crees, g })); }
  { const f = fond({ reponse: () => ({ ok: true, statut: 200, confirme: true, prixVu: 90, geste: true }) });
    const r = await f.ctx.baisserPrixLbc({ id: ID, prixAvant: 120, prix: 100, confirme: true });
    dit(r && r.etape === 'ecart' && r.prixVu === 90, 'V9 — la page a envoyé un AUTRE prix : « écart », jamais « fait »', JSON.stringify(r)); }
  // V10 — prix appris sur une page sans l'annonce dans l'adresse ⇒ rien (on ne pourrait pas vérifier la fiche)
  { const f = fond({ ui: Object.assign({}, UI, { prix: Object.assign({}, UI.prix, { page: { modele: '/compte/part/mes-annonces', recherche: '' } }) }) });
    const r = await f.ctx.baisserPrixLbc({ id: ID, prixAvant: 120, prix: 100, confirme: true });
    dit(r && r.accepte === false && r.code === 'pas-rejouable' && !f.journal.crees.length, 'V10 — un prix appris sur une page qui ne porte pas l’annonce : rien (la fiche ne pourrait pas être vérifiée)', JSON.stringify(r)); }
  // V11 — répondre : CETTE conversation (son identifiant dans l'adresse), le texte, « fait » sur la preuve ; le fil le garde
  { const f = fond();
    const r = await f.ctx.repondreLeboncoin({ conv: CONV, texte: 'Oui, envoi lundi' });
    const g = f.gestes();
    const fil = f.lignes['lbc_fil_' + CONV] || {};
    dit(r && r.etape === 'fait' && f.journal.crees[0].url === 'https://www.leboncoin.fr/messages/id/' + CONV && g.length === 1 && g[0].msg.quoi === 'message' && g[0].msg.conv === CONV && g[0].msg.texte === 'Oui, envoi lundi', 'V11 — répondre : l’onglet de travail sur CETTE conversation, le texte pour la page, « fait » sur la preuve', JSON.stringify({ r, c: f.journal.crees, g }));
    dit(Array.isArray(fil.messages) && fil.messages.some((m) => m.t === 'Oui, envoi lundi' && m.deMoi === true), 'V11 — le message envoyé rejoint le fil (« envoyé depuis VRM »)', JSON.stringify(fil.messages)); }
  // V12 — ce qui est appris : la base ne reçoit que « appris : oui / non » (jamais une signature, jamais un texte)
  { const f = fond();
    const sender = { tab: { id: 1, url: 'https://www.leboncoin.fr/messages/id/' + CONV }, frameId: 0 };
    await new Promise((res) => { const ec = f.ctx.chrome.runtime.onMessage; void ec; res(); });
    const ok1 = await f.ctx.noterUiLbc({ quoi: 'message', appris: true });
    const l = f.lignes.lbc_envoi || null;
    dit(ok1 === true && l && l.appris === true && l.mode === 'interface' && !JSON.stringify(l).includes('Envoyer') && !JSON.stringify(l).includes('textarea'), 'V12 — la base reçoit « appris » (mode interface), jamais la signature apprise', JSON.stringify(l));
    void sender; }
  // V13 — en série (« Leur écrire »), chaque message passe par l'interface ; sans interface apprise : rien
  { const f = fond({ ui: {} });
    const r = await f.ctx.repondreLeboncoin({ conv: CONV, texte: 'Bonjour' });
    dit(r && r.code === 'pas-appris' && !f.journal.crees.length, 'V13 — réponse sans interface apprise : rien, et le geste à faire est dit', JSON.stringify(r)); }

  console.log(`\n${ko ? '❌' : '✅'} audit-lbc-interface : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });

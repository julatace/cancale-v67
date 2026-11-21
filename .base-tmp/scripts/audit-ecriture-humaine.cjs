// ════════════════════════════════════════════════════════════════════════════
//  TEMPS D'ÉCRITURE ET MESSAGES VARIÉS (12 nov., ext. 5.369 — validé par Julien)
//
//  Julien, mot pour mot : « Un temps d'écriture avant chaque envoi. L'extension
//  attend le temps qu'un humain mettrait à taper ce message, par exemple 8 à 20
//  secondes pour une phrase, avec un peu de hasard, puis l'envoie d'un coup. » et
//  « Personne ne reçoit exactement la même phrase que le précédent. Tes 50
//  actions par heure ne changent pas. »
//
//  On EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs : faux Vinted qui
//  note chaque requête, faux serveur VRM, `chrome.storage.local` à état) :
//    1. la règle recopiée est IDENTIQUE à src/variantesMessage.js ;
//    2. la durée est bornée (5–45 s ; 2–6 s sur son clic) et proportionnelle au texte ;
//    3. jamais deux fois la même version de suite ; une seule version = le texte d'avant ;
//    4. favoris : l'attente a lieu avant le message, rien d'envoyé pendant ; une
//       pause de Vinted ou un autre compte PENDANT l'attente ⇒ aucun message,
//       places rendues, aucune action de plus réservée ;
//    5. refus automatique : versions alternées, temps d'écriture DANS la file
//       une-à-la-fois, pause pendant l'attente ⇒ rien ne part ;
//    6. sa réponse sur clic : 2 à 6 s, autre compte pendant l'attente ⇒ rien ne part ;
//    7. aucune touche simulée : aucune injection dans la page pendant l'attente,
//       aucun `KeyboardEvent`/`dispatchEvent`/`.click()` dans le code de l'attente ;
//    8. le journal note le n° de la version (jamais le texte).
//  §6.1 — `BG_SRC=<ancien background.js>` : sur la branche de départ (5.362),
//  rouge (pas d'attente, pas de versions).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const { faireFond } = require('./_fond-vm.cjs');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + String(d).slice(0, 400) : '')); } };
const UID = '111', JETON = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SRC = process.env.BG_SRC ? path.resolve(process.env.BG_SRC) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const ACC = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' };
const ecr = (f) => (f.ctx.__vrmPausesVues || []).filter((x) => /^ecriture:/.test(x[0]));

function monterFavori({ message = 'Bonjour !', variantes, pendant = null, f: f0 = null } = {}) {
  const conv = { id: 301, opposite_user: { id: 201, login: 'pseudo_banc' }, transaction: { id: 5001, item_id: 101 }, allow_reply: true, messages: [] };
  const f = f0 || faireFond({ src: SRC, connecte: UID,
    vinted: (e) => {
      if (e.methode === 'POST' && /\/api\/v2\/conversations$/.test(e.chemin)) return { status: 200, body: { conversation: conv, code: 0 } };
      if (e.methode === 'GET' && /\/api\/v2\/transactions\/\d+$/.test(e.chemin)) return { status: 200, body: { transaction: { id: 5001, item_id: 101, item: { id: 101, price: { amount: '50.0', currency_code: 'EUR' } } } } };
      if (e.methode === 'POST' && /\/replies$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      return { status: 404, body: {} };
    } });
  if (!f0) {
    const fetchFond = f.ctx.fetch;
    f.ctx.fetch = async (url, o = {}) => {
      if (String(url).startsWith('https://vrm.center/api/compte')) {
        const c = JSON.parse(o.body || '{}');
        const j = c.action === 'consommer'
          ? { ok: true, uid: UID, suivi: 's', travail: { itemId: '101', recipientId: '201', initiator: 'native-fixture', message: f.__message, ...(f.__variantes ? { variantes: f.__variantes } : {}) } }
          : { ok: true, autorise: true, uid: UID };
        return { ok: true, status: 200, json: async () => j };
      }
      return fetchFond(url, o);
    };
    f.ctx.authToken = async () => ({ access_token: 'session' });
    f.ctx.notifierApp = async () => {};
    f.ctx.__vrmPausesVues = [];
    // Les injections dans la page : comptées, et leur code gardé (aucune touche simulée).
    const exec = f.ctx.chrome.scripting.executeScript;
    f.injections = [];
    f.ctx.chrome.scripting.executeScript = async (o) => { f.injections.push({ n: ecr(f).length, code: String(o && o.func) }); return exec(o); };
  }
  f.__message = message; f.__variantes = variantes;
  if (pendant) pendant(f);
  return f;
}
const replies = (f) => f.j.vinted.filter((v) => v.methode === 'POST' && /\/replies$/.test(v.chemin)).map((v) => { try { return JSON.parse(v.corps).reply.body; } catch (_) { return null; } });
const places = (f) => ((f.store.vrmActions || {})[UID] || []).length;

(async () => {
  // ── 1. la copie ──
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'variantesMessage.js'), 'utf8');
  const bg = fs.readFileSync(SRC, 'utf8');
  const bloc = (s) => { const a = s.indexOf('// <variantes-regle>'), b = s.indexOf('// </variantes-regle>'); return a >= 0 && b > a ? s.slice(a, b) : null; };
  dit(bloc(app) && bloc(app) === bloc(bg), "la règle <variantes-regle> de l'extension est la copie exacte de src/variantesMessage.js");

  const f0 = monterFavori();
  const C = f0.ctx;
  const regleLa = typeof C.tempsEcritureMs === 'function' && typeof C.choisirVariante === 'function' && typeof C.versionsMessage === 'function';
  dit(regleLa, "l'extension porte tempsEcritureMs, choisirVariante, versionsMessage");

  // ── 2. la durée ──
  if (regleLa) {
    const t = (n, h, mode) => C.tempsEcritureMs('x'.repeat(n), mode, () => h);
    const tous = []; for (const n of [0, 1, 10, 40, 60, 100, 150, 250, 2000]) for (const h of [0, 0.37, 0.5, 0.99, 1]) tous.push([n, h, t(n, h)]);
    dit(tous.every(([, , ms]) => ms >= 5000 && ms <= 45000), 'série : toujours entre 5 s et 45 s', JSON.stringify(tous.filter(([, , ms]) => ms < 5000 || ms > 45000)));
    dit(t(60, 0) >= 8000 && t(60, 1) <= 20000 && t(60, 0) < t(60, 1), 'une phrase (60 caractères) : entre 8 et 20 s, avec du hasard', `${t(60, 0)}–${t(60, 1)}`);
    dit(t(40, 0.5) < t(80, 0.5) && t(80, 0.5) < t(160, 0.5) && Math.abs(t(160, 0.5) / t(80, 0.5) - 2) < 0.01, 'proportionnelle à la longueur (deux fois plus long ⇒ deux fois plus de temps)', `${t(40, .5)} ${t(80, .5)} ${t(160, .5)}`);
    dit(Math.abs(t(100, 0) / t(100, 0.5) - 0.75) < 0.01 && Math.abs(t(100, 1) / t(100, 0.5) - 1.25) < 0.01, 'hasard de ±25 % autour de la vitesse de frappe', `${t(100, 0)} ${t(100, .5)} ${t(100, 1)}`);
    dit(t(2000, 0) === 45000 && t(1, 1) === 5000, 'bornes : 45 s au plus pour un long texte, 5 s au moins pour un mot');
    const c = [0, 0.5, 1].map((h) => t(500, h, 'clic'));
    dit(c[0] === 2000 && c[2] === 6000 && c.every((x) => x >= 2000 && x <= 6000), 'son clic « Envoyer » : 2 à 6 s (il a déjà tapé son texte)', c.join(','));

    // ── 3. les versions ──
    const v3 = C.versionsMessage('A', ['B', '', 'C']);
    dit(JSON.stringify(v3.map((v) => [v.n, v.texte])) === JSON.stringify([[1, 'A'], [2, 'B'], [4, 'C']]), "les versions gardent leur n° d'écran (une vide n'est jamais envoyée)", JSON.stringify(v3));
    let prec = null, repet = 0; const vus = new Set();
    for (let i = 0; i < 3000; i++) { const v = C.choisirVariante(v3, prec); if (v.n === prec) repet++; vus.add(v.n); prec = v.n; }
    dit(repet === 0 && vus.size === 3, 'jamais deux fois la même version de suite (3 000 tirages), toutes servent', `répétitions ${repet}, vues ${[...vus]}`);
    const deux = C.versionsMessage('A', ['B']); prec = null; let alt = true;
    for (let i = 0; i < 50; i++) { const v = C.choisirVariante(deux, prec); if (prec != null && v.n === prec) alt = false; prec = v.n; }
    dit(alt, 'deux versions : elles alternent');
    const une = C.versionsMessage('Seul texte', []);
    dit([null, 1, 2].every((p) => { const v = C.choisirVariante(une, p); return v && v.texte === 'Seul texte' && v.n === 1; }), "une seule version : toujours le texte d'avant");
    dit(C.choisirVariante(C.versionsMessage('', []), null) === null, 'aucune version : rien (jamais un texte inventé)');
  }

  // ── 4. favoris ──
  { const f = monterFavori({ message: 'Bonjour {username} !' });
    const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    const e = ecr(f);
    dit(r && r.json && r.json.resultat === 'envoye' && JSON.stringify(replies(f)) === JSON.stringify(['Bonjour pseudo_banc !']), "une seule version : le texte d'avant, personnalisé comme avant", JSON.stringify([r && r.json, replies(f)]));
    dit(e.length === 1 && e[0][0] === 'ecriture:serie' && e[0][1] >= 5000 && e[0][1] <= 45000 && e[0][2] === 'Bonjour pseudo_banc !'.length, "favori : un temps d'écriture sur la longueur du texte envoyé, 5–45 s", JSON.stringify(e));
    const avantR = f.injections.filter((x) => x.n === 1);
    dit(avantR.length === 1 && avantR.every((x) => !/KeyboardEvent|dispatchEvent|keydown|keypress|\.click\(/.test(x.code)), "pendant et après l'attente : UNE injection, la requête du message (aucune touche, aucun clic)", avantR.length);
    dit(places(f) === 2, 'favori sans offre : 2 actions réservées, comme avant (rien de plus pour l’attente)', places(f));
  }
  { const f = monterFavori({ message: 'Version un', variantes: ['Version deux', 'Version trois'] });
    const vers = [];
    for (let i = 0; i < 8; i++) { const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON }); vers.push(r && r.json && r.json.variante); }
    const txt = replies(f);
    const suite = txt.every((x, i) => i === 0 || x !== txt[i - 1]);
    dit(txt.length === 8 && suite && new Set(txt).size >= 2 && txt.every((x) => ['Version un', 'Version deux', 'Version trois'].includes(x)), 'favoris en série : jamais la même version que le message précédent, seulement SES textes', JSON.stringify(txt));
    dit(vers.every((v, i) => Number.isInteger(v) && ['Version un', 'Version deux', 'Version trois'][v - 1] === txt[i]), 'le n° de version rendu au serveur est celui du texte envoyé', JSON.stringify(vers));
  }
  for (const [nom, pendant, raison] of [
    ['une pause de Vinted (429)', (f) => { const p0 = f.ctx.pauseVinted; f.ctx.pauseVinted = async () => (ecr(f).length ? { jusqua: Date.now() + 3600000, status: 429 } : p0()); }, 'pause_vinted'],
    ['un autre compte dans l’onglet', (f) => { const c0 = f.ctx.compteConnecte; f.ctx.compteConnecte = async (d) => (ecr(f).length ? '999' : c0(d)); }, 'compte_vinted_different'],
  ]) {
    const f = monterFavori({ message: 'Bonjour !', pendant });
    const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    dit(ecr(f).length === 1 && replies(f).length === 0 && r && r.json && r.json.resultat === 'refuse' && r.json.raison === raison, `favori : ${nom} PENDANT l'attente ⇒ aucun message, « ${raison} »`, JSON.stringify([r && r.json, replies(f)]));
    dit(places(f) === 1, `favori : ${nom} ⇒ la place du message est rendue (seule la conversation compte)`, places(f));
  }

  // ── 5. refus automatique ──
  const monterRefus = (pendant) => {
    const f = faireFond({ src: SRC, connecte: UID, vinted: (e) => (/\/replies$/.test(e.chemin) ? { status: 200, body: { reply: { id: 1 } } } : { status: 200, body: {} }) });
    f.ctx.__vrmPausesVues = [];
    if (pendant) pendant(f);
    return f;
  };
  { const f = monterRefus();
    const vs = typeof f.ctx.versionsMessage === 'function' ? f.ctx.versionsMessage('Merci, trop bas', ['Pas à ce prix, désolé', 'Un peu plus haut ?']) : 'Merci, trop bas';
    const rs = [];
    for (let i = 0; i < 6; i++) rs.push(await f.ctx.repondreOffre({ uid: UID, tx: '9001', oid: String(7000 + i), quoi: 'reject', prix: 10, conv: '555', msg: vs }));
    const txt = replies(f);
    dit(txt.length === 6 && txt.every((x, i) => i === 0 || x !== txt[i - 1]), 'refus auto : jamais la même version que le refus précédent', JSON.stringify(txt));
    dit(ecr(f).length === 6 && ecr(f).every((x) => x[0] === 'ecriture:serie' && x[1] >= 5000 && x[1] <= 45000), "refus auto : un temps d'écriture avant chaque message", JSON.stringify(ecr(f)));
    dit(rs.every((r, i) => r && r.ok && Number.isInteger(r.variante) && vs[r.variante - 1 >= 0 ? vs.findIndex((v) => v.n === r.variante) : 0].texte === txt[i]), 'refus auto : le n° de version rendu est celui du texte parti', JSON.stringify(rs.map((r) => r && r.variante)));
  }
  { const f = monterRefus();
    const r = await f.ctx.repondreOffre({ uid: UID, tx: '9001', oid: '7001', quoi: 'reject', prix: 10, conv: '555', msg: 'Merci, trop bas' });
    dit(r && r.ok && JSON.stringify(replies(f)) === JSON.stringify(['Merci, trop bas']), "refus auto, un seul texte (forme d'avant) : ce texte, mot pour mot", JSON.stringify(replies(f))); }
  { const ordre = [];
    const f = monterRefus((g) => { const p0 = g.ctx.pauseVinted; let pose = false; g.ctx.pauseVinted = async () => { if (ecr(g).length && !pose) { pose = true; g.ctx.avecVinted(async () => { ordre.push('autre:' + replies(g).length); }); } return p0(); }; });
    await f.ctx.repondreOffre({ uid: UID, tx: '9001', oid: '7001', quoi: 'reject', prix: 10, conv: '555', msg: 'Merci, trop bas' });
    await new Promise((r) => setTimeout(r, 30));
    dit(ordre.length === 1 && ordre[0] === 'autre:1', "refus auto : l'attente est DANS la file une-à-la-fois (une demande arrivée pendant passe après le message)", JSON.stringify(ordre)); }
  { const f = monterRefus((g) => { const p0 = g.ctx.pauseVinted; g.ctx.pauseVinted = async () => (ecr(g).length ? { jusqua: Date.now() + 3600000, status: 403 } : p0()); });
    const r = await f.ctx.repondreOffre({ uid: UID, tx: '9001', oid: '7001', quoi: 'reject', prix: 10, conv: '555', msg: 'Merci, trop bas' });
    dit(ecr(f).length === 1 && replies(f).length === 0 && r && r.messagePasParti === true && places(f) === 1, "refus auto : pause de Vinted PENDANT l'attente ⇒ aucun message, sa place rendue", JSON.stringify([r, replies(f), places(f)])); }

  // ── 6. sa réponse sur clic ──
  const monterClic = (pendant) => {
    const f = faireFond({ src: SRC, connecte: UID, comptes: [ACC], vinted: (e) => (/\/replies$/.test(e.chemin) ? { status: 200, body: { reply: { id: 1 } } } : { status: 200, body: {} }) });
    f.ctx.__vrmPausesVues = [];
    if (pendant) pendant(f);
    return f;
  };
  { const f = monterClic();
    const r = await f.ctx.executerPourApp({ uid: UID, method: 'POST', endpoint: '/api/v2/conversations/555/replies', body: { reply: { body: 'Oui, toujours dispo', photo_temp_uuids: null, is_personal_data_sharing_check_skipped: false } } }, { origin: 'https://vrm.center' });
    const e = ecr(f);
    dit(r && r.ok && replies(f).length === 1 && e.length === 1 && e[0][0] === 'ecriture:clic' && e[0][1] >= 2000 && e[0][1] <= 6000, 'sa réponse sur clic : 2 à 6 s, puis envoyée', JSON.stringify([r && r.ok, e])); }
  { const f = monterClic((g) => { const c0 = g.ctx.compteConnecte; g.ctx.compteConnecte = async (d) => (ecr(g).length ? '999' : c0(d)); });
    const r = await f.ctx.executerPourApp({ uid: UID, method: 'POST', endpoint: '/api/v2/conversations/555/replies', body: { reply: { body: 'Oui', photo_temp_uuids: null, is_personal_data_sharing_check_skipped: false } } }, { origin: 'https://vrm.center' });
    dit(ecr(f).length === 1 && replies(f).length === 0 && r && !r.ok && r.code === 'vinted-autre' && places(f) === 0, "sa réponse : autre compte PENDANT l'attente ⇒ rien ne part, sa place rendue", JSON.stringify([r, places(f)])); }

  // ── 7. aucune touche simulée dans le code de l'attente ──
  { const m = /async function attendreEcriture[\s\S]*?\n}\n/.exec(bg);
    const corps = m ? m[0].replace(/\/\/[^\n]*/g, '') : '';
    dit(corps && !/KeyboardEvent|InputEvent|dispatchEvent|keydown|keyup|keypress|\.click\(|executeScript|executerMain|debugger|sendKeys/.test(corps), "l'attente n'injecte rien et ne simule aucune touche ni aucun clic", corps ? '' : 'attendreEcriture absente'); }

  // ── 8. le journal ──
  { const f = monterClic();
    const e = typeof f.ctx.entreeJournal === 'function' ? f.ctx.entreeJournal('offre_refusee', { a: '1', v: 3, texte: 'secret' }) : null;
    dit(e && e.v === 3 && !JSON.stringify(e).includes('secret'), 'le journal note le n° de version (3), jamais le texte', JSON.stringify(e));
    const e2 = f.ctx.entreeJournal('favori', { v: 9 });
    dit(e2 && e2.v === undefined, 'un n° de version hors 1–5 n’entre pas au journal', JSON.stringify(e2)); }

  console.log(ko ? `\n❌ écriture humaine : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ écriture humaine : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); process.exit(1); });

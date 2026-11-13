#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LE TEMPS ENTRE L'OFFRE ET LE MESSAGE AUX FAVORIS (12 nov., ext. 5.372)
//  Julien : « espace le temps où tu envoies l'offre et tu envoies le message » ;
//  puis « moins de temps d'écart mais il doit être aléatoire et marqué quand même ».
//  Le VRAI background.js dans un vm (scripts/_fond-vm.cjs), horloge du banc
//  (minuteries écrasées : l'attente se compte, elle ne se vit pas) :
//   · après l'offre ACCEPTÉE par Vinted : 8 à 20 s (entier, à la seconde), puis le
//     temps d'écriture (5.369), puis le message — dans cet ordre ;
//   · sans offre : aucune attente de plus ;
//   · tirages : toujours 8–20 s, jamais deux fois de suite la même valeur ;
//   · « Tout arrêter », captcha, pause 429, autre compte PENDANT l'attente ⇒
//     le message ne part pas, la raison est rendue, la place du message rendue ;
//   · l'attente est dans chrome.storage.local : un worker endormi au milieu,
//     un worker NEUF la reprend (message envoyé une fois) ; Tout arrêter posé
//     entre-temps ⇒ rien ne part ;
//   · l'attente ne prend aucune action du plafond.
//  `BG_SRC=chemin` : la preuve sur le code d'avant (5.371 ⇒ rouge).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const { faireFond } = require('./_fond-vm.cjs');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + String(d).slice(0, 400) : '')); } };
const UID = '111', JETON = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SRC = process.env.BG_SRC ? path.resolve(process.env.BG_SRC) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const ACC = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' };
const pauses = (f, re) => (f.ctx.__vrmPausesVues || []).filter((x) => re.test(x[0]));
const replies = (f) => f.j.vinted.filter((v) => v.methode === 'POST' && /\/replies$/.test(v.chemin)).map((v) => { try { return JSON.parse(v.corps).reply.body; } catch (_) { return null; } });
const places = (f) => ((f.store.vrmActions || {})[UID] || []).length;

function monter({ offre = true, apresOffre = null, store } = {}) {
  const conv = { id: 301, opposite_user: { id: 201, login: 'pseudo_banc' }, transaction: { id: 5001, item_id: 101 }, allow_reply: true, messages: [] };
  const f = faireFond({ src: SRC, connecte: UID, comptes: [ACC], ...(store ? { store } : {}),
    vinted: (e) => {
      if (e.methode === 'POST' && /\/api\/v2\/conversations$/.test(e.chemin)) return { status: 200, body: { conversation: conv, code: 0 } };
      if (e.methode === 'GET' && /\/api\/v2\/transactions\/\d+$/.test(e.chemin)) return { status: 200, body: { transaction: { id: 5001, item_id: 101, item: { id: 101, price: { amount: '50.0', currency_code: 'EUR' } } } } };
      if (e.methode === 'POST' && /\/offers$/.test(e.chemin)) { if (apresOffre) apresOffre(f); return { status: 200, body: { code: 0 } }; }
      if (e.methode === 'POST' && /\/replies$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
      return { status: 404, body: {} };
    } });
  const fetchFond = f.ctx.fetch;
  f.ctx.fetch = async (url, o = {}) => {
    if (String(url).startsWith('https://vrm.center/api/compte')) {
      const c = JSON.parse(o.body || '{}');
      const j = c.action === 'consommer'
        ? { ok: true, uid: UID, suivi: 's', travail: { itemId: '101', recipientId: '201', initiator: 'native-fixture', message: 'Bonjour {username} !', ...(offre ? { offre: { mode: 'pct', valeur: 10, arrondi: false } } : {}) } }
        : { ok: true, autorise: true, uid: UID };
      return { ok: true, status: 200, json: async () => j };
    }
    return fetchFond(url, o);
  };
  f.ctx.authToken = async () => ({ access_token: 'session' });
  f.etapes = [];
  f.ctx.notifierApp = async (e) => { f.etapes.push(e); };
  f.ctx.__vrmPausesVues = [];
  return f;
}

(async () => {
  const f0 = monter();
  const la = typeof f0.ctx.tirerAttenteOffreMessage === 'function' && typeof f0.ctx.reprendreMessagesFavoris === 'function';
  dit(la, "l'extension porte tirerAttenteOffreMessage et reprendreMessagesFavoris");

  // ── 1. le chemin normal, avec offre ──
  { const f = monter();
    const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    const p = f.ctx.__vrmPausesVues.map((x) => x[0]);
    const om = pauses(f, /^favori:offre-message$/);
    const iOffre = f.j.vinted.findIndex((v) => /\/offers$/.test(v.chemin)), iRep = f.j.vinted.findIndex((v) => /\/replies$/.test(v.chemin));
    dit(r && r.json && r.json.resultat === 'envoye' && replies(f).length === 1, 'avec offre : le message part (une fois)', JSON.stringify(r && r.json));
    dit(om.length === 1 && om[0][1] >= 8000 && om[0][1] <= 20000 && om[0][1] % 1000 === 0, 'avec offre : 8 à 20 s entières entre l’offre et le message', JSON.stringify(om));
    dit(iOffre >= 0 && iRep > iOffre && p.indexOf('favori:offre-message') >= 0 && p.indexOf('favori:offre-message') < p.findIndex((x) => /^ecriture:/.test(x)), 'ordre : offre acceptée → attente 8–20 s → temps d’écriture → message', p.join(' > '));
    const a = f.etapes.find((e) => e && e.etape === 'attente_message');
    dit(a && Number.isInteger(a.dans) && a.dans >= 8 && a.dans <= 20 && a.dans * 1000 === (om[0] || [])[1], 'l’app reçoit « message dans ~N s » (le même N)', JSON.stringify(a));
    dit(places(f) === 3, 'l’attente ne prend aucune action : 3 places (conversation, offre, message), comme avant', places(f));
    dit(!Object.keys(f.store.vrmFavoriAttente || {}).length, 'fini : plus rien en attente dans chrome.storage.local', JSON.stringify(f.store.vrmFavoriAttente));
  }
  // ── 2. sans offre : rien de plus ──
  { const f = monter({ offre: false });
    const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    dit(r && r.json && r.json.resultat === 'envoye' && pauses(f, /^favori:offre-message$/).length === 0, 'sans offre : aucune attente ajoutée', JSON.stringify(f.ctx.__vrmPausesVues));
  }
  // ── 3. les tirages ──
  if (la) {
    const f = monter(); const vus = []; let suite = 0;
    for (let i = 0; i < 400; i++) { const s = await f.ctx.tirerAttenteOffreMessage(); if (vus.length && vus[vus.length - 1] === s) suite++; vus.push(s); }
    dit(vus.every((s) => Number.isInteger(s) && s >= 8 && s <= 20), '400 tirages : toujours entre 8 et 20 s, à la seconde', JSON.stringify(vus.filter((s) => !(s >= 8 && s <= 20))));
    dit(suite === 0, 'jamais deux fois de suite la même valeur', suite);
    dit(new Set(vus).size === 13, 'aléatoire : les 13 valeurs de 8 à 20 servent', [...new Set(vus)].sort((a, b) => a - b).join(','));
  } else { dit(false, 'tirages : fonction absente'); dit(false, 'jamais deux fois : fonction absente'); dit(false, 'aléatoire : fonction absente'); }
  // ── 4. un « non » PENDANT l'attente ──
  for (const [nom, poser, raison] of [
    ['Tout arrêter', (f) => { f.store.vrmToutArrete = { on: true, at: Date.now() }; }, 'tout_arrete'],
    ['un captcha sur ce compte', (f) => { f.store.vrmCaptcha = { [UID]: { depuis: Date.now(), quoi: 'captcha' } }; }, 'vinted_robot'],
    ['une pause 429 de Vinted', (f) => { const p0 = f.ctx.pauseVinted; let n = 0; f.ctx.pauseVinted = async () => (++n > 0 && f.__apres ? { jusqua: Date.now() + 3600000, status: 429 } : p0()); }, 'pause_vinted'],
    ['un autre compte dans l’onglet', (f) => { const c0 = f.ctx.compteConnecte; f.ctx.compteConnecte = async (d) => (f.__apres ? '999' : c0(d)); }, 'compte_vinted_different'],
  ]) {
    const f = monter({ apresOffre: (g) => { g.__apres = true; poser(g); } });
    if (nom.startsWith('une pause') || nom.startsWith('un autre')) poser(f);
    const r = await f.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    dit(replies(f).length === 0 && r && r.json && r.json.resultat === 'refuse' && r.json.raison === raison && pauses(f, /^ecriture:/).length === 0, `${nom} pendant l’attente ⇒ aucun message, « ${raison} »`, JSON.stringify([r && r.json, replies(f)]));
    dit(places(f) === 2 && !Object.keys(f.store.vrmFavoriAttente || {}).length, `${nom} ⇒ la place du message est rendue, l’attente effacée`, places(f));
  }
  // ── 5. le worker s'endort au milieu ; un worker neuf reprend ──
  if (la) {
    const f1 = monter();
    f1.ctx.tenirAttenteFavori = () => new Promise(() => {});   // Chrome coupe le worker pendant l'attente
    f1.ctx.executerMessageFavori(UID, ACC, { jeton: JETON });
    for (let i = 0; i < 400 && !Object.keys(f1.store.vrmFavoriAttente || {}).length; i++) await new Promise((r) => setTimeout(r, 5));
    const e = (f1.store.vrmFavoriAttente || {})[JETON];
    dit(e && e.convId === '301' && e.texte === 'Bonjour pseudo_banc !' && Number(e.jusqua) > Date.now() && !('acc' in e), 'l’attente est écrite dans chrome.storage.local (conversation, texte prêt, fin prévue ; pas le compte entier)', JSON.stringify(e));
    dit(replies(f1).length === 0, 'worker endormi : rien n’est parti', replies(f1).length);
    const store = JSON.parse(JSON.stringify(f1.store));
    const f2 = monter({ store });
    const n = await f2.ctx.reprendreMessagesFavoris();
    dit(n === 1 && JSON.stringify(replies(f2)) === JSON.stringify(['Bonjour pseudo_banc !']) && pauses(f2, /^ecriture:/).length === 1, 'un worker NEUF reprend l’attente : temps d’écriture puis le message, une fois', JSON.stringify([n, replies(f2)]));
    dit(!Object.keys(f2.store.vrmFavoriAttente || {}).length && (await f2.ctx.reprendreMessagesFavoris()) === 0 && replies(f2).length === 1, 'reprise faite : effacée, jamais renvoyée', JSON.stringify(f2.store.vrmFavoriAttente));
    const store3 = JSON.parse(JSON.stringify(f1.store)); store3.vrmToutArrete = { on: true, at: Date.now() };
    const f3 = monter({ store: store3 });
    await f3.ctx.reprendreMessagesFavoris();
    dit(replies(f3).length === 0 && !Object.keys(f3.store.vrmFavoriAttente || {}).length, 'Tout arrêter posé pendant que le worker dormait ⇒ la reprise n’envoie rien, et l’efface', replies(f3).length);
    const store4 = JSON.parse(JSON.stringify(f1.store)); store4.vrmFavoriAttente[JETON].jusqua = Date.now() - 11 * 60000;
    const f4 = monter({ store: store4 });
    await f4.ctx.reprendreMessagesFavoris();
    dit(replies(f4).length === 0 && !Object.keys(f4.store.vrmFavoriAttente || {}).length, 'reprise trop tard (plus de 10 min) ⇒ rien ne part', replies(f4).length);
  } else for (let i = 0; i < 6; i++) dit(false, 'reprise après le worker : fonction absente');

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

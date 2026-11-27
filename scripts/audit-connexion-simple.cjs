// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « LA CONNEXION SIMPLE » (21 nov., ext. 5.415.0, capacité `connexionsimple`)
//
//  Julien : « même l'extension au moment de la connexion, ça doit s'améliorer ».
//  Le VRAI background.js dans `_fond-vm.cjs` (réponses inventées, dépôt public) :
//   S1  l'état de la connexion a UNE source (`etatConnexion`, message `etatConnexion`
//       de la fenêtre) : rien ⇒ `deconnecte` ; session vivante ⇒ `connecte` + compte ;
//       session morte ⇒ `expiree` ; jamais un « en cours » sans borne.
//   S2  « Se connecter » touché ⇒ `attente` avec une heure de fin (15 min) ; passé ce
//       délai ⇒ `deconnecte` + `attenteExpiree` (plus jamais « en cours » pour toujours).
//   S3  « Se déconnecter » DANS l'extension TIENT : l'app qui demande sans geste
//       (`force` absent) reçoit « pas besoin » ; SON geste (« Se connecter » noté, ou
//       « Brancher à mon compte » de l'app : `force`) la relie.
//   S4  une session vivante qui arrive lève « déconnectée par toi ».
//   S5  la fenêtre lit un identifiant d'onglet à 10 chiffres (`depuis=`) : le retour
//       à l'onglet de départ ne se perd pas (mesuré : 1 fois sur 3 au banc).
//   S6  l'app : « Brancher à mon compte » est un geste (`geste: true` ⇒ `force`).
//   S7  (5.453) une liaison DEMANDÉE ouvre le panneau sur son accueil.
//   S8  (5.455.2) jamais dans un onglet qui charge (`loading`, `pendingUrl`) ni celui qu'il regarde : départ, sinon
//       un onglet vinted.fr au repos, sinon un onglet NEUF.
//  `--src chemin` : une autre copie de background.js (preuve sur le code d'avant).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const SRC = cheminSource();
const RACINE = path.join(__dirname, '..');
const POPUP = fs.readFileSync(path.join(path.dirname(SRC), 'popup.js'), 'utf8');
const APP = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log('✅ ' + quoi); } else { ko++; console.log('❌ ' + quoi + (det ? ' — ' + String(det).slice(0, 300) : '')); } };
const UID = 'aaaaaaaa-0000-4000-8000-000000000001';
const etat = (f) => f.envoyer({ from: 'cancale-popup', action: 'etatConnexion' });
const vivante = () => ({ access_token: 'x.' + Buffer.from(JSON.stringify({ sub: UID, email: 'vendeur@exemple.test', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.x', refresh_token: 'r-vivant', expires_at: Date.now() + 3600e3, user_id: UID, email: 'vendeur@exemple.test', depuis: Date.now() });

(async () => {
  // S1
  let f = faireFond({ src: SRC, store: { __sansSession: true } });
  let e = await etat(f);
  dit(e && e.ok && e.etat === 'deconnecte', 'S1 rien ⇒ « deconnecte » (une source : etatConnexion)', JSON.stringify(e));
  await f.ctx.saveSession(vivante());
  e = await etat(f);
  dit(e && e.etat === 'connecte' && e.email === 'vendeur@exemple.test', 'S1 session vivante ⇒ « connecte », le compte VRM nommé', JSON.stringify(e));
  await f.ctx.saveSession(Object.assign(vivante(), { expires_at: Date.now() - 1000, mort: true, mortAt: Date.now(), mortRaison: 'refresh_token_already_used' }));
  e = await etat(f);
  dit(e && e.etat === 'expiree', 'S1 session morte ⇒ « expiree »', JSON.stringify(e));

  // S2
  f = faireFond({ src: SRC, store: { __sansSession: true } });
  await f.envoyer({ from: 'cancale-popup', action: 'lierAvecVRM', urlActive: '' });
  e = await etat(f);
  dit(e && e.etat === 'attente' && Number(e.attenteJusqua) > Date.now() + 14 * 60e3, 'S2 « Se connecter » touché ⇒ « attente » avec son heure de fin (15 min)', JSON.stringify(e));
  f.store.vrmLiaison = Object.assign({}, f.store.vrmLiaison, { demandeAt: Date.now() - 16 * 60e3 });
  e = await etat(f);
  dit(e && e.etat === 'deconnecte' && e.attenteExpiree === true, 'S2 16 min plus tard ⇒ « deconnecte », l’attente avortée DITE', JSON.stringify(e));

  // S3
  f = faireFond({ src: SRC, store: { __sansSession: true } });
  await f.ctx.saveSession(vivante());
  await f.envoyer({ from: 'cancale-popup', action: 'authLogout' });
  const sans = await f.ctx.demanderLiaison({ pour: UID });
  dit(sans && sans.ok && sans.besoin === false, 'S3 déconnectée par SON geste : l’app sans geste reçoit « pas besoin »', JSON.stringify(sans));
  e = await etat(f);
  dit(e && e.etat === 'deconnecte' && e.voulue === true, 'S3 la fenêtre dit « tu as déconnecté l’extension »', JSON.stringify(e));
  const avec = await f.ctx.demanderLiaison({ pour: UID, force: true });
  dit(avec && avec.ok && avec.besoin === true, 'S3 « Brancher à mon compte » (force) la relie', JSON.stringify(avec));
  await f.envoyer({ from: 'cancale-popup', action: 'lierAvecVRM', urlActive: '' });
  const dem = await f.ctx.demanderLiaison({ pour: UID });
  dit(dem && dem.besoin === true, 'S3 « Se connecter » de la fenêtre (demande notée) la relie', JSON.stringify(dem));

  // S4
  dit(!!f.store.vrmDeconnexionVoulue, 'S4 (avant) la marque « déconnectée par toi » est posée');
  await f.ctx.saveSession(vivante());
  dit(!f.store.vrmDeconnexionVoulue, 'S4 une session vivante qui arrive lève la marque', JSON.stringify(f.store.vrmDeconnexionVoulue));

  // S5
  const m = /const DEPUIS = [^\n]+/.exec(POPUP);
  let lu = null;
  if (m) { const c = { Q: '?mode=onglet&depuis=1260447801', Number }; try { vm.runInNewContext(m[0].replace('const DEPUIS', 'this.DEPUIS') , c); lu = c.DEPUIS; } catch (err) { lu = String(err); } }
  dit(lu === 1260447801, 'S5 la fenêtre lit l’onglet de départ à 10 chiffres', String(lu));

  // S6
  const b = /function brancherExtensionApp\(\) \{[^\n]*\}/.exec(APP);
  dit(!!b && /assurerSessionExtension\(\{ geste: true \}\)/.test(b[0]) && /force: lierIci \|\| gesteIci/.test(APP), 'S6 l’app : « Brancher à mon compte » est un geste (force)', b ? b[0] : 'introuvable');

  // S7 — 5.453 (Julien, 25 nov. : « la connexion à l'extension doit ouvrir le panneau, comme ça on voit à quoi ça ressemble ») :
  //    « Relier par vrm.center » DEMANDÉ depuis la fenêtre ⇒ la session arrive ⇒ l'onglet Vinted de départ passe sur le lien du
  //    panneau (son accueil, `?vrm=panneau`, le même que l'app) ; une liaison que l'app fait seule n'ouvre rien ; la fenêtre ne
  //    peut pas ouvrir le panneau sans session.
  {
    const panneau = (g) => (g.j.navigations || []).concat(g.j.ongletsCrees || []).filter((n) => /\/\?vrm=panneau$/.test(String(n.url || '')));
    const g = faireFond({ src: SRC, store: { __sansSession: true }, onglets: [{ id: 7, url: 'https://www.vinted.fr/items/1-paire', status: 'complete', windowId: 1 }] });
    const refus = await g.envoyer({ from: 'cancale-popup', action: 'ouvrirPanneauAccueil', tab: 7 });
    dit(refus && refus.ok === false && !panneau(g).length, 'S7 sans session : « ouvrir le panneau » refusé, rien ne s’ouvre', JSON.stringify(refus));
    await g.envoyer({ from: 'cancale-popup', action: 'lierAvecVRM', urlActive: '', retourTab: 7 });
    const d = await g.ctx.demanderLiaison({ pour: UID });
    const r = d && d.nonce ? await g.ctx.recevoirSessionAdressee({ nonce: d.nonce, session: vivante() }) : null;
    await new Promise((ok2) => setTimeout(ok2, 700));
    const p = panneau(g);
    dit(r && r.ok && p.length === 1 && p[0].id === 7 && p[0].url === 'https://www.vinted.fr/?vrm=panneau', 'S7 « Relier par vrm.center » réussi ⇒ le panneau s’ouvre sur son accueil, dans l’onglet Vinted de départ', JSON.stringify({ r, p }));
    const ok7 = await g.envoyer({ from: 'cancale-popup', action: 'ouvrirPanneauAccueil', tab: 7 });
    dit(ok7 && ok7.ok === true && panneau(g).length === 2, 'S7 connectée : « Me connecter » réussi / « Ouvrir le panneau » ⇒ le panneau (même lien)', JSON.stringify(ok7));
    const h = faireFond({ src: SRC, store: { __sansSession: true }, onglets: [{ id: 7, url: 'https://www.vinted.fr/items/1-paire', status: 'complete', windowId: 1 }] });
    const d2 = await h.ctx.demanderLiaison({ pour: UID, force: true });
    const r2 = d2 && d2.nonce ? await h.ctx.recevoirSessionAdressee({ nonce: d2.nonce, session: vivante() }) : null;
    await new Promise((ok2) => setTimeout(ok2, 700));
    dit(r2 && r2.ok && !panneau(h).length, 'S7 une liaison que l’app fait sans sa demande : aucun panneau ouvert', JSON.stringify({ r2, p: panneau(h) }));

    // S8 — 5.455.2 (banc e2e, 27 nov. : « page.goto: net::ERR_ABORTED ») : le panneau ne prend JAMAIS un onglet qu'il est en
    //    train de charger (`status: 'loading'`, `pendingUrl`) ni celui qu'il regarde ; l'onglet de départ d'abord, sinon un
    //    onglet vinted.fr au repos (chargé), sinon un onglet NEUF. La liaison DEMANDÉE ouvre toujours le panneau (5.453).
    const lier = async (onglets, retourTab) => {
      const f = faireFond({ src: SRC, store: { __sansSession: true }, onglets });
      await f.envoyer({ from: 'cancale-popup', action: 'lierAvecVRM', urlActive: '', retourTab });
      const dd = await f.ctx.demanderLiaison({ pour: UID });
      const rr = dd && dd.nonce ? await f.ctx.recevoirSessionAdressee({ nonce: dd.nonce, session: vivante() }) : null;
      await new Promise((ok2) => setTimeout(ok2, 700));
      return { ok: !!(rr && rr.ok), nav: (f.j.navigations || []).map((n) => n.id), crees: (f.j.ongletsCrees || []).map((n) => n.url), p: panneau(f) };
    };
    const charge = await lier([{ id: 7, url: 'https://www.vinted.fr/catalog', pendingUrl: 'https://www.vinted.fr/member/111', status: 'loading', active: false, windowId: 1 }], null);
    dit(charge.ok && !charge.nav.includes(7) && charge.crees.length === 1 && charge.crees[0] === 'https://www.vinted.fr/?vrm=panneau', 'S8 un onglet vinted.fr EN TRAIN DE CHARGER n’est pas touché : le panneau s’ouvre dans un onglet NEUF', JSON.stringify(charge));
    const pend = await lier([{ id: 7, url: 'https://www.vinted.fr/catalog', pendingUrl: 'https://www.vinted.fr/member/111', status: 'complete', active: false, windowId: 1 }], null);
    dit(pend.ok && !pend.nav.includes(7) && pend.crees.length === 1, 'S8 une navigation en cours (`pendingUrl`) n’est pas coupée : onglet NEUF', JSON.stringify(pend));
    const actif = await lier([{ id: 7, url: 'https://www.vinted.fr/catalog', status: 'complete', active: true, windowId: 1 }], null);
    dit(actif.ok && !actif.nav.includes(7) && actif.crees.length === 1, 'S8 l’onglet vinted.fr qu’il regarde (actif) n’est pas détourné : onglet NEUF', JSON.stringify(actif));
    const repos = await lier([{ id: 9, url: 'https://www.vinted.fr/catalog', status: 'loading', active: false, windowId: 1 }, { id: 7, url: 'https://www.vinted.fr/catalog', status: 'complete', active: false, windowId: 1 }], null);
    dit(repos.ok && repos.nav.length === 1 && repos.nav[0] === 7 && !repos.crees.length, 'S8 un onglet vinted.fr AU REPOS (chargé) est repris, celui qui charge laissé', JSON.stringify(repos));
    const depart = await lier([{ id: 7, url: 'https://www.vinted.fr/items/1-paire', status: 'loading', windowId: 1 }], 7);
    dit(depart.ok && !depart.nav.includes(7) && depart.crees.length === 1, 'S8 même l’onglet de départ, s’il charge, n’est pas coupé : onglet NEUF', JSON.stringify(depart));
  }

  console.log(`\n${ko ? '❌' : '✅'} connexion simple : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

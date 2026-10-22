// Audit : dès que l'extension reçoit sa session VRM, l'onglet Vinted déjà
// ouvert est relu (22 octobre, proposition n°16).
//
//   node scripts/audit-liaison-visite.cjs [--src chemin/vers/background.js]
//
// MESURÉ (lecture seule, sa base) sur le premier inscrit relié le 22 au matin :
// son onglet Vinted était ouvert avant la liaison ; la visite de cette page est
// sortie sur `visite_sans_session`, la capture passive du profil a été refusée
// (`ecriture_ratee_harvest_profile_sans_session` ×2), puis la session est
// arrivée et RIEN n'a relancé la visite — profil et annonces ont attendu
// l'alarme des 20 minutes. Aucune donnée de ce vendeur ici : tout est inventé.
//
// On EXÉCUTE le vrai background.js (`_fond-vm.cjs`) et on juge :
//   1. le défaut : sans session, la visite ne part pas (et ne prend pas de garde) ;
//   2. la liaison (nonce, puis session adressée) relance UNE visite, tout de suite ;
//   3. la connexion par mot de passe de la fenêtre aussi ;
//   4. l'autre sens : aucun onglet Vinted ⇒ aucune visite ; la même session
//      vivante renvoyée (« séparer ») ⇒ aucune visite de plus ;
//   5. les garde-fous sont ceux de la visite : pendant une pause demandée par
//      Vinted, la visite relancée n'envoie RIEN chez Vinted.
const path = require('path');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : lève', String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const SRC = cheminSource();
const UID_VRM = '0d1e2f30-4a5b-4c6d-8e7f-90a1b2c3d4e5';
const jwt = (sub, email) => ['e30', Buffer.from(JSON.stringify({ sub, email })).toString('base64url'), 'sig'].join('.');
const SESSION = () => ({ access_token: jwt(UID_VRM, 'inscrit@exemple.test'), refresh_token: 'r-' + Math.random().toString(36).slice(2), user_id: UID_VRM, email: 'inscrit@exemple.test', expires_at: Math.floor(Date.now() / 1000) + 3600 });
const ONGLET_VINTED = { id: 7, url: 'https://www.vinted.fr/member/123', status: 'complete' };

// Une liaison complète : l'app demande, l'extension rend un nonce, l'app remet
// la session avec ce nonce (les deux vraies fonctions).
async function lier(f) {
  const d = await f.ctx.demanderLiaison({ pour: UID_VRM });
  if (!d || !d.nonce) return { d };
  const r = await f.ctx.recevoirSessionAdressee({ nonce: d.nonce, session: SESSION() });
  return { d, r };
}
// Compte les visites relancées SANS les exécuter (la vraie est jugée en 5).
const compterVisites = (f) => { const n = { v: 0 }; f.ctx.visiteVinted = async () => { n.v++; }; return n; };

(async () => {
  if (!require('fs').readFileSync(SRC, 'utf8').includes('async function recevoirSessionAdressee')) { dit(false, 'background.js porte la session adressée', SRC); }

  console.log('── 1. Le défaut : sans session, la page ne déclenche rien');
  await essaie('sans session', async () => {
    const f = faireFond({ src: SRC, store: { __sansSession: true }, onglets: [ONGLET_VINTED] });
    await f.ctx.visiteVinted();
    dit(f.j.diags.includes('visite_sans_session') && f.j.vinted.length === 0, 'sans session VRM, la visite sort sans rien demander à Vinted', f.j.diags.join(','));
    dit(!(f.store.vrmDerniereVisite && Object.keys(f.store.vrmDerniereVisite).length), '… et sans prendre la garde des 5 minutes');
  });

  console.log('\n── 2. La liaison relance la visite de l’onglet Vinted ouvert');
  await essaie('liaison', async () => {
    const f = faireFond({ src: SRC, store: { __sansSession: true }, onglets: [ONGLET_VINTED] });
    const n = compterVisites(f);
    const { d, r } = await lier(f);
    await attendre(40);
    dit(d && d.besoin === true && r && r.ok === true, 'la liaison aboutit (nonce puis session adressée)', JSON.stringify({ d: d && d.raison, r: r && (r.code || r.ok) }));
    dit(n.v === 1, 'une visite est relancée tout de suite, une seule', `visites=${n.v}`);
    dit(f.j.diags.includes('visite_apres_liaison'), '… et c’est noté au diagnostic (visite_apres_liaison)', f.j.diags.join(','));
  });

  console.log('\n── 3. La connexion par mot de passe de la fenêtre aussi');
  await essaie('connexion', async () => {
    const f = faireFond({ src: SRC, store: { __sansSession: true }, onglets: [ONGLET_VINTED] });
    const n = compterVisites(f);
    const fetch0 = f.ctx.fetch;
    f.ctx.fetch = async (url, o) => /\/auth\/v1\/token\?grant_type=password/.test(String(url))
      ? { ok: true, status: 200, json: async () => ({ access_token: jwt(UID_VRM, 'inscrit@exemple.test'), refresh_token: 'r-mdp', expires_in: 3600, user: { id: UID_VRM, email: 'inscrit@exemple.test' } }) }
      : fetch0(url, o);
    const r = await f.ctx.authLogin('inscrit@exemple.test', 'mot-de-passe-d-essai');
    await attendre(40);
    dit(r && r.ok === true && n.v === 1, 'connectée par mot de passe : une visite relancée', `ok=${r && r.ok} · visites=${n.v}`);
  });

  console.log('\n── 4. L’autre sens');
  await essaie('pas d’onglet Vinted', async () => {
    const f = faireFond({ src: SRC, store: { __sansSession: true }, onglets: [{ id: 3, url: 'https://www.leboncoin.fr/', status: 'complete' }, { id: 4, url: 'https://vrm.center/', status: 'complete' }] });
    const n = compterVisites(f);
    const { r } = await lier(f);
    await attendre(40);
    dit(r && r.ok === true && n.v === 0, 'aucun onglet Vinted ouvert : aucune visite (la prochaine page Vinted la fera)', `visites=${n.v}`);
  });
  await essaie('même session vivante', async () => {
    const vivante = SESSION();
    const f = faireFond({ src: SRC, store: { vrmSession: Object.assign({}, vivante, { expires_at: Date.now() + 3600e3 }) }, onglets: [ONGLET_VINTED] });
    const n = compterVisites(f);
    const d = await f.ctx.demanderLiaison({ pour: UID_VRM, raison: 'separer' });
    const r = d && d.nonce ? await f.ctx.recevoirSessionAdressee({ nonce: d.nonce, session: SESSION() }) : null;
    await attendre(40);
    dit(d && d.raison === 'separer' && r && r.ok === true && n.v === 0, 'elle écrivait déjà, vivante, sous CE compte : aucune visite de plus', `raison=${d && d.raison} · visites=${n.v}`);
  });
  await essaie('session morte', async () => {
    const morte = Object.assign(SESSION(), { mort: true, mortAt: Date.now() - 60e3, expires_at: Date.now() - 1 });
    const f = faireFond({ src: SRC, store: { vrmSession: morte }, onglets: [ONGLET_VINTED] });
    const n = compterVisites(f);
    const { d, r } = await lier(f);
    await attendre(40);
    dit(d && d.raison === 'morte' && r && r.ok === true && n.v === 1, 'session morte remplacée : la visite est relancée', `raison=${d && d.raison} · visites=${n.v}`);
  });

  console.log('\n── 5. Les garde-fous de la visite restent les siens');
  await essaie('pause Vinted', async () => {
    const f = faireFond({ src: SRC, store: { __sansSession: true, vrmPauseVinted: { jusqua: Date.now() + 15 * 60e3, niveau: 1, statut: 429, depuis: Date.now() } }, onglets: [ONGLET_VINTED] });
    const { r } = await lier(f);
    await attendre(120);
    dit(r && r.ok === true && f.j.diags.includes('visite_apres_liaison') && f.j.diags.includes('visite_en_pause') && f.j.vinted.length === 0,
      'Vinted a demandé de ralentir : la visite relancée s’arrête sur la pause, AUCUNE requête chez Vinted', `diags=${f.j.diags.join(',')} · vinted=${f.j.vinted.length}`);
  });

  console.log(ko ? `\n❌ audit-liaison-visite : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-liaison-visite : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();

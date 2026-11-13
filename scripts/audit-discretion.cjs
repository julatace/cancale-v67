// ════════════════════════════════════════════════════════════════════════════
//  LA DISCRÉTION (12 nov., ext. 5.370 — validée par Julien point par point)
//
//  On EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs : faux Vinted qui
//  compte chaque requête, fausse base à état, `chrome.storage.local` à état) :
//   2. plafond par JOUR (réglable) compté sur tous les Chrome, réserve de ses clics ;
//   3. rythme : périodes actives / calmes ; jour calme tiré entre 70 et 100 % ;
//   4. démarrage : 2 à 6 min sans geste automatique après l'ouverture de vinted.fr ;
//   5. un seul compte agit à la fois dans ce navigateur ;
//   6. même série sur un 2e compte : 20 à 60 min après le 1er ;
//   7. compte neuf : 10 → 20 → 35 → 50 /h ;
//   8. {pseudo}, {article}, {prix} (copie identique app ⇄ extension) ;
//   9. délai des offres allongé la nuit (30-120 min), jamais fixe ;
//  11. Republier par petits groupes (règle de l'app) ;
//  12. baisses variées (jamais sous le plancher) et programmées (suivent le rythme) ;
//  13. arrêt net sur captcha, jusqu'à SA reprise (tous les Chrome du compte) + notification ;
//  14. le carnet des 7 jours (403/429, pauses, vérifications, prudences) ;
//  ajouts : arrêt sur modération et sur 401 (levé à la reconnexion), « Tout arrêter »,
//  limite par sorte (15/h favoris, 15/h offres), et la relecture « seulement le nouveau »
//  une fois le compte capté en entier (requêtes comptées avant/après).
//  §6.1 — `BG_SRC=<ancien background.js>` : rouge sur la branche de départ (5.369).
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const SRC0 = process.env.BG_SRC ? path.resolve(process.env.BG_SRC) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');

const MUTATIONS = {
  jour: ['if (nJour + k > capEff)', 'if (false)'],
  captcha: ['const cap = await captchaEnCours(String(uid), autres);\n      if (cap)', 'const cap = await captchaEnCours(String(uid), autres);\n      if (false)'],
  ouverture: ['if (ouv && Number(ouv.depuis)', 'if (false && ouv && Number(ouv.depuis)'],
  verrou: ['if (v.uid && String(v.uid) !== u', 'if (false && v.uid && String(v.uid) !== u'],
  serie: ['if (s && String(s.uid) !== u', 'if (false && s && String(s.uid) !== u'],
  rythme: ["if (p && p.phase === 'calme'", "if (false && p && p.phase === 'calme'"],
  montee: ['if (montee && montee < maxP', 'if (false && montee && montee < maxP'],
  nuit: ['const nuit = heureParis(t) < 7;', 'const nuit = false;'],
  facteur: ['f = Math.round((JOUR_FACTEUR_MIN + Math.random()', 'f = 1 || Math.round((JOUR_FACTEUR_MIN + Math.random()'],
  incremental: ['if (assezLuCommandes(r.json.my_orders, inc, vus))', 'if (false)'],
  sorte: ['if (tous.length >= lim)', 'if (false)'],
  tout: ["if (ta) return { ok: false, code: 'tout-arrete', depuis: ta, n", "if (false) return { ok: false, code: 'tout-arrete', depuis: ta, n"],
  deconnecte: ['if (r && r.viaPage && Number(r.status) === 401)', 'if (false)'],
  moderation: ["if (f.ajoutes.length) await poserArret(", "if (false) await poserArret("],
  reprise: ['if (reprise > depuis) {', 'if (reprise > 0) {'],
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
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut];
  const s = fs.readFileSync(SRC0, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  SRC = path.join(os.tmpdir(), `bg-discretion-${mut}-${process.pid}.js`);
  fs.writeFileSync(SRC, s.replace(a, b));
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 400) : '')); } };
const UID = '111', NAV2 = 'aaaaaaaaaaaaaaaa';
const MIN = 60000, H = 3600000, J = 864e5;
const jourParis = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
const fond = (o = {}) => faireFond({ src: SRC, connecte: UID, ...o });
const essai = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom + ' — exception', e && e.stack); } };
const sansMain = (f) => { if (f.lignes.main === undefined) f.lignes.main = {}; };

(async () => {
  // ── 2. LE PLAFOND DU JOUR ────────────────────────────────────────────────
  await essai('jour', async () => {
    const t = Date.now();
    const f = fond({ lignes: { main: { vinted_discretion: { parJour: 20 } } }, store: { vrmJourTire: { [UID]: { d: jourParis(t), f: 1, at: t } } } });
    const C = f.ctx;
    let auto = 0, code = '';
    for (let i = 0; i < 30; i++) { const r = await C.compterAction(UID, 45); if (r.ok) auto++; else { code = r.code; break; } }
    dit(auto === 15 && code === 'plafond-jour', 'jour : réglé à 20 ⇒ 15 gestes automatiques, puis « plafond-jour » (5 gardés pour ses clics)', `${auto} ${code}`);
    let clic = 0; for (let i = 0; i < 10; i++) { const r = await C.compterAction(UID, 50); if (r.ok) clic++; else break; }
    dit(clic === 5, 'jour : ses clics prennent les 5 dernières, pas une de plus', clic);
    const ligne = Object.keys(f.lignes).find((k) => /^actions_compte_111_[0-9a-f]{16}$/.test(k));
    const d = ligne && f.lignes[ligne];
    dit(d && d.jour && d.jour.d === jourParis(t) && d.jour.n === 20 && d.maxJour === 20 && d.parJour === 20, 'jour : la ligne du compte publie « 20/20 aujourd’hui » (jour de Paris, plafond tiré, réglage)', JSON.stringify(d && { jour: d.jour, maxJour: d.maxJour, parJour: d.parJour }));
    const g = fond({ lignes: { main: { vinted_discretion: { parJour: 20 } }, [`actions_compte_${UID}_${NAV2}`]: { ts: [], jour: { d: jourParis(t), n: 12 } } }, store: { vrmJourTire: { [UID]: { d: jourParis(t), f: 1, at: t } } } });
    let a2 = 0; for (let i = 0; i < 30; i++) { const r = await g.ctx.compterAction(UID, 45); if (r.ok) a2++; else break; }
    dit(a2 === 3, 'jour : les actions des AUTRES Chrome du compte comptent (12 ailleurs ⇒ 3 ici)', a2);
    const h = fond({ lignes: { main: { vinted_discretion: { parJour: 20 } }, [`actions_compte_${UID}_${NAV2}`]: { ts: [], jour: { d: '2020-01-01', n: 12 } } }, store: { vrmJourTire: { [UID]: { d: jourParis(t), f: 1, at: t } } } });
    let a3 = 0; for (let i = 0; i < 30; i++) { const r = await h.ctx.compterAction(UID, 45); if (r.ok) a3++; else break; }
    dit(a3 === 15, 'jour : un AUTRE jour ne compte pas aujourd’hui', a3);
    const st = await f.ctx.gardeStricte(UID, { domain: 'www.vinted.fr' }, { reserve: 5 });
    dit(st && st.code === 'plafond-jour' && /aujourd/.test(st.error), 'jour : le refus dit « N/M actions aujourd’hui … demain »', st && st.error);
  });

  // ── 3. RYTHME ET JOUR CALME ──────────────────────────────────────────────
  await essai('rythme', async () => {
    const f = fond(); sansMain(f);
    const C = f.ctx;
    const vals = []; for (let i = 0; i < 60; i++) vals.push(await C.plafondJourDe('9' + i, 200, Date.now()));
    dit(vals.every((v) => v >= 140 && v <= 200) && new Set(vals).size > 5, 'jour calme : plafond du jour tiré entre 70 et 100 % du réglage, pas toujours le même', vals.slice(0, 12).join(','));
    const v1 = await C.plafondJourDe('91', 200, Date.now());
    dit(v1 === vals[1], 'jour calme : tiré UNE fois par jour et par compte', `${v1} ${vals[1]}`);
    const durees = []; const t = Date.now();
    for (let i = 0; i < 40; i++) { const p = await C.phaseRythme('8' + i, t); durees.push([p.phase, (p.jusqua - t) / MIN]); }
    dit(durees.every(([ph, m]) => ph === 'active' && m >= 25 && m <= 60) && new Set(durees.map((x) => Math.round(x[1]))).size > 5, 'rythme : une période active de 25 à 60 min, tirée au hasard', durees.slice(0, 6).join(' '));
    f.store.vrmRythme = { [UID]: { phase: 'active', jusqua: t - 1000, at: t } };
    const p2 = await C.phaseRythme(UID, t);
    dit(p2.phase === 'calme' && (p2.jusqua - (t - 1000)) / MIN >= 10 && (p2.jusqua - (t - 1000)) / MIN <= 35, 'rythme : après l’active, une période CALME de 10 à 35 min', JSON.stringify(p2));
    f.store.vrmRythme = { [UID]: { phase: 'calme', jusqua: t + 10 * MIN, at: t } };
    const r = await C.porteDiscretion(UID, 'offre', { rythme: true });
    dit(r && r.code === 'discretion' && r.quoi === 'calme' && r.attendreMs > 9 * MIN, 'rythme : en période calme, une offre automatique attend', JSON.stringify(r));
    const r2 = await C.porteDiscretion(UID, 'favori', {});
    dit(r2 === null, 'rythme : les messages aux favoris ne suivent PAS le rythme (étalement refusé par Julien)', JSON.stringify(r2));
  });

  // ── 4, 5, 6. OUVERTURE, UN COMPTE À LA FOIS, SÉRIES DÉCALÉES ─────────────
  await essai('porte', async () => {
    const f = fond(); sansMain(f);
    const C = f.ctx, t = Date.now();
    await C.noterOuvertureVinted(UID);
    const o = f.store.vrmOuverture[UID];
    dit(o && o.attente >= 2 * MIN && o.attente <= 6 * MIN, 'ouverture : une attente de 2 à 6 min est tirée', o && o.attente);
    const r = await C.porteDiscretion(UID, 'republier');
    dit(r && r.code === 'discretion' && r.quoi === 'ouverture' && r.attendreMs <= 6 * MIN, 'ouverture : aucun geste automatique juste après l’ouverture de vinted.fr', JSON.stringify(r));
    const clic = await C.gardeStricte(UID, { domain: 'www.vinted.fr' }, {});
    dit(clic === null, 'ouverture : SON clic passe');
    await C.noterOuvertureVinted(UID);
    dit(f.store.vrmOuverture[UID].depuis === o.depuis, 'ouverture : une 2e page dans les 30 min ne relance pas l’attente');
    const att = []; for (let i = 0; i < 40; i++) { const g = fond(); sansMain(g); await g.ctx.noterOuvertureVinted(UID); att.push(g.store.vrmOuverture[UID].attente); }
    dit(new Set(att).size > 10, 'ouverture : l’attente est tirée au hasard (jamais fixe)', att.slice(0, 5).join(','));
    delete f.store.vrmOuverture;
    await C.noterGesteAuto('222', 'offre');
    const v = await C.porteDiscretion(UID, 'offre');
    dit(v && v.quoi === 'autre-compte' && v.attendreMs > 9 * MIN, 'un compte à la fois : le compte 222 vient d’agir ⇒ 111 attend', JSON.stringify(v));
    const v2 = await C.porteDiscretion('222', 'offre');
    dit(v2 === null, 'un compte à la fois : le compte qui agit continue');
    f.store.vrmVerrouCompte = { uid: '222', jusqua: t - 1, at: t };
    f.store.vrmSeries = { baisse_prix: { uid: '222', dernier: t, ecart: 30 * MIN, at: t } };
    const s = await C.porteDiscretion(UID, 'baisse_prix');
    dit(s && s.quoi === 'serie' && s.attendreMs > 29 * MIN, 'séries : une baisse en série sur un 2e compte attend après le 1er', JSON.stringify(s));
    dit((await C.porteDiscretion(UID, 'republier')) === null, 'séries : une AUTRE sorte de série n’attend pas');
    const ecarts = []; for (let i = 0; i < 30; i++) { const g = fond(); sansMain(g); await g.ctx.noterGesteAuto('3' + i, 'favori'); ecarts.push(g.store.vrmSeries.favori.ecart / MIN); }
    dit(ecarts.every((e) => e >= 20 && e <= 60) && new Set(ecarts.map(Math.round)).size > 5, 'séries : l’écart est tiré entre 20 et 60 min', ecarts.slice(0, 6).map(Math.round).join(','));
    const b = await C.porteDiscretion(UID, 'bordereau');
    dit(b === null, 'un bordereau (obligation d’envoi) n’attend ni l’ouverture ni le rythme');
  });

  // ── 7. COMPTE NEUF ───────────────────────────────────────────────────────
  await essai('montee', async () => {
    const nb = async (jours, plafond, profil) => {
      const lignes = { main: {} };
      if (profil != null) lignes[`harvest_${UID}_profile`] = { payload: { user: { created_at: new Date(Date.now() - profil * J).toISOString() } } };
      const f = fond({ lignes, comptes: [{ vinted_user_id: UID, login: 'x', domain: 'www.vinted.fr', access_token: 'j', created_at: new Date(Date.now() - jours * J).toISOString() }] });
      let n = 0; for (let i = 0; i < 60; i++) { const r = await f.ctx.compterAction(UID, plafond); if (r.ok) n++; else break; }
      return n;
    };
    const s1 = await nb(3, 45), s1c = await nb(3, 50), s2 = await nb(10, 45), s3 = await nb(17, 45), s4 = await nb(40, 45), vin = await nb(400, 45, 5);
    dit(s1 === 5 && s1c === 10, 'compte neuf (3 j) : 10/h (5 automatiques, ses clics jusqu’à 10)', `${s1} ${s1c}`);
    dit(s2 === 15 && s3 === 30, 'compte neuf : 20/h la 2e semaine, 35/h la 3e', `${s2} ${s3}`);
    dit(s4 === 45, 'compte de plus de 4 semaines : le plafond normal (45 automatiques)', s4);
    dit(vin === 5, 'compte Vinted de 5 j (profil lu) relié depuis longtemps : la montée s’applique', vin);
  });

  // ── 13 + 14. CAPTCHA, CARNET, NOTIFICATION, REPRISE ──────────────────────
  await essai('captcha', async () => {
    let page = 'captcha';
    const f = fond({ vinted: (e) => (page === 'captcha' ? { status: 403, body: { url: 'https://geo.captcha-delivery.com/captcha/?initialCid=banc&cid=banc' } } : page === '429' ? { status: 429, body: {} } : { status: 200, body: { ok: true } }) });
    sansMain(f);
    const C = f.ctx;
    await C.vintedGet({ vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'j' }, '/api/v2/users/current');
    await new Promise((r) => setTimeout(r, 30));
    dit(f.store.vrmCaptcha && f.store.vrmCaptcha[UID] && f.store.vrmCaptcha[UID].quoi === 'captcha', 'captcha : la réponse « captcha / DataDome » ARRÊTE le compte', JSON.stringify(f.store.vrmCaptcha));
    delete f.store.vrmPauseVinted; delete f.store.vrmPrudence;
    const a = await C.compterAction(UID, 45);
    dit(!a.ok && a.code === 'verification', 'captcha : pause et prudence levées, AUCUN geste automatique tant qu’il n’a pas repris', JSON.stringify(a));
    const c = await C.compterAction(UID, 50);
    dit(c.ok, 'captcha : SON clic passe');
    dit(f.j.vrmApi.some((x) => x.corps && x.corps.action === 'verification' && x.corps.uid === UID), 'captcha : la notification est demandée au serveur (n° du compte seulement)', JSON.stringify(f.j.vrmApi.map((x) => x.corps)));
    const ligne = Object.keys(f.lignes).find((k) => /^actions_compte_111_[0-9a-f]{16}$/.test(k));
    dit(ligne && f.lignes[ligne].captcha > 0 && f.lignes[ligne].arret === 'captcha', 'captcha : publié dans la ligne du compte (les autres Chrome et l’app le voient)');
    await new Promise((r) => setTimeout(r, 2 * 61000 > 0 ? 5 : 5));
    dit((f.lignes[ligne].ev || []).some((e) => e.s === 'captcha') && (f.lignes[ligne].ev || []).some((e) => e.s === '403'), 'carnet : la vérification et le refus 403 sont notés', JSON.stringify(f.lignes[ligne].ev));
    f.lignes.main = { vinted_discretion: { reprises: { [UID]: f.store.vrmCaptcha[UID].depuis - 1000 } } }; delete f.store.vrmDiscretionReglages;
    const a2 = await C.compterAction(UID, 45);
    dit(!a2.ok && a2.code === 'verification', 'captcha : une reprise PLUS ANCIENNE que la vérification ne lève rien');
    f.lignes.main = { vinted_discretion: { reprises: { [UID]: Date.now() + 1000 } } }; delete f.store.vrmDiscretionReglages;
    const a3 = await C.compterAction(UID, 45);
    dit(a3.ok && !(f.store.vrmCaptcha || {})[UID], 'captcha : SA reprise (« Reprendre ») lève l’arrêt', JSON.stringify(a3));
    const g = fond({ lignes: { main: {}, [`actions_compte_${UID}_${NAV2}`]: { ts: [], captcha: Date.now() - 5000, arret: 'captcha' } } });
    const a4 = await g.ctx.compterAction(UID, 45);
    dit(!a4.ok && a4.code === 'verification', 'captcha : posé par un AUTRE Chrome du compte, il arrête aussi celui-ci', JSON.stringify(a4));
    page = '429';
    const h = fond({ vinted: () => ({ status: 429, body: {} }) }); sansMain(h);
    await h.ctx.vintedGet({ vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'j' }, '/api/v2/users/current');
    await new Promise((r) => setTimeout(r, 30));
    const ev = (h.store.vrmCarnet || {})[UID] || [];
    dit(ev.some((e) => e.s === '429') && ev.some((e) => e.s === 'pause') && ev.some((e) => e.s === 'prudence') && !(h.store.vrmCaptcha || {})[UID], 'carnet : un 429 note refus, pause et prudence — pas un arrêt (ce n’est pas un captcha)', JSON.stringify(ev));
  });

  // ── AJOUTS : MODÉRATION, DÉCONNEXION, TOUT ARRÊTER, LIMITE PAR SORTE ─────
  await essai('ajouts', async () => {
    const f = fond(); sansMain(f);
    const C = f.ctx;
    const e = C.evenementCompteModeration('restreint', Date.now(), {});
    await C.rangerModeration(UID, [e], { at: e.t });
    await new Promise((r) => setTimeout(r, 30));
    dit(f.store.vrmCaptcha && f.store.vrmCaptcha[UID] && f.store.vrmCaptcha[UID].quoi === 'moderation', 'modération : une modération NEUVE lue arrête les gestes automatiques du compte', JSON.stringify(f.store.vrmCaptcha));
    const p = await C.porteDiscretion(UID, 'favori');
    dit(p && p.code === 'verification' && /modéré/.test(p.error), 'modération : la porte dit pourquoi', p && p.error);

    let st = 401;
    const g = fond({ vinted: () => ({ status: st, body: {} }) }); sansMain(g);
    const acc = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'j' };
    await g.ctx.vintedPage(acc, 'GET', '/api/v2/users/current', null, {});
    await new Promise((r) => setTimeout(r, 30));
    dit(g.store.vrmCaptcha && g.store.vrmCaptcha[UID] && g.store.vrmCaptcha[UID].quoi === 'deconnecte', 'déconnecté : un 401 de l’onglet arrête les gestes automatiques (aucune tentative en boucle)', JSON.stringify(g.store.vrmCaptcha));
    const a = await g.ctx.compterAction(UID, 45);
    dit(!a.ok && a.code === 'verification', 'déconnecté : aucun geste automatique ne part');
    st = 200;
    await g.ctx.vintedPage(acc, 'GET', '/api/v2/users/current', null, {});
    await new Promise((r) => setTimeout(r, 30));
    dit(!(g.store.vrmCaptcha || {})[UID], 'déconnecté : la première réponse réussie de l’onglet (il s’est reconnecté) lève l’arrêt');

    const h = fond(); sansMain(h);
    await h.ctx.poserToutArrete(true);
    const t1 = await h.ctx.compterAction(UID, 45), t2 = await h.ctx.compterAction(UID, 50), t3 = await h.ctx.porteDiscretion('222', 'bordereau');
    dit(!t1.ok && t1.code === 'tout-arrete' && t2.ok && t3 && t3.code === 'tout-arrete', 'Tout arrêter : aucun geste automatique, sur aucun compte ; ses clics passent', JSON.stringify([t1, t2.ok, t3 && t3.code]));
    await h.ctx.poserToutArrete(false);
    dit((await h.ctx.compterAction(UID, 45)).ok, 'Tout arrêter : « Reprendre » relance');
    h.lignes.main = { vinted_discretion: { tout: { on: true, at: Date.now() + 1000 } } }; delete h.store.vrmDiscretionReglages;
    dit((await h.ctx.compterAction(UID, 45)).code === 'tout-arrete', 'Tout arrêter : posé depuis l’app (synchronisé, plus récent), il arrête ce Chrome');
    const k = fond({ lignes: { main: {}, [`actions_compte_${UID}_${NAV2}`]: { ts: [], ta: { on: true, at: Date.now() } } } });
    dit((await k.ctx.compterAction(UID, 45)).code === 'tout-arrete', 'Tout arrêter : posé depuis la carte d’un AUTRE Chrome, il arrête celui-ci aussi');

    const t = Date.now();
    const s = fond({ store: { vrmSortes: { [UID]: { offre: Array.from({ length: 15 }, (_, i) => t - i * MIN), at: t } } } }); sansMain(s);
    const so = await s.ctx.porteDiscretion(UID, 'offre');
    dit(so && so.quoi === 'sorte' && /15 réponses aux offres/.test(so.error), 'limite par sorte : 15 réponses automatiques aux offres dans l’heure ⇒ la 16e attend', JSON.stringify(so));
    dit((await s.ctx.porteDiscretion(UID, 'republier')) === null, 'limite par sorte : les autres sortes ne sont pas touchées');
    const s2 = fond({ lignes: { main: {}, [`actions_compte_${UID}_${NAV2}`]: { ts: [], so: { favori: Array.from({ length: 15 }, (_, i) => t - i * MIN) } } } });
    const sf = await s2.ctx.porteDiscretion(UID, 'favori');
    dit(sf && sf.quoi === 'sorte', 'limite par sorte : comptée sur TOUS les Chrome du compte', JSON.stringify(sf));
    const s3 = fond({ lignes: { main: { vinted_discretion: { parHeure: { favori: 30 } } }, [`actions_compte_${UID}_${NAV2}`]: { ts: [], so: { favori: Array.from({ length: 15 }, (_, i) => t - i * MIN) } } } });
    dit((await s3.ctx.porteDiscretion(UID, 'favori')) === null, 'limite par sorte : réglable (30/h ⇒ la 16e passe)');
  });

  // ── 9. LES OFFRES LA NUIT ────────────────────────────────────────────────
  await essai('nuit', async () => {
    const f = fond(); const C = f.ctx;
    const nuit = Date.UTC(2026, 10, 12, 2, 0), jour = Date.UTC(2026, 10, 12, 14, 0);   // 3 h et 15 h, heure de Paris
    const n = Array.from({ length: 200 }, () => C.delaiOffreMs(nuit) / MIN), d = Array.from({ length: 200 }, () => C.delaiOffreMs(jour) / MIN);
    dit(n.every((x) => x >= 30 && x <= 120) && new Set(n.map(Math.round)).size > 20, 'nuit (0 h-7 h Paris) : 30 à 120 min, tiré au hasard', `${Math.min(...n)}–${Math.max(...n)}`);
    dit(d.every((x) => x >= 3 && x <= 20) && new Set(d.map(Math.round)).size > 8, 'jour : toujours 3 à 20 min au hasard (décision du 27 oct.)', `${Math.min(...d)}–${Math.max(...d)}`);
  });

  // ── 12. BAISSES PROGRAMMÉES ──────────────────────────────────────────────
  await essai('baisses', async () => {
    const f = fond(); sansMain(f);
    const C = f.ctx, t = Date.now();
    const sans = await C.planifierBaisses({ uid: UID, items: [{ id: '12345', prix: 40, prixAvant: 50, at: t }] });
    dit(sans.accepte === false && sans.code === 'confirmation', 'baisses programmées : rien n’est rangé sans SON clic');
    const sous = await C.planifierBaisses({ uid: UID, confirme: true, items: [{ id: '12345', prix: 60, prixAvant: 50, at: t }] });
    dit(sous.accepte === false, 'baisses programmées : jamais une hausse');
    const okp = await C.planifierBaisses({ uid: UID, confirme: true, items: [{ id: '12345', prix: 40, prixAvant: 50, at: t - 1000 }, { id: '12346', prix: 30, prixAvant: 35, at: t + 3 * H }] });
    dit(okp.accepte && f.store.vrmBaissesPrevues.length === 2, 'baisses programmées : rangées avec leur heure');
    f.store.vrmRythme = { [UID]: { phase: 'calme', jusqua: t + 10 * MIN, at: t } };
    const n0 = f.j.vinted.length;
    await C.baissesTick();
    const x = f.store.vrmBaissesPrevues.find((b) => b.id === '12345');
    dit(f.j.vinted.length === n0 && x.etat === 'prevue' && x.at > t + 9 * MIN, 'baisses programmées : une période calme la décale, rien ne part chez Vinted', JSON.stringify(x));
    const an = await C.annulerBaisses({ uid: UID });
    dit(an.accepte && f.store.vrmBaissesPrevues.every((b) => b.etat === 'annulee'), 'baisses programmées : « Annuler » les retire toutes');
  });

  // ── RELECTURE : SEULEMENT LE NOUVEAU UNE FOIS LE COMPTE CAPTÉ ────────────
  await essai('incremental', async () => {
    const mk = (n, t0) => Array.from({ length: n }, (_, i) => ({ transaction_id: 900000 + n - i, status: 'Commande finalisée', transaction_user_status: 'completed', date: t0 - i * MIN }));
    let ventes = mk(2000, Date.now()), echec = false;
    const vinted = (e) => {
      const m = /my_orders\?type=sold&page=(\d+)&per_page=(\d+)/.exec(e.chemin);
      if (!m) return { status: 404, body: {} };
      if (echec) return { status: 500, body: {} };
      const p = Number(m[1]), per = Number(m[2]);
      return { status: 200, body: { my_orders: ventes.slice((p - 1) * per, p * per), pagination: { current_page: p, per_page: per, total_pages: Math.ceil(ventes.length / per), total_entries: ventes.length } } };
    };
    const f = fond({ vinted }); sansMain(f);
    f.ctx.storeHarvestRow = async () => 'ecrit';
    f.ctx.viderMemoVisite = () => {};
    const req = () => f.j.vinted.filter((x) => /my_orders/.test(x.chemin)).length;
    await f.ctx.rafraichirVentes(UID);
    const avant = req();
    dit(avant === 8, 'avant (compte pas encore capté en entier) : la lecture d’avant, 8 pages', avant);
    f.store.vrmImport = { [UID]: { sold: { fini: true }, purchased: { fini: true } } };
    ventes = [{ transaction_id: 999999, status: 'Bordereau d’envoi commandé', transaction_user_status: 'needs_action' }].concat(ventes);
    await f.ctx.rafraichirVentes(UID);
    const n1 = req() - avant;
    dit(n1 === 1, 'compte de 2 000 ventes déjà capté : 1 requête (la page 1 porte du connu) au lieu de 8', n1);
    const etats = f.store.vrmCmdConnus[`${UID}_orders_sold`].etats;
    dit(etats['999999'] && /needs_action/.test(etats['999999']), 'la vente neuve est apprise (son état)');
    // Une vente EN COURS connue plus bas (page 3) : on va la revoir.
    const k = String(ventes[100].transaction_id);
    f.store.vrmCmdConnus[`${UID}_orders_sold`].etats[k] = 'waiting|Commande expédiée';
    ventes[100] = { ...ventes[100], transaction_user_status: 'waiting', status: 'Commande expédiée' };
    const b2 = req(); await f.ctx.rafraichirVentes(UID);
    dit(req() - b2 === 3, 'une vente EN COURS connue en page 3 : on lit jusqu’à elle (3 pages), son état peut avoir changé', req() - b2);
    // Une lecture RATÉE n'apprend rien.
    const avantEtats = JSON.stringify(f.store.vrmCmdConnus);
    echec = true; const r = await f.ctx.rafraichirVentes(UID); echec = false;
    dit(r && r.ok === false && JSON.stringify(f.store.vrmCmdConnus) === avantEtats, 'une lecture ratée ne vaut jamais « rien de nouveau » : la mémoire ne bouge pas', JSON.stringify(r));
    // Pas complet (ni import fini ni lecture jusqu'au bout) : la lecture d'avant.
    const g = fond({ vinted }); sansMain(g);
    g.ctx.storeHarvestRow = async () => 'ecrit'; g.ctx.viderMemoVisite = () => {};
    g.store.vrmCmdConnus = { [`${UID}_orders_sold`]: { complet: false, etats: f.store.vrmCmdConnus[`${UID}_orders_sold`].etats, at: Date.now() } };
    await g.ctx.rafraichirVentes(UID);
    dit(g.j.vinted.filter((x) => /my_orders/.test(x.chemin)).length === 8, 'pas capté en entier : rien n’est sauté (8 pages)');
    // La moisson faite DANS la page (`pageActiveFetch`, 100 par page, 10 pages au plus) : la même règle.
    const vPage = (e) => {
      if (/users\/current/.test(e.chemin)) return { status: 200, body: { user: { id: 5 } } };
      if (/wardrobe/.test(e.chemin)) return { status: 200, body: { items: [], pagination: { total_pages: 1 } } };
      if (/my_orders\?type=purchased/.test(e.chemin)) return { status: 200, body: { my_orders: [], pagination: { total_pages: 1 } } };
      if (/my_orders\?type=sold/.test(e.chemin)) return vinted(e);
      return { status: 200, body: {} };
    };
    const h = fond({ vinted: vPage }); sansMain(h);
    h.ctx.storeHarvestRow = async () => 'ecrit'; h.ctx.lastProfileId = async () => null;
    await h.ctx.pageActiveFetch();
    const p1 = h.j.vinted.filter((x) => /my_orders\?type=sold/.test(x.chemin)).length;
    h.store.vrmImport = { [UID]: { sold: { fini: true }, purchased: { fini: true } } };
    ventes = [{ transaction_id: 999998, status: 'Bordereau d’envoi commandé', transaction_user_status: 'needs_action' }].concat(ventes);
    await h.ctx.pageActiveFetch();
    const p2 = h.j.vinted.filter((x) => /my_orders\?type=sold/.test(x.chemin)).length - p1;
    // (La vente EN COURS posée plus haut est maintenant 102e : la page 2 est relue pour elle.)
    dit(p1 === 10 && p2 === 2, 'moisson dans la page : 10 pages avant ; une fois le compte capté, la page 1 + celle de la vente en cours connue (2)', `${p1} puis ${p2}`);
    const enCours = String(ventes[101].transaction_id);
    ventes[101] = { ...ventes[101], transaction_user_status: 'completed', status: 'Commande finalisée' };
    await h.ctx.pageActiveFetch();
    ventes = [{ transaction_id: 999997, status: 'Bordereau d’envoi commandé', transaction_user_status: 'needs_action' }].concat(ventes);
    const avant3 = h.j.vinted.filter((x) => /my_orders\?type=sold/.test(x.chemin)).length;
    await h.ctx.pageActiveFetch();
    const p3 = h.j.vinted.filter((x) => /my_orders\?type=sold/.test(x.chemin)).length - avant3;
    dit(p3 === 1 && /completed/.test(h.store.vrmCmdConnus[`${UID}_orders_sold`].etats[enCours]), 'moisson dans la page : la vente en cours finalisée (état appris), ensuite 1 seule requête', `${p3}`);
  });

  // ── 8. VARIABLES (copie identique, remplacement) ─────────────────────────
  await essai('variables', async () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'favorisMessage.js'), 'utf8');
    const bg = fs.readFileSync(SRC, 'utf8');
    const bloc = (s) => { const a = s.indexOf('// <favoris-message-regle>'), b = s.indexOf('// </favoris-message-regle>'); return a >= 0 && b > a ? s.slice(a, b) : null; };
    dit(bloc(app) && bloc(app) === bloc(bg), 'variables : la règle de l’extension est la copie exacte de src/favorisMessage.js');
    const C = fond().ctx;
    const t = C.personnaliserMessageFavori('Salut {pseudo}, {article} à {prix} ? {username}', 'lea_75', () => 0, { article: 'Nike Air Max 90', prix: '45.00' });
    dit(t === 'Salut lea_75, Nike Air Max 90 à 45 € ? lea_75', 'variables : {pseudo}, {article}, {prix} remplacés', t);
    dit(C.erreurVariablesFavori('Bonjour {pseudo} {article} {prix}') === '' && /inconnue/.test(C.erreurVariablesFavori('{prenom}')), 'variables : acceptées par la règle, une inconnue refusée');
    dit(C.prixRequisFavori('à {prix}') && !C.prixTexteFavori(null), 'variables : {prix} sans prix lu ⇒ le message ne part pas');
  });

  // ── L'IMPORT LEBONCOIN PAR LE CANAL PRIVÉ (comme les ordres de 5.362) ─────
  await essai('import-lbc', async () => {
    const vm = require('vm');
    const REL = fs.readFileSync(path.join(path.dirname(SRC0), 'lbc-relay.js'), 'utf8');
    const ecoutes = [], onMsg = [], vus = [];
    const win = {};
    // « Un script de la page » : il lit chaque ordre posté sur `window` et répond un faux résultat 200.
    win.postMessage = (m) => { const d = JSON.parse(JSON.stringify(m)); setTimeout(() => {
      for (const f of ecoutes.slice()) { try { f({ source: win, origin: 'https://www.leboncoin.fr', data: d, ports: [] }); } catch (_) {} }
      if (d && d.__tag === 'CANCALE_LBC_ORDRE') { vus.push(d.kind); win.postMessage({ __tag: 'CANCALE_LBC', kind: 'lbcimportresultat', jeton: d.jeton, statut: 200, corps: '{"faux":true}' }); }
    }, 0); };
    win.addEventListener = (t, f) => { if (t === 'message') ecoutes.push(f); };
    win.top = win;
    const modeles = [];
    const ctx = { window: win, self: win, location: { origin: 'https://www.leboncoin.fr', hostname: 'www.leboncoin.fr', href: 'https://www.leboncoin.fr/' }, console: { log() {}, warn() {}, error() {} },
      setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 60)), clearTimeout, setInterval: () => 0, clearInterval() {}, TextEncoder, URL, crypto: { randomUUID: () => 'jeton-' + Math.random().toString(16).slice(2, 12) },
      chrome: { runtime: { id: 'ext', lastError: null, sendMessage: (m, cb) => { if (m && m.action === 'lbcImportModele') modeles.push(m); if (typeof cb === 'function') cb({ ok: true }); }, onMessage: { addListener: (f) => onMsg.push(f) } } } };
    vm.createContext(ctx); vm.runInContext(REL, ctx, { filename: 'lbc-relay.js' });
    const r = await new Promise((res) => { let g = false; for (const f of onMsg) { if (f({ from: 'vrm-fond', action: 'lbcImportPage', url: 'https://api.leboncoin.fr/api/consumergoods/proxy/v2/pages/transactions?page=2', compte: 'abc' }, { id: 'ext' }, res) === true) g = true; } if (!g) setTimeout(() => res(undefined), 30); });
    await new Promise((x) => setTimeout(x, 80));
    dit(!(r && r.ok === true) && !vus.includes('importpage'), 'import Leboncoin : l’ordre ne passe plus par `window` et un faux résultat de la page n’est JAMAIS cru', JSON.stringify({ r, vus }));
    win.postMessage({ __tag: 'CANCALE_LBC', kind: 'lbcimportmodele', url: 'https://api.leboncoin.fr/x?page=1', moi: 'abc' });
    await new Promise((x) => setTimeout(x, 30));
    dit(modeles.length === 0, 'import Leboncoin : un « modèle » posté par la page sur `window` n’est pas appris', JSON.stringify(modeles));
  });

  // ── RÈGLES DE L'APP ──────────────────────────────────────────────────────
  await essai('app', async () => {
    const imp = (p) => import(require('url').pathToFileURL(path.join(__dirname, '..', p)).href);
    const D = await imp('src/discretion.js');
    let ok11 = true, detail = '';
    for (let n = 1; n <= 40; n++) for (let e = 0; e < 5; e++) {
      const ids = Array.from({ length: n }, (_, i) => 'a' + i);
      const r = D.planParGroupes(ids, { espace: () => 30 });
      const tailles = r.groupes.map((g) => g.length);
      const plat = r.groupes.flat();
      const bon = plat.join() === ids.join() && r.plan.a0 === 0
        && (n <= D.GROUPE_MAX ? r.groupes.length <= 1 : tailles.every((x) => x >= D.GROUPE_MIN && x <= D.GROUPE_MAX))
        && Object.keys(r.pauses).length === Math.max(0, r.groupes.length - 1)
        && Object.values(r.pauses).every((p) => p >= 15 * 60 && p <= 45 * 60);
      if (!bon) { ok11 = false; detail = `${n} ${JSON.stringify(tailles)} ${JSON.stringify(r.pauses)}`; }
    }
    dit(ok11, 'Republier : groupes de 3 à 6 dans l’ordre choisi, une pause de 15 à 45 min entre deux, la 1re tout de suite', detail);
    dit(Object.keys(D.planParGroupes(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], { groupes: false, espace: () => 30 }).pauses).length === 0, 'Republier : groupes éteints ⇒ l’espacement d’avant seulement');
    const fa = D.facteursBaisse(Array.from({ length: 200 }, (_, i) => i));
    dit(Object.values(fa).every((x) => x >= 0.8 && x <= 1.2) && new Set(Object.values(fa)).size > 10, 'baisses : son choix varie de ± 20 % (8-12 % pour 10 %)');
    const hs = D.heuresEtalees(9, { debut: 0, heures: 6 });
    dit(hs.every((x, i) => i === 0 || x - hs[i - 1] >= 5 * MIN) && hs[hs.length - 1] <= 6 * H + 2 * MIN && new Set(hs.map((x) => Math.floor(x / MIN))).size === 9, 'baisses : étalées sur 6 h, jamais deux à la même minute (5 min au moins)');
    const B = await imp('src/baissePrix.js');
    const baisse = B.baisseTapee('pct', '10');
    const L = B.lignesBaisse({ annonces: [{ id: '1', uid: UID, prix: 50 }, { id: '2', uid: UID, prix: 50 }], baisse, compteOnglet: UID, plancherDe: () => ({ etat: 'ok', plancher: 4500 }), facteurs: { 1: 1.2, 2: 0.8 } });
    dit(L[0].nouveau === 45 && !L[0].sousPlancher && L[1].nouveau === 46, 'baisses : la variation ne passe JAMAIS sous le plancher (remontée au plancher)', JSON.stringify(L.map((l) => l.nouveau)));
    const JA = await imp('src/jaugeActions.js');
    const t = Date.now(), d = JA.jourParisDe(t);
    const rows = [{ id: `actions_compte_${UID}_${NAV2}`, ts: [], jour: { d, n: 40 }, maxj: '180', pj: '200' }, { id: `actions_compte_${UID}_bbbbbbbbbbbbbbbb`, ts: [], jour: { d, n: 72 }, maxj: '170' }];
    const j = JA.jaugeDuCompte(rows, UID, t);
    dit(j.nJour === 112 && j.maxJour === 170 && JA.texteJauge(j).jour === '112/170 aujourd’hui', 'jauge : « 112/170 aujourd’hui » (somme des Chrome, le plafond le plus prudent)', JSON.stringify(j));
    dit(JA.jaugeDuCompte([{ id: `actions_compte_${UID}_${NAV2}`, ts: [] }], UID, t).nJour === null, 'jauge : extension d’avant (rien de publié) ⇒ jour « pas su »');
    const c = D.carnetDuCompte([{ id: `actions_compte_${UID}_${NAV2}`, ev: [{ t: t - 1000, s: '429' }, { t: t - 2000, s: 'pause' }] }, { id: `actions_compte_${UID}_bbbbbbbbbbbbbbbb`, ev: [{ t: t - 1500, s: '429' }, { t: t - 8 * J, s: '403' }] }], UID, t);
    dit(c.n429 === 1 && c.pauses === 1 && c.n403 === 0 && c.total === 2, 'carnet : 7 jours, un même refus vu par deux Chrome compte une fois', JSON.stringify(c));
    dit(D.carnetDuCompte([{ id: `actions_compte_${UID}_${NAV2}`, ts: [] }], UID, t) === null, 'carnet : rien publié ⇒ « pas su », jamais 0');
    dit(D.verificationEnCours(1000, 900) && !D.verificationEnCours(1000, 1001), 'vérification : levée seulement par une reprise plus récente');
    dit(JA.toutArreteDe([{ ta: { on: true, at: 10 } }], { on: false, at: 5 }).on === true && JA.toutArreteDe([{ ta: { on: true, at: 10 } }], { on: false, at: 20 }).on === false, 'Tout arrêter : le geste le plus récent gagne (carte ou app)');
  });

  if (mut) { try { fs.unlinkSync(SRC); } catch (_) {} }
  console.log(`\n${ko ? '❌' : '✅'} audit-discretion : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();

require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « POPUP DE L'EXTENSION » — la fenêtre de connexion (refait le 21 nov., 5.415.0).
//
//  ⚠️ §4.10 : `node --check` ne lit que la syntaxe ; ici le VRAI popup.js tourne
//  dans une page (vrai popup.html, vraie feuille vrm-ui.js), devant un faux `chrome`
//  qui répond ce qu'on lui dit. Le parcours de bout en bout, avec la vraie
//  extension et le vrai service worker, est `connexion-extension.cjs`.
//
//  Le contrat de la 5.415 (Julien : « au moment de la connexion ça doit s'améliorer »),
//  jugé sur le DOM (data-*, nombres), jamais sur un libellé exact :
//   · UNE phrase d'état (`[data-etat-phrase]`), l'état porté par `body[data-connexion]`,
//     UN bouton plein ; aucun champ d'emblée ; cibles ≥ 44 px ; rien qui déborde ;
//   · pas reliée ⇒ « Se connecter » : `lierAvecVRM` avec l'onglet où revenir ;
//   · connectée ⇒ compte VRM et compte Vinted nommés, « Ouvrir VRM », « Se déconnecter » ;
//   · panne ⇒ l'heure du prochain essai et « Réessayer » ; « en cours » jamais > 12 s ;
//   · le recours ICI (e-mail + mot de passe VRM, Google / Discord activés), une
//     connexion à la fois, erreurs dites avant tout envoi ;
//   · un service worker d'avant (code périmé) : VRM ouvert quand même, ⟳ une fois ;
//   · la carte (`?mode=carte`) et la réparation (`?mode=reparer`) inchangées.
//  Captures : BANC_CAPTURES=<dossier>.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXT = path.join(__dirname, '..', '..', 'vinted-sync-extension');
const CAPT = process.env.BANC_CAPTURES || '';
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 300) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

// `etat` : ce que répond `etatConnexion` (null ⇒ port fermé : un service worker d'avant
// la 5.415). `faux` : les autres réponses.
async function rendre(nav, etat, { mode = '', q = '', geste = null, faux = {}, scheme = 'light', mobile = false, locale = 'fr-FR', capture = '' } = {}) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, locale },
    mobile ? { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 360, height: 640 } }));
  const pg = await ctx.newPage();
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8')
    .replace('<script src="popup.js"></script>', '')
    .replace('<script src="parcours-popup.js"></script>', '')
    .replace('<script src="vrm-ui.js"></script>', '');
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
  await pg.route('**/*', (r) => {
    const u = r.request().url();
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(path.join(EXT, 'logo-vrm-96.png')) });
    if (/vrm-badge\.js/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.__badgeCharge = true;' });
    return r.fulfill({ status: 200, contentType: 'text/html', body: html });
  });
  await pg.goto('https://ext.test/popup.html' + (mode ? '?mode=' + mode + (q ? '&' + q : '') : q ? '?' + q : ''));
  await pg.evaluate(({ etat, faux }) => {
    window.__envoyes = []; window.__recharges = 0; window.__ouverts = []; window.__permis = []; window.__enClic = false;
    const mem = Object.assign({}, faux.stock || {}); window.__mem = mem;
    const ferme = (cb) => setTimeout(() => { window.chrome.runtime.lastError = { message: 'The message port closed before a response was received.' }; try { cb && cb(undefined); } finally { window.chrome.runtime.lastError = null; } }, 2);
    window.chrome = {
      runtime: {
        id: 'abcdefghijklmnopabcdefghijklmnop', lastError: null,
        getManifest: () => ({ version: faux.manifeste || '5.415.0' }),
        reload: () => { window.__recharges++; },
        sendMessage: (msg, cb) => {
          window.__envoyes.push(JSON.parse(JSON.stringify(msg)));
          const a = msg.action;
          if (a === 'etatConnexion') { const e = typeof window.__etat === 'function' ? window.__etat() : window.__etat; if (e === null) return ferme(cb); return setTimeout(() => cb && cb(e), 0); }
          if (a === 'authEtat') { if (faux.authEtat === undefined) return ferme(cb); return setTimeout(() => cb && cb(faux.authEtat), 0); }
          if (a === 'lierAvecVRM' && faux.lierFerme) return ferme(cb);
          if (a === 'codeVersion') { if (faux.code === undefined) return ferme(cb); return setTimeout(() => cb && cb({ ok: true, code: faux.code }), 0); }
          if (a === 'fournisseursConnexion') return setTimeout(() => cb && cb(faux.fournisseurs || { ok: false }), 0);
          if (a === 'authLogin') return setTimeout(() => cb && cb(faux.login || { ok: true, email: 'vendeur@exemple.test' }), 300);
          if (a === 'transpPermis') return setTimeout(() => cb && cb(faux.permis === undefined ? { ok: true } : { ok: true, permis: faux.permis, origines: ['https://www.mondialrelay.fr/*', 'https://ws.chronopost.fr/*'] }), 0);
          if (a === 'renouvelerMaintenant' || a === 'annulerLiaison') return setTimeout(() => cb && cb(faux.apres || window.__etat), 0);
          if (a === 'miseAJour') return setTimeout(() => cb && cb({ ok: true, nouvelle: false }), 0);
          return setTimeout(() => cb && cb({ ok: true }), 0);
        },
      },
      storage: { local: {
        get: (k, cb) => { const out = {}; for (const c of [].concat(k)) if (mem[c] !== undefined) out[c] = mem[c]; if (cb) { setTimeout(() => cb(out), 0); return; } return Promise.resolve(out); },
        set: (o, cb) => { Object.assign(mem, o); if (cb) { setTimeout(cb, 0); return; } return Promise.resolve(); },
      }, onChanged: { addListener: (fn) => { window.__surStock = fn; } } },
      tabs: {
        query: (qq, cb) => setTimeout(() => cb(qq && qq.active ? [{ id: 4321, url: 'https://www.vinted.fr/items/1' }] : (faux.vrmOuvert ? [{ id: 9, windowId: 1, url: 'https://vrm.center/' }] : [])), 0),
        get: (id, cb) => setTimeout(() => cb && cb({ id, url: 'https://www.vinted.fr/' }), 0),
        create: (o, cb) => { window.__ouverts.push(o.url); cb && cb(); },
        update: (id, o, cb) => { window.__ouverts.push(o.url || ('onglet:' + id)); cb && cb(); },
      },
      windows: { update: () => {} },
      permissions: { request: (qq, cb) => { window.__permis.push({ n: (qq.origins || []).length, dansLeGeste: window.__enClic }); setTimeout(() => cb && cb(true), 0); } },
    };
    window.__etat = etat;
    window.addEventListener('click', () => { window.__enClic = true; }, true);
    window.addEventListener('click', () => { window.__enClic = false; }, false);
    window.close = () => { window.__ferme = true; };
    if (faux.orion) window.__vrmOrionCompat = true;
  }, { etat, faux });
  await pg.addScriptTag({ path: path.join(EXT, 'vrm-ui.js') });
  await pg.addScriptTag({ path: path.join(EXT, 'popup.js') });
  await pg.waitForTimeout(450);
  if (geste) { await geste(pg); await pg.waitForTimeout(450); }
  const lu = await lire(pg);
  lu.erreurs = erreurs;
  if (capture && CAPT) { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, capture + '.png'), fullPage: true }); }
  await ctx.close();
  return lu;
}
const lire = (pg) => pg.evaluate(() => {
  const vis = (e) => !!(e && e.offsetParent) && !e.closest('[hidden]');
  const boutons = [...document.querySelectorAll('button, a.lien')].filter(vis);
  const pleins = [...document.querySelectorAll('.plein')].filter(vis);
  const ph = document.querySelector('[data-etat-phrase]');
  return {
    etat: document.body.getAttribute('data-connexion'),
    phrases: [...document.querySelectorAll('[data-etat-phrase]')].filter(vis).length,
    phrase: ph && vis(ph) ? ph.textContent.trim() : '',
    pleins: pleins.length, plein: pleins[0] ? pleins[0].textContent.trim() : '', pleinAttr: pleins[0] ? [...pleins[0].attributes].map((a) => a.name).filter((n) => n.startsWith('data-')).join(',') : '',
    champs: [...document.querySelectorAll('input:not([type=hidden])')].filter(vis).map((i) => i.id),
    boutons: boutons.length,
    petites: boutons.filter((b) => Math.round(b.getBoundingClientRect().height) < 44).map((b) => b.textContent.trim().slice(0, 30)),
    vrm: (document.querySelector('[data-compte-vrm]') || {}).textContent || '',
    vinted: (document.querySelector('[data-compte-vinted]') || {}).textContent || '',
    texte: document.body.innerText.replace(/\s+/g, ' ').trim(),
    deborde: document.documentElement.scrollWidth > window.innerWidth,
    envoyes: window.__envoyes, ouverts: window.__ouverts, ferme: !!window.__ferme, recharges: window.__recharges, mem: window.__mem, permis: window.__permis,
    secours: document.body.getAttribute('data-lier-secours'), reparation: document.body.getAttribute('data-reparation'),
    fournisseurs: [...document.querySelectorAll('[data-fournisseur]')].filter(vis).map((b) => b.getAttribute('data-fournisseur')),
    cadre: { badge: window.__badgeCharge === true, drapeau: window.__vrmCadre === true, vide: document.body.children.length === 0 },
    theme: document.documentElement.getAttribute('data-theme'),
    fond: getComputedStyle(document.body).backgroundColor,
    erreurForm: (() => { const e = document.getElementById('authErr'); return e && !e.hidden ? e.textContent : ''; })(),
  };
});
const actions = (r) => r.envoyes.map((m) => m.action);
const H = (min) => Date.now() + min * 60000;
const UN = { ok: true, etat: 'deconnecte', email: '', user_id: null };
const CO = { ok: true, etat: 'connecte', email: 'vendeur@exemple.test', user_id: 'u1', vinted: { uid: '111', login: 'vendeur_a' } };
const base = (r, nom) => {
  dit(!r.erreurs.length, `${nom} : sans erreur`, r.erreurs[0]);
  dit(r.phrases === 1 && !!r.phrase, `${nom} : UNE phrase d’état`, r.texte);
  dit(r.pleins === 1, `${nom} : UN bouton plein`, `${r.pleins} : ${r.plein}`);
  dit(!r.petites.length, `${nom} : toutes les cibles font 44 px au moins`, JSON.stringify(r.petites));
  dit(!r.deborde, `${nom} : rien ne déborde`);
};

(async () => {
  const nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    console.log('\n── Pas reliée (installation neuve)');
    await essaie('pas reliée', async () => {
      for (const [scheme, mobile] of [['light', false], ['dark', false], ['light', true]]) {
        const r = await rendre(nav, UN, { scheme, mobile, capture: `popup-deconnecte-${scheme}${mobile ? '-390' : ''}` });
        const nom = `${scheme}${mobile ? ' 390 px tactile' : ''}`;
        base(r, nom);
        dit(r.etat === 'deconnecte' && /data-se-connecter/.test(r.pleinAttr), `${nom} : l’état « deconnecte », le plein est « Se connecter »`, `${r.etat} ${r.pleinAttr}`);
        dit(!r.champs.length && r.boutons <= 3, `${nom} : aucun champ, au plus 3 choix`, `${r.champs} · ${r.boutons}`);
        dit(!r.ouverts.length && !r.ferme, `${nom} : rien ne s’ouvre tout seul`, JSON.stringify(r.ouverts));
      }
      const v = await rendre(nav, Object.assign({}, UN, { voulue: true }));
      const a = await rendre(nav, Object.assign({}, UN, { attenteExpiree: true }));
      const n = await rendre(nav, UN);
      dit(v.phrase !== n.phrase && a.phrase !== n.phrase && v.phrase !== a.phrase, 'déconnectée par toi / connexion avortée / jamais reliée : trois phrases différentes', JSON.stringify([n.phrase, v.phrase, a.phrase]));
    });

    console.log('\n── « Se connecter »');
    await essaie('se connecter', async () => {
      const r = await rendre(nav, UN, { geste: (pg) => pg.click('[data-se-connecter]') });
      const m = r.envoyes.find((x) => x.action === 'lierAvecVRM') || {};
      dit(m.retourTab === 4321 && /vinted\.fr/.test(m.urlActive || ''), 'fenêtre de l’icône : la demande nomme l’onglet du site où revenir', JSON.stringify(m));
      dit(r.ferme, 'et la fenêtre se ferme (Chrome bascule sur VRM)');
      const o = await rendre(nav, UN, { mode: 'onglet', q: 'depuis=1260447801', geste: (pg) => pg.click('[data-se-connecter]') });
      const mo = o.envoyes.find((x) => x.action === 'lierAvecVRM') || {};
      dit(mo.retourTab === 1260447801 && !o.ferme, 'onglet du menu (`depuis` à 10 chiffres) : le bon onglet, la fenêtre reste et dira l’attente', JSON.stringify(mo));
      const or = await rendre(nav, UN, { faux: { orion: true }, geste: (pg) => pg.click('[data-se-connecter]') });
      dit(!or.ferme && actions(or).includes('lierAvecVRM'), 'Orion : la feuille reste ouverte', JSON.stringify(actions(or)));
    });

    console.log('\n── En attente de VRM, puis connectée');
    await essaie('attente', async () => {
      const r = await rendre(nav, { ok: true, etat: 'attente', attenteJusqua: H(14) }, { capture: 'popup-attente' });
      base(r, 'attente');
      dit(/\d{1,2}[:h]\d{2}/.test(r.texte), 'attente : l’heure de fin est dite (jamais « en cours » sans borne)', r.texte);
      const b = await rendre(nav, { ok: true, etat: 'attente', attenteJusqua: H(14) }, { faux: { apres: UN }, geste: (pg) => pg.click('[data-annuler]') });
      dit(actions(b).includes('annulerLiaison') && b.etat === 'deconnecte', '« Annuler » arrête l’attente', JSON.stringify(actions(b)));
      // Le service worker range la session : le stockage change, la fenêtre se relit seule.
      const c = await rendre(nav, { ok: true, etat: 'attente', attenteJusqua: H(14) }, { geste: async (pg) => { await pg.evaluate((co) => { window.__etat = co; window.__surStock({ vrmSession: { newValue: {} } }, 'local'); }, CO); } });
      dit(c.etat === 'connecte', 'la session arrive (stockage) : la fenêtre passe à « connecté » sans geste', c.etat);
    });

    console.log('\n── Connectée');
    await essaie('connectée', async () => {
      const r = await rendre(nav, CO, { mode: 'onglet', capture: 'popup-connecte' });
      base(r, 'connectée');
      dit(r.etat === 'connecte' && r.vrm === 'vendeur@exemple.test' && r.vinted === 'vendeur_a', 'le compte VRM et le compte Vinted de ce navigateur sont nommés', `${r.vrm} · ${r.vinted}`);
      dit(/data-ouvrir-vrm/.test(r.pleinAttr), 'le plein est « Ouvrir VRM »', r.pleinAttr);
      const o = await rendre(nav, CO, { geste: (pg) => pg.click('[data-ouvrir-vrm]') });
      dit(o.ouverts.some((u) => /^https:\/\/vrm\.center\/\?tab=plat_vinted$/.test(u)), '« Ouvrir VRM » ouvre VRM sur l’écran du site de l’onglet', JSON.stringify(o.ouverts));
      const d = await rendre(nav, CO, { mode: 'onglet', faux: { apres: UN }, geste: async (pg) => { await pg.evaluate((un) => { window.__etat = Object.assign({}, un, { voulue: true }); }, UN); await pg.click('[data-se-deconnecter]'); } });
      dit(actions(d).includes('authLogout') && d.etat === 'deconnecte', '« Se déconnecter » : `authLogout`, puis « pas reliée »', JSON.stringify(actions(d)));
      const sans = await rendre(nav, Object.assign({}, CO, { vinted: null }));
      dit(!!sans.vinted && sans.vinted !== 'vendeur_a', 'pas de compte Vinted ouvert ici : c’est dit, jamais un compte deviné', sans.vinted);
      const p = await rendre(nav, CO, { mode: 'onglet', faux: { permis: false }, geste: (pg) => pg.click('#transpPermisBtn') });
      dit(p.permis.length === 1 && p.permis[0].dansLeGeste === true, 'Firefox : « Autoriser le suivi des transporteurs » demande la permission DANS le geste', JSON.stringify(p.permis));
    });

    console.log('\n── Panne de renouvellement, session expirée');
    await essaie('panne', async () => {
      const r = await rendre(nav, Object.assign({}, CO, { etat: 'pause', pauseJusqua: H(3) }), { capture: 'popup-pause' });
      base(r, 'pause');
      dit(/\d{1,2}[:h]\d{2}/.test(r.phrase), 'pause : la phrase donne l’heure du prochain essai', r.phrase);
      const b = await rendre(nav, Object.assign({}, CO, { etat: 'pause', pauseJusqua: H(3) }), { faux: { apres: CO }, geste: (pg) => pg.click('[data-reessayer]') });
      dit(actions(b).includes('renouvelerMaintenant') && b.etat === 'connecte', '« Réessayer » : un renouvellement, puis « connecté »', JSON.stringify(actions(b)));
      const lent = await rendre(nav, Object.assign({}, CO, { etat: 'renouvellement' }), { geste: (pg) => pg.waitForTimeout(13500) });
      dit(lent.etat === 'pause', '« en cours de renouvellement » plus de 12 s ⇒ dit comme une panne passagère (jamais « un instant » pour toujours)', lent.etat);
      const e = await rendre(nav, { ok: true, etat: 'expiree', email: 'vendeur@exemple.test' }, { capture: 'popup-expiree' });
      base(e, 'expirée');
      dit(e.etat === 'expiree' && /data-se-connecter/.test(e.pleinAttr) && e.vrm === 'vendeur@exemple.test', 'expirée : « Se reconnecter », le compte nommé', `${e.pleinAttr} ${e.vrm}`);
    });

    console.log('\n── Le recours ici : e-mail et mot de passe VRM, Google / Discord');
    await essaie('recours', async () => {
      const ouvrir = (pg) => pg.click('[data-autre-moyen]');
      const r = await rendre(nav, UN, { faux: { fournisseurs: { ok: true, google: true, discord: false } }, geste: ouvrir, capture: 'popup-recours' });
      dit(!r.erreurs.length && r.champs.join() === 'mail,pw', 'deux champs : e-mail et mot de passe VRM', JSON.stringify(r.champs));
      dit(/pas Vinted/i.test(r.texte), 'la fenêtre dit QUEL mot de passe (VRM, pas Vinted)', r.texte.slice(0, 200));
      dit(r.fournisseurs.join() === 'google', 'Google activé, Discord non : seul Google est proposé', JSON.stringify(r.fournisseurs));
      dit(!r.petites.length, 'recours : cibles ≥ 44 px', JSON.stringify(r.petites));
      const ps = await rendre(nav, UN, { geste: ouvrir });
      dit(!ps.fournisseurs.length, 'fournisseurs « pas su » : aucun bouton qui mènerait à une erreur', JSON.stringify(ps.fournisseurs));
      const g = await rendre(nav, UN, { faux: { fournisseurs: { ok: true, google: true, discord: true } }, geste: async (pg) => { await ouvrir(pg); await pg.waitForTimeout(200); await pg.click('[data-fournisseur="discord"]'); } });
      dit((g.envoyes.find((m) => m.action === 'oauthDepart') || {}).fournisseur === 'discord', '« Continuer avec Discord » : `oauthDepart` (PKCE, dans l’extension)', JSON.stringify(actions(g)));
      const vide = await rendre(nav, UN, { geste: async (pg) => { await ouvrir(pg); await pg.click('#inBtn'); } });
      dit(!actions(vide).includes('authLogin') && !!vide.erreurForm, 'champs vides : dit AVANT tout envoi', vide.erreurForm);
      const forme = await rendre(nav, UN, { geste: async (pg) => { await ouvrir(pg); await pg.fill('#mail', 'pas-un-mail'); await pg.fill('#pw', 'x'); await pg.click('#inBtn'); } });
      dit(!actions(forme).includes('authLogin') && !!forme.erreurForm, 'e-mail mal formé : dit avant tout envoi', forme.erreurForm);
      const deux = await rendre(nav, UN, { geste: async (pg) => { await ouvrir(pg); await pg.fill('#mail', 'vendeur@exemple.test'); await pg.fill('#pw', 'mot-de-passe-fictif'); await pg.press('#pw', 'Enter'); await pg.press('#pw', 'Enter'); await pg.click('#inBtn').catch(() => {}); } });
      dit(actions(deux).filter((a) => a === 'authLogin').length === 1, 'Entrée deux fois + clic : UNE connexion part', JSON.stringify(actions(deux)));
      dit(!JSON.stringify(deux.mem).includes('mot-de-passe-fictif'), 'le mot de passe n’est rangé nulle part par la fenêtre');
      const refus = await rendre(nav, UN, { faux: { login: { ok: false, error: 'Email ou mot de passe incorrect.' } }, geste: async (pg) => { await ouvrir(pg); await pg.fill('#mail', 'vendeur@exemple.test'); await pg.fill('#pw', 'essai'); await pg.click('#inBtn'); await pg.waitForTimeout(400); } });
      dit(/incorrect/.test(refus.erreurForm), 'refus : la raison est dite', refus.erreurForm);
      // Une relecture (stockage) pendant la saisie ne l'efface pas.
      const tape = await rendre(nav, UN, { geste: async (pg) => { await ouvrir(pg); await pg.fill('#mail', 'vendeur@exemple.test'); await pg.evaluate(() => window.__surStock({ vrmLiaison: { newValue: {} } }, 'local')); await pg.waitForTimeout(400); } });
      const garde = tape.champs.includes('mail');
      dit(garde, 'une relecture pendant la saisie ne redessine pas le formulaire', JSON.stringify(tape.champs));
    });

    console.log('\n── Service worker d’avant (code périmé), ou muet');
    await essaie('périmé', async () => {
      const a = await rendre(nav, null, { faux: { authEtat: { ok: true, connecte: true, email: 'vendeur@exemple.test' } } });
      dit(a.etat === 'connecte' && !a.erreurs.length, 'un fond d’avant la 5.415 (pas d’`etatConnexion`) : son `authEtat` ramené au même état', a.etat);
      const m = await rendre(nav, null, {});
      dit(m.etat === 'muet' && m.pleins === 1 && m.phrases === 1, 'fond muet : « l’extension ne répond pas » et le geste (⟳), jamais « connecté » ni « déconnecté »', `${m.etat} · ${m.phrase}`);
      const p = await rendre(nav, UN, { faux: { lierFerme: true, code: '5.410.8' }, geste: (pg) => pg.click('[data-se-connecter]') });
      dit(p.ouverts.some((u) => /lier-extension=abcdefghijklmnopabcdefghijklmnop/.test(u)) && p.recharges === 1 && p.secours === 'recharge', '« Se connecter » sur un code périmé : VRM s’ouvre quand même, puis ⟳ une fois', JSON.stringify({ o: p.ouverts, r: p.recharges, s: p.secours }));
    });

    console.log('\n── La carte et la réparation (inchangées)');
    await essaie('carte', async () => {
      const c = await rendre(nav, UN, { mode: 'carte' });
      dit(c.cadre.badge && c.cadre.drapeau && c.cadre.vide && !c.envoyes.length, 'la carte charge vrm-badge.js en cadre, rien d’autre', JSON.stringify(c.cadre));
      const a = await rendre(nav, UN, { mode: 'reparer', faux: { code: '5.129.0' } });
      dit(a.recharges === 1 && a.reparation === 'recharge', 'réparer : code d’avant ⇒ ⟳ une fois', `${a.recharges} ${a.reparation}`);
      const b = await rendre(nav, UN, { mode: 'reparer', faux: { code: '5.129.0', stock: { vrmReparation: a.mem.vrmReparation } } });
      dit(b.recharges === 0 && b.reparation === 'deja', 'réparer : pas une seconde fois', `${b.recharges} ${b.reparation}`);
      const d = await rendre(nav, UN, { mode: 'reparer', faux: { code: '5.415.0' } });
      dit(d.recharges === 0 && d.reparation === 'a-jour', 'réparer : code à jour ⇒ rien', `${d.recharges} ${d.reparation}`);
    });

    console.log('\n── Langue et teinte');
    await essaie('langue', async () => {
      const en = await rendre(nav, UN, { locale: 'en-US' });
      const fr = await rendre(nav, UN);
      dit(en.plein && en.plein !== fr.plein && en.phrase !== fr.phrase, 'navigateur en anglais : la fenêtre parle anglais', `${en.plein} · ${en.phrase}`);
      const s = await rendre(nav, UN, { faux: { stock: { vrmApparence: 'sombre' } } });
      dit(s.theme === 'sombre' && s.fond !== fr.fond, 'la teinte choisie dans VRM (sombre) passe avant le système', `${s.theme} ${s.fond}`);
    });
  } finally { await nav.close(); }
  console.log(`\n${ko ? '❌' : '✅'} popup : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();

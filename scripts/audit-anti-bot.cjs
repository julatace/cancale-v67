#!/usr/bin/env node
// audit-anti-bot.cjs — la vérification anti-robot et les routes publiques (20 octobre).
//
// Ce que l'audit EXÉCUTE :
//   1. `src/captcha.js` (les vraies fonctions) : clé de site VIDE ⇒ le corps
//      envoyé à GoTrue est IDENTIQUE (même objet), aucune route n'exige rien ;
//      la liste des routes protégées suit celle de GoTrue (`verifyCaptcha` :
//      signup, token?grant_type=password, otp, magiclink, recover, resend — et
//      PAS refresh_token, pkce, verify, user, factors) ;
//   2. `authCall` d'App.jsx passe bien par `corpsAvecCaptcha` (sinon une clé
//      posée n'enverrait rien) ;
//   3. aucune clé SECRÈTE Turnstile dans le dépôt public ;
//   4. `api/relais.js` (route exécutée, fetch espionné) : sans session ⇒ 401 et
//      ZÉRO appel à Nominatim / Overpass ; avec une session ⇒ la recherche part
//      (l'autre sens) ; et plus aucune mise en cache publique.
// --src <dossier> : lance l'audit sur une autre racine (mutations, §6.1).
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const iSrc = process.argv.indexOf('--src');
const R = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');

let ko = 0;
const ctl = (c, m, d) => { if (!c) ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };

(async () => {
  console.log('── 1. src/captcha.js, clé vide');
  const fic = path.join(R, 'src', 'captcha.js');
  if (!fs.existsSync(fic)) { ctl(false, 'src/captcha.js existe'); }
  else {
    const m = await import(pathToFileURL(fic).href);
    ctl(m.TURNSTILE_SITE_KEY === '', 'la clé de site du dépôt est vide (rien ne change au déploiement)', JSON.stringify(m.TURNSTILE_SITE_KEY));
    ctl(m.captchaActif() === false, 'clé vide ⇒ protection inactive côté app');
    const corps = { email: 'a@b.fr', password: 'x' };
    for (const p of ['signup?redirect_to=x', 'token?grant_type=password', 'otp', 'recover', 'resend', 'magiclink'])
      ctl(m.corpsAvecCaptcha(p, corps) === corps, `clé vide : « ${p} » part avec le corps d'avant, intact`);
    const prot = ['signup', 'signup?redirect_to=https%3A%2F%2Fvrm.center', 'token?grant_type=password', 'otp?redirect_to=x', 'recover', 'resend', 'magiclink'];
    const libres = ['token?grant_type=refresh_token', 'token?grant_type=pkce', 'verify', 'user', 'factors', 'factors/f1/verify', 'logout', 'settings'];
    ctl(prot.every(m.routeProtegee), 'les routes que GoTrue protège sont reconnues', prot.filter((p) => !m.routeProtegee(p)).join(', '));
    ctl(!libres.some(m.routeProtegee), 'les routes exemptées (renouvellement, PKCE, vérification, MFA) ne le sont pas', libres.filter(m.routeProtegee).join(', '));
  }

  console.log('── 2. authCall joint le jeton');
  const app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
  const ac = app.slice(app.indexOf('const authCall = async'), app.indexOf('const authCall = async') + 1500);
  ctl(/corpsAvecCaptcha\(path, body\)/.test(ac) && /JSON\.stringify\(corps\)/.test(ac), 'authCall envoie le corps passé par corpsAvecCaptcha');
  ctl(/consommerCaptcha\(\)/.test(ac), 'authCall consomme le jeton (usage unique)');

  console.log('── 3. aucun secret Turnstile dans le dépôt');
  const fichiers = ['src/captcha.js', 'src/App.jsx', '.env.example', 'CLAUDE.md'].map((f) => path.join(R, f)).filter(fs.existsSync);
  const fuite = fichiers.filter((f) => /TURNSTILE_SECRET\s*[=:]\s*['"]?0x[0-9A-Za-z_-]{20,}/.test(fs.readFileSync(f, 'utf8')));
  ctl(fuite.length === 0, 'aucune clé secrète Turnstile écrite', fuite.join(', '));

  console.log('── 4. api/relais.js : plus un relais public');
  const appels = [];
  const vrai = global.fetch;
  global.fetch = async (u) => {
    u = String(u); appels.push(u);
    if (/\/auth\/v1\/user/.test(u)) return { ok: true, status: 200, json: async () => ({ id: '11111111-2222-3333-4444-555555555555', email: 'v@exemple.fr' }) };
    if (/nominatim/.test(u)) return { ok: true, status: 200, json: async () => ([{ lat: '48.6', lon: '-1.85', boundingbox: ['48.5', '48.7', '-1.9', '-1.8'] }]) };
    if (/overpass|kumi|mail\.ru/.test(u)) return { ok: true, status: 200, json: async () => ({ elements: [] }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const res = () => { const r = { code: 0, h: {}, corps: null }; r.status = (c) => { r.code = c; return r; }; r.json = (d) => { r.corps = d; return r; }; r.setHeader = (k, v) => { r.h[k] = v; }; return r; };
  try {
    const h = (await import(pathToFileURL(path.join(R, 'api', 'relais.js')).href)).default;
    const r1 = res(); await h({ query: { city: 'Cancale' }, headers: {} }, r1);
    const ext1 = appels.filter((u) => /nominatim|overpass|kumi|mail\.ru/.test(u));
    ctl(r1.code === 401, 'sans session : 401', 'statut ' + r1.code);
    ctl(ext1.length === 0, 'sans session : ZÉRO appel à Nominatim / Overpass', ext1.length + ' appel(s)');
    appels.length = 0;
    const r2 = res(); await h({ query: { city: 'Cancale' }, headers: { authorization: 'Bearer a.b.c' } }, r2);
    ctl(r2.code === 200 && appels.some((u) => /nominatim/.test(u)), "avec une session : la recherche part (l'autre sens)", `statut ${r2.code}`);
    ctl(!/s-maxage|public/.test(String(r2.h['Cache-Control'] || '')), 'aucune mise en cache publique (un cache CDN servirait sans session)', String(r2.h['Cache-Control']));
  } catch (e) { ctl(false, 'api/relais.js exécutée', e.message); }
  global.fetch = vrai;

  console.log(ko ? `\n❌ ${ko} contrôle(s) en échec` : '\n✅ anti-robot et routes publiques : conforme');
  process.exit(ko ? 1 : 0);
})();

// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « Supprimer mon compte » dit la vérité selon le compte
//  (11 nov., lot suppression-oauth ; docs/passation/2026-11-11-suppression-oauth.md)
//
//  Bug vécu : compte créé par Discord (aucun mot de passe) ⇒ l'écran demandait le
//  mot de passe ; le serveur, lui, acceptait la connexion récente (voulu).
//   S1  l'écran et le serveur font le MÊME calcul (api/_lib/preuve-connexion.js) ;
//       la fenêtre n'a pas bougé : ≤ 10 min, au plus 1 min dans le futur ;
//   S2  les 4 comptes : Discord récent · Discord ancien · mot de passe · mot de
//       passe récent ⇒ le bon cas ; « pas su » ne vaut pas « sans mot de passe » ;
//   S3  le serveur refuse sans « SUPPRIMER », sans preuve ; sa phrase nomme
//       Discord à un compte sans mot de passe ;
//   S4  l'écran : le champ mot de passe n'existe que sous `champMdp`, qui exclut
//       les comptes OAuth ; la reconnexion n'annule rien (aucune intention) ;
//   S5  le message « déjà son propre compte » : 3 gestes, cohérents avec l'écran.
//  `--prouve` : mutations (champ réaffiché pour OAuth ; « pas su » = OAuth ;
//  fenêtre élargie) ⇒ chacune doit rougir.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..');
const lit = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const MAINT = Date.parse('2026-11-11T12:00:00Z');
const jeton = (providers, ilYaMs, methode = 'oauth') => `${b64({ alg: 'HS256' })}.${b64({ sub: 'u', app_metadata: providers ? { provider: providers[0], providers } : {}, amr: ilYaMs == null ? [] : [{ method: methode, timestamp: Math.floor((MAINT - ilYaMs) / 1000) }] })}.sig`;

async function controler(sources) {
  let ko = 0, ok = 0; const echecs = [];
  const dit = (bon, quoi, det) => { if (bon) ok++; else { ko++; echecs.push(quoi); } if (!sources.muet) console.log(`${bon ? '✅' : '❌'} ${quoi}${!bon && det !== undefined ? ' — ' + JSON.stringify(det).slice(0, 200) : ''}`); };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-suppr-oauth-'));
  // Une copie de api/_lib (les imports relatifs tiennent), avec la source éventuellement mutée.
  fs.cpSync(path.join(RACINE, 'api', '_lib'), path.join(dir, '_lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, '_lib', 'preuve-connexion.js'), sources.preuve);
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const P = await import(path.join(dir, '_lib', 'preuve-connexion.js'));
  const S = await import(path.join(dir, '_lib', 'suppression-compte.js'));

  // S1 — même calcul, fenêtre inchangée
  dit(S.derniereConnexion === P.derniereConnexion || String(S.derniereConnexion) === String(P.derniereConnexion), 'S1 le serveur lit la connexion avec la fonction partagée');
  dit(P.FENETRE_RECENTE_MS === 600000 && S.FENETRE_RECENTE_MS === 600000, 'S1 fenêtre : 10 minutes, des deux côtés');
  dit(P.connexionRecente(MAINT - 600000, MAINT) && !P.connexionRecente(MAINT - 600001, MAINT), 'S1 10 min pile : oui ; 10 min + 1 ms : non');
  dit(P.connexionRecente(MAINT + 60000, MAINT) && !P.connexionRecente(MAINT + 60001, MAINT) && !P.connexionRecente(null, MAINT), 'S1 au plus 1 min dans le futur ; pas dit ⇒ non');
  dit(P.derniereConnexion(jeton(['discord'], 120000)) === Math.floor((MAINT - 120000) / 1000) * 1000, 'S1 la date lue dans amr (secondes ⇒ ms)');

  // S2 — les 4 comptes (+ pas su)
  const cas = (j, id) => P.preuveSuppression({ jeton: j, identites: id, maintenant: MAINT });
  const A = cas(jeton(['discord'], 120000)), B = cas(jeton(['discord'], 1800000)), C = cas(jeton(['email'], 1800000, 'password')), D = cas(jeton(['email', 'discord'], 180000, 'password'));
  dit(A.cas === 'oauth-recent' && A.aMdp === false && A.oauth.join() === 'discord', 'S2 A Discord récent ⇒ oauth-recent', A);
  dit(B.cas === 'oauth-ancien' && B.oauth.join() === 'discord', 'S2 B Discord ancien ⇒ oauth-ancien (reconnexion)', B);
  dit(C.cas === 'mdp' && C.aMdp === true, 'S2 C mot de passe ancien ⇒ mdp (le champ)', C);
  dit(D.cas === 'mdp-recent' && D.oauth.join() === 'discord', 'S2 D mot de passe récent ⇒ mdp-recent', D);
  const X = cas('pas-un-jeton'), Y = cas(jeton(null, 1800000));
  dit(X.cas === 'pas-su' && X.aMdp === null && Y.cas === 'pas-su', 'S2 « pas su » ne vaut pas « sans mot de passe » (champ gardé)', [X, Y]);
  const F = cas(jeton(['discord'], 1800000), [{ fournisseur: 'email' }, { fournisseur: 'discord' }]);
  dit(F.cas === 'mdp', 'S2 la fiche (identités) passe avant le jeton', F);
  dit(A.resteMs === 480000, 'S2 le temps qui reste : 8 min après 2 min', A.resteMs);

  // S3 — le serveur reste juge
  const u = { id: 'u', email: 'v@exemple.test' }, jamais = async () => { throw Error('jamais appelé'); };
  const v = (corps, j) => S.verifierConfirmation({ corps, utilisateur: u, jeton: j, maintenant: MAINT, verifier: jamais });
  const r1 = await v({ confirmation: '' }, jeton(['discord'], 1000));
  dit(!r1.ok && r1.erreur === 'confirmation', 'S3 sans « SUPPRIMER » ⇒ refusé, même connexion récente', r1);
  const r2 = await v({ confirmation: 'SUPPRIMER' }, jeton(['discord'], 120000));
  dit(r2.ok && r2.par === 'connexion-recente', 'S3 Discord récent + « SUPPRIMER » ⇒ accepté (la règle voulue)', r2);
  const r3 = await v({ confirmation: 'SUPPRIMER' }, jeton(['discord'], 1800000));
  dit(!r3.ok && r3.code === 403 && /Reconnecte-toi avec Discord/.test(r3.message) && /Rien n'a été effacé/.test(r3.message) && !/mot de passe/.test(r3.message), 'S3 Discord ancien ⇒ 403, la phrase nomme Discord, jamais « mot de passe »', r3);
  const r4 = await v({ confirmation: 'SUPPRIMER' }, jeton(['email'], 1800000, 'password'));
  dit(!r4.ok && /mot de passe/.test(r4.message), 'S3 compte à mot de passe ancien ⇒ la phrase d’avant', r4);
  const r5 = await S.verifierConfirmation({ corps: { confirmation: 'SUPPRIMER', motDePasse: 'x' }, utilisateur: u, jeton: jeton(['email'], 1800000), maintenant: MAINT, verifier: async () => false });
  dit(!r5.ok && r5.erreur === 'mot-de-passe', 'S3 mauvais mot de passe ⇒ refusé', r5);

  // S4 — l'écran
  const R = sources.reglages;
  const deb = R.indexOf('function FermerCompte('), fin = R.indexOf('// Le contact de VRM', deb);
  const F4 = deb > 0 && fin > deb ? R.slice(deb, fin) : '';
  const champs = [...F4.matchAll(/type="password"/g)].length;
  const avant = F4.slice(0, F4.indexOf('type="password"'));
  dit(F4 && champs === 1, 'S4 un seul champ mot de passe dans l’écran', champs);
  dit(/\{champMdp && \(\s*<>\s*<label/.test(avant.slice(-400)), 'S4 le champ n’est rendu que sous `champMdp`');
  dit(/const recente = preuve\.recente, champMdp = !recente && \(preuve\.cas === 'mdp' \|\| preuve\.cas === 'pas-su'\);/.test(F4), 'S4 `champMdp` exclut oauth-recent, oauth-ancien et toute connexion récente');
  dit(/preuveSuppression\(\{ jeton: AUTH\.session && AUTH\.session\.access_token/.test(F4) && /from '\.\.\/\.\.\/api\/_lib\/preuve-connexion\.js'/.test(R), 'S4 l’écran calcule avec la règle du serveur, sur SON jeton');
  dit(/oauthStart\(p, 'reconnexion'\)/.test(F4), 'S4 « Me reconnecter avec … » : une reconnexion, pas une connexion');
  const A_ = sources.app;
  dit(/const reco=intention==='reconnexion';/.test(A_) && /if\(!reco\)poserIntentionOAuth/.test(A_) && /if\(reco\)st\.removeItem\(CLE_INTENTION_OAUTH\)/.test(A_), 'S4 la reconnexion ne pose aucune intention (rien n’est annulé au retour)');
  const iReco = A_.indexOf('if(!reconnexionPermise(reco,r.json))'), iDebut = A_.indexOf('const consumeAuthRedirect');
  dit(/if\(!reconnexionPermise\(reco,r\.json\)\)return\{error:/.test(A_) && iDebut > 0 && iReco > iDebut && !A_.slice(iDebut, iReco).includes('writeSession(') && A_.indexOf('writeSession(sessionFrom(r.json));', iReco) > iReco, 'S4 retour d’un AUTRE compte ⇒ refusé AVANT d’écrire la session');
  dit(/!liaison&&!reco&&!recovery\?compteOAuthNeuf/.test(A_), 'S4 une reconnexion n’est jamais prise pour un compte neuf');

  // S5 — le message de liaison
  // (relecture du 11 nov.) Depuis la fusion avec connexions-oauth, la phrase vit dans
  // src/auth/erreursOAuth.js (recopiée dans l'extension) ; l'ancienne forme dans App.jsx reste lue.
  const m = /return `(Ce \$\{nom\} a déjà son propre compte VRM\.[^`]*)`/.exec(sources.erreurs || '') || /already\.\*link[^\n]*return `([^`]*)`/.exec(A_);
  const msg = m ? m[1] : '';
  const phrases = msg.replace(/\$\{[^}]*\}/g, 'X').split(/(?<=[.!?])\s+/).filter(Boolean);
  dit(/1\. /.test(msg) && /2\. /.test(msg) && /3\. /.test(msg), 'S5 « déjà son propre compte » : 3 gestes numérotés', msg);
  dit(/Supprimer mon compte/.test(msg) && /SUPPRIMER/.test(msg) && /Continuer avec/.test(msg) && /relie/.test(msg), 'S5 les gestes de l’écran : Continuer avec … · Supprimer mon compte, SUPPRIMER · relier', msg);
  dit(phrases.every((p) => p.split(/\s+/).filter((w) => /\w/.test(w)).length <= 12), 'S5 ≤ 12 mots par phrase', phrases);

  fs.rmSync(dir, { recursive: true, force: true });
  return { ok, ko, echecs };
}

(async () => {
  const sources = { preuve: lit('api/_lib/preuve-connexion.js'), reglages: lit('src/ecrans/Reglages.jsx'), app: lit('src/App.jsx'), erreurs: lit('src/auth/erreursOAuth.js') };
  const r = await controler(sources);
  console.log(`\n${r.ok} contrôle(s) OK, ${r.ko} en échec`);
  if (process.argv.includes('--prouve')) {
    const mutations = [
      ['champ mot de passe réaffiché pour un compte OAuth', { reglages: sources.reglages.replace("champMdp = !recente && (preuve.cas === 'mdp' || preuve.cas === 'pas-su');", 'champMdp = true;') }],
      ['« pas su » pris pour « sans mot de passe »', { preuve: sources.preuve.replace("Array.isArray(fournisseurs) ? fournisseurs.includes('email') : null", "Array.isArray(fournisseurs) ? fournisseurs.includes('email') : false") }],
      ['fenêtre élargie à 15 min', { preuve: sources.preuve.replace('FENETRE_RECENTE_MS = 10 * 60 * 1000', 'FENETRE_RECENTE_MS = 15 * 60 * 1000') }],
      ['la reconnexion pose une intention de connexion', { app: sources.app.replace('if(!reco)poserIntentionOAuth', 'poserIntentionOAuth') }],
      ['ancien message de liaison', { erreurs: sources.erreurs.replace(/return `Ce \$\{nom\} a déjà son propre compte VRM\.[^`]*`/, 'return `Ce ${nom} a déjà son propre compte VRM. Connecte-toi avec ${nom}, puis supprime cet autre compte (Paramètres → Supprimer mon compte). Reviens ensuite ici le relier.`') }],
    ];
    let tous = true;
    for (const [nom, m] of mutations) {
      const src = { ...sources, ...m, muet: true };
      const changee = Object.keys(m).every((k) => m[k] !== sources[k]);
      const x = await controler(src);
      const rouge = changee && x.ko > 0;
      if (!rouge) tous = false;
      console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${changee ? x.ko + ' en échec' : 'MUTATION NON APPLIQUÉE'}${x.echecs.length ? ' (' + x.echecs[0] + ')' : ''}`);
    }
    if (!tous) process.exit(1);
  }
  process.exit(r.ko ? 1 : 0);
})();

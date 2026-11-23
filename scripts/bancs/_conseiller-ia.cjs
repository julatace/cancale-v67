// ── scripts/bancs/_conseiller-ia.cjs — la passe « Demande à VRM » du banc conseiller (23 nov., tranche 2) ──
// Chargé par scripts/bancs/conseiller.cjs (pas un banc à lui seul). Le réseau d'essai sert la clé (aucune · posée) et
// la route de l'IA, et COMPTE les requêtes :
//    I1 sans SA clé : l'écran le dit, le champ de clé est masqué (mot de passe), AUCUNE requête vers /api/ai ;
//    I2 avec SA clé : une question ⇒ UNE requête, le contexte ne porte que des agrégats (aucun acheteur, aucune ligne de
//       vente) dont les conseils de la règle ; la réponse s'affiche avec ses chiffres et son coût ; le geste proposé est
//       un bouton : c'est SON toucher qui le rend (rien n'agit seul) ; l'estimation du coût est dite avant.
'use strict';
const path = require('path');
global.passeIA = async ({ nav, port, W, sombre, ou, th, ouvrir, dit, SHOTS }) => {
  let A = await ouvrir(nav, port, { W, sombre, base: 'lu', vue: 'ecran', cle: 'aucune' });
  try {
    await A.pg.waitForSelector('[data-ia="aucune"]', { timeout: 5000 }).catch(() => {});
    const r = await A.pg.evaluate(() => ({ etat: (document.querySelector('[data-ia]') || { getAttribute: () => '' }).getAttribute('data-ia'), sans: !!document.querySelector('[data-ia-sans-cle]'),
      type: (document.querySelector('[data-ia-cle-saisie]') || {}).type || '', question: !!document.querySelector('[data-ia-question]') }));
    dit(r.etat === 'aucune' && r.sans && r.type === 'password' && !r.question, `I1 ${ou} : sans SA clé, l'écran le dit, la clé se saisit masquée, aucune question possible`, r);
    dit(A.appelsIA.length === 0, `I1 ${ou} : sans SA clé, AUCUNE requête vers /api/ai`, A.appelsIA.length);
    await A.pg.screenshot({ path: path.join(SHOTS, `ia-sans-cle-${W}-${th}.png`), fullPage: true });
  } finally { await A.ctx.close(); }
  A = await ouvrir(nav, port, { W, sombre, base: 'lu', vue: 'ecran', cle: 'posee' });
  try {
    await A.pg.waitForSelector('[data-ia-question]', { timeout: 5000 }).catch(() => {});
    const est = await A.pg.evaluate(() => (document.querySelector('[data-ia-estimation]') || { getAttribute: () => '' }).getAttribute('data-ia-estimation'));
    dit(Number(est) > 0 && Number(est) < 0.01, `I2 ${ou} : l'estimation du coût est dite avant la question (${est} $)`, est);
    dit(A.appelsIA.length === 0, `I2 ${ou} : clé posée, rien ne part tant qu'il ne demande pas`, A.appelsIA.length);
    await A.pg.fill('[data-ia-question]', 'Qu’est-ce que je devrais baisser ?');
    await A.pg.click('[data-ia-demander]');
    await A.pg.waitForSelector('[data-ia-reponse]', { timeout: 5000 }).catch(() => {});
    const corps = A.appelsIA[0] || {};
    const txt = JSON.stringify(corps.contexte || {});
    const ids = await A.pg.evaluate(() => window.__CONSEILS.map((c) => c.id));
    dit(A.appelsIA.length === 1 && corps.question && ids.every((i) => txt.includes(`"id":"${i}"`)) && !/acheteur|buyer|"tx\d|vendeur_exemple_acheteur/.test(txt) && !/"ts":/.test(txt),
      `I2 ${ou} : UNE requête ; le contexte = les agrégats de VRM (les ${ids.length} conseils), aucun acheteur, aucune ligne de vente`, { n: A.appelsIA.length, taille: txt.length });
    const rr = await A.pg.evaluate(() => ({ rep: !!document.querySelector('[data-ia-reponse]'), chiffres: (document.querySelector('[data-ia-chiffres]') || { getAttribute: () => '' }).getAttribute('data-ia-chiffres'),
      cout: (document.querySelector('[data-ia-chiffres]') || { getAttribute: () => '' }).getAttribute('data-ia-cout'), geste: !!document.querySelector('[data-ia-geste="baisses"]') }));
    dit(rr.rep && rr.chiffres === '1' && rr.cout === '0.00041' && rr.geste, `I2 ${ou} : la réponse, ses chiffres cités, son coût réel, et le geste en bouton`, rr);
    const g0 = await A.pg.evaluate(() => window.__GESTES.length);
    dit(g0 === 0, `I2 ${ou} : la réponse n'a RIEN fait seule`, g0);
    await A.pg.click('[data-ia-geste="baisses"]');
    const g = await A.pg.evaluate(() => window.__GESTES.slice());
    dit(g.length === 1 && g[0] === 'baisses', `I2 ${ou} : c'est SON toucher qui rend le geste`, g);
    await A.pg.screenshot({ path: path.join(SHOTS, `ia-reponse-${W}-${th}.png`), fullPage: true });
    dit(!A.erreurs.length, `${ou} IA : aucune erreur de page`, A.erreurs);
  } finally { await A.ctx.close(); }
};

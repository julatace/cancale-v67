require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « MA JOURNÉE NE MONTRE QUE CE QUI DEMANDE UN GESTE » (15 nov. 2026, Julien sur ses captures : « on n'a pas
//  forcément d'infos sur ces cases, elles apparaissent un peu au hasard », « tu peux mettre litige achat, vente
//  ensemble ici », « tu peux enlever »). Récit : docs/passation/2026-11-15-refonte-journee.md.
//
//  R  LA RÈGLE (src/retoursAchat.js, le vrai module) puis réaffaiblie (mutations) :
//     R1 un retour d'achat dont la date limite est passée de plus de 7 jours SANS bordereau, dépôt, fait du transporteur
//        ni remboursement (le cas réel : « date limite passée mer. 14 oct. · bordereau pas arrivé ») est « à vérifier »,
//        pas actif ; R2 un seul fait connu (bordereau, « Déposé », fait du transporteur, remboursement) ou 7 jours pas
//        encore passés ⇒ il reste actif ; R3 « C'est réglé » (SON clic) l'archive.
//  A  L'APP RENDUE (base inventée ; 390 tactile et 1512) :
//     A1 UN bloc « Retours et litiges » réunit l'ACHAT (« tu renvoies ») et la VENTE (transaction suspendue) ;
//     A2 aucune ligne de retour ou de litige ailleurs sur Ma journée (ni « À renvoyer » seul, ni carte « litige ») ;
//     A3 sur Ma journée (hors feuille) : ni « À trancher », ni comptes sans e-mail, ni santé des comptes, ni e-mails à trier,
//        ni import du passé, ni contrôle de nuit ;
//     A4 une ligne « Tout va bien ? · N points » ouvre la feuille qui les porte (rien supprimé) ;
//     A5 aucune erreur JS.
//  Données INVENTÉES (design-passe). `LARGEURS=390` `THEMES=clair` ; `BANC_DIST=` ; `SHOTS=`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const RACINE = path.join(__dirname, '..', '..');
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair');
const SHOTS = process.env.SHOTS || P.SHOTS; fs.mkdirSync(SHOTS, { recursive: true });
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det != null ? ' — ' + String(det).slice(0, 400) : ''}`); };

// ── R ──
const SRC = fs.readFileSync(path.join(RACINE, 'src', 'retoursAchat.js'), 'utf8');
// Le module tel quel (son import relatif rendu absolu), écrit dans un fichier temporaire : importé, puis muté.
let nCharge = 0;
const charger = (t) => {
  const f = path.join(require('os').tmpdir(), `banc-retours-${process.pid}-${nCharge++}.mjs`);
  fs.writeFileSync(f, t.replace(/from '\.\.\/api\//g, `from '${require('url').pathToFileURL(path.join(RACINE, 'api')).href}/`));
  return import(require('url').pathToFileURL(f).href);
};
const NOW = Date.parse('2026-11-15T20:00:00+01:00');
function regle(M) {
  const salomon = { cle: 'r:9001', titre: 'Salomon XT-6', limiteIso: '2026-10-14T21:59:00Z', pdf: false, depose: null, faits: null, rembourse: { etat: 'non' }, etape: 'a-deposer' };
  const r = [];
  r.push(['R1 le cas réel (date limite 14 oct., bordereau pas arrivé, aucun fait) : « à vérifier », pas dans Ma journée', M.retourPerime(salomon, NOW) === true]);
  r.push(['R2 un fait connu ou 7 jours pas passés ⇒ il reste (bordereau, Déposé, transporteur, remboursement, 3 jours)',
    !M.retourPerime({ ...salomon, pdf: true }, NOW) && !M.retourPerime({ ...salomon, depose: { le: 'x' } }, NOW) && !M.retourPerime({ ...salomon, faits: { etape: 'en-route' } }, NOW)
      && !M.retourPerime({ ...salomon, rembourse: { etat: 'oui' } }, NOW) && !M.retourPerime({ ...salomon, limiteIso: '2026-11-12T10:00:00Z' }, NOW)]);
  const c = M.classerRetoursAchat({ etat: 'lu', cartes: [salomon, { ...salomon, cle: 'r:9002', pdf: true }] }, { regles: { 'r:9003': 'x' }, maintenant: NOW });
  const c2 = M.classerRetoursAchat({ etat: 'lu', cartes: [salomon] }, { regles: { 'r:9001': '2026-11-15' }, maintenant: NOW });
  r.push(['R3 classement : actif / à vérifier ; « C\'est réglé » l\'archive', c.actifs.length === 1 && c.perimes.length === 1 && c2.regles.length === 1 && !c2.perimes.length]);
  return r;
}
const MUTATIONS = [
  ['un bordereau ne compte pas', 'if (c.pdf || c.depose', 'if (c.depose'],
  ['pas de délai de 7 jours', 'if (now - lm <= RETOUR_PERIME_J * 86400000) return false;', ''],
  ['« C\'est réglé » ignoré', 'if (R[c.cle]) out.regles.push(c);\n    else if', 'if'],
];

// ── A : la base ──
function base() {
  const b = P.base();
  const uid0 = b.accounts[0].vinted_user_id;
  const ach = b.rows.find((r) => r.id === `harvest_${uid0}_orders_purchased` || r.id === `harvest_${uid0}_orders_bought`);
  const a0 = ach && (ach.data.payload.my_orders || [])[0];
  if (a0) { a0.status = 'Retour initié'; a0.transaction_user_status = 'needs_action'; a0.title = 'Asics Gel-1130 argent taille 42'; }
  const sold = b.rows.find((r) => r.id === `harvest_${uid0}_orders_sold`).data.payload.my_orders;
  const v0 = sold.find((o) => o.transaction_user_status === 'completed');
  if (v0) { v0.status = 'Transaction suspendue - en attente'; v0.transaction_user_status = 'waiting'; v0.title = 'New Balance 550 crème taille 41'; }
  return { b, achatTx: a0 ? String(a0.transaction_id) : '', venteTx: v0 ? String(v0.transaction_id) : '' };
}

(async () => {
  const M = await charger(SRC);
  for (const [q, bon] of regle(M)) dit(bon, q);
  for (const [nom, de, vers] of MUTATIONS) {
    if (!SRC.includes(de)) { dit(false, `mutation « ${nom} » : texte introuvable (à mettre à jour)`); continue; }
    const Mm = await charger(SRC.replace(de, vers));
    dit(regle(Mm).some((x) => !x[1]), `mutation « ${nom} » : le banc devient ROUGE`);
  }
  if (process.env.SANS_RENDU === '1') { console.log(ko ? `\n${ko} KO` : '\nTOUT VERT'); process.exit(ko ? 1 : 0); }
  await new Promise((ok) => P.srv.listen(P.PORT, ok));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) {
      const T = `[${W} ${th}]`;
      try {
        const { b } = base();
        const o = await P.ouvrir(nav, { W, sombre: th === 'sombre', b, url: '/?tab=journee', dsf: W < 600 ? 2 : 1 });
        await P.pret(o.pg);
        await o.pg.waitForSelector('[data-retours-litiges]', { timeout: 25000 }).catch(() => {});
        await o.pg.waitForSelector('[data-tvb-ligne]', { timeout: 20000 }).catch(() => {});   // « À trancher », la santé : lus après l'écran
        await o.pg.waitForTimeout(1500);
        const m = await o.pg.evaluate(() => {
          const ecran = document.querySelector('.sj-journee'); if (!ecran) return { ecran: false };
          const hors = (sel) => [...ecran.querySelectorAll(sel)].filter((e) => !e.closest('[data-feuille-tvb]')).length;
          const bloc = document.querySelector('[data-retours-litiges]');
          return {
            ecran: true, bloc: !!bloc, sens: bloc ? [...bloc.querySelectorAll('[data-rl-sens]')].map((e) => e.getAttribute('data-rl-sens')) : [],
            ailleurs: hors('[data-job="retours-vente"], [data-job="retours-vente-revenus"], [data-job="litige"], .vrm-renv-journee'),
            retires: { trancher: hors('[data-job="a-trancher"], [data-at-journee]'), relier: hors('[data-journee-a-relier]'), sante: hors('[data-journee-sante]'), emails: hors('[data-job="emails-personne"]'),
              import: hors('[data-import-type]'), veille: hors('[data-veille-alerte]') },
            ligne: (document.querySelector('[data-tvb-ligne]') || { getAttribute: () => null }).getAttribute('data-tvb-ligne'),
          };
        });
        await o.pg.screenshot({ path: path.join(SHOTS, `retours-${W}-${th}.png`) }).catch(() => {});
        dit(m.bloc && m.sens.includes('achat') && m.sens.includes('litige'), `${T} A1 UN bloc « Retours et litiges » réunit l'achat (tu renvoies) et la vente (transaction suspendue)`, JSON.stringify(m.sens));
        dit(m.ailleurs === 0, `${T} A2 aucune ligne de retour ou de litige ailleurs sur Ma journée`, m.ailleurs);
        const r = m.retires || {};
        dit(Object.values(r).every((n) => n === 0), `${T} A3 hors feuille : ni À trancher, ni comptes sans e-mail, ni santé, ni e-mails à trier, ni import, ni contrôle de nuit`, JSON.stringify(r));
        dit(Number(m.ligne) > 0, `${T} A4 la ligne « Tout va bien ? · N points »`, m.ligne);
        if (Number(m.ligne) > 0) {
          await o.pg.click('[data-tvb-ligne]').catch(() => {});
          await o.pg.waitForSelector('[data-feuille-tvb]', { timeout: 6000 }).catch(() => {});
          await o.pg.waitForTimeout(600);
          const f = await o.pg.evaluate(() => { const fe = document.querySelector('[data-feuille-tvb]'); return fe ? { n: fe.querySelectorAll('.vrm-tvb-cartes > *').length, trancher: !!fe.querySelector('[data-job="a-trancher"]'), param: !!fe.querySelector('[data-tvb-parametres]') } : null; });
          await o.pg.screenshot({ path: path.join(SHOTS, `retours-${W}-${th}-tvb.png`) }).catch(() => {});
          dit(f && f.n === Number(m.ligne) && f.param, `${T} A4 la feuille porte les ${m.ligne} cartes déplacées (rien supprimé) et « Tout voir dans Paramètres »`, JSON.stringify(f));
        }
        dit(o.erreurs.length === 0, `${T} A5 aucune erreur JS`, o.erreurs.join(' | '));
        await o.ctx.close();
      } catch (e) { dit(false, `${T} le scénario a pu s'exécuter`, String(e && e.stack || e).slice(0, 300)); }
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(ko ? `\n${ko} KO` : '\nTOUT VERT');
  process.exit(ko ? 1 : 0);
})();

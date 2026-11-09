#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LE « ? » DE CHAQUE ÉCRAN, « SIGNALER » ENRICHI, LES ALERTES DE
//          PLANTAGE GROUPÉES, LE CENTRE D'AIDE (8 nov.)
//          node scripts/audit-aide-signalement.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
//   H  l'aide : chaque écran à phrase (`PHRASES_ECRAN`) a ses 3 questions,
//      courtes, sans jargon ; chaque article existe dans public/aide/ ET dans
//      l'index de la recherche ; public/aide/ = ce que le générateur produit ;
//      `PhraseEcran` pose le « ? » ; /aide est réécrit (vercel.json) et laissé
//      au réseau par le service worker ;
//   D  aucune donnée personnelle ne part : un corps RICHE (montants, pseudos,
//      e-mails, adresses, URL avec identifiants, textes glissés dans la capture,
//      l'état de l'écran ou les requêtes) passe par `normaliserSignalement` :
//      AUCUNE de ces valeurs ne reste ; la capture n'est que des nombres ; les
//      pseudos connus de l'écran (jetons du mode stream) sont masqués ;
//   F  la famille d'une requête ne garde ni adresse, ni paramètre, ni identifiant ;
//   G  les alertes : une erreur vue 10 fois ⇒ UN événement (n = 10) ; une erreur
//      vue une fois ⇒ rien ; un écran tombé une fois ⇒ un événement ; côté
//      serveur (la vraie route `api/compte.js?mode=mesures`, fausse base de forme
//      PostgREST) : 3 lots en 20 min ⇒ UNE notification groupée ; une heure
//      après ⇒ une seule autre, qui dit les types en attente ; une lecture ratée
//      n'écrit rien et n'envoie rien ; le message rangé est masqué ; la ligne est
//      chez le PROPRIÉTAIRE, sans identifiant de vendeur ; le panneau ne rend
//      aucune empreinte ; GET réservé au propriétaire.
// `--prouve` : réaffaiblit le code, une mutation à la fois ⇒ ROUGE exigé.
// Données inventées (le dépôt est public).
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
const path = require('path'), fs = require('fs');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const PG = require(path.join(__dirname, 'bancs', '_minipgrest.cjs'));

if (process.argv.includes('--prouve')) {
  const MUTS = [
    ['les montants ne sont plus masqués', 'api/_lib/signalement.js', ".replace(/\\d+(?:[ \\u00a0\\u202f.]\\d{3})*(?:[.,]\\d{1,2})?[ \\u00a0\\u202f]?(?:€|eur(?:os?)?\\b)/gi, '{montant}')", ''],
    ['la capture accepte n’importe quoi', 'api/_lib/signalement.js', '    plan: planValide(c.plan),', '    plan: c.plan || null,'],
    ['les requêtes gardent leur adresse', 'api/_lib/signalement.js', "  quoi: QUOI_LECTURE.test(String(x.quoi || '')) ? String(x.quoi) : 'autre',", "  quoi: String(x.quoi || ''),"],
    ['les messages d’erreur ne sont plus nettoyés', 'api/_lib/signalement.js', 'message: court(nettoyer(m2(', 'message: court(((m2('],
    ['les pseudos inconnus passent', 'api/_lib/signalement.js', 'const texte = masquerPseudos(court(', 'const texte = ((court('],
    ['le masque de l’écran ignoré', 'api/_lib/signalement.js', "const m2 = typeof opts.masque === 'function'", "const m2 = false && typeof opts.masque === 'function'"],
    ['plus de regroupement par heure', 'src/alertesPlantages.js', '(!derniere || maintenant - derniere >= GROUPE_MS)', 'true'],
    ['une erreur vue une fois alerte', 'src/alertesPlantages.js', 'export const REPETITION_MIN = 3;', 'export const REPETITION_MIN = 1;'],
    ['la ligne n’est pas marquée avant d’envoyer', 'api/_lib/alertes-plantages.js', 'const data = due ? apresNotification(r.data, maintenant) : r.data;', 'const data = r.data;'],
    ['la famille garde l’adresse', 'src/lecturesRecentes.js', "  if (url.origin === origine) return null;   // un fichier de l'app (morceau, image) : pas une lecture\n  return 'autre';", "  return 'autre:' + url.pathname + url.search;"],
    ['le « ? » n’est plus posé', 'src/App.jsx', "const aide = cle && AIDE_ECRANS[cle] ? <AideEcran cle={cle}/> : null;", 'const aide = null;'],
    ['une réponse d’aide trop longue', 'src/aideEcrans.js', "['Comment retrouver une paire ?', 'Cherche son numéro : VRM te dit le meuble et la case.']", "['Comment retrouver une paire ?', 'Cherche son numéro : VRM te dit le meuble et la case, " + 'et encore '.repeat(30) + "']"],
    ['le panneau rend les empreintes', 'api/_lib/alertes-plantages.js', 'appareils: Array.isArray(t.appareils) ? t.appareils.length : 0,', 'appareils: t.appareils,'],
  ];
  let rouges = 0;
  const sauf = new Map();
  process.on('exit', () => { for (const [f, s] of sauf) fs.writeFileSync(f, s); });
  for (const [nom, rel, avant, apres] of MUTS) {
    const f = path.join(R, rel);
    const src = fs.readFileSync(f, 'utf8');
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : motif introuvable`); continue; }
    sauf.set(f, src);
    try {
      fs.writeFileSync(f, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 120000 });
      if (r.status !== 0) rouges++;
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation « ${nom} » ⇒ ${r.status !== 0 ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(f, src); sauf.delete(f); }
  }
  const ok = rouges === MUTS.length;
  console.log(`\n${ok ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(ok ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d !== '' && d != null ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 700)); } };

const JULIEN = '11111111-1111-4111-8111-111111111111';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SECRETS = {
  pseudo: 'julatace3535', acheteur: 'marie_dupont75', email: 'perso.julien@exemple.test', titre: 'Nike Dunk Low Panda T42',
  prix1: '87,50', prix2: '1 250 €', prix3: '45 euros', tx: '18273645501', adresse: '12 rue des Lilas', code: 'RETRAIT-9F3K', uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
};

(async () => {
  const imp = (rel) => import('file://' + path.join(R, rel));
  // ── H ─────────────────────────────────────────────────────────────────────
  console.log('── H. le « ? » et le centre d’aide');
  await essaie('H', async () => {
    const { AIDE_ECRANS, ARTICLES_AIDE, MOTS_MAX_REPONSE } = await imp('src/aideEcrans.js');
    const { PHRASES_ECRAN, JARGON } = await imp('src/phrasesEcran.js');
    const sans = Object.keys(PHRASES_ECRAN).filter((k) => !AIDE_ECRANS[k]);
    dit(!sans.length, `chaque écran à phrase a son « ? » (${Object.keys(PHRASES_ECRAN).length})`, sans);
    const mauvais = [];
    for (const [k, a] of Object.entries(AIDE_ECRANS)) {
      if (!Array.isArray(a.questions) || a.questions.length !== 3) mauvais.push(k + ' : pas 3 questions');
      for (const [q, r] of a.questions || []) {
        const mots = String(r).split(/\s+/).filter(Boolean).length;
        if (mots > MOTS_MAX_REPONSE) mauvais.push(`${k} : réponse de ${mots} mots`);
        if (JARGON.test(q) || JARGON.test(r)) mauvais.push(`${k} : jargon « ${(String(q + ' ' + r).match(JARGON) || [])[0]} »`);
        if (!/\?$/.test(q.trim())) mauvais.push(`${k} : « ${q} » n'est pas une question`);
      }
      if (!ARTICLES_AIDE[a.article]) mauvais.push(`${k} : article ${a.article} inconnu`);
    }
    dit(!mauvais.length, `3 questions par écran, réponses de ${MOTS_MAX_REPONSE} mots au plus, sans jargon, article connu`, mauvais);
    const { ARTICLES } = require(path.join(R, 'scripts', 'aide-contenu.cjs'));
    const slugs = ARTICLES.map((x) => x.slug).sort().join(',');
    dit(slugs === Object.keys(ARTICLES_AIDE).sort().join(','), 'les articles de l’app = ceux du centre d’aide', slugs);
    const manque = Object.keys(ARTICLES_AIDE).filter((s) => !fs.existsSync(path.join(R, 'public', 'aide', s + '.html')));
    dit(!manque.length, 'chaque article existe dans public/aide/', manque);
    const index = JSON.parse(fs.readFileSync(path.join(R, 'public', 'aide', 'index-recherche.json'), 'utf8'));
    dit(index.length === ARTICLES.length && index.every((x) => x.slug && x.titre && x.mots.length > 50), 'l’index de la recherche couvre chaque article');
    const v = spawnSync(process.execPath, [path.join(R, 'scripts', 'aide-generer.cjs'), '--verifier'], { encoding: 'utf8' });
    dit(v.status === 0, 'public/aide/ = ce que le générateur produit', v.stdout.trim());
    const html = fs.readdirSync(path.join(R, 'public', 'aide')).filter((f) => f.endsWith('.html')).map((f) => fs.readFileSync(path.join(R, 'public', 'aide', f), 'utf8'));
    dit(html.every((h) => !/<script(?![^>]*\bsrc=)[^>]*>/.test(h) && !/\son[a-z]+=/i.test(h)), 'aucun script en ligne ni gestionnaire on…= (politique de contenu)');
    const caps = [...new Set(html.join('').match(/\/aide\/captures\/[\w.-]+/g) || [])];
    const capsManque = caps.filter((c) => !fs.existsSync(path.join(R, 'public', c)));
    dit(!capsManque.length, `chaque capture citée existe (${caps.length}, mode exemple)`, capsManque);
    dit(!/encaiss/i.test(html.join('')), 'jamais « encaissé » (règle de l’URSSAF, audit-urssaf)');
    const app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
    dit(/function PhraseEcran[\s\S]{0,400}AIDE_ECRANS\[cle\] \? <AideEcran cle=\{cle\}\/>/.test(app), '`PhraseEcran` pose le « ? » de son écran');
    const reg = fs.readFileSync(path.join(R, 'src', 'ecrans', 'Reglages.jsx'), 'utf8');
    dit(/data-phrase-ecran="settings">\{PHRASES_ECRAN\.settings\}<AideEcran cle="settings"\/>/.test(reg), 'Réglages pose le sien');
    const vj = JSON.parse(fs.readFileSync(path.join(R, 'vercel.json'), 'utf8'));
    dit(vj.rewrites.some((r) => r.source === '/aide' && r.destination === '/aide/index.html') && vj.rewrites.some((r) => r.source === '/aide/([a-z-]+)'), 'vercel.json réécrit /aide et /aide/<article>');
    const sw = fs.readFileSync(path.join(R, 'public', 'sw.js'), 'utf8');
    dit(/url\.pathname === '\/aide' \|\| url\.pathname\.startsWith\('\/aide\/'\)\) return;/.test(sw), 'le service worker laisse /aide au réseau (sinon il ouvrirait l’app)');
  });

  // ── D ─────────────────────────────────────────────────────────────────────
  console.log('── D. aucune donnée personnelle ne part');
  await essaie('D', async () => {
    const SIG = await imp('api/_lib/signalement.js');
    const corps = {
      texte: `Vente de ${SECRETS.acheteur} : ${SECRETS.titre} à ${SECRETS.prix1} € puis ${SECRETS.prix2} et ${SECRETS.prix3}, total ${SECRETS.prix1}. Mail ${SECRETS.email}, tx ${SECRETS.tx}, ${SECRETS.uuid}`,
      ecran: 'cat_bord', version: '8 novembre à 10:00', navigateur: 'Chrome', ecranTaille: { largeur: 390, hauteur: 844 },
      appareil: 'telephone', systeme: SECRETS.pseudo, enLigne: 'oui', theme: SECRETS.titre,
      etatEcran: { boutons: 12, champs: 'trois', feuilles: 0, gardeFou: SECRETS.pseudo, titre: SECRETS.titre, pseudo: SECRETS.pseudo },
      lectures: [
        { m: 'GET', quoi: 'base:app_data', s: 200, ms: 120, at: '2026-11-08T09:00:00Z' },
        { m: 'GET', quoi: `base:app_data?owner=eq.${SECRETS.uuid}&id=eq.harvest_${SECRETS.pseudo}`, s: 401, ms: 80, at: 'x' },
        { m: SECRETS.pseudo, quoi: `https://vrm.center/api/compte?mode=x&email=${SECRETS.email}`, s: 'ok', ms: -5, corps: SECRETS.titre, url: SECRETS.adresse },
      ],
      plan: { l: 390, h: 844, b: [[0, 0, 390, 60, 0], [16, 80, 200, 20, 1], [16, 120, 'Nike', 20, 1], [16, 140, 100, 20, 9], { texte: SECRETS.titre }, [16, 160, 50, 20, 2, SECRETS.pseudo]], titre: SECRETS.titre },
      plantages: [
        { message: `Cannot read properties of undefined (reading '${SECRETS.pseudo}') ${SECRETS.email}`, ecran: 'cat_bord:vinted', origine: 'feuille', version: '8 novembre à 10:00', at: '2026-11-08T09:00:00Z' },
        { message: `Prix ${SECRETS.prix1} € invalide pour "${SECRETS.titre} taille 42"`, ecran: SECRETS.pseudo, origine: 'page', at: '2026-11-08T09:01:00Z' },
      ],
      pseudo: SECRETS.pseudo, adresse: SECRETS.adresse, ventes: [{ title: SECRETS.titre }],
    };
    const masque = (t) => String(t).split(SECRETS.acheteur).join('•••').split(SECRETS.titre).join('•••');
    const s = SIG.normaliserSignalement(corps, { masque });
    const txt = JSON.stringify(s);
    const fuites = Object.entries(SECRETS).filter(([, v]) => txt.includes(v));
    dit(s && !fuites.length, 'aucune valeur du jeu inventé dans ce qui part (montants, pseudos, titre, e-mail, n°, adresse, uuid)', fuites.map(([k]) => k).join(', ') + ' ¦ ' + txt.slice(0, 400));
    dit(/\{montant\}/.test(s.texte) && !/\d+,\d{2}/.test(s.texte), 'les montants du message deviennent {montant}', s.texte);
    dit(JSON.stringify(Object.keys(s)) === JSON.stringify(['texte', 'ecran', 'ecranAvant', 'version', 'extension', 'navigateur', 'ecranTaille', 'plantages', 'appareil', 'systeme', 'enLigne', 'theme', 'etatEcran', 'lectures', 'plan']), 'seuls les champs permis existent', Object.keys(s));
    dit(s.plan && s.plan.b.length === 2 && s.plan.b.every((r) => r.length === 5 && r.every(Number.isInteger)) && Object.keys(s.plan).join() === 'l,h,b', 'la capture n’est faite que de nombres (un rectangle mal formé est jeté)', s.plan);
    dit(s.etatEcran && Object.values(s.etatEcran).every((v) => typeof v === 'number' || typeof v === 'boolean' || v === null) && !('titre' in s.etatEcran), 'l’état de l’écran n’est que des nombres', s.etatEcran);
    dit(s.lectures.length === 3 && s.lectures[1].quoi === 'autre' && s.lectures[2].quoi === 'autre' && s.lectures[2].m === 'GET' && s.lectures[2].s === 0 && Object.keys(s.lectures[2]).join() === 'm,quoi,s,ms,at', 'une requête ne garde ni adresse, ni paramètre, ni contenu', s.lectures);
    dit(s.systeme === null && s.theme === null && s.enLigne === null, 'appareil : un mot hors liste est vidé');
    dit(s.plantages[0].ecran === 'cat_bord' && s.plantages[0].origine === 'feuille', 'une erreur garde l’écran (« cat_bord:vinted » ⇒ « cat_bord ») et l’origine « feuille »', s.plantages[0]);
    { const a = JSON.stringify(s), b = JSON.stringify(SIG.normaliserSignalement(s)); let i = 0; while (i < a.length && a[i] === b[i]) i++; dit(a === b, 'la règle est idempotente (le serveur la rejoue sans le masque : rien ne revient)', a.slice(Math.max(0, i - 80), i + 60) + ' ≠ ' + b.slice(Math.max(0, i - 80), i + 60)); }
    // Un pseudo SANS forme reconnaissable (« Lilouchka ») : seul le masque de l'écran le connaît.
    const tLi = { texte: 'Le colis de Lilouchka reste en attente' };
    const avecM = SIG.normaliserSignalement(tLi, { masque: (t) => String(t).split('Lilouchka').join('•••') }).texte, sansM = SIG.normaliserSignalement(tLi).texte;
    dit(sansM.includes('Lilouchka') && !avecM.includes('Lilouchka'), 'le masque de l’écran (jetons du stream) cache un pseudo que la forme ne trahit pas', avecM + ' ¦ ' + sansM);
    const inconnu = SIG.normaliserSignalement({ texte: 'Le colis de acheteuse_inconnue et de lea75 (marie.dupont) ne part pas ; l’écran Colis, version v5.323.0, sur vrm.center' }).texte;
    dit(!/acheteuse_inconnue|lea75|marie\.dupont/.test(inconnu) && /v5\.323\.0/.test(inconnu) && /vrm\.center/.test(inconnu) && /Colis/.test(inconnu), 'un pseudo que l’écran ne connaît pas (forme « a_b », « lea75 ») est masqué ; une version, un site, un nom d’écran restent', inconnu);
    const r = SIG.resumeDe(s);
    dit(r.plantages === 2 && r.lectures === 3 && r.echecs === 2 && r.plan === 2, 'le résumé de la liste compte, sans rien recopier', r);
    // Le vrai masque de l'app : les jetons publiés par les écrans.
    const MS = await imp('src/modeStream.js');
    MS.jetonsStream('acheteurs-banc', [SECRETS.acheteur]);
    MS.jetonsStream('comptes-banc', [SECRETS.pseudo]);
    const m = MS.masquerPourEnvoi(`Le colis de ${SECRETS.acheteur} sur ${SECRETS.pseudo} : 87,50 €`);
    dit(!m.includes(SECRETS.acheteur) && !m.includes(SECRETS.pseudo) && !m.includes('87,50'), 'le masque de l’app cache les pseudos publiés et les montants, que le stream soit allumé ou non', m);
  });

  // ── F ─────────────────────────────────────────────────────────────────────
  console.log('── F. la famille d’une requête');
  await essaie('F', async () => {
    const L = await imp('src/lecturesRecentes.js');
    const o = 'https://vrm.center';
    const cas = [
      [`https://lgonxzrzjcqthjtbdpzo.supabase.co/rest/v1/app_data?owner=eq.${SECRETS.uuid}&id=eq.harvest_x&select=data`, 'base:app_data'],
      ['https://lgonxzrzjcqthjtbdpzo.supabase.co/rest/v1/rpc/vrm_acces', 'base:rpc:vrm_acces'],
      ['https://lgonxzrzjcqthjtbdpzo.supabase.co/auth/v1/token?grant_type=refresh_token', 'auth'],
      [`/api/compte?mode=signalement&id=${SECRETS.tx}`, 'api:compte:signalement'],
      [`/api/vinted-proxy?u=${encodeURIComponent('https://www.vinted.fr/api/v2/users/' + SECRETS.pseudo)}`, 'api:vinted-proxy'],
      [`https://www.vinted.fr/member/${SECRETS.pseudo}`, 'autre'],
      ['/assets/App-abc123.js', null],
    ];
    const faux = cas.filter(([u, att]) => L.familleRequete(u, o) !== att).map(([u, att]) => `${u} ⇒ ${L.familleRequete(u, o)} (attendu ${att})`);
    dit(!faux.length, 'chaque requête se nomme par sa famille, sans adresse ni paramètre', faux);
    const SIG = await imp('api/_lib/signalement.js');
    dit(cas.every(([u]) => { const f = L.familleRequete(u, o); return f === null || SIG.normaliserSignalement({ texte: 'abc', lectures: [{ m: 'GET', quoi: f, s: 200 }] }).lectures[0].quoi === f; }), 'le filtre du serveur accepte chaque famille produite par l’app');
  });

  // ── G ─────────────────────────────────────────────────────────────────────
  console.log('── G. les alertes de plantage, groupées');
  await essaie('G', async () => {
    const AP = await imp('src/alertesPlantages.js');
    let e = {};
    for (let i = 0; i < 10; i++) e = AP.compterErreur(e, { message: "Cannot read properties of undefined (reading 'n') at Colis", ecran: 'cat_bord', origine: 'page', version: '8 novembre à 10:00' });
    e = AP.compterErreur(e, { message: 'Une erreur vue une seule fois', ecran: 'ventes', origine: 'page' });
    let ev = AP.evenementsAEnvoyer(e);
    dit(ev.length === 1 && ev[0].n === 10 && ev[0].ecran === 'cat_bord' && !ev[0].garde, 'une erreur vue 10 fois ⇒ UN événement (n = 10) ; vue une fois ⇒ rien', ev);
    e = AP.apresEnvoi(e, ev);
    dit(AP.evenementsAEnvoyer(e).length === 0, 'déjà envoyé ⇒ rien ne repart');
    e = AP.compterErreur(e, { message: 'Minified React error #31', ecran: 'compta', origine: 'ecran' });
    ev = AP.evenementsAEnvoyer(e);
    dit(ev.length === 1 && ev[0].garde === true && ev[0].ecran === 'compta', 'un écran tombé sur son garde-fou ⇒ un événement dès la première fois', ev);
    const ev2 = AP.normaliserEvenements([{ message: `Prix 87,50 € pour ${SECRETS.email} (reading '${SECRETS.pseudo}')`, ecran: SECRETS.pseudo, version: SECRETS.titre, n: 3, garde: 'oui', cle: 'pirate', owner: A }]);
    dit(ev2.length === 1 && !JSON.stringify(ev2).match(/87,50|perso\.julien|julatace|Nike|pirate|aaaa/) && Object.keys(ev2[0]).join() === 'ecran,message,version,n,garde', 'un événement ne garde que écran, message masqué, version, nombre', ev2);

    // La vraie route, contre une fausse base de forme PostgREST.
    process.env.SUPABASE_SERVICE_KEY = 'cle-de-service-de-banc';
    delete process.env.VRM_OWNER_UID;
    let rows = [], reglages = { proprietaire: JULIEN }, panne = false;
    const JETONS = { 'j.a.x': { id: A }, 'j.b.x': { id: B }, 'j.julien.x': { id: JULIEN } };
    const rep = (c, st = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: st, headers: { 'content-type': 'application/json' } });
    global.fetch = async (url, o = {}) => {
      const s = String(url); const u = new URL(s); const p = u.pathname; const m = (o.method || 'GET').toUpperCase();
      const h = Object.fromEntries(Object.entries(o.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
      if (p.endsWith('/auth/v1/user')) { const x = JETONS[String(h.authorization || '').replace(/^Bearer /, '')]; return x ? rep(x) : rep({}, 401); }
      if (p.includes('/rpc/')) return rep(true);
      if (p.endsWith('/vrm_reglages')) return rep(reglages.proprietaire ? [{ valeur: reglages.proprietaire }] : []);
      if (!p.endsWith('/rest/v1/app_data')) return rep([]);
      if (m === 'GET') { if (panne && /plantages_terrain_/.test(decodeURIComponent(s))) return rep('<html>522</html>', 522); return rep(PG.servir(rows, s, h).body); }
      const retour = String(h.prefer || '').includes('return=representation');
      if (m === 'POST') {
        const faites = [];
        for (const l of JSON.parse(o.body || '[]')) { const i = rows.findIndex((r) => r.owner === l.owner && r.id === l.id); if (i >= 0 && String(h.prefer || '').includes('ignore-duplicates')) continue; const ligne = { owner: l.owner, id: l.id, data: JSON.parse(JSON.stringify(l.data)) }; if (i >= 0) rows[i] = ligne; else rows.push(ligne); faites.push(ligne); }
        return retour ? rep(faites, 201) : rep('', 201);
      }
      if (m === 'PATCH') { const cibles = rows.filter((r) => PG.servir([r], s, {}).body.length); const maj = JSON.parse(o.body || '{}'); for (const r of cibles) Object.assign(r, JSON.parse(JSON.stringify(maj))); return retour ? rep(cibles.map((r) => ({ id: r.id }))) : rep('', 204); }
      return rep([]);
    };
    const MT = await imp('api/_lib/mesures-terrain.js');
    const envois = [];
    const pousser = async (n, proprio) => { envois.push({ n, proprio }); return { sent: 1 }; };
    const verifierJeton = async (j) => JETONS[j] || null;
    const T0 = Date.parse('2026-11-08T09:05:00Z');
    const lot = (evts) => JSON.stringify({ v: 1, h: {}, p: evts, jeton: 'j.a.x' });
    const evA = [{ ecran: 'cat_bord', message: "Cannot read properties of undefined (reading 'n')", version: '8 novembre à 10:00', n: 10, garde: false }];
    const evB = [{ ecran: 'compta', message: `Minified React error #31 ${SECRETS.email} 87,50 €`, version: '8 novembre à 10:00', n: 1, garde: true }];
    let r1 = await MT.recevoirMesures({ corps: lot(evA), verifierJeton, pousser, maintenant: T0 });
    dit(r1.code === 200 && envois.length === 1, 'premier lot : rangé, UNE notification (rien n’avait été dit)', JSON.stringify(r1.corps) + ' ' + envois.length);
    const r2 = await MT.recevoirMesures({ corps: JSON.stringify({ v: 1, h: {}, p: evB, jeton: 'j.b.x' }), verifierJeton, pousser, maintenant: T0 + 10 * 60e3 });
    const r3 = await MT.recevoirMesures({ corps: lot(evA), verifierJeton, pousser, maintenant: T0 + 20 * 60e3 });
    dit(r2.code === 200 && r3.code === 200 && envois.length === 1, 'deux autres lots dans l’heure : rangés, AUCUNE notification de plus (groupées)', envois.length);
    const ligne = rows.find((x) => /^plantages_terrain_2026-11-08$/.test(x.id));
    dit(ligne && ligne.owner === JULIEN, 'la ligne du jour est chez le PROPRIÉTAIRE de l’installation', ligne && ligne.owner);
    const brut = JSON.stringify(rows);
    dit(!brut.includes(A) && !brut.includes(B) && !brut.includes(SECRETS.email) && !brut.includes('87,50'), 'aucun identifiant de vendeur ni donnée dans la base (empreintes du jour, message masqué)');
    const types = ligne ? Object.values(ligne.data.types) : [];
    dit(types.length === 2 && types.find((t) => t.n === 20) && types.find((t) => t.garde === 1), 'additionnés par type : 20 fois la même erreur, un écran tombé', types.map((t) => ({ n: t.n, g: t.garde, ap: t.appareils.length })));
    const r4 = await MT.recevoirMesures({ corps: lot([{ ...evA[0], n: 2 }]), verifierJeton, pousser, maintenant: T0 + 61 * 60e3 });
    dit(r4.code === 200 && envois.length === 2 && /2 soucis/.test(envois[1].n.body) && envois[1].proprio === JULIEN && envois[1].n.tag === 'vrm-alerte-plantages', 'une heure après : UNE notification groupée, qui dit tout ce qui attendait', envois[1] && envois[1].n.body);
    dit(!/87,50|perso\.julien|aaaa/.test(JSON.stringify(envois)), 'la notification ne porte aucune donnée');
    panne = true;
    const avant = JSON.stringify(rows);
    const r5 = await MT.recevoirMesures({ corps: lot(evA), verifierJeton, pousser, maintenant: T0 + 200 * 60e3 });
    dit(r5.code === 503 && JSON.stringify(rows) === avant && envois.length === 2, 'lecture ratée : rien écrit, rien envoyé, 503', r5.code);
    panne = false;
    const r6 = await MT.recevoirMesures({ corps: JSON.stringify({ v: 1, h: {}, p: evA, jeton: 'inconnu.x.y' }), verifierJeton, pousser, maintenant: T0 });
    dit(r6.code === 401, 'un jeton inconnu ne range rien', r6.code);
    // La veille du matin dit ce qui attend.
    const AL = await imp('api/_lib/alertes-plantages.js');
    await MT.recevoirMesures({ corps: lot([{ ...evA[0], message: 'Une autre erreur qui attend', n: 4 }]), verifierJeton, pousser, maintenant: T0 + 70 * 60e3 });
    const n0 = envois.length;
    const v = await AL.vidangerAlertesPlantages({ proprio: JULIEN, pousser: (n) => pousser(n, JULIEN), maintenant: T0 + 140 * 60e3 });
    dit(envois.length === n0 + 1 && v.fait, 'la veille du matin dit les types en attente (une notification)', JSON.stringify(v));
    // Le panneau, au propriétaire seul, par la vraie route.
    const compte = await imp('api/compte.js');
    const faireRes = () => { const x = { code: null, corps: null }; x.status = (c) => { x.code = c; return x; }; x.json = (b) => { x.corps = b; return x; }; x.send = (b) => { x.corps = b; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };
    const get = async (jeton) => { const res = faireRes(); await compte.default({ method: 'GET', query: { mode: 'mesures', quoi: 'plantages' }, headers: { authorization: 'Bearer ' + jeton } }, res); return res; };
    const gj = await get('j.julien.x'), ga = await get('j.a.x');
    dit(gj.code === 200 && gj.corps.jours.length >= 1 && gj.corps.jours[0].types.length >= 2, 'le propriétaire lit les alertes du jour', JSON.stringify(gj.corps).slice(0, 200));
    dit(ga.code === 403, 'un autre compte : 403', ga.code);
    dit(!/[0-9a-f]{12}/.test(JSON.stringify(gj.corps.jours.map((j) => j.types.map((t) => t.appareils)))) && gj.corps.jours[0].types.every((t) => typeof t.appareils === 'number'), 'le panneau dit COMBIEN d’appareils, jamais leurs empreintes');
    // Par la route POST, en texte (un sendBeacon) : rangé.
    rows = [];
    const res = faireRes();
    await compte.default({ method: 'POST', query: { mode: 'mesures' }, headers: {}, body: JSON.stringify({ v: 1, h: {}, p: evB, jeton: 'j.a.x' }) }, res);
    dit(res.code === 200 && rows.some((x) => /^plantages_terrain_/.test(x.id) && x.owner === JULIEN), 'la route de production range l’alerte (un lot sans mesures, seulement l’alerte)', JSON.stringify(res.corps));
  });

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();

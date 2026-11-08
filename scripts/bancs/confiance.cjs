require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « CONFIANCE » (8 nov.) — 390 px tactile ET 1512 px, clair ET sombre
//  Données INVENTÉES (le jeu de `nouveau-vendeur.cjs`) ; rien n'est écrit ailleurs.
//   S. vrm.center/statut, servie COMME VERCEL (`_vercel.servir` : réécriture
//      /statut → /statut.html, en-têtes, CSP) avec un faux /api/sante et un
//      fichier d'incidents de BANC (un en cours, un résolu, un qui nomme une
//      adresse) : les requêtes de la page sont TOUTES du même site et dans la
//      liste (/api/sante, /etat-version.json, /statut-incidents.json, ses
//      fichiers) ; en cours d'abord, en ambre ; l'adresse n'est pas affichée ;
//      aucun débordement ; le thème suit le système.
//   T. Paramètres → Mon compte → « Ce que VRM lit et fait » : chaque groupe et
//      chaque ligne de `src/tesDonnees.js` rendus, aucune phrase coupée (« … »),
//      44 px au doigt ; « Exporter » télécharge le zip ; « Ce que l'extension a
//      fait » et « Fermer mon compte » ouvrent leur écran — et RIEN n'est fermé
//      (aucune requête de fermeture).
//   J. Le journal : chaque ligne porte sa preuve (`data-journal-preuve="oui"`),
//      une ligne sans preuve le dit (« pas-su »), « depuis ton téléphone ».
//  Captures : SHOTS (défaut <tmp>/banc-confiance) — à REGARDER (§6.2).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const V = require('./_vercel.cjs');
const RACINE = path.join(__dirname, '..', '..');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-confiance');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const PARTIES = liste('PARTIES', 'S,T,J');
const PORT_STATUT = (Number(process.env.BANC_PORT) || 4983) + 7;
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 400) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function statut(nav, W, theme) {
  const tel = W < 600, tag = `${W}-${theme}`;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: theme === 'sombre' ? 'dark' : 'light' });
  await ctx.route((u) => u.pathname === '/api/sante', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: V.entetesPour('/api/sante'),
    body: JSON.stringify({ ok: true, serviceKey: true, owner: true, ia: false, detourage: false, stripe: true, stripeWebhook: true, relancesEssai: false, etat: { base: 'ok', emails: 'panne', notifications: 'ok', verifieA: new Date().toISOString() } }) }));
  const pg = await ctx.newPage();
  const requetes = []; const errs = [];
  pg.on('request', (q) => requetes.push(q.url()));
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(`http://localhost:${PORT_STATUT}/statut`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const u = document.getElementById('incidents'); return u && u.getAttribute('data-incidents') !== 'chargement' && document.querySelector('main').getAttribute('data-etat-global') !== 'chargement'; }, null, { timeout: 8000 }).catch(() => {});
  const v = await pg.evaluate(() => ({
    titre: document.title, global: document.querySelector('main').getAttribute('data-etat-global'),
    n: document.getElementById('incidents').getAttribute('data-incidents'),
    inc: [...document.querySelectorAll('[data-incident]')].map((l) => ({ e: l.getAttribute('data-incident'), t: l.innerText.replace(/\s+/g, ' '), mot: getComputedStyle(l.querySelector('.mot')).color })),
    texte: document.body.innerText, deborde: document.documentElement.scrollWidth > window.innerWidth + 1,
    theme: document.documentElement.getAttribute('data-theme'),
  }));
  dit(v.titre === 'Statut de VRM' && v.global === 'panne', `S ${tag} : /statut sert la page, l’état du serveur lu (panne e-mails)`, v);
  dit(v.n === '3' && v.inc[0].e === 'en-cours' && v.inc[1].e === 'en-cours' && v.inc[2].e === 'resolu', `S ${tag} : 3 incidents, en cours d’abord`, v.inc);
  dit(v.inc.length && v.inc[0].mot === (theme === 'sombre' ? 'rgb(255, 179, 64)' : 'rgb(178, 80, 0)'), `S ${tag} : « En cours » en ambre (jamais rouge)`, v.inc[0] && v.inc[0].mot);
  dit(!/banc\.vendeur@exemple\.test|12345678901/.test(v.texte) && /Texte retiré/.test(v.texte), `S ${tag} : l’adresse et le n° de commande d’un incident mal écrit ne s’affichent pas`);
  const autres = requetes.map((u) => new URL(u)).filter((u) => !(u.host === `localhost:${PORT_STATUT}` && ['/statut', '/etat.js', '/statut.js', '/api/sante', '/etat-version.json', '/statut-incidents.json', '/logo-vrm-96.png', '/vrm-icon-v4-192.png', '/favicon.ico'].includes(u.pathname)));
  dit(!autres.length, `S ${tag} : aucune autre requête (ni base, ni session, ni autre site)`, autres.map(String));
  dit(!v.deborde && !errs.length && v.theme === (theme === 'sombre' ? 'dark' : 'light'), `S ${tag} : rien ne déborde, aucune erreur, thème ${theme}`, { deborde: v.deborde, errs });
  await pg.screenshot({ path: path.join(SHOTS, `statut-${tag}.png`), fullPage: true });
  await ctx.close();
}

(async () => {
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  let srvStatut = null, NV = null;
  try {
    if (PARTIES.includes('S')) {
      const pub = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-statut-'));
      for (const f of ['statut.html', 'statut.js', 'etat.js', 'logo-vrm-96.png', 'vrm-icon-v4-192.png']) fs.copyFileSync(path.join(RACINE, 'public', f), path.join(pub, f));
      fs.writeFileSync(path.join(pub, 'etat-version.json'), JSON.stringify({ extension: '5.323.0' }));
      const h = (x) => new Date(Date.now() - x * 3600e3).toISOString();
      // Un fichier d'incidents de BANC (le vrai, public/statut-incidents.json, est vide).
      fs.writeFileSync(path.join(pub, 'statut-incidents.json'), JSON.stringify({ incidents: [
        { debut: h(5), fin: h(4), titre: 'Notifications en retard', texte: 'Les notifications partaient avec quelques minutes de retard. Rétabli.', touche: ['notifications'] },
        { debut: h(1), fin: null, titre: 'Réception des e-mails ralentie', texte: 'Les e-mails de vente arrivent avec du retard. Rien n’est perdu : ils seront rangés dès que la réception repart.', touche: ['emails'] },
        { debut: h(2), fin: null, titre: 'Bordereaux', texte: 'Le colis de banc.vendeur@exemple.test, commande 12345678901', touche: ['autre'] },
      ] }));
      srvStatut = V.servir(pub, PORT_STATUT);
      for (const W of LARGEURS) for (const t of THEMES) await statut(nav, W, t);
    }
    if (PARTIES.includes('T') || PARTIES.includes('J')) {
      NV = require('./nouveau-vendeur.cjs');
      await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
      const TD = await import('file://' + path.join(RACINE, 'src', 'tesDonnees.js'));
      const nGestes = TD.GESTES.reduce((n, g) => n + g.lignes.length, 0);
      const base = () => ({ lignes: JSON.parse(JSON.stringify(NV.JEU_LIGNES)), comptes: NV.JEU_COMPTES, ecritures: 0 });
      for (const W of LARGEURS) for (const theme of THEMES) {
        const tag = `${W}-${theme}`, sombre = theme === 'sombre';
        if (PARTIES.includes('T')) {
          const { ctx, pg, tel } = await NV.ouvrir(nav, { W, sombre, base: base(), tab: 'settings' });
          const fermetures = [];
          pg.on('request', (q) => { if (/mode=(fermer|supprimer)/.test(q.url()) || (q.method() === 'DELETE')) fermetures.push(q.method() + ' ' + q.url()); });
          await pg.goto(`http://localhost:${NV.PORT}/?tab=settings&vue=compte`, { waitUntil: 'domcontentloaded' }); await attendre(1800);
          await pg.click('[data-onglets-reglages] [data-vue="compte"]').catch(() => {}); await attendre(400);
          await pg.click('[data-sous-ouvrir="tes-donnees"]', { timeout: 8000 }).catch(async (e) => { dit(false, `T ${tag} : la ligne « Ce que VRM lit et fait » se touche`, e.message.split('\n')[0]); await pg.screenshot({ path: path.join(SHOTS, `T-echec-${tag}.png`), fullPage: true }); });
          await pg.waitForSelector('[data-sous-ecran="tes-donnees"]:not([hidden]) [data-tes-donnees]', { timeout: 8000 }).catch(() => {});
          const r = await pg.evaluate(() => {
            const hote = document.querySelector('[data-sous-ecran="tes-donnees"]:not([hidden]) [data-tes-donnees]');
            if (!hote) return null;
            const coupees = [...hote.querySelectorAll('.vrm-ios-titre, .vrm-ios-detail')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.slice(0, 50));
            const cibles = [...hote.querySelectorAll('button, a')].map((b) => b.getBoundingClientRect().height).filter((h) => h > 0);
            return { groupes: [...hote.querySelectorAll('[data-td-groupe]')].map((g) => g.getAttribute('data-td-groupe')), lit: hote.querySelectorAll('[data-td-lit]').length, gestes: hote.querySelectorAll('[data-td-geste]').length,
              acces: hote.querySelectorAll('[data-td-acces]').length, coupees, petit: Math.min(...cibles), deborde: document.documentElement.scrollWidth > window.innerWidth + 1, texte: hote.innerText };
          });
          if (!r) { await ctx.close(); continue; }
          dit(r && r.groupes.join(',') === 'lit,seule,allume,clic,jamais,stockage,acces,gestes', `T ${tag} : les 8 groupes, dans l’ordre`, r && r.groupes);
          dit(r && r.lit === TD.CE_QUE_VRM_LIT.length && r.gestes === nGestes && r.acces === TD.ACCES.length, `T ${tag} : chaque ligne de src/tesDonnees.js est rendue (${TD.CE_QUE_VRM_LIT.length} sites, ${nGestes} gestes, ${TD.ACCES.length} accès)`, r && { lit: r.lit, gestes: r.gestes, acces: r.acces });
          dit(r && !r.coupees.length && !r.deborde, `T ${tag} : aucune phrase coupée, rien ne déborde`, r && r.coupees);
          if (tel) dit(r && r.petit >= 43.5, `T ${tag} : 44 px au doigt`, r && r.petit);
          dit(r && new RegExp(`${TD.PLAFOND_ACTIONS_HEURE} actions par heure`).test(r.texte) && /Irlande/.test(r.texte), `T ${tag} : le plafond et le lieu sont dits`);
          // L'app défile dans son conteneur : la fenêtre s'agrandit à la page pour la capture, puis revient.
          const haut = await pg.evaluate(() => { const h = document.querySelector('[data-sous-ecran="tes-donnees"]:not([hidden])'); return h ? Math.ceil(h.getBoundingClientRect().bottom + 160) : 0; });
          const vp = pg.viewportSize();
          if (haut > vp.height) { await pg.setViewportSize({ width: vp.width, height: haut }); await attendre(400); }
          await pg.screenshot({ path: path.join(SHOTS, `tes-donnees-${tag}.png`) });
          await pg.setViewportSize(vp); await attendre(300);
          const dl = pg.waitForEvent('download', { timeout: 8000 }).catch(() => null);
          await pg.click('[data-td-exporter] button');
          const d = await dl;
          dit(d && /\.zip$/.test(d.suggestedFilename()), `T ${tag} : « Exporter mes données » télécharge le zip (l’export existant)`, d && d.suggestedFilename());
          await pg.click('[data-td-journal] button'); await attendre(500);
          const ouvertJ = await pg.evaluate(() => document.querySelector('.vrm-set').getAttribute('data-sous-ecran-ouvert'));
          dit(ouvertJ === 'journal-vrm', `T ${tag} : « Ce que l’extension a fait » ouvre le journal`, ouvertJ);
          await pg.click('[data-sous-retour]'); await attendre(300);
          await pg.click('[data-sous-ouvrir="tes-donnees"]'); await attendre(300);
          await pg.click('[data-td-fermer] button'); await attendre(800);
          const ouvertF = await pg.evaluate(() => ({ o: document.querySelector('.vrm-set').getAttribute('data-sous-ecran-ouvert'), carte: !!document.querySelector('[data-sous-ecran="fermer"]:not([hidden]) [data-fermer-compte]') }));
          dit(ouvertF.o === 'fermer' && ouvertF.carte && !fermetures.length, `T ${tag} : « Fermer mon compte » ouvre la fermeture existante — et rien n’est fermé`, { ...ouvertF, fermetures });
          await ctx.close();
        }
        if (PARTIES.includes('J')) {
          const { ctx, pg } = await NV.ouvrir(nav, { W, sombre, base: base(), tab: 'settings' });
          const t = (x) => Date.now() - x * 3600e3;
          const P = 'Résultat écrit par l’extension dans la commande';
          await pg.route('**/api/compte?mode=journal', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, pasLu: [], nonJournalise: [{ id: 'offres', texte: 'Offres Vinted acceptées ou refusées depuis l’ordinateur, ou par le réglage automatique : notées seulement dans la fenêtre de l’extension, pas en base.' }], evenements: [
            { at: t(1), type: 'offre_acceptee', site: 'vinted', compte: '111', cle: { tx: '62001' }, resultat: 'ok', source: 'relais', via: 'telephone', preuve: P },
            { at: t(2), type: 'message_envoye', site: 'vinted', compte: '111', cle: { tx: null }, resultat: 'refuse', source: 'relais', via: 'telephone', preuve: P },
            { at: t(3), type: 'republication', site: 'vinted', compte: '111', cle: { item: '51003' }, resultat: 'ok', source: 'brouillons', preuve: 'Noté dans la fiche de republication' },
            { at: t(4), type: 'bordereau', site: 'vinted', compte: '222', cle: { tx: '62005' }, resultat: 'ok', source: 'bordereaux' },
          ] }) }));
          await pg.goto(`http://localhost:${NV.PORT}/?tab=settings&vue=compte`, { waitUntil: 'domcontentloaded' }); await attendre(1800);
          await pg.click('[data-onglets-reglages] [data-vue="compte"]').catch(() => {}); await attendre(400);
          await pg.click('[data-sous-ouvrir="journal-vrm"]').catch(() => {});
          await pg.waitForSelector('[data-journal-ligne]', { timeout: 8000 }).catch(() => {});
          const L = await pg.evaluate(() => [...document.querySelectorAll('[data-journal-ligne]')].map((l) => ({ type: l.getAttribute('data-journal-ligne'), preuve: (l.querySelector('[data-journal-preuve]') || { getAttribute: () => null }).getAttribute('data-journal-preuve'), txt: l.innerText.replace(/\s+/g, ' ') })));
          dit(L.length === 4 && L.slice(0, 3).every((l) => l.preuve === 'oui') && L[3].preuve === 'pas-su', `J ${tag} : chaque ligne montre sa preuve ; sans preuve, « pas su » (jamais rien)`, L);
          dit(L[0] && /Offre acceptée/.test(L[0].txt) && /depuis ton téléphone/.test(L[0].txt) && /commande 62001/.test(L[0].txt), `J ${tag} : « Offre acceptée · commande … · depuis ton téléphone »`, L[0] && L[0].txt);
          await pg.screenshot({ path: path.join(SHOTS, `journal-${tag}.png`), fullPage: true });
          await ctx.close();
        }
      }
    }
  } finally { await nav.close(); if (srvStatut) srvStatut.close(); if (NV) NV.srv.close(); }
  console.log(`\nCaptures : ${SHOTS}`);
  console.log(ko ? `${ko} KO` : 'Tout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc a levé : ' + (e && e.stack || e)); process.exit(1); });

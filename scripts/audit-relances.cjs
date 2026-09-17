// ═══════════════════════════════════════════════════════════════════════════
// LES RELANCES — UN DESTINATAIRE, ET RIEN QUI PARTE TOUT SEUL
//        node scripts/audit-relances.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Demande de Julien, 17 septembre : « envoyer aux personnes sur Vinted qui ont
// mis l'article en favori une petite relance pour qu'ils achètent ».
//
// ⚠️ REMESURÉ AVANT DE CODER, sur ses **481 annonces captées** : **105 portent
//    au moins un favori, 1 240 favoris en tout**, et les seuls champs qui
//    nomment quelqu'un sont `user`/`user_id` (LUI), `is_favourite` (est-ce que
//    LUI a mis en favori) et `favourite_count` — **un nombre**. Mille deux cent
//    quarante personnes, **zéro adresse**.
// ⚠️⚠️ MAIS UN AUTRE GROUPE EST NOMMÉ : sur ses **988 conversations**,
//    **669 portent un `opposite_user`** et **661 un `transaction.item_id`**.
//    En ne gardant que les paires **encore en ligne** dont l'échange n'a jamais
//    abouti : **58 personnes sur 27 paires** (exécuté sur la vraie base).
//
// Ce que ce contrôle exige :
//   1. AUCUN message ne part : un clic ouvre une conversation, point. Soixante
//      messages envoyés par un programme, c'est le signal de robot qui a fait
//      bloquer `vanessa5723` (§3) ;
//   2. chaque ligne a ses TROIS identités — la personne, la paire, la
//      conversation. Pas de rapprochement par titre (§5) ;
//   3. « texte copié » n'est écrit que si la copie a eu lieu : une promesse
//      REJETÉE ne passe pas par `catch` (le défaut mesuré dans `lbc.js` puis
//      `ebay.js`) ;
//   4. une liste vide a une CAUSE, et trois causes donnent trois phrases (§7) ;
//   5. ⚠️ l'autre sens : *ne rien afficher du tout* passerait les quatre
//      premiers — les personnes doivent être NOMMÉES, sinon on ne sait pas à
//      qui écrire.
const { chromium } = require(require('path').join(__dirname, '..', 'node_modules', 'playwright'));
const fs = require('fs'), path = require('path');
const PAN = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'vinted-panel.js'), 'utf8');

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
// ⚠️ HUITIÈME FOIS QU'UN DE MES AUDITS MEURT AU LIEU DE RAPPORTER — et je viens
//    de la refaire : sur le code d'avant l'onglet n'existe pas, le bouton non
//    plus, et `.click()` sur `null` tuait le processus AVANT le bilan. Ce qui
//    lève devient un contrôle ROUGE. *Un audit ne meurt pas, il rapporte.*
const essaie = async (nom, fn) => { try { return await fn(); } catch (e) { dit(false, nom, 'a levé : ' + e.message); return null; } };

const PAIRE = (id, numero, title, price, gens) => gens.map((login, i) => ({
  conv: '90' + id + i, url: `https://www.vinted.fr/inbox/90${id}${i}`, login, uid: '111',
  id, numero, title, photo: '', price, minPrice: Math.round(price * 0.8), buyPrice: Math.round(price * 0.4),
  at: '2026-09-16T10:00:00Z', nMsg: 3 + i,
}));
const RELANCES = [
  ...PAIRE('1001', '401', 'salomon XT-6 blanc taille 40', 99, ['djymy0101', 'chloe-ldr', 'marie35']),
  ...PAIRE('1002', '493', 'nike LD waffle sacai fragment bleu taille 45', 155, ['leo_p']),
];
const BASE = {
  ok: true, online: [], byId: {}, sleeping: [], relance: [], noNum: [], toShip: [], pickups: [], bordsToPrint: [],
  convs: [], quickReplies: [], appStats: {}, goal: 0, stats: {}, accounts: [], sales: [],
  recentSales: [], recentBuys: [], disputes: [], offers: [], coffre: [], compteActif: '111',
};

const rendre = async (b, data) => {
  const pg = await b.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await pg.route('**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }));
  await pg.addInitScript((d) => {
    window.__copies = []; window.__ouverts = []; window.__envois = [];
    window.__refuseCopie = !!d.__refuseCopie;
    localStorage.setItem('vrm_panel_open', '1'); localStorage.setItem('vrm_panel_tab', 'relances');
    window.chrome = {
      runtime: {
        sendMessage: (m, cb) => {
          // ⚠️ TOUT message au fond est noté : c'est par là que passerait un envoi.
          window.__envois.push(m && m.action);
          const r = m && m.action === 'panelData' ? d : { ok: true };
          if (typeof cb === 'function') cb(r); return Promise.resolve(r);
        }, lastError: null,
      },
      storage: { local: { get: (k, cb) => { const o = {}; if (typeof cb === 'function') { cb(o); return; } return Promise.resolve(o); }, set: (o, cb) => { if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); } } },
    };
    window.open = (u) => { window.__ouverts.push(u); return null; };
    // ⚠️ LA VRAIE FORME DE L'ÉCHEC : une PROMESSE REJETÉE, pas une exception.
    navigator.clipboard.writeText = (t) => {
      if (window.__refuseCopie) return Promise.reject(new DOMException('NotAllowed', 'NotAllowedError'));
      window.__copies.push(String(t)); return Promise.resolve();
    };
    document.execCommand = () => !window.__refuseCopie;
  }, data);
  await pg.goto('https://www.vinted.fr/member/items');
  await pg.addScriptTag({ content: PAN });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { const f = document.querySelector('#vrm-fab'); if (f) f.click(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { const t = [...document.querySelectorAll('.vrm-tab')].find((x) => /relance/i.test(x.textContent)); if (t) t.click(); });
  await pg.waitForTimeout(400);
  return { pg, errs, txt: await pg.evaluate(() => (document.querySelector('#vrm-body') || document.body).innerText || '') };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox'] });

  console.log('── LA LISTE, SUR QUATRE PAIRES ET QUATRE PERSONNES');
  await essaie('la liste se rend', async () => {
    const { pg, errs, txt } = await rendre(b, Object.assign({}, BASE, { relances: RELANCES, online: [{ id: '1001', title: 'x', price: 99 }] }));
    dit(errs.length === 0, 'l\'onglet se rend sans erreur', errs.slice(0, 2).join(' | '));
    // ⚠️ L'AUTRE SENS : tout retirer passerait les contrôles d'envoi.
    const nommes = ['djymy0101', 'chloe-ldr', 'marie35', 'leo_p'].filter((l) => txt.includes(l));
    dit(nommes.length === 4, 'les QUATRE personnes sont NOMMÉES — sans nom, on ne sait pas à qui écrire',
      `${nommes.length}/4 : ${nommes.join(', ')}`);
    // ⚠️ ON LIT LES NOMBRES RENDUS, pas une expression sur le texte : un `/\b4\b/`
    //    sur toute la page attrape n'importe quel « 4 » (une taille, un prix) et
    //    serait vert le jour où le compte est faux. C'est la donnée qui juge.
    const chiffres = await pg.evaluate(() => [...document.querySelectorAll('.vrm-st b')].map((x) => x.textContent.trim()));
    dit(chiffres[0] === '4' && chiffres[1] === '2', 'le compte annoncé suit la donnée (4 personnes · 2 paires)',
      `rendu : ${JSON.stringify(chiffres)}`);
    const boutons = await pg.evaluate(() => document.querySelectorAll('.vrm-rel-go[data-act="open"]').length);
    dit(boutons === 4, 'chaque personne a SA porte : un bouton par conversation', `${boutons} bouton(s)`);

    // 1. AUCUN ENVOI. On clique les quatre.
    await pg.evaluate(async () => {
      for (const x of document.querySelectorAll('.vrm-rel-go[data-act="open"]')) { x.click(); await new Promise((r) => setTimeout(r, 60)); }
    });
    await pg.waitForTimeout(500);
    const { ouverts, envois, copies } = await pg.evaluate(() => ({ ouverts: window.__ouverts, envois: window.__envois, copies: window.__copies }));
    const suspects = envois.filter((a) => /send|message|post|offer|reply|envoy/i.test(String(a || '')));
    dit(suspects.length === 0, 'AUCUN message n\'est envoyé — le clic ouvre, il ne parle pas',
      suspects.length ? `actions suspectes : ${suspects.join(', ')}` : '');
    dit(ouverts.length === 4 && ouverts.every((u) => /\/inbox\//.test(u)),
      'et il ouvre LA conversation de cette personne-là', `${ouverts.length} ouverture(s) · ex. ${ouverts[0] || '—'}`);
    dit(copies.length >= 1 && /toujours/i.test(copies[0] || ''), 'le texte prêt part dans le presse-papier',
      (copies[0] || '').slice(0, 70));
    // ⚠️ Le message nomme la paire dont CETTE personne a parlé — pas une autre.
    dit((copies[0] || '').includes('salomon XT-6 blanc taille 40'),
      'et il parle de la paire de cette conversation, pas d\'une autre');
    await pg.close();
  });

  console.log('\n── « COPIÉ » N\'EST ÉCRIT QUE SI ÇA A COPIÉ (promesse rejetée)');
  await essaie('le bouton Copier', async () => {
    const { pg } = await rendre(b, Object.assign({}, BASE, { relances: RELANCES, __refuseCopie: true }));
    const libelle = await pg.evaluate(async () => {
      const bt = document.querySelector('.vrm-rel-go[data-act="copy"]');
      bt.click(); await new Promise((r) => setTimeout(r, 500));
      return bt.textContent || '';
    });
    dit(!/copi[ée]\s*$/i.test(libelle.trim()) && !/✓/.test(libelle),
      'le bouton n\'annonce PAS « copié » quand le presse-papier a refusé', `il dit « ${libelle.trim()} »`);
    dit(/refus|s[ée]lectionne/i.test(libelle), 'et il dit quoi faire à la place', `« ${libelle.trim()} »`);
    await pg.close();
  });

  console.log('\n── UNE LISTE VIDE A UNE CAUSE, ET TROIS CAUSES FONT TROIS PHRASES');
  await essaie('les listes vides', async () => {
    const phrases = {};
    for (const [cas, data] of [
      ['jamais capté', Object.assign({}, BASE, { relances: [], online: [] })],
      ['rien à relancer', Object.assign({}, BASE, { relances: [], online: [{ id: '1', title: 'x', price: 9 }] })],
      ['lecture ratée', Object.assign({}, BASE, { relances: [], online: [], baseKO: true })],
    ]) {
      const { pg, txt } = await rendre(b, data);
      phrases[cas] = txt.replace(/\s+/g, ' ').trim();
      await pg.close();
    }
    const vals = Object.values(phrases);
    const distinctes = new Set(vals).size;
    dit(distinctes === 3, 'les trois causes donnent trois phrases DIFFÉRENTES — deux qui se ressemblent, c\'est une cause oubliée',
      `${distinctes}/3`);
    for (const [k, v] of Object.entries(phrases)) console.log(`     ${k.padEnd(16)} « ${v.slice(0, 92)} »`);
    dit(!/🎉|bravo|beau boulot/i.test(vals.join(' ')), 'et on ne FÊTE rien sur une liste qu\'on n\'a pas pu lire');
  });

  await b.close();
  console.log(ko ? `\n❌ relances : ${ko} rouge(s)` : '\n✅ relances : tout est vert');
  process.exit(ko ? 1 : 0);
})();

// Audit : un geste (doigt, souris, flèches ← →) ne change d'onglet que vers le
// voisin VISIBLE dans la barre, et jamais quand il appartient à autre chose ;
// et rien, nulle part, ne publie ni n'agit sur Vestiaire Collective.
//
// Plainte de Julien (15 octobre) : « quand je publie sur eBay et que j'appuie sur
// n'importe quel bouton, des fois ça m'a publié sur Vestiaire Collective ».
// MESURÉ : aucun chemin ne publie sur Vestiaire — il arrivait sur l'ÉCRAN
// Vestiaire. Le balayage parcourait `BOTTOM_TABS` brut, où Vestiaire est rangé
// juste avant eBay, alors que la barre le cache dans « Autres plateformes ».
//
// L'audit EXÉCUTE les vraies règles extraites d'`App.jsx` (jamais une
// recopie) : `slideTab` dans un `vm` contre la liste que la barre rend
// VRAIMENT (l'expression de la barre, évaluée), et `gestePeutChangerOnglet`
// dans un vrai Chromium, sur un vrai DOM.
//
// `--mutation <nom>` réaffaiblit UNE règle avant de l'exécuter — l'audit doit
// alors sortir ROUGE (anneau · slide · garde · rangee · souris · clavier ·
// champ · fixe). `--src chemin` lit un autre App.jsx (preuve sur le code d'avant).
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const SRC = arg('--src') || path.join(R, 'src', 'App.jsx');
const MUTATION = arg('--mutation');
let APP = fs.readFileSync(SRC, 'utf8');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
// Un audit ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 160)); return null; } };

// ── Les mutations : chacune RETIRE une moitié de la règle ────────────────────
const MUTATIONS = {
  anneau:  ['const ONGLETS_BARRE = BOTTOM_TABS.filter(t => !t.autre);', 'const ONGLETS_BARRE = BOTTOM_TABS;'],
  garde:   ["    if (doc.querySelector('[data-garde-onglet]')) return false;\n", ''],
  rangee:  ["      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 2) return false;\n", ''],
  souris:  ["    if (mode === 'souris' && n && n.closest(CONTROLE_SOURIS)) return false;\n", ''],
  clavier: ["    if (mode === 'clavier' && n) { const r = n.closest('[role]'); if (r && ROLES_FLECHES.test(r.getAttribute('role') || '')) return false; }\n", ''],
  champ:   ["    if (n && n.closest('input,textarea,select,[contenteditable=\"\"],[contenteditable=\"true\"]')) return false;\n", ''],
  fixe:    ["      if (cs.position === 'fixed') return false;\n", ''],
  // le balayage qui reparcourt `BOTTOM_TABS` brut (le code d'avant le 15 octobre)
  slide:   ['    setTab(t=>ongletVoisin(t, dx<0?1:-1));', '    setTab(t=>{ const i=BOTTOM_TABS.findIndex(x=>x.id===t); if(i<0) return t; const ni=dx<0?Math.min(BOTTOM_TABS.length-1,i+1):Math.max(0,i-1); return BOTTOM_TABS[ni].id; });'],
};
if (MUTATION) {
  const m = MUTATIONS[MUTATION];
  if (!m || !APP.includes(m[0])) { console.log(`❌ la mutation « ${MUTATION} » n'a pas pris (texte introuvable) — rien n'est prouvé`); process.exit(2); }
  APP = APP.replace(m[0], m[1]);
  console.log(`(mutation « ${MUTATION} » appliquée : l'audit DOIT sortir rouge)`);
}

// ── Extraction : une déclaration de premier niveau, par appariement ─────────
// (chaînes et commentaires sautés — un `]` dans `'a[href]'` ne ferme rien).
function apparie(src, debut, ouvrant, fermant) {
  let p = 0, i = debut;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; } continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; continue; }
    if (c === ouvrant) p++;
    else if (c === fermant) { p--; if (p === 0) return i; }
  }
  return -1;
}
function extraitConst(nom) {
  const m = new RegExp('^const ' + nom + '\\s*=', 'm').exec(APP); if (!m) return null;
  const fin = APP.indexOf(';\n', m.index); return fin < 0 ? null : APP.slice(m.index, fin + 1);
}
function extraitTableau(nom) {
  const m = new RegExp('^const ' + nom + '\\s*=\\s*\\[', 'm').exec(APP); if (!m) return null;
  const debut = APP.indexOf('[', m.index); const fin = apparie(APP, debut, '[', ']');
  return fin < 0 ? null : APP.slice(m.index, fin + 1) + ';';
}
function extraitFonction(nom) {
  const m = new RegExp('^function ' + nom + '\\s*\\(', 'm').exec(APP); if (!m) return null;
  const debut = APP.indexOf('{', APP.indexOf(')', m.index)); const fin = apparie(APP, debut, '{', '}');
  return fin < 0 ? null : APP.slice(m.index, fin + 1);
}

(async () => {
  // ── 1. LE BALAYAGE NE MÈNE QU'AU VOISIN VISIBLE ───────────────────────────
  await essaie('le balayage suit la barre visible', async () => {
    const decl = [extraitTableau('BOTTOM_TABS'), extraitConst('ONGLETS_BARRE'), extraitConst('ONGLETS_AUTRES'), extraitFonction('ongletVoisin')].filter(Boolean).join('\n');
    const m = /const slideTab=React\.useCallback\(/.exec(APP);
    if (!m) { dit(false, '`slideTab` est trouvé dans App.jsx'); return; }
    const debut = APP.indexOf('(', m.index + 'const slideTab=React.useCallback'.length - 1);
    const fin = apparie(APP, debut, '(', ')');
    const slide = APP.slice(m.index, fin + 1) + ';';
    // La barre du bas : l'expression qu'ELLE rend (évaluée, pas lue).
    const mb = /const items=([\s\S]+?)\.map\(t=>t\.id==='journee'\?/.exec(APP);
    // Le rail latéral : le groupe « Plateformes ».
    const mr = /className="vrm-sidebar-label">Plateformes<\/div>\s*\{([\s\S]+?)\.map\(bouton\)\}/.exec(APP);
    dit(!!mb && !!mr, 'la barre du bas et le rail sont trouvés (leurs expressions sont évaluées, pas lues)');
    const ctx = vm.createContext({});
    vm.runInContext(decl + `\nconst React={useCallback:(f)=>f}; let __upd=null; const setTab=(f)=>{__upd=f;};\n${slide}
      globalThis.__voisin=(t,dx)=>{ __upd=null; slideTab(dx,0,1); return __upd?__upd(t):t; };
      globalThis.__barre=(${mb ? mb[1] : '[]'}).map(t=>t.id);
      globalThis.__rail=(${mr ? mr[1] : '[]'}).map(t=>t.id);
      globalThis.__tous=BOTTOM_TABS.map(t=>t.id);`, ctx);
    const barre = ctx.__barre, rail = ctx.__rail, tous = ctx.__tous;
    dit(JSON.stringify(barre) === JSON.stringify(rail), 'la barre du bas et le rail montrent la MÊME liste de plateformes (§11)', `barre=${barre} · rail=${rail}`);
    // Depuis chaque onglet de la barre, dans les deux sens : on reste DANS la barre.
    const sorties = [];
    for (const t of barre) for (const dx of [200, -200]) { const v = ctx.__voisin(t, dx); if (!barre.includes(v)) sorties.push(`${t} ${dx > 0 ? '←' : '→'} ${v}`); }
    dit(sorties.length === 0, 'depuis un onglet de la barre, un balayage ne mène qu\'à un onglet de la barre', sorties.join(' · '));
    const ebay = [ctx.__voisin('plat_ebay', 200), ctx.__voisin('plat_ebay', -200)];
    dit(!ebay.includes('plat_vestiaire'), 'depuis eBay, aucun balayage ne mène à Vestiaire', 'eBay → ' + ebay.join(' / '));
    // La marche complète, de gauche à droite, REND la barre — ni plus, ni moins.
    const marche = [barre[0]]; for (let k = 0; k < 10; k++) { const v = ctx.__voisin(marche[marche.length - 1], -200); if (v === marche[marche.length - 1]) break; marche.push(v); }
    dit(JSON.stringify(marche) === JSON.stringify(barre), 'balayer de bout en bout parcourt exactement la barre visible', `marche=${marche} · barre=${barre}`);
    // Un onglet HORS de la barre (Vestiaire, Colis…) ne glisse nulle part.
    const hors = tous.filter((t) => !barre.includes(t)).concat(['cat_bord']);
    const bouge = hors.flatMap((t) => [200, -200].map((dx) => [t, ctx.__voisin(t, dx)])).filter(([a, b]) => a !== b);
    dit(hors.includes('plat_vestiaire') && bouge.length === 0, 'Vestiaire est HORS de la barre, et un onglet hors de la barre ne glisse nulle part', bouge.map(([a, b]) => a + '→' + b).join(' · ') || ('hors=' + hors));
  });

  // ── 2. QUAND UN GESTE A LE DROIT DE CHANGER D'ONGLET (vrai DOM) ──────────
  await essaie('la règle des gestes, dans un vrai navigateur', async () => {
    const fn = extraitFonction('gestePeutChangerOnglet');
    const deps = [extraitConst('CONTROLE_SOURIS'), extraitConst('ROLES_FLECHES')].filter(Boolean).join('\n');
    dit(!!fn, '`gestePeutChangerOnglet` — UNE règle pour le doigt, la souris et les flèches — existe');
    if (!fn) return;
    let chromium; try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
    try {
      const pg = await b.newPage({ viewport: { width: 390, height: 800 } });
      await pg.setContent(`<!doctype html><html><body>
        <div id="neutre">Du texte</div>
        <button id="bouton">Un bouton</button>
        <a id="lien" href="#x">Un lien</a>
        <input id="champ" value="saisie"><textarea id="zone">x</textarea>
        <div id="rangee" style="display:flex;overflow-x:auto;width:200px"><div style="flex:0 0 900px"><span id="dansRangee">photo</span></div></div>
        <div id="rangeeCourte" style="display:flex;overflow-x:auto;width:300px"><span id="dansRangeeCourte">tient</span></div>
        <div style="position:fixed;top:0;left:0"><span id="dansFixe">modale</span></div>
        <div data-noswipe="true"><span id="dansNoswipe">tampon</span></div>
        <div role="tablist"><button id="onglet" role="tab">Onglet</button></div>
      </body></html>`);
      await pg.addScriptTag({ content: deps + '\n' + fn + '\nwindow.__regle = gestePeutChangerOnglet;' });
      const juge = (id, mode) => pg.evaluate(([id, mode]) => window.__regle(id === 'body' ? document.body : document.getElementById(id), mode), [id, mode]);
      const cas = [
        // [élément, mode, attendu, ce que ça dit]
        ['neutre', 'doigt', true, 'un balayage au doigt sur du texte change d\'onglet (le geste demandé en septembre)'],
        ['neutre', 'souris', true, 'glisser la souris sur du texte change d\'onglet'],
        ['body', 'clavier', true, '← → sans focus particulier change d\'onglet'],
        ['bouton', 'doigt', true, 'au doigt, un balayage parti d\'un bouton reste un balayage (un tap ne parcourt pas 70 px)'],
        ['bouton', 'souris', false, 'à la souris, presser un BOUTON puis glisser n\'est jamais changer d\'onglet'],
        ['lien', 'souris', false, 'à la souris, presser un LIEN puis glisser n\'est jamais changer d\'onglet'],
        ['champ', 'doigt', false, 'un geste parti d\'un champ de saisie ne change pas d\'onglet (doigt)'],
        ['zone', 'clavier', false, '← → dans un champ de texte déplacent le curseur, pas l\'onglet'],
        ['dansRangee', 'doigt', false, 'faire défiler au doigt une rangée qui DÉBORDE n\'est pas changer d\'onglet'],
        ['dansRangee', 'souris', false, 'idem à la souris'],
        ['dansRangeeCourte', 'doigt', true, 'une rangée qui tient sur l\'écran ne bloque rien (elle ne défile pas)'],
        ['dansFixe', 'doigt', false, 'un geste parti d\'une fenêtre flottante ne change pas l\'onglet derrière'],
        ['dansNoswipe', 'souris', false, 'une zone `data-noswipe` (le tampon) garde son geste'],
        ['onglet', 'clavier', false, '← → dans un composant à flèches (onglets ARIA) lui appartiennent'],
      ];
      for (const [id, mode, att, quoi] of cas) { const v = await juge(id, mode); dit(v === att, quoi, `${id}/${mode} → ${v}`); }
      // Un formulaire en cours (`data-garde-onglet`) : PLUS AUCUN geste, d'où qu'il parte.
      await pg.evaluate(() => { const g = document.createElement('div'); g.setAttribute('data-garde-onglet', 'ebay-publier'); g.textContent = 'formulaire'; document.body.appendChild(g); });
      const pendant = [];
      for (const [id, mode] of [['neutre', 'doigt'], ['neutre', 'souris'], ['body', 'clavier']]) pendant.push(`${id}/${mode}=${await juge(id, mode)}`);
      dit(pendant.every((x) => x.endsWith('=false')), 'tant qu\'un formulaire en cours est monté, aucun geste ni flèche ne change d\'onglet', pendant.join(' · '));
      // « Pas su » : la règle qui lève ne fait pas changer d'onglet.
      const pasSu = await pg.evaluate(() => window.__regle({ nodeType: 1, ownerDocument: null, closest() { throw new Error('x'); } }, 'doigt'));
      dit(pasSu === false, 'une règle qui ne peut pas juger (exception) ne change pas d\'onglet', String(pasSu));
    } finally { await b.close(); }
  });

  // ── 3. LE FORMULAIRE eBay EN COURS PORTE LA GARDE ─────────────────────────
  // (le banc `ebay-vestiaire.cjs` le prouve au rendu ; ici on vérifie que les
  // deux formulaires qui gardent une saisie la DÉCLARENT.)
  {
    const publier = extraitFonction('EbayPublier') || '', planif = extraitFonction('EbayPlanificateur') || '';
    dit(/data-garde-onglet=/.test(publier), 'le formulaire « Vendre une paire sur eBay » déclare `data-garde-onglet`');
    dit(/data-garde-onglet=/.test(planif), 'le planificateur eBay déclare `data-garde-onglet`');
  }

  // ── 4. RIEN NE PUBLIE NI N'AGIT SUR VESTIAIRE ──────────────────────────────
  // « Bientôt disponible » : tant que Vestiaire n'est que MESURÉ, aucun chemin
  // (app, extension, serveur) ne doit y écrire, y ouvrir un dépôt ou y cliquer.
  {
    const lit = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
    const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (x) => x.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
    // a. Les places de publication de l'app (évaluées).
    const mp = extraitTableau('MP_PLACES');
    let places = [];
    try { const c = vm.createContext({}); vm.runInContext(mp + '\nglobalThis.__p = MP_PLACES.map(p => p.cle + "|" + p.nom);', c); places = c.__p; } catch (_) { places = null; }
    dit(Array.isArray(places) && places.every((p) => !/vestiaire|^vc\|/i.test(p)), 'aucune « place » de publication Vestiaire dans l\'app', String(places));
    // b. L'extension : aucun dépôt ouvert, aucune requête vers vestiairecollective.
    const appels = [];
    for (const f of fs.readdirSync(path.join(R, 'vinted-sync-extension')).filter((x) => x.endsWith('.js'))) {
      sansCommentaires(lit('vinted-sync-extension/' + f)).split('\n').forEach((l, i) => {
        if (/vestiairecollective/i.test(l) && /fetch\(|tabs\.(create|update)\(|XMLHttpRequest|executeScript|sendBeacon|location\s*=|\.href\s*=/.test(l)) appels.push(`${f}:${i + 1}`);
      });
    }
    // Les scripts posés SUR Vestiaire n'agissent pas : ils ne font que regarder.
    for (const f of ['vc.js', 'vc-inject.js']) {
      sansCommentaires(lit('vinted-sync-extension/' + f)).split('\n').forEach((l, i) => {
        if (/new XMLHttpRequest|\.click\(|\.submit\(|dispatchEvent\(|sendBeacon|(^|[^.\w])fetch\(/.test(l)) appels.push(`${f}:${i + 1}`);
      });
    }
    dit(appels.length === 0, 'l\'extension n\'appelle, n\'ouvre et ne clique RIEN sur Vestiaire (elle regarde seulement)', appels.join(' · '));
    // c. Le serveur : aucune route ne parle à Vestiaire.
    const api = [];
    const balaie = (d) => { for (const f of fs.readdirSync(path.join(R, d))) { const p = path.join(d, f); if (fs.statSync(path.join(R, p)).isDirectory()) balaie(p); else if (/\.js$/.test(f) && /vestiairecollective/i.test(sansCommentaires(lit(p)))) api.push(p); } };
    try { balaie('api'); } catch (_) {}
    dit(api.length === 0, 'aucune route `api/` ne parle à Vestiaire', api.join(' · '));
    // d. L'app : aucun fetch vers Vestiaire.
    const appVc = sansCommentaires(APP).split('\n').filter((l) => /vestiairecollective/i.test(l) && /fetch\(|method:\s*['"](POST|PUT|PATCH|DELETE)/.test(l));
    dit(appVc.length === 0, 'l\'app n\'envoie aucune requête à Vestiaire', appVc.length + ' ligne(s)');
  }

  console.log(`\n${ko === 0 ? 'OK' : 'KO'} — ${ko} contrôle(s) en échec`);
  process.exit(ko ? 1 : 0);
})();

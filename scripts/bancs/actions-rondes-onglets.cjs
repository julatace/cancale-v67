require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LES GESTES D'AUJOURD'HUI AU-DESSUS DES ONGLETS (27 nov.) — capture iPhone de Julien (390 pt, clair) : la rangée de
//  disques « Imprimer · Scanner · Publier · Relier · Messages » tombait pile sur le bord du premier écran ; les disques se
//  voyaient, leurs LIBELLÉS passaient sous la barre d'onglets (on ne lisait que le haut des premières lettres).
//  Cause : la rangée est dans le flux, sous quatre cartes d'alerte et le héros ; l'écran défile dans son conteneur, qui
//  s'arrête au haut de la barre — sa place tombait à cheval sur ce bord. Correction (src/natif/graphe.css,
//  `.n-actions-rondes[data-n-dock]`) : au téléphone, la rangée se pose en bas de l'écran qui défile tant que sa place est
//  plus bas, puis reprend sa place en défilant.
//
//  L'app RENDUE (dist/), la base INVENTÉE du banc aujourdhui-moins-texte (la même capture : 5 annonces disparues,
//  « Tout arrêter » posé, l'ordinateur éteint — aucune donnée réelle, le dépôt est public). Il juge, sur les data-* et
//  les boîtes rendues (jamais un libellé) :
//    O  ONGLETS  — à chaque position de défilement (haut, place À CHEVAL sur la barre, milieu, bas), aucun libellé de la rangée ne croise
//                  verticalement la barre d'onglets (`.n-onglets`), et le point au centre de chaque libellé visible est
//                  SON bouton (elementFromPoint) ;
//    C  CIBLE    — chaque disque fait au moins 44 px affichés ;
//    L  LIBELLÉ  — aucun libellé raccourci par des points de suspension (« Messag… » à 320 px) ;
//  à 320, 375, 390 et 430 px de large, avec la zone sûre de l'iPhone (34 px en bas) et sans, en clair et en sombre.
//  Réglages : `BANC_DIST` (un autre build : l'AVANT), `LARGEURS=320,375,390,430`, `THEMES=clair,sombre`, `SURES=34,0`,
//  `SHOTS=<dossier>` (captures à REGARDER), `MUTATION=dock` (la rangée collée reprend sa place dans le flux : rouge attendu).
//  Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.TZ = 'Europe/Paris';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { baseCapture, ouvrir } = require('./aujourdhui-moins-texte.cjs');
const SHOTS = process.env.SHOTS || '';
const MUT = process.env.MUTATION || '';
const liste = (v, d) => String(process.env[v] == null ? d : process.env[v]).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '320,375,390,430').map(Number), THEMES = liste('THEMES', 'clair,sombre'), SURES = liste('SURES', '34,0').map(Number);
// Les hauteurs des iPhone de ces largeurs (SE 1re gén., SE 2e/3e, 13/14, 15 Pro Max).
const HAUTEUR = { 320: 568, 375: 667, 390: 844, 430: 932 };
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };

// La mesure, DANS la page, à la position de défilement donnée (0 = haut, 0.5 = milieu, 1 = bas).
const MESURER = async (pos) => {
  const rangee = document.querySelector('[data-v2-ecran="aujourdhui"] .n-actions-rondes');
  const barre = document.querySelector('.n-onglets');
  if (!rangee || !barre) return { manque: { rangee: !!rangee, barre: !!barre } };
  // Le conteneur qui défile (la coque « écran »), sinon la fenêtre.
  let sc = rangee.parentElement; while (sc && !(/(auto|scroll)/.test(getComputedStyle(sc).overflowY) && sc.scrollHeight > sc.clientHeight + 4)) sc = sc.parentElement;
  const max = sc ? sc.scrollHeight - sc.clientHeight : document.documentElement.scrollHeight - innerHeight;
  const aller = (y) => { y = Math.max(0, Math.min(max, Math.round(y))); if (sc) sc.scrollTop = y; else window.scrollTo(0, y); };
  const ou = () => (sc ? sc.scrollTop : window.scrollY);
  const image = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (pos === 'cheval') {
    // La place de la rangée À CHEVAL sur le haut de la barre (le cas de la capture : les disques à moitié visibles, les
    // libellés dessous), quelle que soit la hauteur au-dessus : le haut de sa place 30 px au-dessus du haut des onglets.
    // La place = la boîte qui garde la rangée dans le flux (sinon, sur l'AVANT, la rangée elle-même).
    aller(0); await image();
    const place = rangee.closest('.n-actions-rondes-place') || rangee;
    const d = place.getBoundingClientRect().top + 30 - barre.getBoundingClientRect().top;
    aller(ou() + d);
  } else aller(max * pos);
  await image(); await image();
  const b = barre.getBoundingClientRect();
  const libelles = [...rangee.querySelectorAll('.n-action-ronde')].map((bt) => {
    const l = bt.querySelector('.n-action-ronde-libelle'); const r = l.getBoundingClientRect(); const d = bt.querySelector('.n-action-ronde-disque').getBoundingClientRect();
    const croise = r.top < b.bottom - 0.5 && r.bottom > b.top + 0.5;
    const cy = (r.top + r.bottom) / 2, cx = (r.left + r.right) / 2;
    const visible = cy > 0 && cy < innerHeight;
    const e = visible ? document.elementFromPoint(cx, cy) : null;
    return { cle: bt.getAttribute('data-v2-principal') != null ? 'imprimer' : [...bt.attributes].map((a) => a.name).find((n) => /^data-v2-/.test(n)) || '?', haut: Math.round(r.top), bas: Math.round(r.bottom),
      croise, visible, sien: !visible || (!!e && bt.contains(e)), dessus: e && !bt.contains(e) ? (e.className && e.className.baseVal == null ? e.className : e.tagName) : '', disque: Math.round(Math.min(d.width, d.height)), coupe: l.scrollWidth > l.clientWidth + 0.5 ? l.scrollWidth + '>' + l.clientWidth : '' };
  });
  return { pos, defile: max, barreHaut: Math.round(b.top), libelles, colle: getComputedStyle(rangee).position };
};

(async () => {
  const b = baseCapture();
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const theme of THEMES) {
      const { ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre: theme === 'sombre', style: '', b });
      const cdp = await ctx.newCDPSession(pg).catch(() => null);
      // La mutation remet le défaut DANS la page : la rangée « collée » reprend sa place dans le flux (la règle affaiblie).
      if (MUT === 'dock') await pg.addStyleTag({ content: '.n-actions-rondes[data-n-colle] { position: static !important; margin: 0 16px 16px !important; padding: 0 !important; }' });
      try {
        dit(!erreurs.length, `${theme} : aucune erreur JS`, erreurs);
        for (const W of LARGEURS) for (const sure of SURES) {
          const nom = `${W}-${theme}-sure${sure}`;
          console.log(`\n▶ ${nom}`);
          if (cdp) await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: sure ? 47 : 0, bottom: sure, left: 0, right: 0 } }).catch(() => {});
          await pg.setViewportSize({ width: W, height: HAUTEUR[W] || 844 }); await pg.waitForTimeout(500);
          for (const pos of [0, 'cheval', 0.5, 1]) {
            const r = await pg.evaluate(MESURER, pos);
            if (r.manque) { dit(false, `${nom} : la rangée de gestes et la barre d'onglets sont rendues`, r.manque); continue; }
            if (pos === 0 && SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); }
            const croises = r.libelles.filter((x) => x.croise), caches = r.libelles.filter((x) => !x.sien);
            dit(r.libelles.length >= 4 && !croises.length, `O ${nom} défilement ${pos} : aucun libellé sous la barre (haut de barre ${r.barreHaut})`, croises);
            dit(!caches.length, `O ${nom} défilement ${pos} : le centre de chaque libellé visible est son bouton`, caches);
            if (pos === 0) dit(r.libelles.every((x) => x.disque >= 44), `C ${nom} : chaque disque ≥ 44 px`, r.libelles.map((x) => x.disque));
            if (pos === 0) dit(r.libelles.every((x) => !x.coupe), `L ${nom} : aucun libellé raccourci (« Messag… »)`, r.libelles.filter((x) => x.coupe));
          }
        }
      } catch (e) { dit(false, 'mesure ' + theme, String(e && e.stack || e).slice(0, 400)); }
      await ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();

require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  VENTES — LA RANGÉE COMPACTE (25 nov. 2026, lot ventes-rangee) — l'écran Ventes RENDU, base INVENTÉE (design-passe + titres
//  réalistes, plusieurs transporteurs, des ventes dont la photo n'est QUE dans leur transaction, d'autres sans aucune photo).
//  Julien, capture iPhone de Ventes → « En route 40 » : « Regarde c'est atroce, c'est moche, la mise en page est catastrophique » :
//  ~260 px par vente, vignette vide, titre coupé, « Livré · 3/4 » ET « Livrée », logo du transporteur coupé au bord, frise géante,
//  « Relier » et « + prix » en gros sur chaque ligne. Récit : docs/passation/2026-11-25-ventes-rangee.md.
//
//  390 × 844 tactile (À envoyer, En route, Terminées), clair et sombre ; 1512 (le tableau reste) — mesures RENDUES (boîtes, data-*) :
//    H  chaque rangée de vente fait au plus 104 px de haut au téléphone (le but : 6 à 7 ventes par écran ; avant : ~110 à 150) ;
//    T  le titre a au moins la moitié de la largeur de la rangée, et aucun morceau de la 2ᵉ ligne n'est rogné (ni « … », ni coupé) ;
//    L  le logo du transporteur est ENTIER dans la rangée (aucun parent ne le rogne) ;
//    D  pas de doublon d'état : un seul mot d'état par rangée (jamais « Livré · 3/4 » ET « Livrée ») ;
//    R  « Relier » et « + prix » ne sont PAS posés sur les rangées ; ils restent au balayage d'une vente SANS achat (et seulement
//       d'elle), et dans la fiche de la vente (Relier + le champ Prix d'achat) ;
//    P  la vente dont la photo n'est que dans SA transaction montre sa photo ; sans aucune photo, le repli est discret (pas un
//       carré plein) ;
//    O  1512 : « À envoyer » et « En route » restent le tableau de travail (lignes rendues, pas de défilement de côté).
//  `BANC_DIST=…` juge un autre build (le code d'avant : rouge attendu). `SHOTS=dossier` garde les captures (dsf 2).
//  `MUTATION=logo` réaffaiblit la règle (la 2ᵉ ligne rognée) : L doit passer au rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-ventes-rangee');
fs.mkdirSync(SHOTS, { recursive: true });
const DSF = process.env.SHOTS ? 2 : 1;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARG = liste('VUES', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const ONGLETS = liste('ONGLETS', 'envoyes,envoyer,toutes');
const MUTATION = process.env.MUTATION || '';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } return c; };
const attendre = async (pg, f, ms = 30000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(f, arg).catch(() => false)) return true; await pg.waitForTimeout(300); } return false; };

// Des titres de paires comme les siens (longs, en minuscules, la couleur en entier) — inventés.
const TITRES = ['adidas handball spezial bleu marine', 'Nike Air Force 1 \'07 blanche cuir', 'New Balance 550 white green', 'Asics Gel-1130 silver cream',
  'Nike Dunk Low Panda noir et blanc', 'adidas Samba OG cloud white gum', 'Salomon XT-6 black phantom', 'Nike Air Max 90 infrared',
  'Veja Campo extra white natural', 'New Balance 2002R rain cloud', 'adidas Gazelle Indoor bleu', 'Nike Air Jordan 1 Mid chicago'];
const SANS_PHOTO = new Set(), PHOTO_TXN = new Set();
function baseRangee() {
  const b = base();
  for (const r of b.rows) {
    if (!/_orders_sold$/.test(r.id)) continue;
    const sold = (r.data && r.data.payload && r.data.payload.my_orders) || [];
    sold.forEach((o, i) => {
      o.title = TITRES[(i + Number(o.transaction_id)) % TITRES.length] + (i % 3 ? '' : ' taille ' + (38 + (i % 8)));
      o.size_title = String(38 + (i % 8));
      // Comme sa vraie liste : la plupart des ventes n'ont PAS de photo dans `orders_sold` ; elle vit dans SA transaction.
      if (i % 5 === 4) { delete o.photo; SANS_PHOTO.add(String(o.transaction_id)); }
      else if (i % 5 !== 0) { const ph = o.photo; delete o.photo; PHOTO_TXN.add(String(o.transaction_id));
        const t = b.rows.find((x) => x.id === r.id.replace(/_orders_sold$/, '_txn_' + o.transaction_id));
        if (t && t.data && t.data.payload && t.data.payload.transaction) t.data.payload.transaction.order = { items: [{ photos: [{ url: ph.url.replace('/v.jpeg', '/t.jpeg') }] }] };
        else { PHOTO_TXN.delete(String(o.transaction_id)); SANS_PHOTO.add(String(o.transaction_id)); } }
    });
  }
  // Plusieurs transporteurs, LUS sur l'étiquette (`transporteurPdf`, comme la passe des PDF) : Mondial Relay, Relais Colis, Colissimo, Chronopost.
  const TR = ['Mondial Relay', 'Relais Colis', 'Colissimo', 'Chronopost'];
  let k = 0; for (const r of b.rows) if (/^email_bord_/.test(r.id) && r.data) r.data.transporteurPdf = TR[k++ % TR.length];
  return b;
}

function mesure() {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; if (e.closest('[hidden], [aria-hidden="true"], .n-lu-seul, .v2-cache')) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const R = (e) => e.getBoundingClientRect();
  const dans = (a, b) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;
  // Rogné par un parent qui coupe (overflow ≠ visible) ?
  const rogne = (e, jusqua) => { const r = R(e); for (let p = e.parentElement; p && p !== jusqua.parentElement; p = p.parentElement) { const cs = getComputedStyle(p); if (/hidden|clip|auto|scroll/.test(cs.overflow + cs.overflowX + cs.overflowY) && !dans(r, R(p))) return true; } return false; };
  const MOTS = /(?<!\p{L})(En route|Livrée?|Terminée|Au relais|Remboursée?|Commande finalisée|À expédier)(?!\p{L})/giu;
  const rangs = [...document.querySelectorAll('.vrm-main [data-vn-rang], .vrm-main [data-vn-route], .vrm-main [data-toutes-vente]')].filter((r) => r.classList.contains('n-rangee')).filter(vis).filter((r) => !r.closest('[role="dialog"], .n-feuille'));
  const out = rangs.slice(0, 40).map((r) => {
    const rr = R(r);
    const t = r.querySelector('.n-rangee-titre');
    const corps = r.querySelector('.n-rangee-corps');
    const texte = [...r.querySelectorAll('.n-rangee-corps *')].filter((e) => !e.children.length && vis(e)).map((e) => e.textContent).join(' ');
    const mots = (texte.match(MOTS) || []).map((x) => x.toLowerCase());
    const sous = r.querySelector('.n-rangee-sous');
    const morceaux = sous ? [...sous.querySelectorAll('*')].filter((e) => !e.children.length && /\S/.test(e.textContent) && vis(e)) : [];
    const coupes = morceaux.filter((e) => e.scrollWidth > e.clientWidth + 1 || getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth || rogne(e, r) || e.getClientRects().length > 1).map((e) => e.textContent.trim() + '[' + [e.scrollWidth > e.clientWidth + 1 ? 'w' : '', rogne(e, r) ? 'r' : '', e.getClientRects().length > 1 ? 'l' : ''].join('') + ']');
    const logos = [...r.querySelectorAll('[data-vt-transporteur] [data-transporteur-logo], [data-vt-transporteur] svg')].filter((e) => e.getClientRects().length);
    const logo = logos[0] || null;
    const logoEntier = logo ? (dans(R(logo), rr) && !rogne(logo, r) && R(logo).width >= 14) : null;
    const gestes = [...r.querySelectorAll('[data-vt-relier], [data-vt-plus-prix], [data-vt-prix-champ]')].filter(vis).length;
    const balayage = [...r.querySelectorAll('.n-rangee-action')].map((b) => b.textContent.trim());
    const v = r.querySelector('.n-vignette');
    const img = v && (v.tagName === 'IMG' ? v : v.querySelector('img'));
    const vide = v && v.matches('.n-vignette-vide, [data-n-sans-photo]') ? v : (v && v.querySelector('[data-photo-vinted="perdue"], [data-photo-vinted="attente"]'));
    const fond = vide ? getComputedStyle(vide).backgroundColor : '';
    const cle = r.getAttribute('data-vn-rang') || r.getAttribute('data-vn-route') || r.getAttribute('data-toutes-id') || '';
    return { cle: cle.replace(/^v:/, ''), h: Math.round(rr.height), w: Math.round(rr.width), tw: t ? Math.round(R(t).width) : 0, titre: t ? t.textContent.trim().slice(0, 40) : '', mots, coupes,
      logo: logo ? logoEntier : null, gestes, balayage, achat: r.getAttribute('data-vr-achat'), photo: !!(img && img.getAttribute('src')), vide: !!vide,
      videPlein: !!vide && !/rgba\(0, 0, 0, 0\)|transparent/.test(fond) && fond !== '', grise: !!(v && !img && !vide), corps: corps ? Math.round(R(corps).height) : 0 };
  });
  return { rangs: out, deb: document.documentElement.scrollWidth - innerWidth, tab: [...document.querySelectorAll('[data-vn="ventes"] [data-tt-ligne], [data-ventes-tableau] [data-tt-ligne]')].filter(vis).length,
    tabScroll: Math.max(0, ...[...document.querySelectorAll('[data-vn="ventes"] [data-tt-ligne]')].slice(0, 5).map((l) => { const s = l.closest('.n-tt-defile, [data-tt-defile]') || l.parentElement; return s ? s.scrollWidth - s.clientWidth : 0; })) };
}

async function ouvrirVentes(nav, { W, sombre, b }) {
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: W < 600 ? 390 : 1512, sombre, b, url: '/?tab=ventes', dsf: DSF });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  await attendre(pg, () => !!document.querySelector('[data-vn="ventes"]'), 40000);
  await pg.waitForTimeout(1500);
  if (MUTATION === 'logo') await pg.addStyleTag({ content: '.n-vr-meta, .n-vt-ligne { flex-wrap: nowrap !important; overflow: hidden !important; max-width: 150px !important; } .n-rangee-sous { overflow: hidden !important; }' });
  return { ctx, pg, erreurs };
}
async function onglet(pg, cle) {
  await pg.evaluate((c) => { const b = document.querySelector(`[data-colis-onglet-choix="${c}"]`); if (b) b.click(); }, cle);
  const sel = cle === 'envoyer' ? '[data-vn-rang]' : cle === 'envoyes' ? '[data-vn-route]' : '[data-toutes-vente], [data-ventes-tableau] [data-tt-ligne]';
  await attendre(pg, (s) => !!document.querySelector(s), 30000, sel);
  // Les photos des transactions arrivent après la liste (lecture projetée) : on leur laisse le temps.
  await pg.waitForTimeout(2500);
  await pg.evaluate(() => window.scrollTo(0, 0));
  await pg.waitForTimeout(300);
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const b = baseRangee();
  try {
    for (const W of LARG) for (const th of THEMES) {
      const tel = W < 600;
      const { ctx, pg, erreurs } = await ouvrirVentes(nav, { W, sombre: th === 'sombre', b });
      for (const og of (tel ? ONGLETS : ['envoyer', 'envoyes'])) {
        console.log(`\n── Ventes · ${og} · ${W} · ${th}${MUTATION ? ' · MUTATION ' + MUTATION : ''}`);
        await onglet(pg, og);
        await pg.screenshot({ path: path.join(SHOTS, `rangee-${og}-${W}-${th}.png`) });
        // Les rangées à partir de la 20ᵉ portent `content-visibility: auto` (natif.css) : hors de la fenêtre, rien n'est mis en page.
        // Pour juger CHAQUE rangée, on les fait mettre en page le temps de la mesure (la règle mesurée est la même).
        const cv = await pg.addStyleTag({ content: '.n-rangee { content-visibility: visible !important; }' });
        await pg.waitForTimeout(200);
        const m = await pg.evaluate(mesure);
        await cv.evaluate((e) => e.remove());
        dit(m.deb <= 1, `rien ne déborde de l'écran (${m.deb})`);
        if (!tel) { dit(m.tab > 3, `O le tableau de travail est rendu (${m.tab} lignes)`); dit(m.tabScroll <= 1, `O le tableau tient sans défilement de côté (${m.tabScroll})`); continue; }
        const rs = m.rangs;
        if (!dit(rs.length >= 4, `les ventes sont rendues (${rs.length})`)) continue;
        const hauts = rs.filter((x) => x.h > 104);
        dit(!hauts.length, `H chaque rangée ≤ 104 px (max ${Math.max(...rs.map((x) => x.h))} ; ${[...new Set(rs.map((x) => x.h))].join(', ')})`, hauts.slice(0, 4));
        const etroits = rs.filter((x) => x.tw < x.w * 0.5);
        dit(!etroits.length, `T le titre a ≥ 50 % de la largeur de la rangée (mini ${Math.min(...rs.map((x) => Math.round(100 * x.tw / x.w)))} %)`, etroits.slice(0, 3).map((x) => [x.titre, x.tw, x.w]));
        const coupes = rs.filter((x) => x.coupes.length);
        dit(!coupes.length, `T aucun morceau de la 2ᵉ ligne n'est rogné ni coupé (${coupes.length} rangées)`, coupes.slice(0, 3).map((x) => x.coupes));
        const avecLogo = rs.filter((x) => x.logo !== null);
        if (og !== 'toutes') dit(avecLogo.length >= 2, `L des transporteurs sont dessinés (${avecLogo.length} rangées)`);
        dit(avecLogo.every((x) => x.logo === true), `L le logo du transporteur est ENTIER dans sa rangée (${avecLogo.filter((x) => !x.logo).length} coupé)`, avecLogo.filter((x) => !x.logo).slice(0, 3).map((x) => x.titre));
        const doubles = rs.filter((x) => x.mots.length > 1);
        dit(!doubles.length, `D un seul mot d'état par rangée (${doubles.length} en double)`, doubles.slice(0, 3).map((x) => x.mots));
        const gestes = rs.filter((x) => x.gestes > 0);
        dit(!gestes.length, `R ni « Relier » ni « + prix » posés sur les rangées (${gestes.length} rangées en portent)`);
        const libres = rs.filter((x) => x.achat === 'libre'), connus = rs.filter((x) => x.achat === 'connu');
        dit(libres.length > 0 && libres.every((x) => x.balayage.some((a) => /relier/i.test(a))), `R une vente SANS achat garde « Relier » au balayage (${libres.length})`);
        dit(connus.every((x) => !x.balayage.some((a) => /relier|prix d/i.test(a))), `R une vente AU prix connu n'a ni « Relier » ni « Prix d'achat » (${connus.length})`);
        const txnSeule = rs.filter((x) => PHOTO_TXN.has(x.cle));
        if (og !== 'toutes' || txnSeule.length) dit(txnSeule.length > 0 && txnSeule.every((x) => x.photo), `P la photo lue dans SA transaction est montrée (${txnSeule.filter((x) => x.photo).length}/${txnSeule.length})`, txnSeule.filter((x) => !x.photo).slice(0, 3).map((x) => x.titre));
        const pleins = rs.filter((x) => x.videPlein);
        dit(!pleins.length, `P sans photo : un repli discret, jamais un carré plein (${rs.filter((x) => x.vide).length} sans photo, ${pleins.length} pleins)`);
      }
      if (tel) {
        // La fiche d'une vente SANS achat (En route) : « Relier » et le champ « Prix d'achat » y sont.
        await onglet(pg, 'envoyes');
        const cible = await pg.evaluate(() => { const r = [...document.querySelectorAll('[data-vn-route][data-vr-achat="libre"]')][0]; return r ? r.getAttribute('data-vn-route') : ''; });
        if (cible) {
          await pg.locator(`[data-vn-route="${cible}"] .n-rangee-corps`).first().click();
          await attendre(pg, () => !!document.querySelector('[data-vn-gestes] [data-vn-geste="prix-achat"]'), 8000);
          const f = await pg.evaluate(() => ({ relier: !!document.querySelector('[data-vn-gestes] [data-vn-geste="relier-achat"]'), prix: !!document.querySelector('[data-vn-gestes] [data-vn-geste="prix-achat"] [data-vt-prix-champ]') }));
          await pg.screenshot({ path: path.join(SHOTS, `rangee-fiche-${W}-${th}.png`) });
          dit(f.relier && f.prix, `R la fiche d'une vente sans achat porte « Relier » et le champ « Prix d'achat »`, f);
        } else dit(MUTATION !== '', 'R une vente sans achat dans « En route »');
      }
      dit(!erreurs.length, 'aucune erreur de page', erreurs.slice(0, 3));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a rencontré une erreur', String(e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();

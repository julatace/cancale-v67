require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  « AUJOURD'HUI », PROPRE ET UTILE (19 nov.) — l'app RENDUE, base INVENTÉE qui REPRODUIT la capture de Julien.
//  Décisions du 19 nov. (mot pour mot) : « le visuel de l'app doit être absolument parfait » ; « tout ça ne sert à
//  rien, ça doit être rangé dans les onglets dédiés justement à ça […] il y a d'autres choses plus intéressantes pour
//  cet onglet » ; « l'outil doit être pratique, pas chiant ». Récit : docs/passation/2026-11-19-aujourdhui-propre.md.
//
//  LA BASE « capture » (aucune donnée réelle : `_base-volume`, un compte) : 50 ventes dont 8 à envoyer (5 bordereaux
//  prêts, 3 pas prêts, 2 pressés par une limite LUE), 2 ventes au prix illisible (« pas su »), 15 colis à retirer à
//  6 points dont un au nom très long, 19 messages à lire. `BASES=capture,volume,vide` ; `LARGEURS=390,1512,1280` ;
//  `THEMES=clair,sombre` ; `SHOTS=dossier` (les captures se REGARDENT) ; `DSF=2`.
//
//  LE FOND (mêmes sources qu'avant, rien de recalculé) :
//    F1  Aujourd'hui ne montre plus aucun groupe « À faire » ;
//    F2  chaque groupe publié se retrouve dans SON onglet (« À régler »), avec son geste, replié s'il ne presse pas ;
//    F3  la pastille d'un onglet = ce qu'elle comptait + un par groupe qu'elle ne comptait pas déjà ;
//    F4  les chiffres : le vendu de chaque jour et du mois = la somme des ventes SEMÉES (hors annulées, « au moins »
//        quand un prix n'est pas lu, « — » jamais 0 pour « pas su ») ; reçu, bénéfice, argent à venir = l'écran Argent ;
//    F5  « 3 pas encore prêts » (l'accord) ; le plein dit le nombre de bordereaux prêts ; les 5 dernières ventes ;
//    F6  au plus UNE alerte, et seulement pour une limite LUE (base « estimee » : aucune).
//  LE DESSIN (mesuré sur le rendu, à 390 × 844 tactile avec zone sûre, 1512 et 1280, clair et sombre) :
//    D1  la bande : aucune vignette n'en chevauche une autre, chaque plaque N° est ENTIÈRE et dans sa case, au plus un
//        signe d'urgence par vignette, le reste résumé « +N » (vignettes + N = le nombre de colis) ;
//    D2  la passe : le nom du point tient sur UNE ligne (ellipse), le code est centré dans sa zone ;
//    D3  la barre d'onglets : 5 onglets de MÊME largeur, chacun son libellé visible ; rien de lisible ni de touchable
//        sous elle (fin du contenu défilé ≤ haut de la barre) ;
//    D4  un seul bouton plein ; cibles ≥ 44 × 44 ; aucun texte coupé sans « … » ; rien ne déborde de l'écran ;
//    D5  contraste ≥ 4,5:1 (3:1 en gros) de chaque texte sur son fond RENDU (lu dans les pixels de la capture).
//  Preuve : rouge sur le build d'avant (`BANC_DIST=<dist de origin/main>`) ; mutations `MUTATION=bande|plaque|passe|
//  barre|sous|plein|contraste|job|pastille|chiffre` (chacune remet le défaut dans la page) ⇒ son contrôle rougit.
//  Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.TZ = 'Europe/Paris';   // les jours se comptent à Paris, comme dans la page (le fuseau du banc)
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { fabriquer } = require('./_base-volume.cjs');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-aujourdhui-propre');
const MUT = process.env.MUTATION || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const BASES = liste('BASES', 'capture,volume,vide'), LARGEURS = liste('LARGEURS', '390,1512,1280').map(Number), THEMES = liste('THEMES', 'clair,sombre');
const DSF = Number(process.env.DSF || 1);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };

// ── Les bases ────────────────────────────────────────────────────────────────
const J = 86400000;
const midi = () => { const d = new Date(); d.setHours(12, 0, 0, 0); if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1); return d.getTime(); };
const minuit = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const jjmmaaaa = (t, h) => { const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${h}`; };
function reglages(b) {
  const m = b.main[0].data; const at = '2026-11-01T10:00:00.000Z';
  m.vrm_bienvenue_vue = { at }; m.vrm_visite_vue = { at }; m.vrm_je_vends = { choix: 'sneakers', at };
  m.vrm_configuration = { etat: 'fait', at, statut: null, version: 1 }; m.vrm_plateformes_affichees = { sites: ['vinted', 'leboncoin', 'ebay'], at };
  m.vrm_parcours = { etat: 'fini', at }; m.vrm_bilan_minute = { vu: at, fin: 'vu' };
  const vus = {}; for (const a of b.accounts) vus[a.vinted_user_id] = Date.now() - 120000;
  b.rows.push({ id: 'ext_appareil_0123456789abcdef', data: { appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, ver: '5.393.0', code: '5.393.0', atMs: Date.now() - 60000, flux: {}, vus: { vinted: vus } } });
  return b;
}
// Les titres : des paires inventées, dont de très longs (rien ne doit se couper sans « … »).
const TITRES = ['Nike Air Max 1 bleu marine taille 44', 'Adidas Samba OG blanc vert taille 42', 'New Balance 550 gris taille 43', 'Salomon XT-6 gris clair taille 44,5',
  'Asics Gel-1130 argent bleu taille 41,5 — très bon état, boîte d’origine, semelles neuves', 'Vans Old Skool noir taille 40', 'Nike Dunk Low panda taille 45', 'Adidas Spezial marron taille 43 1/3'];
function baseCapture({ limites = 'lues' } = {}) {
  const b = reglages(fabriquer({ comptes: 1, qr: true }));
  const uid = b.accounts[0].vinted_user_id;
  const NOW = midi(), M0 = minuit();
  const ligne = (re) => b.rows.find((r) => re.test(r.id));
  // 50 ventes ; ce qui dépasse part avec ses lignes (transaction, e-mail de bordereau).
  const sold = ligne(/_orders_sold$/); const ventes = sold.data.payload.my_orders;
  const retirees = new Set(ventes.slice(50).map((o) => String(o.transaction_id)));
  ventes.length = 50; sold.data.nItems = 50;
  b.rows = b.rows.filter((r) => { const m = /(?:_txn_|_label_|email_bord_)(\d+)$/.exec(r.id); return !m || !retirees.has(m[1]); });
  // Les 8 à envoyer (« Le paiement a été validé », rangs 3, 9, … 45) : vendus ces trois derniers jours, deux ce matin.
  const aEnvoyer = ventes.map((o, i) => [o, i]).filter(([o]) => o.status === 'Le paiement a été validé');
  aEnvoyer.forEach(([o, i], k) => {
    o.title = TITRES[k % TITRES.length];
    o.date = new Date(k < 2 ? M0 + (k + 1) * 5 * 60000 : NOW - (0.6 + k * 0.35) * J).toISOString();
    const t = b.rows.find((r) => r.id === `harvest_${uid}_txn_${o.transaction_id}`); if (t) t.data.payload.transaction.status_updated_at = o.date;
    const e = b.rows.find((r) => r.id === `email_bord_${o.transaction_id}`);
    // Les limites LUES dans l'e-mail du bordereau (« JJ/MM/AAAA HH h MM ») : une dépassée d'un jour, une ce soir, les
    // autres dans 3 à 5 jours. `limites: 'estimees'` : aucune limite lue (l'alerte ne doit alors RIEN dire).
    if (e) { e.data.receivedAt = o.date; e.data.numero = String(91 + k); e.data.dateLimite = limites === 'lues' ? jjmmaaaa(k === 0 ? M0 - J : k === 1 ? M0 : M0 + (2 + k) * J, k === 0 ? '10 h 00' : k === 1 ? '23 h 30' : '10 h 00') : ''; }
  });
  // « Pas su » : deux ventes finalisées de ce mois au prix illisible (jamais comptées 0 € : « au moins »).
  const illisibles = ventes.map((o, i) => [o, i]).filter(([o, i]) => o.status === 'Commande finalisée' && (i === 1 || i === 6)).map(([o]) => { o.price = { amount: '', currency_code: 'EUR' }; return o; });
  // 19 messages à lire.
  const inbox = ligne(/_inbox$/); inbox.data.payload.conversations.forEach((c, i) => { c.unread = i < 19; });
  // 15 colis à retirer, 6 points ; le premier (dernier jour) dans un point au nom très long.
  const POINTS = ['Relais Pickup Tabac-Presse du Marché Couvert de la Gare Centrale', 'Hyper Exemple Accueil', 'Consigne Exemple 24/7', 'Pressing des Lilas', 'Librairie du Port', 'Fleuriste Exemple'];
  b.rows.filter((r) => /^email_track_chronopost_/.test(r.id)).forEach((r, i) => {
    const d = r.data; if (i >= 15) return;
    d.status = 'available'; d.statusLabel = 'Arrivé au point de retrait'; d.subject = `Votre colis ${d.suivi} est disponible`;
    d.receivedAt = d.emailAt = new Date(NOW - (i % 4) * J).toISOString(); d.arriveLe = new Date(NOW - (i % 4) * J + 3600000).toISOString();
    d.code = String(416362 + i * 7919).slice(0, 6); d.lieu = `${POINTS[i % 6]}\n12 rue des Lilas\n35000 Rennes`;
    d.limite = new Date(NOW + (i === 0 ? 0 : 2 + (i % 5)) * J).toISOString();
  });
  b.attendu = { nEnvoyer: aEnvoyer.length, nPrets: aEnvoyer.filter(([o]) => b.rows.some((r) => r.id === `email_bord_${o.transaction_id}`)).length, nRetirer: 15, nPoints: 6, nMessages: 19, point: POINTS[0], illisibles: illisibles.length,
    ventes: ventes.map((o) => ({ ts: Date.parse(o.date), eur: o.price && o.price.amount !== '' ? Number(o.price.amount) : null, annulee: /Remboursement/.test(o.status) })) };
  return b;
}
// Le volume : trois comptes, 150 ventes, 30 colis à envoyer, 8 à retirer (la base du banc design-v2).
function baseVolume() { const b = P.base(); const q = fabriquer({ comptes: 3, qr: true }); b.rows.push(...q.rows.filter((r) => /^email_track_chronopost_/.test(r.id))); return b; }
// Vide : un compte relié qui n'a encore rien vendu ni acheté (le premier jour d'un vendeur neuf garde l'accueil d'avant).
function baseVide() {
  const b = reglages(fabriquer({ comptes: 1 }));
  for (const r of b.rows) { const p = r.data && r.data.payload; if (p && Array.isArray(p.my_orders)) { p.my_orders = []; r.data.nItems = 0; } if (p && Array.isArray(p.conversations)) p.conversations = []; }
  b.rows = b.rows.filter((r) => !/_txn_|_label_|^email_bord_|^email_track_|_conv_/.test(r.id));
  return b;
}

// ── Ouvrir un écran (design allumé, zone sûre de l'iPhone à 390) ──────────────
async function ouvrir(nav, { W, sombre, b, url = '/?tab=journee' }) {
  const { ctx, pg, erreurs } = await P.ouvrir(nav, { W: W < 600 ? 390 : 1512, sombre, b, url, dsf: DSF });
  if (W >= 600 && W !== 1512) await pg.setViewportSize({ width: W, height: 800 });
  if (W < 600) { try { const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } }); } catch (_) { /* Chromium sans cette commande : la zone sûre n'est pas simulée */ } }
  await pg.evaluate(() => { try { localStorage.setItem('vrm_design_v2', '1'); } catch (_) {} });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main, [data-n-page]', { timeout: 40000 }).catch(() => {});
  return { ctx, pg, erreurs };
}
const ECRAN = '[data-v2-ecran="aujourdhui"]';
async function attendreAujourdhui(pg) {
  await pg.waitForSelector(ECRAN, { timeout: 40000 }).catch(() => {});
  // Les lectures arrivent par vagues : on attend que l'écran soit prêt et que ses chiffres ne bougent plus.
  await pg.waitForFunction((s) => { const e = document.querySelector(s); return !!e && !e.hasAttribute('data-v2-attente') && !!e.querySelector('[data-v2-bloc="chiffres"]:not([data-v2-chiffres="encours"])'); }, ECRAN, { timeout: 45000 }).catch(() => {});
  let avant = '', egaux = 0;
  for (let k = 0; k < 16 && egaux < 2; k++) { await pg.waitForTimeout(1200); const s = await pg.evaluate((sel) => { const e = document.querySelector(sel); return e ? e.innerText : ''; }, ECRAN); if (s && s === avant) egaux++; else egaux = 0; avant = s; }
  await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {}); await pg.waitForTimeout(500);
}
const BARRE = '.n-onglets, .vrm-tabbar';
const ONGLET = '.n-onglet, [data-nav-entree]';

// Ce que l'écran montre (les data-* et les nombres rendus, jamais un libellé).
const LIRE = (sel) => { const e = document.querySelector(sel); if (!e) return null;
  const a = (x, n) => (x ? x.getAttribute(n) : null); const q = (s) => e.querySelector(s);
  const c = q('[data-v2-bloc="chiffres"]');
  return { blocs: [...e.querySelectorAll('[data-v2-bloc]')].map((b) => b.getAttribute('data-v2-bloc')), jobs: e.querySelectorAll('[data-v2-job], [data-v2-afaire], .v2-afaire-ligne, [data-v2-regler], [data-v2-regler-groupe]').length,
    affiche: a(e, 'data-v2-affiche'), ecart: a(q('[data-v2-ecart]'), 'data-v2-ecart') || '', plein: a(q('[data-v2-principal]'), 'data-v2-principal'),
    etat: a(c, 'data-v2-chiffres'), jour: a(c, 'data-v2-jour-vendu'), jourN: a(c, 'data-v2-jour-ventes'), semaine: (a(q('[data-v2-semaine]'), 'data-v2-semaine') || '').split(','),
    stats: (() => { try { return JSON.parse(a(c, 'data-v2-stats') || 'null'); } catch (_) { return null; } })(),
    mois: Object.fromEntries([...e.querySelectorAll('[data-v2-mois]')].map((m) => [m.getAttribute('data-v2-mois'), { cents: m.getAttribute('data-v2-mois-cents'), partiel: m.getAttribute('data-v2-mois-partiel') === '1', brut: m.getAttribute('data-v2-mois-brut') === '1', texte: m.textContent.trim() }])),
    colis: e.querySelectorAll('[data-v2-colis]').length, plus: Number(a(q('[data-v2-bande] [data-n-plus]'), 'data-n-plus') || 0),
    retirer: a(q('[data-v2-groupe="retirer"] [data-v2-n]'), 'data-v2-n'), lieu: a(q('[data-v2-passe-lieu]'), 'data-v2-passe-lieu') || '', code: a(q('[data-v2-passe-code]'), 'data-v2-passe-code') || '',
    ventes: [...e.querySelectorAll('[data-v2-vente]')].map((v) => v.getAttribute('data-v2-vente')), avenir: a(q('[data-v2-avenir]'), 'data-v2-avenir'),
    alerte: a(q('[data-v2-alerte]'), 'data-v2-alerte'), alertes: e.querySelectorAll('[data-v2-alerte]').length, texte: e.innerText }; };

// LE DESSIN, mesuré dans la page.
const DESSIN = (args) => { const [sel, selBarre, selOnglet] = args; const e = document.querySelector(sel); if (!e) return null;
  const vis = (x) => !!x && x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden' && Number(getComputedStyle(x).opacity) > 0;
  const R = (x) => { const r = x.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const coupe = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5;
  const dans = (a, b) => a.l >= b.l - 0.5 && a.r <= b.r + 0.5 && a.t >= b.t - 0.5 && a.b <= b.b + 0.5;
  const out = {};
  // D1. La bande.
  const cases = [...e.querySelectorAll('[data-v2-colis], [data-v2-bande] [data-n-plus]')].filter(vis);
  // La bande amenée au milieu de l'écran : une plaque se juge là où on la lit (pas sous la barre, pas hors de la vue).
  if (cases.length) cases[0].parentElement.scrollIntoView({ block: 'center' });
  const boites = cases.map(R); const chev = [];
  for (let i = 0; i < boites.length; i++) for (let j = i + 1; j < boites.length; j++) if (coupe(boites[i], boites[j])) chev.push([i, j]);
  // Les textes de la bande (plaques, « +N », dates) : aucune boîte de texte n'en chevauche une autre.
  const bande = cases.length ? cases[0].parentElement : null;
  const textes = bande ? [...bande.querySelectorAll('*')].filter(vis).filter((x) => [...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((x) => { const r = document.createRange(); r.selectNodeContents(x); const q = r.getBoundingClientRect(); const ov = getComputedStyle(x).overflow !== 'visible' ? x.getBoundingClientRect() : null; return { l: ov ? Math.max(q.left, ov.left) : q.left, t: q.top, r: ov ? Math.min(q.right, ov.right) : q.right, b: q.bottom, s: x.textContent.trim().slice(0, 12), el: x }; }) : [];
  const chevTextes = []; for (let i = 0; i < textes.length; i++) for (let j = i + 1; j < textes.length; j++) if (!textes[i].el.contains(textes[j].el) && !textes[j].el.contains(textes[i].el) && coupe(textes[i], textes[j])) chevTextes.push(textes[i].s + ' × ' + textes[j].s);
  const plaques = bande ? [...bande.querySelectorAll('.n-plaque, [data-v2-etiquette]')].filter(vis) : [];
  // Une plaque est ENTIÈRE si son contenu tient dans sa boîte, sa boîte dans sa case, sa case dans l'écran, et si le
  // point au centre de chaque chiffre est bien à elle (rien posé dessus).
  const plaquesKo = plaques.map((p) => { const c = p.closest('[data-v2-colis]'); const b = p.querySelector('.n-plaque-numero, b') || p; const rb = R(b), rp = R(p), rc = c ? R(c) : null;
    const haut = document.elementFromPoint((rb.l + rb.r) / 2, (rb.t + rb.b) / 2);
    // Le point au centre du numéro appartient à SA case (rien d'une autre case ni d'un autre bloc posé dessus).
    const okDessus = !!haut && (p.contains(haut) || (!!c && c.contains(haut)));
    const pourquoi = [!dans(rb, rp) && 'le numéro sort de sa plaque', rc && !dans(rp, rc) && 'la plaque sort de sa case', (rp.l < 0 || rp.r > innerWidth) && 'hors de l’écran', p.scrollWidth > p.clientWidth + 1 && 'rognée', !okDessus && 'recouverte'].filter(Boolean);
    return { n: (p.textContent || '').trim(), ko: pourquoi.length > 0, pourquoi }; }).filter((x) => x.ko).map((x) => x.n + ' : ' + x.pourquoi.join(', '));
  const urgences = cases.map((c) => c.querySelectorAll('[data-n-urgence], [data-v2-urgence], .v2-point').length);
  out.bande = { cases: cases.length, chev, chevTextes: chevTextes.slice(0, 6), plaques: plaques.length, plaquesKo, urgencesMax: Math.max(0, ...urgences), horsBande: bande ? boites.filter((b) => !dans(b, R(bande))).length : 0 };
  // D2. La passe.
  const lieu = (() => { const r = e.querySelector('[data-v2-passe-lieu]'); return r ? (r.querySelector('.n-rangee-titre') || r) : null; })(), code = (() => { const c = e.querySelector('[data-v2-passe-code]'); return c ? (c.querySelector('.n-code-texte') ? c : c) : null; })();
  { const m = e.closest('.vrm-main, [data-n-defile]') || document.scrollingElement; if (m) m.scrollTo(0, 0); }
  if (lieu) { const cs = getComputedStyle(lieu); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3; const r = document.createRange(); r.selectNodeContents(lieu);
    out.passe = { lignes: Math.round(lieu.getBoundingClientRect().height / lh), rects: new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size, ellipse: cs.textOverflow === 'ellipsis', coupe: lieu.scrollWidth > lieu.clientWidth + 1 };
    if (code) { const rc = R(code); const rr = document.createRange(); rr.selectNodeContents(code); const rt = rr.getBoundingClientRect(); const li = parseFloat(getComputedStyle(code).letterSpacing) || 0;
      out.passe.code = { decalage: Math.round(Math.abs(((rt.left + rt.right - li) / 2) - (rc.l + rc.r) / 2) * 10) / 10, largeur: Math.round(rc.w), part: Math.round((rt.width / rc.w) * 100) }; } }
  // D3. La barre d'onglets.
  const barre = [...document.querySelectorAll(selBarre)].find(vis);
  if (barre) { const tabs = [...barre.querySelectorAll(selOnglet)].filter(vis); const ws = tabs.map((t) => Math.round(R(t).w * 10) / 10);
    const libs = tabs.map((t) => { const l = [...t.querySelectorAll('span, b, small')].filter((x) => !x.closest('[aria-hidden="true"]') && !x.matches('.vrm-sr-seul, .n-sr, .n-lu-seul') && x.children.length === 0 && x.textContent.trim().length > 1)[0]; if (!l) return null; const q = R(l); const cs = getComputedStyle(l);
      return { t: l.textContent.trim(), vu: q.w > 4 && q.h > 4 && Number(cs.opacity) > 0.5 && l.scrollWidth <= l.clientWidth + 1 && q.l >= R(t).l - 1 && q.r <= R(t).r + 1, px: parseFloat(cs.fontSize) }; });
    out.barre = { n: tabs.length, ws, ecart: ws.length ? Math.round((Math.max(...ws) - Math.min(...ws)) * 10) / 10 : null, libs, haut: Math.round(R(barre).t), h: tabs.map((t) => Math.round(R(t).h)), bas: Math.round(innerHeight - R(barre).b) }; }
  // D4. Les pleins, les cibles, les textes coupés, le débordement.
  const boutons = [...e.querySelectorAll('button, a[href], [role="button"]')].filter(vis);
  out.pleins = [...document.querySelectorAll('[data-v2b="principal"], [data-v2-principal], [data-n-variante="plein"], .sb-btn-plein')].filter(vis).filter((x, i, l) => !l.some((y) => y !== x && y.contains(x))).length;
  out.petits = boutons.filter((b) => b.offsetWidth < 44 || b.offsetHeight < 44).map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 24) + ':' + b.offsetWidth + 'x' + b.offsetHeight);
  const porteurs = [...e.querySelectorAll('*')].filter(vis).filter((x) => [...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  out.coupes = porteurs.filter((x) => { const cs = getComputedStyle(x); return x.clientWidth > 0 && x.scrollWidth > x.clientWidth + 1 && /hidden|clip/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis'; }).map((x) => x.textContent.trim().slice(0, 30));
  out.deborde = Math.max(0, document.documentElement.scrollWidth - innerWidth);
  out.hors = porteurs.filter((x) => { const q = R(x); return q.r > innerWidth + 1 || q.l < -1; }).map((x) => x.textContent.trim().slice(0, 24)).slice(0, 5);
  return out; };

// D5 — LE CONTRASTE SUR LE FOND RENDU. La couleur du texte vient du style ; le fond est LU DANS LES PIXELS de la capture
// (le texte rendu transparent le temps d'une seconde capture : aucun fond « supposé », un dégradé ou une image comptent).
async function contrastes(pg, sel) {
  // Le décodeur PNG livré avec Playwright (aucune dépendance de plus).
  const { PNG } = (() => { try { return require(path.join(__dirname, '..', '..', 'node_modules', 'playwright-core', 'lib', 'utilsBundle')); } catch (_) { return {}; } })();
  if (!PNG) return { juges: 0, faibles: [{ t: 'décodeur PNG absent' }] };
  // Les fondus en cours (le titre de la barre qui revient à 0 après un défilement) finissent d'abord : on juge l'état posé.
  await pg.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))).catch(() => {});
  await pg.waitForTimeout(80);
  const textes = await pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return [];
    const vis = (x) => x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden';
    const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.textContent.trim(); if (t.length < 1) continue; const x = n.parentElement; if (!x || !vis(x) || x.closest('svg, [aria-hidden="true"] svg, .vrm-toasts, .vrm-sr-seul, .n-sr, .n-lu-seul, [data-v2-etiquette]') || (x.offsetWidth <= 2 && x.offsetHeight <= 2)) continue;
      if (!(e.contains(x) || x.closest('nav, header'))) continue;
      const r = document.createRange(); r.selectNodeContents(n); const q = r.getBoundingClientRect(); if (q.width < 3 || q.height < 3 || q.bottom <= 0 || q.top >= innerHeight || q.right <= 0 || q.left >= innerWidth) continue;
      const cs = getComputedStyle(x); let op = 1; for (let y = x; y; y = y.parentElement) op *= Number(getComputedStyle(y).opacity);
      if (x.closest('[disabled], [aria-disabled="true"]')) continue;
      // Un texte qu'on ne voit pas n'est pas lu : transparent (le titre réduit de la barre, en haut de page) ou RECOUVERT
      // (une rangée qui passe sous le plein collé) — c'est le fond de ce qui le recouvre qu'on lirait, pas le sien.
      if (op < 0.05) continue;
      const hx = document.elementFromPoint(Math.min(innerWidth - 1, q.left + q.width / 2), Math.min(innerHeight - 1, q.top + q.height / 2));
      if (!hx || !(hx === x || x.contains(hx) || hx.contains(x))) continue;
      const m = cs.color.match(/[\d.]+/g).map(Number); const px = parseFloat(cs.fontSize);
      out.push({ t: t.slice(0, 28), c: [m[0], m[1], m[2], (m.length > 3 ? m[3] : 1) * op], gros: px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700), px, q: [q.left, q.top, q.width, q.height] }); }
    return out; }, sel);
  const cache = await pg.addStyleTag({ content: '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } svg, img { visibility: hidden !important; }' });
  await pg.waitForTimeout(120);
  const png = PNG.sync.read(await pg.screenshot({ fullPage: false }));
  await cache.evaluate((n) => n.remove()).catch(() => {});
  const k = png.width / (await pg.evaluate(() => innerWidth));
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const faibles = []; let juges = 0, min = 99;
  for (const x of textes) {
    // Le fond sous le texte : la moyenne des pixels de sa boîte (texte effacé).
    const [l, t, w, h] = x.q; let r = 0, g = 0, bl = 0, n = 0;
    for (let yy = Math.max(0, Math.floor(t * k)); yy < Math.min(png.height, Math.ceil((t + h) * k)); yy += 2) for (let xx = Math.max(0, Math.floor(l * k)); xx < Math.min(png.width, Math.ceil((l + w) * k)); xx += 2) { const i = (yy * png.width + xx) * 4; r += png.data[i]; g += png.data[i + 1]; bl += png.data[i + 2]; n++; }
    if (!n) continue; const fond = [r / n, g / n, bl / n]; const a = x.c[3]; const texte = [0, 1, 2].map((i) => x.c[i] * a + fond[i] * (1 - a));
    const L1 = lum(texte), L2 = lum(fond); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); juges++; min = Math.min(min, ratio);
    if (ratio < (x.gros ? 3 : 4.5)) faibles.push({ t: x.t, r: Math.round(ratio * 100) / 100, px: x.px, c: x.c.slice(0, 3).map(Math.round).join(','), f: fond.map(Math.round).join(',') });
  }
  return { juges, min: Math.round(min * 100) / 100, faibles };
}

// Les mutations : le défaut d'hier remis DANS LA PAGE (le contrôle visé doit rougir).
async function muter(pg) {
  if (!MUT) return;
  const css = { bande: '[data-v2-colis] { margin-left: -34px !important; }', plaque: '[data-v2-colis] .n-plaque { transform: translateX(46px) !important; }',
    passe: '[data-v2-passe-lieu] .n-rangee-titre { white-space: normal !important; display: block !important; -webkit-line-clamp: unset !important; max-width: 90px !important; overflow: visible !important; }', barre: `${ONGLET}:first-child { flex: 3 1 0 !important; } :is(${BARRE}) ${ONGLET}:not(:first-child) span:not([aria-hidden]) { font-size: 0 !important; }`,
    sous: `:is(${BARRE}) { margin-top: -70px !important; position: relative; z-index: 5; }`, contraste: `${ECRAN} .n-affiche-libelle, ${ECRAN} .n-rangee-sous { color: rgb(150 160 175) !important; opacity: .45 !important; }` }[MUT];
  if (css) await pg.addStyleTag({ content: css });
  if (MUT === 'plein') await pg.evaluate((s) => { const p = document.querySelector(s + ' [data-v2-principal]'); if (p) { const c = p.cloneNode(true); c.removeAttribute('data-v2-principal'); p.parentElement.appendChild(c); } }, ECRAN);
  if (MUT === 'job') await pg.evaluate((s) => { const e = document.querySelector(s); if (e) { const d = document.createElement('div'); d.setAttribute('data-v2-job', 'x'); d.textContent = 'À faire'; e.appendChild(d); } }, ECRAN);
  if (MUT === 'pastille') await pg.evaluate((so) => { const b = document.querySelector(so + '[data-nav-entree="ventes"] [data-badge-n]'); if (b) { b.setAttribute('data-badge-n', String(Number(b.getAttribute('data-badge-n')) + 3)); } }, '');
  if (MUT === 'chiffre') await pg.evaluate((s) => { const c = document.querySelector(s + ' [data-v2-bloc="chiffres"]'); if (c) c.setAttribute('data-v2-jour-vendu', String(Number(c.getAttribute('data-v2-jour-vendu') || 0) + 100)); try { const S = JSON.parse(c.getAttribute('data-v2-stats')); S.semaine.vendu = String(Number(S.semaine.vendu || 0) + 100); S.mois.benefice = '1'; c.setAttribute('data-v2-stats', JSON.stringify(S)); } catch (_) {} const m = document.querySelector(s + ' [data-v2-mois="recu"]'); if (m) m.setAttribute('data-v2-mois-cents', '1'); }, ECRAN);
  await pg.waitForTimeout(300);
}

// Les sommes ATTENDUES, depuis les ventes semées (la règle de « Vendu » : hors annulées ; un prix illisible n'est pas
// 0 € — il rend la période « au moins », ou « — » si rien d'autre n'y est lu).
function attenduJours(ventes) {
  const m0 = minuit(); const jours = [6, 5, 4, 3, 2, 1, 0].map((k) => { const d = new Date(m0); d.setDate(d.getDate() - k); const f = new Date(d); f.setDate(f.getDate() + 1); return [d.getTime(), f.getTime()]; });
  const sur = (de, a) => { const l = ventes.filter((v) => !v.annulee && v.ts >= de && v.ts < a); const lus = l.filter((v) => v.eur != null); const cents = Math.round(lus.reduce((t, v) => t + v.eur * 100, 0)); return { cents, partiel: lus.length < l.length, n: l.length, nLus: lus.length }; };
  const d = new Date(); const de = new Date(d.getFullYear(), d.getMonth(), 1).getTime(), a = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  // (19 nov.) La semaine du calendrier (lundi 0 h → lundi suivant), comme la carte des chiffres et Argent.
  const lundi = new Date(m0); lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7)); const lundiApres = new Date(lundi); lundiApres.setDate(lundiApres.getDate() + 7);
  return { jours: jours.map(([x, y]) => sur(x, y)), semaine: sur(lundi.getTime(), lundiApres.getTime()), mois: sur(de, a) };
}
const DEJA = new Set(['colis-limite', 'poste-sans-depart', 'colis-en-retard', 'ebay-ne-pas-poster', 'vestiaire-envoyer', 'retrait-a-verifier', 'retrait-en-verification', 'retrait-dernier-jour', 'sans-numero', 'numeros-en-double', 'double-vente', 'completer']);

async function unEcran(nav, nomBase, b, W, sombre) {
  const th = sombre ? 'sombre' : 'clair'; const ou = `${nomBase} · ${W} · ${th}`;
  console.log(`\n── ${ou}`);
  const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre, b });
  try {
    await attendreAujourdhui(pg);
    const tel = W < 600;
    if (nomBase === 'vide') {
      const v = await pg.evaluate(LIRE, ECRAN);
      dit(!!v && v.jobs === 0 && !v.plein && v.colis === 0 && v.alertes === 0, `V ${ou} : rien à envoyer ni à retirer ⇒ ni bande, ni plein, ni alerte, ni liste « À faire »`, v && { blocs: v.blocs, plein: v.plein, colis: v.colis });
      dit(!!v && v.etat !== 'encours' && (v.jour === '' || v.jour === '0') && !/NaN|undefined|null/.test(v.texte), `V ${ou} : les chiffres disent 0 ou « — », jamais « NaN » ni un vide muet`, v && { etat: v.etat, jour: v.jour, mois: v.mois });
    } else {
      const v = await pg.evaluate(LIRE, ECRAN);
      if (!dit(!!v, `${ou} : Aujourd’hui est rendu`)) return;
      await muter(pg);
      const w = await pg.evaluate(LIRE, ECRAN);
      // ── LE FOND ──
      dit(w.jobs === 0 && !/À faire/.test(w.texte), `F1 ${ou} : aucun groupe « À faire » dans Aujourd’hui (décision du 19 nov.)`, { jobs: w.jobs });
      dit(w.blocs[0] === 'chiffres' && !w.blocs.includes('mois') && w.blocs.includes('envoyer') && w.blocs.includes('retirer') && w.blocs.includes('ventes'), `F5 ${ou} : les chiffres, À envoyer, À retirer, Dernières ventes — dans cet ordre`, w.blocs);
      dit(w.alertes <= 1, `F6 ${ou} : au plus UNE alerte (${w.alertes})`, w.alerte);
      if (nomBase === 'capture') {
        const A = b.attendu, X = attenduJours(A.ventes);
        dit(w.affiche === String(A.nEnvoyer) && w.plein === String(A.nPrets) && /3/.test(w.ecart) && /prêts\b/.test(w.ecart), `F5 ${ou} : ${A.nEnvoyer} colis à envoyer, « ${w.ecart} » (accordé), le plein dit ${A.nPrets} bordereaux`, { affiche: w.affiche, plein: w.plein, ecart: w.ecart });
        dit(w.retirer === String(A.nRetirer) && w.lieu === A.point && /^\d{6}$/.test(w.code), `F5 ${ou} : ${A.nRetirer} colis à retirer, la passe du premier point et son code`, { retirer: w.retirer, lieu: w.lieu, code: w.code });
        dit(w.ventes.length === 5 && new Set(w.ventes).size === 5, `F5 ${ou} : les 5 dernières ventes, chacune une fois`, w.ventes);
        // (19 nov., Julien : « plus de stats […] le CA, le bénéfice ») Jour · Semaine · Mois : CA vendu, ventes, panier =
        // les ventes SEMÉES (« au moins » quand un prix n'est pas lu, « — » pour un panier sur une partie des ventes).
        const S = w.stats || {};
        for (const [k, x] of [['jour', X.jours[6]], ['semaine', X.semaine], ['mois', X.mois]]) {
          const v = S[k] || {};
          const venduAttendu = x.cents === 0 && x.partiel ? '' : String(x.cents);
          // Une vente au prix illisible n'est pas une ligne de « Vendu » (`ventesFaites` la range à part) : le nombre est alors
          // celui des ventes lues, dit « au moins » — la règle du propriétaire, celle de l'écran Argent.
          dit(w.etat === 'lu' && v.vendu === venduAttendu && !!v.vp === x.partiel && v.ventes === String(x.nLus) && !!v.np === x.partiel, `F4 ${ou} : ${k} — vendu ${x.cents / 100} € en ${x.partiel ? 'au moins ' : ''}${x.nLus} ventes = les ventes semées`, { vu: v, attendu: x });
          const panier = x.partiel || !x.nLus ? '' : String(Math.round(Math.round((x.cents / 100 / x.nLus) * 100)));
          dit(v.panier === panier, `F4 ${ou} : ${k} — panier moyen ${panier ? Number(panier) / 100 + ' €' : '« — » (pas tout lu ou aucune vente)'}`, { vu: v.panier, attendu: panier });
        }
        dit(X.mois.partiel === true && !!S.mois && S.mois.vp === 1, `F4 ${ou} : le mois dit « au moins » (${A.illisibles} ventes au prix pas lu — jamais comptées 0 €)`, S.mois);
        dit(w.jour === String(X.jours[6].cents) && w.jourN === String(X.jours[6].n), `F4 ${ou} : vendu aujourd’hui = ${X.jours[6].cents / 100} € en ${X.jours[6].n} ventes`, { jour: w.jour, n: w.jourN });
        dit(w.alerte === 'poster', `F6 ${ou} : l’alerte est celle des colis à poster dont la limite est LUE`, w.alerte);
      }
      if (nomBase === 'estimee') dit(w.alerte !== 'poster', `F6 ${ou} : aucune limite lue ⇒ aucune alerte « à poster » (une date estimée ne presse jamais)`, w.alerte);
      // ── LE DESSIN ── dans l'app, il ne se juge qu'une fois la coque native branchée (`DESSIN_APP=1`) : tant que l'écran
      // natif vit dans la coque d'hier (ses habillages `!important` repeignent boutons et barre), il est jugé SEUL, dans la coque
      // native, par scripts/bancs/aujourdhui-natif.cjs — les mêmes mesures (`DESSIN`, `contrastes`).
      if (!process.env.DESSIN_APP) { dit(!erreurs.length, `${ou} : aucune erreur JS`, erreurs); await pg.screenshot({ path: path.join(SHOTS, `aujourdhui-${nomBase}-${W}-${th}.png`) }); await ctx.close(); return; }
      const d = await pg.evaluate(DESSIN, [ECRAN, BARRE, ONGLET]);
      dit(d.bande.cases >= 2 && !d.bande.chev.length && !d.bande.chevTextes.length && d.bande.horsBande === 0, `D1 ${ou} : ${d.bande.cases} vignettes, aucune n’en chevauche une autre, aucun texte superposé`, d.bande);
      dit(d.bande.plaques >= 1 && !d.bande.plaquesKo.length, `D1 ${ou} : ${d.bande.plaques} plaques N°, chacune ENTIÈRE dans sa case`, d.bande.plaquesKo);
      dit(d.bande.urgencesMax <= 1 && w.colis + w.plus === Number(w.affiche), `D1 ${ou} : au plus un signe d’urgence par vignette ; ${w.colis} vignettes + ${w.plus} résumées = ${w.affiche} colis`, { u: d.bande.urgencesMax, colis: w.colis, plus: w.plus });
      if (d.passe) { dit(d.passe.rects === 1 && d.passe.lignes === 1 && !(d.passe.coupe && !d.passe.ellipse), `D2 ${ou} : le nom du point tient sur UNE ligne${d.passe.coupe ? ' (ellipse)' : ''}`, d.passe);
        if (d.passe.code) dit(d.passe.code.decalage <= 2, `D2 ${ou} : le code est centré dans sa zone (écart ${d.passe.code.decalage} px, ${d.passe.code.part} % de la largeur)`, d.passe.code); }
      else dit(false, `D2 ${ou} : la passe « À retirer » est rendue`);
      if (tel) {
        dit(!!d.barre && d.barre.n === 5 && d.barre.ecart <= 1, `D3 ${ou} : 5 onglets de MÊME largeur (${d.barre ? d.barre.ws.join(' · ') : '—'})`, d.barre && d.barre.ws);
        dit(!!d.barre && d.barre.libs.every((l) => l && l.vu) && d.barre.h.every((h) => h >= 44), `D3 ${ou} : chaque onglet a son libellé visible, cibles ≥ 44`, d.barre && { libs: d.barre.libs, h: d.barre.h });
        // Rien de lisible ni de touchable SOUS la barre : au repos et défilé tout en bas.
        const sous = await pg.evaluate(async (args) => { const [sel, selBarre] = args; const vis = (x) => x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden';
          const barre = [...document.querySelectorAll(selBarre)].find(vis); if (!barre) return null; const hb = barre.getBoundingClientRect().top;
          const dessous = () => { const e = document.querySelector(sel); const l = [];
            for (const x of e.querySelectorAll('button, a[href], [data-v2-etiquette], img')) { if (!vis(x)) continue; const q = x.getBoundingClientRect(); if (q.top < innerHeight && q.bottom > hb + 1 && q.top < innerHeight) { const y = Math.max(q.top, hb + 1) + 1; if (y < Math.min(q.bottom, innerHeight) ) { const h = document.elementFromPoint(Math.min(innerWidth - 2, Math.max(2, q.left + q.width / 2)), Math.min(innerHeight - 2, y)); if (h && (x === h || x.contains(h))) l.push((x.getAttribute('aria-label') || x.textContent || x.tagName).trim().slice(0, 20)); } } }
            // Le voile : un pseudo-élément de la barre qui déborde au-dessus d'elle couvre le contenu.
            const av = getComputedStyle(barre, '::before'); const voile = av.content !== 'none' && av.display !== 'none' && parseFloat(av.top) < -8 && av.backgroundImage !== 'none';
            return { l, voile }; };
          const repos = dessous(); const m = [...document.querySelectorAll('.vrm-main, [data-n-defile]')].find(vis) || document.scrollingElement; m.scrollTo(0, m.scrollHeight); await new Promise((r) => setTimeout(r, 450));
          const e = document.querySelector(sel); const enf = [...e.querySelectorAll('[data-v2-bloc], [data-v2-rien]')].filter(vis); const fin = enf.length ? Math.max(...enf.map((x) => x.getBoundingClientRect().bottom)) : null;
          const bas = dessous(); m.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 250));
          return { repos, bas, fin: fin == null ? null : Math.round(fin), barre: Math.round(hb), sur: barre.getBoundingClientRect().bottom <= innerHeight + 1 }; }, [ECRAN, BARRE]);
        dit(!!sous && !sous.repos.l.length && !sous.bas.l.length && !sous.repos.voile && sous.fin != null && sous.fin <= sous.barre, `D3 ${ou} : rien de lisible ni de touchable sous la barre (fin du contenu ${sous && sous.fin} ≤ barre ${sous && sous.barre})`, sous);
      }
      dit(d.pleins === 1, `D4 ${ou} : UN seul bouton plein (${d.pleins})`, d.pleins);
      dit(!d.petits.length, `D4 ${ou} : toutes les cibles ≥ 44 × 44`, d.petits);
      dit(!d.coupes.length && d.deborde <= 1 && !d.hors.length, `D4 ${ou} : aucun texte coupé sans « … », rien ne déborde`, { coupes: d.coupes, deborde: d.deborde, hors: d.hors });
      const c = await contrastes(pg, ECRAN);
      dit(c.juges > 15 && !c.faibles.length, `D5 ${ou} : ${c.juges} textes ≥ 4,5:1 sur leur fond RENDU (min ${c.min})`, c.faibles ? c.faibles.slice(0, 5) : c);
    }
    dit(!erreurs.length, `${ou} : aucune erreur JS`, erreurs);
    await pg.screenshot({ path: path.join(SHOTS, `aujourdhui-${nomBase}-${W}-${th}.png`) });
  } catch (e) { dit(false, `${ou} : le contrôle est allé au bout`, String(e && e.stack || e).slice(0, 600)); }
  await ctx.close();
}

// F2, F3, F4 (Argent) — les onglets : chaque groupe publié est dans SON onglet avec son geste ; les pastilles ; Argent.
async function onglets(nav, b, sombre) {
  const th = sombre ? 'sombre' : 'clair';
  console.log(`\n── les onglets · 390 · ${th}`);
  const { ctx, pg, erreurs } = await ouvrir(nav, { W: 390, sombre, b });
  try {
    await attendreAujourdhui(pg);
    const lire = () => pg.evaluate((args) => { const [selBarre, selOnglet] = args; const vis = (x) => x.getClientRects().length > 0;
      const pub = (() => { try { const k = Object.keys(localStorage).find((x) => x.startsWith('vrm_a_regler_v1')); return k ? JSON.parse(localStorage.getItem(k)).g : null; } catch (_) { return null; } })();
      const barre = [...document.querySelectorAll(selBarre)].find(vis);
      const pastilles = barre ? Object.fromEntries([...barre.querySelectorAll(selOnglet)].map((t) => [t.getAttribute('data-nav-entree'), (t.querySelector('[data-badge-n]') || { getAttribute: () => '' }).getAttribute('data-badge-n')])) : null;
      const blocs = [...document.querySelectorAll('[data-v2-regler]')].filter(vis).map((x) => ({ onglet: x.getAttribute('data-v2-regler'), n: Number(x.getAttribute('data-v2-regler-n')), ouvert: x.getAttribute('data-v2-regler-ouvert') === '1', presse: x.getAttribute('data-v2-regler-presse') === '1',
        haut: Math.round(x.getBoundingClientRect().top), groupes: [...x.querySelectorAll('[data-v2-regler-groupe]')].map((g) => ({ id: g.getAttribute('data-v2-regler-groupe'), bouton: g.tagName === 'BUTTON' || !!g.closest('button') || !!g.querySelector('button'), ambre: g.getAttribute('data-v2-regler-ambre') === '1' })) }));
      return { pub, pastilles, blocs, titre: (document.querySelector('h1') || { getBoundingClientRect: () => ({ bottom: 0 }) }).getBoundingClientRect().bottom }; }, [BARRE, ONGLET]);
    const depart = await lire();
    if (!dit(Array.isArray(depart.pub) && depart.pub.length >= 3, `F2 Aujourd’hui a publié ses groupes (${depart.pub ? depart.pub.map((g) => g.id + '→' + g.onglet).join(', ') : 'rien'})`, depart.pub)) { await ctx.close(); return; }
    const racine = (id) => String(id).split(':')[0];
    const parOnglet = (o) => depart.pub.filter((g) => g.onglet === o);
    // Les pastilles AVANT (ce qu'elles comptaient) se lisent des blocs À envoyer / À retirer d'Aujourd'hui.
    const auj = await pg.evaluate(LIRE, ECRAN);
    if (MUT === 'pastille') await muter(pg);
    const p = (await lire()).pastilles || {};
    const ajout = (o) => { const l = parOnglet(o); const comp = o === 'annonces' && l.some((g) => ['sans-numero', 'prix-mini-manquants', 'achat-a-relier'].includes(racine(g.id))); return l.filter((g) => !DEJA.has(racine(g.id)) && !['sans-numero', 'prix-mini-manquants', 'achat-a-relier'].includes(racine(g.id))).length + (comp ? 0 : 0); };
    dit(Number(p.ventes || 0) === Number(auj.affiche) + ajout('ventes'), `F3 pastille de Ventes (${p.ventes}) = ${auj.affiche} colis à envoyer + ${ajout('ventes')} groupe(s) à régler pas déjà comptés`, { p: p.ventes, groupes: parOnglet('ventes').map((g) => g.id) });
    dit(Number(p.achats || 0) === Number(auj.retirer) + ajout('achats'), `F3 pastille d’Achats (${p.achats}) = ${auj.retirer} colis à retirer + ${ajout('achats')} groupe(s)`, { p: p.achats, groupes: parOnglet('achats').map((g) => g.id) });
    for (const [onglet, entree] of [['ventes', 'ventes'], ['achats', 'achats'], ['annonces', 'paires']]) {
      const attendus = parOnglet(onglet);
      await pg.locator(`:is(${BARRE}) [data-nav-entree="${entree}"]`).first().tap({ timeout: 8000 }).catch(() => {});
      await pg.waitForSelector(`[data-v2-regler="${onglet}"]`, { timeout: 25000 }).catch(() => {}); await pg.waitForTimeout(1500);
      let x = (await lire()).blocs.find((k) => k.onglet === onglet);
      if (!attendus.length) { dit(!x, `F2 ${onglet} : aucun groupe publié ⇒ aucun bloc (pas de carte vide)`, x); continue; }
      if (!dit(!!x, `F2 ${onglet} : le bloc « À régler » est en tête de l’onglet`, { attendus: attendus.map((g) => g.id) })) continue;
      const presse = attendus.some((g) => g.ambre && !['sans-numero', 'prix-mini-manquants', 'achat-a-relier'].includes(racine(g.id)));
      dit(x.ouvert === presse && x.presse === presse, `F2 ${onglet} : ${presse ? 'ouvert (un groupe presse)' : 'replié par défaut (rien ne presse) — une ligne, pas une pile de reproches'}`, { ouvert: x.ouvert, presse: x.presse });
      await pg.screenshot({ path: path.join(SHOTS, `a-regler-${onglet}-390-${th}.png`) });
      if (!x.ouvert) { await pg.locator(`[data-v2-regler="${onglet}"] .n-groupe-repli`).first().tap({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(500); x = (await lire()).blocs.find((k) => k.onglet === onglet) || x; }
      const tout = pg.locator(`[data-v2-regler="${onglet}"] [data-v2-regler-tout="0"]`).first(); if (await tout.count()) { await tout.tap({ timeout: 5000 }).catch(() => {}); await pg.waitForTimeout(400); x = (await lire()).blocs.find((k) => k.onglet === onglet) || x; }
      const ids = x.groupes.map((g) => racine(g.id));
      const voulus = [...new Set(attendus.map((g) => (['sans-numero', 'prix-mini-manquants', 'achat-a-relier'].includes(racine(g.id)) ? 'completer' : racine(g.id))))];
      dit(voulus.every((id) => ids.includes(id)) && x.n === voulus.length + (attendus.length - new Set(attendus.map((g) => racine(g.id))).size), `F2 ${onglet} : chaque groupe publié y est (${voulus.join(', ')})`, { vus: ids, n: x.n });
      dit(x.groupes.every((g) => g.bouton), `F2 ${onglet} : chaque rangée porte son geste (elle se touche)`, x.groupes);
      if (onglet === 'annonces') dit(ids.filter((i) => ['sans-numero', 'prix-mini-manquants', 'achat-a-relier'].includes(i)).length === 0, 'F2 annonces : « sans numéro / prix mini / prix d’achat » = UNE rangée « Compléter », pas trois', ids);
      await pg.screenshot({ path: path.join(SHOTS, `a-regler-${onglet}-ouvert-390-${th}.png`) });
    }
    // Un geste : la rangée « colis pressés » de Ventes fait ce que faisait la carte (elle reste dans Ventes, sur les colis).
    // F4 — Argent : reçu, bénéfice, argent à venir du mois = ceux d'Aujourd'hui.
    await pg.locator(`:is(${BARRE}) [data-nav-entree="compta"]`).first().tap({ timeout: 8000 }).catch(() => {});
    await pg.waitForSelector('[data-v2-argent-recu]', { timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(2500);
    const ar = await pg.evaluate(() => { const a = (s, n) => { const e = document.querySelector(s); return e ? e.getAttribute(n) : null; };
      return { recu: a('[data-v2-argent-recu]', 'data-v2-argent-recu'), partiel: a('[data-v2-argent-recu]', 'data-v2-argent-partiel') === '1', benefice: a('[data-v2-argent-fait="benefice"]', 'data-v2-argent-valeur'), attente: a('[data-v2-argent-fait="attente"]', 'data-v2-argent-valeur') }; });
    const mo = auj.stats && auj.stats.mois ? auj.stats.mois : {};
    dit((mo.benefice != null ? mo.benefice : null) === (ar.benefice || ''), `F4 bénéfice du mois : Aujourd’hui (${mo.benefice}) = Argent (${ar.benefice})`, { auj: mo, argent: ar.benefice });
    dit(!auj.avenir && !auj.mois.recu, 'F4 « Reçu » et « Argent à venir » sont dans Argent, plus sur Aujourd’hui (19 nov.)', { avenir: auj.avenir, recu: auj.mois.recu });
    dit(!erreurs.length, 'les onglets : aucune erreur JS', erreurs);
  } catch (e) { dit(false, 'les onglets : le contrôle est allé au bout', String(e && e.stack || e).slice(0, 600)); }
  await ctx.close();
}

module.exports = { baseCapture, baseVolume, baseVide, LIRE, DESSIN, contrastes, ECRAN, BARRE, ONGLET };
if (require.main !== module) return;
fs.mkdirSync(SHOTS, { recursive: true });
(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const FAB = { capture: () => baseCapture(), estimee: () => baseCapture({ limites: 'estimees' }), volume: baseVolume, vide: baseVide };
  try {
    for (const nomBase of BASES) { if (!FAB[nomBase]) continue;
      for (const W of LARGEURS) for (const t of THEMES) await unEcran(nav, nomBase, FAB[nomBase](), W, t === 'sombre'); }
    if (BASES.includes('capture') && !process.env.SANS_ONGLETS) for (const t of THEMES) await onglets(nav, baseCapture(), t === 'sombre');
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1200)); }
  await nav.close(); P.srv.close();
  console.log(`\n${ko ? '❌' : '✅'} aujourdhui-propre${MUT ? ' [MUTATION=' + MUT + ']' : ''} : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();

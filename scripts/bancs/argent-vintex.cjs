require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  ARGENT · MOIS « COMME VINTEX » (21 nov., lot argent-vintex) — docs/passation/2026-11-21-argent-vintex.md
//      npm run build && BANC_PORT=4791 node scripts/bancs/argent-vintex.cjs
//  Julien, 21 nov. (captures iPhone d'Argent) : « refonds toute l'application dans le style de Vintex, pratique, bien
//  compréhensible ». Base INVENTÉE (aucune donnée réelle) : `volume` d'aujourdhui-propre (3 comptes, 150 ventes) + la
//  ligne du CA déclaré à sa forme (comme argent-natif). Tailles : 390 tactile à zone sûre, 1512 ; clair et sombre.
//  Ce qui est MESURÉ sur Argent · Mois (data-* et boîtes rendues, jamais un libellé) :
//    M  chaque montant (tout texte avec « € » de Mois) est ENTIER : ni coupé en largeur, ni rogné par un parent
//       (overflow), ni en « … » ;
//    P  les prix d'achat : UN seul élément visible parle des prix d'achat / coûts, et ses nombres sont ceux de la règle
//       (manquent = n − nCout, sur n ; lus dans `data-v2-argent-fait="couts"` = « nCout/n ») — sur origin/main, le plein
//       « Saisir 13 prix d'achat » et « 2 sur 15 coûts saisis » sont DEUX éléments aux nombres différents ⇒ rouge ;
//       aucun bouton plein dans Mois ;
//    L  la phrase du reçu tient en UNE ligne (deux s'il y a un manque à nommer) ;
//    V  les six mois portent chacun leur montant écrit (ou « — ») ;
//    K  « Comptes · N » est une rangée DANS une carte (plus un lien qui flotte) ;
//    T  versements : le montant et « acheté X € » de chaque rangée sont lisibles en entier ;
//    X  la page ne déborde pas ; cibles ≥ 44 au doigt ;
//    N  LES CHIFFRES NE CHANGENT PAS : le relevé des data-* chiffrés de Mois (reçu, six mois, vendu, bénéfice, en attente,
//       disponible, couverture, geste, comptes, chaque versement montré : montant, achat, marge) est identique à celui du
//       build de référence (`BANC_REFERENCE=f`, écrit par `BANC_JSON=f` sur le build d'avant, `BANC_DIST=…`).
//  `SHOTS=dossier` garde les captures (regarde-les). Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
const P = require('./design-passe.cjs');
const { baseVolume } = require('./aujourdhui-propre.cjs');
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-argent-vintex');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const TAILLES = liste('TAILLES', '390,1512'), THEMES = liste('THEMES', 'clair,sombre');
const JSON_OUT = process.env.BANC_JSON || '';
const REF = process.env.BANC_REFERENCE ? JSON.parse(fs.readFileSync(process.env.BANC_REFERENCE, 'utf8')) : null;
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700) : '')); } return c; };
const releve = {};

// La base de Julien en forme (inventée) : micro-entrepreneur mensuel, la ligne du CA déclaré publiée (comme argent-natif).
const micro = (b) => { const m = b.main[0].data; m.vinted_regime = 'micro'; m.vinted_urssaf_freq = 'mensuel'; m.vrm_urssaf_declare = {};
  // Deux prix d'achat saisis (comme sa capture : « 2 sur 15 ») : sans eux, l'ancien écran ne montrait pas la couverture
  // à côté du plein et la contradiction ne se jouait pas. Inventés, par N° (`vinted_buyprice_by_num`, sa saisie).
  m.vinted_buyprice_by_num = { 1: 10, 4: 20 };
  const mois = [], recu = {}; const d = new Date(); d.setDate(1);
  for (let k = 0; k < 7; k++) { const ym = d.toISOString().slice(0, 7); const ca = [1840.5, 2604.2, 15070.84, 1988, 2210.4, 1760, 2390][k]; mois.push({ ym, n: 20 + k * 3, ca, nMasq: 0, caMasq: 0, par: { Vinted: { n: 18 + k * 3, ca: ca - 120 }, Leboncoin: { n: 2, ca: 120 } }, nApres: 0, caApres: 0, nDouble: 0, caDouble: 0, nAilleurs: 0, caAilleurs: 0, declare: null }); recu[ym] = ca; d.setMonth(d.getMonth() - 1); }
  m.vinted_urssaf_mois = { mois, aDater: null, ecartees: 0, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'lu' }, declare: {}, recu, recuJours: {}, nonComptees: { n: 0, par: {}, parC: {} }, at: Date.now() };
  return b; };

async function ouvrir(nav, { taille, sombre, b, url }) {
  const W = Number(taille);
  const { ctx, pg, erreurs } = await P.ouvrir(nav, { W: W < 600 ? 390 : 1512, sombre, b, url });
  if (W < 600) { try { const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } }); } catch (_) {} }
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {});
  return { ctx, pg, erreurs };
}
async function calme(pg) {
  let avant = '', egaux = 0;
  for (let k = 0; k < 18 && egaux < 2; k++) { await pg.waitForTimeout(1200); const s = await pg.evaluate(() => { const e = document.querySelector('.vrm-main'); return e ? e.innerText : ''; }); if (s && s === avant) egaux++; else egaux = 0; avant = s; }
  await pg.evaluate(() => { for (const t of document.querySelectorAll('.vrm-toast')) t.click(); }).catch(() => {});
  await pg.waitForTimeout(400);
}
const defile = (pg, y) => pg.evaluate((y) => { const m = document.querySelector('.vrm-main'); const s = m && m.scrollHeight > m.clientHeight + 4 && getComputedStyle(m).overflowY !== 'visible' ? m : document.scrollingElement; s.scrollTop = y; return s.scrollTop; }, y);

const MESURE = () => {
  const main = document.querySelector('.vrm-main'); const sec = document.querySelector('[data-v2-argent-mois]');
  if (!main || !sec) return null;
  const vu = (e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; for (let x = e; x; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || x.hidden) return false; } return true; };
  const feuilles = (racine) => [...racine.querySelectorAll('*')].filter((e) => vu(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const propre = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/[  ]/g, ' ').trim();
  const nom = (e) => (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : e.tagName.toLowerCase());
  // M — un montant entier : pas de débord, pas de rognage par un parent qui coupe, pas de « … ».
  // Un parent qui DÉFILE (auto/scroll) ne rogne pas : ce qui est sous le pli se lit en défilant. Seul un axe
  // hidden/clip coupe vraiment, et on ne juge que cet axe.
  const coupe = (v) => v === 'hidden' || v === 'clip';
  const rogne = (e) => { const r = e.getBoundingClientRect();
    for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) break;   // au-delà du défileur, plus rien ne rogne le contenu
      const cx = coupe(cs.overflowX), cy = coupe(cs.overflowY); if (!cx && !cy) continue;
      const p = x.getBoundingClientRect();
      if (cx && (r.left < p.left - 1 || r.right > p.right + 1)) return true;
      if (cy && (r.top < p.top - 1 || r.bottom > p.bottom + 1)) return true; }
    return false; };
  const montantsCoupes = [];
  for (const e of feuilles(sec)) { const t = (e.innerText || '').trim(); if (!/€/.test(t)) continue;
    // le titre d'une annonce peut contenir « € » : on ne juge que les textes COURTS (un montant, une phrase de chiffre)
    if (t.length > 48) continue;
    const cs = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible') montantsCoupes.push('débord ' + nom(e) + ' ' + t.slice(0, 40));
    else if (cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) montantsCoupes.push('… ' + nom(e) + ' ' + t.slice(0, 40));
    else if (/…/.test(t)) montantsCoupes.push('… ' + t.slice(0, 40));
    else if (rogne(e)) montantsCoupes.push('rogné ' + nom(e) + ' ' + t.slice(0, 40)); }
  // P — un seul élément parle des prix d'achat, aux nombres de la règle.
  const couts = sec.querySelector('[data-v2-argent-fait="couts"]') || document.querySelector('[data-v2-argent-fait="couts"]');
  const kn = couts ? (couts.getAttribute('data-v2-argent-valeur') || '').split('/').map(Number) : null;
  const regle = kn && kn.length === 2 && Number.isFinite(kn[0]) && Number.isFinite(kn[1]) ? { manquent: kn[1] - kn[0], n: kn[1], k: kn[0] } : null;
  const parlePrix = [];
  for (const e of [...main.querySelectorAll('[data-argent-vue="resume"] *')].filter(vu)) {
    const t = (e.innerText || '').replace(/[  ]/g, ' ').trim(); if (!t || t.length > 80) continue;
    if (!/prix d.achat|co[uû]ts? saisis|coûts/i.test(t)) continue;
    if ([...e.children].some((c) => vu(c) && /prix d.achat|co[uû]ts/i.test(c.innerText || ''))) continue;   // le plus petit qui le dit
    parlePrix.push({ t: t.slice(0, 60), nombres: (t.match(/\d+/g) || []).map(Number) }); }
  const pleinsMois = [...sec.querySelectorAll('.n-bouton[data-n-variante="plein"], .v2-plein, [data-n-plein] button')].filter(vu).length;
  // L — la phrase du reçu : les lignes de texte de la carte du reçu, hors chiffre et hors six mois.
  const carte = sec.querySelector('[data-v2-argent-recu]');
  let lignesPhrase = null, aNote = false;
  if (carte) { lignesPhrase = 0;
    for (const e of feuilles(carte)) { if (e.closest('[data-v2-argent-barres], ol, button')) continue; const t = propre(e); if (!t) continue;
      const cs = getComputedStyle(e); if (parseFloat(cs.fontSize) >= 30) continue;   // le chiffre d'affiche
      if (/^(\d[\d ]*(,\d+)?|€|—)$/.test(t)) continue;
      if (/^au moins$/i.test(t)) continue;   // posé devant le chiffre
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3; lignesPhrase += Math.max(1, Math.round(e.getBoundingClientRect().height / lh)); }
    aNote = !!carte.querySelector('[data-arg-recu-note]'); }
  // V — les six mois écrits.
  const bar = sec.querySelector('[data-v2-argent-barres]');
  const moisEcrits = bar ? feuilles(bar).filter((e) => /€|^—$/.test((e.innerText || '').trim())).length : 0;
  const moisN = bar ? (bar.getAttribute('data-v2-argent-barres') || '').split(',').length : 0;
  // K — « Comptes · N » dans une carte.
  const comptes = [...document.querySelectorAll('[data-v2-argent-comptes]')].filter(vu);
  const comptesDansCarte = comptes.length ? comptes.every((e) => !!e.closest('.n-carte')) : null;
  // T — versements : le montant et « acheté » entiers.
  const versCoupes = [];
  for (const r of [...sec.querySelectorAll('[data-v2-argent-versement]')].filter(vu)) {
    for (const e of feuilles(r)) { const t = (e.innerText || '').trim(); if (!/€/.test(t) || t.length > 60) continue; if (!/acheté|^[−+-]?\d[\d  ]*(,\d+)? ?€$/.test(t.replace(/[  ]/g, ' '))) continue;
      const cs = getComputedStyle(e); if ((e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible') || rogne(e)) versCoupes.push(t.slice(0, 50)); } }
  const W = document.documentElement.clientWidth;
  const deborde = document.documentElement.scrollWidth > W + 1;
  const cibles = [];
  for (const e of sec.querySelectorAll('button, a[href], [role="button"]')) { if (!vu(e)) continue; const r = e.getBoundingClientRect(); if (r.width < 43.5 || r.height < 43.5) cibles.push((e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30) + ' ' + Math.round(r.width) + '×' + Math.round(r.height)); }
  // N — le relevé des chiffres portés (data-*), Mois seulement ; les versements MONTRÉS au téléphone (8 avant comme après).
  const MISE_EN_PAGE = /^data-(arg-(?!vendu)|n-|courant$|v2-argent-faits|v2-argent-barre-v$|v2-principal|v2-pas-su)/;
  const chiffres = [];
  const prend = (e, rang) => { for (const a of e.attributes) if (a.name.startsWith('data-') && !MISE_EN_PAGE.test(a.name) && /^-?\d+(?:[.,/]\d+)*$/.test(a.value)) chiffres.push((rang != null ? '#' + rang + ' ' : '') + a.name + '=' + a.value); };
  for (const e of [sec, ...sec.querySelectorAll('*')]) { if (e.closest('[data-v2-argent-versement]')) continue; prend(e); }
  for (const e of document.querySelectorAll('[data-v2-argent-comptes]')) if (!sec.contains(e)) prend(e);   // hors de Mois (la barre d'avant) ; dedans, déjà relevé
  [...sec.querySelectorAll('[data-v2-argent-versement]')].filter(vu).slice(0, 8).forEach((r, i) => prend(r, i));
  return { chiffres: chiffres.sort(), montantsCoupes: [...new Set(montantsCoupes)].slice(0, 12), regle, parlePrix, pleinsMois, lignesPhrase, aNote, moisEcrits, moisN,
    comptesDansCarte, versCoupes: [...new Set(versCoupes)].slice(0, 8), deborde, cibles: [...new Set(cibles)].slice(0, 8) };
};

async function unEcran(nav, b, taille, sombre) {
  const ou = `volume ${taille} ${sombre ? 'sombre' : 'clair'}`;
  const { ctx, pg, erreurs } = await ouvrir(nav, { taille, sombre, b, url: '/?tab=ventes' });
  try {
    await calme(pg);
    await pg.goto(`http://localhost:${P.PORT}/?tab=argent`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-v2-argent-mois]', { timeout: 40000 }).catch(() => {});
    await calme(pg);
    const tel = Number(taille) < 600;
    const m = await pg.evaluate(MESURE);
    const hv = await pg.evaluate(() => window.innerHeight);
    for (let k = 0; k < 6; k++) { const y = await defile(pg, k * (hv - 200)); await pg.waitForTimeout(300);
      await pg.screenshot({ path: path.join(SHOTS, `argent-${taille}-${sombre ? 'sombre' : 'clair'}-${k}.png`) }); if (y < k * (hv - 200) - 10) break; }
    await defile(pg, 0);
    if (!m) { dit(false, `${ou} : Argent · Mois est rendu`); return; }
    releve[`${taille}-${sombre ? 'sombre' : 'clair'}`] = m.chiffres;
    dit(!m.montantsCoupes.length, `M ${ou} : chaque montant est entier (ni coupé, ni rogné, ni « … »)`, m.montantsCoupes);
    dit(!!m.regle && m.regle.manquent > 0, `P ${ou} : la base d'exemple a des prix d'achat à saisir (${m.regle ? m.regle.manquent + ' sur ' + m.regle.n : 'pas lu'})`);
    if (m.regle) {
      dit(m.parlePrix.length === 1, `P ${ou} : UN seul élément parle des prix d'achat (${m.parlePrix.length})`, m.parlePrix);
      dit(m.parlePrix.every((x) => x.nombres.includes(m.regle.manquent) && x.nombres.includes(m.regle.n) && x.nombres.every((v) => v === m.regle.manquent || v === m.regle.n)),
        `P ${ou} : ses nombres sont ceux de la règle (${m.regle.manquent} à saisir sur ${m.regle.n})`, m.parlePrix);
    }
    dit(m.pleinsMois === 0, `P ${ou} : aucun bouton plein dans Mois (la rangée est la porte) (${m.pleinsMois})`);
    dit(m.lignesPhrase != null && m.lignesPhrase <= (m.aNote ? 2 : 1), `L ${ou} : la phrase du reçu tient en ${m.aNote ? 'deux lignes (manque nommé)' : 'une ligne'} (${m.lignesPhrase})`);
    dit(m.moisN === 6 && m.moisEcrits >= 6, `V ${ou} : les six mois portent leur montant (${m.moisEcrits}/${m.moisN})`);
    dit(m.comptesDansCarte === true, `K ${ou} : « Comptes · N » est une rangée dans une carte`, m.comptesDansCarte);
    dit(!m.versCoupes.length, `T ${ou} : versements, montant et « acheté » entiers`, m.versCoupes);
    dit(!m.deborde, `X ${ou} : la page ne déborde pas en largeur`);
    if (tel) dit(!m.cibles.length, `X ${ou} : cibles ≥ 44 au doigt`, m.cibles);
    dit(!erreurs.length, `${ou} : aucune erreur JS`, erreurs);
    const cle = `${taille}-${sombre ? 'sombre' : 'clair'}`;
    if (REF && REF[cle] && tel) {
      const avant = REF[cle], apres = m.chiffres;
      const reste = apres.slice(); const manquent = [];
      for (const x of avant) { const i = reste.indexOf(x); if (i < 0) manquent.push(x); else reste.splice(i, 1); }
      dit(!manquent.length && !reste.length, `N ${ou} : chaque chiffre porté est le même qu'avant (${avant.length} relevés)`, { manquent: manquent.slice(0, 20), neufs: reste.slice(0, 20) });
    }
  } catch (e) { dit(false, `${ou} : le contrôle est allé au bout`, String(e && e.stack || e).slice(0, 500)); }
  await ctx.close();
}

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try { for (const taille of TAILLES) for (const t of THEMES) await unEcran(nav, micro(baseVolume()), taille, t === 'sombre'); }
  catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1200)); }
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(releve, null, 1));
  await nav.close(); P.srv.close();
  console.log(`\n${ko ? '❌' : '✅'} argent-vintex : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();

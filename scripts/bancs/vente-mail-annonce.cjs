// ═════════════════════════════════════════════════════════════════════════════
//  BANC « LA VENTE VUE PAR E-MAIL ET SON ANNONCE ENCORE EN LIGNE » (24 nov., trois captures iPhone de Julien :
//  Ventes « Autry reelwind low noir taille 36 · N° en attente », Annonces N° 262 encore en ligne, la fiche « pas lu » ×3).
//  Récit : docs/passation/2026-11-24-vente-mail-annonce.md.
//  La FORME mesurée (lecture seule, 24 nov.) — valeurs inventées ici : l'e-mail de vente (compte Pro : n° de transaction) porte
//  la photo /t/{dossier}/150x210/{fichier}.jpeg ; l'annonce du dressing /tc/{dossier}/{fichier}.jpeg ; le bordereau du même n°
//  porte une date limite et un N° écrit par le serveur AU TITRE (pas une identité) ; le dressing a été lu AVANT l'e-mail, la
//  liste des ventes la veille. Ici 50 annonces « Autry reelwind low noir taille 36 » IDENTIQUES (titre, taille, prix, compte).
//   1. photo : Ventes donne le N° de SON annonce (262), Annonces ne la compte plus « en ligne » (« par e-mail »), la fiche le dit ;
//   2. sans photo (aucune identité) : rien n'est relié tout seul ; « Relier à l'annonce » ⇒ la feuille ⇒ son toucher relie (262) ;
//      « Délier » défait ;
//   3. la fiche d'une paire « pas su » : la raison UNE fois (plus « pas lu » répété), « Pourquoi ? ».
//  BANC_DIST : le build jugé ; ETIQUETTE=avant|apres (noms des captures). VUES=tel (défaut) ,ordi.
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const B = require('./_bt-commun.cjs');
const ETQ = process.env.ETIQUETTE || 'apres';
const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'vrm-bancs', 'vente-mail-annonce');
fs.mkdirSync(SORTIE, { recursive: true });
const VUES = String(process.env.VUES || 'tel').split(',').map((x) => x.trim()).filter(Boolean);
const { dit, fin } = B.journal('vente-mail-annonce-' + ETQ);
const TITRE = 'Autry reelwind low noir taille 36';
const TX = 24999000262;
const N = 50, ICI_I = 37;
const dossier = (i) => `05_000df_Banc${String(i).padStart(3, '0')}InventeAbCdEfGhIjKl`;
const fichier = (i) => (0x941d4700 + i).toString(16);
const photoAnnonce = (i) => `https://images1.vinted.net/tc/${dossier(i)}/${fichier(i)}.jpeg?s=${'5ca53aa8'.repeat(5)}`;
const photoMail = (i) => `https://images1.vinted.net/t/${dossier(i)}/150x210/${fichier(i)}.jpeg?s=${'e2eda205'.repeat(5)}`;
const idAnnonce = (i) => 10924548300 + i;

function poser(base, { photo = true } = {}) {
  const lst = base.rows.find((r) => /_listings$/.test(r.id));
  const uid = lst.id.split('_')[1];
  const sold = base.rows.find((r) => r.id === `harvest_${uid}_orders_sold`);
  if (sold) sold.data.capturedAt = new Date(Date.now() - 30 * 3600000).toISOString();     // la liste des ventes : la veille
  lst.data.capturedAt = new Date(Date.now() - 3 * 3600000).toISOString();                   // le dressing : avant l'e-mail
  const fiches = base.main[0].data.vinted_annonce_numeros;
  for (let i = 0; i < N; i++) {
    const id = idAnnonce(i);
    lst.data.payload.items.unshift({ id, title: TITRE, brand_title: 'Autry', size_title: '36', status: 'Très bon état', price: { amount: '84.0', currency_code: 'EUR' },
      is_closed: false, is_hidden: false, is_draft: false, favourite_count: 42, view_count: 120, created_at_ts: new Date(Date.now() - 86400000).toISOString(),
      photo: { url: photoAnnonce(i), high_resolution: { timestamp: Math.floor((Date.now() - 86400000) / 1000) } } });
    const n = i === ICI_I ? '262' : String(900 + i);
    fiches[id] = { num: n, numero: n, title: TITRE, photo: photoAnnonce(i), photoK: `${dossier(i)}/${fichier(i)}`.toLowerCase(), size: '36', price: '84.0', accountId: uid, numberedAt: new Date(Date.now() - 20 * 3600000).toISOString() };
  }
  lst.data.nItems = lst.data.payload.items.length;
  // La lecture publique du même compte (`harvest_{uid}_enligne`, complète) : même heure que le dressing, mêmes annonces en ligne.
  const pub = base.rows.find((r) => r.id === `harvest_${uid}_enligne`);
  if (pub) { pub.data.capturedAt = lst.data.capturedAt; for (let i = 0; i < N; i++) { pub.data.ids.push(idAnnonce(i)); pub.data.items.push({ id: idAnnonce(i), title: TITRE }); } pub.data.n = pub.data.ids.length; }
  const quand = new Date(Date.now() - 40 * 60000).toISOString();
  base.rows.push({ id: `email_sale_tx${TX}`, data: { type: 'vente', transaction: String(TX), uid: String(uid), receivedAt: quand, designation: TITRE, prix: '77.00', photo: photo ? photoMail(ICI_I) : '', pro: true } });
  base.rows.push({ id: `email_bord_${TX}`, data: { type: 'bordereau', filename: `bordereau-${TX}.pdf`, transaction: String(TX), uid: String(uid), receivedAt: new Date(Date.now() - 10 * 60000).toISOString(), article: TITRE, modele: TITRE, taille: '36',
    suivi: '9' + String(TX).slice(-7), transporteur: 'mondialrelay', numero: '262', dateLimite: new Date(Date.now() + 7 * 86400000).toISOString(), pdfB64: 'JVBERi0' + 'x'.repeat(400) } });
  return uid;
}

const texte = (pg) => pg.evaluate(() => (document.querySelector('.vrm-main') || document.body).innerText.replace(/\s+/g, ' ')).catch(() => '');
async function rangVente(pg) {
  return pg.evaluate((T) => {
    const r = [...document.querySelectorAll('[data-vn-rang]')].find((e) => (e.innerText || '').includes(T));
    if (!r) return null;
    const box = r.closest('li, .n-rangee, [role="listitem"]') || r.parentElement;
    return { num: r.getAttribute('data-vn-num') || '', relier: !!(box && box.querySelector('[data-vm-relier]')), delier: !!(box && box.querySelector('[data-vm-delier]')), texte: (box || r).innerText.replace(/\s+/g, ' ').slice(0, 200) };
  }, TITRE).catch(() => null);
}

async function lire(nav, ICI, vue, opts) {
  const base = B.fabriquer({});
  poser(base, opts);
  const { ctx, pg, J } = await B.ouvrir(nav, vue, base);
  const cap = (n) => pg.screenshot({ path: path.join(SORTIE, `${ETQ}-${vue}-${opts.photo ? 'photo' : 'sansphoto'}-${n}.png`) }).catch(() => {});
  // Comme chez lui : l'app ouverte, Annonces déjà lues (la liste « en ligne » est connue de l'écran Ventes), puis Ventes.
  await B.demarrer(pg, ICI, 'annonces');
  await pg.locator('[data-toast-numeros] .n-toast-action').click({ timeout: 1500 }).catch(() => {});
  await pg.waitForTimeout(7000);
  await B.aller(pg, 'ventes', 9000);
  // La vente dans « À envoyer » : en haut de la liste (la date limite la range) — on la fait venir à l'écran pour la capture.
  await pg.evaluate((T) => { const r = [...document.querySelectorAll('[data-vn-rang]')].find((e) => (e.innerText || '').includes(T)); if (r) r.scrollIntoView({ block: 'center' }); }, TITRE).catch(() => {});
  await pg.waitForTimeout(600);
  const v = await rangVente(pg);
  await cap('1-ventes');
  const out = { v, err: [] };
  if (!opts.photo) {
    // Son toucher : « Relier à l'annonce » ⇒ la feuille ⇒ l'annonce N° 262.
    const b = pg.locator('[data-vn-rang]').filter({ hasText: TITRE }).locator('xpath=ancestor::*[.//*[@data-vm-relier]][1]').locator('[data-vm-relier]').first();
    let ouverte = false;
    try { await b.click({ timeout: 4000 }); await pg.waitForSelector('[data-vm-feuille] [data-vm-candidat]', { timeout: 5000 }); ouverte = true; } catch (_) {}
    out.feuille = ouverte ? await pg.evaluate(() => ({ n: document.querySelectorAll('[data-vm-feuille] [data-vm-candidat]').length, ids: [...document.querySelectorAll('[data-vm-feuille] [data-vm-candidat]')].map((e) => e.getAttribute('data-vm-candidat')) })) : null;
    await pg.waitForTimeout(500); await cap('2-feuille');
    if (ouverte) {
      await pg.locator(`[data-vm-feuille] [data-vm-candidat="${idAnnonce(ICI_I)}"]`).scrollIntoViewIfNeeded().catch(() => {});
      await pg.locator(`[data-vm-feuille] [data-vm-candidat="${idAnnonce(ICI_I)}"]`).click({ timeout: 4000 }).catch(() => {});
      await pg.waitForTimeout(2500);
      out.apresRelier = await rangVente(pg);
      await cap('3-reliee');
      await pg.locator('[data-vm-delier]').first().click({ timeout: 4000 }).catch(() => {});
      await pg.waitForTimeout(2500);
      out.apresDelier = await rangVente(pg);
      await cap('4-deliee');
      // Re-relier, pour juger Annonces et la fiche dans l'état relié.
      await pg.locator('[data-vm-relier]').first().click({ timeout: 4000 }).catch(() => {});
      await pg.locator(`[data-vm-feuille] [data-vm-candidat="${idAnnonce(ICI_I)}"]`).click({ timeout: 4000 }).catch(() => {});
      await pg.waitForTimeout(2000);
    }
  }
  await B.aller(pg, 'annonces', 9000);
  // Le haut d'Annonces (le groupe « Vendue · par e-mail » s'il y est), puis la recherche « Autry » : combien EN LIGNE.
  await pg.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  out.vendues = await pg.evaluate(() => [...document.querySelectorAll('[data-vm-annonce]')].map((e) => e.getAttribute('data-vm-annonce-num'))).catch(() => []);
  out.seg = await pg.evaluate(() => { const s = document.querySelector('[data-eg-segment="enligne"]'); return s ? (s.getAttribute('data-eg-segment-n') || s.innerText) : null; }).catch(() => null);
  await cap('5-annonces');
  const champ = pg.locator('input[type="search"], input[placeholder*="titre"]').first();
  await champ.fill('Autry').catch(() => {});
  await pg.waitForTimeout(2500);
  for (let k = 0; k < 8; k++) { await pg.mouse.wheel(0, 3000).catch(() => {}); await pg.waitForTimeout(300); }
  const t = await texte(pg);
  const vm = await pg.evaluate(() => [...document.querySelectorAll('[data-vm-annonce]')].length).catch(() => 0);
  out.annonces = { autry: t.split(TITRE).length - 1 - vm, n262: (t.match(/N° ?262\b/g) || []).length };
  await pg.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await cap('6-annonces-autry');
  // Le N° cherché : « 262 » EN LIGNE (hors du groupe « par e-mail »).
  await champ.fill('262').catch(() => {});
  await pg.waitForTimeout(2500);
  out.annonces.enLigne262 = await pg.evaluate((T) => { const tous = (document.querySelector('.vrm-main') || document.body).innerText.replace(/\s+/g, ' ');
    const vm = [...document.querySelectorAll('[data-vm-annonce]')].map((e) => e.innerText.replace(/\s+/g, ' ')).join(' ');
    return tous.split(T).length - 1 - (vm.split(T).length - 1); }, TITRE).catch(() => null);
  await cap('6b-annonces-262');
  await champ.fill('').catch(() => {});
  // La fiche du N° 262.
  await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '262' })));
  await pg.waitForTimeout(9000);
  out.fiche = await pg.evaluate(() => { const e = document.querySelector('[data-fd-etat]'); const corps = (document.querySelector('[data-fiche-paire]') || document.body).innerText.replace(/\s+/g, ' ');
    return { etat: e ? e.getAttribute('data-fd-etat') : null, texte: e ? e.innerText : '', pourquoi: !!document.querySelector('[data-fd-pourquoi]'), pasLu: (corps.match(/pas lu/gi) || []).length, ventesPasLues: (corps.match(/ventes pas (encore )?lues/gi) || []).length }; }).catch(() => null);
  await cap('7-fiche');
  out.err = [...new Set(J.erreurs)].filter((x) => !/Service Worker registration blocked|language detection/.test(x));
  await ctx.close();
  return out;
}

async function main() {
  const { srv, ICI } = await B.serveur();
  const nav = await B.navigateur();
  try {
    for (const vue of VUES) {
      const p = await lire(nav, ICI, vue, { photo: true });
      console.log(JSON.stringify(p));
      dit(vue, 'photo exacte : la vente e-mail reçoit le N° de SON annonce (262), pas un autre des 50', p.v && p.v.num === '262', JSON.stringify(p.v));
      dit(vue, 'photo exacte : Annonces · En ligne ne la montre plus (« 262 » cherché : aucune annonce en ligne)', p.annonces && p.annonces.enLigne262 === 0, JSON.stringify(p.annonces));
      dit(vue, 'photo exacte : Annonces la dit « Vendue · par e-mail, en attente de Vinted » (N° 262)', Array.isArray(p.vendues) && p.vendues.length === 1 && p.vendues[0] === '262', JSON.stringify([p.vendues, p.seg]));
      dit(vue, 'photo exacte : la fiche N° 262 dit « vendue · par e-mail »', p.fiche && p.fiche.etat === 'fd.etat.vendueMail', JSON.stringify(p.fiche));
      dit(vue, 'la fiche ne répète pas « pas lu »', p.fiche && p.fiche.pasLu === 0 && p.fiche.ventesPasLues === 0, JSON.stringify(p.fiche));
      const s = await lire(nav, ICI, vue, { photo: false });
      console.log(JSON.stringify(s));
      dit(vue, 'sans identité : rien n’est relié tout seul (aucun N°)', s.v && !s.v.num, JSON.stringify(s.v));
      dit(vue, 'sans identité : UN geste « Relier à l’annonce »', s.v && s.v.relier, JSON.stringify(s.v));
      dit(vue, 'la feuille propose les annonces du compte (au plus 8), dont la bonne', s.feuille && s.feuille.n > 0 && s.feuille.n <= 8 && s.feuille.ids.includes(String(idAnnonce(ICI_I))), JSON.stringify(s.feuille));
      dit(vue, 'son toucher relie : N° 262', s.apresRelier && s.apresRelier.num === '262' && s.apresRelier.delier, JSON.stringify(s.apresRelier));
      dit(vue, '« Délier » défait : plus de N°, « Relier » revient', s.apresDelier && !s.apresDelier.num && s.apresDelier.relier, JSON.stringify(s.apresDelier));
      dit(vue, 'reliée par son clic : Annonces · En ligne ne la montre plus', s.annonces && s.annonces.enLigne262 === 0, JSON.stringify(s.annonces));
      for (const [k, x] of [['photo', p], ['sans photo', s]]) dit(vue, `aucune erreur (${k})`, !x.err.length, x.err.slice(0, 3).join(' ¦ '));
    }
  } finally { await nav.close(); srv.close(); }
  process.exit(fin(SORTIE) ? 1 : 0);
}
main();

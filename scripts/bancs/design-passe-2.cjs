require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  LA PASSE DESIGN, SECONDE MOITIÉ (14 nov.) — les écrans que la première passe
//  (`design-passe.cjs`, récit docs/passation/2026-11-14-design-passe.md) n'a PAS
//  mesurés et que des scripts ont modifiés sans que personne regarde le résultat.
//
//  La MÊME mesure (A cibles 44 doigt / 36 souris · B graisses 400/600/700 · C tailles
//  de l'échelle · D gris du système · E contraste ≥ 4,5:1 · F mots coupés · G carte MFA
//  · H violet / Chronopost jaune · I chiffres rognés) — la fonction `mesurer` de
//  `design-passe.cjs`, rien de recopié — sur :
//    messages · emails · achats · ebay / leboncoin / vestiaire (annonces, ventes ; messages
//      Vestiaire) — données inventées de ces sites (formes des bancs eBay, Vestiaire) ·
//    reglages-<sous-page> (les sous-pages de Paramètres, une mesure chacune) ·
//    feuilles : la confirmation (« Se déconnecter partout ? »), « Signaler un problème »,
//      le menu « Plus » du téléphone (portails, `.vrm-fs`) ·
//    connexion (sans session, `/?connexion`) · accueil (sans session, `/`) ·
//    exemple (« Découvrir avec des exemples », `/?exemple`, bandeau compris) ·
//    loupe : en plus, J — une rangée trouvée par son N° n'écrit ce N° qu'une fois (§7) ·
//    demarrage (la carte « Démarrer avec VRM · 1 sur 3 » d'un compte NEUF) et
//    parcours (l'écran plein des trois étapes).
//  390 tactile ET 1512, clair ET sombre, deviceScaleFactor 1. Base INVENTÉE
//  (`_base-volume.cjs`), garde réseau. `ECRANS=` `LARGEURS=` `THEMES=` `SOUS=` pour
//  un sous-ensemble ; `BANC_DIST=` pour juger un autre build ; `SHOTS=` les captures ;
//  `SUITE=3` des captures défilées (pour REGARDER).
//  La page d'accueil publique a SA typographie de vitrine (titres de 40 à 64 px) :
//  C (tailles) n'y juge que le texte courant (≤ 20 px) ; tout le reste y est jugé.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { mesurer, ouvrir, base, pret, srv, PORT, SHOTS, LARGEURS, THEMES, ECRANS_VOULUS, DETAIL, chromium } = P;
const CLES = [...P.CLES, 'numDouble'];
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
// Les sous-pages de Paramètres (ids de `Reglages.jsx`, `data-sous-ouvrir`) ; [vue, id].
const SOUS = liste('SOUS', 'reglages:toutvabien,reglages:connexions,reglages:securite-comptes,reglages:vacances,reglages:push,reglages:rappels,reglages:numeros,reglages:modeles,reglages:imprimante,reglages:regime,reglages:langue,reglages:apparence,reglages:widget,compte:appareils,compte:double').map((x) => x.split(':'));

const attendre = async (pg, f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f().catch(() => false)) return true; await pg.waitForTimeout(250); } return false; };
const toucher = async (o, sel) => {
  const l = o.pg.locator(sel).first();
  if (!(await l.count())) return false;
  await l.scrollIntoViewIfNeeded().catch(() => {});
  if (o.tel) await l.tap({ timeout: 4000 }).catch(() => l.click({ timeout: 4000, force: true }).catch(() => {}));
  else await l.click({ timeout: 4000 }).catch(() => {});
  return true;
};
const APP = ['.vrm-app-shell', '.vrm-fs'];

// ── Données INVENTÉES des autres sites (formes de `ebay-lbc-visuel.cjs`, `vestiaire-fiches.cjs`). ──
const ilYaH = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const IMG = (k) => `https://img.test/d2-${k}.jpg`;
function sites(b) {
  b.main[0].data.vrm_plateformes_affichees = { sites: ['vinted', 'leboncoin', 'ebay', 'vestiaire'], at: ilYaH(100) };
  const EB = [['Autry Reelwind gris taille 37', 84, 'VRM-81'], ['Nike Air Max 1 Travis Scott Cactus Jack taille 44', 145, 'VRM-78'], ['Asics Gel-1130 blanc argent taille 42', 68, 'VRM-48'], ['New Balance 550 blanc vert taille 41', 74, '']]
    .map(([title, p, sku], i) => ({ itemId: String(120000000081 + i), title, price: p.toFixed(1), sku, currency: 'EUR', photo: IMG('e' + i), url: `https://www.ebay.fr/itm/${120000000081 + i}`, depuis: ilYaH(24 * (20 + i)), detail: { photos: [IMG('e' + i)], condition: 'Occasion - Très bon état' } }));
  b.rows.push(
    { id: 'ebay_listings', data: { items: EB, capturedAt: Date.now() - 3600e3, complet: true } },
    { id: 'ebay_offres', data: { items: {}, capturedAt: Date.now() - 3600e3 } },
    { id: 'ebay_orders', data: { orders: [], capturedAt: Date.now() - 3600e3, complet: true } },
    { id: 'ebay_programmees', data: { items: [], enLigne: EB.map((a) => ({ sku: a.sku, itemId: a.itemId })), complet: true, capturedAt: Date.now() - 3600e3 } });
  const LBC = '8a8a8a8a-1111-4222-8333-444444444444';
  const items = Object.fromEntries([1, 2, 3, 4, 5].map((i) => [String(3300000000 + i), { id: String(3300000000 + i), subject: ['Nike Air Max 1 blanc taille 42', 'Autry Reelwind gris taille 37', 'Salomon XT-6 noir taille 43', 'Adidas Samba OG taille 40', 'Vans Old Skool taille 39'][i - 1], price: 55 + i * 7, status: 'active', account: LBC, accountName: 'Boutique LBC', ref: String(140 + i), url: `https://www.leboncoin.fr/ad/chaussures/${3300000000 + i}`, images: [IMG('l' + i)], seenAt: ilYaH(2), platform: 'leboncoin' }]));
  b.rows.push(
    { id: 'lbc_listings', data: { items, lectures: { [LBC]: { at: ilYaH(2), total: 5, n: 5 } }, updatedAt: ilYaH(2) } },
    { id: 'lbc_accounts', data: { accounts: { [LBC]: { id: LBC, name: 'Boutique LBC', type: 'particulier', seenAt: ilYaH(2), sessionAt: ilYaH(2), platform: 'leboncoin' } } } },
    { id: 'lbc_ventes', data: { ventes: {} } });
  const demain = new Date(Date.now() + 30 * 3600e3).toISOString();
  b.rows.push(
    { id: 'vc_session', data: { id: 'compteA', at: ilYaH(0.2), source: 'users/me', comptes: { compteA: ilYaH(0.2) } } },
    { id: 'vc_listings', data: { capturedAt: ilYaH(2), complet: true, total: 3, liens: {}, items: {
      P1: { boost: true, ref: '41', titre: 'Baskets Nike Dunk Low', photo: IMG('v1'), prix: { valeur: 99, devise: 'EUR', cle: 'price.cents' }, statut: 'on_sale', compte: 'compteA', favoris: 4, vuAt: ilYaH(2) },
      P2: { boost: null, ref: '42', titre: 'Adidas Samba', photo: IMG('v2'), prix: { valeur: 70, devise: 'EUR', cle: 'price' }, statut: 'on_sale', compte: 'compteA', vuAt: ilYaH(2) },
      P3: { boost: null, ref: '', titre: 'New Balance 550', photo: '', prix: null, statut: 'pending_review', compte: '', vuAt: ilYaH(2) } } } },
    { id: 'vc_ventes', data: { lectures: { 'a-expedier': { at: ilYaH(1), total: 1, complet: true }, ventes: { at: ilYaH(1), total: 2, complet: true } }, ventes: {
      V1: { productId: 'P9', ref: '43', etat: 'to_ship', date: ilYaH(20), montant: { valeur: 123.45, devise: 'EUR', cle: 'price' }, limite: demain, etiquette: true, aExpedier: true, compte: 'compteA' },
      V2: { productId: 'P8', ref: '44', etat: 'authentication_in_progress', date: ilYaH(60), montant: { valeur: 87.65, devise: 'EUR', cle: 'earnings' }, aExpedier: false, compte: 'compteA' } } } },
    { id: 'vc_messages', data: { compteur: { messages: 1, at: ilYaH(0.5) }, lecture: { at: ilYaH(0.5), total: 2, complet: true, page: '/messages/' }, conversations: {
      CA: { productId: 'P1', ref: '41', nonLu: true, date: ilYaH(3), compte: 'compteA', apercu: 'Bonjour, toujours dispo ?' },
      CB: { productId: 'P2', ref: '42', nonLu: false, date: ilYaH(5), compte: 'compteA', apercu: 'Merci !' } } } });
  return b;
}
const baseSites = () => sites(base());
// La boîte E-mails (la forme de `/api/email-rattacher?mode=journal`, `boite-emails.cjs`).
const EMAILS = [
  { t: 'suivi', type: 'suivi', subject: 'Votre colis 12345678 est disponible', from: 'Mondial Relay <noreply@mondialrelay.fr>', resume: { v: 1, t: 'suivi', tr: 'mondialrelay', s: '12345678', st: 'available', code: '418205', lieu: 'Relais Tabac du Port', lim: '09/11/2026' } },
  { type: 'bordereau', subject: "Bordereau d'envoi pour Nike Air Max 90", from: "L'équipe Vinted <no-reply@vinted.fr>", resume: { v: 1, t: 'bordereau', tx: '12345678901', n: '42', pdf: 1, a: 'Nike Air Max 90' }, pj: 1 },
  { type: 'vente', subject: 'Ton article est vendu !', from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, t: 'vente', a: 'Adidas Samba', px: '55', n: '17' } },
  { type: 'achat', subject: 'Ton reçu pour la commande « Nike Air Force 1 »', from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, t: 'achat', tx: '98765432101', a: 'Nike Air Force 1', px: '45,00', pdf: 1 }, pj: 1 },
  { type: 'offre', subject: 'Nouvelle offre', from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, t: 'offre', mt: '30' } },
  { type: 'suivi', subject: 'Votre colis est en route', from: 'Chronopost <suivi@chronopost.fr>', resume: { v: 1, t: 'suivi', s: 'CH12', st: 'transit' } },
].map((e, i) => ({ id: 'email_reception_' + String(i + 1).padStart(4, '0') + 'd'.repeat(60), at: ilYaH(2 + i * 9), etat: 'integre', pj: 0, adresses: ['vendeur.exemple@exemple.test'], compte: { id: '1', nom: 'vendeur_1' }, compteAmbigu: false, sourceDate: null, ...e }));
const api = (u, req) => {
  if (/\/api\/ebay/.test(u)) {
    if (req.method() !== 'POST') return { ok: true, ready: true, canConsent: true };
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    if (body.action === 'status') return { ok: true, connected: true };
    if (body.action === 'offreinfo') return { ok: true, eligibles: [], complet: true };
    return { ok: true };
  }
  if (/\/api\/email-rattacher/.test(u) && /mode=journal/.test(u) && !/lire=/.test(u)) {
    const parRubrique = { ventes: 1, achats: 1, codes: 1, colis: 3, offres: 1, autres: 0 };
    return { ok: true, page: 0, parPage: 20, suite: false, emails: EMAILS, compteurs: { sur: EMAILS.length, plus: false, integre: EMAILS.length, aVerifier: 0, erreur: 0, incompris: 0, parRubrique }, adresses: [{ adresse: 'vendeur.exemple@exemple.test', nom: 'vendeur_1' }] };
  }
  return null;
};

// Une base de vendeur NEUF : aucun compte Vinted, aucun parcours ouvert (la carte en 3 étapes).
function baseNeuve(plein) {
  const b = base();
  b.accounts = [];
  const m = b.main[0].data;
  delete m.vrm_parcours;
  if (plein) m.vrm_parcours = { v: 1, etape: 'extension', ouvert: true, fini: null, at: new Date().toISOString() };
  b.rows = b.rows.filter((r) => !/^harvest_|^ext_appareil_/.test(r.id));
  return b;
}

const ECRANS = [
  { nom: 'messages', url: '/?tab=messages' },
  { nom: 'emails', url: '/?tab=emails' },
  { nom: 'achats', url: '/?tab=achats' },
  { nom: 'ebay-annonces', url: '/?tab=annonces&site=ebay', base: baseSites },
  { nom: 'ebay-ventes', url: '/?tab=ventes&site=ebay', base: baseSites },
  { nom: 'leboncoin-annonces', url: '/?tab=annonces&site=leboncoin', base: baseSites },
  { nom: 'leboncoin-ventes', url: '/?tab=ventes&site=leboncoin', base: baseSites },
  { nom: 'vestiaire-annonces', url: '/?tab=annonces&site=vestiaire', base: baseSites },
  { nom: 'vestiaire-ventes', url: '/?tab=ventes&site=vestiaire', base: baseSites },
  { nom: 'vestiaire-messages', url: '/?tab=messages&site=vestiaire', base: baseSites },
  { nom: 'reglages', url: '/?tab=settings', jouer: async (o, mesure) => {
    for (const [vue, id] of SOUS) {
      await toucher(o, '[data-sous-retour]'); await o.pg.waitForTimeout(250);
      await toucher(o, `[data-onglets-reglages] [data-vue="${vue}"]`); await o.pg.waitForTimeout(400);
      if (!(await toucher(o, `[data-sous-ouvrir="${id}"]`))) { console.log(`  · reglages-${id} : pas de ligne « ${id} » dans la vue ${vue} (pas mesuré)`); continue; }
      await attendre(o.pg, () => o.pg.evaluate((i) => { const e = document.querySelector(`[data-sous-ecran="${i}"]`); return !!e && !e.hidden; }, id), 4000);
      await o.pg.waitForTimeout(700);
      await mesure(id, ['.vrm-set-nav', '.vrm-set-sous-h', `[data-sous-ecran="${id}"]`, '.vrm-fs']);
    }
  } },
  { nom: 'feuilles', url: '/?tab=settings', jouer: async (o, mesure) => {
    // La confirmation (portail `Z_CONFIRMATION`) : « Se déconnecter partout ? », onglet Compte.
    await toucher(o, '[data-onglets-reglages] [data-vue="compte"]'); await o.pg.waitForTimeout(500);
    if (!(await o.pg.locator('[data-deconnexion-partout]').first().isVisible().catch(() => false))) { await toucher(o, '[data-sous-ouvrir="appareils"]'); await o.pg.waitForTimeout(800); }
    if (await toucher(o, '[data-deconnexion-partout]')) {
      await o.pg.waitForSelector('.vrm-confirmation', { timeout: 5000 }).catch(() => {});
      await o.pg.waitForTimeout(700);
      await mesure('confirmation', ['.vrm-confirmation']);
      await o.pg.keyboard.press('Escape').catch(() => {}); await o.pg.waitForTimeout(500);
    } else console.log('  · feuilles-confirmation : « Se déconnecter partout » introuvable (pas mesuré)');
    await toucher(o, '[data-sous-retour]'); await o.pg.waitForTimeout(250);
    // « Signaler un problème » (une feuille, `SheetShell`).
    await toucher(o, '[data-onglets-reglages] [data-vue="reglages"]'); await o.pg.waitForTimeout(400);
    if (await toucher(o, '[data-reglage-signaler]')) {
      await o.pg.waitForSelector('.vrm-fs', { timeout: 5000 }).catch(() => {});
      await o.pg.waitForTimeout(900);
      await mesure('signaler', ['.vrm-fs']);
      await o.pg.keyboard.press('Escape').catch(() => {}); await o.pg.waitForTimeout(500);
      if (await o.pg.$('.vrm-fs')) { await toucher(o, '[data-feuille-croix]'); await o.pg.waitForTimeout(400); }
    } else console.log('  · feuilles-signaler : ligne introuvable (pas mesuré)');
    // Le menu « Plus » (téléphone).
    if (o.tel && await toucher(o, '.vrm-nav-more')) {
      await o.pg.waitForTimeout(900);
      await mesure('plus', ['.vrm-plus-panneau', '.vrm-fs', '[role="menu"]']);
    }
  } },
  // La loupe : une rangée trouvée PAR son N° n'écrit ce N° qu'UNE fois (« #125 » à gauche et « N°125 » à droite, avant).
  { nom: 'loupe', url: '/?tab=journee', jouer: async (o, mesure) => {
    if (o.tel) await o.pg.locator('button[data-recherche-loupe]').first().tap().catch(() => {});
    else { await o.pg.mouse.click(5, 300); await o.pg.keyboard.press('Control+K'); }
    await o.pg.waitForSelector('[data-recherche-champ]', { timeout: 8000 }).catch(() => {});
    await o.pg.evaluate(() => { const el = document.querySelector('[data-recherche-champ]'); if (!el) return; const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; poser.call(el, '5'); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await o.pg.waitForSelector('[data-recherche-resultat]', { timeout: 8000 }).catch(() => {});
    await o.pg.waitForTimeout(1200);
    await mesure('', ['[data-recherche-panneau]']);
  } },
  { nom: 'connexion', url: '/?connexion', sansSession: true, attendre: '[data-auth-valider]', racines: ['body'], ciblesEnPlus: 'a[data-retour-accueil], a[data-cta]' },
  { nom: 'accueil', url: '/', sansSession: true, attendre: '[data-accueil]', racines: ['[data-accueil]'], vitrine: true, ciblesEnPlus: 'a[data-cta], a[data-cta-nav]' },
  { nom: 'exemple', url: '/?exemple', sansSession: true, attendre: '[data-exemple-bandeau]', racines: APP },
  { nom: 'demarrage', url: '/?tab=journee', base: () => baseNeuve(false), attendre: '[data-parcours-carte]', racines: ['[data-parcours-carte]'] },
  { nom: 'parcours', url: '/?tab=journee', base: () => baseNeuve(true), attendre: '[data-parcours]', racines: ['[data-parcours]'] },
];

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const total = Object.fromEntries(CLES.map((k) => [k, 0]));
  const rapport = {};
  let vus = 0, manques = 0;
  for (const W of LARGEURS) for (const theme of THEMES) {
    const sombre = theme === 'sombre';
    for (const E of ECRANS) {
      if (ECRANS_VOULUS.length && !ECRANS_VOULUS.includes(E.nom)) continue;
      const suf0 = `${E.nom}-${W}-${theme}`;
      let o;
      try {
        o = await ouvrir(nav, { W, sombre, b: E.base ? E.base() : base(), url: E.url, sansSession: !!E.sansSession, api });
        if (E.attendre) { await o.pg.waitForSelector(E.attendre, { timeout: 25000 }).catch(() => {}); await o.pg.waitForTimeout(2200); }
        else await pret(o.pg);
        const mesure = async (sous, racines) => {
          const suf = sous ? `${E.nom}-${sous}-${W}-${theme}` : suf0;
          const present = await o.pg.evaluate((r) => r.some((s) => { const e = document.querySelector(s); return e && e.getClientRects().length; }), racines);
          if (!present) { console.log(`✗ ${suf} : rien à mesurer (${racines.join(', ')} absent)`); manques++; return; }
          vus++;
          await o.pg.screenshot({ path: path.join(SHOTS, suf + '.png') });
          for (let i = 1; i <= Number(process.env.SUITE || 0); i++) {
            const ok = await o.pg.evaluate((i) => {
              const c = [document.querySelector('.vrm-fs-corps'), document.querySelector('[data-parcours]'), document.querySelector('.vrm-main'), document.scrollingElement].filter((x) => x && x.scrollHeight > x.clientHeight + 40 && x.getClientRects().length)[0];
              if (!c) return false; const avant = c.scrollTop; c.scrollTop = Math.round(c.clientHeight * 0.85) * i; return c.scrollTop !== avant;
            }, i);
            if (!ok) break;
            await o.pg.waitForTimeout(400); await o.pg.screenshot({ path: path.join(SHOTS, `${suf}-suite${i}.png`) });
          }
          await o.pg.evaluate(() => { for (const c of [document.querySelector('.vrm-fs-corps'), document.querySelector('[data-parcours]'), document.querySelector('.vrm-main'), document.scrollingElement]) if (c) c.scrollTop = 0; });
          if (process.env.SONDE) console.log('    sonde :', JSON.stringify(await o.pg.evaluate(process.env.SONDE).catch((e) => String(e))).slice(0, 4000));
          const m = await o.pg.evaluate(mesurer, { tactile: o.tel, sombre, racines, ciblesEnPlus: E.ciblesEnPlus || '' });
          // J. Le même N° écrit deux fois sur une rangée de résultat (§7 : le même nombre, une fois).
          m.numDouble = await o.pg.evaluate(() => [...document.querySelectorAll('[data-recherche-resultat][data-recherche-num]')].filter((r) => r.getClientRects().length).map((r) => {
            const n = r.getAttribute('data-recherche-num'); const echap = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const fois = (r.innerText.match(new RegExp('(?:#|N°\\s?)' + echap + '(?![0-9A-Za-z])', 'g')) || []).length;
            return { n, fois, quoi: r.innerText.replace(/\s+/g, ' ').slice(0, 60) };
          }).filter((x) => x.fois > 1));
          if (E.nom === 'loupe') { const nR = await o.pg.evaluate(() => document.querySelectorAll('[data-recherche-resultat][data-recherche-num]').length); if (!nR) { console.log(`✗ ${suf} : aucune rangée de N° rendue (la loupe n'est pas mesurée)`); manques++; } }
          // La vitrine publique : ses titres de 40 à 64 px sont sa typographie (jugés partout ailleurs).
          if (E.vitrine) m.tailles = m.tailles.filter((x) => x.t <= 20);
          rapport[suf] = m;
          const rouge = CLES.some((k) => m[k].length);
          console.log(`${rouge ? '✗' : '✓'} ${suf} (${m.nTextes} textes, ${m.nCibles} cibles) : ${CLES.map((k) => `${k} ${m[k].length}`).join(' · ')}`);
          for (const k of CLES) {
            total[k] += m[k].length;
            const n = new Map();
            for (const x of m[k]) { const c = JSON.stringify(x); n.set(c, (n.get(c) || 0) + 1); }
            [...n.entries()].slice(0, DETAIL).forEach(([c, k2]) => console.log(`    ${k}${k2 > 1 ? ' ×' + k2 : ''} ${c}`));
          }
        };
        if (E.jouer) await E.jouer(o, mesure);
        else await mesure('', E.racines || APP);
        if (o.erreurs.length) console.log('    erreurs JS :', o.erreurs.slice(0, 2).join(' | '));
      } catch (e) { console.log('ÉCHEC', suf0, String(e.message || e).slice(0, 200)); manques++; }
      finally { if (o) await o.ctx.close().catch(() => {}); }
    }
  }
  fs.writeFileSync(path.join(SHOTS, 'rapport-2.json'), JSON.stringify(rapport, null, 1));
  console.log('\nTOTAL :', CLES.map((k) => `${k} ${total[k]}`).join(' · '), `· rendus mesurés ${vus} · manqués ${manques}`);
  const rouges = Object.values(total).reduce((a, b) => a + b, 0) + manques;
  console.log(rouges ? `✗ ROUGE — ${rouges} défauts` : '✓ VERT — tout est dans le système');
  console.log('captures :', SHOTS);
  await nav.close(); srv.close();
  process.exit(rouges ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

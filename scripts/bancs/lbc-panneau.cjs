#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  BANC — LE PANNEAU SUR LEBONCOIN.FR (5.445, 23 nov.)
//  Le vrai vrm-ui.js + vrm-badge.js sur une fausse page leboncoin.fr (« Mes annonces »),
//  un faux `chrome` qui sert ce que le fond rend (formes de `carteListesSite` 5.445).
//  Captures de Julien (23 nov.) : « Tes annonces n'ont pas pu être lues » sur Mes annonces,
//  « Ouvre « Mes transactions » » sur chaque écran, achats absents. Il juge :
//   P1 une 1re réponse « compte pas encore reconnu » (`attente`) est redemandée seule :
//      la liste arrive sans geste, jamais « pas pu être lues » ;
//   P2 Commandes = Ventes · Achats : état de chaque ligne (data-lb-etat), transporteur,
//      n° de suivi, « Suivre le colis » seulement quand l'adresse est donnée ;
//   P3 le geste « Ouvre « Mes transactions » » : ni sur Annonces, ni sur l'Accueil quand
//      ses ventes de CE compte sont rangées ;
//   P4 le porte-monnaie : 0 ⇒ « 0,00 € », un autre nombre ⇒ « à vérifier » (unité pas mesurée) ;
//   P5 Messagerie : la conversation rangée, ses non-lus.
//  Captures 1512 puis 390 dans $TMPDIR/banc-lbc-panneau/ (à REGARDER). `--racine <arbre>` : un
//  autre arbre de l'extension (preuve sur le code d'avant). Données inventées.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const iR = process.argv.indexOf('--racine');
const RACINE = iR > 0 ? path.resolve(process.argv[iR + 1]) : path.join(__dirname, '..', '..');
const EXT = path.join(RACINE, 'vinted-sync-extension');
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const UI = fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8');
const LOGO = fs.readFileSync(path.join(__dirname, '..', '..', 'vinted-sync-extension', 'logo-vrm-96.png'));
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4eechAAUoApeWrujeAAAAAElFTkSuQmCC', 'base64');
const SORTIE = path.join(process.env.TMPDIR || os.tmpdir(), 'banc-lbc-panneau'); fs.mkdirSync(SORTIE, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 240) : '')); } };
const T0 = Date.now(), J = 864e5, A = '11111111-2222-4333-8444-555555555555';
const img = (c) => `https://img.leboncoin.fr/banc/${c}.jpg`;
const MOD = ['Nike Dunk Low Panda 42', 'Adidas Samba OG noires 41', 'New Balance 550 crème 43', 'Asics Gel-Kayano 14 argent 42', 'Puma Suede bleues 40'];
const ANN = MOD.map((t, i) => ({ id: String(3000000001 + i), titre: t, prix: 50 + i * 5, photo: img('a' + i), photos: [img('a' + i)], num: '', jours: 3 + i, description: '', statut: 'en_vente', url: 'https://www.leboncoin.fr/ad/chaussures/' + (3000000001 + i), favoris: i === 0 ? 4 : null, vues: i === 0 ? 120 : null }));
const tx = (o) => Object.assign({ num: '', bordereau: null, limite: '', statutSite: '', transporteur: '', photo: img('t' + o.tx.slice(-1)) }, o);
const VEN = [tx({ tx: '100000002', sens: 'vente', titre: MOD[1], prix: 45, date: T0, etat: 'a_expedier', vendue: true, statutSite: 'Paiement validé', transporteur: 'Mondial Relay', transporteurCle: 'mondialrelay', lien: 'https://www.leboncoin.fr/compte/part/transaction/100000002' }),
  tx({ tx: '100000003', sens: 'vente', titre: MOD[2], prix: 60, date: T0 - J, etat: 'en_route', vendue: true, statutSite: 'Colis en cours de livraison', transporteur: 'Mondial Relay', transporteurCle: 'mondialrelay', suivi: '71911374', suiviUrl: 'https://www.mondialrelay.fr/suivi/?n=71911374', lien: 'https://www.leboncoin.fr/compte/part/transaction/100000003' }),
  tx({ tx: '100000001', sens: 'vente', titre: MOD[0], prix: 58, date: T0 - 9 * J, etat: 'finalisee', vendue: true, statutSite: 'Paiement effectué', transporteur: 'Mondial Relay', transporteurCle: 'mondialrelay', suivi: '86672671', lien: 'https://www.leboncoin.fr/compte/part/transaction/100000001' })];
const ACH = [tx({ tx: '200000002', sens: 'achat', titre: 'Jordan 1 Mid 42', prix: 10, date: T0 - 2 * J, etat: 'pas_su', vendue: false, statutSite: 'Paiement validé', lien: 'https://www.leboncoin.fr/compte/part/transaction/200000002' }),
  tx({ tx: '200000001', sens: 'achat', titre: 'Air Max 90 blanches 43', prix: 25, date: T0 - 30 * J, etat: 'finalisee', vendue: false, statutSite: 'Terminé', transporteur: 'Mondial Relay', transporteurCle: 'mondialrelay', suivi: '85425599', suiviUrl: 'https://www.mondialrelay.fr/suivi/?n=85425599', lien: 'https://www.leboncoin.fr/compte/part/transaction/200000001' })];
const STATUTS = { en_vente: 5, brouillon: 0, masque: 0, reserve: 0, vendu: 0, a_confirmer: 0 };
const LISTES = (pm) => ({ ok: true, plateforme: 'leboncoin', compte: { id: A, nom: 'Totomondu' },
  annonces: { lu: T0 - 60000, aConfirmer: false, total: ANN.length, liste: ANN, toutes: ANN, nTous: ANN.length, statuts: STATUTS, sansCompte: 0 },
  ventes: { lu: T0 - 60000, total: VEN.length, liste: VEN, inconnues: 1 }, achats: { lu: T0 - 60000, total: ACH.length, liste: ACH },
  porteMonnaie: pm, messages: { lu: T0 - 60000, site: 'leboncoin', nonlusSite: 7, liste: [{ conv: 'aaaaaaaa-0000-4000-8000-000000000001', qui: MOD[0], texte: 'Bonjour, toujours disponible ?', at: T0 - 120000, nonlu: true, photo: img('a0'), annonce: '3000000001' }] },
  automatisations: null, notifications: { vu: null, liste: [] }, retraits: null, autres: null, fenetre: false });
const ETAT = { ok: true, plateforme: 'leboncoin', capte: true, version: '5.445.0', code: '5.445.0', vrm: { ok: true, connecte: true, email: 'vendeur@exemple.fr', cloisonne: true },
  site: { id: A, nom: 'Totomondu', type: 'particulier' }, secu: { niveau: 'ok', texte: 'Tout va bien' }, toutArrete: false, flux: { okAt: T0 - 60000 }, liens: [], capteCoupe: false,
  lbc: { compte: { ok: true, texte: 'Totomondu' }, annonces: { ok: true, texte: '5 lues en entier {quand}', at: T0 - 60000 }, ventes: { ok: null, texte: 'pas encore lues', geste: 'Ouvre « Mes transactions ».' }, geste: 'Ouvre « Mes transactions ».' } };

async function ouvrir(nav, { largeur, hauteur, mobile, premiere, pm }) {
  const ctx = await nav.newContext(Object.assign({ locale: 'fr-FR', viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage(); const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  await pg.route('**/*', (r) => { const u = r.request().url();
    if (/logo-vrm-96\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    if (/img\.leboncoin\.fr\/banc\//.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mes annonces</title></head><body style="margin:0;background:#fff;font-family:sans-serif"><h1 style="padding:24px">Mes annonces (page factice)</h1></body></html>' }); });
  await pg.goto('https://www.leboncoin.fr/compte/part/mes-annonces');
  await pg.evaluate(({ e, js, ui, L, premiere }) => {
    window.__envoyes = []; window.__nListes = 0;
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const orig = Element.prototype.attachShadow; Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    window.chrome = { runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
      sendMessage: (msg, cb) => { window.__envoyes.push(copie(msg)); let rep = { ok: true };
        if (msg.action === 'etat') rep = copie(e);
        else if (msg.action === 'carteListes') { window.__nListes++; rep = window.__nListes === 1 && premiere ? copie(premiere) : copie(L); }
        else if (msg.action === 'capteLot') rep = { ok: true, lot: null };
        setTimeout(() => cb && cb(rep), 0); } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); }, remove: (k, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } } };
    const u = document.createElement('script'); u.textContent = ui; document.documentElement.appendChild(u);
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: ETAT, js: BADGE, ui: UI, L: LISTES(pm), premiere });
  await pg.waitForTimeout(300);
  return { ctx, pg, erreurs };
}
const R = (pg, f, a) => pg.evaluate(({ f, a }) => { const r = document.getElementById('vrm-badge') && document.getElementById('vrm-badge').shadowRoot; return r ? new Function('r', 'a', f)(r, a) : null; }, { f, a });
const clic = async (pg, sel) => { await R(pg, 'const b = r.querySelector(a); if (b) b.click(); return !!b;', sel); await pg.waitForTimeout(280); };
async function montrer(pg) { await R(pg, 'const b = r.querySelector(".btn"); if (b) b.click(); return !!b;'); await pg.waitForTimeout(500); }
const page = async (pg, p) => { await clic(pg, `.side6 [data-onglet-b="${p}"], [data-onglet-b="${p}"]`); };

(async () => {
  let pw; try { pw = require('playwright'); } catch (_) { console.log('playwright absent'); process.exit(1); }
  const nav = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const o of [{ nom: '1512', largeur: 1512, hauteur: 900, mobile: false }, { nom: '390', largeur: 390, hauteur: 844, mobile: true }]) {
      console.log(`— ${o.nom} px`);
      const t = await ouvrir(nav, Object.assign({}, o, { premiere: { ok: true, plateforme: 'leboncoin', compte: null, attente: 'compte' }, pm: { disponible: 0, aVenir: 0, at: T0 - 60000 } }));
      await montrer(t.pg);
      await page(t.pg, 'annonces');
      await t.pg.waitForTimeout(4600);   // la relecture seule (4 s)
      const an = await R(t.pg, 'return { pasLu: !!r.querySelector("[data-annonces=\\"pas_su\\"]"), n: r.querySelectorAll("[data-annonce]").length, txt: (r.querySelector(".corps6") || r).innerText.slice(0, 200), geste: !!r.querySelector("[data-lb-geste]") || /Mes transactions/.test((r.querySelector(".carte") || r).innerText) };');
      dit(an && !an.pasLu && an.n >= 1, `P1 ${o.nom} : 1re réponse « pas encore », la liste arrive seule (${an && an.n} annonces), jamais « pas pu être lues »`, JSON.stringify(an));
      dit(an && !an.geste, `P3 ${o.nom} : pas de « Ouvre « Mes transactions » » sur Annonces`);
      await t.pg.screenshot({ path: path.join(SORTIE, `${o.nom}-1-annonces.png`) });
      await page(t.pg, 'ventes');
      const v = await R(t.pg, 'return { n: r.querySelectorAll("[data-lb-liste=\\"vente\\"] [data-lb-tx-id]").length, etats: [...r.querySelectorAll("[data-lb-tx-id]")].map((x) => x.getAttribute("data-lb-etat")).join(","), suivre: r.querySelectorAll("[data-lb-suivre]").length, suivi: [...r.querySelectorAll("[data-suivi]")].map((x) => x.getAttribute("data-suivi")).join(","), inc: !!r.querySelector("[data-lb-inconnues]") };');
      dit(v && v.n === 3 && v.etats === 'a_expedier,en_route,finalisee', `P2 ${o.nom} : 3 ventes, chacune son état`, JSON.stringify(v));
      dit(v && v.suivre === 1 && v.suivi === '71911374,86672671', `P2 ${o.nom} : n° de suivi affichés, « Suivre » seulement avec une adresse`, JSON.stringify(v));
      dit(v && v.inc, `P2 ${o.nom} : la transaction au sens inconnu est dite à part`);
      await t.pg.screenshot({ path: path.join(SORTIE, `${o.nom}-2-ventes.png`) });
      await clic(t.pg, 'button[data-lb-sens="achats"]');
      const a = await R(t.pg, 'return { n: r.querySelectorAll("[data-lb-liste=\\"achat\\"] [data-lb-tx-id]").length, txt: [...r.querySelectorAll("[data-lb-tx-id] .et6")].map((x) => x.textContent).join(",") };');
      dit(a && a.n === 2 && /Payé/.test(a.txt) && /Reçu/.test(a.txt), `P2 ${o.nom} : Achats — 2 achats, « Payé » et « Reçu »`, JSON.stringify(a));
      await t.pg.screenshot({ path: path.join(SORTIE, `${o.nom}-3-achats.png`) });
      await page(t.pg, 'messages');
      const m = await R(t.pg, 'return (r.querySelector(".corps6") || r).innerText.slice(0, 400);');
      dit(/toujours disponible/.test(m || ''), `P5 ${o.nom} : la conversation rangée est dans Messagerie`, m);
      dit(!/Mes transactions/.test(m || ''), `P3 ${o.nom} : pas de « Ouvre « Mes transactions » » sur Messagerie`, m);
      await t.pg.screenshot({ path: path.join(SORTIE, `${o.nom}-4-messages.png`) });
      await page(t.pg, 'favoris');
      const fv = await R(t.pg, 'return { n: r.querySelectorAll("[data-lb-fav]").length, premier: (r.querySelector("[data-lb-fav]") || {}).innerText || "", note: !!r.querySelector("[data-favoris-site=\\"leboncoin\\"]"), ecrire: /écrire|message aux favoris/i.test((r.querySelector(".corps6") || r).innerText) };');
      dit(fv && fv.n === 5 && /4 favori/.test(fv.premier) && fv.note && !fv.ecrire, `P6 ${o.nom} : Favoris = le NOMBRE par annonce, aucun envoi proposé`, JSON.stringify(fv));
      await t.pg.screenshot({ path: path.join(SORTIE, `${o.nom}-6-favoris.png`) });
      await clic(t.pg, '[data-lb-baisser="3000000001"]');
      const bx = await R(t.pg, 'return !!r.querySelector("[data-prix-ligne=\\"3000000001\\"]");');
      dit(bx === true, `P6 ${o.nom} : « Baisser le prix » ouvre la baisse gardée pour CETTE annonce`);
      await page(t.pg, 'accueil');
      const ac = await R(t.pg, 'const p = r.querySelector("[data-accueil-porte]"); return { porte: p ? p.innerText : "", geste: !!r.querySelector("[data-lb-geste]") || /Mes transactions/.test((r.querySelector(".carte") || r).innerText) };');
      dit(ac && /0,00\s€/.test(ac.porte), `P4 ${o.nom} : porte-monnaie à 0 ⇒ « 0,00 € »`, JSON.stringify(ac));
      dit(ac && !ac.geste, `P3 ${o.nom} : ventes rangées ⇒ pas de « Ouvre « Mes transactions » » sur l’Accueil`);
      await t.pg.screenshot({ path: path.join(SORTIE, `${o.nom}-5-accueil.png`) });
      dit(!t.erreurs.length, `${o.nom} : aucune erreur dans la page`, t.erreurs.join(' | '));
      await t.ctx.close();
      const t2 = await ouvrir(nav, Object.assign({}, o, { pm: { disponible: 1250, aVenir: null, at: T0 } }));
      await montrer(t2.pg); await page(t2.pg, 'accueil');
      const p2 = await R(t2.pg, 'const p = r.querySelector("[data-accueil-porte]"); return p ? p.innerText : "";');
      dit(/vérifier/.test(p2 || '') && !/12,50|1\s?250/.test(p2 || ''), `P4 ${o.nom} : un solde non nul n’est jamais converti au hasard (« à vérifier »)`, p2);
      await t2.ctx.close();
    }
  } finally { await nav.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌   (captures : ${SORTIE})`);
  if (ko) process.exitCode = 1;
})();

require('./_porte-banc.cjs');
// ═══════════════════════════════════════════════════════════════════════════
//  BANC « APERÇUS DES NOTIFICATIONS » (8 nov.) — ce que l'écran verrouillé montre.
//
//  Les textes sortent des VRAIES fabriques (api/_lib/notif-apercus.js,
//  notif-textes.js, double-vente.js, transporteurs.js) passées par la VRAIE mise
//  en forme (api/_lib/notif-belle.js : sans emoji, titre ≤ 40, regroupement),
//  puis dessinés à la manière d'iOS, d'Android et de macOS. Données inventées.
//  Il juge : aucun emoji, aucun titre > 40 caractères, aucun titre réduit au nom
//  d'un transporteur, chaque notification a un corps.
//  Lancer : SHOTS=<dossier> CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/bancs/notifs-apercus.cjs
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs');
const R = path.join(__dirname, '..', '..');
const SHOTS = process.env.SHOTS || '';
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const imp = (f) => import('file://' + path.join(R, f));

(async () => {
  const A = await imp('api/_lib/notif-apercus.js');
  const T = await imp('api/_lib/notif-textes.js');
  const B = await imp('api/_lib/notif-belle.js');
  const DV = await imp('api/_lib/double-vente.js');
  const TR = await imp('api/_lib/transporteurs.js');
  const SC = await imp('api/_lib/suivi-colis.js');
  const dv = DV.notificationDoubleVente([{ numero: '124', plateforme: 'leboncoin', annonces: [{ id: '1' }] }], 'Nike Air Max 90 taille 42', { venduSur: 'vinted' });
  const brut = [
    ['Ventes', 'vente', A.texteVendu({ article: 'Nike Air Max 90 taille 42', prix: '65.00', compte: 'boutique_camille' }), 'Voir la vente', true],
    ['Double vente', 'doublevente', { title: dv.title || dv.titre, body: dv.body || dv.corps }, 'Retirer l’annonce'],
    ['Colis à poster', 'expedier', A.texteBordereau({ modele: 'Air Max 90', numero: '124', tamponne: true, dateLimite: '12/11' }), 'Imprimer'],
    ['Codes de retrait', 'colis', T.texteArrivee({ transporteur: 'Mondial Relay', lieu: 'Tabac des Halles, 8 Rue des Lilas, 44000 Nantes', code: '454602', limite: '2026-11-12' }), 'Voir le code'],
    ['Codes de retrait', 'colis', SC.texteRappelRetrait({ etat: 'dernier', transporteur: 'mondialrelay', lieu: 'Tabac des Halles, 8 Rue des Lilas, 44000 Nantes', suivi: '87654321' }), 'Voir le colis'],
    ['Codes de retrait', 'colis', TR.texteNotifTransp({ carrier: 'chronopost', suivi: 'XY123456789FR', detail: 'quitte_relais', lieuNom: 'Tabac des Halles' }, { etat: 'incident' }), 'Voir le colis'],
    ['Offres', 'offre', A.texteOffre({ montant: '55', qui: 'acheteur_92', article: 'Nike Air Max 90 taille 42', compte: 'boutique_camille' }), 'Répondre'],
    ['Messages', 'message', A.texteMessage({ paire: 'Nike Air Max 90 taille 42', qui: 'acheteur_92', compte: 'boutique_camille', extrait: 'Bonjour, elles taillent grand ?' }), 'Répondre'],
    ['Rappels', 'soir', A.texteSoir({ n: 3, auMoins: false, retard: 0, demain: 1, heureDemain: '12:00' }), 'Voir les colis'],
  ];
  const groupe = B.texteGroupe({ ...B.embellir(A.texteBordereau({ modele: 'Samba OG', numero: '131', tamponne: true, dateLimite: '13/11' }), 'expedier'), url: '/' }, B.GENRES.find((g) => g.id === 'bordereau'), 3);
  const items = brut.map(([fam, cat, t, action, photo]) => ({ fam, action, photo: !!photo, ...B.embellir(t, cat) }));
  items.splice(3, 0, { fam: 'Colis à poster', action: 'Imprimer', ...groupe, groupe: true });
  for (const n of items) {
    dit(!/\p{Extended_Pictographic}/u.test(n.title + n.body), `aucun emoji · ${n.title}`);
    dit(n.title.length <= 40 && n.body.length > 0, `titre ≤ 40 et un corps · ${n.title}`, `${n.title.length}`);
    dit(!/^(Mondial Relay|Chronopost|Colissimo|Vinted Go|DPD|VRM)$/.test(n.title), `le titre dit un fait · ${n.title}`);
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const icone = '../../../public/vrm-icon-v5-192.png';
  const ic = 'file://' + path.join(R, 'public', 'vrm-icon-v5-192.png');
  const badge = 'file://' + path.join(R, 'public', 'vrm-badge-96.png');
  void icone;
  const ios = (n, i) => `<div class="ios"><img class="ic" src="${ic}"><div class="c"><div class="h"><b>${esc(n.title)}</b><span>${i === 0 ? 'maintenant' : `il y a ${i * 4} min`}</span></div><div class="t">${esc(n.body)}</div></div>${n.photo ? '<div class="ph"></div>' : ''}</div>`;
  const and = (n) => `<div class="and"><div class="h"><img class="bd" src="${badge}"><span>VRM · ${esc(n.fam)} · maintenant</span></div><b>${esc(n.title)}</b><div class="t">${esc(n.body)}</div>${n.photo ? '<div class="ph big"></div>' : ''}${n.action ? `<div class="ac">${esc(n.action)}</div>` : ''}</div>`;
  const mac = (n) => `<div class="mac"><img class="ic" src="${ic}"><div class="c"><div class="h"><span>VRM</span><span>maintenant</span></div><b>${esc(n.title)}</b><div class="t">${esc(n.body)}</div></div>${n.action ? `<div class="ma">${esc(n.action)}</div>` : ''}</div>`;
  const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif;background:#111;color:#fff;display:flex;gap:28px;padding:24px;align-items:flex-start}
  h2{font:600 13px/1 inherit;letter-spacing:.06em;text-transform:uppercase;color:#aaa;margin:0 0 12px}
  .col{width:380px}
  .ecran-ios{background:linear-gradient(160deg,#3b4a6b,#1d2333 60%,#151821);border-radius:32px;padding:18px 12px}
  .ios{display:flex;gap:10px;align-items:flex-start;background:rgba(245,245,245,.78);color:#000;border-radius:20px;padding:11px 13px;margin-bottom:8px;backdrop-filter:blur(20px)}
  .ios .ic{width:36px;height:36px;border-radius:8px}.ios .c{flex:1;min-width:0}.ios .h{display:flex;justify-content:space-between;gap:8px}.ios .h b{font-size:15px;font-weight:600}.ios .h span{font-size:13px;color:#6e6e73;white-space:nowrap}.ios .t{font-size:15px;line-height:1.28;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
  .ph{width:36px;height:36px;border-radius:6px;background:linear-gradient(135deg,#d9d4cc,#9c8f7d)}.ph.big{width:100%;height:120px;margin-top:8px;border-radius:12px}
  .ecran-and{background:#1f1f22;border-radius:28px;padding:14px 10px}
  .and{background:#2d2f33;border-radius:22px;padding:12px 16px;margin-bottom:6px;color:#e8eaed}.and .h{display:flex;gap:8px;align-items:center;font-size:12px;color:#aab}.and .bd{width:16px;height:16px;background:#0a84ff;border-radius:50%;padding:2px}.and b{display:block;font-size:15px;margin-top:6px}.and .t{font-size:14px;color:#c9ccd1;line-height:1.3;margin-top:2px}.and .ac{margin-top:10px;font-size:14px;font-weight:600;color:#8ab4f8}
  .ecran-mac{background:linear-gradient(135deg,#7a8fb5,#c3a6a0);border-radius:14px;padding:16px}
  .mac{display:flex;gap:10px;align-items:flex-start;background:rgba(236,236,236,.9);color:#000;border-radius:14px;padding:10px 12px;margin-bottom:8px;box-shadow:0 4px 16px rgba(0,0,0,.18)}.mac .ic{width:32px;height:32px;border-radius:7px}.mac .c{flex:1;min-width:0;font-size:13px}.mac .h{display:flex;justify-content:space-between;color:#555;font-size:11px;text-transform:uppercase;letter-spacing:.02em}.mac b{display:block;font-size:13px;margin-top:1px}.mac .t{color:#333;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.mac .ma{align-self:center;font-size:12px;border:1px solid #bbb;border-radius:6px;padding:4px 8px;background:#fff;white-space:nowrap}
  </style>
  <div class="col"><h2>iPhone (écran verrouillé)</h2><div class="ecran-ios">${items.map(ios).join('')}</div></div>
  <div class="col"><h2>Android</h2><div class="ecran-and">${items.map(and).join('')}</div></div>
  <div class="col" style="width:420px"><h2>macOS (Chrome)</h2><div class="ecran-mac">${items.map(mac).join('')}</div></div>`;
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    const f = path.join(SHOTS, 'apercus-notifications.html');
    fs.writeFileSync(f, html);
    const { chromium } = require(path.join(R, 'node_modules', 'playwright'));
    const nav = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--allow-file-access-from-files'] });
    const pg = await nav.newPage({ viewport: { width: 1320, height: 900 } });
    await pg.goto('file://' + f);
    await pg.screenshot({ path: path.join(SHOTS, 'apercus-notifications.png'), fullPage: true });
    await nav.close();
  }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc a levé : ' + (e && e.stack || e)); process.exit(1); });

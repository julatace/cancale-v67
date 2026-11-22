// ═════════════════════════════════════════════════════════════════════════════
//  BANC « VENTE CONNUE PAR E-MAIL SEULEMENT » (22 nov., Julien : « j'ai fait une vente que j'ai reçue par mail, j'ai vu le
//  montant, mais ce n'est pas actualisé dans l'application ; elle n'a pas été captée sur Vinted, seulement par mail »).
//  La FORME mesurée en base (lecture seule, comptes) : l'e-mail de vente porte son n° de transaction, son prix, son titre,
//  sa photo ; l'e-mail du bordereau de la même transaction est arrivé ; la liste des ventes de CE compte a été lue la veille
//  (30 h avant), la transaction pas encore lue. Inventé ici à cette forme. On juge, au téléphone et à l'ordinateur :
//   1. Ventes « À envoyer » montre la vente (son titre, « par e-mail ») ;
//   2. Aujourd'hui : « Dernières ventes » la montre en tête, avec SON titre ; CA vendu et nombre de ventes du jour la comptent ;
//   3. plus tard, la liste relue porte la même transaction : UNE vente (CA et nombre inchangés, jamais doublés).
//  BANC_EMAIL_SANS=1 : la base sans l'e-mail (la référence des totaux). VUES=tel,ordi
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const B = require('./_bt-commun.cjs');
const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'vrm-bancs', 'bugs-totale-email');
fs.mkdirSync(SORTIE, { recursive: true });
const VUES = String(process.env.VUES || 'ordi,tel').split(',').map((x) => x.trim()).filter(Boolean);
const { dit, fin } = B.journal('bugs-totale-email');
const TITRE = 'Adidas gazelle bold rose taille 39';
const TX = 23999000777;

function poser(base, { email = true, capte = false } = {}) {
  const sold = base.rows.find((r) => /_orders_sold$/.test(r.id));
  const uid = sold.id.split('_')[1];
  // La liste de CE compte a été lue la veille.
  sold.data.capturedAt = new Date(Date.now() - 30 * 3600000).toISOString();
  const quand = new Date(Date.now() - 3 * 3600000).toISOString();
  if (email) {
    base.rows.push({ id: 'email_sale_bancemail0777', data: { type: 'vente', transaction: String(TX), uid: String(uid), receivedAt: quand, designation: TITRE, prix: '85', photo: '' } });
    base.rows.push({ id: `email_bord_${TX}`, data: { filename: `bordereau-${TX}.pdf`, transaction: String(TX), receivedAt: quand, suivi: 'XW' + TX, modele: 'x', numero: '', dateLimite: new Date(Date.now() + 4 * 86400000).toISOString(), pdfB64: 'JVBERi0' + 'x'.repeat(2000) } });
  }
  if (capte) {
    // Plus tard : la liste relue (maintenant) porte la vente, même transaction.
    sold.data.capturedAt = new Date(Date.now() - 60000).toISOString();
    sold.data.payload.my_orders.unshift({ transaction_id: TX, title: TITRE, price: { amount: '85.0', currency_code: 'EUR' }, status: 'Le paiement a été validé', date: quand, item_id: 7999000777, transaction_user_status: 'needs_action', photo: { url: '' } });
  }
  return uid;
}

async function lire(nav, ICI, vue, opts) {
  const base = B.fabriquer({ volumeReel: true, annonces: 300 });
  poser(base, opts.tard ? { email: false } : opts);
  const { ctx, pg, J } = await B.ouvrir(nav, vue, base);
  const cap = (n) => pg.screenshot({ path: path.join(SORTIE, `${vue}-${n}.png`) }).catch(() => {});
  await B.demarrer(pg, ICI, 'journee');
  await pg.locator('[data-toast-numeros] .n-toast-action').click({ timeout: 1500 }).catch(() => {});
  await pg.waitForTimeout(6000);
  if (opts.tard) {
    // L'app est DÉJÀ ouverte quand l'e-mail arrive (le cas de Julien) : il revient sur l'app (focus).
    const b2 = B.fabriquer({ volumeReel: true, annonces: 300 }); poser(b2, { email: true });
    for (const r of b2.rows) if (/^email_(sale|bord)_/.test(r.id) && /0777/.test(r.id)) base.rows.push(r);
    await pg.waitForTimeout(16000);
    await pg.evaluate(() => { window.dispatchEvent(new Event('focus')); });
    await pg.waitForTimeout(6000);
  }
  const j = await pg.evaluate(() => { const c = document.querySelector('[data-v2-bloc="chiffres"]'); return { vendu: c ? c.getAttribute('data-v2-jour-vendu') : null, ventes: c ? c.getAttribute('data-v2-jour-ventes') : null, dernieres: [...document.querySelectorAll('[data-v2-vente]')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()) }; });
  await cap('journee-' + Object.keys(opts).filter((k) => opts[k]).join('-'));
  await B.aller(pg, 'ventes', 5000);
  const v = await pg.evaluate((T) => { const corps = (document.querySelector('.vrm-main') || document.body).innerText.replace(/\s+/g, ' '); const i = corps.indexOf(T); return { present: i >= 0, n: corps.split(T).length - 1, autour: i >= 0 ? corps.slice(Math.max(0, i - 40), i + 120) : '' }; }, TITRE);
  await cap('ventes-' + Object.keys(opts).filter((k) => opts[k]).join('-'));
  const err = [...new Set(J.erreurs)].filter((x) => !/Service Worker registration blocked|language detection/.test(x));
  await ctx.close();
  return { j, v, err };
}

async function main() {
  const { srv, ICI } = await B.serveur();
  const nav = await B.navigateur();
  try {
    for (const vue of VUES) {
      const ref = await lire(nav, ICI, vue, { email: false });
      const m = await lire(nav, ICI, vue, { email: true });
      const cts = (x) => (x == null || x === '' ? NaN : Number(x));
      const c = await lire(nav, ICI, vue, { email: true, capte: true });
      const t = await lire(nav, ICI, vue, { email: true, tard: true });
      dit(vue, 'App déjà ouverte quand l\'e-mail arrive : au retour sur l\'app, la vente apparaît (Dernières ventes)', (t.j.dernieres[0] || '').includes(TITRE), t.j.dernieres.slice(0, 2).join(' | '));
      dit(vue, 'App déjà ouverte : le CA du jour la compte au retour', cts(t.j.vendu) - cts(ref.j.vendu) === 8500, `sans ${ref.j.vendu} · après ${t.j.vendu}`);
      dit(vue, 'Ventes « À envoyer » : la vente connue par e-mail se voit', m.v.present, m.v.autour);
      dit(vue, 'Aujourd\'hui : « Dernières ventes » la montre avec SON titre', (m.j.dernieres[0] || '').includes(TITRE), m.j.dernieres.slice(0, 2).join(' | '));
      dit(vue, 'Aujourd\'hui : le CA vendu du jour la compte (+85 €)', cts(m.j.vendu) - cts(ref.j.vendu) === 8500, `sans e-mail ${ref.j.vendu} · avec ${m.j.vendu}`);
      dit(vue, 'Aujourd\'hui : le nombre de ventes du jour la compte (+1)', cts(m.j.ventes) - cts(ref.j.ventes) === 1, `sans ${ref.j.ventes} · avec ${m.j.ventes}`);
      dit(vue, 'Plus tard, captée par l\'extension : UNE vente (CA +85 €, pas +170 €)', cts(c.j.vendu) - cts(ref.j.vendu) === 8500 && cts(c.j.ventes) - cts(ref.j.ventes) === 1, `avec e-mail + captée : ${c.j.vendu} / ${c.j.ventes}`);
      dit(vue, 'Plus tard : Ventes la montre une fois', c.v.n === 1, `${c.v.n} fois`);
      for (const [k, x] of [['réf.', ref], ['e-mail', m], ['captée', c]]) dit(vue, `aucune erreur (${k})`, !x.err.length, x.err.slice(0, 3).join(' ¦ '));
    }
  } finally { await nav.close(); srv.close(); }
  process.exit(fin(SORTIE) ? 1 : 0);
}
main();

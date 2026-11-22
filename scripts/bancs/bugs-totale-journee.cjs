// ═════════════════════════════════════════════════════════════════════════════
//  BANC « BUGS-TOTALE — MA JOURNÉE » (22 nov.) — deux défauts vus sur Ma journée de Julien (production, ordinateur) :
//   1. « Bénéfice brut · Ouvrir Ventes » et « Bénéfice net · Ouvrir Ventes » : une vente du jour n'est jamais FINALISÉE le
//      jour même, et le bénéfice publié ne comptait que les finalisées ⇒ jamais de bénéfice du jour.
//   2. « Dernières ventes » : « Vente Vinted · il y a 2 h · 85 € » sans titre, sans photo, sans N° — une vente fraîche connue
//      par son E-MAIL (avant la relecture de la liste) n'était cherchée que dans la liste.
//  La base inventée est RÉALISTE sur ces deux points (la base de volume rangeait des ventes finalisées le jour même) :
//   · les ventes d'aujourd'hui sont « Le paiement a été validé » (en cours), un prix d'achat posé sur deux d'entre elles ;
//   · une vente reçue par e-mail il y a quelques secondes, dont la transaction désigne une annonce lue (son titre).
//  VUES=tel,ordi  SORTIE=<dossier>
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const B = require('./_bt-commun.cjs');
const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'vrm-bancs', 'bugs-totale-journee');
fs.mkdirSync(SORTIE, { recursive: true });
const VUES = String(process.env.VUES || 'ordi,tel').split(',').map((x) => x.trim()).filter(Boolean);
const { dit, fin } = B.journal('bugs-totale-journee');

function realiste(base) {
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const ov = base.main[0].data.vinted_sale_overrides;
  let prix = 0, txMail = null, item = null, titreAnnonce = '', uid = null;
  for (const r of base.rows) {
    const p = r.data && r.data.payload;
    if (/_orders_sold$/.test(r.id) && p && Array.isArray(p.my_orders)) {
      for (const o of p.my_orders) {
        if (Date.parse(o.date) >= auj.getTime()) {
          o.status = 'Le paiement a été validé'; o.transaction_user_status = 'needs_action';
          if (prix < 2) { ov[String(o.transaction_id)] = { ...(ov[String(o.transaction_id)] || {}), buyPrice: '10' }; prix++; }
        }
      }
    }
    if (/_txn_\d+$/.test(r.id) && p && p.transaction && p.transaction.status === 450 && Date.parse(p.transaction.status_updated_at || '') >= auj.getTime()) {
      p.transaction.status = 300; p.transaction.status_title = 'Le paiement a été validé';
    }
    if (!item && /_listings$/.test(r.id) && p && Array.isArray(p.items)) { const a = p.items.find((x) => !x.is_closed); if (a) { item = a.id; titreAnnonce = a.title; uid = r.id.split('_')[1]; } }
  }
  txMail = 23999000001;
  base.rows.push({ id: `harvest_${uid}_txn_${txMail}`, data: { capturedAt: new Date().toISOString(), payload: { transaction: { id: txMail, item_id: item, status: 300, status_title: 'Le paiement a été validé', status_updated_at: new Date().toISOString() } } } });
  base.rows.push({ id: 'email_sale_bancjournee01', data: { type: 'vente', transaction: String(txMail), uid: String(uid), receivedAt: new Date(Date.now() + 5000).toISOString(), designation: '', prix: '85' } });
  return { prix, titreAnnonce, txMail };
}

async function main() {
  const { srv, ICI } = await B.serveur();
  const nav = await B.navigateur();
  try {
    for (const vue of VUES) {
      const base = B.fabriquer({ volumeReel: true, annonces: 300 });
      const R = realiste(base);
      const { ctx, pg, J } = await B.ouvrir(nav, vue, base);
      const cap = (n) => pg.screenshot({ path: path.join(SORTIE, `${vue}-${n}.png`) }).catch(() => {});
      try {
        await B.demarrer(pg, ICI, 'journee');
        await pg.locator('[data-toast-numeros] .n-toast-action').click({ timeout: 1500 }).catch(() => {});
        await pg.waitForTimeout(6000);
        const t = await pg.evaluate(() => {
          const tuile = (k) => { const e = document.querySelector(`[data-v2-stat="${k}"]`); return e ? { valeur: e.getAttribute('data-benef-valeur'), porte: e.getAttribute('data-v2-porte') || '', texte: e.innerText.replace(/\s+/g, ' ').trim() } : null; };
          const ventes = [...document.querySelectorAll('[data-v2-vente]')].map((e) => e.innerText.replace(/\s+/g, ' ').trim());
          return { brut: tuile('brut'), net: tuile('net'), ventes, periode: (document.querySelector('[data-v2-periode]') || {}).getAttribute ? document.querySelector('[data-v2-periode]').getAttribute('data-v2-periode') : '' };
        });
        await cap('journee');
        dit(vue, `Bénéfice brut du jour : une valeur (2 ventes au prix d'achat connu) — jamais « Ouvrir Ventes »`, t.brut && t.brut.valeur !== '' && t.brut.porte !== 'ventes', JSON.stringify(t.brut));
        dit(vue, 'Bénéfice net du jour : une valeur — jamais « Ouvrir Ventes »', t.net && t.net.valeur !== '' && t.net.porte !== 'ventes', JSON.stringify(t.net));
        const v0 = t.ventes[0] || '';
        dit(vue, 'Dernières ventes : la vente reçue par e-mail porte le titre de SON annonce (par la transaction)', v0.includes(R.titreAnnonce) && !/^Vente Vinted/.test(v0), `« ${v0} » · attendu « ${R.titreAnnonce} »`);
        dit(vue, 'Dernières ventes : aucune rangée « Vente Vinted » sans titre', !t.ventes.some((x) => /^Vente Vinted\b/.test(x)), t.ventes.join(' | '));
        const err = [...new Set(J.erreurs)].filter((x) => !/Service Worker registration blocked|language detection/.test(x));
        dit(vue, 'aucune erreur', !err.length, err.slice(0, 4).join(' ¦ '));
      } catch (e) { dit(vue, 'le parcours a pu jouer', false, e && e.message); }
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  process.exit(fin(SORTIE) ? 1 : 0);
}
main();

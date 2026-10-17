#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  EXTENSION 5.186 — la FORME d'une demande de retrait, la COULEUR Vinted.
//  Exécute le VRAI `background.js` dans un `vm` (`_fond-vm.cjs`), données
//  inventées (dépôt public).
//  1. `POST /api/v2/users/{id}/payouts` vu par la page : la ligne `wreq` garde
//     les NOMS de clés et leurs TYPES, jamais une valeur (ni montant, ni IBAN),
//     et le corps reste retiré ;
//  2. une autre écriture sensible (carte bancaire) ne gagne PAS de forme ;
//  3. la page d'une annonce donne sa couleur (`color1`/`color2`, texte ou
//     objet `{title}`), rangée par `saveItemDetail` sans jamais être écrasée
//     par du vide, et l'annonce Leboncoin la porte (`ad.couleur`).
//  `--src chemin` : la preuve sur le code d'avant (§6.1).
// ════════════════════════════════════════════════════════════════════════════
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
let ko = 0;
const dit = (ok, quoi, detail) => { console.log((ok ? '✅ ' : '❌ ') + quoi + (ok || !detail ? '' : ' — ' + detail)); if (!ok) ko++; };
const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + (e && e.message)); } };

(async () => {
  const src = cheminSource();
  await essaie('forme d’une demande de retrait', async () => {
    const { ctx, lignes } = faireFond({ src });
    const corps = JSON.stringify({ payout: { amount: '123.45', currency: 'EUR', bank_account_id: 987654, iban: 'FR7612345678901234567890123' } });
    await ctx.storeWriteReq('www.vinted.fr', 'POST', 'https://www.vinted.fr/api/v2/users/111/payouts', corps);
    const cle = Object.keys(lignes).find((k) => /_wreq_.*payouts/.test(k));
    const d = cle ? lignes[cle] : null;
    dit(!!d, 'la demande de retrait est notée (chemin)', Object.keys(lignes).join(','));
    const forme = d && Array.isArray(d.forme) ? d.forme : [];
    dit(forme.includes('payout.amount:string') && forme.includes('payout.bank_account_id:number') && forme.includes('payout.iban:string'),
      'et sa FORME : noms de clés + types', JSON.stringify(d && d.forme));
    const tout = JSON.stringify(d || {});
    dit(!/123\.45|987654|FR76|EUR/.test(tout), 'aucune VALEUR ne part (ni montant, ni compte, ni IBAN, ni devise)', tout.slice(0, 200));
    dit(d && /retiré/.test(d.body), 'le corps reste retiré', d && d.body);
  });
  await essaie('écriture bancaire sans forme', async () => {
    const { ctx, lignes } = faireFond({ src });
    await ctx.storeWriteReq('www.vinted.fr', 'POST', 'https://www.vinted.fr/api/v2/credit_cards', JSON.stringify({ number: '4111111111111111' }));
    const d = Object.values(lignes)[0] || {};
    dit(d.forme === undefined && !/4111/.test(JSON.stringify(d)), 'une carte bancaire ne gagne PAS de forme, et rien de son contenu ne part', JSON.stringify(d).slice(0, 160));
  });
  await essaie('couleur de l’annonce', async () => {
    const { ctx, lignes } = faireFond({ src });
    const page = (c1, c2) => '<script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { item: { id: 4242, photos: [{ full_size_url: 'https://images1.vinted.net/t/a/f800/x.jpg' }], description: 'Très propre', color1: c1, color2: c2, catalog_id: 1 } } }) + '</script>';
    const d1 = ctx.extraireDetailPage(page('Gris', undefined), 4242);
    dit(d1 && d1.couleur === 'Gris', 'la couleur affichée par Vinted est lue sur la page (« Gris »)', JSON.stringify(d1 && d1.couleur));
    const d2 = ctx.extraireDetailPage(page({ title: 'Blanc' }, 'Noir'), 4242);
    dit(d2 && d2.couleur === 'Blanc / Noir', 'deux couleurs, dont une en objet {title} : « Blanc / Noir »', JSON.stringify(d2 && d2.couleur));
    const d3 = ctx.extraireDetailPage(page(undefined, undefined), 4242);
    dit(d3 && d3.couleur === '', 'pas de couleur sur la page ⇒ rien d’inventé', JSON.stringify(d3 && d3.couleur));
    await ctx.saveItemDetail(4242, { description: 'x', photos: ['https://images1.vinted.net/t/a/f800/x.jpg'], couleur: 'Gris' });
    dit(lignes.vinted_item_details && lignes.vinted_item_details['4242'] && lignes.vinted_item_details['4242'].couleur === 'Gris', 'la couleur est rangée avec le détail de l’annonce');
    await ctx.saveItemDetail(4242, { description: 'x', photos: [], couleur: '' });
    dit(lignes.vinted_item_details['4242'].couleur === 'Gris', 'une relecture sans couleur ne l’efface pas');
    const ad = ctx.buildLbcAd({ id: 4242, title: 'Salomon XT-6', brand: 'Salomon', size: '40', status: 'Très bon état', price: { amount: '99' } }, lignes.vinted_item_details['4242'], '401', 'compte');
    dit(ad && ad.couleur === 'Gris', 'l’annonce Leboncoin porte la couleur (pour la liste Couleur)', JSON.stringify(ad && ad.couleur));
    dit(ad && ad.marque === 'Salomon', 'et la marque du dressing (`brand`)', JSON.stringify(ad && ad.marque));
  });
  console.log(ko ? `\n${ko} contrôle(s) rouge(s).` : '\n✅ extension 5.186 : forme du retrait et couleur — tout est vert');
  process.exit(ko ? 1 : 0);
})();

// ════════════════════════════════════════════════════════════════════════════
//  LES ACHATS LEBONCOIN ET VESTIAIRE DANS LA FEUILLE « RELIER UN ACHAT »
//  (16 nov. 2026, lot plateformes-restes, point 40)
// ════════════════════════════════════════════════════════════════════════════
// La feuille « Relier un achat » ne montrait que les achats Vinted captés. Ses
// achats Leboncoin (relevés par l'extension dans `lbc_ventes`, côté ACHETEUR :
// `isSeller === false`, jamais déduit) et Vestiaire (`vc_achats`, 5.239) y entrent
// sous la MÊME forme que ceux de Vinted, avec une identité préfixée par le site :
//   · Leboncoin : `lbc:{n° de transaction}` ;
//   · Vestiaire : `vc:{n° de commande Vestiaire}` (la clé de `vc_achats.achats`).
// C'est toujours SON clic sur UNE ligne qui relie (`buyFromId` = cette identité) —
// avec 50 achats au même titre, le clic décide seul (§5).
//
// Le PRIX proposé n'est que ce que la ligne porte, sous une forme MESURÉE :
//   · Leboncoin : `prixListe` (centimes) = le total payé par l'acheteur (article, frais,
//     port) — mesuré le 16 nov. en lecture seule sur 7 achats (`price` = l'article seul,
//     `prixListe` ≥ `price` sur les 7). Absent ou illisible ⇒ aucun prix (il le tape, §2.5) ;
//   · Vestiaire : aucun achat Vestiaire n'a encore été relevé en base (forme jamais vue) ⇒
//     AUCUN prix n'est proposé, seulement le titre, la photo et la date.
// Une transaction annulée n'est pas proposée. eBay : ses achats se lisent à la demande
// chez eBay (route `achats`, sur SON jeton) — ils ne sont pas rangés ici ⇒ pas dans la feuille.
// Module PUR : App.jsx et scripts/audit-plateformes-restes.cjs l'EXÉCUTENT.

const txt = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const dateOk = (d) => { const s = txt(d); return s && !isNaN(Date.parse(s)) ? s : ''; };
const photoOk = (u) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : '');

export const SITE_ACHAT = { lbc: 'leboncoin', vc: 'vestiaire' };
export const siteDeAchat = (a) => {
  const m = /^(lbc|vc):/.exec(String((a && a.transaction_id) || ''));
  return m ? SITE_ACHAT[m[1]] : 'vinted';
};

export function achatsAutresPourRelier({ lbcAchats = null, vcAchats = null, annulee = null } = {}) {
  const out = [];
  for (const o of (Array.isArray(lbcAchats) ? lbcAchats : [])) {
    if (!o || o.isSeller !== false || !ID.test(txt(o.txId))) continue;
    if (typeof annulee === 'function' && annulee(o)) continue;
    const c = Number(o.prixListe);
    const prix = Number.isFinite(c) && Number.isInteger(c) && c > 0 ? c / 100 : null;
    out.push({
      transaction_id: 'lbc:' + txt(o.txId), _site: 'leboncoin', title: txt(o.title), date: dateOk(o.dateVente),
      ...(prix != null ? { price: { amount: String(prix), currency_code: 'EUR' } } : {}),
      photo: photoOk(o.image) || null, status: txt(o.stepLabel), compteSite: txt(o.accountName || ''),
    });
  }
  const vc = vcAchats && typeof vcAchats === 'object' && !Array.isArray(vcAchats) ? vcAchats : {};
  for (const [id, a] of Object.entries(vc)) {
    if (!a || typeof a !== 'object' || !ID.test(txt(id))) continue;
    if (/annul/i.test(txt(a.etat))) continue;
    out.push({ transaction_id: 'vc:' + txt(id), _site: 'vestiaire', title: txt(a.nom), date: dateOk(a.date), photo: photoOk(a.photo) || null, status: txt(a.etat), compteSite: '' });
  }
  return out;
}

// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { motsVendeur } from '../profilVendeur.js';
import { C, commandeEbayEngagee, etapeVente, lbcAnnulee, lbcEuro, lbcFinalisee, prixCourt, rechercheParNumero } from '../App.jsx';


// ⟦← App.jsx #1⟧
function ToutSurLeNumero({ q, numData, comptes, onNav, onStock, onChercher, onFiche }) {
  const lecture = !numData;
  const { rn, nd, shipDone } = rechercheParNumero(q, numData, comptes);
  if (rn.etat === 'invalide') return null;
  const k = rn.cle;
  const jour = (d) => { const t = new Date(d); return isNaN(t.getTime()) ? '' : t.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
  const lien = { minHeight: 44, background: 'transparent', border: 0, padding: 0, color: C.text, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 };
  const ligne = (cle, attrs, titre, detail, onClick) => (
    <button key={cle} type="button" className="vrm-tout-num-ligne" {...attrs} onClick={onClick}
      style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginTop: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: C.text }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titre}</span>
        {detail && <span style={{ display: 'block', fontSize: 12, color: C.muted, marginTop: 2 }}>{detail}</span>}
      </span>
      <span aria-hidden="true" style={{ fontSize: 17, color: C.muted }}>›</span>
    </button>
  );
  const titreSec = (t) => <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, margin: '12px 2px 2px' }}>{t}</div>;
  const ETAT_ANN = { 'en-ligne': 'En ligne sur Vinted', 'a-confirmer': 'À confirmer (dernière lecture ancienne)', masquee: 'Masquée par Vinted, toujours chez toi', 'plus-en-ligne': 'Plus en ligne', passu: 'Annonces pas encore lues' };
  const ETAT_BORD = { pret: 'Prêt à imprimer', imprime: 'Imprimé', poste: 'Posté', attente: 'En attente du PDF' };
  const { vinted, lbc, ebay } = rn.ventes;
  const rien = rn.etat === 'rien';
  const rienDautre = !rn.annonces.length && !vinted.length && !lbc.length && !ebay.length && !rn.annoncesEbay.length && !rn.stock && !rn.reattribues.length;
  return (
    <div data-tout-num={k} data-tout-etat={lecture && rn.etat !== 'trouve' ? 'lecture' : rn.etat} data-tout-lecture={lecture ? '1' : '0'} style={{ marginTop: 10, padding: '10px 12px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Tout sur le N°{k}</div>
      {/* (1er nov.) La fiche complète : le parcours de CETTE paire, par identité. */}
      {onFiche && rn.etat === 'trouve' && ligne('parcours', { 'data-tout-parcours': k }, `Toute l'histoire du N°${k}`, 'Achat, stock, annonces, vente, colis, argent', () => onFiche(k))}
      {rn.ancienNumero && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Un ancien numéro (d'avant la remise à zéro) : il ne désigne que l'histoire.</div>}
      {rn.double && (
        <div data-tout-double="1" role="alert" style={{ marginTop: 8, padding: '8px 10px', borderRadius: 12, border: `1px solid ${C.doublon}`, color: C.doublon, fontSize: 13, fontWeight: 600 }}>
          Deux {motsVendeur().noms} présent{motsVendeur().e}s portent le N°{k}. Vérifie là où {motsVendeur().elle}s sont rangé{motsVendeur().e}s avant d'imprimer un bordereau.
          <button type="button" onClick={() => onNav('cat_annonces')} style={{ ...lien, display: 'block', marginTop: 4, color: C.doublon }}>Voir dans Annonces</button>
        </div>
      )}
      {rn.reattribues.map((r) => (
        <div key={'r' + r.id + r.sens} data-tout-reattribue={r.sens} style={{ marginTop: 8, fontSize: 13, color: C.text }}>
          {r.sens === 'parti'
            ? <>Le N°{r.de} a été remplacé (doublon réglé) : « {r.title || 'un article'} » porte maintenant le <b>N°{r.vers}</b>. </>
            : <>Ce numéro remplace le N°{r.de} (doublon réglé){r.ecrit ? '.' : ' — pas encore écrit là où l’article est rangé.'}</>}
          {r.sens === 'parti' && <button type="button" onClick={() => onChercher(r.vers)} style={lien}>Voir le N°{r.vers}</button>}
        </div>
      ))}
      {rn.annonces.length > 0 && titreSec('L\'article')}
      {rn.annonces.map((a) => ligne('a' + a.id, { 'data-tout-annonce': a.id, 'data-tout-annonce-etat': a.etat }, a.title || '(sans titre)', ETAT_ANN[a.etat] + (a.price ? ' · ' + prixCourt(String(a.price).replace(',', '.')) : ''), () => onNav('cat_annonces')))}
      {(vinted.length + lbc.length + ebay.length + rn.annoncesEbay.length) > 0 && titreSec('Ventes et autres plateformes')}
      {vinted.map((o) => ligne('v' + o._tx, { 'data-tout-vente': 'vinted', 'data-tout-tx': o._tx }, o.title || '(sans titre)', `Vente Vinted · ${etapeVente(o, { poste: (x) => !!shipDone[String(x.transaction_id)] }).label}${o.date ? ' · ' + jour(o.date) : ''}`, () => onNav('cat_ventes', { type: 'vente', tx: String(o._tx) })))}
      {lbc.map((v) => ligne('l' + v._id, { 'data-tout-vente': 'leboncoin' }, v.title || '(sans titre)', `Vente Leboncoin · ${lbcAnnulee(v) ? 'annulée' : lbcFinalisee(v) ? 'finalisée' : 'en cours'}${v.price != null ? ' · ' + lbcEuro(v.price) : ''}`, () => onNav('plat_leboncoin')))}
      {ebay.map((c) => ligne('e' + c.orderId, { 'data-tout-vente': 'ebay' }, ((c.lineItems || [])[0] || {}).title || 'Commande eBay', `Vente eBay · ${commandeEbayEngagee(c) ? 'payée' : 'annulée ou remboursée'}${c.creationDate ? ' · ' + jour(c.creationDate) : ''}`, () => onNav('ebay_ventes')))}
      {rn.annoncesEbay.map((a) => ligne('ea' + a.itemId, { 'data-tout-annonce-ebay': String(a.itemId) }, a.title || 'Annonce eBay', 'En vente sur eBay', () => onNav('ebay_annonces')))}
      {rn.bordereaux.length > 0 && titreSec('Bordereau')}
      {rn.bordereaux.map((b) => ligne('b' + b.tx, { 'data-tout-bord': b.tx, 'data-tout-bord-etat': b.etat }, ETAT_BORD[b.etat], 'Colis de la vente Vinted', () => onNav('cat_bord', b.etat === 'poste' ? null : { type: 'colis', tx: String(b.tx) })))}
      {(rn.stock || rn.annonces.length > 0) && titreSec('Stock')}
      {rn.stock
        ? ligne('s', { 'data-tout-stock': rn.stock.itemName || 'range' }, `Rangé : ${rn.stock.itemName || 'un meuble'}`, [rn.stock.roomName, rn.stock.nom].filter(Boolean).join(' · '), () => onStock(k))
        : rn.annonces.length > 0 && <div data-tout-stock="" style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{rn.manques.includes('ton Stock') ? 'Stock pas encore lu.' : 'Pas rangé dans le Stock.'}</div>}
      {rn.etat === 'trouve' && rienDautre && rn.servi &&
        <div data-tout-servi="1" style={{ fontSize: 13, color: C.text, marginTop: 8 }}>Ce numéro a déjà servi, mais aucune fiche ne le porte aujourd'hui.</div>}
      {rien && <div data-tout-rien="1" style={{ fontSize: 13, color: C.text, marginTop: 8 }}>Le N°{k} n'a jamais servi.</div>}
      {!rien && rn.manques.length > 0 && (
        <div data-tout-manques={rn.manques.length} style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
          {lecture ? 'Lecture en cours…' : `Pas pu lire : ${rn.manques.join(', ')}.`}{rn.etat === 'passu' && !lecture ? ' Rien trouvé dans le reste — réessaie dans un instant.' : ''}
        </div>
      )}
      {rn.ancien && (
        <button type="button" data-tout-ancien={rn.ancien} onClick={() => onChercher(rn.ancien)} style={{ ...lien, display: 'block', marginTop: 4 }}>
          L'ancien N°{rn.ancien} existe aussi (d'avant la remise à zéro) — le voir
        </button>
      )}
    </div>
  );
}
export { ToutSurLeNumero };

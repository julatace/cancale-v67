// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { motsVendeur } from '../profilVendeur.js';
import { tr } from '../i18n/index.js';
import { LogoSite } from '../natif/LogoSite.jsx';   // (25 nov., moins-texte-a) le site se DESSINE (« Vente Vinted » n'est plus écrit)
import { C, commandeEbayEngagee, etapeVente, lbcAnnulee, lbcEuro, lbcFinalisee, prixCourt, rechercheParNumero } from '../App.jsx';


// ⟦← App.jsx #1⟧
function ToutSurLeNumero({ q, numData, comptes, onNav, onStock, onChercher, onFiche }) {
  const lecture = !numData;
  const { rn, nd, shipDone } = rechercheParNumero(q, numData, comptes);
  if (rn.etat === 'invalide') return null;
  const k = rn.cle;
  const jour = (d) => { const t = new Date(d); return isNaN(t.getTime()) ? '' : t.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
  const lien = { minHeight: 44, background: 'transparent', border: 0, padding: 0, color: C.text, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 };
  // (25 nov., moins-texte-a) `site` : son logo devant la ligne grise (le nom du site n'est plus écrit).
  const ligne = (cle, attrs, titre, detail, onClick, site = null) => (
    <button key={cle} type="button" className="vrm-tout-num-ligne" {...attrs} onClick={onClick}
      style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', margin: 0, background: 'transparent', border: 0, borderTop: '0.5px solid var(--d-filet)', borderRadius: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: C.text }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titre}</span>
        {detail && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 400, color: C.muted, marginTop: 2 }}>{site ? <LogoSite site={site} taille={14} nom={{ vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire Collective' }[site] || site}/> : null}<span>{detail}</span></span>}
      </span>
      <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1, color: 'var(--d-glyphe)' }}>›</span>
    </button>
  );
  const titreSec = (t) => <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, margin: '16px 0 4px' }}>{t}</div>;
  const ETAT_ANN = { 'en-ligne': tr('mta.loupe.enLigne'), 'a-confirmer': 'À confirmer (dernière lecture ancienne)', masquee: 'Masquée par Vinted, toujours chez toi', 'plus-en-ligne': 'Plus en ligne', passu: 'Annonces pas encore lues' };
  const ETAT_BORD = { pret: 'Prêt à imprimer', imprime: 'Imprimé', poste: 'Posté', attente: 'En attente du PDF' };
  const { vinted, lbc, ebay } = rn.ventes;
  const rien = rn.etat === 'rien';
  const rienDautre = !rn.annonces.length && !vinted.length && !lbc.length && !ebay.length && !rn.annoncesEbay.length && !rn.stock && !rn.importe && !rn.reattribues.length;
  return (
    <div data-tout-num={k} data-tout-etat={lecture && rn.etat !== 'trouve' ? 'lecture' : rn.etat} data-tout-lecture={lecture ? '1' : '0'} style={{ marginTop: 12, padding: '12px 16px 8px', background: 'var(--d-carte)', border: 0, borderRadius: 'var(--d-r-carte)', boxShadow: 'var(--d-ombre-carte)' }}>
      {/* (25 nov., moins-texte-a) « Tout sur le N°5 » ⇒ « N°5 » à l'œil ; la phrase entière au lecteur d'écran. */}
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.012em', color: C.text, marginBottom: 4 }}><span className="vrm-sr-seul">{tr('a11y.fiche.nom', { n: k })}</span><span aria-hidden="true">N°{k}</span></div>
      {/* (1er nov.) La fiche complète : le parcours de CETTE paire, par identité. */}
      {onFiche && rn.etat === 'trouve' && ligne('parcours', { 'data-tout-parcours': k, 'aria-label': `Toute l'histoire du N°${k} · Achat, stock, annonces, vente, colis, argent` }, tr('mta.loupe.histoire'), null, () => onFiche(k))}
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
      {rn.annonces.map((a) => ligne('a' + a.id, { 'data-tout-annonce': a.id, 'data-tout-annonce-etat': a.etat }, a.title || '(sans titre)', ETAT_ANN[a.etat] + (a.price ? ' · ' + prixCourt(String(a.price).replace(',', '.')) : ''), () => (onFiche && rn.etat === 'trouve' ? onFiche(k) : onNav('cat_annonces')), a.etat === 'en-ligne' ? 'vinted' : null))}
      {(vinted.length + lbc.length + ebay.length + rn.annoncesEbay.length) > 0 && titreSec(tr('mta.loupe.ventes'))}
      {vinted.map((o) => ligne('v' + o._tx, { 'data-tout-vente': 'vinted', 'data-tout-tx': o._tx }, o.title || '(sans titre)', `${etapeVente(o, { poste: (x) => !!shipDone[String(x.transaction_id)] }).label}${o.date ? ' · ' + jour(o.date) : ''}`, () => onNav('cat_ventes', { type: 'vente', tx: String(o._tx) }), 'vinted'))}
      {lbc.map((v) => ligne('l' + v._id, { 'data-tout-vente': 'leboncoin' }, v.title || '(sans titre)', `${lbcAnnulee(v) ? 'annulée' : lbcFinalisee(v) ? 'finalisée' : 'en cours'}${v.price != null ? ' · ' + lbcEuro(v.price) : ''}`, () => onNav('plat_leboncoin'), 'leboncoin'))}
      {ebay.map((c) => ligne('e' + c.orderId, { 'data-tout-vente': 'ebay' }, ((c.lineItems || [])[0] || {}).title || 'Commande eBay', `${commandeEbayEngagee(c) ? 'payée' : 'annulée ou remboursée'}${c.creationDate ? ' · ' + jour(c.creationDate) : ''}`, () => onNav('ebay_ventes'), 'ebay'))}
      {rn.annoncesEbay.map((a) => ligne('ea' + a.itemId, { 'data-tout-annonce-ebay': String(a.itemId) }, a.title || 'Annonce eBay', tr('mta.loupe.enVente'), () => onNav('ebay_annonces'), 'ebay'))}
      {rn.bordereaux.length > 0 && titreSec('Bordereau')}
      {rn.bordereaux.map((b) => ligne('b' + b.tx, { 'data-tout-bord': b.tx, 'data-tout-bord-etat': b.etat }, ETAT_BORD[b.etat], null, () => onNav('cat_bord', b.etat === 'poste' ? null : { type: 'colis', tx: String(b.tx) })))}
      {(rn.stock || rn.importe || rn.annonces.length > 0) && titreSec('Stock')}
      {/* (16 nov., lot ecrans-restes) La paire importée d'un autre outil sous CE N° (par le N°, jamais un titre). */}
      {rn.importe && ligne('imp', { 'data-tout-importe': rn.importe.numero }, rn.importe.titre || tr('er.loupe.importeeSansTitre'),
        [tr('er.loupe.importee'), rn.importe.emplacement ? tr('er.loupe.emplacement', { lieu: rn.importe.emplacement }) : '', rn.importe.prix != null ? tr('er.loupe.achat', { prix: prixCourt(String(rn.importe.prix).replace(',', '.')) }) : ''].filter(Boolean).join(' · '),
        () => (onFiche ? onFiche(k) : onStock(k)))}
      {rn.stock
        ? ligne('s', { 'data-tout-stock': rn.stock.itemName || 'range' }, `Rangé : ${rn.stock.itemName || 'un meuble'}`, [rn.stock.roomName, rn.stock.nom].filter(Boolean).join(' · '), () => onStock(k))
        : rn.annonces.length > 0 && !rn.importe && <div data-tout-stock="" style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{rn.manques.includes('ton Stock') ? 'Stock pas encore lu.' : 'Pas rangé dans le Stock.'}</div>}
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

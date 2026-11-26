// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { motsVendeur } from '../profilVendeur.js';
import { tr } from '../i18n/index.js';
import { C, commandeEbayEngagee, etapeVente, lbcAnnulee, lbcEuro, lbcFinalisee, prixCourt, rechercheParNumero, PhotoVinted, orderPhoto, Icon } from '../App.jsx';
import { EnteteArticle } from '../natif/Article.jsx';
import { Plaque } from '../natif/Plaque.jsx';


// ⟦← App.jsx #1⟧
function ToutSurLeNumero({ q, numData, comptes, onNav, onStock, onChercher, onFiche }) {
  const lecture = !numData;
  const { rn, nd, shipDone } = rechercheParNumero(q, numData, comptes);
  if (rn.etat === 'invalide') return null;
  const k = rn.cle;
  const jour = (d) => { const t = new Date(d); return isNaN(t.getTime()) ? '' : t.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
  const lien = { minHeight: 44, background: 'transparent', border: 0, padding: 0, color: C.text, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 };
  const ligne = (cle, attrs, titre, detail, onClick, icone) => (
    <button key={cle} type="button" className="vrm-tout-num-ligne" {...attrs} onClick={onClick}
      style={{ width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', margin: 0, background: 'transparent', border: 0, borderTop: '0.5px solid var(--d-filet)', borderRadius: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: C.text }}>
      {icone ? <span className="vrm-tout-num-ico" aria-hidden="true"><Icon name={icone} size={17}/></span> : null}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titre}</span>
        {detail && <span style={{ display: 'block', fontSize: 13, fontWeight: 400, color: C.muted, marginTop: 2 }}>{detail}</span>}
      </span>
      <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1, color: 'var(--d-glyphe)' }}>›</span>
    </button>
  );
  const titreSec = (t) => <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, margin: '16px 0 4px' }}>{t}</div>;
  const ETAT_ANN = { 'en-ligne': 'En ligne sur Vinted', 'a-confirmer': 'À confirmer (dernière lecture ancienne)', masquee: 'Masquée par Vinted, toujours chez toi', 'plus-en-ligne': 'Plus en ligne', passu: 'Annonces pas encore lues' };
  const ETAT_BORD = { pret: 'Prêt à imprimer', imprime: 'Imprimé', poste: 'Posté', attente: 'En attente du PDF' };
  const { vinted, lbc, ebay } = rn.ventes;
  const rien = rn.etat === 'rien';
  const rienDautre = !rn.annonces.length && !vinted.length && !lbc.length && !ebay.length && !rn.annoncesEbay.length && !rn.stock && !rn.importe && !rn.reattribues.length;
  // L'en-tête : l'annonce de la fiche (photo, titre, état), sinon la première vente reliée — rien de deviné.
  const a0 = rn.annonces[0] || null, v0 = vinted[0] || null;
  const tete = a0
    ? { photo: a0.photo || null, titre: a0.title || '', etat: ETAT_ANN[a0.etat] + (a0.price ? ' · ' + prixCourt(String(a0.price).replace(',', '.')) : '') }
    : v0 ? { photo: orderPhoto(v0) || null, titre: v0.title || '', etat: '' }
    : { photo: null, titre: '', etat: '' };
  const annoncesListe = rn.annonces.length > 1 ? rn.annonces : [];
  return (
    <div data-tout-num={k} data-tout-etat={lecture && rn.etat !== 'trouve' ? 'lecture' : rn.etat} data-tout-lecture={lecture ? '1' : '0'} className="vrm-tout-num" style={{ marginTop: 12, padding: '14px 16px 6px', background: 'var(--d-carte)', border: 0, borderRadius: 'var(--d-r-carte)', boxShadow: 'var(--d-ombre-carte)' }}>
      {/* (26 nov., Julien : « c'est moche ») L'en-tête est LA paire : photo, plaque N° gravée, titre, une ligne d'état —
          trouvés par le N° (l'annonce de la fiche, sinon la vente reliée), jamais par un titre. */}
      <h2 className="vrm-tout-num-sr">{`Tout sur le N°${k}`}</h2>
      <EnteteArticle className="vrm-tout-num-tete" attrs={{ 'data-tout-tete': k }}
        photo={tete.photo ? <PhotoVinted src={tete.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : null}
        plaque={<Plaque numero={k} doublon={!!rn.double}/>}
        titre={tete.titre || (rien ? `N°${k}` : tr('loupe.num.sansTitre'))} etat={tete.etat} ton={rn.double ? 'doublon' : 'neutre'}/>
      {/* (1er nov.) La fiche complète : le parcours de CETTE paire, par identité. */}
      {onFiche && rn.etat === 'trouve' && ligne('parcours', { 'data-tout-parcours': k }, tr('loupe.num.histoire'), tr('loupe.num.histoireSous'), () => onFiche(k), 'clock')}
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
      {annoncesListe.length > 0 && titreSec(tr('loupe.num.annonces'))}
      {a0 && !annoncesListe.length && <span hidden data-tout-annonce={a0.id} data-tout-annonce-etat={a0.etat}/>}
      {annoncesListe.map((a) => ligne('a' + a.id, { 'data-tout-annonce': a.id, 'data-tout-annonce-etat': a.etat }, a.title || '(sans titre)', ETAT_ANN[a.etat] + (a.price ? ' · ' + prixCourt(String(a.price).replace(',', '.')) : ''), () => (onFiche && rn.etat === 'trouve' ? onFiche(k) : onNav('cat_annonces'))))}
      {(vinted.length + lbc.length + ebay.length + rn.annoncesEbay.length) > 0 && titreSec(tr('loupe.num.ventes'))}
      {vinted.map((o) => { const etape = `${etapeVente(o, { poste: (x) => !!shipDone[String(x.transaction_id)] }).label}${o.date ? ' · ' + jour(o.date) : ''}`; const meme = !!o.title && o.title === tete.titre;
        // Le titre déjà écrit dans l'en-tête ne se répète pas : la ligne dit « Vente Vinted » et son état.
        return ligne('v' + o._tx, { 'data-tout-vente': 'vinted', 'data-tout-tx': o._tx }, meme ? 'Vente Vinted' : (o.title || '(sans titre)'), meme ? etape : `Vente Vinted · ${etape}`, () => onNav('cat_ventes', { type: 'vente', tx: String(o._tx) }), meme ? 'bag' : null); })}
      {lbc.map((v) => ligne('l' + v._id, { 'data-tout-vente': 'leboncoin' }, v.title || '(sans titre)', `Vente Leboncoin · ${lbcAnnulee(v) ? 'annulée' : lbcFinalisee(v) ? 'finalisée' : 'en cours'}${v.price != null ? ' · ' + lbcEuro(v.price) : ''}`, () => onNav('plat_leboncoin')))}
      {ebay.map((c) => ligne('e' + c.orderId, { 'data-tout-vente': 'ebay' }, ((c.lineItems || [])[0] || {}).title || 'Commande eBay', `Vente eBay · ${commandeEbayEngagee(c) ? 'payée' : 'annulée ou remboursée'}${c.creationDate ? ' · ' + jour(c.creationDate) : ''}`, () => onNav('ebay_ventes')))}
      {rn.annoncesEbay.map((a) => ligne('ea' + a.itemId, { 'data-tout-annonce-ebay': String(a.itemId) }, a.title || 'Annonce eBay', 'En vente sur eBay', () => onNav('ebay_annonces')))}
      {rn.bordereaux.length > 0 && titreSec(tr('loupe.num.colis'))}
      {rn.bordereaux.map((b) => ligne('b' + b.tx, { 'data-tout-bord': b.tx, 'data-tout-bord-etat': b.etat }, ETAT_BORD[b.etat], 'Colis de la vente Vinted', () => onNav('cat_bord', b.etat === 'poste' ? null : { type: 'colis', tx: String(b.tx) })))}
      {/* (16 nov., lot ecrans-restes) La paire importée d'un autre outil sous CE N° (par le N°, jamais un titre). */}
      {rn.importe && ligne('imp', { 'data-tout-importe': rn.importe.numero }, rn.importe.titre || tr('er.loupe.importeeSansTitre'),
        [tr('er.loupe.importee'), rn.importe.emplacement ? tr('er.loupe.emplacement', { lieu: rn.importe.emplacement }) : '', rn.importe.prix != null ? tr('er.loupe.achat', { prix: prixCourt(String(rn.importe.prix).replace(',', '.')) }) : ''].filter(Boolean).join(' · '),
        () => (onFiche ? onFiche(k) : onStock(k)))}
      {rn.stock
        ? ligne('s', { 'data-tout-stock': rn.stock.itemName || 'range' }, `Rangé : ${rn.stock.itemName || 'un meuble'}`, [rn.stock.roomName, rn.stock.nom].filter(Boolean).join(' · '), () => onStock(k), 'grid')
        : rn.annonces.length > 0 && !rn.importe && ligne('s0', { 'data-tout-stock': '' }, tr('loupe.num.stock'), rn.manques.includes('ton Stock') ? tr('loupe.num.stockPasLu') : tr('loupe.num.pasRange'), () => onStock(k), 'grid')}
      {rn.etat === 'trouve' && rienDautre && rn.servi &&
        <div data-tout-servi="1" style={{ fontSize: 13, color: C.text, marginTop: 8 }}>Ce numéro a déjà servi, mais aucune fiche ne le porte aujourd'hui.</div>}
      {rien && <div data-tout-rien="1" style={{ fontSize: 13, color: C.text, marginTop: 8 }}>Le N°{k} n'a jamais servi.</div>}
      {!rien && rn.manques.length > 0 && (
        <div data-tout-manques={rn.manques.length} style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
          {lecture ? 'Lecture en cours…' : `Pas pu lire : ${rn.manques.join(', ')}.`}{rn.etat === 'passu' && !lecture ? ' Rien trouvé dans le reste — réessaie dans un instant.' : ''}
        </div>
      )}
      {rn.ancien && (ligne('ancien', { 'data-tout-ancien': rn.ancien }, tr('loupe.num.ancien', { n: String(rn.ancien) }), tr('loupe.num.ancienSous'), () => onChercher(rn.ancien), 'restore'))}
    </div>
  );
}
export { ToutSurLeNumero };

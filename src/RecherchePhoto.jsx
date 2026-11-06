// ── CHERCHER PAR PHOTO — la feuille (6 nov.) ────────────────────────────────
// Ouverte par l'appareil photo de la loupe (« Tout sur le N° ») et par le Stock.
// Chargée À LA DEMANDE (React.lazy) : ni ce fichier ni l'empreinte ne pèsent au
// premier chargement de l'app.
//
// Ce qu'elle fait, et seulement ça :
//   1. il prend la paire en photo (ou choisit une image) — la photo reste dans
//      CE navigateur, elle n'est envoyée nulle part ;
//   2. les empreintes de SES photos d'annonces (1re photo des annonces en ligne
//      + fiches N°) sont relues de l'appareil, les nouvelles calculées
//      (src/indexPhotos.js) ;
//   3. les 5 plus ressemblantes, chacune avec sa photo, son N°, son compte, son
//      état et un score DIT en mots (« très proche / proche / peu sûr ») —
//      jamais « c'est elle » ;
//   4. SON clic ouvre « Tout sur le N° ». Rien n'est relié, rien n'est écrit
//      (§5 : une proposition peut utiliser la ressemblance, c'est toujours SON
//      clic qui relie).
import React, { useEffect, useRef, useState } from 'react';
import { classer, NIVEAUX } from './empreintePhoto.js';
import { mettreAJourIndex, empreinteDeFichier } from './indexPhotos.js';
import { Numero } from './composants/Numero.jsx';

// L'état d'une annonce, tel que VRM le sait (« pas su » se dit, jamais deviné).
const ETATS = { 'en-ligne': 'En ligne', 'a-confirmer': 'À confirmer (lecture ancienne)', vendue: 'Vendue', 'hors-ligne': 'Pas en ligne sur Vinted', 'pas-su': 'État pas lu' };

export default function RecherchePhoto({ C, Feuille, Bouton, PhotoVinted, lireCandidats, lireOctets, ouvrirNumero, ouvrirAnnonces, onClose }) {
  const [etat, setEtat] = useState('attente');          // attente · calcul · resultats · pas-su · vide · illisible
  const [apercu, setApercu] = useState(null);           // URL objet de SA photo (affichée, jamais envoyée)
  const [progres, setProgres] = useState(null);         // { faits, total }
  const [res, setRes] = useState(null);                 // { top, illisibles, indexees, candidats, raisons }
  const photoRef = useRef(null), imageRef = useRef(null), vivant = useRef(true), tour = useRef(0);
  // Deux effets distincts : la feuille démontée arrête le travail en cours ; un
  // aperçu remplacé libère l'ancien (sans arrêter la recherche qui commence).
  useEffect(() => { vivant.current = true; return () => { vivant.current = false; }; }, []);
  useEffect(() => () => { if (apercu) try { URL.revokeObjectURL(apercu); } catch (_) {} }, [apercu]);

  const chercher = async (file) => {
    if (!file) return;
    const n = ++tour.current;
    const encore = () => vivant.current && tour.current === n;
    setApercu(URL.createObjectURL(file));
    setEtat('calcul'); setRes(null); setProgres(null);
    const [requete, lus] = await Promise.all([empreinteDeFichier(file), lireCandidats().catch(() => null)]);
    if (!encore()) return;
    if (!requete) { setEtat('illisible'); return; }
    if (!lus || !Array.isArray(lus.candidats)) { setEtat('pas-su'); return; }
    const avecPhoto = lus.candidats.filter((c) => c.url);
    if (!avecPhoto.length) { setEtat('vide'); setRes({ top: [], illisibles: 0, indexees: 0, candidats: lus.candidats.length, raisons: lus.raisons || [] }); return; }
    const ix = await mettreAJourIndex(avecPhoto.map((c) => c.url), { lireOctets, surProgres: (p) => { if (encore()) setProgres(p); }, arrete: () => !encore() });
    if (!encore()) return;
    const index = avecPhoto.map((c) => ({ ...c, empreinte: ix.empreintes.get(c.url) || null }));
    const top = classer(requete, index, { max: 5 });
    setRes({ top, illisibles: ix.illisibles.length, indexees: ix.empreintes.size, candidats: lus.candidats.length, sansPhoto: lus.candidats.length - avecPhoto.length, raisons: lus.raisons || [] });
    setEtat(top.length ? 'resultats' : 'vide');
  };
  const choisi = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; chercher(f); };

  const texte = { fontSize: 13, color: C.muted, lineHeight: 1.45, margin: '6px 0 0' };
  const pastille = { fontSize: 12, fontWeight: 600, color: C.text, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap', flexShrink: 0 };
  const choix = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
      <Bouton variante={etat === 'attente' ? 'primaire' : 'secondaire'} icone="camera" data-rp-prendre="" onClick={() => photoRef.current && photoRef.current.click()} style={{ minHeight: 44 }}>
        {etat === 'attente' ? 'Prendre la paire en photo' : 'Autre photo'}
      </Bouton>
      <Bouton variante="secondaire" icone="image" data-rp-choisir="" onClick={() => imageRef.current && imageRef.current.click()} style={{ minHeight: 44 }}>Choisir une image</Bouton>
      <input ref={photoRef} type="file" accept="image/*" capture="environment" data-rp-fichier="camera" onChange={choisi} style={{ display: 'none' }} />
      <input ref={imageRef} type="file" accept="image/*" data-rp-fichier="image" onChange={choisi} style={{ display: 'none' }} />
    </div>
  );

  return (
    <Feuille onClose={onClose} titre="Chercher par photo" data-recherche-photo="" data-rp-etat={etat}>
      <div style={{ padding: '0 16px 16px' }}>
        <p style={{ ...texte, marginTop: 0 }}>
          Prends la paire en photo : VRM te montre les annonces dont la photo lui ressemble le plus. C'est toi qui choisis — rien n'est relié, et ta photo ne quitte pas cet appareil. Le mieux : la paire de profil, sur un fond uni.
        </p>
        {choix}
        {apercu && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <img src={apercu} alt="Ta photo" data-rp-apercu="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 12, border: `1px solid ${C.border}`, flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: C.text, minWidth: 0 }}>
              {etat === 'calcul' && (progres && progres.total
                ? <span data-rp-progres={`${progres.faits}/${progres.total}`}>Je prépare tes photos d'annonces : {progres.faits} sur {progres.total}. La première fois prend un moment, ensuite elles sont gardées sur cet appareil.</span>
                : <span data-rp-progres="">Je compare…</span>)}
              {etat === 'resultats' && <span>Les {res.top.length} plus ressemblantes, la plus proche d'abord. Vérifie la paire avant de t'en servir.</span>}
              {etat === 'illisible' && <span data-rp-raison="illisible">Je n'arrive pas à lire cette image. Essaie une autre photo (JPEG ou PNG).</span>}
              {etat === 'pas-su' && <span data-rp-raison="lecture">Je n'ai pas pu lire tes annonces (la base n'a pas répondu). Rien n'est perdu : réessaie dans un instant.</span>}
              {etat === 'vide' && <span data-rp-raison="vide">Aucune photo d'annonce à comparer{res && res.illisibles ? ' : aucune n’a pu être lue ici' : ''}.</span>}
            </div>
          </div>
        )}
        {etat === 'resultats' && res.top.map((r, i) => {
          const n = r.numero ? String(r.numero) : '';
          const ouvrir = () => { if (n) ouvrirNumero(n); else ouvrirAnnonces(); };
          return (
            <button key={r.cle} type="button" onClick={ouvrir} data-rp-resultat={r.cle} data-rp-rang={i + 1} data-rp-niveau={r.niveau} data-rp-score={r.score} data-rp-num={n}
              style={{ width: '100%', minHeight: 72, display: 'flex', alignItems: 'center', gap: 11, padding: '8px 10px', marginTop: i ? 6 : 14, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: C.text }}>
              <div style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', background: C.border, flexShrink: 0 }}>
                <PhotoVinted src={r.url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {n ? <Numero n={n} taille="petit" /> : <span style={{ fontSize: 12, color: C.muted }}>Sans N°</span>}
                  <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titre || 'Annonce sans titre'}</span>
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-rp-etat-annonce={r.etat}>
                  {[ETATS[r.etat] || ETATS['pas-su'], r.compte || ''].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span style={pastille} data-rp-mot="">{NIVEAUX[r.niveau]}</span>
              <span aria-hidden="true" style={{ fontSize: 17, color: C.muted }}>›</span>
            </button>
          );
        })}
        {res && (etat === 'resultats' || etat === 'vide') && (
          <p style={{ ...texte, marginTop: 12 }} data-rp-bilan="" data-rp-indexees={res.indexees} data-rp-illisibles={res.illisibles}>
            {res.indexees} photo{res.indexees > 1 ? 's' : ''} d'annonce comparée{res.indexees > 1 ? 's' : ''}.
            {res.illisibles ? ` ${res.illisibles} n'${res.illisibles > 1 ? 'ont' : 'a'} pas pu être lue${res.illisibles > 1 ? 's' : ''} ici (ouvre VRM dans le navigateur où l'extension est installée, ou réessaie plus tard) : ${res.illisibles > 1 ? 'elles ne sont' : 'elle n’est'} pas dans la recherche.` : ''}
            {res.sansPhoto ? ` ${res.sansPhoto} fiche${res.sansPhoto > 1 ? 's' : ''} sans photo.` : ''}
            {(res.raisons || []).map((x) => ` ${x}`).join('')}
            {' '}« Très proche » veut dire « ça y ressemble beaucoup », pas « c'est elle » : deux paires du même modèle et de la même couleur se ressemblent autant.
          </p>
        )}
      </div>
    </Feuille>
  );
}

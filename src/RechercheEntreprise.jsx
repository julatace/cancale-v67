// ── LA RECHERCHE D'ENTREPRISE, À L'ÉCRAN (9 nov., soir) ─────────────────────────
// Le même composant dans « Ma facture » (src/FacturePro.jsx) et dans l'étape statut
// de « Ma configuration » (src/ConfigurationDepart.jsx). La règle est dans
// src/entrepriseRecherche.js ; la recherche elle-même est `chercherEntreprise` de
// l'app (/api/compte?mode=entreprise, le registre public de l'État, SIREN exact),
// passée en paramètre : ce fichier n'importe rien d'App.jsx.
//
// 1. Un SIRET (ou SIREN) VALIDE (clé de Luhn) ⇒ « Recherche de l'entreprise… » —
//    affiché pendant la requête, et seulement pendant (jamais un délai fabriqué).
// 2. Trouvée ⇒ « Vérifie ces informations » : chaque champ proposé, « C'est bon » /
//    « Modifier » ; un champ qu'il a déjà rempli autrement montre l'écart, « Remplacer »
//    / « Garder la mienne ». RIEN n'est écrit sans son geste.
// 3. Introuvable, fermée, registre muet ⇒ dit, saisie à la main (« Réessayer » si muet).
import React from 'react';
import './recherche-entreprise.css';
import { verifierSiret, propositionsEntreprise, ecritureDecision, ecritureToutVide, etatRecherche } from './entrepriseRecherche.js';

const groupe = (ch) => (ch.length === 14 ? ch.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4') : ch.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3'));

// Trois états : `rep` undefined (rien lancé) · 'encours' · la réponse ({ etat, … }).
export function useRechercheEntreprise(chercher, numero) {
  const verif = verifierSiret(numero);
  const ch = String(numero || '').replace(/\D/g, '');
  const [rep, setRep] = React.useState(undefined);
  const [essai, setEssai] = React.useState(0);
  React.useEffect(() => {
    if (verif.etat !== 'ok' || typeof chercher !== 'function') { setRep(undefined); return undefined; }
    let mort = false;
    setRep('encours');
    Promise.resolve().then(() => chercher(ch)).then((j) => { if (!mort) setRep(j && typeof j === 'object' ? j : { etat: 'passu' }); })
      .catch(() => { if (!mort) setRep({ etat: 'passu' }); });
    return () => { mort = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ch, verif.etat, essai]);
  return { verif, ch, rep, relancer: () => setEssai((n) => n + 1) };
}

// `actuel` : la fiche telle qu'elle est (les champs déjà remplis).
// `onEcrire(patch)` : écrit CES champs seulement ; rend true/false (ou rien = true).
// `onModifier(champ)` : met le doigt sur le champ (il l'écrit lui-même).
export function CarteVerifEntreprise({ recherche, actuel, avecSiret = false, onEcrire, onModifier, enTete = null, data }) {
  const { verif, ch, rep, relancer } = recherche;
  const [decide, setDecide] = React.useState({});
  const [erreur, setErreur] = React.useState('');
  React.useEffect(() => { setDecide({}); setErreur(''); }, [ch]);
  if (verif.etat === 'vide') return null;
  if (verif.etat === 'invalide') return <p className="vrm-ent-refus" data-ent-recherche="invalide" role="status" {...(data || {})}>Ce numéro ne semble pas valide : {verif.raison}. Aucune recherche n’est faite.</p>;
  if (rep === undefined) return null;
  if (rep === 'encours') return (
    <div className="vrm-ent vrm-ent-cherche" data-ent-recherche="encours" role="status" aria-live="polite" aria-busy="true" {...(data || {})}>
      <span className="vrm-ent-pulse" aria-hidden="true"><i /><i /><i /></span>
      <span className="vrm-ent-cherche-t"><b>Recherche de l’entreprise…</b><small>Registre public des entreprises · n° {groupe(ch)}</small></span>
    </div>
  );
  const etat = etatRecherche(rep);
  if (etat !== 'trouve') {
    const texte = {
      inconnu: `Aucune entreprise à ce numéro au registre public. Vérifie le numéro sur ton avis de situation INSEE, ou remplis à la main.`,
      ferme: `Le registre dit cette entreprise fermée (cessée)${rep.nom ? ` : ${rep.nom}` : ''}. Rien n’est proposé : vérifie ton numéro, ou remplis à la main.`,
      'etab-ferme': `Le registre dit cet établissement fermé. Rien n’est proposé : vérifie ton SIRET (celui de ton adresse actuelle), ou remplis à la main.`,
      passu: `Le registre des entreprises ne répond pas pour l’instant. Rien n’est changé : réessaie, ou remplis à la main.`,
    }[etat] || 'Rien n’est proposé : remplis à la main.';
    return (
      <div className="vrm-ent vrm-ent-rien" data-ent-recherche={etat} role="status" aria-live="polite" {...(data || {})}>
        <p>{texte}</p>
        {etat === 'passu' ? <button type="button" className="vrm-ent-b" data-ent-reessayer="" onClick={relancer}>Réessayer</button> : null}
      </div>
    );
  }
  const p = propositionsEntreprise(rep, actuel || {}, { avecSiret, saisi: ch });
  const ecrire = async (patch) => {
    if (!patch || !Object.keys(patch).length) return true;
    setErreur('');
    let ok = true;
    try { const r = onEcrire ? await onEcrire(patch) : true; ok = r !== false; } catch (_) { ok = false; }
    if (!ok) setErreur('Pas enregistré : la base n’a pas répondu. Rien n’est perdu, réessaie.');
    return ok;
  };
  const geste = async (l, d) => {
    const patch = ecritureDecision(l, d);
    if (patch && !(await ecrire(patch))) return;
    setDecide((x) => ({ ...x, [l.champ]: d }));
    if (d === 'modifier' && onModifier) onModifier(l.champ);
  };
  const aVoir = p.lignes.filter((l) => l.cas !== 'egal' && !decide[l.champ]);
  const vides = aVoir.filter((l) => l.cas === 'vide');
  const justes = p.lignes.filter((l) => l.cas === 'egal').length;
  return (
    <div className="vrm-ent vrm-ent-trouve" data-ent-recherche="trouve" data-ent-a-voir={aVoir.length} {...(data || {})}>
      <div className="vrm-ent-tete">
        <b>{aVoir.length ? 'Vérifie ces informations' : 'Informations vérifiées'}</b>
        <small>{aVoir.length
          ? <>Trouvées au registre public pour le n° {groupe(ch)}. Rien n’est écrit tant que tu n’as pas dit « C’est bon ».</>
          : <>Tout ce que le registre propose est en place{justes ? ` (${justes} champ${justes > 1 ? 's' : ''} déjà juste${justes > 1 ? 's' : ''})` : ''}. Tu peux tout changer à la main.</>}</small>
      </div>
      {enTete}
      {aVoir.length ? <div className="vrm-ent-lignes">
        {aVoir.map((l) => (
          <div key={l.champ} className="vrm-ent-ligne" data-ent-ligne={l.champ} data-ent-cas={l.cas}>
            <div className="vrm-ent-ligne-t">
              <small>{l.label}</small>
              <b className="vrm-sensible" data-stream-type="compte">{l.affiche}</b>
              {l.cas === 'ecart' ? <span className="vrm-ent-ecart">Tu as écrit : <span className="vrm-sensible" data-stream-type="compte">{l.actuel}</span></span> : null}
            </div>
            <div className="vrm-ent-gestes">
              {l.cas === 'vide' ? <>
                <button type="button" className="vrm-ent-b is-ok" data-ent-ok={l.champ} onClick={() => geste(l, 'ok')}>C’est bon</button>
                <button type="button" className="vrm-ent-b" data-ent-modifier={l.champ} onClick={() => geste(l, 'modifier')}>Modifier</button>
              </> : <>
                <button type="button" className="vrm-ent-b" data-ent-remplacer={l.champ} onClick={() => geste(l, 'remplacer')}>Remplacer</button>
                <button type="button" className="vrm-ent-b" data-ent-garder={l.champ} onClick={() => geste(l, 'garder')}>Garder la mienne</button>
              </>}
            </div>
          </div>
        ))}
      </div> : null}
      {vides.length > 1 ? <button type="button" className="vrm-ent-b is-ok vrm-ent-tout" data-ent-tout={vides.length} onClick={async () => {
        if (!(await ecrire(ecritureToutVide(vides)))) return;
        setDecide((x) => { const n = { ...x }; for (const l of vides) n[l.champ] = 'ok'; return n; });
      }}>Tout est bon ({vides.length} champs vides)</button> : null}
      {erreur ? <p className="vrm-ent-erreur" role="alert">{erreur}</p> : null}
      {p.notes.length ? <ul className="vrm-ent-notes">{p.notes.map((n) => <li key={n.cle} data-ent-note={n.cle}>{n.texte}</li>)}</ul> : null}
    </div>
  );
}

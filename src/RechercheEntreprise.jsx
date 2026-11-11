// ── LA RECHERCHE D'ENTREPRISE, À L'ÉCRAN (9 nov., soir ; refaite le 11 nov., lot DJ1) ──
// Le même composant dans « Ma facture » (src/FacturePro.jsx) et dans l'étape statut
// de « Ma configuration » (src/ConfigurationDepart.jsx). La règle est dans
// src/entrepriseRecherche.js ; la recherche elle-même est `chercherEntreprise` de
// l'app (/api/compte?mode=entreprise, le registre public de l'État, SIREN exact),
// passée en paramètre : ce fichier n'importe rien d'App.jsx.
//
// Julien (11 nov.) : « quand je remplis le numéro de SIRET, je veux que quand je valide
// ça cherche le RCS, je veux que le visuel soit mieux » ; « une animation recherche et
// après on demande à la personne de vérifier si les infos sont bonnes ».
// 1. Un SIRET (ou SIREN) VALIDE (clé de Luhn) ⇒ RIEN ne part tant qu'il ne valide pas :
//    Entrée, sortie du champ (`lancer`), ou le bouton « Rechercher ». Un numéro faux ⇒
//    dit, aucune requête.
// 2. Pendant la requête : une carte-squelette dont les lignes se remplissent et une
//    barre qui avance ; arrêt à 8 s (`DELAI_RECHERCHE_MS`) ⇒ « Pas trouvé à temps :
//    remplis à la main » (+ Réessayer). Mouvement réduit ⇒ immobile.
// 3. Trouvée ⇒ « C'est bien toi ? » : dénomination, nom commercial, forme en mots,
//    adresse, immatriculation (RCS : la ville du greffe, il la recopie de son Kbis —
//    jamais inventée ; EI : « pas de RCS au registre public »), code APE, TVA.
//    « Oui, c'est moi » écrit (tout reste modifiable) ; « Non, corriger » n'écrit rien.
//    Un champ qu'il avait écrit autrement est GARDÉ, sauf s'il choisit « Le registre ».
import React from 'react';
import './recherche-entreprise.css';
import { verifierSiret, etatRecherche, ficheIdentite, ecritureOui, DELAI_RECHERCHE_MS, mentionsDeForme, sirenGroupe } from './entrepriseRecherche.js';

const groupe = (ch) => (ch.length === 14 ? ch.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4') : ch.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3'));

// Trois états : `rep` undefined (rien lancé) · 'encours' · la réponse ({ etat, … }).
// `lancer()` : la validation (Entrée, sortie du champ, bouton). Rien ne part sans elle.
export function useRechercheEntreprise(chercher, numero) {
  const verif = verifierSiret(numero);
  const ch = String(numero || '').replace(/\D/g, '');
  const [rep, setRep] = React.useState(undefined);
  const [lance, setLance] = React.useState({ ch: '', n: 0 });
  React.useEffect(() => { setRep(undefined); }, [ch]);
  React.useEffect(() => {
    if (verif.etat !== 'ok' || typeof chercher !== 'function' || lance.ch !== ch || !lance.n) return undefined;
    let mort = false;
    setRep('encours');
    // L'arrêt à 8 s : la requête n'est pas « annulée » côté serveur (elle ne fait que lire),
    // mais sa réponse tardive n'est plus montrée — l'écran a déjà dit « remplis à la main ».
    const minuteur = setTimeout(() => { if (!mort) { mort = true; setRep({ etat: 'lent' }); } }, DELAI_RECHERCHE_MS);
    Promise.resolve().then(() => chercher(ch)).then((j) => { if (!mort) { mort = true; clearTimeout(minuteur); setRep(j && typeof j === 'object' ? j : { etat: 'passu' }); } })
      .catch(() => { if (!mort) { mort = true; clearTimeout(minuteur); setRep({ etat: 'passu' }); } });
    return () => { mort = true; clearTimeout(minuteur); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ch, verif.etat, lance]);
  const lancer = () => { if (verif.etat === 'ok') setLance((x) => ({ ch, n: x.ch === ch ? x.n + 1 : 1 })); };
  // Une validation déjà faite pour CE numéro ne relance pas (sortie du champ répétée).
  const lancerUneFois = () => { if (verif.etat === 'ok' && !(lance.ch === ch && lance.n)) lancer(); };
  return { verif, ch, rep, relancer: lancer, lancer, lancerUneFois };
}

// Le squelette : les libellés de la carte, des barres qui se remplissent une à une.
const SQUELETTE = ['Dénomination', 'Forme juridique', 'Adresse', 'Immatriculation', 'Code APE', 'TVA'];
function Squelette({ ch, data }) {
  return (
    <div className="vrm-ent vrm-ent-cherche" data-ent-recherche="encours" role="status" aria-live="polite" aria-busy="true" {...(data || {})}>
      <div className="vrm-ent-tete">
        <b>Recherche de ton entreprise…</b>
        <small>Registre public · n° {groupe(ch)}</small>
      </div>
      <div className="vrm-ent-barre" aria-hidden="true" style={{ '--ent-duree': `${DELAI_RECHERCHE_MS}ms` }}><i /></div>
      <div className="vrm-ent-squelette" aria-hidden="true">
        {SQUELETTE.map((l, i) => (
          <div key={l} className="vrm-ent-sq-ligne" style={{ '--i': i }}>
            <small>{l}</small><span className="vrm-ent-sq-barre" style={{ '--l': `${[72, 46, 84, 58, 34, 52][i]}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// `actuel` : la fiche telle qu'elle est (les champs déjà remplis).
// `onEcrire(patch)` : écrit CES champs seulement ; rend true/false (ou rien = true).
// `onModifier(champ)` : met le doigt sur le champ (il l'écrit lui-même).
export function CarteVerifEntreprise({ recherche, actuel, avecSiret = false, onEcrire, onModifier, enTete = null, data }) {
  const { verif, ch, rep, relancer, lancer } = recherche;
  const [issue, setIssue] = React.useState('');          // '' · 'oui' · 'non'
  const [prendre, setPrendre] = React.useState({});
  const [ville, setVille] = React.useState('');
  const [erreur, setErreur] = React.useState('');
  const [occupe, setOccupe] = React.useState(false);
  React.useEffect(() => { setIssue(''); setPrendre({}); setVille(''); setErreur(''); }, [ch, rep]);
  if (verif.etat === 'vide') return null;
  if (verif.etat === 'invalide') return <p className="vrm-ent-refus" data-ent-recherche="invalide" role="status" {...(data || {})}>Ce numéro ne semble pas valide : {verif.raison}. Aucune recherche n’est faite.</p>;
  if (rep === undefined) return (
    <div className="vrm-ent vrm-ent-pret" data-ent-recherche="pret" {...(data || {})}>
      <span className="vrm-ent-pret-t"><b>Numéro valide</b><small>Trouve ton entreprise au registre public.</small></span>
      <button type="button" className="vrm-ent-b is-ok" data-ent-lancer="" onClick={lancer}>Rechercher</button>
    </div>
  );
  if (rep === 'encours') return <Squelette ch={ch} data={data}/>;
  const etat = rep && rep.etat === 'lent' ? 'lent' : etatRecherche(rep);
  if (etat !== 'trouve') {
    const texte = {
      lent: 'Pas trouvé à temps. Remplis à la main, ou réessaie.',
      inconnu: 'Aucune entreprise à ce numéro. Vérifie-le, ou remplis à la main.',
      ferme: `Le registre dit cette entreprise fermée${rep.nom ? ` (${rep.nom})` : ''}. Remplis à la main.`,
      'etab-ferme': 'Le registre dit cet établissement fermé. Vérifie ton SIRET, ou remplis à la main.',
      passu: 'Le registre ne répond pas. Remplis à la main, ou réessaie.',
    }[etat] || 'Rien trouvé : remplis à la main.';
    return (
      <div className="vrm-ent vrm-ent-rien" data-ent-recherche={etat} role="status" aria-live="polite" {...(data || {})}>
        <p>{texte}</p>
        {etat === 'passu' || etat === 'lent' ? <button type="button" className="vrm-ent-b" data-ent-reessayer="" onClick={relancer}>Réessayer</button> : null}
      </div>
    );
  }
  // Les lignes montrées (sans le RCS, qui a SA ligne avec la ville du greffe) ; ce qui
  // s'écrit inclut le RCS dès qu'il a recopié la ville (le taper vaut son choix).
  const f = ficheIdentite(rep, actuel || {}, { avecSiret, saisi: ch });
  const fEcrit = ficheIdentite(rep, actuel || {}, { avecSiret, saisi: ch, villeGreffe: ville });
  if (issue === 'oui') return (
    <div className="vrm-ent vrm-ent-fait" data-ent-recherche="rempli" role="status" aria-live="polite" {...(data || {})}>
      <span className="vrm-ent-coche" aria-hidden="true">✓</span>
      <span><b>Rempli depuis le registre</b><small>Tout reste modifiable ci-dessous.</small></span>
    </div>
  );
  if (issue === 'non') return (
    <div className="vrm-ent vrm-ent-fait" data-ent-recherche="corrige" role="status" {...(data || {})}>
      <span><b>Rien n’a été rempli</b><small>Corrige le numéro, ou écris à la main.</small></span>
      <button type="button" className="vrm-ent-b" data-ent-revoir="" onClick={() => setIssue('')}>Revoir</button>
    </div>
  );
  const patch = ecritureOui(fEcrit.lignes, { ...prendre, rcs: true });
  const nAEcrire = Object.keys(patch).length;
  const oui = async () => {
    setErreur('');
    if (!nAEcrire) { setIssue('oui'); return; }
    setOccupe(true);
    let ok = true;
    try { const r = onEcrire ? await onEcrire(patch) : true; ok = r !== false; } catch (_) { ok = false; }
    setOccupe(false);
    if (!ok) { setErreur('Pas enregistré : la base n’a pas répondu. Réessaie.'); return; }
    setIssue('oui');
  };
  const imm = f.imm;
  return (
    <div className="vrm-ent vrm-ent-trouve" data-ent-recherche="trouve" data-ent-a-ecrire={nAEcrire} {...(data || {})}>
      <div className="vrm-ent-tete">
        <b>C’est bien toi ?</b>
        <small>Trouvé au registre public · n° {groupe(ch)}</small>
      </div>
      {enTete}
      <dl className="vrm-ent-fiche">
        {f.lignes.map((l, i) => (
          <div key={l.cle} className="vrm-ent-ligne" data-ent-ligne={l.cle} data-ent-cas={l.cas || 'info'} style={{ '--i': i }}>
            <dt>{l.label}</dt>
            <dd>
              <b className="vrm-sensible" data-stream-type="compte">{l.affiche}</b>
              {l.cas === 'ecart' ? <span className="vrm-ent-ecart">
                <span>Tu as écrit : <span className="vrm-sensible" data-stream-type="compte">{l.actuel}</span></span>
                <span className="vrm-ent-choix" role="radiogroup" aria-label={`${l.label} : laquelle garder ?`}>
                  <button type="button" role="radio" aria-checked={!prendre[l.champ]} data-ent-garder={l.champ} onClick={() => setPrendre((x) => ({ ...x, [l.champ]: false }))}>La mienne</button>
                  <button type="button" role="radio" aria-checked={!!prendre[l.champ]} data-ent-prendre={l.champ} onClick={() => setPrendre((x) => ({ ...x, [l.champ]: true }))}>Le registre</button>
                </span>
              </span> : null}
            </dd>
          </div>
        ))}
        {imm.cas ? <div className="vrm-ent-ligne" data-ent-ligne="imm" data-ent-imm={imm.cas} style={{ '--i': f.lignes.length }}>
          <dt>Immatriculation</dt>
          <dd>
            <b className="vrm-sensible" data-stream-type="compte">{imm.cas === 'rcs' ? (patch.rcs || <>RCS <span className="vrm-ent-trou">ville</span> {sirenGroupe(rep.siren)}</>) : imm.texte}</b>
            {imm.cas === 'rcs' ? <label className="vrm-ent-ville">
              <span>Ville du greffe (sur ton Kbis)</span>
              <input type="text" value={ville} autoComplete="off" placeholder="Rennes" data-ent-ville="" onChange={(e) => setVille(e.target.value)}/>
            </label> : imm.aide ? <small className="vrm-ent-aide">{imm.aide}</small> : null}
            {imm.cas === 'rcs' && actuel && actuel.rcs && !patch.rcs ? <small className="vrm-ent-aide">Tu as écrit : <span className="vrm-sensible" data-stream-type="compte">{actuel.rcs}</span> (gardé)</small> : null}
          </dd>
        </div> : null}
      </dl>
      {f.tvaNote ? <p className="vrm-ent-note" data-ent-note="tva">{f.tvaNote}</p> : null}
      {erreur ? <p className="vrm-ent-erreur" role="alert">{erreur}</p> : null}
      <div className="vrm-ent-gestes vrm-ent-final">
        <button type="button" className="vrm-ent-b is-ok" data-ent-oui={nAEcrire} disabled={occupe} onClick={oui}>{occupe ? 'Un instant…' : 'Oui, c’est moi'}</button>
        <button type="button" className="vrm-ent-b" data-ent-non="" disabled={occupe} onClick={() => { setIssue('non'); if (onModifier) onModifier('siret'); }}>Non, corriger</button>
      </div>
    </div>
  );
}

// ── LE STATUT CHOISI ⇒ SES MENTIONS, dans la même carte (11 nov., lot DJ1) ──────
// `forme` : la forme qu'il vient de choisir. `cfg` : la fiche. `onEcrire(patch)` : la seule
// écriture proposée (le régime « Franchise » d'une EI sans régime), sur son clic.
// `onModifier(champ)` : le doigt sur le champ à remplir. `fermer()` : « C'est bon ».
export function CarteMentionsForme({ forme, cfg, onEcrire, onModifier, fermer }) {
  const m = mentionsDeForme(forme, cfg);
  if (!m.lignes.length) return null;
  const aRemplir = m.lignes.filter((l) => !l.ok).length;
  return (
    <div className="vrm-ent vrm-ent-trouve vrm-ent-forme" data-ent-forme={forme} data-ent-a-remplir={aRemplir} role="status" aria-live="polite">
      <div className="vrm-ent-tete"><b>{m.titre}</b><small>{aRemplir ? `${aRemplir} à remplir` : 'Tout est en place'}</small></div>
      <ul className="vrm-ent-mentions">
        {m.lignes.map((l, i) => (
          <li key={l.cle} data-ent-mention={l.cle} data-ent-ok={l.ok ? '1' : '0'} style={{ '--i': i }}>
            <span className={`vrm-ent-puce${l.ok ? ' is-ok' : ''}`} aria-hidden="true">{l.ok ? '✓' : ''}</span>
            <span className="vrm-ent-mention-t vrm-sensible" data-stream-type="compte">{l.texte}</span>
            {!l.ok && l.champ && onModifier ? <button type="button" className="vrm-ent-b vrm-ent-b-petit" data-ent-remplir={l.champ} onClick={() => onModifier(l.champ)}>Remplir</button> : null}
          </li>
        ))}
      </ul>
      {m.proposition ? <div className="vrm-ent-propose" data-ent-propose={m.proposition.champ}>
        <span>{m.proposition.texte}</span>
        <button type="button" className="vrm-ent-b" data-ent-propose-ok="" onClick={() => onEcrire && onEcrire({ [m.proposition.champ]: m.proposition.valeur })}>Oui, franchise</button>
      </div> : null}
      <div className="vrm-ent-gestes vrm-ent-final">
        <button type="button" className="vrm-ent-b is-ok" data-ent-forme-ok="" onClick={fermer}>C’est bon</button>
      </div>
    </div>
  );
}

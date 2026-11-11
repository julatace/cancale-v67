// ════════════════════════════════════════════════════════════════════════════
//  « AVIS 2★ REÇU SUR shop_x » — la carte de Ma journée et sa feuille (11 nov., lot avis-negatif)
// ════════════════════════════════════════════════════════════════════════════
// La règle est src/avisNegatif.js ; la DÉTECTION appartient au serveur (seul
// écrivain de `vrm_avis_bas`, api/_lib/avis-negatif.js). Ici : on LIT ses alertes,
// le texte de l'avis s'il est rangé (par SON identifiant), l'id de profil (lien des
// avis sur Vinted), et on écrit seulement « C'est vu » (`vrm_avis_bas_vus`, seul
// écrivain : l'app, lire-fusionner-réécrire, une lecture ratée n'écrit rien).
// Trois états : `undefined` en cours · `null` pas su (rien montré) · liste.
// Les gestes : la vente SEULEMENT par le n° de transaction porté par l'avis ; sinon
// « Répondre sur Vinted ↗ » (le profil des avis). Jamais un acheteur deviné.
import React from 'react';
import { alertesAMontrer, marquerVus, cleAlerte, texteDeLAvis, lienAvisVinted, lienVenteAvis } from './avisNegatif.js';

// lire() → { memo, vus, textes: { uid: liste brute }, pids: { uid: pid } } · undefined (pas su)
// ecrireVus(fn) → true (écrit) · false — `fn(vusLus)` rend la ligne à écrire.
export function useAvisBas(actif, { lire, ecrireVus, comptes }) {
  const [etat, setEtat] = React.useState(undefined);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!actif) return undefined;
    let mort = false;
    Promise.resolve().then(lire).catch(() => undefined).then((r) => { if (!mort) setEtat(r && typeof r === 'object' ? r : null); });
    return () => { mort = true; };
  }, [actif, tick]);
  const presents = Array.isArray(comptes) ? comptes.map((a) => String(a && a.vinted_user_id)) : null;
  const parUid = new Map((comptes || []).map((a) => [String(a && a.vinted_user_id), a]));
  const liste = etat ? alertesAMontrer(etat.memo, etat.vus, presents).map((a) => {
    const c = parUid.get(a.uid) || {};
    return {
      ...a, cle: cleAlerte(a), nom: String(c.login || ''),
      texte: texteDeLAvis(etat.textes && etat.textes[a.uid], a.id),
      vinted: lienAvisVinted({ domaine: c.domain, pid: etat.pids && etat.pids[a.uid], uid: a.uid }),
      vente: lienVenteAvis(a.tx),
    };
  }) : etat;
  const vu = async (cles) => {
    const ok = await Promise.resolve().then(() => ecrireVus((v) => marquerVus(v, cles))).catch(() => false);
    if (ok) setEtat((e) => (e ? { ...e, vus: marquerVus(e.vus, cles) } : e));
    return !!ok;
  };
  return { liste, vu, relire: () => setTick((t) => t + 1) };
}

export function titreAvisBas(l) {
  if (!Array.isArray(l) || !l.length) return '';
  if (l.length === 1) return `Avis ${l[0].note}★ reçu sur ${l[0].nom || 'ton compte Vinted'}`;
  return `${l.length} avis négatifs reçus`;
}
export function detailAvisBas(l) {
  if (!Array.isArray(l) || !l.length) return '';
  if (l.length === 1) return l[0].texte ? `« ${l[0].texte.length > 90 ? l[0].texte.slice(0, 89).trimEnd() + '…' : l[0].texte} »` : 'Lis l’avis sur Vinted.';
  return l.map((a) => `${a.note}★ · ${a.nom || 'Vinted'}`).join(', ');
}

// La feuille : un bloc par avis, ses gestes. `Bouton` et `onAller` viennent de l'app.
export function AvisBasDetail({ liste, onVu, onAller, Bouton }) {
  const [erreur, setErreur] = React.useState('');
  const [occupe, setOccupe] = React.useState('');
  if (!Array.isArray(liste) || !liste.length) return <p className="vrm-avb-vide" data-avis-bas-vide="">Rien de neuf.</p>;
  const vu = async (cles) => {
    setOccupe(cles.join(' ')); setErreur('');
    const ok = await onVu(cles);
    setOccupe('');
    if (!ok) setErreur('Pas enregistré — réessaie quand tu as du réseau.');
  };
  return (
    <div className="vrm-avb" data-avis-bas-feuille={liste.map((a) => a.cle).join(' ')}>
      {liste.map((a) => (
        <section key={a.cle} className="vrm-avb-avis" data-avis-bas={a.cle} data-note={String(a.note)} data-prouve={a.vente ? '1' : '0'}>
          <div className="vrm-avb-tete">
            <span className="vrm-avb-note" aria-label={`${a.note} étoile${a.note > 1 ? 's' : ''} sur 5`}>{'★'.repeat(a.note)}<span className="vrm-avb-note-vide">{'★'.repeat(5 - a.note)}</span></span>
            <span className="vrm-avb-compte">{a.nom || 'Compte Vinted'}</span>
          </div>
          {a.texte
            ? <p className="vrm-avb-texte" data-avis-texte="">« {a.texte} »</p>
            : <p className="vrm-avb-texte is-muet" data-avis-texte-absent="">Lis l’avis sur Vinted.</p>}
          {!a.vente ? <p className="vrm-avb-pourquoi" data-avis-sans-vente="">Vinted ne dit pas quelle vente il note : pour écrire à l’acheteur, ouvre la conversation sur Vinted.</p> : null}
          <div className="vrm-avb-gestes">
            {a.vente ? <Bouton variante="primaire" data-avis-voir-vente={a.tx} onClick={() => onAller(a.vente.slice(1))}>Voir la vente et écrire</Bouton> : null}
            {a.vinted ? <Bouton variante={a.vente ? 'secondaire' : 'primaire'} href={a.vinted} target="_blank" rel="noreferrer" data-avis-vinted={a.vinted}>Répondre sur Vinted ↗</Bouton> : null}
            <Bouton variante="discret" occupe={occupe === a.cle} data-avis-vu={a.cle} onClick={() => vu([a.cle])}>C’est vu</Bouton>
          </div>
        </section>
      ))}
      {erreur ? <p className="vrm-avb-erreur" role="alert" data-avis-vu-erreur="">{erreur}</p> : null}
    </div>
  );
}

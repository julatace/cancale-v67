// ── src/conseiller/Conseiller.jsx — « Conseils du jour » (Aujourd'hui) et l'écran « Conseiller » (23 nov.) ──
// docs/passation/2026-11-23-conseiller.md. Les conseils arrivent CALCULÉS (src/conseiller/regles.js sur
// src/conseiller/sources.js) : ici, seulement leur texte (tr, 5 langues) et le geste. Rien ne part d'ici : un toucher
// OUVRE l'écran VRM où il fait le geste lui-même. Composants natifs, aucun style en ligne, aucune couleur en dur.
import React from 'react';
import { Carte, Groupe, Rangee, Bouton, Vide } from '../natif/index.js';
import { tr, monnaie, nombre, localeCourante } from '../i18n/index.js';
import { pourCarte } from './regles.js';

const eur = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : monnaie(Number(v), 'EUR', Number.isInteger(Number(v)) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : undefined));
// Le nom d'un jour de la semaine (0 = dimanche), dans la langue.
export function nomJour(i) {
  try { const d = new Date(2026, 10, 22 + Number(i)); return d.toLocaleDateString(localeCourante(), { weekday: 'long' }); } catch (_) { return ''; }
}
const ICONES = { colis: 'truck', offres: 'tag', seuil: 'balance', baisses: 'euro', prix: 'pencil', racheter: 'bag', rapporte: 'chart', dorment: 'sleep', jour: 'calendar', compte: 'users' };

// Le texte d'un conseil : { titre, preuve, geste } — chaque nombre vient de `c.params` (la même source que l'écran).
export function texteConseil(c) {
  const p = c.params || {};
  switch (c.id) {
    case 'colis': return { titre: tr('cons.colis.titre.' + p.quand, { n: p.n }), preuve: p.quand === 'demain' && p.nAuj > 0 ? tr('cons.colis.preuveDont', { n: p.nAuj }) : tr('cons.colis.preuve'), geste: tr('cons.colis.geste') };
    case 'offres': return { titre: tr('cons.offres.titre', { n: p.n }), preuve: p.avecAge ? tr('cons.offres.preuve', { n: p.jours, j: nombre(p.jours) }) : tr('cons.offres.preuveSansAge'), geste: tr('cons.offres.geste') };
    case 'seuil': return { titre: tr('cons.seuil.titre.' + p.seuil, { pct: p.pct, plateforme: p.plateforme }), preuve: tr(p.auMoins ? 'cons.seuil.preuveAuMoins' : 'cons.seuil.preuve'), geste: tr('cons.seuil.geste') };
    case 'baisses': return { titre: tr('cons.baisses.titre', { n: p.n }), preuve: tr('cons.baisses.preuve'), geste: tr('cons.baisses.geste') };
    case 'prix': return { titre: tr('cons.prix.titre', { n: p.n }), preuve: tr('cons.prix.preuve', { sur: nombre(p.sur), n: p.sur }), geste: tr('cons.prix.geste') };
    case 'racheter': return { titre: tr('cons.racheter.titre', { nom: p.nom }), preuve: tr('cons.racheter.preuve', { n: p.n, moyen: eur(p.moyen), jours: nombre(Math.round(p.jours)) }), geste: tr('cons.stats.geste') };
    case 'rapporte': return { titre: tr('cons.rapporte.titre', { nom: p.nom }), preuve: tr('cons.rapporte.preuve', { n: p.n, moyen: eur(p.moyen) }), geste: tr('cons.stats.geste') };
    case 'dorment': return { titre: tr(p.auMoins ? 'cons.dorment.titreAuMoins' : 'cons.dorment.titre', { n: p.n }), preuve: tr('cons.dorment.preuve'), geste: tr('cons.dorment.geste') };
    case 'jour': return { titre: tr('cons.jour.titre', { jour: nomJour(p.jour) }), preuve: tr('cons.jour.preuve', { n: p.n, total: p.total, moyenne: nombre(p.moyenne), veille: nomJour(p.veille) }), geste: tr('cons.stats.geste') };
    case 'compte': return { titre: tr('cons.compte.titre', { nom: p.nom }), preuve: tr('cons.compte.preuve', { n: p.n, n2: p.n2, deux: p.deux }), geste: tr('cons.stats.geste') };
    default: return { titre: '', preuve: '', geste: '' };
  }
}

function LigneConseil({ c, onGeste, Icon, avecGeste = false }) {
  const t = texteConseil(c);
  const attrs = { 'data-cons': c.id, 'data-cons-geste': c.geste, 'data-cons-chiffres': JSON.stringify(c.chiffres || {}), 'aria-label': `${t.titre}. ${t.preuve}` };
  return (
    <Rangee icone={Icon ? <Icon name={ICONES[c.id] || 'ampoule'} size={22}/> : null} titre={t.titre} lignes={2} sousTitre={t.preuve} sousLignes={2}
      ton={c.ton === 'ambre' ? 'ambre' : 'neutre'} fin={avecGeste ? <Bouton variante="texte" onClick={() => onGeste && onGeste(c.geste, c)} attrs={{ 'data-cons-bouton': c.id }}>{t.geste}</Bouton> : 'chevron'}
      onClick={avecGeste ? null : () => onGeste && onGeste(c.geste, c)} attrs={attrs}/>
  );
}

// La carte d'Aujourd'hui : 3 conseils au plus ; rien à dire ⇒ AUCUNE carte (jamais une carte vide).
export function CarteConseils({ liste, onGeste, onToutVoir = null, Icon = null }) {
  if (!Array.isArray(liste) || !liste.length) return null;
  const L = pourCarte(liste);
  return (
    <Carte titre={tr('cons.titre')} n={liste.length > L.length ? liste.length : null}
      action={onToutVoir ? <Bouton variante="texte" onClick={onToutVoir} attrs={{ 'data-cons-tout': '' }}>{tr('cons.toutVoir')}</Bouton> : null}
      attrs={{ 'data-v2-bloc': 'conseils', 'data-cons-n': String(liste.length), 'data-cons-ids': L.map((c) => c.id).join(',') }}>
      {L.map((c) => <LigneConseil key={c.id} c={c} onGeste={onGeste} Icon={Icon}/>)}
    </Carte>
  );
}

// L'écran « Conseiller » : tous les conseils, puis « Demande à VRM » (tranche 2, passé en `demande`).
export function EcranConseiller({ liste, etat = 'lu', onGeste, Icon = null, demande = null }) {
  const lecture = etat === 'encours';
  return (
    <section className="n-cons" data-cons-ecran={etat} data-cons-n={Array.isArray(liste) ? String(liste.length) : ''} aria-label={tr('cons.ecran')}>
      <Groupe titre={tr('cons.titre')} pied={tr('cons.pied')} attrs={{ 'data-cons-groupe': '' }}>
        {lecture ? <Rangee titre={tr('cons.lecture')} attrs={{ 'data-cons-lecture': '', 'aria-busy': 'true' }}/>
          : !Array.isArray(liste) || !liste.length ? <Vide icone={Icon ? <Icon name="check" size={36}/> : null} phrase={tr('cons.vide')} detail={tr('cons.videSous')}/>
            : liste.map((c) => <LigneConseil key={c.id} c={c} onGeste={onGeste} Icon={Icon} avecGeste/>)}
      </Groupe>
      {demande}
    </section>
  );
}

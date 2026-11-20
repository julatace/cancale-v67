// ════════════════════════════════════════════════════════════════════════════
//  « TES MEILLEURES SOURCES » (11 nov.) — une carte, dans Argent (Statistiques,
//  sous « D'où viennent mes achats ») et dans Achats. Elle LIT la publication de
//  l'écran Ventes/Achats (`vrm_meilleures_sources`, src/meilleuresSources.js) ;
//  elle ne recalcule rien. Classement par bénéfice ou par vitesse ; chaque ligne
//  ouvre la liste de SES achats. La couverture est dite sur chaque ligne ; ce qui
//  n'est compté dans aucune source est nommé dessous. Aucun rouge (§7).
// ════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { lireMeilleures, classer, CLE_MEILLEURES, EVT_MEILLEURES, euros, jours, texteCouvertureSource, texteBenefice,
  texteInvesti, texteMarge, texteDelai, texteAttente, texteHorsSources } from './meilleuresSources.js';
import './styles-annonces-outils.css';
import './styles-sources-achats.css';
import './styles-meilleures-sources.css';
import { tr } from './i18n/index.js';
import { BoutonIcone as BoutonIconeNatif } from './natif/Bouton.jsx';
import { Glyphe as GlypheNatif } from './natif/icones.jsx';
import { Carte, Rangee, Segmente as NSegmente } from './natif/index.js';
import { AideArgent } from './natif/ecrans/AideArgent.jsx';
import './natif/ecrans/argent.css';

export function useMeilleures(owner) {
  const [v, setV] = useState(() => lireMeilleures(owner));
  useEffect(() => {
    const relire = () => setV(lireMeilleures(owner));
    relire();
    const surStockage = (e) => { if (!e || e.key == null || e.key === CLE_MEILLEURES) relire(); };
    window.addEventListener(EVT_MEILLEURES, relire);
    window.addEventListener('storage', surStockage);
    return () => { window.removeEventListener(EVT_MEILLEURES, relire); window.removeEventListener('storage', surStockage); };
  }, [owner]);
  return v;
}

const J = 86400000;
const dateCourte = (ms) => (ms == null ? 'date pas saisie' : new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }));

function Feuille({ titre, onFermer, Retour, children }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="vrm-ao-voile vrm-ms-voile" data-ms-feuille="" onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-ao-feuille vrm-ms-feuille" role="dialog" aria-modal="true" aria-label={titre}>
        <header className="vrm-ao-tete">
          <h2>{titre}</h2>
          <BoutonIconeNatif libelle="Fermer" icone={<GlypheNatif nom="close"/>} className="vrm-ao-x" onClick={onFermer} attrs={{ 'data-ms-fermer': "" }}/>
        </header>
        {children}
      </div>
    </div>, document.body);
}

// L'état d'UN achat, en clair : revendu (bénéfice) · pas encore revendu (depuis N jours).
function etatAchat(a, maintenant) {
  const parts = [];
  if (a.revendus) parts.push(a.articles > 1 ? `${a.revendus} sur ${a.articles} revendus` : `revendu${a.venduLe ? ' le ' + dateCourte(a.venduLe) : ''}`);
  const reste = a.articles - a.revendus;
  if (reste > 0) parts.push(`${a.articles > 1 ? reste + ' ' : ''}pas encore revendu${reste > 1 ? 's' : ''}${a.ts != null && a.ts <= maintenant ? ' · depuis ' + jours(Math.floor((maintenant - a.ts) / J)) : ''}`);
  return parts.join(' · ');
}

function ListeAchats({ s, maintenant }) {
  const [n, setN] = useState(60);
  const l = s.liste.slice(0, n);
  return (
    <div className="vrm-ms-liste-hote">
      <p className="vrm-ms-resume" data-ms-resume="">{texteCouvertureSource(s)} · investi {texteInvesti(s)}</p>
      <ol className="vrm-ms-achats" data-ms-achats={s.liste.length}>
        {l.map((a) => (
          <li key={a.genre + ':' + a.id} className="vrm-ms-achat" data-ms-achat={a.genre + ':' + a.id} data-ms-revendus={a.revendus} data-ms-articles={a.articles}>
            <div className="vrm-ms-achat-l1">
              <span className="vrm-ms-achat-titre">{a.titre || (a.numero ? `N°${a.numero}` : 'Achat sans titre')}</span>
              <span className="vrm-ms-achat-prix">{a.investi == null ? 'prix pas saisi' : euros(a.investi)}</span>
            </div>
            <div className="vrm-ms-achat-l2">
              <span>{dateCourte(a.ts)}{a.numero ? ` · N°${a.numero}` : ''}</span>
              <span>{etatAchat(a, maintenant)}{a.benefice != null ? ` · ${a.partiel ? 'au plus ' : ''}${euros(a.benefice, { signe: true })}` : ''}</span>
            </div>
          </li>
        ))}
      </ol>
      {s.liste.length > n ? <button type="button" className="vrm-lien-action vrm-ms-plus" onClick={() => setN(n + 100)}>Voir {Math.min(100, s.liste.length - n)} de plus</button> : null}
    </div>
  );
}

// owner : le compte VRM ; Retour : FermeAuRetour (la feuille se ferme au retour du téléphone).
// (14 nov., refonte Achats — Julien : « c'est moche », captures à l'appui) LA FORME seulement : le titre HORS de la
// carte (20/700, comme une section de Réglages) ; la carte = les sources ; chaque source = son nom, son chiffre À
// L'ENCRE (plus d'accent sur un montant, §7 : le bleu est pour les gestes) et des TUILES (gros chiffre, petit
// libellé) au lieu de chiffres noyés dans des phrases ; UNE ligne de couverture (§5 : « 45 revendus sur 824
// achetés … », la même phrase, au même endroit) ; ce qui n'entre dans aucune source en UNE ligne courte, et toutes
// les explications dans « Comment c'est calculé » (les MÊMES phrases qu'avant, rien de supprimé). Aucun chiffre
// n'est calculé ici : tout vient de `vrm_meilleures_sources` et de src/meilleuresSources.js.
const premierePartie = (t) => String(t || '').split(' : ')[0];
export default function MeilleuresSources({ owner = '', Retour = null, ici = 'argent' }) {
  const r = useMeilleures(owner);
  const [par, setPar] = useState('benefice');
  const [ouverte, setOuverte] = useState('');
  const maintenant = Date.now();
  const sources = useMemo(() => (r ? classer(r.sources, par) : []), [r, par]);
  // (20 nov., lot argent-natif) AU STYLE NATIF §2 bis — Julien : « “Tes meilleures sources” énorme ». Une carte à filet
  // (« TES MEILLEURES SOURCES » en petites capitales), « Bénéfice · Vitesse » en segmenté, une RANGÉE par source (le nom,
  // « investi · marge · délai » et la couverture en une ligne grise, le chiffre du classement à droite, chevron ⇒ ses
  // achats) ; ce qui n'entre dans aucune source en une ligne grise ; « Comment c'est calculé » en « ? » dans l'en-tête.
  // Les mêmes textes (src/meilleuresSources.js), les mêmes data-ms-*.
  let corps, hors = [];
  if (!r) corps = <Rangee titre="—" sousTitre="ouvre Achats pour les calculer" attrs={{ 'data-ms-etat': 'passu' }}/>;
  else if (!r.sources.length) corps = <Rangee titre="Aucun achat enregistré pour l’instant." attrs={{ 'data-ms-etat': 'lu', 'data-ms-n': '0' }}/>;
  else {
    const premier = sources.find((x) => x.cle !== 'non-saisie' && (par === 'vitesse' ? x.delaiMoyen != null : x.benefice != null && x.benefice > 0));
    hors = texteHorsSources(r);
    const sous = (x) => [texteInvesti(x) !== '—' ? `${tr('achats.ms.investi')} ${texteInvesti(x)}` : '', texteMarge(x) !== '—' ? `${tr('achats.ms.marge')} ${texteMarge(x)}` : '',
      par === 'vitesse' ? (texteBenefice(x) !== '—' ? `${tr('achats.ms.benefice')} ${texteBenefice(x)}` : '') : (texteDelai(x) !== '—' ? texteDelai(x) : ''), texteCouvertureSource(x)].filter(Boolean).join(' · ');
    corps = (
      <div className="vrm-ms-corps" data-ms-etat="lu" data-ms-n={sources.length}>
        {r.sources.length > 1 ? (
          <div className="n-arg-tri" data-ms-par={par}><NSegmente libelle="Classer" valeur={par} onChange={setPar}
            options={[{ cle: 'benefice', libelle: tr('achats.ms.benefice'), attrs: { 'data-ms-classer': 'benefice' } }, { cle: 'vitesse', libelle: tr('achats.ms.vitesse'), attrs: { 'data-ms-classer': 'vitesse' } }]}/></div>
        ) : null}
        {sources.map((x, i) => (
          <Rangee key={x.cle} titre={<>{x.libelle}{x.genre ? <span className="n-arg-gris"> · {x.genre}</span> : null}<span className="vrm-sr-seul"> · {texteAttente(x)} — ouvrir ses achats</span></>}
            sousTitre={sous(x)} sousLignes={2} valeur={<span className="vrm-ms-chiffre">{par === 'vitesse' ? texteDelai(x) : texteBenefice(x)}</span>} valeurForte fin="chevron" onClick={() => setOuverte(x.cle)}
            attrs={{ 'data-ms-source': x.cle, 'data-ms-rang': i + 1, 'data-ms-tete': premier === x ? '1' : undefined, 'data-ms-benefice': x.benefice == null ? '' : String(x.benefice),
              'data-ms-delai': x.delaiMoyen == null ? '' : String(x.delaiMoyen), 'data-ms-articles': x.articles, 'data-ms-revendus': x.revendus, 'data-ms-sans-prix': x.sansPrix, 'data-ms-pas-revendus': x.pasRevendus }}/>
        ))}
        {hors.map((t, i) => <p key={i} className="n-arg-pied vrm-ms-hors" data-ms-hors={i} title={t}>{premierePartie(t)}</p>)}
      </div>
    );
  }
  const s = ouverte ? (r && r.sources.find((x) => x.cle === ouverte)) : null;
  return (
    <Carte titre="Tes meilleures sources" className="vrm-ms-carte n-arg-ms"
      action={r && r.sources.length ? <AideArgent titre={tr('compta.commentCalcule')} attrs={{ 'data-ms-calcul': '' }}>
        <ul>
          {sources.map((x) => <li key={x.cle}><b>{x.libelle}</b> · {texteAttente(x)}</li>)}
          {hors.map((t, i) => <li key={'h' + i}>{t}</li>)}
          <li>Bénéfice et marge : sur les articles revendus et reliés à leur achat · « pas encore revendu » : aucune vente reliée (en stock, ou vendu sans achat relié).</li>
        </ul>
      </AideArgent> : null}
      attrs={{ 'data-stats-carte': 'meilleures-sources', 'data-ms-ici': ici }}>
      {corps}
      {s ? <Feuille titre={s.libelle} Retour={Retour} onFermer={() => setOuverte('')}><ListeAchats s={s} maintenant={maintenant}/></Feuille> : null}
    </Carte>
  );
}

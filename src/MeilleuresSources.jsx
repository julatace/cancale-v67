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
          <button type="button" className="vrm-ao-x" aria-label="Fermer" data-ms-fermer="" onClick={onFermer}>×</button>
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
  const tete = (
    <div className="vrm-ms-tete">
      <h2 className="vrm-ms-titre">Tes meilleures sources</h2>
      {r && r.sources.length > 1 ? (
        <div role="group" aria-label="Classer" className="vrm-ms-seg" data-ms-par={par}>
          <button type="button" aria-pressed={par === 'benefice'} data-ms-classer="benefice" onClick={() => setPar('benefice')}>{tr('achats.ms.benefice')}</button>
          <button type="button" aria-pressed={par === 'vitesse'} data-ms-classer="vitesse" onClick={() => setPar('vitesse')}>{tr('achats.ms.vitesse')}</button>
        </div>
      ) : null}
    </div>
  );
  let corps;
  if (!r) corps = <p className="vrm-sa-vide vrm-ms-surface" data-ms-etat="passu">— · ouvre Achats pour les calculer</p>;
  else if (!r.sources.length) corps = <p className="vrm-sa-vide vrm-ms-surface" data-ms-etat="lu" data-ms-n="0">Aucun achat enregistré pour l’instant.</p>;
  else {
    const premier = sources.find((s) => s.cle !== 'non-saisie' && (par === 'vitesse' ? s.delaiMoyen != null : s.benefice != null && s.benefice > 0));
    const hors = texteHorsSources(r);
    // Une tuile : le gros chiffre, le libellé dessous. « — » reste « — » (pas su ≠ 0, §5).
    // « au moins 300 € » : « au moins » en petit AU-DESSUS du chiffre (les mêmes mots ; le chiffre tient dans sa tuile).
    const tuile = (cle, val, lib) => { const m = /^(au moins|au plus) (.+)$/.exec(val);
      return <span className="vrm-ms-tuile" data-ms-tuile={cle}><b className={val === '—' ? 'is-vide' : undefined}>{m ? <><span className="vrm-ms-pre">{m[1]} </span>{m[2]}</> : val}</b><small>{lib}</small></span>; };
    corps = (
      <div className="vrm-ms" data-ms-etat="lu" data-ms-n={sources.length}>
        <ol className="vrm-ms-lignes vrm-ms-surface">
          {sources.map((s, i) => (
            <li key={s.cle}>
              <button type="button" className="vrm-ms-ligne" data-ms-source={s.cle} data-ms-rang={i + 1} data-ms-tete={premier === s ? '1' : undefined}
                data-ms-benefice={s.benefice == null ? '' : String(s.benefice)} data-ms-delai={s.delaiMoyen == null ? '' : String(s.delaiMoyen)}
                data-ms-articles={s.articles} data-ms-revendus={s.revendus} data-ms-sans-prix={s.sansPrix} data-ms-pas-revendus={s.pasRevendus}
                onClick={() => setOuverte(s.cle)}>
                {/* (11 nov., lot accessibilité) Nommé par ce qu'il montre (source, chiffres) + le geste lu à la
                    fin ; un aria-label « source : ouvrir ses achats » taisait les chiffres affichés (WCAG 2.5.3). */}
                <span className="vrm-ms-nom">{s.libelle}{s.genre ? <span className="vrm-ms-genre"> · {s.genre}</span> : null}</span>
                <span className="vrm-ms-chiffre">{par === 'vitesse' ? texteDelai(s) : texteBenefice(s)}</span>
                <span className="vrm-ms-chevron" aria-hidden="true">›</span>
                <span className="vrm-ms-tuiles">
                  {tuile('investi', texteInvesti(s), tr('achats.ms.investi'))}
                  {tuile('marge', texteMarge(s), tr('achats.ms.marge'))}
                  {par === 'vitesse' ? tuile('benefice', texteBenefice(s), tr('achats.ms.benefice')) : tuile('delai', texteDelai(s), tr('achats.ms.pourRevendre'))}
                </span>
                {/* §5 : la couverture À CÔTÉ des chiffres, en une ligne (la même phrase qu'avant) — « revendus sur
                    achetés » n'a pas de tuile : le même nombre ne s'écrit qu'une fois (§7). */}
                <span className="vrm-ms-sur" title={texteCouvertureSource(s)}>{texteCouvertureSource(s)}</span>
                <span className="vrm-sr-seul"> · {texteAttente(s)} — ouvrir ses achats</span>
              </button>
            </li>
          ))}
        </ol>
        {/* Ce qui n'est compté dans AUCUNE source : dit en une ligne courte (le début de la même phrase) ; la phrase
            entière, et le pourquoi, dans « Comment c'est calculé ». */}
        {hors.map((t, i) => <p key={i} className="vrm-ms-hors" data-ms-hors={i} title={t}>{premierePartie(t)}</p>)}
        <details className="vrm-ms-calcul" data-ms-calcul="">
          <summary>{tr('compta.commentCalcule')}</summary>
          <ul>
            {sources.map((s) => <li key={s.cle}><b>{s.libelle}</b> · {texteAttente(s)}</li>)}
            {hors.map((t, i) => <li key={'h' + i}>{t}</li>)}
            <li>Bénéfice et marge : sur les articles revendus et reliés à leur achat · « pas encore revendu » : aucune vente reliée (en stock, ou vendu sans achat relié).</li>
          </ul>
        </details>
      </div>
    );
  }
  const s = ouverte ? (r && r.sources.find((x) => x.cle === ouverte)) : null;
  return (
    <section className="vrm-ms-carte" data-stats-carte="meilleures-sources" data-ms-ici={ici}>
      {tete}{corps}
      {s ? <Feuille titre={s.libelle} Retour={Retour} onFermer={() => setOuverte('')}><ListeAchats s={s} maintenant={maintenant}/></Feuille> : null}
    </section>
  );
}

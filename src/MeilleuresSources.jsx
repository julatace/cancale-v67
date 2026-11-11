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
export default function MeilleuresSources({ owner = '', Retour = null, ici = 'argent' }) {
  const r = useMeilleures(owner);
  const [par, setPar] = useState('benefice');
  const [ouverte, setOuverte] = useState('');
  const maintenant = Date.now();
  const sources = useMemo(() => (r ? classer(r.sources, par) : []), [r, par]);
  const tete = (
    <div className="vrm-sv-carte-tete vrm-ms-tete">
      <h2 className="vrm-display vrm-sv-carte-titre">Tes meilleures sources</h2>
      {r && r.sources.length > 1 ? (
        <div role="group" aria-label="Classer" className="vrm-ms-seg" data-ms-par={par}>
          <button type="button" aria-pressed={par === 'benefice'} data-ms-classer="benefice" onClick={() => setPar('benefice')}>Bénéfice</button>
          <button type="button" aria-pressed={par === 'vitesse'} data-ms-classer="vitesse" onClick={() => setPar('vitesse')}>Vitesse</button>
        </div>
      ) : null}
    </div>
  );
  let corps;
  if (!r) corps = <p className="vrm-sa-vide" data-ms-etat="passu">— · ouvre Achats pour les calculer</p>;
  else if (!r.sources.length) corps = <p className="vrm-sa-vide" data-ms-etat="lu" data-ms-n="0">Aucun achat enregistré pour l’instant.</p>;
  else {
    const premier = sources.find((s) => s.cle !== 'non-saisie' && (par === 'vitesse' ? s.delaiMoyen != null : s.benefice != null && s.benefice > 0));
    corps = (
      <div className="vrm-ms" data-ms-etat="lu" data-ms-n={sources.length}>
        <ol className="vrm-ms-lignes">
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
                <span className="vrm-ms-cases">
                  <span><b>{texteInvesti(s)}</b> investi</span>
                  <span><b>{texteMarge(s)}</b> marge</span>
                  {par === 'vitesse' ? <span><b>{texteBenefice(s)}</b> bénéfice</span> : <span><b>{texteDelai(s)}</b> pour revendre</span>}
                </span>
                <span className="vrm-ms-sur">{texteCouvertureSource(s)}</span>
                <span className="vrm-ms-sur" data-ms-attente="">{texteAttente(s)}</span>
                <span className="vrm-sr-seul"> — ouvrir ses achats</span>
              </button>
            </li>
          ))}
        </ol>
        {texteHorsSources(r).map((t, i) => <p key={i} className="vrm-sa-note" data-ms-hors={i}>{t}</p>)}
        <p className="vrm-sa-note">Bénéfice et marge : sur les articles revendus et reliés à leur achat · « pas encore revendu » : aucune vente reliée (en stock, ou vendu sans achat relié).</p>
      </div>
    );
  }
  const s = ouverte ? (r && r.sources.find((x) => x.cle === ouverte)) : null;
  return (
    <section className="vrm-sv-carte vrm-ms-carte" data-stats-carte="meilleures-sources" data-ms-ici={ici}>
      {tete}{corps}
      {s ? <Feuille titre={s.libelle} Retour={Retour} onFermer={() => setOuverte('')}><ListeAchats s={s} maintenant={maintenant}/></Feuille> : null}
    </section>
  );
}

// ── src/natif/ecrans/RetoursVentes.jsx — « Retours et litiges », UNE présentation (20 nov.) ─────────────────────────────
// Julien, capture Edge 1512 de Ventes : « on a 4 litiges avec 2 écritures différentes » — deux grandes cartes « Retour en
// route · Déjà reçu » au-dessus d'un bloc encadré « Retours · 8 » d'un autre style (plaque bleutée, « Sur Vinted ↗ »,
// « Reçu », « × », un plein noir « Remettre en ligne » dans une rangée). Ici : UN groupe replié « Retours et litiges · N »
// (comme « À régler »), des rangées au MÊME style que le tableau (vignette, titre, acheteur, N° en plaque standard, étape en
// étiquette neutre), UNE action par rangée au plus en bouton TEXTE, le reste derrière « ⋯ » ; les anciens (remboursés il y a
// plus de 45 j) derrière « Voir les N anciens ». Au téléphone : la rangée native, toucher ⇒ une feuille avec ses gestes.
//
// PRÉSENTATIONNEL : les rangées arrivent faites par src/App.jsx (`retoursNatif`, les MÊMES règles qu'avant : `retoursEnCours`,
// `retourAReceptionner`, src/retoursStock.js) et chaque geste est la fonction d'avant (reçu, remise en stock sous SON N°,
// remettre en ligne, masquer). Aucun chiffre n'est calculé ici.
//
// rangs : [{ cle, num, titre, photo, sous, etape, ancien, action: { cle, libelle, onClick | href } | null,
//            menu: [{ cle, libelle, onClick | href }], attrs }] · passSu : phrase (ventes pas lues) · Icon · Photo
import React from 'react';
import { tr } from '../../i18n/index.js';
import { Groupe } from '../Groupe.jsx';
import { Rangee, Vignette } from '../Rangee.jsx';
import { Plaque } from '../Plaque.jsx';
import { Pastille } from '../Pastille.jsx';
import { Feuille } from '../Feuille.jsx';
import { useOrdinateur } from '../Coque.jsx';

export const ETAPES_VR = ['enroute', 'transit', 'point', 'initie', 'recu', 'averifier', 'remis', 'rembourse'];
// (21 nov., lot 77 « Suivi des retours ») Le colis qui revient : les étapes PROUVÉES (src/App.jsx `retoursNatif`, règle
// api/_lib/retour-vente-suivi.js), dites dans la feuille du retour — « Retour accepté · Expédié par l'acheteur · En transit ·
// Arrivé chez toi / au point » — et, s'il attend en point relais, le point et le code LUS (jamais fabriqués).
// `r.suivi` : { etapes: [{ cle, fait, at }], suivi, transporteur, point: { nom, adresse, code } | null, lien } | null.
const ETAPES_COLIS = ['accepte', 'expedie', 'transit', 'arrive'];
function Frise({ sv }) {
  if (!sv || !Array.isArray(sv.etapes)) return null;
  const fait = new Set(sv.etapes.filter((e) => e.fait).map((e) => e.cle));
  const auPoint = fait.has('point') && !fait.has('arrive');
  return (
    <ol className="n-vr-frise" data-vr-frise="">
      {ETAPES_COLIS.map((k) => {
        const f = fait.has(k) || (k === 'arrive' && auPoint);
        const lib = k === 'arrive' && auPoint ? tr('vr.colis.point') : tr('vr.colis.' + k);
        return <li key={k} className="n-vr-frise-etape" data-vr-frise-etape={k} data-fait={f ? '1' : '0'}><span className="n-vr-frise-point" aria-hidden="true"/><span className="n-vr-frise-lib">{lib}</span></li>;
      })}
    </ol>
  );
}

function Geste({ g, attrs = null }) {
  if (!g) return null;
  if (g.href) return <a className="n-vr-geste" href={g.href} target="_blank" rel="noreferrer" data-vr-geste={g.cle} {...(attrs || {})}>{g.libelle}</a>;
  return <button type="button" className="n-vr-geste" data-vr-geste={g.cle} onClick={(e) => { e.stopPropagation(); g.onClick(e); }} {...(attrs || {})}>{g.libelle}</button>;
}

// « ⋯ » d'une rangée (ordinateur) : un petit menu posé sous le bouton, fermé par Échap ou un clic dehors.
function Plus({ r, Icon }) {
  const [ouvert, setOuvert] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ouvert) return undefined;
    const dehors = (e) => { if (ref.current && !ref.current.contains(e.target)) setOuvert(false); };
    const echap = (e) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('pointerdown', dehors, true); document.addEventListener('keydown', echap, true);
    return () => { document.removeEventListener('pointerdown', dehors, true); document.removeEventListener('keydown', echap, true); };
  }, [ouvert]);
  if (!r.menu || !r.menu.length) return null;
  return (
    <span className="n-tt-ancre" ref={ref}>
      <button type="button" className="n-tt-bouton n-tt-bouton-icone n-tt-plus" aria-haspopup="true" aria-expanded={ouvert ? 'true' : 'false'}
        aria-label={tr('tableau.actionsDe', { titre: r.titre || '' })} data-vr-plus={r.cle} onClick={() => setOuvert((v) => !v)}>{Icon ? <Icon name="more" size={18}/> : '⋯'}</button>
      {ouvert ? <div className="n-tt-pop" data-tt-droite="1" role="menu">
        <div className="n-tt-pop-liste">
          {r.menu.map((m) => (m.href
            ? <a key={m.cle} className="n-tt-choix" role="menuitem" href={m.href} target="_blank" rel="noreferrer" data-vr-menu={m.cle} onClick={() => setOuvert(false)}><span className="n-tt-choix-libelle">{m.libelle}</span></a>
            : <button key={m.cle} type="button" className="n-tt-choix" role="menuitem" data-vr-menu={m.cle} onClick={() => { setOuvert(false); m.onClick(); }}><span className="n-tt-choix-libelle">{m.libelle}</span></button>))}
        </div>
      </div> : null}
    </span>
  );
}

const vignette = (r, Photo, taille) => <Vignette src={r.photo || ''} alt="" taille={taille} image={r.photo && Photo ? <Photo src={r.photo} alt="" loading="lazy" decoding="async"/> : null}/>;

export default function RetoursVentes({ rangs, passSu = '', Icon = null, Photo = null, ouvertDefaut = false, enRoute = 0 }) {
  const ordinateur = useOrdinateur();
  const [ouvert, setOuvert] = React.useState(!!ouvertDefaut);   // (21 nov.) ouvert dans la feuille d'accès du téléphone
  const [anciens, setAnciens] = React.useState(false);
  const [feuille, setFeuille] = React.useState(null);
  if (!passSu && (!Array.isArray(rangs) || !rangs.length)) return null;
  const L = Array.isArray(rangs) ? rangs : [];
  const recents = L.filter((r) => !r.ancien), vieux = L.filter((r) => r.ancien);
  const vus = anciens ? [...recents, ...vieux] : recents;
  const ouverte = feuille ? L.find((r) => r.cle === feuille) || null : null;
  const etiquette = (r) => <span className="n-tt-etiquette" data-tt-ton="neutre" data-vr-etape={r.etape}>{tr('vr.etape.' + r.etape)}</span>;
  const corps = ordinateur ? (
    <div className="n-tt-cadre n-vr-cadre" data-vr-tableau="">
      <table className="n-tt-table">
        <thead><tr>
          <th scope="col" className="n-tt-th n-tt-th-article">{tr('tableau.colArticle')}</th>
          <th scope="col" className="n-tt-th">{tr('egalite.col.numero')}</th>
          <th scope="col" className="n-tt-th">{tr('vr.col.etape')}</th>
          <th scope="col" className="n-tt-th"><span className="n-tt-sr">{tr('vr.col.geste')}</span></th>
          <th scope="col" className="n-tt-th n-tt-th-menu"><span className="n-tt-sr">{tr('tableau.plusDActions')}</span></th>
        </tr></thead>
        <tbody>
          {vus.map((r) => (
            <tr key={r.cle} className="n-tt-tr n-vr-tr" data-vr-rang={r.cle} data-vr-ancien={r.ancien ? '1' : undefined} {...(r.attrs || {})}>
              <td className="n-tt-td n-tt-td-article">
                <span className="n-tt-article">
                  {vignette(r, Photo, 48)}
                  <span className="n-tt-article-texte">
                    <span className="n-tt-article-titre" title={r.titre || ''}>{r.titre || tr('tableau.sansTitre')}</span>
                    {r.sous ? <span className="n-tt-article-sous" title={r.sous}>{r.sous}</span> : null}
                  </span>
                </span>
              </td>
              <td className="n-tt-td" data-tt-col="numero">{r.num ? <Plaque numero={r.num}/> : <span className="n-tt-vide-cellule">—</span>}</td>
              <td className="n-tt-td" data-tt-col="etape">{etiquette(r)}</td>
              <td className="n-tt-td n-vr-td-geste">{r.action ? <Geste g={r.action}/> : null}</td>
              <td className="n-tt-td n-tt-td-menu"><Plus r={r} Icon={Icon}/></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <>{vus.map((r) => <Rangee key={r.cle} vignette={vignette(r, Photo)} titre={r.titre || tr('tableau.sansTitre')} lignes={2}
      plaque={r.num ? <Plaque numero={r.num}/> : null} sousTitre={r.sous || ''} valeur={<Pastille ton="neutre">{tr('vr.etape.' + r.etape)}</Pastille>}
      fin="chevron" onClick={() => setFeuille(r.cle)} attrs={{ 'data-vr-rang': r.cle, 'data-vr-etape': r.etape, 'data-vr-ancien': r.ancien ? '1' : undefined, ...(r.attrs || {}) }}/>)}</>
  );
  return (
    <>
      <Groupe titre={tr('vr.titre')} repli={{ ouvert, n: L.length || null, onBascule: () => setOuvert((v) => !v) }} nu={ordinateur}
        action={enRoute > 0 ? <span className="n-vr-enroute" data-vr-enroute={String(enRoute)}>{tr('vr.enRoute', { n: enRoute })}</span> : null}
        className="n-vr" attrs={{ 'data-vr-groupe': ouvert ? 'ouvert' : 'replie', 'data-vr-n': String(L.length) }}>
        {passSu ? <p className="n-vr-passu" data-vr-passu="">{passSu}</p> : null}
        {corps}
        {vieux.length ? <div className="n-vr-anciens"><button type="button" className="n-tt-lien" data-vr-anciens={String(vieux.length)} onClick={() => setAnciens((v) => !v)}>
          {anciens ? tr('vr.masquerAnciens') : tr('vr.voirAnciens', { n: vieux.length })}</button></div> : null}
      </Groupe>
      {!ordinateur ? <Feuille ouverte={!!ouverte} onFermer={() => setFeuille(null)} titre={ouverte ? (ouverte.titre || tr('vr.titre')) : ''} detente="moitie" attrs={{ 'data-vr-feuille': ouverte ? ouverte.cle : '' }}>
        {ouverte && ouverte.suivi ? <Groupe attrs={{ 'data-vr-colis': ouverte.cle }}>
          <div className="n-vr-colis">
            <Frise sv={ouverte.suivi}/>
            <p className="n-vr-colis-suivi" data-vr-colis-suivi={ouverte.suivi.suivi || ''}>{ouverte.suivi.suivi ? [ouverte.suivi.transporteur, tr('vr.suivi.numero', { su: ouverte.suivi.suivi })].filter(Boolean).join(' · ') : tr('vr.suivi.pasLu')}</p>
            {ouverte.suivi.point ? <p className="n-vr-colis-point" data-vr-colis-point="">{[ouverte.suivi.point.nom, ouverte.suivi.point.adresse].filter(Boolean).join(' · ')}</p> : null}
            {ouverte.suivi.point && ouverte.suivi.point.code ? <p className="n-vr-colis-code" data-vr-colis-code={ouverte.suivi.point.code}><span className="n-vr-colis-code-lib">{tr('vr.suivi.codeLib')}</span> <b className="n-vr-colis-code-v">{ouverte.suivi.point.code}</b></p> : null}
          </div>
          {ouverte.suivi.lien ? <Rangee titre={tr('vr.suivi.suivre')} href={ouverte.suivi.lien} fin="chevron" attrs={{ 'data-vr-geste': 'suivre' }}/> : null}
        </Groupe> : null}
        {ouverte ? <Groupe attrs={{ 'data-vr-gestes': ouverte.cle }}>
          {[ouverte.action, ...(ouverte.menu || [])].filter(Boolean).map((g) => <Rangee key={g.cle} titre={g.libelle} href={g.href || ''} fin={g.href ? 'chevron' : null}
            onClick={g.href ? null : () => { setFeuille(null); g.onClick(); }} attrs={{ 'data-vr-geste': g.cle }}/>)}
        </Groupe> : null}
      </Feuille> : null}
    </>
  );
}

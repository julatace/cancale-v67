// ── « ACHETÉS, PAS EN LIGNE » : LA LISTE (11 nov., lot pas-en-ligne) ────────────────
// La RÈGLE : src/pasEnLigne.js (jugée par App.jsx, `usePasEnLigne`). Ici seulement ce qui se
// dessine : le seuil (7/14/30/60 j), la liste PROUVÉE (le plus ancien d'abord : photo, N°,
// emplacement, prix d'achat, depuis quand, UN geste), puis « à confirmer » replié avec le manque
// nommé (« shop_b pas relu depuis 3 j »). Aucun nombre n'est recalculé ; tout texte passe par tr().
// « Créer sur Vinted » en série attend le lot `claude/annonce-vinted` (pas sur main le 11 nov.) :
// le geste ouvre l'achat (ou l'import) où il relie l'article à son annonce par SON N°.
import React from 'react';
import { tr, monnaie } from './i18n/index.js';
import { SEUILS_PAS_EN_LIGNE } from './pasEnLigne.js';
import './pas-en-ligne.css';

// La phrase d'un manque, de la même source que le jugement (§5).
export function texteManque(m) {
  if (!m) return '';
  if (m.sorte === 'sans-numero') return tr('pasEnLigne.manque.sansNumero', { n: m.n });
  if (m.sorte === 'pas-relie') return tr('pasEnLigne.manque.pasRelies', { n: m.n });
  if (m.etat === 'vieille') return tr('pasEnLigne.manque.vieille', { nom: m.nom, n: m.jours });
  if (m.etat === 'jamais') return tr('pasEnLigne.manque.jamais', { nom: m.nom });
  if (m.etat === 'partielle') return tr('pasEnLigne.manque.partielle', { nom: m.nom });
  return tr('pasEnLigne.manque.ratee', { nom: m.nom });
}
// Les manques de tout le jugement (une ligne chacun, jamais répétée sous chaque article).
export function manquesDe(r) {
  if (!r || !r.manques) return [];
  const l = (r.manques.sources || []).map((m) => ({ sorte: 'source', ...m }));
  const num = (r.aConfirmer || []).some((c) => c.sorte === 'num'), ach = (r.aConfirmer || []).some((c) => c.sorte === 'achat');
  if (num && r.manques.sansNumero > 0) l.push({ sorte: 'sans-numero', n: r.manques.sansNumero });
  if (ach && r.manques.pasRelies > 0) l.push({ sorte: 'pas-relie', n: r.manques.pasRelies });
  return l;
}
// La carte de Ma journée : { titre, detail }.
export const texteCartePasEnLigne = (r) => ({
  titre: tr('pasEnLigne.carte.titre', { n: r.liste.length }),
  detail: tr('pasEnLigne.carte.detail', { n: r.seuil }),
});

function Vignette({ c, Photo, photosHors }) {
  const src = c.source === 'vinted' ? c.photo : (c.source === 'hors' && photosHors ? photosHors[c.achatId] : null);
  return (
    <span className="vrm-pel-photo" aria-hidden="true">
      {src ? (c.source === 'vinted' && Photo ? <Photo src={src} alt="" loading="lazy" /> : <img src={src} alt="" loading="lazy" />) : null}
      {c.numero ? <span className="vrm-pel-num">N°{c.numero}</span> : null}
    </span>
  );
}

function Ligne({ c, Photo, photosHors, onOuvrir, Bouton }) {
  const depuis = tr(c.depuisAuMoins ? 'pasEnLigne.depuisAuMoins' : 'pasEnLigne.depuis', { n: c.jours });
  const infos = [c.prix != null ? tr('pasEnLigne.achete', { prix: monnaie(c.prix) }) : null, depuis].filter(Boolean).join(' · ');
  return (
    <li className="vrm-pel-ligne" data-pel-ligne={c.id} data-pel-num={c.numero || ''} data-pel-tx={c.tx || ''} data-pel-jours={String(c.jours)}>
      <Vignette c={c} Photo={Photo} photosHors={photosHors} />
      <span className="vrm-pel-textes">
        <span className="vrm-pel-titre">{c.numero ? `N°${c.numero} · ` : ''}{c.titre || '—'}</span>
        <span className="vrm-pel-sous">{infos}</span>
        {c.ou ? <span className="vrm-pel-sous" data-pel-ou="">{c.ou}</span> : null}
        {c.lot ? <span className="vrm-pel-sous" data-pel-lot="">{c.lot.n ? tr('pasEnLigne.lot', { n: c.lot.reste, total: c.lot.n }) : tr('pasEnLigne.lotSansNombre')}</span> : null}
        {c.doublon ? <span className="vrm-pel-sous is-rouge" data-pel-doublon="">{tr('pasEnLigne.doublon')}</span> : null}
      </span>
      <Bouton variante="secondaire" className="vrm-b-petit" data-pel-ouvrir={c.source} onClick={() => onOuvrir(c)}>
        {c.source === 'import' ? tr('pasEnLigne.ouvrirImport') : tr('pasEnLigne.ouvrirAchat')}
      </Bouton>
    </li>
  );
}

export function PasEnLigneDetail({ r, seuil, onSeuil, onOuvrir, onRelire, onAnnonces, Bouton, Segmente, Pourquoi, Photo, lirePhotos }) {
  const [photosHors, setPhotosHors] = React.useState(null);
  const [repli, setRepli] = React.useState(false);
  const ids = r && r.su ? [...r.liste, ...r.aConfirmer].filter((c) => c.source === 'hors' && c.photo).map((c) => c.achatId).slice(0, 40) : [];
  const cleIds = ids.join(',');
  React.useEffect(() => {
    if (!ids.length || typeof lirePhotos !== 'function') return undefined;
    let vivant = true;
    lirePhotos(ids).then((m) => { if (vivant && m) setPhotosHors(m); });
    return () => { vivant = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleIds]);
  const seg = <Segmente label={tr('pasEnLigne.seuil')} value={String(seuil)} onChange={(v) => onSeuil(Number(v))}
    options={SEUILS_PAS_EN_LIGNE.map((j) => ({ v: String(j), l: tr('pasEnLigne.seuilJours', { n: j }), data: { 'data-pel-seuil': String(j) } }))} />;
  if (r === undefined) return <div className="vrm-pel" data-pel="en-cours">{seg}<p className="vrm-pel-note" role="status">{tr('pasEnLigne.enCours')}</p></div>;
  if (r === null || !r.su) return (
    <div className="vrm-pel" data-pel="pas-su">{seg}
      <p className="vrm-pel-note" role="status"><b>—</b> {tr('pasEnLigne.pasSu')}</p>
      {onRelire ? <Bouton variante="secondaire" onClick={onRelire}>{tr('commun.reessayer')}</Bouton> : null}
    </div>
  );
  const manques = manquesDe(r);
  return (
    <div className="vrm-pel" data-pel="lu" data-pel-n={String(r.liste.length)} data-pel-a-confirmer={String(r.aConfirmer.length)}>
      {seg}
      {r.liste.length ? (
        <ul className="vrm-pel-liste" data-pel-liste="">
          {r.liste.map((c) => <Ligne key={c.id} c={c} Photo={Photo} photosHors={photosHors} onOuvrir={onOuvrir} Bouton={Bouton} />)}
        </ul>
      ) : <p className="vrm-pel-note" data-pel-vide="">{tr(r.aConfirmer.length ? 'pasEnLigne.videProuve' : 'pasEnLigne.vide', { n: r.seuil })}</p>}
      {r.aConfirmer.length ? (
        <section className="vrm-pel-confirmer" data-pel-confirmer="">
          <button type="button" className="vrm-pel-repli" aria-expanded={repli ? 'true' : 'false'} onClick={() => setRepli((x) => !x)}>
            <span>{tr('pasEnLigne.aConfirmer', { n: r.aConfirmer.length })}</span><span aria-hidden="true">{repli ? '▴' : '▾'}</span>
          </button>
          <ul className="vrm-pel-manques" data-pel-manques="">
            {manques.map((m, i) => <li key={i} className="is-ambre" data-pel-manque={m.sorte === 'source' ? m.etat : m.sorte}>{texteManque(m)}</li>)}
          </ul>
          {manques.some((m) => m.sorte === 'pas-relie' || m.sorte === 'sans-numero') && onAnnonces ? <Bouton variante="secondaire" className="vrm-b-petit" data-pel-annonces="" onClick={onAnnonces}>{tr('pasEnLigne.voirAnnonces')}</Bouton> : null}
          {repli ? <ul className="vrm-pel-liste is-doute">{r.aConfirmer.map((c) => <Ligne key={c.id} c={c} Photo={Photo} photosHors={photosHors} onOuvrir={onOuvrir} Bouton={Bouton} />)}</ul> : null}
        </section>
      ) : null}
      {Pourquoi ? <Pourquoi>{tr('pasEnLigne.pourquoi')}</Pourquoi> : null}
    </div>
  );
}

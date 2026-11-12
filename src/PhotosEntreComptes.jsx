// ── « PHOTOS EN DOUBLE ENTRE TES COMPTES » (11 nov., lot photos-comptes) ─────────
// La feuille (Annonces → Outils, carte ambre de Ma journée) et l'encart « avant de
// publier ». Règle : src/photoEmpreinte.js ; données : src/photosComptes.js.
// Chaque groupe = des annonces de comptes Vinted DIFFÉRENTS qui partagent une photo,
// miniatures côte à côte, et UN geste : « Republier avec d'autres photos » (Republier à
// la main : il reprend des photos, VRM garde le N°). VRM ne supprime, ne modifie et ne
// relie rien tout seul (§3, §5). Pas vérifié ⇒ dit, jamais « aucun doublon ».
import React from 'react';
import { PhotoVide } from './composants/PhotoVide.jsx';
import { tr, localeCourante } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { lirePhotosComptes, abonnerPhotosComptes, cibleRepublier, verifierAvantPublier, empreinteImageLocale } from './photosComptes.js';
import './styles-photos-comptes.css';

const lienVinted = (a) => (/^https:\/\/www\.vinted\.[a-z.]+\//.test(String(a.url || '')) ? a.url : `https://www.vinted.fr/items/${encodeURIComponent(a.id)}`);
const nomDe = (a) => a.nom || tr('photosComptes.compteSansNom');
const et = (noms) => { try { return new Intl.ListFormat(localeCourante(), { type: 'conjunction' }).format(noms); } catch (_) { return noms.join(', '); } };

export function usePhotosComptes() {
  const [, maj] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => abonnerPhotosComptes(maj), []);
  return lirePhotosComptes();
}

// Les mots de la carte de Ma journée et du menu (une source, §7).
export function textePhotosComptes(res) {
  const g = (res && res.groupes) || [];
  const comptes = [...new Set(g.flatMap((x) => x.annonces.filter((a) => (a.plateforme || 'vinted') === 'vinted').map(nomDe)))];
  return { titre: tr('photosComptes.groupes', { n: g.length }), detail: tr('photosComptes.surComptes', { comptes: et(comptes) }) };
}

function Vignette({ a, PhotoVinted }) {
  return (
    <figure className="vrm-phc-vignette" data-pc-annonce={`${a.cc}|${a.id}`}>
      <a className="vrm-phc-photo" href={lienVinted(a)} target="_blank" rel="noopener noreferrer" aria-label={`${tr('photosComptes.ouvrir')} · ${nomDe(a)}`} data-pc-ouvrir={a.id}>
        {a.photo && PhotoVinted ? <PhotoVinted src={a.photo} alt="" loading="lazy"/> : <PhotoVide remplir/>}
      </a>
      <figcaption>
        <b>{nomDe(a)}</b>
        <small>{a.numero ? `N°${a.numero}` : tr('photosComptes.sansNumero')}{a.titre ? ` · ${a.titre}` : ''}</small>
      </figcaption>
    </figure>
  );
}

export function PhotosEntreComptesDetail({ res, PhotoVinted = null, onRepublier = null, extension = 'ok', versionExt = '' }) {
  useLangue();
  if (!res) return <p className="vrm-phc-etat" data-pc-pas-pret="">{tr('photosComptes.lecture')}</p>;
  const g = res.groupes || [];
  const pasRelus = (res.comptesPasVerifies || []).map((cc) => res.noms[cc] || cc.replace(/^vinted:/, ''));
  return (
    <div className="vrm-phc" data-photos-comptes="" data-pc-groupes={g.length} data-pc-lu={res.lu ? '1' : '0'} data-pc-verifiees={res.nVerifiees} data-pc-pas-verifiees={res.nPasVerifiees}>
      <p className="vrm-phc-risque">{tr('photosComptes.risque')}</p>
      <p className="vrm-phc-etat" data-pc-etat="">
        {!res.lu ? tr('photosComptes.lectureRatee')
          : g.length ? tr('photosComptes.verifiees', { n: res.nVerifiees })
          : res.nVerifiees ? tr('photosComptes.aucuneParmi', { n: res.nVerifiees }) : null}
        {res.nPasVerifiees > 0 ? <span data-pc-manque={res.nPasVerifiees}>{tr('photosComptes.pasVerifiees', { n: res.nPasVerifiees })}</span> : null}
      </p>
      {extension !== 'ok' ? <p className="vrm-phc-ext" data-pc-ext={extension}>{tr(extension === 'absente' ? 'photosComptes.extensionAbsente' : 'photosComptes.extension', { v: versionExt })}</p> : null}
      {g.map((x) => {
        const cible = cibleRepublier(x);
        return (
          <section key={x.id} className="vrm-phc-groupe" data-pc-groupe={x.id} data-pc-distance={String(x.distance)}>
            <div className="vrm-phc-rangee">{x.annonces.map((a) => <Vignette key={`${a.cc}|${a.id}`} a={a} PhotoVinted={PhotoVinted}/>)}</div>
            {cible && onRepublier ? (
              <button type="button" className="vrm-phc-geste" data-pc-republier={`${cible.compte}:${cible.id}`} onClick={() => onRepublier(cible)}
                title={tr('photosComptes.republierAide', { numero: cible.numero ? `N°${cible.numero}` : tr('photosComptes.sansNumero'), compte: nomDe(cible) })}>
                {tr('photosComptes.republier')}<small>{nomDe(cible)}{cible.numero ? ` · N°${cible.numero}` : ''}</small>
              </button>
            ) : cible ? <a className="vrm-phc-geste" href={lienVinted(cible)} target="_blank" rel="noopener noreferrer" data-pc-ouvrir-geste={cible.id}>{tr('photosComptes.ouvrir')}<small>{nomDe(cible)}</small></a> : null}
          </section>
        );
      })}
      {pasRelus.length ? <p className="vrm-phc-manque" data-pc-pas-relus={pasRelus.join(' ')}>{tr('photosComptes.pasRelus', { noms: et(pasRelus) })}</p> : null}
    </div>
  );
}

// L'ENCART AVANT DE PUBLIER : ambre si une photo choisie est déjà en ligne sur un AUTRE
// compte Vinted (miniature + compte) ; publier reste possible (son choix). Rien sinon,
// sauf « N photos pas encore vérifiées » (jamais « aucun doublon »).
export function EncartPhotosAutresComptes({ sources = [], photos = [], compteCible = null, compteSource = null, exclure = [], PhotoVinted = null, Photo = null }) {
  useLangue();
  const x = usePhotosComptes();
  // Une photo de VRM (fiche, Studio photo, nouvel achat : `data:`, `blob:`, la boîte) n'est pas
  // sur vinted.net : son empreinte se calcule ICI, dans la page (src/photosComptes.js).
  const locales = (photos || []).filter((p) => typeof p === 'string' && p && !/^https:\/\/images\d*\.vinted\.net\//.test(p));
  const [calc, setCalc] = React.useState({});
  const cleLocales = locales.join('\n');
  React.useEffect(() => {
    let vivant = true;
    (async () => { for (const src of locales) { if (src in calc) continue; const h = await empreinteImageLocale(src); if (!vivant) return; setCalc((c) => ({ ...c, [src]: h })); } })();
    return () => { vivant = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleLocales]);
  const photosVues = (photos || []).map((p) => (typeof p === 'string' && locales.includes(p) ? { h: calc[p] || null } : p));
  const r = React.useMemo(() => verifierAvantPublier(x, { sources, photos: photosVues, compteCible, compteSource, exclure }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [x, JSON.stringify(sources), JSON.stringify(photosVues), compteCible, compteSource, JSON.stringify(exclure)]);
  if (!sources.length && !photos.length) return null;
  if (r.annonces.length) {
    const comptes = [...new Set(r.annonces.map(nomDe))];
    return (
      <div className="vrm-phc-encart" role="status" data-pc-encart="risque" data-pc-encart-n={r.annonces.length}>
        <div className="vrm-phc-encart-photos">{r.annonces.slice(0, 3).map((a) => (
          <span key={`${a.cc}|${a.id}`} className="vrm-phc-encart-photo" data-pc-encart-annonce={`${a.cc}|${a.id}`}>{a.photo && Photo ? Photo(a.photo) : a.photo && PhotoVinted ? <PhotoVinted src={a.photo} alt="" loading="lazy"/> : <PhotoVide remplir/>}</span>
        ))}</div>
        <p><b>{tr('photosComptes.encart.dejaSur', { comptes: et(comptes) })}</b><span>{tr('photosComptes.encart.possible')}</span></p>
      </div>
    );
  }
  if (r.nPasVerifiees > 0) return <p className="vrm-phc-encart-manque" data-pc-encart="pas-verifie" data-pc-manque={r.nPasVerifiees}>{tr('photosComptes.pasVerifiees', { n: r.nPasVerifiees })}</p>;
  return null;
}
export default PhotosEntreComptesDetail;

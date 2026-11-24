// ── « LA MÊME PHOTO » : À RELIER (15 nov., lot meme-photo) ─────────────────────────
// Une annonce Leboncoin, eBay ou Vestiaire SANS lien, dont une photo est EXACTEMENT celle
// d'une annonce Vinted (empreinte perceptuelle, src/memePhoto.js) : « Même photo que N°124
// (Vinted) · Relier », les deux photos côte à côte. Deux paires possibles ⇒ on montre les
// deux, IL choisit. « Ce n'est pas la même » ⇒ la proposition ne revient plus (§5 : la photo
// propose, SON toucher relie). Aucun titre, aucune marque, aucune taille n'entre en jeu.
// Ce fichier ne lit ni n'écrit la base : `charger`, `onRelier`, `onRefuser` viennent de l'app.
// (15 nov., lot meme-photo-sure) DEUX mesures (src/photoFine.js) : « Même photo · sûr » quand les
// deux concordent nettement ; sinon « À vérifier » avec la raison — jamais compté sûr. Les deux
// gardent les mêmes gestes : c'est TOUJOURS son toucher qui relie.
import React from 'react';
import { PhotoVide } from './composants/PhotoVide.jsx';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { lireMemePhoto, abonnerMemePhoto, EVT_OUVRIR_MEME_PHOTO, ouvrirMemePhoto } from './memePhotoEtat.js';
import { duSite, SITES_MEME_PHOTO } from './memePhoto.js';
import './styles-meme-photo.css';

export function useMemePhoto(charger) {
  const [, maj] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => abonnerMemePhoto(maj), []);
  React.useEffect(() => { if (typeof charger === 'function') charger(); }, [charger]);
  return lireMemePhoto();
}
const nSite = (res, site) => { const d = site ? duSite(res, site) : res; return d ? d.propositions.length + d.ambigus.filter((x) => x.raison !== 'sans-numero').length : 0; };
// Les mots de la carte de Ma journée et de la ligne d'un site (une source, §7).
export function texteMemePhoto(res, site = null) {
  const n = res && res.lu ? nSite(res, site) : 0;
  const sites = [...new Set([...(res && res.propositions || []), ...(res && res.ambigus || [])].filter((x) => x.raison !== 'sans-numero').map((x) => x.annonce.plateforme))];
  const props = res && res.lu ? (site ? duSite(res, site).propositions : res.propositions || []) : [];
  const surs = props.filter((p) => p.etat === 'sur').length;
  const detail = tr('memePhoto.detail', { sites: (site ? [site] : sites).join(' · ') || '—' });
  return { n, surs, verifier: n - surs, titre: tr('memePhoto.aRelier', { n }), detail: n ? `${[surs ? tr('memePhoto.nSurs', { n: surs }) : '', n - surs ? tr('memePhoto.nAVerifier', { n: n - surs }) : ''].filter(Boolean).join(' · ')} · ${detail}` : detail };
}

// La ligne compacte d'un écran de site (Annonces → Leboncoin / eBay / Vestiaire) : rien s'il n'y a rien.
export function LigneMemePhoto({ site, charger }) {
  useLangue();
  const res = useMemePhoto(charger);
  const t = texteMemePhoto(res, site);
  if (!t.n) return null;
  return (
    <button type="button" className="sb-lien vrm-mph-ligne" data-meme-photo-ligne={site} data-n={String(t.n)} onClick={() => ouvrirMemePhoto(site)}>
      <span className="sb-point-ambre" aria-hidden="true"/>
      <span className="vrm-mph-ligne-texte">{t.titre}</span>
      <span className="vrm-mph-ligne-sous">{tr('memePhoto.memePhoto')}</span>
      <span aria-hidden="true" className="vrm-mph-chevron">›</span>
    </button>
  );
}

// L'autre sens, dans la fiche de la paire : « Même photo sur Leboncoin · à relier ».
export function LigneMemePhotoNumero({ numero, cle, charger }) {
  useLangue();
  const res = useMemePhoto(charger);
  const k = typeof cle === 'function' ? cle(numero) : String(numero || '');
  const l = k && res && res.lu && res.parNumero ? res.parNumero.get(k) || [] : [];
  // (24 nov., lot ext-anciens-lots, repris de #1219) Reconnue par la PHOTO D'ORIGINE (le même fichier, src/photoOrigine.js) :
  // « Aussi sur Leboncoin · reconnue par la photo d'origine » — rien à faire (ton neutre), la limite dans le titre.
  const rec = k && res && res.reconnuesParNumero ? res.reconnuesParNumero.get(k) || [] : [];
  const sitesRec = [...new Set(rec.map((p) => p.plateforme))];
  const aussi = rec.length ? (
    <p className="vrm-mph-ligne is-reconnue" data-meme-photo-aussi={k} data-par="code" data-n={String(rec.length)} data-sites={sitesRec.join(' ')} title={tr('memePhoto.limiteOrigine')}>
      <span className="vrm-mph-ligne-texte">{tr('memePhoto.aussiSurOrigine', { sites: sitesRec.join(' · ') })}</span>
    </p>) : null;
  if (!l.length) return aussi;
  const sites = [...new Set(l.map((p) => p.annonce.plateforme))];
  return (<>{aussi}
    <button type="button" className="sb-lien vrm-mph-ligne" data-meme-photo-numero={k} data-n={String(l.length)} onClick={() => ouvrirMemePhoto(sites.length === 1 ? sites[0] : null)}>
      <span className="sb-point-ambre" aria-hidden="true"/>
      <span className="vrm-mph-ligne-texte">{tr('memePhoto.surSites', { sites: sites.join(' · ') })}</span>
      <span aria-hidden="true" className="vrm-mph-chevron">›</span>
    </button></>
  );
}

function Cote({ src, Photo, legende, sous, lien, attrs }) {
  const img = src && Photo ? Photo(src) : <PhotoVide remplir/>;
  return (
    <figure className="vrm-mph-cote" {...attrs}>
      {lien ? <a className="vrm-mph-photo" href={lien} target="_blank" rel="noopener noreferrer" aria-label={`${tr('memePhoto.ouvrir')} · ${legende}`}>{img}</a> : <span className="vrm-mph-photo">{img}</span>}
      <figcaption><b>{legende}</b>{sous ? <small>{sous}</small> : null}</figcaption>
    </figure>
  );
}
const legendeAutre = (a) => `${a.plateforme}${a.compteNom && a.compteNom !== a.plateforme ? ' · ' + a.compteNom : ''}`;
const photoVintedDe = (paire) => { const v = (paire.vinted || [])[0] || {}; return v.photo || paire.photoVinted || ''; };
// L'état d'une proposition (ou d'une paire d'un cas ambigu) : « sûr » (diode) ou « à vérifier »
// (point ambre + la raison). Lu par le banc sur `data-mph-verdict` / `data-mph-raison`, jamais sur le texte.
const raisonVerifier = (x, plateforme) => (x.raison === 'pas-mesure' && plateforme === 'eBay' ? 'ebay' : x.raison === 'proche' ? 'proche' : x.raison === 'doute' ? 'doute' : 'pasMesure');
function Etat({ x, plateforme, court = false }) {
  if (x.etat === 'sur') return <p className="vrm-mph-sur" data-mph-verdict="sur" data-mph-fine={x.fine == null ? '' : String(x.fine)}><span className="vrm-mph-diode" aria-hidden="true"/>{tr('memePhoto.sur')}</p>;
  const r = raisonVerifier(x, plateforme);
  return <p className="vrm-mph-averifier" data-mph-verdict="verifier" data-mph-raison={r} data-mph-fine={x.fine == null ? '' : String(x.fine)}><span className="sb-point-ambre" aria-hidden="true"/><b>{tr('memePhoto.aVerifier')}</b>{court ? null : <span className="vrm-mph-raison">{tr('memePhoto.pourquoi.' + r)}</span>}</p>;
}

function Proposition({ p, Photo, onRelier, onRefuser }) {
  const [enCours, setEnCours] = React.useState(false);
  const v = (p.vinted || [])[0] || {};
  const relier = async () => { setEnCours(true); try { await onRelier({ annonce: p.annonce, numero: p.numero, vintedId: v.id }); } finally { setEnCours(false); } };
  return (
    <section className={`vrm-mph-prop ${p.etat === 'sur' ? 'is-sur' : 'is-verifier'}`} data-meme-photo-prop={p.id} data-numero={p.numero} data-distance={String(p.distance)} data-etat={p.etat === 'sur' ? 'sur' : 'verifier'}>
      <Etat x={p} plateforme={p.annonce.plateforme}/>
      <p className="vrm-mph-phrase">{tr('memePhoto.memeQue', { numero: p.numero, site: 'Vinted' })}</p>
      <div className="vrm-mph-cotes">
        <Cote src={p.annonce.photo} Photo={Photo} legende={legendeAutre(p.annonce)} sous={p.annonce.titre} lien={p.annonce.lien} attrs={{ 'data-mph-autre': p.annonce.id }}/>
        <span className="vrm-mph-egal" aria-hidden="true">=</span>
        <Cote src={photoVintedDe(p)} Photo={Photo} legende={`N°${p.numero} · Vinted`} sous={v.titre} lien={v.lien} attrs={{ 'data-mph-vinted': v.id || '' }}/>
      </div>
      <div className="vrm-mph-gestes">
        <button type="button" className="sb-touche vrm-mph-relier" data-meme-photo-relier={p.id} disabled={enCours} onClick={relier}>{tr('memePhoto.relier', { numero: p.numero })}</button>
        <button type="button" className="sb-lien" data-meme-photo-non={p.id} onClick={() => onRefuser({ annonce: p.annonce, numero: p.numero })}>{tr('memePhoto.pasLaMeme')}</button>
      </div>
    </section>
  );
}

function Ambigu({ x, Photo, onRelier, onRefuser }) {
  return (
    <section className="vrm-mph-prop is-ambigu" data-meme-photo-ambigu={x.id} data-raison={x.raison} data-n={String(x.paires.length)}>
      <p className="vrm-mph-phrase"><span className="sb-point-ambre" aria-hidden="true"/> {tr(x.raison === 'numero-double' ? 'memePhoto.numeroDouble' : 'memePhoto.deuxPaires', { n: x.paires.length, numero: (x.paires[0] || {}).numero || '' })}</p>
      <div className="vrm-mph-cotes is-choix">
        <Cote src={x.annonce.photo} Photo={Photo} legende={legendeAutre(x.annonce)} sous={x.annonce.titre} lien={x.annonce.lien} attrs={{ 'data-mph-autre': x.annonce.id }}/>
        {x.paires.map((p) => {
          const v = (p.vinted || [])[0] || {};
          return (
            <div key={p.numero || v.id} className="vrm-mph-choix" data-etat={p.etat === 'sur' ? 'sur' : 'verifier'}>
              <Etat x={p} plateforme={x.annonce.plateforme} court/>
              <Cote src={photoVintedDe(p)} Photo={Photo} legende={p.numero ? `N°${p.numero} · Vinted` : tr('memePhoto.sansNumero')} sous={v.titre} lien={v.lien} attrs={{ 'data-mph-vinted': v.id || '' }}/>
              {p.numero && x.raison !== 'numero-double' ? <button type="button" className="sb-touche" data-meme-photo-choisir={`${x.id}|${p.numero}`} onClick={() => onRelier({ annonce: x.annonce, numero: p.numero, vintedId: v.id })}>{tr('memePhoto.cestLui', { numero: p.numero })}</button> : null}
            </div>
          );
        })}
      </div>
      <div className="vrm-mph-gestes">
        <button type="button" className="sb-lien" data-meme-photo-aucune={x.id} onClick={() => { for (const p of x.paires) if (p.numero) onRefuser({ annonce: x.annonce, numero: p.numero }); }}>{tr('memePhoto.aucune')}</button>
      </div>
    </section>
  );
}

// Le contenu de la feuille. `site` null = tous les sites.
export function MemePhotoDetail({ res, site = null, Photo, onRelier, onRefuser, extension = 'ok', versionExt = '', extensionSure = 'ok', versionSure = '' }) {
  useLangue();
  if (!res) return <p className="vrm-mph-etat" data-mph-pas-pret="">{tr('memePhoto.lecture')}</p>;
  if (!res.lu) return <p className="vrm-mph-etat" data-mph-lu="0">{tr('memePhoto.lectureRatee')}</p>;
  const sites = site ? [site] : SITES_MEME_PHOTO;
  const props = res.propositions.filter((p) => sites.includes(p.annonce.plateforme));
  const ambs = res.ambigus.filter((p) => sites.includes(p.annonce.plateforme) && p.raison !== 'sans-numero');
  const illisibles = (res.illisibles || []).filter((s) => sites.includes(s));
  return (
    <div className="vrm-mph" data-meme-photo="" data-mph-lu="1" data-mph-props={props.length} data-mph-ambigus={ambs.length} data-mph-verifiees={res.nVerifiees} data-mph-pas-verifiees={res.nSansEmpreinte} data-mph-generiques={res.nGeneriques}
      data-mph-surs={props.filter((p) => p.etat === 'sur').length} data-mph-ecartees={res.nEcartees || 0} data-mph-fine-lue={res.fineLue ? '1' : '0'}>
      <p className="vrm-mph-etat" data-mph-etat="">
        {props.length + ambs.length ? null : <span>{tr('memePhoto.rien', { n: res.nVerifiees })}</span>}
        {res.nSansEmpreinte > 0 ? <span data-mph-manque={res.nSansEmpreinte}>{tr('memePhoto.pasVerifiees', { n: res.nSansEmpreinte })}</span> : null}
        {illisibles.length ? <span data-mph-illisibles={illisibles.join(' ')}>{tr('memePhoto.pasLu', { sites: illisibles.join(' · ') })}</span> : null}
      </p>
      {extension !== 'ok' ? <p className="vrm-mph-etat is-ext" data-mph-ext={extension}>{tr('memePhoto.extension', { v: versionExt })}</p> : null}
      {props.map((p) => <Proposition key={p.id} p={p} Photo={Photo} onRelier={onRelier} onRefuser={onRefuser}/>)}
      {ambs.map((x) => <Ambigu key={x.id} x={x} Photo={Photo} onRelier={onRelier} onRefuser={onRefuser}/>)}
      {extensionSure !== 'ok' ? <p className="vrm-mph-etat is-ext" data-mph-ext-sure={extensionSure}>{tr('memePhoto.extensionSure', { v: versionSure })}</p> : null}
      <p className="vrm-mph-aide">{tr('memePhoto.aideSure')}</p>
    </div>
  );
}

// L'hôte de la feuille, monté une fois dans la coque : s'ouvre sur `ouvrirMemePhoto(site)`.
export function MemePhotoHote({ charger, SheetShell, Photo, onRelier, onRefuser, extension, versionExt, extensionSure, versionSure }) {
  useLangue();
  const [ouvert, setOuvert] = React.useState(undefined);   // undefined = fermée ; null = tous ; 'Leboncoin'…
  const res = useMemePhoto(ouvert === undefined ? null : charger);
  React.useEffect(() => {
    const f = (e) => { setOuvert((e && e.detail && e.detail.site) || null); if (typeof charger === 'function') charger(true); };
    window.addEventListener(EVT_OUVRIR_MEME_PHOTO, f);
    return () => window.removeEventListener(EVT_OUVRIR_MEME_PHOTO, f);
  }, [charger]);
  if (ouvert === undefined || !SheetShell) return null;
  return (
    <SheetShell titre={tr('memePhoto.titre')} sousTitre={ouvert || tr('memePhoto.tousSites')} onClose={() => setOuvert(undefined)} maxWidth={640} data-feuille-meme-photo={ouvert || 'tous'}>
      <MemePhotoDetail res={res} site={ouvert} Photo={Photo} onRelier={onRelier} onRefuser={onRefuser} extension={extension} versionExt={versionExt} extensionSure={extensionSure} versionSure={versionSure}/>
    </SheetShell>
  );
}
export default MemePhotoDetail;

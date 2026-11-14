// ══════════════════════════════════════════════════════════════════════════════
//  L'ATELIER D'UNE PAIRE, DANS SA FICHE (14 nov., propositions 102, 105, 106, 107)
// ══════════════════════════════════════════════════════════════════════════════
// Sous la note privée de « Tout sur le N° » (la fiche unique, src/FichePaire.jsx) :
//   · SES PHOTOS (le studio, `studio_photos_{N°}`), en vedette, chacune avec l'avis
//     « floue ? / sombre ? » mesuré sur le téléphone (102) ; « Prendre des photos »
//     ouvre le studio sur CETTE paire ;
//   · DICTER UNE NOTE (105) : la reconnaissance du navigateur, le texte rejoint la note ;
//   · LE CERTIFICAT D'AUTHENTICITÉ (106) : rangé avec la paire, voir / envoyer / retirer ;
//   · MÊME PAIRE QU'UNE AUTRE FICHE ? (107) : l'alias s'il y a une fusion, sinon
//     « Fusionner avec une autre fiche » (aperçu, puis SON clic).
// Chargé À LA DEMANDE avec la fiche. Les règles sont dans des modules purs (audités) ;
// l'état et les écritures sont passés par la coque (App.jsx, `AtelierPaireCoque`).
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import AvisPhoto from './AvisPhoto.jsx';
import { tr, date as dateLoc } from './i18n/index.js';
import { verifierFichier, contenuValide, ecrireCertificat, retirerCertificat, lireCertificats, lireContenuCertificat, nomFichierCertificat, blobDeDataUrl, COTE_IMAGE, MAX_DATAURL } from './certificatPaire.js';
import { apercuFusion, opsFusion, CHAMPS_FUSION } from './fusionFiches.js';
import { photoDouteuse } from './qualitePhoto.js';
import './styles-atelier-photos.css';

const jour = (iso) => (iso ? dateLoc(iso, { day: 'numeric', month: 'short' }) : '');
const ko = (o) => (o >= 1024 * 1024 ? `${(o / 1048576).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);

// ── 102 · SES PHOTOS ─────────────────────────────────────────────────────────
function PhotosPaire({ num, cle, lire, ouvrirStudio, Icon }) {
  const [photos, setPhotos] = React.useState(undefined);
  React.useEffect(() => {
    let vivant = true; setPhotos(undefined);
    const relire = () => { Promise.resolve(lire ? lire() : null).then((r) => { if (vivant) setPhotos(r ? r.photos : null); }).catch(() => { if (vivant) setPhotos(null); }); };
    relire();
    // Une photo rangée pour CETTE paire (par la clé de son N°, jamais le texte du N°) : relue.
    const surRange = (e) => { if (e && e.detail && cle && e.detail.cle === cle) relire(); };
    window.addEventListener('vrm:studio-range', surRange);
    return () => { vivant = false; window.removeEventListener('vrm:studio-range', surRange); };
  }, [lire, cle]);
  const douteuses = Array.isArray(photos) ? photos.filter((p) => photoDouteuse(p.qualite)).length : 0;
  const sous = photos === undefined ? tr('atelier.photos.lecture') : photos === null ? '— ' + tr('atelier.photos.passu')
    : !photos.length ? tr('atelier.photos.aucune') : douteuses ? tr('atelier.photos.nDouteuses', { n: photos.length, d: douteuses }) : tr('atelier.photos.n', { n: photos.length });
  return (
    <section className="vrm-atl-sec" data-atelier-photos={Array.isArray(photos) ? photos.length : photos === null ? 'passu' : 'lecture'} data-atelier-douteuses={douteuses}>
      <h3 className="vrm-atl-titre">{tr('atelier.photos.titre')}<small>{sous}</small></h3>
      {Array.isArray(photos) && photos.length ? (
        <div className="vrm-atl-photos">
          {photos.slice(0, 12).map((p, i) => (
            <figure key={p.id || i} className="vrm-atl-photo" data-atelier-photo={p.id || i}>
              <img src={p.detoure || p.img} alt={tr('atelier.photos.alt', { i: i + 1, num })} loading="lazy" decoding="async" width="120" height="160"/>
              <AvisPhoto src={p.img} qualite={p.qualite && p.qualite.v ? p.qualite : null}/>
            </figure>
          ))}
        </div>
      ) : null}
      {ouvrirStudio ? (
        <div className="vrm-atl-carte" style={{ marginTop: Array.isArray(photos) && photos.length ? 10 : 0 }}>
          <button type="button" className="vrm-atl-rangee" data-atelier-studio={num} onClick={ouvrirStudio}>
            <span className="vrm-atl-pastille">{Icon ? <Icon name="camera" size={18}/> : null}</span>
            <span className="vrm-atl-rangee-txt"><b className="vrm-atl-lien">{tr(Array.isArray(photos) && photos.length ? 'atelier.photos.reprendre' : 'atelier.photos.prendre')}</b></span>
          </button>
        </div>
      ) : null}
    </section>
  );
}

// ── 105 · DICTER UNE NOTE ────────────────────────────────────────────────────
export function DicterNote({ num, dictee, Icon }) {
  const [direct, setDirect] = React.useState('');
  const [ecoute, setEcoute] = React.useState(false);
  const [mot, setMot] = React.useState('');
  const canal = 'note-' + num;
  const raison = dictee.raison();
  const lancer = () => {
    setMot('');
    if (raison) { setMot(tr('atelier.dictee.sans.' + raison)); return; }
    if (ecoute) { dictee.arreter(canal); return; }
    const ok = dictee.ecouter({ canal, lang: dictee.lang(),
      onDirect: (t) => setDirect(t),
      onFinal: (t) => { setDirect(''); const r = dictee.ajouter(t); if (r && r.coupe) setMot(tr('atelier.dictee.coupe')); },
      onErreur: (code) => setMot(tr('atelier.dictee.erreur.' + (['refus', 'aucun-son', 'reseau', 'materiel'].includes(code) ? code : 'autre'))),
      onFin: () => { setEcoute(false); setDirect(''); } });
    if (ok) setEcoute(true); else setMot(tr('atelier.dictee.sans.' + (dictee.raison() || 'navigateur')));
  };
  React.useEffect(() => () => { try { dictee.annuler(canal); } catch (_) {} }, [canal]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="vrm-atl-carte" data-atelier-dictee={raison || (ecoute ? 'ecoute' : 'pret')}>
      <button type="button" className={'vrm-atl-rangee' + (ecoute ? ' vrm-atl-ecoute' : '')} data-atelier-dicter={num} aria-disabled={raison ? 'true' : undefined} aria-pressed={ecoute} onClick={lancer}>
        <span className="vrm-atl-pastille">{Icon ? <Icon name="mic" size={18}/> : null}</span>
        <span className="vrm-atl-rangee-txt">
          <b className={raison ? undefined : 'vrm-atl-lien'}>{tr(ecoute ? 'atelier.dictee.terminer' : 'atelier.dictee.bouton')}</b>
          {ecoute ? <span className="vrm-atl-direct" data-atelier-direct="">{direct || tr('atelier.dictee.parle')}</span>
            : raison ? <small data-atelier-dictee-raison={raison}>{tr('atelier.dictee.sans.' + raison)}</small>
            : <small>{tr('atelier.dictee.sous')}</small>}
        </span>
      </button>
      {mot ? <p className="vrm-atl-raison" role="status" data-atelier-dictee-mot="">{mot}</p> : null}
    </div>
  );
}

// ── 106 · LE CERTIFICAT D'AUTHENTICITÉ ───────────────────────────────────────
const reduireImage = (file) => new Promise((ok) => {
  const url = URL.createObjectURL(file);
  const im = new Image();
  im.onload = () => {
    try {
      const k = Math.min(1, COTE_IMAGE / Math.max(im.naturalWidth, im.naturalHeight));
      const cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      let q = 0.86, d = cv.toDataURL('image/jpeg', q);
      while (d.length > MAX_DATAURL && q > 0.4) { q -= 0.12; d = cv.toDataURL('image/jpeg', q); }
      ok(d);
    } catch (_) { ok(null); } finally { URL.revokeObjectURL(url); }
  };
  im.onerror = () => { URL.revokeObjectURL(url); ok(null); };
  im.src = url;
});
const lirePdf = (file) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(typeof r.result === 'string' ? r.result.replace(/^data:[^;,]*;/, 'data:application/pdf;') : null); r.onerror = () => ok(null); r.readAsDataURL(file); });

function CertificatPaire({ cle, num, base, Icon, confirmer, dire }) {
  const [etat, setEtat] = React.useState(undefined);   // undefined lecture · null pas su · false aucun · objet
  const [occupe, setOccupe] = React.useState('');
  const [mot, setMot] = React.useState('');
  const entree = React.useRef(null);
  const relire = React.useCallback(() => {
    let vivant = true; setEtat(undefined);
    lireCertificats([cle], base).then((m) => { if (vivant) setEtat(m == null ? null : (m[cle] || false)); });
    return () => { vivant = false; };
  }, [cle, base]);
  React.useEffect(() => relire(), [relire]);
  const choisir = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    const v = verifierFichier({ type: f.type, taille: f.size, nom: f.name });
    if (!v.ok) { setMot(tr('atelier.certificat.refus.' + v.raison)); return; }
    setOccupe('ajout'); setMot('');
    const d = v.genre === 'pdf' ? await lirePdf(f) : await reduireImage(f);
    if (!d || !contenuValide(d, v.genre)) { setOccupe(''); setMot(tr('atelier.certificat.refus.illisible')); return; }
    const ok = await ecrireCertificat({ cle, dataUrl: d, genre: v.genre, nom: f.name, taille: f.size, numero: num }, base);
    setOccupe('');
    if (!ok) { setMot(tr('atelier.certificat.refus.ecriture')); return; }
    dire(tr('atelier.certificat.range', { num })); relire();
  };
  const contenu = async () => {
    const c = await lireContenuCertificat(cle, base);
    if (!c) { setMot(tr('atelier.certificat.refus.lecture')); return null; }
    return c;
  };
  const voir = async () => {
    setOccupe('voir'); const c = await contenu(); setOccupe(''); if (!c) return;
    const b = blobDeDataUrl(c.b64); if (!b) return;
    const u = URL.createObjectURL(b);
    const w = window.open(u, '_blank', 'noopener'); if (!w) { const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; a.click(); }
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  };
  const envoyer = async () => {
    setOccupe('envoi'); const c = await contenu(); setOccupe(''); if (!c) return;
    const b = blobDeDataUrl(c.b64); if (!b) return;
    const nom = nomFichierCertificat(cle, c.type);
    let fichier = null; try { fichier = new File([b], nom, { type: b.type }); } catch (_) {}
    if (fichier && navigator.canShare && navigator.canShare({ files: [fichier] }) && navigator.share) {
      try { await navigator.share({ files: [fichier], title: tr('atelier.certificat.titrePartage', { num }) }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
    setMot(tr('atelier.certificat.telecharge', { nom }));
  };
  const retirer = async () => {
    if (!(await confirmer({ title: tr('atelier.certificat.retirerTitre'), desc: tr('atelier.certificat.retirerDesc', { num }), ok: tr('atelier.certificat.retirer'), cancel: tr('atelier.annuler') }))) return;
    setOccupe('retrait'); const ok = await retirerCertificat(cle, base); setOccupe('');
    if (!ok) { setMot(tr('atelier.certificat.refus.ecriture')); return; }
    dire(tr('atelier.certificat.retire')); relire();
  };
  const sous = etat === undefined ? tr('atelier.photos.lecture') : etat === null ? '— ' + tr('atelier.certificat.passu') : etat === false ? tr('atelier.certificat.sous')
    : [etat.nom || (etat.type === 'pdf' ? 'PDF' : tr('atelier.certificat.photo')), etat.taille ? ko(etat.taille) : '', jour(etat.at)].filter(Boolean).join(' · ');
  return (
    <section className="vrm-atl-sec" data-atelier-certificat={etat === undefined ? 'lecture' : etat === null ? 'passu' : etat === false ? 'aucun' : etat.type}>
      <h3 className="vrm-atl-titre">{tr('atelier.certificat.titre')}</h3>
      <div className="vrm-atl-carte">
        <div className="vrm-atl-rangee">
          <span className="vrm-atl-pastille">{Icon ? <Icon name="shield" size={18}/> : null}</span>
          <span className="vrm-atl-rangee-txt"><b>{etat && etat.type ? tr('atelier.certificat.present') : tr('atelier.certificat.absent')}</b><small>{sous}</small></span>
        </div>
        {etat && etat.type ? (
          <div className="vrm-atl-rangee" style={{ justifyContent: 'flex-end' }}>
            <span className="vrm-atl-gestes">
              <button type="button" className="vrm-atl-geste" data-atelier-certificat-voir="" onClick={voir} aria-busy={occupe === 'voir'}>{tr('atelier.certificat.voir')}</button>
              <button type="button" className="vrm-atl-geste" data-atelier-certificat-envoyer="" onClick={envoyer} aria-busy={occupe === 'envoi'}>{tr('atelier.certificat.envoyer')}</button>
              <button type="button" className="vrm-atl-geste" data-atelier-certificat-retirer="" onClick={retirer} aria-busy={occupe === 'retrait'}>{tr('atelier.certificat.retirer')}</button>
            </span>
          </div>
        ) : etat === false ? (
          <button type="button" className="vrm-atl-rangee" data-atelier-certificat-ajouter={cle} onClick={() => entree.current && entree.current.click()} aria-busy={occupe === 'ajout'}>
            <span className="vrm-atl-pastille">{Icon ? <Icon name="doc" size={18}/> : null}</span>
            <span className="vrm-atl-rangee-txt"><b className="vrm-atl-lien">{tr(occupe === 'ajout' ? 'atelier.certificat.rangement' : 'atelier.certificat.ajouter')}</b></span>
          </button>
        ) : null}
        <input ref={entree} type="file" accept="application/pdf,image/*" hidden data-atelier-certificat-fichier="" onChange={choisir}/>
      </div>
      {mot ? <p className="vrm-atl-raison" role="status" data-atelier-certificat-mot="">{mot}</p> : null}
    </section>
  );
}

// ── 107 · MÊME PAIRE QU'UNE AUTRE FICHE ? ────────────────────────────────────
const valeurChamp = (c, v) => (v == null || v === '' ? '—' : c === 'buyPrice' || c === 'fees' ? `${String(v).replace('.', ',')} €` : String(v));
export function FeuilleFusion({ idFiche, fiches, registre, vendus, caseDe, cleNum, proposer, Photo, Feuille, Bouton, Segmente, onFusionner, onClose }) {
  const [q, setQ] = React.useState('');
  const [autre, setAutre] = React.useState(null);
  const [carton, setCarton] = React.useState(null);
  const moi = (fiches || {})[idFiche] || {};
  const candidats = React.useMemo(() => {
    const t = cleNum(q);
    const tous = Object.entries(fiches || {}).filter(([id, f]) => id !== String(idFiche) && f && f.numero != null && String(f.numero).trim() !== '');
    const l = t ? tous.filter(([, f]) => cleNum(f.numero) === t || cleNum(f.numero).startsWith(t)) : proposer(tous, moi);
    return l.slice(0, 8);
  }, [q, fiches, idFiche]); // eslint-disable-line react-hooks/exhaustive-deps
  const ap = autre ? apercuFusion({ a: idFiche, b: autre, fiches, registre, vendus, caseDe, cleNum }) : null;
  const res = ap && ap.ok ? opsFusion(ap, { carton, fiches, registre, cleNum }) : null;
  const libelle = (c) => tr('atelier.fusion.champ.' + c);
  const cote = (x) => (
    <div className="vrm-atl-cote" data-fusion-cote={x.id}>
      <figure className="vrm-atl-photo">{x.photo && Photo ? Photo(typeof x.photo === 'string' ? x.photo : (x.photo.url || '')) : null}</figure>
      <b>{x.num ? `N°${x.num}` : tr('atelier.fusion.sansNum')}</b><span>{x.titre || '—'}</span>
    </div>
  );
  return (
    <Feuille onClose={onClose} titre={tr('atelier.fusion.titre')} data-fusion-feuille={autre ? 'apercu' : 'choix'}>
      <div className="vrm-atl-feuille">
        {!autre ? (<>
          <input className="vrm-atl-champ" inputMode="text" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('atelier.fusion.chercher')} aria-label={tr('atelier.fusion.chercher')} data-fusion-chercher=""/>
          <p className="vrm-atl-raison" style={{ margin: 0 }}>{tr(q ? 'atelier.fusion.resultats' : 'atelier.fusion.propositions')}</p>
          <ul className="vrm-atl-liste" data-fusion-candidats={candidats.length}>
            {candidats.map(([id, f]) => (
              <li key={id} className="vrm-atl-ligne">
                <button type="button" className="vrm-atl-ligne-btn" data-fusion-candidat={id} onClick={() => { setAutre(id); setCarton(null); }}>
                  <span className="vrm-atl-vignette">{f.photo && Photo ? Photo(typeof f.photo === 'string' ? f.photo : (f.photo.url || '')) : null}</span>
                  <span className="vrm-atl-ligne-txt"><b>N°{f.numero}</b><span>{f.title || '—'}</span></span>
                </button>
              </li>
            ))}
          </ul>
          {!candidats.length ? <p className="vrm-atl-raison">{tr('atelier.fusion.aucun')}</p> : null}
        </>) : (<>
          {ap && !ap.ok ? <p className="vrm-atl-refus" role="alert" data-fusion-refus={ap.raison}>{tr('atelier.fusion.refus.' + ap.raison, { cases: ap.cases ? ap.cases.join(' / ') : '' })}</p> : null}
          {ap && ap.ok ? (<>
            <div className="vrm-atl-deux">{cote(ap.a)}{cote(ap.b)}</div>
            <h3 className="vrm-atl-titre" style={{ margin: '4px 4px 0' }}>{tr('atelier.fusion.garde')}</h3>
            <ul className="vrm-atl-garde" data-fusion-champs={ap.champs.length}>
              <li data-fusion-nums={ap.nums.join(',')}>{ap.memeNum ? tr('atelier.fusion.numMeme', { num: ap.nums[0] }) : ap.nums.length === 2 ? tr('atelier.fusion.numDeux', { a: ap.nums[0], b: ap.nums[1] }) : tr('atelier.fusion.numUn')}<small>{tr('atelier.fusion.jamaisChange')}</small></li>
              {ap.champs.map((c) => (
                <li key={c.champ} data-fusion-champ={c.champ} data-fusion-action={c.action}>
                  {libelle(c.champ)} : {c.action === 'copier' ? valeurChamp(c.champ, c.valeur) : c.action === 'egal' ? valeurChamp(c.champ, c.va) : `${valeurChamp(c.champ, c.va)} / ${valeurChamp(c.champ, c.vb)}`}
                  <small>{tr('atelier.fusion.action.' + c.action, { num: c.vers === ap.a.id ? (ap.a.num || '—') : (ap.b.num || '—') })}</small>
                </li>
              ))}
              {!ap.champs.length ? <li><small>{tr('atelier.fusion.rienACompleter')}</small></li> : null}
            </ul>
            {ap.choixCarton ? (
              <div data-fusion-carton-choix="">
                <h3 className="vrm-atl-titre" style={{ margin: '4px 4px 8px' }}>{tr('atelier.fusion.carton')}</h3>
                <Segmente label={tr('atelier.fusion.carton')} value={carton} onChange={setCarton} options={ap.nums.map((n) => ({ v: n, l: `N°${n}`, data: { 'data-fusion-carton': n } }))}/>
                <p className="vrm-atl-raison">{carton ? tr('atelier.fusion.alias', { carton, autre: ap.nums.find((n) => n !== carton) }) : tr('atelier.fusion.choisisCarton')}</p>
              </div>
            ) : null}
          </>) : null}
          <div className="vrm-atl-pied">
            {ap && ap.ok ? <Bouton variante="primaire" plein data-fusion-valider="" disabled={!res || !res.ok} onClick={() => { if (res && res.ok) onFusionner(res, ap); }}>{tr('atelier.fusion.valider')}</Bouton> : null}
            <Bouton variante="discret" plein data-fusion-autre="" onClick={() => { setAutre(null); setCarton(null); }}>{tr('atelier.fusion.autreFiche')}</Bouton>
          </div>
          <p className="vrm-atl-raison" style={{ margin: 0 }}>{tr('atelier.fusion.reversible')}</p>
        </>)}
      </div>
    </Feuille>
  );
}

function FusionPaire({ num, fusion, Icon }) {
  if (!fusion) return null;
  const { alias, defaisable, fin, onDefaire, ouvrir, raisonSans } = fusion;
  return (
    <section className="vrm-atl-sec" data-atelier-fusion={alias ? 'fusionnee' : raisonSans ? 'sans' : 'libre'}>
      <h3 className="vrm-atl-titre">{tr('atelier.fusion.section')}</h3>
      <div className="vrm-atl-carte">
        {alias ? (<>
          <div className="vrm-atl-rangee vrm-atl-alias" data-atelier-alias={alias.autres.join(',')} data-atelier-carton={alias.carton || ''}>
            <b>{tr('atelier.fusion.memeQue', { autres: alias.autres.map((n) => 'N°' + n).join(', ') })}</b>
            <small className="vrm-atl-raison" style={{ margin: 0 }}>{alias.carton ? tr(alias.estCarton ? 'atelier.fusion.cartonIci' : 'atelier.fusion.cartonAilleurs', { carton: alias.carton, num }) : tr('atelier.fusion.cartonInconnu')} · {tr('atelier.fusion.le', { jour: jour(alias.fusion.at) })}</small>
          </div>
          {defaisable ? <button type="button" className="vrm-atl-rangee" data-atelier-defaire={alias.fusion.id} onClick={onDefaire}>
            <span className="vrm-atl-pastille">{Icon ? <Icon name="undo" size={18}/> : null}</span>
            <span className="vrm-atl-rangee-txt"><b className="vrm-atl-lien">{tr('atelier.fusion.defaire')}</b><small>{tr('atelier.fusion.jusquau', { jour: jour(fin) })}</small></span>
          </button> : null}
        </>) : raisonSans ? (
          <div className="vrm-atl-rangee"><span className="vrm-atl-rangee-txt"><b>{tr('atelier.fusion.ouvrir')}</b><small>{tr('atelier.fusion.sans.' + raisonSans)}</small></span></div>
        ) : (
          <button type="button" className="vrm-atl-rangee" data-atelier-fusionner={num} onClick={ouvrir}>
            <span className="vrm-atl-pastille">{Icon ? <Icon name="link" size={18}/> : null}</span>
            <span className="vrm-atl-rangee-txt"><b className="vrm-atl-lien">{tr('atelier.fusion.ouvrir')}</b><small>{tr('atelier.fusion.ouvrirSous')}</small></span>
          </button>
        )}
      </div>
    </section>
  );
}

// La dictée (105) vit SOUS la note, rendue par la coque de la note (`NotePaireCoque`, App.jsx : la note ne se lit
// qu'à un endroit) ; l'atelier rend le reste.
export default function AtelierPaire({ num, Icon, studio, certificat, fusion }) {
  return (
    <div className="vrm-atl" data-atelier-paire={num}>
      {studio ? <PhotosPaire num={num} cle={studio.cle} lire={studio.lire} ouvrirStudio={studio.ouvrir} Icon={Icon}/> : null}
      {certificat && certificat.cle ? <CertificatPaire cle={certificat.cle} num={num} base={certificat.base} Icon={Icon} confirmer={certificat.confirmer} dire={certificat.dire}/> : null}
      <FusionPaire num={num} fusion={fusion} Icon={Icon}/>
    </div>
  );
}
export { CHAMPS_FUSION };

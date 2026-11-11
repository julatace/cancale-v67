// ── VISUELS POUR LES RÉSEAUX (11 nov., lot visuels-reseaux) ─────────────────
// La feuille ouverte depuis une annonce (Annonces → « … » → Visuel réseaux) ou
// plusieurs cochées (Annonces → Sélectionner → Actions → Nouveautés de la semaine).
// Elle lit les photos par le chemin des photos de l'app (`lirePhoto`, injecté :
// la route photo de VRM, sinon l'extension — jamais un <img> d'un autre site, qui
// souillerait le canvas), dessine dans le navigateur (src/visuelsReseaux.js) et
// montre EXACTEMENT les images qui partiront. Rien n'est publié : « Partager »
// ouvre le menu de partage du téléphone, « Télécharger » enregistre les PNG.
// Une photo pas lisible ⇒ l'article sort du visuel et c'est DIT ; aucune photo
// lisible ⇒ aucune image (jamais une image vide).
import React from 'react';
import { tr, monnaie } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import { FORMATS, MODELES, ACCENTS, LOT_MAX, PHOTOS_MAX_SEULE, BOUTIQUE_MAX, reglagesValides, pagesLot, planVisuel, dessinerVisuel, mesureCanvas, nomFichier } from '../visuelsReseaux.js';
import './visuels-reseaux.css';

const chargerImage = (src) => new Promise((ok) => {
  const im = new Image();
  im.decoding = 'async';
  im.onload = () => ok(im.naturalWidth > 0 ? im : null);
  im.onerror = () => ok(null);
  im.src = src;
});
const prixTexte = (n) => monnaie(n, 'EUR', Number.isInteger(n) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : undefined);

// Le partage du téléphone avec les fichiers ; rend 'partage' | 'annule' | 'refuse' | 'impossible'.
export async function partagerFichiers(fichiers, titre, nav = (typeof navigator !== 'undefined' ? navigator : null)) {
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return 'impossible';
  try { if (!nav.canShare({ files: fichiers })) return 'impossible'; } catch (_) { return 'impossible'; }
  try { await nav.share({ files: fichiers, title: titre }); return 'partage'; }
  catch (e) { return e && e.name === 'AbortError' ? 'annule' : 'refuse'; }
}

export default function VisuelsReseaux({ articles, lot = false, lirePhoto, reglages, onReglages, onFermer, Feuille, Bouton, Segmente, toast = () => {}, nav }) {
  useLangue();
  const navi = nav || (typeof navigator !== 'undefined' ? navigator : null);
  const r0 = reglagesValides(reglages);
  const [format, setFormat] = React.useState(r0.format);
  const [modele, setModele] = React.useState(r0.modele);
  const [accent, setAccent] = React.useState(r0.accent);
  const [boutique, setBoutique] = React.useState(r0.boutique);
  const liste = React.useMemo(() => (Array.isArray(articles) ? articles.filter(Boolean) : []).slice(0, lot ? LOT_MAX : 1), [articles, lot]);
  const trop = lot && Array.isArray(articles) && articles.length > LOT_MAX;
  const seule = liste.length === 1 && !lot;
  // Les photos : { [url]: image | null (pas lisible) } ; absente = en cours.
  const [photos, setPhotos] = React.useState({});
  const [essai, setEssai] = React.useState(0);
  const voulues = React.useMemo(() => {
    const u = [];
    liste.forEach((a) => (a.photos || []).slice(0, seule ? PHOTOS_MAX_SEULE : 1).forEach((p) => { if (!u.includes(p)) u.push(p); }));
    return u;
  }, [liste, seule]);
  React.useEffect(() => {
    let vivant = true; const aLiberer = [];
    setPhotos({});
    (async () => {
      const file = voulues.slice();
      const travail = async () => {
        while (file.length && vivant) {
          const u = file.shift();
          let src = null; try { src = await lirePhoto(u); } catch (_) { src = null; }
          if (src && /^blob:/.test(src) && src !== u) aLiberer.push(src);
          const im = src ? await chargerImage(src) : null;
          if (vivant) setPhotos((x) => ({ ...x, [u]: im }));
        }
      };
      await Promise.all([travail(), travail(), travail()]);
    })();
    return () => { vivant = false; aLiberer.forEach((b) => { try { URL.revokeObjectURL(b); } catch (_) {} }); };
  }, [voulues, essai, lirePhoto]);
  const lues = voulues.filter((u) => photos[u] !== undefined).length;
  const enCours = lues < voulues.length;

  // Les articles du dessin : seulement ceux dont la 1re photo est LUE.
  const prets = React.useMemo(() => liste.map((a) => {
    const ph = (a.photos || []).slice(0, seule ? PHOTOS_MAX_SEULE : 1);
    return { ...a, lues: ph[0] && photos[ph[0]] ? ph.map((p, i) => (photos[p] ? i : -1)).filter((i) => i >= 0) : [] };
  }), [liste, photos, seule]);
  const dedans = prets.filter((a) => a.lues.length);
  const dehors = enCours ? [] : prets.filter((a) => !a.lues.length);
  const extrasKo = !enCours && seule && dedans.length ? Math.max(0, Math.min((liste[0].photos || []).length, PHOTOS_MAX_SEULE) - dedans[0].lues.length) : 0;

  // Le dessin : une image par page.
  const [images, setImages] = React.useState(null);   // null = rien · [{ url, blob, nom }]
  const [refus, setRefus] = React.useState(false);
  React.useEffect(() => {
    if (enCours || !dedans.length) { setImages(null); return undefined; }
    let vivant = true; const urls = [];
    (async () => {
      const pages = seule ? [dedans] : pagesLot(dedans, format);
      const res = [];
      for (let i = 0; i < pages.length; i++) {
        const { w, h } = FORMATS[format];
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        const page = pages[i];
        const plan = planVisuel({ format, modele, accent, boutique, articles: page, lot: lot || page.length > 1, page: i + 1, pages: pages.length,
          textes: { taille: (t) => tr('visuels.taille', { t }), lot: tr('visuels.titreLot') }, prixTexte }, mesureCanvas(ctx));
        const complet = dessinerVisuel(ctx, plan, (ai, pi) => photos[(page[ai].photos || [])[pi]] || null);
        if (!complet) { if (vivant) { setRefus(true); setImages(null); } return; }
        let blob = null;
        try { blob = await new Promise((ok, ko) => { try { cv.toBlob((b) => ok(b), 'image/png'); } catch (e) { ko(e); } }); } catch (_) { blob = null; }
        if (!blob) { if (vivant) { setRefus(true); setImages(null); } return; }
        const url = URL.createObjectURL(blob); urls.push(url);
        res.push({ url, blob, nom: nomFichier(format, i, pages.length) });
      }
      if (vivant) { setRefus(false); setImages(res); } else urls.forEach((u) => URL.revokeObjectURL(u));
    })();
    return () => { vivant = false; urls.forEach((u) => { try { URL.revokeObjectURL(u); } catch (_) {} }); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enCours, photos, format, modele, accent, boutique, liste, seule, lot]);

  const ranger = (patch) => { try { onReglages && onReglages({ ...reglagesValides({ format, modele, accent, boutique }), ...patch }); } catch (_) {} };
  const fichiers = () => (images || []).map((im) => new File([im.blob], im.nom, { type: 'image/png' }));
  const peutPartager = (() => { try { return !!(navi && typeof navi.canShare === 'function' && images && images.length && navi.canShare({ files: fichiers() })); } catch (_) { return false; } })();
  const telecharger = () => {
    (images || []).forEach((im, i) => setTimeout(() => {
      const a = document.createElement('a'); a.href = im.url; a.download = im.nom; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
    }, i * 250));
    toast(tr('visuels.telecharge', { n: (images || []).length }), 'ok');
  };
  const partager = async () => {
    const r = await partagerFichiers(fichiers(), lot ? tr('visuels.titreLot') : (liste[0] && liste[0].titre) || '', navi);
    if (r === 'refuse' || r === 'impossible') toast(tr('visuels.partageRefuse'), 'info');
  };

  const titre = lot ? tr('visuels.titreLot') : tr('visuels.titre');
  return (
    <Feuille onClose={onFermer} titre={titre} maxWidth={520} data-visuels="" data-visuels-lot={lot ? '1' : '0'}>
      <div className="vrm-vis">
        <div className="vrm-vis-reglages">
          <Segmente label={tr('visuels.format')} plein value={format} onChange={(v) => { setFormat(v); ranger({ format: v }); }}
            options={Object.keys(FORMATS).map((k) => ({ v: k, l: tr('visuels.format.' + k), data: { 'data-visuels-format': k } }))}/>
          <Segmente label={tr('visuels.modele')} plein value={modele} onChange={(v) => { setModele(v); ranger({ modele: v }); }}
            options={MODELES.map((k) => ({ v: k, l: tr('visuels.modele.' + k), data: { 'data-visuels-modele': k } }))}/>
          <div className="vrm-vis-couleurs" role="radiogroup" aria-label={tr('visuels.couleur')}>
            {ACCENTS.map((a) => (
              <button key={a.k} type="button" role="radio" aria-checked={accent === a.k} aria-label={tr('visuels.couleur.' + a.k)} title={tr('visuels.couleur.' + a.k)}
                className="vrm-vis-pastille" data-visuels-accent={a.k} onClick={() => { setAccent(a.k); ranger({ accent: a.k }); }}>
                <span style={{ background: a.c }}/>
              </button>
            ))}
          </div>
          <label className="vrm-vis-boutique">
            <span>{tr('visuels.boutique')}</span>
            <input type="text" value={boutique} maxLength={BOUTIQUE_MAX} placeholder={tr('visuels.boutiqueAide')} data-visuels-boutique=""
              onChange={(e) => setBoutique(e.target.value.slice(0, BOUTIQUE_MAX))} onBlur={() => ranger({ boutique })}/>
          </label>
        </div>

        <div className="vrm-vis-apercu" data-visuels-apercu={enCours ? 'lecture' : images ? String(images.length) : refus ? 'refus' : 'aucun'} data-visuels-format-vu={format}>
          {enCours ? <div className="vrm-vis-attente" role="status" data-visuels-lecture="">{tr('visuels.lecture', { n: lues, total: voulues.length })}</div>
            : images ? images.map((im, i) => <img key={im.url} src={im.url} alt={tr('visuels.image', { i: i + 1, n: images.length })} className={`vrm-vis-img vrm-vis-img-${format}`} data-visuels-image={i + 1}/>)
            : <div className="vrm-vis-vide" role="status" data-visuels-vide={refus ? 'refus' : 'aucune'}>
                <b>{refus ? tr('visuels.refus') : tr('visuels.aucune')}</b>
                <span>{tr('visuels.aucuneGeste')}</span>
                <Bouton variante="secondaire" data-visuels-reessayer="" onClick={() => { setRefus(false); setEssai((n) => n + 1); }}>{tr('commun.reessayer')}</Bouton>
              </div>}
        </div>

        {(dehors.length > 0 || extrasKo > 0 || trop || dedans.some((a) => a.prix == null)) && (
          <ul className="vrm-vis-manques" data-visuels-manques="">
            {dehors.map((a) => <li key={a.cle} data-visuels-pas-lisible={a.cle}>{tr('visuels.pasLisible', { titre: a.titre || '—' })}</li>)}
            {extrasKo > 0 && <li data-visuels-extras-ko={extrasKo}>{tr('visuels.autresPasLisibles', { n: extrasKo })}</li>}
            {!enCours && dedans.filter((a) => a.prix == null).map((a) => <li key={'p' + a.cle} data-visuels-sans-prix={a.cle}>{tr('visuels.sansPrix', { titre: a.titre || '—' })}</li>)}
            {trop && <li data-visuels-trop="">{tr('visuels.trop', { n: LOT_MAX })}</li>}
          </ul>
        )}

        <p className="vrm-vis-note">{tr('visuels.rien')}</p>
        <div className="vrm-fs-pied vrm-vis-pied">
          <Bouton variante="secondaire" disabled={!images} data-visuels-telecharger="" onClick={telecharger}>{tr('visuels.telecharger')}</Bouton>
          {peutPartager && <Bouton variante="primaire" data-visuels-partager="" onClick={partager}>{tr('visuels.partager')}</Bouton>}
        </div>
      </div>
    </Feuille>
  );
}

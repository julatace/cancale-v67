// ════════════════════════════════════════════════════════════════════════════
//  PARAMÈTRES → IMPRIMANTE ET BORDEREAUX → « TAMPONS DES BORDEREAUX » (16 nov., refait le 17 nov.)
//  Julien (16 nov.) : « je veux vraiment un visuel avec TOUS les bordereaux, que je peux modifier si jamais le
//  tamponnage n'est pas au bon endroit ». Puis (17 nov.) : « ce ne sont pas les vrais bordereaux des transporteurs,
//  améliore le visuel de cette page et ne donne pas la possibilité d'enlever créé par vrm ».
//
//  · LA GALERIE : une tuile par type (logo, nom, aperçu, UNE ligne d'état), 2 colonnes au téléphone, 4 à
//    l'ordinateur. L'aperçu est SON DERNIER VRAI BORDEREAU de ce transporteur (ses bordereaux reçus par e-mail :
//    liste en SCALAIRES `meta->>`, le PDF lu à la demande par `lirePdfLigne`, le type vérifié par `typeBordereau`
//    — la même règle que l'impression), dessiné chez lui seul, dans son navigateur. Sans bordereau de ce
//    transporteur : la forme d'EXEMPLE (src/impression/bordereauExemple.js, données inventées), marquée « Exemple ».
//    Dans les deux cas la page passe par LE code d'impression (`poserBordereau`) avec LE réglage `vrm_tampons` :
//    le N° et « Créé par vrm.center » sont dessinés là où ils s'imprimeront.
//  · « CRÉÉ PAR VRM.CENTER » NE S'ENLÈVE PLUS : aucune case, aucune taille, aucune place ; un réglage rangé « sans
//    mention » est ignoré (src/impression/tampons.js) ; dans l'aperçu il est montré, verrouillé (`data-verrou`).
//  · LA FEUILLE (toucher une tuile) : le grand aperçu ; le N° se glisse (doigt, souris, clavier), s'agrandit,
//    s'aimante ; lâché sur un code ou l'adresse il est REFUSÉ ; enregistré tout de suite ; « Annuler »,
//    « Revenir à l'origine ».
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import { C, Bouton, Segmente, FermeAuRetour, poserBordereau, dessinerPdf, reglageTamponsChoisi, ecrireReglageTampons, imprimanteChoisie, load, onCloudReady, Z_CONFIRMATION, lireTout, lirePdfLigne, typeBordereau } from '../App.jsx';
import { FAMILLES, PLACES_N, TAILLES_TAMPON, resoudreTampon, avecChoix, sansException, avecPlace, reglageOrigine, estOrigine, placesDeForme, familleDe } from '../impression/tampons.js';
import { CLE_IMPRESSION, reglageImpression, FORMATS_THERMIQUES } from '../impression/thermique.js';
import { fabriquerBordereau } from '../impression/bordereauExemple.js';
import { cleTransporteur } from '../transporteursVisuels.js';
import { LogoTransporteur, LogoInconnu } from '../PastilleTransporteur.jsx';
import SceneTampons from '../impression/SceneTampons.jsx';
import '../styles-tampons.css';

const TITRE_EXEMPLE = 'Veste en jean bleue';
const NUM_EXEMPLE = '124';
const PAPIERS = FORMATS_THERMIQUES.filter((f) => f.id !== 'autre');
const supportThermique = (s) => s !== 'a4';

// ── SES VRAIS BORDEREAUX : le plus récent de chaque transporteur ──────────────
// La liste en SCALAIRES seulement (jamais `select=data` : chaque ligne porte son PDF) ; le PDF d'UNE ligne est lu
// quand sa tuile arrive à l'écran (`lirePdfLigne`), gardé en mémoire le temps de la page. Une lecture ratée ⇒
// « pas su » : la tuile montre l'exemple, sans rien conclure.
const FAMILLE_DU_TRANSPORTEUR = Object.freeze({ mondialrelay: 'mondialrelay', relaiscolis: 'relaiscolis', chronopost: 'chronopost', shop2shop: 'chronopost', colissimo: 'colissimo', vinted: 'vintedgo', ups: 'ups', dpd: 'dpd' });
const LOGO_DE_FAMILLE = Object.freeze({ mondialrelay: 'mondialrelay', relaiscolis: 'relaiscolis', chronopost: 'chronopost', colissimo: 'colissimo', vintedgo: 'vinted', ups: 'ups', dpd: 'dpd', retour: 'mondialrelay' });
let _liste = null;
export function vraisBordereaux() {
  if (!_liste) {
    _liste = lireTout('id=like.email_bord_*&select=id,t:meta->>transporteurPdf,tr:meta->>transporteur,at:meta->>receivedAt,f:meta->>filename,purge:meta->>pdfPurged', { strict: true })
      .then((rows) => {
        if (!Array.isArray(rows)) return null;
        const par = {};
        for (const r of rows.filter((x) => x && x.f && x.f !== 'None' && String(x.purge) !== 'true').sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))) {
          const fam = FAMILLE_DU_TRANSPORTEUR[cleTransporteur(r.t) || cleTransporteur(r.tr) || ''];
          if (fam && (par[fam] = par[fam] || []).length < 3) par[fam].push(r.id);
        }
        return par;
      }).catch(() => null);
    _liste.then((v) => { if (v == null) _liste = null; });
  }
  return _liste;
}
const _octets = new Map();
const octetsDe = (id) => { if (!_octets.has(id)) { const p = lirePdfLigne(id).then((r) => (r && r.octets ? r.octets : null)).catch(() => null); _octets.set(id, p); p.then((o) => { if (!o) _octets.delete(id); }); } return _octets.get(id); };

// Le bordereau d'un type imprimé par LE code d'impression avec le réglage `tampons` : SON dernier vrai bordereau de ce
// transporteur (vérifié par `typeBordereau`, la règle de l'impression), sinon l'exemple. Rend { octets, pose, source }.
let _file = Promise.resolve();
const enFile = (f) => { const p = _file.then(f, f); _file = p.catch(() => {}); return p; };
async function sourceDe(PL, fam) {
  const par = await vraisBordereaux();
  for (const id of (par && par[fam.id]) || []) {
    const o = await octetsDe(id); if (!o) continue;
    try {
      const doc = await PL.PDFDocument.load(o, { ignoreEncryption: true });
      let ty = 'autre'; try { ty = typeBordereau(PL, doc).type; } catch (_) { ty = 'autre'; }
      if (familleDe({ type: ty }) === fam.id) return { doc, source: 'reel', id };
    } catch (_) { /* illisible : le suivant */ }
  }
  const qr = await import('qrcode-generator');
  return { doc: await PL.PDFDocument.load(await fabriquerBordereau(PL, qr.default || qr, fam.mise, { transporteur: fam.transporteur, service: fam.service, rotation: fam.rotation || 0 })), source: 'exemple' };
}
async function rendreBordereau(fam, support, tampons) {
  const PL = await import('pdf-lib');
  const { doc: src, source } = await sourceDe(PL, fam);
  const out = await PL.PDFDocument.create();
  const th = supportThermique(support);
  let brut = null; try { brut = load(CLE_IMPRESSION, null); } catch (_) { brut = null; }
  const reg = reglageImpression({ ...(brut || {}), ...(th && support !== 'planche4' ? { format: support } : {}) });
  const r = await poserBordereau(PL, out, src, {
    numero: NUM_EXEMPLE, title: fam.retour ? `RETOUR · ${TITRE_EXEMPLE}` : TITRE_EXEMPLE, pos: null, thermique: th,
    impression: { reg, tampons, famille: fam.id, site: fam.site || '', retour: !!fam.retour, taille: '42', photo: null, emplacement: '' },
  });
  return { octets: await out.save(), pose: (r.poses || [])[0] || null, isole: !!r.isole, source };
}
const pc = (b, p, m) => ({ left: `${((b.x - m) / p.W) * 100}%`, top: `${((b.y - m) / p.H) * 100}%`, width: `${((b.w + 2 * m) / p.W) * 100}%`, height: `${((b.h + 2 * m) / p.H) * 100}%` });
const boiteTexte = (b) => (b ? `${b.x.toFixed(1)},${b.y.toFixed(1)},${b.w.toFixed(1)},${b.h.toFixed(1)}` : '');
const Logo = ({ fam }) => (LOGO_DE_FAMILLE[fam.id] ? <LogoTransporteur cle={LOGO_DE_FAMILLE[fam.id]} taille={22} repli={<LogoInconnu taille={22}/>}/> : <LogoInconnu taille={22}/>);

// Une tuile : logo et nom, l'aperçu (le bordereau rendu, les tampons cerclés), une ligne d'état.
function Vignette({ fam, support, tampons, ouvrir, nomSupport }) {
  useLangue();
  const cv = React.useRef(null), boite = React.useRef(null), page = React.useRef(null);
  const [st, setSt] = React.useState({ etat: 'charge' });
  // Dessinée seulement quand elle est À L'ÉCRAN (ou presque) : ouvrir Paramètres ne lance pas onze rendus de PDF.
  const [vue, setVue] = React.useState(false);
  React.useEffect(() => {
    const el = boite.current; if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setVue(true); return undefined; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setVue(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(el); return () => io.disconnect();
  }, []);
  const cle = JSON.stringify([fam.id, support, tampons]);
  React.useEffect(() => {
    if (!vue) return undefined;
    let vivant = true; setSt((x) => ({ etat: 'charge', source: x.source }));
    enFile(async () => {
      await new Promise((r) => setTimeout(r, 30));   // l'écran respire entre deux rendus
      if (!vivant) return;
      const ex = await rendreBordereau(fam, support, tampons);
      if (!vivant || !ex.pose) { if (vivant) setSt({ etat: 'ko' }); return; }
      const larg = Math.max(140, Math.min(360, Math.round((page.current && page.current.clientWidth) || 220)));
      await dessinerPdf(cv.current, ex.octets, { page: ex.pose.page + 1, largeur: larg });
      if (vivant) setSt({ etat: 'ok', ...ex });
    }).catch(() => { if (vivant) setSt({ etat: 'ko' }); });
    return () => { vivant = false; };
  }, [cle, vue]);   // eslint-disable-line react-hooks/exhaustive-deps
  const p = st.pose;
  const main = !!(p && placesDeForme(tampons, p.cle).n);
  const nom = tr(`tampons.famille.${fam.id}`);
  return (
    <button type="button" ref={boite} className="vrm-tampons-vignette" data-tampons-vignette={fam.id} data-etat={st.etat} data-cle={p ? p.cle : ''}
      data-source={st.source || ''} data-n={p ? boiteTexte(p.place) : ''} data-m={p ? boiteTexte(p.mentionBoite) : ''}
      aria-label={tr('tampons.vignette.aria', { nom, support: nomSupport })} onClick={() => ouvrir(fam)}>
      <span className="vrm-tampons-vignette-tete"><Logo fam={fam}/><span className="vrm-tampons-vignette-nom">{nom}</span></span>
      <span ref={page} className="vrm-tampons-vignette-page">
        <canvas ref={cv} aria-hidden="true" data-stream-image="bordereau"/>
        {/* En pourcentage de la page : le cadre reste sur le tampon même quand la vignette est réduite (téléphone). */}
        {st.etat === 'ok' && p && p.place && <i className="vrm-tampons-cadre" style={pc(p.place, p, 0)}/>}
        {st.etat === 'ok' && p && p.mentionBoite && <i className="vrm-tampons-cadre vrm-tampons-cadre-m" style={pc(p.mentionBoite, p, 1.5)}/>}
        {st.etat === 'charge' && <span className="vrm-tampons-attente">{tr('tampons.dessin')}</span>}
        {st.etat === 'ko' && <span className="vrm-tampons-attente">{tr('tampons.ko')}</span>}
      </span>
      <span className="vrm-tampons-vignette-statut" data-tampons-statut={main ? 'main' : 'auto'} style={{ color: C.muted }}>
        {st.etat === 'ok' && st.source === 'exemple' && <span className="vrm-tampons-exemple" data-tampons-exemple="" title={tr('tampons.exemple.phrase')}>{tr('tampons.exemple')}</span>}
        {main ? <>{tr('tampons.statut.main')} · <span style={{ color: C.accentTexte || C.accent }}>{tr('tampons.modifier')}</span></> : tr('tampons.statut.auto2')}
      </span>
    </button>
  );
}

// Les réglages « en formulaire » d'une portée (tous les bordereaux, ou un type) : ce que le N° écrit, sa taille, sa place.
// (17 nov.) Plus rien pour « Créé par vrm.center » : il s'imprime toujours, au-dessus du code.
function ChoixTampons({ tampons, portee, support, changer }) {
  useLangue();
  const th = supportThermique(support);
  const r = portee === 'tous' ? { contenu: th ? tampons.th : tampons.a4, texte: tampons.texte, place: tampons.place } : resoudreTampon(tampons, { famille: portee, thermique: th });
  const c = r.contenu || {};
  const sel = { minHeight: 44, flex: '1 1 180px', maxWidth: 320, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0 10px', fontSize: 15, background: C.bg, color: C.text, fontFamily: 'inherit' };
  const ligne = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 };
  const lib = { fontSize: 13, fontWeight: 600, color: C.text, minWidth: 92 };
  const aide = { fontSize: 12, color: C.muted, lineHeight: 1.45, marginTop: 4 };
  const tailles = Object.keys(TAILLES_TAMPON).map((v) => ({ v, l: v }));
  return (
    <div data-tampons-choix={portee} data-tampons-support-choix={th ? 'th' : 'a4'}>
      <fieldset style={{ border: 0, padding: 0, margin: '12px 0 0' }}>
        <legend style={lib}>{tr('tampons.contenu')}</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 18px' }}>
          {['num', 'titre', 'taille'].map((k) => (
            <label key={k} className="vrm-tampon-case">
              <input type="checkbox" data-tampons-contenu={k} data-coche={c[k] ? '1' : '0'} checked={!!c[k]} onChange={(e) => changer({ contenu: { [k]: e.target.checked } })}/>
              {tr(`tampons.contenu.${k}`)}
            </label>
          ))}
        </div>
        <div style={aide}>{tr('tampons.contenu.voit')}</div>
      </fieldset>
      <div style={{ marginTop: 12 }}>
        <div style={{ ...lib, marginBottom: 6 }}>{tr('tampons.texte.n')}</div>
        <Segmente label={tr('tampons.texte.n')} value={r.texte} onChange={(v) => changer({ texte: v })} options={tailles.map((o) => ({ ...o, data: { 'data-tampons-texte': o.v } }))}/>
      </div>
      <div style={ligne}>
        <label htmlFor={`vrm-tampons-place-${portee}`} style={lib}>{tr('tampons.place.n')}</label>
        <select id={`vrm-tampons-place-${portee}`} data-tampons-place={r.place} value={r.place} onChange={(e) => changer({ place: e.target.value })} style={sel}>
          {PLACES_N.map((v) => <option key={v} value={v}>{tr(`tampons.place.${v}`)}</option>)}
        </select>
      </div>
      <div style={aide}>{tr('tampons.jamais')}</div>
    </div>
  );
}

// ── LA FEUILLE d'un type × support (la même scène que l'aperçu avant impression) ──
// La place posée vaut pour la FORME (type · format · sens) : le prochain bordereau imprimé de ce type sort ainsi.
export function versPlace(quoi, b, pose, v = 0) { return quoi === 'n' ? { vx: b.x / pose.W, vy: b.y / pose.H, vw: Math.min(1, b.w / pose.W), v } : { vx: b.x / pose.W, vy: b.y / pose.H, vw: Math.min(1, b.w / pose.W) }; }
// La taille S/M/L la plus proche d'un facteur d'agrandissement.
export function tailleProche(k) { return Object.keys(TAILLES_TAMPON).reduce((a, c) => (Math.abs(TAILLES_TAMPON[c] - k) < Math.abs(TAILLES_TAMPON[a] - k) ? c : a), 'M'); }
function Editeur({ fam, support, tampons, ecrire, annuler, peutAnnuler, fermer, nomSupport }) {
  useLangue();
  const [st, setSt] = React.useState({ etat: 'charge' });
  const [msg, setMsg] = React.useState(null);            // { sorte: 'refus'|'ok', quoi }
  const [portee, setPortee] = React.useState(() => (tampons.types && tampons.types[fam.id] ? fam.id : 'tous'));
  const th = supportThermique(support);
  const cle = JSON.stringify([fam.id, support, tampons]);
  React.useEffect(() => {
    let vivant = true; setSt((s) => ({ ...s, etat: s.pose ? 'redessin' : 'charge' }));
    enFile(async () => {
      const ex = await rendreBordereau(fam, support, tampons);
      if (!vivant) return;
      if (!ex.pose) { setSt({ etat: 'ko' }); return; }
      const dispoW = Math.min((typeof window !== 'undefined' ? window.innerWidth : 600) - 40, 620);
      const dispoH = Math.max(280, (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.62);
      setSt({ etat: 'ok', ...ex, largeur: Math.round(Math.max(200, Math.min(dispoW, dispoH * ex.pose.W / ex.pose.H))) });
    }).catch(() => { if (vivant) setSt({ etat: 'ko' }); });
    return () => { vivant = false; };
  }, [cle]);   // eslint-disable-line react-hooks/exhaustive-deps
  const p = st.pose;
  const pl = p ? placesDeForme(tampons, p.cle) : { n: null };
  const poser = (quoi, b) => {
    if (quoi !== 'n' || !p) return;   // la mention est verrouillée
    ecrire(avecPlace(tampons, p.cle, 'n', versPlace('n', b, p, (p.place && p.place.v) || 0))); setMsg({ sorte: 'ok' });
  };
  const origine = () => { let n = avecPlace(tampons, p ? p.cle : '', 'n', null); n = sansException(n, fam.id); ecrire(n); setPortee('tous'); setMsg(null); };
  const changer = (patch) => { ecrire(avecChoix(tampons, portee, patch, { support: th ? 'th' : 'a4' })); setMsg(null); };
  const nom = tr(`tampons.famille.${fam.id}`);
  return createPortal(
    <div className="vrm-tampon-voile" style={{ zIndex: Z_CONFIRMATION }} role="dialog" aria-modal="true" aria-label={tr('tampons.editeur.aria', { nom })}
      data-tampons-editeur={fam.id} data-etat={st.etat} data-cle={p ? p.cle : ''} data-support={support} data-source={st.source || ''} data-noswipe="1"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } }}>
      <FermeAuRetour fermer={fermer}/>
      <div className="vrm-tampon-feuille" style={{ background: C.card, color: C.text }}>
        <div className="vrm-tampon-tete">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><Logo fam={fam}/><b>{nom} · {nomSupport}</b></span>
          <Bouton variante="discret" icone="close" aria-label={tr('tampons.fermer')} data-tampons-fermer="" onClick={fermer}/>
        </div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.45 }}>{tr('tampons.editeur.phrase2')}</div>
        <div className="vrm-tampon-zone">
          {p && st.largeur ? <SceneTampons octets={st.octets} pose={p} largeur={st.largeur} dessiner={dessinerPdf} occupe={st.etat === 'redessin'}
            libres={{ n: !!pl.n, m: false }} libelles={{ n: tr('tampons.el.n'), m: tr('tampons.el.m'), mVerrou: tr('tampons.el.mVerrou') }}
            onPoser={poser} onRefus={(q) => setMsg({ sorte: 'refus', quoi: q })}/> : <div style={{ minHeight: 280 }}/>}
        </div>
        <div className="vrm-tampon-puces" role="status">
          {st.etat === 'ok' && st.source === 'exemple' && <span className="vrm-tampon-puce" data-tampons-exemple="" style={{ color: C.muted, background: C.bg }}>{tr('tampons.exemple.phrase')}</span>}
          {st.etat === 'charge' && <span className="vrm-tampon-puce" style={{ color: C.muted, background: C.bg }}>{tr('tampons.dessin')}</span>}
          {st.etat === 'ko' && <span className="vrm-tampon-puce" style={{ color: C.muted, background: C.bg }}>{tr('tampons.ko')}</span>}
          {msg && msg.sorte === 'refus' && <span className="vrm-tampon-puce" data-tampons-refus={msg.quoi} style={{ color: C.warn, background: C.warnSoft }}>{tr(`tampons.refus.${['qr', 'code', 'adresse'].includes(msg.quoi) ? msg.quoi : 'code'}`)}</span>}
          {msg && msg.sorte === 'ok' && <span className="vrm-tampon-puce" data-tampons-enregistre="" style={{ color: C.muted, background: C.bg }}>{tr('tampons.enregistre', { nom })}</span>}
          {p && p.repousse && <span className="vrm-tampon-puce" data-tampons-repousse="" style={{ color: C.warn, background: C.warnSoft }}>{tr('tampons.repousse')}</span>}
          {p && st.etat === 'ok' && !p.mentionBoite && <span className="vrm-tampon-puce" data-tampons-sans-mention="" style={{ color: C.muted, background: C.bg }}>{tr('tampons.sansMention')}</span>}
        </div>
        <div className="vrm-tampon-options">
          <Bouton variante="discret" data-tampons-annuler="" disabled={!peutAnnuler} onClick={() => { annuler(); setMsg(null); }}>{tr('tampons.annuler')}</Bouton>
          <Bouton variante="discret" data-tampons-origine="" onClick={origine}>{tr('tampons.origine')}</Bouton>
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          <Segmente label={tr('tampons.portee')} plein value={portee} onChange={setPortee}
            options={[{ v: 'tous', l: tr('tampons.portee.tous'), data: { 'data-tampons-portee': 'tous' } }, { v: fam.id, l: tr('tampons.portee.seul', { nom }), data: { 'data-tampons-portee': fam.id } }]}/>
          <ChoixTampons tampons={tampons} portee={portee} support={support} changer={changer}/>
        </div>
        <div className="vrm-tampon-actions">
          <Bouton variante="primaire" data-tampons-fini="" onClick={fermer}>{tr('tampons.fini')}</Bouton>
        </div>
      </div>
    </div>, document.body);
}

// ── LA SECTION de Paramètres → Imprimante et bordereaux ──────────────────────
export default function TamponsBordereaux() {
  useLangue();
  const [tampons, setTampons] = React.useState(() => reglageTamponsChoisi());
  const touche = React.useRef(false);
  React.useEffect(() => onCloudReady(() => { if (!touche.current) setTampons(reglageTamponsChoisi()); }), []);
  React.useEffect(() => { const f = () => setTampons(reglageTamponsChoisi()); window.addEventListener('vrm:tampons', f); return () => window.removeEventListener('vrm:tampons', f); }, []);
  const [historique, setHistorique] = React.useState([]);
  const ecrire = (n) => { touche.current = true; setHistorique((h) => [...h.slice(-30), tampons]); ecrireReglageTampons(n); setTampons(reglageTamponsChoisi()); };
  const annuler = () => { setHistorique((h) => { if (!h.length) return h; const prec = h[h.length - 1]; ecrireReglageTampons(prec); setTampons(reglageTamponsChoisi()); return h.slice(0, -1); }); };
  const mode = imprimanteChoisie();
  const papierDuReglage = (() => { try { return reglageImpression(load(CLE_IMPRESSION, null)).format; } catch (_) { return '10x15'; } })();
  const [support, setSupport] = React.useState(() => (mode === 'thermique' ? (papierDuReglage === 'autre' ? '10x15' : papierDuReglage) : mode === 'planche4' ? 'planche4' : 'a4'));
  const [ouvert, setOuvert] = React.useState(null);
  const famille = supportThermique(support) && support !== 'planche4' ? 'th' : support;
  const nomSupport = support === 'a4' ? tr('tampons.support.a4') : support === 'planche4' ? tr('tampons.support.planche4') : tr('tampons.support.th', { papier: tr(`impression.format.${support}`) });
  const imprimables = FAMILLES.filter((f) => f.imprime !== false);
  const origineTout = () => { if (typeof window !== 'undefined' && window.confirm && !window.confirm(tr('tampons.origineTout.confirme'))) return; ecrire(reglageOrigine()); };
  return (
    <section className="vrm-tampons" data-tampons-reglage="" data-tampons-support={support} data-tampons-origine-etat={estOrigine(tampons) ? '1' : '0'} style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 17, fontWeight: 600, color: C.text }}>{tr('tampons.titre')}</div>
      <div style={{ fontSize: 14, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{tr('tampons.phrase2')}</div>
      <div data-tampons-mention-toujours="" style={{ fontSize: 14, color: C.text, marginTop: 6, lineHeight: 1.5 }}>{tr('tampons.mention.toujours')}</div>
      <div className="vrm-tampons-formats">
        <Segmente label={tr('tampons.support')} plein value={famille} onChange={(v) => setSupport(v === 'th' ? (papierDuReglage === 'autre' ? '10x15' : papierDuReglage) : v)}
          options={[{ v: 'a4', l: tr('tampons.support.a4'), data: { 'data-tampons-support-choix': 'a4' } }, { v: 'planche4', l: tr('tampons.support.planche4'), data: { 'data-tampons-support-choix': 'planche4' } }, { v: 'th', l: tr('tampons.support.thermique'), data: { 'data-tampons-support-choix': 'th' } }]}/>
      </div>
      {famille === 'th' && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <label htmlFor="vrm-tampons-papier" style={{ fontSize: 13, fontWeight: 600, color: C.text, minWidth: 92 }}>{tr('impression.papier')}</label>
        <select id="vrm-tampons-papier" data-tampons-papier={support} value={support} onChange={(e) => setSupport(e.target.value)}
          style={{ minHeight: 44, flex: '1 1 180px', maxWidth: 320, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0 10px', fontSize: 15, background: C.bg, color: C.text, fontFamily: 'inherit' }}>
          {PAPIERS.map((f) => <option key={f.id} value={f.id}>{tr(`impression.format.${f.id}`)}</option>)}
        </select>
      </div>}
      {support === 'planche4' && <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>{tr('tampons.planche4.phrase')}</div>}
      <div className="vrm-tampons-galerie" data-tampons-galerie="">
        {imprimables.map((f) => <Vignette key={f.id} fam={f} support={support} tampons={tampons} ouvrir={setOuvert} nomSupport={nomSupport}/>)}
        <div className="vrm-tampons-vignette vrm-tampons-vignette-ebay" data-tampons-vignette="ebay" data-etat="sans">
          <span className="vrm-tampons-vignette-nom">{tr('tampons.famille.ebay')}</span>
          <span className="vrm-tampons-vignette-statut" style={{ color: C.muted }}>{tr('tampons.ebay')}</span>
        </div>
      </div>
      <div style={{ marginTop: 18, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('tampons.tous')}</div>
        <ChoixTampons tampons={tampons} portee="tous" support={support} changer={(patch) => ecrire(avecChoix(tampons, 'tous', patch, { support: supportThermique(support) ? 'th' : 'a4' }))}/>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <Bouton variante="discret" data-tampons-annuler-tout="" disabled={!historique.length} onClick={annuler}>{tr('tampons.annuler')}</Bouton>
          <Bouton variante="discret" data-tampons-origine-tout="" disabled={estOrigine(tampons)} onClick={origineTout}>{tr('tampons.origineTout')}</Bouton>
        </div>
      </div>
      {ouvert && <Editeur key={ouvert.id + support} fam={ouvert} support={support} tampons={tampons} ecrire={ecrire} annuler={annuler} peutAnnuler={historique.length > 0} fermer={() => setOuvert(null)} nomSupport={nomSupport}/>}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// « CRÉER SUR VINTED » DEPUIS UNE OU PLUSIEURS FICHES VRM (11 nov., lot annonce-vinted)
// La règle : src/annonceVinted.js. L'extension (5.367, `creerVintedFiche`) prépare UN
// brouillon par fiche, depuis l'onglet vinted.fr, au nom du compte de l'onglet (affiché
// ici, jamais choisi à sa place) ; c'est LUI qui publie.
// • Photos : celles de la fiche, ou choisies ici (réduites dans la page, 1600 px, JPEG) —
//   gardées le temps de la création, jamais envoyées ailleurs que sur Vinted.
// • Le geste passe par `lancerTravail` (VRM figé, barre, journal) et compte dans les
//   50 actions/h du compte (une par fiche, réserve 5, tenu par l'extension).
// • Un champ que VRM ne fait pas correspondre au catalogue de Vinted : l'extension s'arrête
//   AVANT toute requête et pose la question ; on la pose ici (valeurs de Vinted, recherche
//   dans une longue liste) ; « Je choisirai sur Vinted » laisse le champ vide ; « Pas
//   maintenant » laisse la fiche (rien n'est envoyé).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { lancerTravail } from './suiviTravail.js';
import { texteAnnonceVinted, manquesFiche, payloadFiche, issueCreation, questionOk, filtrerOptions, PHOTOS_MAX } from './annonceVinted.js';
import './styles-creer-vinted.css';

const Z_FEUILLE = 1200, Z_QUESTION = 20001;
const prixTexte = (p) => { const n = Number(p); return Number.isFinite(n) && n > 0 ? `${String(Math.round(n * 100) / 100).replace('.', ',')} €` : ''; };
const lienBrouillon = (id) => `https://www.vinted.fr/items/${encodeURIComponent(String(id))}/edit`;

// Une photo choisie ⇒ un JPEG réduit (1600 px au plus), en data URL. null si illisible.
export async function photoReduite(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const u = c.toDataURL('image/jpeg', 0.88);
    return /^data:image\/jpeg;base64,/.test(u) ? u : null;
  } catch (_) { return null; }
}

// LA QUESTION (valeurs de Vinted). Montée dans un nœud ajouté APRÈS le gel : la feuille
// « VRM travaille » la relève au-dessus d'elle. Rend l'id choisi · 'vinted' · null.
function Question({ q, fiche, fin }) {
  useLangue();
  const [cherche, setCherche] = React.useState('');
  const longue = q.options.length > 12;
  const liste = longue ? filtrerOptions(q.options, cherche, 60) : q.options;
  React.useEffect(() => { const f = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fin(null); } }; window.addEventListener('keydown', f, true); return () => window.removeEventListener('keydown', f, true); }, [fin]);
  return (
    <div className="vrm-cv-voile" style={{ zIndex: Z_QUESTION }} data-creer-vinted-question={q.champ} role="dialog" aria-modal="true" aria-label={tr('creerVinted.question.titre', { nom: q.nom || '', num: q.num || '' })}>
      <div className="vrm-cv-q">
        <h3>{tr('creerVinted.question.titre', { nom: q.nom || '', num: q.num || '' })}</h3>
        <p className="vrm-cv-doux">{q.texte ? tr('creerVinted.question.texte', { texte: q.texte }) : tr('creerVinted.question.sansTexte')}{fiche && fiche.titre ? <><br/>« {fiche.titre} »</> : null}</p>
        {longue && <input className="vrm-cv-cherche" type="search" autoFocus value={cherche} onChange={(e) => setCherche(e.target.value)} placeholder={tr('creerVinted.question.chercher')} aria-label={tr('creerVinted.question.chercher')} data-creer-vinted-cherche=""/>}
        <div className="vrm-cv-opts" data-creer-vinted-options={liste.length}>
          {liste.map(([id, t]) => <button key={id} type="button" className="vrm-cv-opt" data-creer-vinted-option={id} onClick={() => fin(String(id))}>{t}</button>)}
          {longue && !liste.length && <p className="vrm-cv-doux">{tr('creerVinted.question.aucune')}</p>}
        </div>
        <div className="vrm-cv-pied-q">
          <button type="button" className="vrm-cv-second" data-creer-vinted-plus-tard="" onClick={() => fin('vinted')}>{tr('creerVinted.question.surVinted')}</button>
          <button type="button" className="vrm-cv-second" data-creer-vinted-pas-maintenant="" onClick={() => fin(null)}>{tr('creerVinted.question.pasMaintenant')}</button>
        </div>
      </div>
    </div>
  );
}
export function demanderValeurVinted(q, fiche) {
  return new Promise((resolve) => {
    const n = document.createElement('div'); document.body.appendChild(n);
    const root = createRoot(n);
    const fin = (v) => { try { root.unmount(); } catch (_) {} n.remove(); resolve(v); };
    root.render(<Question q={q} fiche={fiche} fin={fin}/>);
  });
}

export default function CreerSurVinted({ fiches = [], compteOnglet, extRaison = '', reglages = {}, envoyer, onCree, onFermer, Retour = null, demander = demanderValeurVinted, entreMs = null }) {
  useLangue();
  const [photos, setPhotos] = React.useState(() => Object.fromEntries(fiches.map((f) => [f.id, (Array.isArray(f.photos) ? f.photos : []).filter((u) => typeof u === 'string').slice(0, PHOTOS_MAX)])));
  const [lecture, setLecture] = React.useState('');
  const [confirme, setConfirme] = React.useState(false);
  const [faits, setFaits] = React.useState({});
  const [enCours, setEnCours] = React.useState(false);
  const inputs = React.useRef({});
  const lignes = fiches.map((f) => {
    const texte = texteAnnonceVinted(f, reglages);
    const manque = manquesFiche(f, photos[f.id]);
    return { f, texte, manque, prete: texte.ok && !manque.length };
  });
  const pretes = lignes.filter((l) => l.prete && !faits[l.f.id]);
  const compte = compteOnglet && compteOnglet.uid ? compteOnglet : null;
  const bloque = extRaison ? extRaison : compteOnglet === undefined ? tr('creerVinted.compte.pasSu') : !compte ? tr('creerVinted.compte.aucun') : '';
  const ajouter = async (id, files) => {
    const l = [...(files || [])].slice(0, PHOTOS_MAX);
    if (!l.length) return;
    setLecture(id);
    const lues = [];
    for (const file of l) { const u = await photoReduite(file); if (u) lues.push(u); }
    setPhotos((p) => ({ ...p, [id]: [...(p[id] || []), ...lues].slice(0, PHOTOS_MAX) }));
    setLecture('');
  };
  const retirer = (id, i) => setPhotos((p) => ({ ...p, [id]: (p[id] || []).filter((_, k) => k !== i) }));
  const lancer = async () => {
    if (!confirme) { setConfirme(true); return; }
    setConfirme(false); setEnCours(true);
    const file = pretes.map((l) => l.f);
    const pause = entreMs != null ? entreMs : 8000 + Math.floor(Math.random() * 12000);
    await lancerTravail({
      titre: tr('creerVinted.titre'), sorte: 'creer-vinted', uid: compte.uid, entreMs: file.length > 1 ? pause : 0,
      etapes: [['envoi', tr('creerVinted.etape.envoi')], ['brouillon', tr('creerVinted.etape.brouillon')]],
      articles: file.map((f) => ({ id: f.id, num: f.numero, titre: f.titre })),
      executer: async (a, o) => {
        const f = file.find((x) => x.id === a.id);
        const l = lignes.find((x) => x.f.id === a.id);
        const reponses = {};
        for (let k = 0; k < 8; k++) {
          o.etape('envoi');
          const r = await envoyer({ cmd: 'creerVintedFiche', uid: compte.uid, confirme: true, fiche: payloadFiche(f, l.texte, photos[f.id]), reponses: { ...reponses } });
          if (r && r.code === 'question' && questionOk(r.question) && !(r.question.champ in reponses)) {
            o.noter(`N°${f.numero} : ${r.question.nom} à choisir`);
            const v = await demander(r.question, f);
            if (v == null) return { etat: 'saute', raison: `${r.question.nom} pas choisie`, geste: tr('creerVinted.geste.relancer') };
            reponses[r.question.champ] = v;
            continue;
          }
          const iss = issueCreation(r);
          if (iss.etat === 'ok' && r.draftId) {
            o.etape('brouillon');
            o.noter(`N°${f.numero} : brouillon prêt sur Vinted${r.lie === false ? ' (N° pas relié : ' + (r.lienRaison || 'pas su') + ')' : ''}`, 'ok');
            setFaits((x) => ({ ...x, [f.id]: { draftId: String(r.draftId), aFinir: r.aFinir || [] } }));
            try { if (onCree) onCree(f, r, compte.uid); } catch (_) {}
            return { ...iss, lien: lienBrouillon(r.draftId) };
          }
          return iss;
        }
        return { etat: 'refus', raison: 'trop de questions', geste: tr('creerVinted.geste.relancer') };
      },
    });
    setEnCours(false);
  };
  const n = pretes.length;
  const corps = (
    <div className="vrm-cv-voile" style={{ zIndex: Z_FEUILLE }} data-creer-vinted={fiches.length} role="dialog" aria-modal="true" aria-label={tr('creerVinted.titre')}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-cv-feuille">
        <div className="vrm-cv-tete">
          <h2>{tr('creerVinted.titre')}</h2>
          <button type="button" className="vrm-cv-x" aria-label={tr('creerVinted.fermer')} onClick={onFermer} data-creer-vinted-fermer="">×</button>
        </div>
        <p className="vrm-cv-doux">{tr('creerVinted.intro')}</p>
        <div className={`vrm-cv-compte${bloque ? ' vrm-cv-geste' : ''}`} data-creer-vinted-compte={compte ? compte.uid : (compteOnglet === undefined ? 'pas-su' : 'aucun')}>
          {bloque ? bloque : tr('creerVinted.compte.onglet', { login: compte.login || compte.uid })}
        </div>
        <ul className="vrm-cv-liste">
          {lignes.map(({ f, texte, manque }) => {
            const ph = photos[f.id] || []; const fait = faits[f.id];
            return (
              <li key={f.id} className="vrm-cv-ligne" data-creer-vinted-fiche={f.numero} data-creer-vinted-etat={fait ? 'fait' : (texte.ok && !manque.length ? 'prete' : 'manque')}>
                <div className="vrm-cv-ligne-tete">
                  <span className="vrm-cv-num">N°{f.numero}</span>
                  <span className="vrm-cv-txt"><b>{texte.ok ? texte.titre : (f.titre || tr('creerVinted.sansTitre'))}</b><small>{[f.marque, f.taille, f.etat, prixTexte(f.prix)].filter(Boolean).join(' · ')}</small></span>
                </div>
                <div className="vrm-cv-photos" data-creer-vinted-photos={ph.length}>
                  {ph.map((u, i) => <span key={i} className="vrm-cv-photo"><img src={u} alt=""/>{!fait && !enCours && <button type="button" aria-label={tr('creerVinted.photo.retirer', { n: i + 1 })} onClick={() => retirer(f.id, i)}>×</button>}</span>)}
                  {!fait && <button type="button" className="vrm-cv-ajout" disabled={enCours || lecture === f.id || ph.length >= PHOTOS_MAX} onClick={() => inputs.current[f.id] && inputs.current[f.id].click()} data-creer-vinted-ajouter={f.numero}>{lecture === f.id ? tr('creerVinted.photo.lecture') : tr('creerVinted.photo.ajouter')}</button>}
                  <input ref={(el) => { inputs.current[f.id] = el; }} type="file" accept="image/*" multiple hidden onChange={(e) => { ajouter(f.id, e.target.files); e.target.value = ''; }}/>
                </div>
                {fait ? <p className="vrm-cv-ok" data-creer-vinted-fait={fait.draftId}>{tr('creerVinted.fait')} <a href={lienBrouillon(fait.draftId)} target="_blank" rel="noopener noreferrer">{tr('creerVinted.ouvrir')}</a>{fait.aFinir.length ? <><br/><small>{tr('creerVinted.aFinir', { liste: fait.aFinir.join(', ') })}</small></> : null}</p>
                  : !texte.ok ? <p className="vrm-cv-geste" data-creer-vinted-refus="">{texte.raison}</p>
                  : manque.length ? <p className="vrm-cv-geste" data-creer-vinted-manque={manque.join(',')}>{tr('creerVinted.manque', { liste: manque.map((m) => tr('creerVinted.champ.' + m)).join(', ') })}</p> : null}
              </li>
            );
          })}
        </ul>
        <div className="vrm-cv-pied">
          <small className="vrm-cv-doux">{tr('creerVinted.pied')}</small>
          <button type="button" className="vrm-cv-primaire" data-creer-vinted-lancer={n} data-creer-vinted-confirme={confirme ? '1' : '0'} disabled={!!bloque || !n || enCours} onClick={lancer}>
            {confirme ? tr('creerVinted.confirmer', { n, login: compte ? (compte.login || compte.uid) : '' }) : tr('creerVinted.lancer', { n })}
          </button>
        </div>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(corps, document.body) : corps;
}

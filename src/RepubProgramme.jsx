// ═══════════════════════════════════════════════════════════════════════════
// REPUBLIER À L'HEURE QU'IL CHOISIT — l'écran (11 nov., lot republier-programme)
// ═══════════════════════════════════════════════════════════════════════════
// La règle : src/repubProgramme.js. Ici :
//  · `ProgrammerRepub` — dans l'atelier, à côté de « Lancer » : SON heure, les conditions
//    dites À L'AVANCE, « Programmer à 18:00 » (SON clic, réglages figés tels quels) ;
//  · `ProgrammesRepubCarte` — Annonces : « Programmée demain 18:00 · 12 annonces »,
//    Modifier / Annuler ; « Pas partie » (ambre : un geste à faire) avec la raison ;
//  · `ProgrammeRepubVeille` — montée dans AppCoeur : à l'heure, sur l'appareil dont
//    l'extension voit CE compte, vérifie les conditions ; tout est là ⇒ prend le départ
//    (comparer-et-échanger) et ouvre l'atelier avec la programmation ; sinon RIEN ne part,
//    « pas partie » + la notification de l'appareil (`pushNotif`) + un bandeau.
// Tout le texte passe par tr() (clés `rp.*`, 5 langues).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, date as dateLoc, heure as heureLoc } from './i18n/index.js';
import { AUTH, CLOISONNE, SUPABASE_URL, sbAuth, withOwner, lireTout, extSait, vintedDeChrome, __vmrEtat, onVmrExt, askConfirm, toast, pushNotif, EXT_CAPACITES } from './App.jsx';
import { suivi } from './suiviTravail.js';
import { jaugeDuCompte } from './jaugeActions.js';
import { lireLignesActions } from './JaugeActions.jsx';
import { lireProgrammes, modifierProgrammes, creerProgramme, poserProgramme, annulerProgramme, prendreDepart, marquerPasPartie, marquerVu,
  conditionsDepart, decision, ACTIONS_QUOTA } from './repubProgramme.js';
import './repub-programme.css';

export const ctxLigne = () => ({ url: SUPABASE_URL, entetes: sbAuth, avecOwner: withOwner, owner: AUTH.user && AUTH.user.id, cloisonne: CLOISONNE });
// La demande de départ, prise par l'écran Annonces quand il se monte (comme DEMANDE_VUE).
export const DEMANDE_PROGRAMME = { prog: null, mode: null, at: 0 };
export const prendreDemandeProgramme = () => { const d = DEMANDE_PROGRAMME; if (d.prog && Date.now() - d.at < 120000) { const r = { prog: d.prog, mode: d.mode }; d.prog = null; d.mode = null; return r; } return null; };
const signaler = () => { try { window.dispatchEvent(new CustomEvent('vrm:repub-prog')); } catch (_) {} };
const quand = (ms) => `${dateLoc(ms, { weekday: 'long', day: 'numeric', month: 'long' })} · ${heureLoc(ms)}`;
const appareilId = (() => { let v = ''; try { v = sessionStorage.getItem('vrm_onglet_id') || ''; if (!v) { v = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('vrm_onglet_id', v); } } catch (_) { v = Math.random().toString(36).slice(2, 10); } return v; })();

// L'extension de CE navigateur, telle que la règle la lit.
export function extPourDepart() {
  const e = __vmrEtat;
  const present = !!(e && e.ok);
  const vc = vintedDeChrome();
  return { present, capOk: present && extSait('repubdepart') === 'ok', uidOnglet: vc === undefined ? undefined : vc ? vc.uid : '', repub: e && e.repub && typeof e.repub === 'object' ? e.repub : null };
}
// Les republications du compte ces 24 h (la même lecture que l'extension, `republieesEnBase`).
export async function lireRepubJour(uid) {
  const depuis = new Date(Date.now() - 86400000).toISOString();
  const rows = await lireTout(`id=like.coffre_${uid}_*&data->versBrouillon->>supprimeLe=gte.${encodeURIComponent(depuis)}&select=s:data->versBrouillon->>supprimeLe`).catch(() => null);
  if (!Array.isArray(rows)) return null;
  const t = Date.now();
  return rows.filter((r) => { const x = Date.parse((r && r.s) || ''); return Number.isFinite(x) && t - x < 86400000; }).length;
}

// Le texte d'une condition qui manque (une phrase et le geste).
export function texteManque(m) {
  const d = m && m.detail;
  if (m.cle === 'frein' || m.cle === 'frein-restreint') return tr(`rp.manque.${m.cle}`, { heure: heureLoc(Number(d)) });
  if (m.cle === 'plafond') return tr('rp.manque.plafond', { n: Number(d) || 0 });
  if (m.cle === 'jour') return tr('rp.manque.jour', { n: Number(d) || 0 });
  return tr(`rp.manque.${m.cle}`);
}

// Les programmations : undefined (lecture) · null (pas su) · { [uid]: prog }.
export function useProgrammesRepub(actif = true) {
  const [progs, setProgs] = React.useState(undefined);
  const progsRef = React.useRef(undefined); progsRef.current = progs;
  const lire = React.useCallback(() => { if (!AUTH.user || !AUTH.user.id) return; lireProgrammes(ctxLigne()).then((p) => setProgs((v) => (p === null && v ? v : p))); }, []);
  React.useEffect(() => {
    if (!actif) return undefined;
    lire();
    // Une programmation en attente : relue chaque minute (un autre appareil a pu la prendre ou la changer) ;
    // sinon toutes les 5 min (une programmation posée ailleurs arrive quand même à temps : 2 min d'avance au moins,
    // et l'heure exacte est guettée par la veille dès qu'elle est lue).
    let n = 0;
    const t = setInterval(() => { n++; const enAttente = progsRef.current && Object.values(progsRef.current).some((p) => p.etat === 'attente'); if ((enAttente || n % 5 === 0) && (typeof document === 'undefined' || document.visibilityState === 'visible')) lire(); }, 60000);
    window.addEventListener('vrm:repub-prog', lire);
    const vis = () => { if (document.visibilityState === 'visible') lire(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); window.removeEventListener('vrm:repub-prog', lire); document.removeEventListener('visibilitychange', vis); };
  }, [actif, lire]);
  return [progs, lire];
}

// ── DANS L'ATELIER : « Lancer plus tard » ───────────────────────────────────
const deux = (n) => String(n).padStart(2, '0');
const valeurLocale = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}T${deux(d.getHours())}:${deux(d.getMinutes())}`; };
const demain18 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); return d.getTime(); };

export function ProgrammerRepub({ uid, compte, action, ids, reglages, verifier, existante = null, actuelle = null, onFait }) {
  const [ouvert, setOuvert] = React.useState(!!existante);
  const [val, setVal] = React.useState(() => valeurLocale(existante ? existante.at : demain18()));
  const [erreur, setErreur] = React.useState('');
  const [enCours, setEnCours] = React.useState(false);
  const capOk = extSait('repubdepart') === 'ok';
  const at = Date.parse(val);
  const n = (ids || []).length;
  if (!ouvert) return (
    <button type="button" className="vrm-rp-ouvrir" data-rp-ouvrir="" disabled={!n} onClick={() => setOuvert(true)}>{tr('rp.prog.bouton')}</button>
  );
  const programmer = async () => {
    setErreur('');
    if (!capOk) { setErreur(tr('rp.prog.majExt', { v: EXT_CAPACITES.repubdepart })); return; }
    if (!uid) { setErreur(tr('rp.prog.compte')); return; }
    const c = creerProgramme({ uid, compte, action, ids, at, reglages: reglages(), id: existante ? existante.id : '' });
    if (!c.ok) { setErreur(tr(`rp.prog.erreur.${c.cle}`)); return; }
    // Son clic vaut validation de CE qui partira : la même vérification que « Lancer ».
    if (verifier && !(await verifier())) return;
    setEnCours(true);
    let r = await modifierProgrammes((d) => poserProgramme(d, c.prog), ctxLigne());
    if (r && r.refus && r.refus.refus === 'deja') {
      const ok = await askConfirm({ title: tr('rp.prog.remplacerQ', { quand: quand(r.refus.actuelle.at) }), desc: tr('rp.prog.remplacerDesc'), ok: tr('rp.prog.remplacer') });
      if (!ok) { setEnCours(false); return; }
      r = await modifierProgrammes((d) => poserProgramme(d, c.prog, { remplacer: true }), ctxLigne());
    }
    setEnCours(false);
    if (!r || r.refus || !r.ok) { setErreur(tr(r && r.refus && r.refus.refus === 'plus-en-attente' ? 'rp.prog.erreur.partie' : 'rp.prog.erreur.base')); return; }
    signaler();
    toast(tr('rp.prog.fait', { quand: quand(c.prog.at) }));
    if (onFait) onFait(c.prog);
  };
  return (
    <section className="vrm-rp" data-rp-programmer="" data-rp-existante={existante ? existante.id : undefined}>
      <h4 className="vrm-rp-titre">{tr('rp.prog.titre')}</h4>
      <label className="vrm-rp-champ">
        <span>{tr('rp.prog.heure')}</span>
        <input type="datetime-local" data-rp-heure="" value={val} onChange={(e) => setVal(e.target.value)} />
      </label>
      <div className="vrm-rp-cond" data-rp-conditions="">
        <p>{tr('rp.cond.titre')}</p>
        <ul>
          <li>{tr('rp.cond.vrm')}</li>
          <li>{tr('rp.cond.onglet', { compte: compte || uid || '' })}</li>
          <li>{tr('rp.cond.ext')}</li>
          <li>{tr('rp.cond.plafond')}</li>
          <li>{tr('rp.cond.frein')}</li>
        </ul>
        <p className="vrm-rp-sinon">{tr('rp.cond.sinon')}</p>
      </div>
      {actuelle && !existante && actuelle.etat === 'attente' ? <p className="vrm-rp-note" data-rp-remplace={actuelle.id}>{tr('rp.prog.dejaUne', { quand: quand(actuelle.at) })}</p> : null}
      {!capOk ? <p className="vrm-rp-note" data-rp-maj="">{tr('rp.prog.majExt', { v: EXT_CAPACITES.repubdepart })}</p> : null}
      {erreur ? <p className="vrm-rp-erreur" role="alert" data-rp-erreur="">{erreur}</p> : null}
      <div className="vrm-rp-actions">
        <button type="button" className="vrm-rp-principal" data-rp-valider="" disabled={enCours || !n || !Number.isFinite(at) || !capOk} onClick={programmer}>
          {Number.isFinite(at) ? tr('rp.prog.valider', { n, heure: heureLoc(at) }) : tr('rp.prog.validerSans')}
        </button>
        {!existante ? <button type="button" className="vrm-rp-second" onClick={() => { setOuvert(false); setErreur(''); }}>{tr('rp.prog.fermer')}</button> : null}
      </div>
    </section>
  );
}

// ── ANNONCES : les programmations ───────────────────────────────────────────
export function ProgrammesRepubCarte({ progs, onModifier }) {
  if (!progs || typeof progs !== 'object') return null;
  const liste = Object.values(progs).filter((p) => p.etat === 'attente' || (p.etat === 'pas-partie' && !p.vu)).sort((a, b) => a.at - b.at);
  if (!liste.length) return null;
  const annuler = async (p) => {
    const ok = await askConfirm({ title: tr('rp.carte.annulerQ'), desc: tr('rp.carte.annulerDesc', { quand: quand(p.at) }), ok: tr('rp.carte.annuler') });
    if (!ok) return;
    const r = await modifierProgrammes((d) => annulerProgramme(d, p.uid, p.id), ctxLigne());
    if (!r || !r.ok) toast(tr(r && !r.ok ? 'rp.carte.dejaPartie' : 'rp.prog.erreur.base')); else toast(tr('rp.carte.annulee'));
    signaler();
  };
  const vu = async (p) => { await modifierProgrammes((d) => marquerVu(d, p.uid, p.id), ctxLigne()); signaler(); };
  return (
    <div className="vrm-rp-cartes" data-rp-cartes={liste.length}>
      {liste.map((p) => p.etat === 'attente' ? (
        <div key={p.id} className="vrm-rp-carte" data-rp-carte={p.id} data-rp-etat="attente">
          <div className="vrm-rp-carte-txt">
            <b>{tr('rp.carte.attente', { quand: quand(p.at) })}</b>
            <small>{tr('rp.carte.detail', { n: p.ids.length, compte: p.compte || p.uid })}</small>
          </div>
          <div className="vrm-rp-carte-btns">
            <button type="button" className="vrm-rp-second" data-rp-modifier={p.id} onClick={() => onModifier && onModifier(p)}>{tr('rp.carte.modifier')}</button>
            <button type="button" className="vrm-rp-second" data-rp-annuler={p.id} onClick={() => annuler(p)}>{tr('rp.carte.annuler')}</button>
          </div>
        </div>
      ) : (
        <div key={p.id} className="vrm-rp-carte vrm-rp-carte-ambre" data-rp-carte={p.id} data-rp-etat="pas-partie" role="status">
          <div className="vrm-rp-carte-txt">
            <b>{tr('rp.carte.pasPartie', { quand: quand(p.at) })}</b>
            {p.raisons.map((m, i) => <small key={i} data-rp-raison={m.cle}>{texteManque(m)}</small>)}
            <small>{tr('rp.carte.rienParti')}</small>
          </div>
          <div className="vrm-rp-carte-btns">
            <button type="button" className="vrm-rp-second" data-rp-reprogrammer={p.id} onClick={() => onModifier && onModifier(p)}>{tr('rp.carte.reprogrammer')}</button>
            <button type="button" className="vrm-rp-second" data-rp-vu={p.id} onClick={() => vu(p)}>{tr('rp.carte.compris')}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── LA VEILLE (AppCoeur) ────────────────────────────────────────────────────
export async function noterPasPartie(p, manques) {
  const r = await modifierProgrammes((d) => marquerPasPartie(d, p.uid, p.id, manques), ctxLigne());
  signaler();
  if (!r || !r.ok) return false;
  const titre = tr('rp.notif.titre', { heure: heureLoc(p.at) });
  const corps = manques.length ? texteManque(manques[0]) : '';
  pushNotif(titre, corps, '?tab=annonces&vue=republier');
  toast(`${titre} — ${corps}`, 'warn');
  return true;
}

export function ProgrammeRepubVeille() {
  const [progs] = useProgrammesRepub(true);
  const [, tic] = React.useReducer((x) => x + 1, 0);
  const enVol = React.useRef(new Set());
  // L'état de l'extension change (onglet ouvert, compte) : on rejuge.
  React.useEffect(() => (typeof onVmrExt === 'function' ? onVmrExt(() => tic()) : undefined), []);
  React.useEffect(() => {
    if (!progs || typeof progs !== 'object') return undefined;
    const ext = extPourDepart();
    let prochain = 60000;
    for (const p of Object.values(progs)) {
      const d = decision(p, { ext });
      if (d.quoi === 'attendre') { prochain = Math.min(prochain, Math.max(1000, d.dans + 500)); continue; }
      if (d.quoi === 'rien' || enVol.current.has(p.id)) continue;
      enVol.current.add(p.id);
      (async () => {
        try {
          if (d.quoi === 'manquee') { await noterPasPartie(p, [{ cle: 'ferme' }]); return; }
          const occ = suivi.lire(); const occupe = !!(occ && (occ.statut === 'cours' || occ.statut === 'pause'));
          const [rows, jour] = await Promise.all([lireLignesActions(p.uid), ACTIONS_QUOTA.includes(p.action) ? lireRepubJour(p.uid) : Promise.resolve(0)]);
          const jauge = jaugeDuCompte(rows, p.uid, Date.now());
          const c = conditionsDepart({ prog: p, ext: extPourDepart(), jauge, jour, occupe });
          if (!c.ok) { await noterPasPartie(p, c.manques); return; }
          // Le départ est pris par UN appareil : celui dont l'écriture passe.
          const r = await modifierProgrammes((dd) => prendreDepart(dd, p.uid, p.id, appareilId), ctxLigne());
          const pr = r && r.progs && r.progs[p.uid];
          if (!r || !r.ok || !pr || pr.etat !== 'partie' || pr.appareil !== appareilId) { signaler(); return; }
          DEMANDE_PROGRAMME.prog = pr; DEMANDE_PROGRAMME.mode = 'depart'; DEMANDE_PROGRAMME.at = Date.now();
          try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=annonces&vue=republier' })); } catch (_) {}
          try { window.dispatchEvent(new CustomEvent('vrm:repub-programme')); } catch (_) {}
          signaler();
        } finally { setTimeout(() => enVol.current.delete(p.id), 5000); }
      })();
    }
    const t = setTimeout(tic, prochain);
    return () => clearTimeout(t);
  });
  return null;
}

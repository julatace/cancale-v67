// ═══════════════════════════════════════════════════════════════════════════
// « MES COMPTES » — À DISTANCE (22 nov., ext. 5.436, capacité `adistance`)
// ═══════════════════════════════════════════════════════════════════════════
// Julien veut ses comptes à distance, « comme Bleam Cloud mais sans risque de ban » : le relais est SON
// ordinateur (Chrome + l'extension) ; d'ici (iPhone, n'importe où) on VOIT et on COMMANDE. La règle est dans
// src/aDistance.js (pure, exécutée par scripts/audit-a-distance.cjs) ; ici : lire, appeler la règle, dessiner.
//   · « Ton ordinateur » : chaque navigateur et son état (allumé · comptes ouverts · éteint depuis 21:40), le
//     temps réel (instantané, ou sondage DIT), et comment le garder joignable ;
//   · « Tes gestes à distance » : En attente · En cours · Fait · Refusé (raison), « Annuler » tant qu'il attend ;
//   · « Comptes » : une rangée par compte (Vinted, Leboncoin, Vestiaire) — où il est ouvert, relu quand, non lus,
//     à envoyer ; pas relu depuis 48 h ⇒ ambre et « Relire » (une commande) ;
//   · un compte Vinted ouvert : sa boîte (20 conversations, projetées), un fil (messages, offres) et la réponse
//     tapée ici — un toucher pour envoyer ; accepter une offre (elle VEND la paire) demande SA confirmation.
// Écritures : seulement SES commandes (`cmd_dist_*`, RLS) sur son toucher, et leur annulation tant qu'elles attendent.
// Instantané : la veille temps réel de l'app relaie chaque ligne changée (`vrm:ligne`, src/VeilleTempsReel.jsx) ;
// sans elle, l'écran relit toutes les 2 s pendant qu'un geste est en vol — et le DIT.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, heure as heureLoc, date as dateLoc, dateRelative, monnaie } from '../i18n/index.js';
import { Page, Groupe, Rangee, Vignette, Bouton, Attente, Segmente, Feuille, Toast, PagePoussee, Champ, poserIcone, iconePosee } from '../natif/index.js';
import { Icon, SUPABASE_URL, sbAuth, withOwner, SB_CONFLICT, AUTH, load, lireCapturesDetail, useComptesAutresSites, aExpedier, lirePdfLigne } from '../App.jsx';
import { MIROIR_N, selectAnnoncesVinted, annoncesVintedDe, selectVentesVinted, ventesVintedDe, annoncesLbcDe, annoncesVcDe, filsLbcDe, filsVcDe, filAutreDe, prixVoulu } from './miroir.js';
import { nomCompteLie } from '../comptesLies.js';
import {
  ADIST_ALLUME_MS, nouvelleCommandeDistance, deposerCommandeDistance, annulerCommandeDistance, lireCommandesDistance, lirePresences,
  groupesFile, etatOrdinateurs, ordinateurPour, selectBoite, conversationsDe, SELECT_FIL, filDe, vueCommandeDistance, signalFrais,
} from '../aDistance.js';
import './aDistance.css';

const NOMS_NAV = { chrome: 'Chrome', edge: 'Edge', opera: 'Opera', firefox: 'Firefox', orion: 'Orion' };
const NOMS_SYS = { mac: 'Mac', windows: 'Windows', linux: 'Linux', iphone: 'iPhone', ipad: 'iPad', android: 'Android', chromeos: 'Chromebook' };
const NOMS_SITES = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire Collective' };
const VIEUX_MS = 48 * 3600000;
const nomOrdi = (p) => (p ? [NOMS_NAV[p.nav] || 'Chrome', NOMS_SYS[p.sys] || ''].filter(Boolean).join(' · ') : '');
const eur = (v) => (v == null ? '—' : monnaie(v));
// (Banc) le temps : réglable par un banc seulement (il ne peut pas attendre 30 s).
const temps = () => Object.assign({ vol: 2000, volRt: 5000, calme: 30000, presence: 30000 }, (typeof window !== 'undefined' && window.__VRM_ADIST_TEMPS) || {});

export function ilYa(ms, maintenant = Date.now()) {
  const t = Number(ms); if (!Number.isFinite(t) || t <= 0) return '';
  const min = Math.round((t - maintenant) / 60000);
  if (Math.abs(min) < 60) return dateRelative(Math.min(0, min), 'minute');
  const h = Math.round(min / 60);
  if (Math.abs(h) < 48) return dateRelative(h, 'hour');
  return dateRelative(Math.round(h / 24), 'day');
}

// ── Les dépendances de la base (SA session, RLS) ────────────────────────────
const dep = () => ({ base: `${SUPABASE_URL}/rest/v1`, entetes: (x) => sbAuth(x), ligne: (l) => withOwner(l), conflit: SB_CONFLICT });
const alea = () => { try { const b = new Uint8Array(6); crypto.getRandomValues(b); return Array.from(b, (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 8); } catch (_) { return Math.random().toString(36).slice(2, 10); } };

// Le temps réel de l'app (`data-temps-reel` posé par la veille) : 'joint' ⇒ instantané.
function useTempsReel() {
  const lire = () => { try { return document.documentElement.getAttribute('data-temps-reel') || ''; } catch (_) { return ''; } };
  const [v, setV] = React.useState(lire);
  React.useEffect(() => { const m = setInterval(() => setV(lire()), 2000); return () => clearInterval(m); }, []);
  return v;
}
// Une ligne de la famille a changé (temps réel de l'app, ou l'extension de CE navigateur) ⇒ `f()` tout de suite.
function useSignal(prefixe, f) {
  const ref = React.useRef(f); ref.current = f;
  React.useEffect(() => {
    let t = null;
    const vite = () => { if (t) return; t = setTimeout(() => { t = null; ref.current(); }, 120); };
    const surLigne = (e) => { const id = String((e && e.detail && e.detail.id) || ''); if (id.startsWith(prefixe)) vite(); };
    const surExt = (e) => { const d = e && e.detail; if (d && d.type === 'maj' && d.quoi === 'distance') vite(); };
    window.addEventListener('vrm:ligne', surLigne); window.addEventListener('vrm:ext', surExt);
    return () => { window.removeEventListener('vrm:ligne', surLigne); window.removeEventListener('vrm:ext', surExt); if (t) clearTimeout(t); };
  }, [prefixe]);
}
function usePresences() {
  const [v, setV] = React.useState(undefined);
  const lire = React.useCallback(() => lirePresences(dep()).then((x) => setV(x)).catch(() => setV(null)), []);
  React.useEffect(() => { lire(); const m = setInterval(lire, temps().presence); return () => clearInterval(m); }, [lire]);
  useSignal('presence_', lire);
  return v;
}
// La file : relue au montage, à chaque signal, et — tant qu'un geste est en vol — toutes les 2 s (5 s si le temps réel
// répond). Les gestes déposés d'ici sont montrés TOUT DE SUITE (`ajouter`), puis remplacés par la ligne relue.
function useFile(rt) {
  const [v, setV] = React.useState(undefined);
  const locaux = React.useRef(new Map());
  const fusion = (lus) => {
    if (!Array.isArray(lus)) return lus;
    const ids = new Set(lus.map((x) => x.id));
    for (const k of [...locaux.current.keys()]) if (ids.has(k) || Date.now() - locaux.current.get(k).demandeLe > 60000) locaux.current.delete(k);
    return [...locaux.current.values(), ...lus];
  };
  const lire = React.useCallback(() => lireCommandesDistance(dep()).then((x) => setV((avant) => (x === null && Array.isArray(avant) ? avant : fusion(x)))).catch(() => {}), []);
  React.useEffect(() => { lire(); }, [lire]);
  const enVol = Array.isArray(v) && v.some((x) => x.etat === 'attente' || x.etat === 'pris');
  React.useEffect(() => {
    const T = temps();
    const m = setInterval(lire, enVol ? (rt === 'joint' ? T.volRt : T.vol) : T.calme);
    return () => clearInterval(m);
  }, [lire, enVol, rt]);
  useSignal('cmd_dist_', lire);
  const ajouter = (c) => { const vue = vueCommandeDistance({ id: c.id, ...c.data }); if (vue) { locaux.current.set(c.id, vue); setV((a) => [vue, ...(Array.isArray(a) ? a.filter((x) => x.id !== c.id) : [])]); } };
  const retirer = (id) => { locaux.current.delete(id); setV((a) => (Array.isArray(a) ? a.map((x) => (x.id === id ? { ...x, etat: 'annulee' } : x)) : a)); };
  return [v, lire, ajouter, retirer];
}
function useMaintenant(ms = 15000) {
  const [t, setT] = React.useState(() => Date.now());
  React.useEffect(() => { const m = setInterval(() => setT(Date.now()), ms); return () => clearInterval(m); }, [ms]);
  return t;
}
// ── Les phrases d'un geste ──────────────────────────────────────────────────
function phraseEtat(c, ordis, maintenant) {
  if (c.etat === 'attente') {
    const p = ordinateurPour(ordis.allumes, c.site, c.compte);
    const ret = ordis.allumes.flatMap((o) => o.retenues).find((r) => r.id === c.id);
    const finMs = c.fin || c.demandeLe + 24 * 3600000;
    const h = new Date(finMs).toDateString() === new Date(maintenant).toDateString() ? heureLoc(finMs) : tr('adist.demain', { heure: heureLoc(finMs) });
    if (ret && tr('adist.r.' + ret.code) !== 'adist.r.' + ret.code) return { texte: tr('adist.r.' + ret.code), ton: ['verification', 'autre-compte', 'deux-comptes', 'absent'].includes(ret.code) ? 'ambre' : 'neutre' };
    if (!ordis.allumes.length) return { texte: tr('adist.e.attendEteint', { heure: h }), ton: 'ambre' };
    if (p && p.ouvert) return { texte: tr('adist.e.envoye', { nom: nomOrdi(p.p) }), ton: 'neutre' };
    if (p) return { texte: tr('adist.e.attendOuvrir', { site: NOMS_SITES[c.site] || c.site }), ton: 'ambre' };
    return { texte: tr('adist.e.attendRien', { heure: h }), ton: 'neutre' };
  }
  if (c.etat === 'pris') { const o = ordis.allumes.find((x) => x.id === c.par) || ordis.eteints.find((x) => x.id === c.par); return { texte: o ? tr('adist.e.coursNom', { nom: nomOrdi(o) }) : tr('adist.e.cours'), ton: 'neutre' }; }
  if (c.etat === 'fait') {
    const v = { avant: eur(c.avant), apres: eur(c.apres) };
    const cle = c.geste === 'prix' ? (c.avant != null && c.apres != null ? 'adist.f.prix' : 'adist.f.prixSans')
      : c.geste === 'accepter' ? (c.apres != null ? 'adist.f.accepterPrix' : 'adist.f.accepter')
      : c.geste === 'bordereau' && !c.pdf ? 'adist.f.bordereauSansPdf'
      : c.geste === 'relire' && c.code === 'rien' ? 'adist.f.relireRien' : 'adist.f.' + c.geste;
    return { texte: tr(cle, v), ton: 'neutre' };
  }
  if (c.etat === 'incertain') return { texte: tr('adist.e.incertain'), ton: 'ambre' };
  if (c.etat === 'perimee') return { texte: tr('adist.e.perimee'), ton: 'neutre' };
  return { texte: c.raison ? tr('adist.e.refuse', { raison: c.raison }) : tr('adist.e.refuseSans'), ton: 'ambre' };
}

// Une lecture de NOTRE base, projetée, hors de la mémoire partagée : `null` pas su · tableau.
const lireLignes = (chemin) => fetch(`${SUPABASE_URL}/rest/v1/app_data?${chemin}`, { headers: sbAuth(), cache: 'no-store', signal: signalFrais() })
  .then((r) => (r.ok ? r.json() : null)).then((x) => (Array.isArray(x) ? x : null)).catch(() => null);
// Lire `chemin` au montage, à chaque ligne signalée qui commence par `prefixe`, et sur « Relire » (le compteur `tour`).
function useLecture(cle, lire, prefixe) {
  const [v, setV] = React.useState(undefined);
  const ref = React.useRef(lire); ref.current = lire;
  const relire = React.useCallback(() => { if (!cle) return; Promise.resolve(ref.current()).then((x) => setV(x)).catch(() => setV(null)); }, [cle]);
  React.useEffect(() => { setV(undefined); relire(); }, [relire]);
  useSignal(prefixe || '\u0000', relire);
  return [v, relire];
}
function useBoite(compte) {
  const site = compte ? compte.site : '', id = compte ? compte.id : '';
  return useLecture(compte ? `boite:${site}:${id}` : '', async () => {
    if (site === 'vinted') { const r = await lireLignes(`id=eq.harvest_${encodeURIComponent(id)}_inbox&select=${selectBoite()}`); return r ? (r[0] ? conversationsDe(r[0]) : { capte: null, conversations: [] }) : null; }
    if (site === 'leboncoin') { const r = await lireLignes('id=like.lbc_fil_*&select=id,n:meta->>n,da:meta->>dernierAt,ap:meta->>apercu,dm:meta->>dernierDeMoi,compte:meta->>compte'); const l = filsLbcDe(r, id); return l ? { capte: null, conversations: l } : null; }
    const [r, m] = await Promise.all([lireLignes('id=like.vc_fil_*&select=id,n:meta->>n,da:meta->>dernierAt,ap:meta->>apercu'), lireLignes('id=eq.vc_messages&select=conversations:data->conversations,cap:data->>capturedAt')]);
    if (!r || !m) return null;
    const l = filsVcDe(r, m[0] && m[0].conversations, id);
    return l ? { capte: m[0] ? Date.parse(m[0].cap) || null : null, conversations: l } : null;
  }, site === 'vinted' ? `harvest_${id}_inbox` : site === 'leboncoin' ? 'lbc_fil_' : 'vc_');
}
function useFil(compte, conv) {
  const site = compte ? compte.site : '', id = compte ? compte.id : '';
  return useLecture(compte && conv ? `fil:${site}:${id}:${conv}` : '', async () => {
    if (site === 'vinted') { const r = await lireLignes(`id=eq.harvest_${encodeURIComponent(id)}_conv_${encodeURIComponent(conv)}&select=${SELECT_FIL}`); return r ? (r[0] ? filDe(r[0], id) : { vide: true, messages: [] }) : null; }
    const r = await lireLignes(`id=eq.${site === 'leboncoin' ? 'lbc_fil_' : 'vc_fil_'}${encodeURIComponent(conv)}&select=messages:data->messages,cap:data->>updatedAt`);
    if (!r) return null;
    const m = r[0] ? filAutreDe(r[0].messages) : null;
    return m && m.length ? { capte: Date.parse(r[0].cap) || null, tx: '', qui: '', peutRepondre: true, messages: m } : { vide: true, messages: [] };
  }, site === 'vinted' ? `harvest_${id}_conv_${conv}` : `${site === 'leboncoin' ? 'lbc_fil_' : 'vc_fil_'}${conv}`)[0];
}
// Les annonces d'un compte : Vinted par pages de 15 (projetées), Leboncoin et Vestiaire leur ligne (petite).
function useAnnonces(compte, pages) {
  const site = compte ? compte.site : '', id = compte ? compte.id : '';
  return useLecture(compte ? `annonces:${site}:${id}:${pages}` : '', async () => {
    if (site === 'vinted') {
      const fiches = load('vinted_annonce_numeros', {}) || {}, achatParNum = load('vinted_buyprice_by_num', {}) || {};
      const morceaux = await Promise.all(Array.from({ length: pages }, (_, k) => lireLignes(`id=eq.harvest_${encodeURIComponent(id)}_listings&select=${selectAnnoncesVinted(k * MIROIR_N)}`)));
      if (morceaux.some((x) => x === null)) return null;
      if (!morceaux[0][0]) return { capte: null, items: [], suite: false };
      const lus = morceaux.map((r, k) => annoncesVintedDe(r[0], { uid: id, debut: k * MIROIR_N, fiches, achatParNum }));
      return { capte: lus[0].capte, items: lus.flatMap((x) => x.items), suite: lus[lus.length - 1].suite };
    }
    if (site === 'leboncoin') {
      const [r, c] = await Promise.all([lireLignes('id=eq.lbc_listings&select=items:data->items,cap:data->>updatedAt'), lireLignes('id=eq.lbc_accounts&select=a:data->accounts')]);
      if (!r || !c) return null;
      const n = c[0] && c[0].a && typeof c[0].a === 'object' ? Object.keys(c[0].a).length : 1;
      const l = annoncesLbcDe(r[0] ? r[0].items : {}, { nComptes: Math.max(1, n) });
      return l ? { capte: r[0] ? Date.parse(r[0].cap) || null : null, ...l } : null;
    }
    const r = await lireLignes('id=eq.vc_listings&select=items:data->items,cap:data->>capturedAt');
    if (!r) return null;
    const l = annoncesVcDe(r[0] ? r[0].items : {}, { compte: id });
    return l ? { capte: r[0] ? Date.parse(r[0].cap) || null : null, ...l } : null;
  }, site === 'vinted' ? `harvest_${id}_listings` : site === 'leboncoin' ? 'lbc_listings' : 'vc_listings');
}
function useVentes(compte) {
  const id = compte && compte.site === 'vinted' ? compte.id : '';
  return useLecture(id ? `ventes:${id}` : '', async () => {
    const r = await lireLignes(`id=eq.harvest_${encodeURIComponent(id)}_orders_sold&select=${selectVentesVinted(0)}`);
    if (!r) return null;
    const v = r[0] ? ventesVintedDe(r[0], { aExpedier }) : { capte: null, ventes: [] };
    // Les bordereaux DÉJÀ rangés avec leur PDF (projection scalaire : `meta->>_pdf`, jamais le PDF).
    const env = v.ventes.filter((x) => x.groupe === 'envoyer');
    if (env.length) {
      const b = await lireLignes(`id=in.(${env.map((x) => `harvest_${id}_label_${x.tx}`).join(',')})&meta->>_pdf=eq.true&select=id`);
      const prets = new Set((b || []).map((x) => String(x.id).replace(/^.*_label_/, '')));
      for (const x of v.ventes) x.pdf = b ? prets.has(x.tx) : null;
    }
    return v;
  }, id ? `harvest_${id}_orders_sold` : '');
}

// Le PDF d'un bordereau, ouvert SUR CE TÉLÉPHONE : la fenêtre est ouverte au toucher (iPhone : sinon elle est bloquée),
// le fichier y arrive quand il est lu. Pas de PDF ⇒ rien d'inventé, c'est dit.
async function ouvrirBordereau(uid, tx, dire) {
  let w = null; try { w = window.open('', '_blank'); } catch (_) { w = null; }
  const r = await lirePdfLigne(`harvest_${uid}_label_${tx}`).catch(() => null);
  if (!r || !r.octets) { try { if (w) w.close(); } catch (_) {} dire(r && r.absent ? tr('adist.bord.absent') : tr('adist.base')); return false; }
  const url = URL.createObjectURL(new Blob([r.octets], { type: 'application/pdf' }));
  try { if (w) w.location.href = url; else window.location.href = url; } catch (_) {}
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 120000);
  return true;
}

// ── Le fil d'une conversation, la réponse, les offres (Vinted) ──────────────
function Fil({ compte, conv, envoyer, demanderAccepter, maintenant, gestes = [], ordis, calmer = () => {} }) {
  const f = useFil(compte, conv);
  const site = compte.site, uid = compte.id;
  const [texte, setTexte] = React.useState('');
  const [contre, setContre] = React.useState(null);   // { tx, prix }
  if (f === undefined) return <Attente forme="rangees" n={3}/>;
  if (f === null) return <Groupe><Rangee titre="—" sousTitre={tr('adist.fil.passu')} attrs={{ 'data-adist-fil': 'passu' }}/></Groupe>;
  if (f.vide) return <Groupe><Rangee titre={tr('adist.fil.vide')} lignes={2} attrs={{ 'data-adist-fil': 'vide' }}/></Groupe>;
  const envoyerTexte = () => { const t = texte.trim(); if (!t) return; envoyer({ geste: 'repondre', site, compte: uid, args: { conv, texte: t } }).then((ok) => { if (ok) setTexte(''); }); };
  // Les gestes envoyés d'ici pour CETTE conversation (ou sa transaction) : leur état, sans quitter le fil.
  const ici = gestes.filter((c) => c.site === site && c.compte === String(uid) && (c.cle.includes(`:${conv}:`) || (f.tx && c.cle.includes(`:${f.tx}`))) && c.etat !== 'annulee').slice(0, 4);
  return (
    <>
      {ici.length ? (
        <Groupe titre={tr('adist.groupe.file')} attrs={{ 'data-adist-fil-gestes': '' }}>
          {ici.map((c) => { const ph = phraseEtat(c, ordis, maintenant); return <Rangee key={c.id} titre={tr('adist.g.' + c.geste)} sousTitre={ph.texte} sousLignes={2} ton={ph.ton} valeur={heureLoc(c.finiLe || c.prisLe || c.demandeLe)} attrs={{ 'data-adist-fil-geste': c.id, 'data-adist-etat': c.etat }}/>; })}
        </Groupe>
      ) : null}
      <Groupe titre={f.qui || ''} pied={f.capte ? tr('adist.fil.lu', { age: ilYa(f.capte, maintenant) }) : ''} attrs={{ 'data-adist-fil': conv }}>
        <div className="n-adist-fil">
          {f.messages.map((m, i) => m.sorte === 'offre' ? (
            <div key={'o' + m.id + i} className="n-adist-bulle n-adist-offre" data-moi={m.moi ? '1' : '0'} data-adist-offre={m.id} data-adist-offre-attente={m.enAttente ? '1' : '0'}>
              <span>{tr(m.enAttente && !m.moi ? 'adist.fil.offreAttente' : 'adist.fil.offre', { prix: eur(m.prix) })}</span>
              {m.statut && !m.enAttente ? <span className="n-adist-statut">{m.statut}</span> : null}
              {m.enAttente && !m.moi && f.tx ? (
                <span className="n-adist-gestes">
                  <Bouton variante="teinte" taille="compact" onClick={() => demanderAccepter({ tx: f.tx, oid: m.id, prix: m.prix, conv })} attrs={{ 'data-adist-geste': 'accepter' }}>{tr('adist.offre.accepter', { prix: eur(m.prix) })}</Bouton>
                  <Bouton variante="texte" taille="compact" onClick={() => envoyer({ geste: 'refuser', site: 'vinted', compte: uid, args: { tx: f.tx, oid: m.id, conv } })} attrs={{ 'data-adist-geste': 'refuser' }}>{tr('adist.offre.refuser')}</Bouton>
                  <Bouton variante="texte" taille="compact" onClick={() => { calmer(); setContre({ tx: f.tx, prix: m.prix != null ? String(Math.round(m.prix)) : '' }); }} attrs={{ 'data-adist-geste': 'contre' }}>{tr('adist.offre.contre')}</Bouton>
                </span>
              ) : null}
            </div>
          ) : (
            <div key={'m' + m.id + i} className="n-adist-bulle" data-moi={m.moi ? '1' : '0'}>{m.texte}</div>
          ))}
        </div>
      </Groupe>
      {f.peutRepondre ? (
        <div className="n-adist-reponse" data-adist-reponse="">
          <label className="n-champ"><span className="n-champ-libelle">{tr('adist.fil.repondre')}</span>
            <textarea className="n-adist-saisie" rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={site === 'vestiaire' ? 1000 : 2000} data-adist-saisie=""/></label>
          <div className="n-adist-envoyer"><Bouton variante="teinte" indisponible={!texte.trim()} onClick={envoyerTexte} attrs={{ 'data-adist-envoyer': '' }}>{tr('adist.fil.envoyer')}</Bouton></div>
        </div>
      ) : <Groupe><Rangee titre={tr('adist.fil.pasRepondre')} lignes={2}/></Groupe>}
      <Feuille ouverte={!!contre} onFermer={() => setContre(null)} titre={tr('adist.offre.contre')}
        pied={<Bouton variante="plein" indisponible={!(Number(String(contre && contre.prix).replace(',', '.')) >= 1)} onClick={() => { const p = Number(String(contre.prix).replace(',', '.')); envoyer({ geste: 'contreOffre', site: 'vinted', compte: uid, args: { tx: contre.tx, prix: p, conv } }); setContre(null); }} attrs={{ 'data-adist-contre-envoyer': '' }}>{tr('adist.fil.envoyer')}</Bouton>}>
        <Champ libelle={tr('adist.offre.contrePrix')} valeur={contre ? contre.prix : ''} onChange={(x) => setContre((c) => ({ ...c, prix: x }))} inputMode="decimal" suffixe="€" attrs={{ 'data-adist-contre-prix': '' }}/>
      </Feuille>
    </>
  );
}

// ── Une annonce : ses gestes (prix, masquer / afficher, republier) ──────────
const GESTES_ANNONCE = { vinted: ['prix', 'masquer', 'republier'], leboncoin: ['prix'], vestiaire: ['prix'] };
function FeuilleAnnonce({ compte, a, envoyer, onFermer, gestes, ordis, maintenant }) {
  const [saisie, setSaisie] = React.useState('');
  const [prixOuvert, setPrixOuvert] = React.useState(false);
  React.useEffect(() => { setSaisie(a && a.prix != null ? String(Math.max(1, Math.floor(a.prix * 0.95))) : ''); setPrixOuvert(false); }, [a && a.id]);
  if (!a) return <Feuille ouverte={false} onFermer={onFermer} titre=""/>;
  const site = compte.site, permis = GESTES_ANNONCE[site] || [];
  const v = prixVoulu(saisie, { prix: a.prix, plancher: a.plancher });
  const plancherTxt = a.plancher ? tr(a.plancher.de === 'mini' ? 'adist.prix.plancherMini' : 'adist.prix.plancherAchat', { prix: eur(a.plancher.c / 100) }) : tr('adist.prix.sansPlancher');
  const raison = v.ok ? '' : tr('adist.prix.r.' + v.raison, { prix: eur((v.plancherC || 0) / 100) });
  const envoyerPrix = () => { if (!v.ok) return; envoyer({ geste: 'prix', site, compte: compte.id, args: { id: a.id, prix: v.c / 100, prixAvant: a.prix }, avant: a.prix, num: a.num }); onFermer(); };
  const masquer = () => { envoyer({ geste: a.etat === 'masquee' ? 'afficher' : 'masquer', site, compte: compte.id, args: { id: a.id }, num: a.num }); onFermer(); };
  const republier = () => { envoyer({ geste: 'republier', site, compte: compte.id, args: { id: a.id }, confirme: true, num: a.num }); onFermer(); };
  const enCours = gestes.filter((c) => c.site === site && c.compte === compte.id && c.cle.endsWith(':' + a.id) && (c.etat === 'attente' || c.etat === 'pris'));
  return (
    <Feuille ouverte onFermer={onFermer} titre={(a.num ? 'N°' + a.num + ' · ' : '') + a.titre} attrs={{ 'data-adist-feuille-annonce': a.id }}
      pied={prixOuvert ? <Bouton variante="plein" indisponible={!v.ok} raison={raison} onClick={envoyerPrix} attrs={{ 'data-adist-prix-envoyer': '' }}>{v.ok ? tr('adist.prix.envoyer', { avant: eur(a.prix), apres: eur(v.c / 100) }) : tr('adist.g.prix')}</Bouton> : null}>
      {enCours.length ? <Groupe>{enCours.map((c) => <Rangee key={c.id} titre={tr('adist.g.' + c.geste)} sousTitre={phraseEtat(c, ordis, maintenant).texte} sousLignes={2} attrs={{ 'data-adist-annonce-geste': c.etat }}/>)}</Groupe> : null}
      {prixOuvert ? (
        <>
          <Groupe pied={plancherTxt}><Rangee titre={tr('adist.prix.vu')} valeur={eur(a.prix)} valeurForte attrs={{ 'data-adist-prix-vu': String(a.prix) }}/></Groupe>
          <Champ libelle={tr('adist.prix.nouveau')} valeur={saisie} onChange={setSaisie} inputMode="decimal" suffixe="€" attrs={{ 'data-adist-prix-saisie': '' }}/>
        </>
      ) : (
        <Groupe>
          {permis.includes('prix') && a.prix != null ? <Rangee titre={tr('adist.g.prix')} sousTitre={plancherTxt} valeur={eur(a.prix)} fin="chevron" onClick={() => setPrixOuvert(true)} attrs={{ 'data-adist-annonce-prix': a.id }}/> : null}
          {permis.includes('masquer') ? <Rangee titre={tr(a.etat === 'masquee' ? 'adist.g.afficher' : 'adist.g.masquer')} sousTitre={tr(a.etat === 'masquee' ? 'adist.annonce.afficherSous' : 'adist.annonce.masquerSous')} onClick={masquer} attrs={{ 'data-adist-annonce-masquer': a.etat === 'masquee' ? 'afficher' : 'masquer' }}/> : null}
          {permis.includes('republier') ? <div className="n-adist-destructif"><Bouton variante="destructif" large confirmation={tr('adist.annonce.republierConfirme')} onClick={republier} raison={tr('adist.annonce.republierSous')} attrs={{ 'data-adist-annonce-republier': a.id }}>{tr('adist.g.republier')}</Bouton></div> : null}
        </Groupe>
      )}
    </Feuille>
  );
}
function FeuilleVente({ compte, v, envoyer, onFermer, dire, gestes, ordis, maintenant }) {
  if (!v) return <Feuille ouverte={false} onFermer={onFermer} titre=""/>;
  const cmd = gestes.find((c) => c.geste === 'bordereau' && c.compte === compte.id && c.cle.endsWith(':' + v.tx));
  const pret = v.pdf === true || (cmd && cmd.etat === 'fait' && cmd.pdf);
  const enVol = cmd && (cmd.etat === 'attente' || cmd.etat === 'pris');
  return (
    <Feuille ouverte onFermer={onFermer} titre={v.titre} attrs={{ 'data-adist-feuille-vente': v.tx }}
      pied={pret ? <Bouton variante="plein" onClick={() => ouvrirBordereau(compte.id, v.tx, dire)} attrs={{ 'data-adist-bord-ouvrir': v.tx }}>{tr('adist.bord.ouvrir')}</Bouton>
        : <Bouton variante="plein" chargement={!!enVol} onClick={() => { if (!enVol) envoyer({ geste: 'bordereau', site: 'vinted', compte: compte.id, args: { tx: v.tx } }); }} attrs={{ 'data-adist-bord-generer': v.tx }}>{tr('adist.bord.generer')}</Bouton>}>
      <Groupe>
        <Rangee titre={v.statut || '—'} valeur={eur(v.prix)} sousTitre={v.date ? dateLoc(v.date, { day: 'numeric', month: 'long' }) : ''}/>
        {cmd ? <Rangee titre={tr('adist.g.bordereau')} sousTitre={phraseEtat(cmd, ordis, maintenant).texte} sousLignes={2} attrs={{ 'data-adist-bord-etat': cmd.etat }}/> : null}
        {v.pdf === null ? <Rangee titre="—" sousTitre={tr('adist.bord.passu')}/> : null}
      </Groupe>
    </Feuille>
  );
}

const ETATS_ANNONCE = ['enligne', 'pause', 'masquee', 'reservee', 'expiree'];
function PageCompte({ compte, ordis, maintenant, envoyer, demanderAccepter, onRetour, gestes, calmer, dire }) {
  const [conv, setConv] = React.useState(null);
  const [vue, setVue] = React.useState('messages');
  const [pages, setPages] = React.useState(1);
  const [annonce, setAnnonce] = React.useState(null);
  const [vente, setVente] = React.useState(null);
  const [groupeV, setGroupeV] = React.useState('envoyer');
  React.useEffect(() => { setVue('messages'); setPages(1); setConv(null); }, [compte && compte.site, compte && compte.id]);
  const site = compte ? compte.site : '';
  const [boite] = useBoite(compte && vue === 'messages' ? compte : null);
  const [annonces] = useAnnonces(compte && vue === 'annonces' ? compte : null, pages);
  const [ventes] = useVentes(compte && vue === 'ventes' ? compte : null);
  const p = compte ? ordinateurPour(ordis.allumes, compte.site, compte.id) : null;
  const vues = site === 'vinted' ? ['messages', 'annonces', 'ventes'] : ['messages', 'annonces'];
  const lu = (x) => (x && x.capte ? tr('adist.miroir.lu', { age: ilYa(x.capte, maintenant) }) : '');
  const listeVentes = ventes && Array.isArray(ventes.ventes) ? ventes.ventes.filter((x) => x.groupe === groupeV) : [];
  const nV = (g) => (ventes && Array.isArray(ventes.ventes) ? ventes.ventes.filter((x) => x.groupe === g).length : undefined);
  return (
    <>
      <PagePoussee ouverte={!!compte && !conv} titre={compte ? compte.nom || compte.id : ''} libelleRetour={tr('adist.titre')} onRetour={onRetour} attrs={{ 'data-adist-page-compte': compte ? `${compte.site}:${compte.id}` : '' }}>
        {compte ? (
          <>
            <Groupe titre={tr('adist.groupe.actions')}>
              <Rangee titre={NOMS_SITES[compte.site]} sousTitre={p && p.ouvert ? tr('adist.compte.ouvertSur', { nom: nomOrdi(p.p) }) : tr('adist.compte.pasOuvert')} ton={p && p.ouvert ? 'neutre' : 'ambre'}/>
              {['vinted', 'leboncoin'].includes(compte.site) ? <Rangee titre={tr('adist.relire')} sousTitre={compte.lu ? tr('adist.compte.lu', { age: ilYa(compte.lu, maintenant) }) : tr('adist.compte.jamaisLu')} fin="chevron"
                onClick={() => envoyer({ geste: 'relire', site: compte.site, compte: compte.id, args: {} })} attrs={{ 'data-adist-relire': `${compte.site}:${compte.id}` }}/> : null}
            </Groupe>
            <div className="n-adist-segment"><Segmente libelle={compte.nom || compte.id} valeur={vue} onChange={setVue} options={vues.map((k) => ({ cle: k, libelle: tr('adist.vue.' + k), attrs: { 'data-adist-vue': k } }))}/></div>
            {vue === 'messages' ? (
              <Groupe pied={lu(boite)} attrs={{ 'data-adist-boite': compte.id }}>
                {boite === undefined ? <Attente forme="rangees" n={4}/> : boite === null ? <Rangee titre="—" sousTitre={tr('adist.messages.passu')}/>
                  : !boite.conversations.length ? <Rangee titre={tr('adist.messages.vide')} lignes={2}/>
                  : boite.conversations.map((c) => <Rangee key={c.id} titre={c.qui || NOMS_SITES[site]} sousTitre={c.texte} valeur={c.at ? ilYa(c.at, maintenant) : ''} valeurForte={c.nonLu}
                    ton={c.nonLu ? 'ambre' : 'neutre'} fin="chevron" onClick={() => setConv(c.id)} attrs={{ 'data-adist-conv': c.id, 'data-adist-non-lu': c.nonLu ? '1' : '0' }}/>)}
              </Groupe>
            ) : vue === 'annonces' ? (
              <Groupe pied={lu(annonces)} attrs={{ 'data-adist-annonces': compte.id }}>
                {annonces === undefined ? <Attente forme="rangees" n={5}/> : annonces === null ? <Rangee titre="—" sousTitre={tr('adist.miroir.passu')}/>
                  : annonces.inconnu ? <Rangee titre="—" sousTitre={tr('adist.miroir.lbcComptes')} sousLignes={2}/>
                  : !annonces.items.length ? <Rangee titre={tr('adist.miroir.vide')} lignes={2}/>
                  : annonces.items.map((a) => <Rangee key={a.id} vignette={a.photo ? <Vignette src={a.photo} alt="" taille={44}/> : null}
                    titre={[a.titre, a.taille].filter(Boolean).join(' · ')} sousTitre={[a.num ? 'N°' + a.num : '', tr('adist.etat.' + (ETATS_ANNONCE.includes(a.etat) ? a.etat : 'enligne'))].filter(Boolean).join(' · ')}
                    valeur={eur(a.prix)} fin="chevron" onClick={() => { calmer(); setAnnonce(a); }}
                    actions={site === 'vinted' ? [{ cle: 'masquer', libelle: tr(a.etat === 'masquee' ? 'adist.g.afficher' : 'adist.g.masquer'), ton: 'neutre', onClick: () => envoyer({ geste: a.etat === 'masquee' ? 'afficher' : 'masquer', site, compte: compte.id, args: { id: a.id }, num: a.num }) }] : null}
                    attrs={{ 'data-adist-annonce': a.id, 'data-adist-annonce-etat': a.etat }}/>)}
                {annonces && annonces.suite ? <Rangee titre={tr('adist.miroir.plus')} fin="chevron" onClick={() => setPages((n) => n + 1)} attrs={{ 'data-adist-annonces-plus': '' }}/> : null}
              </Groupe>
            ) : (
              <>
                <div className="n-adist-segment"><Segmente libelle={tr('adist.vue.ventes')} valeur={groupeV} onChange={setGroupeV}
                  options={['envoyer', 'route', 'terminees'].map((k) => ({ cle: k, libelle: tr('adist.ventes.' + k), n: nV(k) || undefined, attrs: { 'data-adist-ventes-seg': k } }))}/></div>
                <Groupe pied={lu(ventes)} attrs={{ 'data-adist-ventes': compte.id }}>
                  {ventes === undefined ? <Attente forme="rangees" n={4}/> : ventes === null ? <Rangee titre="—" sousTitre={tr('adist.miroir.passu')}/>
                    : !listeVentes.length ? <Rangee titre={tr('adist.file.vide')}/>
                    : listeVentes.map((v) => <Rangee key={v.tx} vignette={v.photo ? <Vignette src={v.photo} alt="" taille={44}/> : null} titre={v.titre || '—'}
                      sousTitre={[v.statut, v.groupe === 'envoyer' ? tr(v.pdf ? 'adist.bord.pret' : 'adist.bord.aGenerer') : ''].filter(Boolean).join(' · ')} ton={v.groupe === 'envoyer' ? 'ambre' : 'neutre'}
                      valeur={eur(v.prix)} fin={v.groupe === 'envoyer' ? 'chevron' : null} onClick={v.groupe === 'envoyer' ? () => { calmer(); setVente(v); } : null}
                      attrs={{ 'data-adist-vente': v.tx, 'data-adist-vente-groupe': v.groupe, 'data-adist-vente-pdf': v.pdf ? '1' : '0' }}/>)}
                </Groupe>
              </>
            )}
          </>
        ) : null}
      </PagePoussee>
      <PagePoussee ouverte={!!compte && !!conv} titre={tr('adist.groupe.messages')} libelleRetour={compte ? compte.nom || compte.id : ''} onRetour={() => setConv(null)} attrs={{ 'data-adist-page-fil': conv || '' }}>
        {compte && conv ? <Fil compte={compte} conv={conv} envoyer={envoyer} demanderAccepter={demanderAccepter} maintenant={maintenant} gestes={gestes} ordis={ordis} calmer={calmer}/> : null}
      </PagePoussee>
      {compte ? <FeuilleAnnonce compte={compte} a={annonce} envoyer={envoyer} onFermer={() => setAnnonce(null)} gestes={gestes} ordis={ordis} maintenant={maintenant}/> : null}
      {compte ? <FeuilleVente compte={compte} v={vente} envoyer={envoyer} onFermer={() => setVente(null)} dire={dire} gestes={gestes} ordis={ordis} maintenant={maintenant}/> : null}
    </>
  );
}

// `comptesVinted` : la table `vinted_accounts` du vendeur (undefined = on lit) ; `ecarte(uid)` : un compte retiré de ses totaux.
export default function EcranADistance({ comptesVinted, ecarte = () => false, onNav = null }) {
  if (!iconePosee()) poserIcone(Icon);
  const maintenant = useMaintenant();
  const rt = useTempsReel();
  const presences = usePresences();
  const [file, relireFile, ajouter, retirer] = useFile(rt);
  const [autres] = useComptesAutresSites(true);
  const [lus, setLus] = React.useState(undefined);
  const [seg, setSeg] = React.useState('attente');
  const [guide, setGuide] = React.useState(false);
  const [ouvert, setOuvert] = React.useState(null);
  const [aAccepter, setAAccepter] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [aAnnuler, setAAnnuler] = React.useState(null);
  // La fraîcheur des comptes : `undefined` on lit · `null` pas su (relue 5 s plus tard, jamais « jamais relu ») · { uid: ms }.
  const lireLus = React.useCallback((force) => lireCapturesDetail(force ? { force: true } : undefined).then((d) => setLus(d ? d.by : null)).catch(() => setLus(null)), []);
  React.useEffect(() => { lireLus(false); }, [lireLus]);
  React.useEffect(() => { if (lus !== null) return undefined; const t = setTimeout(() => lireLus(true), 5000); return () => clearTimeout(t); }, [lus, lireLus]);
  const lusAt = React.useRef(0);
  useSignal('harvest_', () => { if (Date.now() - lusAt.current < 30000) return; lusAt.current = Date.now(); lireLus(true); });   // une capture neuve : relue, 30 s au plus souvent
  const ordis = etatOrdinateurs(presences, maintenant);
  const g = groupesFile(Array.isArray(file) ? file : [], maintenant);
  // Le premier groupe qui a quelque chose, tant qu'il n'a rien choisi.
  const segVu = React.useRef(false);
  React.useEffect(() => { if (segVu.current || !Array.isArray(file)) return; segVu.current = true; const k = ['cours', 'attente', 'refuse', 'fait'].find((x) => g[x].length); if (k) setSeg(k); }, [file]);
  // Le geste qu'il vient d'envoyer est SUIVI : la file montre le groupe où il est (En attente → En cours → Fait / Refusé).
  const [suivi, setSuivi] = React.useState('');
  React.useEffect(() => {
    if (!suivi || !Array.isArray(file)) return;
    const c = file.find((x) => x.id === suivi); if (!c) return;
    const k = c.etat === 'attente' ? 'attente' : c.etat === 'pris' ? 'cours' : c.etat === 'fait' ? 'fait' : c.etat === 'annulee' ? '' : 'refuse';
    if (k) setSeg(k);
    if (k === 'fait' || k === 'refuse' || !k) setSuivi('');
  }, [file, suivi]);

  // Les comptes, toutes plateformes (un compte retiré n'est pas montré).
  const colis = load('vrm_colis_aposter', null);
  const parCompte = colis && colis.parCompte && typeof colis.parCompte === 'object' ? colis.parCompte : null;
  const comptes = [
    ...(Array.isArray(comptesVinted) ? comptesVinted : []).filter((a) => a && a.vinted_user_id != null && !ecarte(String(a.vinted_user_id)))
      .map((a) => ({ site: 'vinted', id: String(a.vinted_user_id), nom: String(a.login || ''), lu: lus ? lus[String(a.vinted_user_id)] || null : null, luSu: !!lus,
        aEnvoyer: parCompte ? Number(parCompte[String(a.vinted_user_id)] || 0) : null })),
    ...(Array.isArray(autres && autres.leboncoin) ? autres.leboncoin : []).map((c) => ({ site: 'leboncoin', id: String(c.id), nom: nomCompteLie(c), lu: Number(c.lu) || Date.parse(c.lu) || null, luSu: true, aEnvoyer: null })),
    ...(Array.isArray(autres && autres.vestiaire) ? autres.vestiaire : []).filter((c) => !c.nonIdentifie).map((c) => ({ site: 'vestiaire', id: String(c.id), nom: nomCompteLie(c), lu: Number(c.lu) || Date.parse(c.lu) || null, luSu: true, aEnvoyer: null })),
  ];

  // UN geste ⇒ une commande, déposée et montrée tout de suite. true = partie vers la base.
  const envoyer = async ({ geste, site, compte, args, confirme = false, avant = null, num = '' }) => {
    const owner = AUTH.user && AUTH.user.id;
    const c = nouvelleCommandeDistance({ geste, site, compte, args, owner, confirme, avant, num, alea: alea() });
    if (!c) { setToast({ id: Date.now(), message: tr('adist.base') }); return false; }
    ajouter(c);
    const r = await deposerCommandeDistance(dep(), c).catch(() => null);
    if (!r) { retirer(c.id); setToast({ id: Date.now(), message: tr('adist.base') }); return false; }
    if (r.deja) { retirer(c.id); setToast({ id: Date.now(), message: tr('adist.deja') }); relireFile(); return false; }
    setSeg('attente'); setSuivi(c.id);
    setToast({ id: c.id, message: geste === 'relire' ? tr('adist.relireEnvoye') : tr('adist.envoyeToast'), annuler: c.id });
    relireFile();
    return true;
  };
  const annuler = async (id) => {
    const r = await annulerCommandeDistance(dep(), id).catch(() => null);
    if (r === true) { retirer(id); setToast({ id: Date.now(), message: tr('adist.annule') }); } else setToast({ id: Date.now(), message: r === false ? tr('adist.annulePas') : tr('adist.base') });
    relireFile();
  };

  const ligneOrdi = (p) => {
    const noms = p.comptes.map((c) => (c.nom || c.id) + (c.site !== 'vinted' ? ' (' + NOMS_SITES[c.site] + ')' : ''));
    const vieux = p.ver && /^\d+\.\d+\.\d+$/.test(p.ver) && p.ver.localeCompare('5.436.0', undefined, { numeric: true }) < 0;
    const titre = p.allume ? (noms.length ? tr('adist.ordi.allumeComptes', { nom: nomOrdi(p), comptes: noms.join(', ') }) : tr('adist.ordi.allume', { nom: nomOrdi(p) }))
      : (maintenant - p.atMs < 20 * 3600000 ? tr('adist.ordi.eteint', { nom: nomOrdi(p), heure: heureLoc(p.atMs) }) : tr('adist.ordi.eteintJour', { nom: nomOrdi(p), date: dateLoc(p.atMs, { day: 'numeric', month: 'long' }) }));
    const sous = [vieux ? tr('adist.ordi.ancien', { v: p.ver }) : '', p.allume && !noms.length ? tr('adist.ordi.aucunCompte') : '', p.enCours ? tr('adist.ordi.enCours') : '', tr('adist.ordi.vu', { age: ilYa(p.atMs, maintenant) })].filter(Boolean).join(' · ');
    return <Rangee key={p.id} titre={titre} lignes={2} sousTitre={sous} sousLignes={2} ton={!p.allume || vieux ? 'ambre' : 'neutre'}
      attrs={{ 'data-adist-ordi': p.id, 'data-adist-allume': p.allume ? '1' : '0' }}/>;
  };

  const liste = g[seg] || [];
  const nomCompte = (c) => { const x = comptes.find((k) => k.site === c.site && k.id === c.compte); return (x && x.nom) || c.compte; };
  return (
    <Page titre={tr('adist.titre')} attrs={{ 'data-ecran-adistance': '', 'data-adist-ordis': ordis.niveau, 'data-adist-rt': rt || 'absent' }}>
      <Groupe titre={tr('adist.groupe.ordis')} attrs={{ 'data-adist-groupe': 'ordis' }}>
        {ordis.niveau === 'lecture' ? <Rangee titre={tr('adist.ordi.lecture')}/>
          : ordis.niveau === 'passu' ? <Rangee titre="—" sousTitre={tr('adist.ordi.passu')}/>
          : ordis.niveau === 'aucun' ? <Rangee titre={tr('adist.ordi.aucun')} sousTitre={tr('adist.ordi.aucunSous')} sousLignes={2} ton="ambre" attrs={{ 'data-adist-ordi': 'aucun' }}/>
          : [...ordis.allumes, ...ordis.eteints].slice(0, 6).map(ligneOrdi)}
        {ordis.niveau === 'allume' ? <Rangee titre={rt === 'joint' ? tr('adist.rt.joint') : tr('adist.rt.sondage')} lignes={2} attrs={{ 'data-adist-temps-reel': rt === 'joint' ? 'joint' : 'sondage' }}/> : null}
        <Rangee titre={tr('adist.guide.titre')} fin={guide ? null : 'chevron'} onClick={() => setGuide((x) => !x)} attrs={{ 'data-adist-guide': guide ? '1' : '0', 'aria-expanded': guide ? 'true' : 'false' }}/>
        {guide ? ['chrome', 'windows', 'mac', 'veille', 'comptes'].map((k) => <Rangee key={k} titre={tr('adist.guide.' + k)} lignes={2} attrs={{ 'data-adist-guide-ligne': k }}/>) : null}
      </Groupe>

      <Groupe titre={tr('adist.groupe.file')} pied={tr('adist.file.pied')} attrs={{ 'data-adist-groupe': 'file' }}>
        <div className="n-adist-segment">
          <Segmente libelle={tr('adist.groupe.file')} valeur={seg} onChange={setSeg} options={['attente', 'cours', 'fait', 'refuse'].map((k) => ({ cle: k, libelle: tr('adist.file.' + k), n: g[k].length || undefined, attrs: { 'data-adist-seg': k } }))}/>
        </div>
        {file === undefined ? <Attente forme="rangees" n={2}/> : !liste.length ? <Rangee titre={tr('adist.file.vide')} attrs={{ 'data-adist-file-vide': seg }}/>
          : liste.slice(0, 40).map((c) => {
            const ph = phraseEtat(c, ordis, maintenant);
            return <Rangee key={c.id} titre={`${c.num ? 'N°' + c.num + ' · ' : ''}${tr('adist.g.' + c.geste)} · ${nomCompte(c)}`} sousTitre={ph.texte} sousLignes={2} ton={ph.ton}
              valeur={heureLoc(c.finiLe || c.prisLe || c.demandeLe)} fin={c.etat === 'attente' ? 'chevron' : null}
              onClick={c.etat === 'attente' ? () => { setToast(null); setAAnnuler(c); } : null}
              actions={c.etat === 'attente' ? [{ cle: 'annuler', libelle: tr('adist.annuler'), ton: 'neutre', onClick: () => annuler(c.id) }] : null}
              attrs={{ 'data-adist-cmd': c.id, 'data-adist-etat': c.etat, 'data-adist-geste': c.geste }}/>;
          })}
      </Groupe>

      <Groupe titre={tr('adist.groupe.comptes')} attrs={{ 'data-adist-groupe': 'comptes' }}>
        {comptesVinted === undefined ? <Attente forme="rangees" n={3}/> : comptes.map((c) => {
          const p = ordinateurPour(ordis.allumes, c.site, c.id);
          const vieux = c.luSu && (!c.lu || maintenant - c.lu > VIEUX_MS);   // pas su ⇒ ni « vieux » ni « jamais relu »
          const sous = [p && p.ouvert ? tr('adist.compte.ouvertSur', { nom: nomOrdi(p.p) }) : tr('adist.compte.pasOuvert'),
            !c.luSu ? (lus === null ? tr('adist.compte.luPasSu') : '') : c.lu ? (vieux ? tr('adist.compte.vieux', { age: ilYa(c.lu, maintenant) }) : tr('adist.compte.lu', { age: ilYa(c.lu, maintenant) })) : tr('adist.compte.jamaisLu'),
            c.aEnvoyer ? tr('adist.compte.aEnvoyer', { n: c.aEnvoyer }) : ''].filter(Boolean).join(' · ');
          return <Rangee key={`${c.site}:${c.id}`} titre={c.nom || c.id} sousTitre={sous} sousLignes={2} ton={vieux ? 'ambre' : 'neutre'} valeur={NOMS_SITES[c.site]} fin="chevron"
            onClick={() => setOuvert(c)}
            actions={vieux && ['vinted', 'leboncoin'].includes(c.site) ? [{ cle: 'relire', libelle: tr('adist.relire'), onClick: () => envoyer({ geste: 'relire', site: c.site, compte: c.id, args: {} }) }] : null}
            attrs={{ 'data-adist-compte': `${c.site}:${c.id}`, 'data-adist-vieux': vieux ? '1' : '0', 'data-adist-ouvert': p && p.ouvert ? '1' : '0' }}/>;
        })}
      </Groupe>

      <PageCompte gestes={Array.isArray(file) ? file : []} compte={ouvert} ordis={ordis} maintenant={maintenant} envoyer={envoyer} demanderAccepter={(a) => { setToast(null); setAAccepter(a); }} calmer={() => setToast(null)} onRetour={() => setOuvert(null)} dire={(m) => setToast({ id: Date.now(), message: m })}/>

      <Feuille ouverte={!!aAccepter} onFermer={() => setAAccepter(null)} titre={aAccepter ? tr('adist.offre.confirmeTitre', { prix: eur(aAccepter.prix) }) : ''}
        pied={<Bouton variante="plein" onClick={() => { const a = aAccepter; setAAccepter(null); envoyer({ geste: 'accepter', site: 'vinted', compte: ouvert && ouvert.id, args: { tx: a.tx, oid: a.oid, conv: a.conv, ...(a.prix != null ? { prix: a.prix } : {}) }, confirme: true }); }} attrs={{ 'data-adist-accepter-confirmer': '' }}>{tr('adist.offre.confirmer')}</Bouton>}>
        <Groupe><Rangee titre={tr('adist.offre.confirmeTexte')} lignes={2}/></Groupe>
      </Feuille>
      <Feuille ouverte={!!aAnnuler} onFermer={() => setAAnnuler(null)} titre={aAnnuler ? `${tr('adist.g.' + aAnnuler.geste)} · ${nomCompte(aAnnuler)}` : ''}
        pied={<Bouton variante="plein" onClick={() => { const a = aAnnuler; setAAnnuler(null); annuler(a.id); }} attrs={{ 'data-adist-annuler': '' }}>{tr('adist.annulerGeste')}</Bouton>}>
        {aAnnuler ? <Groupe><Rangee titre={phraseEtat(aAnnuler, ordis, maintenant).texte} lignes={2}/></Groupe> : null}
      </Feuille>
      {toast ? <Toast key={toast.id} message={toast.message} onAnnuler={toast.annuler ? () => annuler(toast.annuler) : undefined} onFin={() => setToast(null)}/> : null}
    </Page>
  );
}

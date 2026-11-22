// ── « REPRENDRE : … · OUVERT SUR L'IPHONE À 21:04 › » (22 nov., choix n° 23 de Julien) ────────────────────────────────
// La règle et la forme de la ligne : src/reprise.js. Ici : l'identifiant de CET appareil, la lecture, la publication, et
// la petite rangée en haut d'Aujourd'hui.
//
// · Publier : quand une fiche s'ouvre ICI (la coque appelle `publierOuvert`), une écriture comparer-et-échanger de
//   `vrm_reprise` (src/ligneCas.js : une lecture ratée n'écrit RIEN), 1,5 s après (un aller-retour rapide n'écrit pas).
// · Lire : une fois quand la session est là (`relireReprise`, la coque), puis à chaque retour sur l'app
//   (`visibilitychange`). Petite ligne (scalaires seulement) : lue entière, projetée sur `data`.
// · Montrer : Aujourd'hui annonce la lecture comme une donnée ESSENTIELLE (`useEssentiel`) — l'écran vrai ne paraît
//   qu'avec elle (bornée : 4 s ⇒ « pas su », rien n'est montré) ; la rangée ne s'insère donc jamais au-dessus d'un écran
//   déjà peint (aucun saut). Une lecture faite au RETOUR sur l'app (l'autre appareil vient de servir) peut l'ajouter.
// · Masquer : « × » (ou balayer) ⇒ cette entrée-là ne revient plus sur cet appareil (`reprise_masquee`, local).
import React from 'react';
import { tr } from './i18n/index.js';
import { lireLigne, modifierLigne } from './ligneCas.js';
import { LIGNE_REPRISE, CLE_APPAREIL, CLE_MASQUEE, formeAppareil, noterOuvert, aReprendre, cleMasquee } from './reprise.js';
import { useEssentiel, useEcranMontre } from './AttenteEcran.jsx';
import * as Natif from './natif/index.js';

const B = { ctx: null, icone: () => null };
// ctx() : { url, entetes, avecOwner, owner, cloisonne } (la coque, comme src/RepubProgramme.jsx `ctxLigne`).
export function brancherReprise(o = {}) { Object.assign(B, o); }

let _appareil = '';
export function appareilReprise() {
  if (_appareil) return _appareil;
  try { _appareil = localStorage.getItem(CLE_APPAREIL) || ''; } catch (_) { _appareil = ''; }
  if (!/^[a-z0-9]{8,24}$/.test(_appareil)) {
    let v = '';
    try { const a = new Uint8Array(9); crypto.getRandomValues(a); v = Array.from(a, (x) => (x % 36).toString(36)).join(''); } catch (_) { v = Math.random().toString(36).slice(2, 11); }
    _appareil = (v + 'a0a0a0a0').slice(0, 12);
    try { localStorage.setItem(CLE_APPAREIL, _appareil); } catch (_) {}
  }
  return _appareil;
}
const forme = () => { try { return formeAppareil(navigator.userAgent, navigator.maxTouchPoints); } catch (_) { return 'ordinateur'; } };

// ── La mémoire de la page : `undefined` en cours · `null` pas su · la donnée lue ──
const M = { data: undefined, ouvertIci: '', at: 0 };
const abonnes = new Set();
const prevenir = (raison) => { for (const f of abonnes) { try { f(raison); } catch (_) {} } };
let enCours = null;
export function relireReprise(raison = 'session') {
  const ctx = B.ctx ? B.ctx() : null;
  if (!ctx || !ctx.owner) { if (M.data === undefined) { M.data = null; prevenir(raison); } return Promise.resolve(null); }
  if (enCours) return enCours;
  enCours = (async () => {
    const borne = new Promise((ok) => setTimeout(() => ok('borne'), 4000));
    const lu = await Promise.race([lireLigne(LIGNE_REPRISE, ctx), borne]);
    enCours = null;
    if (lu === 'borne' || !lu) { if (M.data === undefined) { M.data = null; prevenir(raison); } return null; }
    M.data = lu.data || {}; M.at = Date.now(); prevenir(raison);
    return M.data;
  })();
  return enCours;
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && B.ctx && Date.now() - M.at > 20000) relireReprise('retour'); });
}

// La coque : une fiche vient de s'ouvrir ICI (ou de se fermer : `id` vide).
let minuterie = null;
export function publierOuvert({ ecran, id }) {
  M.ouvertIci = id ? String(id) : '';
  prevenir('ici');
  clearTimeout(minuterie);
  if (!id) return;
  const entree = { e: String(ecran || ''), t: 'fiche', id: String(id), at: Date.now(), f: forme() };
  minuterie = setTimeout(() => {
    const ctx = B.ctx ? B.ctx() : null;
    if (!ctx || !ctx.owner) return;
    modifierLigne(LIGNE_REPRISE, (d) => noterOuvert(d, appareilReprise(), entree, Date.now()), ctx).catch(() => null);
  }, 1500);
}

const lireMasquee = () => { try { return localStorage.getItem(CLE_MASQUEE) || ''; } catch (_) { return ''; } };
const heure = (ms) => { try { return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };

// La rangée. `titreDe(id)` : le titre de la paire dans les données de CET appareil (par son N°), ou ''.
// `onOuvrir(id)` : ouvre la fiche.
export function RepriseAppareil({ titreDe = () => '', onOuvrir }) {
  const montre = useEcranMontre();
  const [, rendre] = React.useReducer((n) => n + 1, 0);
  const [masquee, setMasquee] = React.useState(lireMasquee);
  // Ce qui est montré est FIGÉ une fois l'écran peint : seule une lecture du retour sur l'app (ou un geste ici) le change.
  const fige = React.useRef(undefined);
  React.useEffect(() => {
    const f = (raison) => { if (!montre || raison === 'retour' || raison === 'ici') fige.current = undefined; rendre(); };
    abonnes.add(f);
    if (M.data === undefined) relireReprise('session');
    return () => { abonnes.delete(f); };
  }, [montre]);
  useEssentiel('reprise', M.data);
  let r = null;
  if (M.data) r = aReprendre(M.data, appareilReprise(), { maintenant: Date.now(), masquee, ouvertIci: M.ouvertIci });
  if (montre) { if (fige.current === undefined) fige.current = r; else if (fige.current && !r) fige.current = null; r = fige.current; }
  if (!r) return null;
  const Icon = B.icone ? B.icone() : null;
  const titre = String(titreDe(r.id) || '').trim() || tr('af.rep.numero', { n: r.id });
  const sur = tr('af.rep.sur.' + r.f);
  const masquer = () => { const k = cleMasquee(r); try { localStorage.setItem(CLE_MASQUEE, k); } catch (_) {} setMasquee(k); fige.current = null; };
  return (
    <div className="af-reprise" data-reprise="" data-reprise-id={r.id} data-reprise-forme={r.f}>
      <Natif.Groupe>
        <Natif.Rangee titre={tr('af.rep.titre', { titre })} sousTitre={tr('af.rep.sous', { sur, heure: heure(r.at) })}
          icone={Icon ? <Icon name="device" size={22}/> : null} fin="chevron" onClick={() => onOuvrir && onOuvrir(r.id)}
          actions={[{ cle: 'masquer', libelle: tr('af.rep.masquer'), ton: 'neutre', onClick: masquer, franc: true }]}
          attrs={{ 'data-reprise-ouvrir': '' }}/>
      </Natif.Groupe>
      <button type="button" className="sb-rond af-reprise-masquer" aria-label={tr('af.rep.masquer')} title={tr('af.rep.masquer')} data-reprise-masquer="" onClick={masquer}>
        {Icon ? <Icon name="close" size={16}/> : '×'}
      </button>
    </div>
  );
}
export default RepriseAppareil;

// ═══════════════════════════════════════════════════════════════════════════
// « OBSERVER VINTED » DANS VRM (24 nov., ext. 5.440.3) — la RÈGLE, pure
// ═══════════════════════════════════════════════════════════════════════════
// L'extension (5.440.3, `observation`) note pendant 10 min le chemin que prend la page Vinted quand Julien envoie,
// à la main ou avec un autre outil, un message ou une offre à un favori. La frise est rangée dans
// `observation_vinted_{compte}_{navigateur}` (formes seulement, voir inject.js `<observation-regle>`). Ici : chaque
// entrée dite en une phrase simple (« ouvre la cloche · 12 lignes · clic sur la ligne (lien want_it) · POST
// messaging/main/inquiries 201 · page /inbox/{uuid} »), dans la langue de l'écran (tr). Rien n'est recalculé :
// on dit ce que la ligne porte. Exécutée par scripts/audit-observation-vinted-app.cjs.
// ═══════════════════════════════════════════════════════════════════════════
import { tr } from './i18n/index.js';

// Le « nom » court d'un lien : le mot qui le reconnaît (want_it, messaging, inbox…), jamais la forme entière.
export function motDuLien(forme) {
  const f = String(forme || '');
  if (!f) return '';
  if (/want_it/.test(f)) return 'want_it';
  if (/^[a-z][a-z0-9+.-]*:\/\/messaging/.test(f)) return 'messaging (app)';
  if (/\/inbox\/\{uuid\}/.test(f)) return 'inbox/{uuid}';
  if (/\/notifications?\b/.test(f)) return 'notifications';
  const p = f.replace(/^[^/]*(?=\/)/, '').split('?')[0].split('/').filter(Boolean);
  return p.slice(0, 2).join('/') || f.slice(0, 30);
}
// Le chemin d'une requête, raccourci : sans « /api/v2 » ni hôte, comme Julien le lit.
export function cheminCourt(e) {
  const p = String((e && e.p) || '').replace(/^\/api\/v\d+\//, '').replace(/^\//, '');
  return p || '/';
}
const estCloche = (e) => e && e.k === 'clic' && (/notif|benachrichtigung/.test(String(e.aria || '')) || /notif|bell/i.test(String(e.tid || '')));

// UNE entrée ⇒ { texte, ton } ; ton : 'clic' · 'requete' · 'page' · 'cloche' · 'refus' (statut ≥ 400 ou 0).
export function phraseObservation(e) {
  if (!e || typeof e !== 'object') return null;
  const qui = e.k === 'clic' && e.conf === false ? ' ' + tr('obs.f.script') : '';
  const onglet = Number(e.o) > 1 ? ' · ' + tr('obs.f.onglet', { n: Number(e.o) }) : '';
  if (e.k === 'page') return { ton: 'page', texte: tr('obs.f.page', { p: e.p || '/' }) + onglet };
  if (e.k === 'notifs') return { ton: 'cloche', texte: tr('obs.f.notifs', { n: Number(e.n) || 0 }) + (Number(e.page) > 1 ? ' · ' + tr('obs.f.pageN', { n: Number(e.page) }) : '') + ((e.formes || []).length ? ' · ' + tr('obs.f.liens', { l: [...new Set(e.formes.map(motDuLien))].join(', ') }) : '') + onglet };
  if (e.k === 'cloche') return { ton: 'cloche', texte: tr(e.pourquoi === 'page' ? 'obs.f.lignesPage' : 'obs.f.lignes', { n: Number(e.lignes) || 0 }) + onglet };
  if (e.k === 'defile') return { ton: 'cloche', texte: tr('obs.f.defile', { n: Number(e.lignes) || 0, avant: Number(e.avant) || 0 }) + onglet };
  if (e.k === 'req') {
    const st = Number(e.st) || 0;
    return { ton: st >= 400 || st === 0 ? 'refus' : 'requete', texte: `${e.m || 'GET'} ${e.h ? e.h + ' ' : ''}${cheminCourt(e)} ${st || tr('obs.f.sansReponse')}` + onglet };
  }
  if (e.k === 'clic') {
    if (estCloche(e)) return { ton: 'clic', texte: tr('obs.f.cloche') + qui + onglet };
    if (e.href) return { ton: 'clic', texte: tr('obs.f.clicLien', { l: motDuLien(e.href) }) + qui + onglet };
    if (e.tag === 'textarea' || e.tag === 'input') return { ton: 'clic', texte: tr('obs.f.champ') + qui + onglet };
    const nom = e.aria && e.aria !== '{texte}' ? `« ${e.aria} »` : e.tid ? e.tid : e.tag || '?';
    return { ton: 'clic', texte: tr('obs.f.clic', { quoi: nom }) + qui + onglet };
  }
  return null;
}

// Les entrées dites, dans l'ordre (chacune son `id` : heure + rang) ; deux requêtes identiques qui se suivent (la même lecture deux fois) ⇒ « ×2 ».
export function frisePhrases(ev) {
  const out = [];
  for (const e of Array.isArray(ev) ? ev : []) {
    const p = phraseObservation(e);
    if (!p) continue;
    const prec = out[out.length - 1];
    if (prec && prec.texte === p.texte && p.ton === 'requete') { prec.fois = (prec.fois || 1) + 1; continue; }
    out.push({ t: Number(e.t) || null, id: `${Number(e.t) || 0}-${out.length}`, ...p });   // identité : l'heure de l'entrée et son rang dans la frise
  }
  return out;
}

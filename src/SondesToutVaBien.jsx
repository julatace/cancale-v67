// ═══════════════════════════════════════════════════════════════════════════
// « TOUT VA BIEN ? » — CE QUI TOURNE (27 nov. 2026) : les lectures et la forme
// ═══════════════════════════════════════════════════════════════════════════
// La règle (quel état pour quel morceau) est src/toutVaBienSondes.js ; ici, les TROIS lectures en plus de
// celles de la page (`useEtatCapture`) — le serveur (/api/sante, public), la réception des e-mails
// (/api/email-rattacher?mode=reception, SA session) et la file des favoris de chaque compte Vinted
// (/api/compte?mode=favoris&carte=1, une LECTURE : la décision GET de la file n'écrit rien,
// api/_lib/neutre-cas.js) — puis une rangée par morceau. Une lecture ratée rend `null` (jamais `[]`).
// Relues à chaque « Revérifier » de la page (la date de la lecture de la page change).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { Groupe, Rangee, Pourquoi } from './natif/index.js';
import { tr } from './i18n/index.js';
import { sbAuth } from './App.jsx';
import { requeteJsonBornee } from './requeteJsonBornee.js';
import { sondesToutVaBien } from './toutVaBienSondes.js';

export const FAVORIS_COMPTES_MAX = 12;   // au plus 12 comptes lus (une requête chacun, en parallèle)
const lireJson = async (url, init, delai = 10000) => {
  try { const r = await requeteJsonBornee(url, { cache: 'no-store', ...(init || {}) }, delai); return r.ok && r.json && typeof r.json === 'object' ? r.json : null; }
  catch (_) { return null; }
};

// `etat` : celui de `useEtatCapture({ complet: true })`. Rend { sante, reception, favoris } (trois états chacun).
export function useLecturesSondes(etat) {
  const [lu, setLu] = React.useState({ sante: undefined, reception: undefined, favoris: undefined });
  const tour = etat && etat.at;
  const comptes = etat ? etat.vinted : undefined;
  const cle = Array.isArray(comptes) ? comptes.filter((c) => !c.masque && !c.banni).map((c) => c.id).join(',') : String(comptes);
  React.useEffect(() => {
    if (!tour) return undefined;
    let mort = false;
    setLu({ sante: undefined, reception: undefined, favoris: undefined });
    const poser = (k, v) => { if (!mort) setLu((x) => ({ ...x, [k]: v })); };
    lireJson('/api/sante').then((j) => poser('sante', j && j.ok === true ? j : null));
    lireJson('/api/email-rattacher?mode=reception', { headers: sbAuth() }, 15000).then((j) => poser('reception', j && j.ok === true ? j : null));
    if (!Array.isArray(comptes)) poser('favoris', comptes === undefined ? undefined : null);
    else {
      const liste = comptes.filter((c) => c && !c.masque && !c.banni && /^[1-9]\d{0,19}$/.test(String(c.id))).slice(0, FAVORIS_COMPTES_MAX);
      Promise.all(liste.map(async (c) => {
        const j = await lireJson(`/api/compte?mode=favoris&uid=${encodeURIComponent(c.id)}&carte=1`, { headers: sbAuth() });
        return { uid: String(c.id), nom: c.nom || '', carte: j && j.ok === true && j.carte && typeof j.carte === 'object' ? j.carte : null };
      })).then((l) => poser('favoris', l));
    }
    return () => { mort = true; };
  }, [tour, cle]);   // eslint-disable-line react-hooks/exhaustive-deps
  return lu;
}

const T = (x) => (x && x.k ? tr(x.k, x.v) : '');
// LE geste d'une rangée, dans la forme que `faire` de la page sait jouer (src/ToutVaBien.jsx).
export function gesteSonde(s, { gestePoint, inst, liensSite }) {
  const g = s && s.geste;
  if (!g) return null;
  if (g.type === 'extension') return gestePoint({ type: 'extension', geste: g.geste }, { inst });
  if (g.type === 'panne') return { code: 'page-extension' };
  if (g.type === 'compte') return gestePoint({ type: 'compte', plateforme: g.plateforme }, { liensSite });
  if (g.type === 'aller') return { code: 'aller', aller: g.aller };
  if (g.type === 'lien') return { code: 'lien', lien: g.lien };
  return null;
}

export function SondesToutVaBien({ sondes, faire, gesteDe }) {
  if (!Array.isArray(sondes) || !sondes.length) return null;
  return (
    <Groupe titre={tr('tvb.s.groupe')} attrs={{ 'data-tvb-sondes': sondes.length }}>
      {sondes.map((s) => {
        const g = gesteDe(s);
        const ext = s.cle === 'extension' && s.etat === 'geste';
        // Une rangée verte n'a pas de « Pourquoi ? » (rien à expliquer), sauf l'extension : version attendue et dernier contact.
        const valeur = s.valeur === '—' ? '—' : s.valeur ? T(s.valeur) : s.etat === 'ok' ? tr('tvb.s.ok') : '';
        return (
          <Rangee key={s.cle} titre={T(s.titre)} sousTitre={T(s.sous)} valeur={valeur} ton={s.etat === 'geste' ? 'ambre' : 'neutre'}
            icone={<span className="vrm-tvb-sonde-point" data-ton={s.etat}/>}
            onClick={g ? () => faire(g) : null} className="vrm-tvb-sonde"
            pied={s.pourquoi && s.pourquoi.length && (s.etat !== 'ok' || s.cle === 'extension') ? <Pourquoi attrs={{ 'data-tvb-sonde-pourquoi': s.cle }}>{s.pourquoi.map((p, i) => <p key={i} className="vrm-tvb-sonde-raison">{T(p)}</p>)}</Pourquoi> : null}
            attrs={{ 'data-tvb-sonde': s.cle, 'data-tvb-sonde-etat': s.etat, 'data-tvb-sonde-geste': g ? g.code : undefined,
              ...(ext ? { 'data-tvb-point': 'extension:ici', 'data-tvb-type': 'extension', 'data-tvb-geste-code': g ? g.code : '' } : {}) }}/>
        );
      })}
    </Groupe>
  );
}

// Les rangées, calculées par LA règle (src/toutVaBienSondes.js).
export function calculerSondes({ etat, nav, lectures, attendue, quand, passuSites }) {
  const contact = Array.isArray(etat.appareils) && etat.appareils.length ? Math.max(...etat.appareils.map((a) => a.at || 0)) || null : null;
  return sondesToutVaBien({ nav, contact, attendue, quand, lignes: etat.lignes, pannes: etat.pannes, passuSites, appareils: etat.appareils,
    reception: lectures.reception, sante: lectures.sante, favoris: lectures.favoris, maintenant: etat.maintenant });
}

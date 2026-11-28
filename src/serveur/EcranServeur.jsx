// ═══════════════════════════════════════════════════════════════════════════
// « ORDINATEUR SERVEUR » — LA PAGE D'ÉTAT ET L'INSTALLATION GUIDÉE (28 nov., ext. 5.457.0, capacité `serveur`)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « je laisse un ordinateur allumé toute la journée, comme un serveur ». Un compte Vinted = un profil Chrome
// sur cet ordinateur (son cookie, SA copie de l'extension, connectée au même compte VRM, « Mode ordinateur allumé »
// allumé dans les Paramètres du panneau). Ici, une rangée par compte, lue dans SES lignes `presence_*` (projection,
// jamais `select=data`) : connecté ou non, dernière lecture, prochaine lecture dans N s (à la seconde), actions de
// l'heure / plafond, pause ou vérification — et le geste. La règle : src/ordinateurServeur.js (`srvLigne`, pure).
// Aucune écriture, aucune requête vers une plateforme. Un toucher sur un compte ⇒ « Mes comptes » (agir dessus).
// Textes : tr() (src/i18n/langues/*/serveur.js).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, heure as heureLoc } from '../i18n/index.js';
import { Page, Groupe, Rangee, Attente, poserIcone, iconePosee } from '../natif/index.js';
import { Pourquoi } from '../natif/Actions.jsx';
import { Icon, SUPABASE_URL, sbAuth } from '../App.jsx';
import { signalFrais } from '../aDistance.js';
import { lignesServeur, SRV_LATENCE, SRV_PLAFOND_LECTURES } from '../ordinateurServeur.js';

export const SELECT_SERVEUR = 'id,atMs:meta->>atMs,ver:meta->>ver,appareil:data->appareil,serveur:data->serveur';
const NOMS_NAV = { chrome: 'Chrome', edge: 'Edge', opera: 'Opera', firefox: 'Firefox', orion: 'Orion', brave: 'Brave' };
const NOMS_SYS = { mac: 'Mac', windows: 'Windows', linux: 'Linux' };
const temps = () => Object.assign({ relire: 15000 }, (typeof window !== 'undefined' && window.__VRM_SRV_TEMPS) || {});

// « 3 min 12 s », « 45 s », « — » (pas su).
export function duree(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return '—';
  const s = Math.max(0, Math.round(n / 1000));
  if (s < 60) return tr('srv.d.s', { s });
  const m = Math.floor(s / 60), r = s % 60;
  return r ? tr('srv.d.ms', { m, s: r }) : tr('srv.d.m', { m });
}

function usePresencesServeur(base, entetes) {
  const [v, setV] = React.useState(undefined);
  const lire = React.useCallback(() => {
    fetch(`${base}/app_data?id=like.presence_*&select=${SELECT_SERVEUR}&limit=20`, { headers: entetes(), cache: 'no-store', signal: signalFrais() })
      .then((r) => (r.ok ? r.json() : null)).then((x) => setV((avant) => (Array.isArray(x) ? x.map((p) => ({ ...p, id: String(p.id || '').replace(/^presence_/, '') })) : avant === undefined ? null : avant)))
      .catch(() => setV((avant) => (avant === undefined ? null : avant)));   // une relecture ratée ne fait pas oublier la précédente
  }, [base, entetes]);
  React.useEffect(() => { lire(); const m = setInterval(lire, temps().relire); return () => clearInterval(m); }, [lire]);
  React.useEffect(() => {
    let t = null;
    const f = (e) => { const id = String((e && e.detail && e.detail.id) || ''); if (id.startsWith('presence_') && !t) t = setTimeout(() => { t = null; lire(); }, 200); };
    window.addEventListener('vrm:ligne', f);
    return () => { window.removeEventListener('vrm:ligne', f); if (t) clearTimeout(t); };
  }, [lire]);
  return v;
}
function useSeconde() {
  const [t, setT] = React.useState(() => Date.now());
  React.useEffect(() => { const m = setInterval(() => setT(Date.now()), 1000); return () => clearInterval(m); }, []);
  return t;
}

// La phrase d'une ligne (≤ 8 mots visibles) et son geste (sous « Pourquoi ? »).
export function phraseLigne(l, maintenant) {
  const nom = l.nom || l.compte || tr('srv.compteInconnu');
  if (l.code === 'pret') {
    const prochain = l.prochain ? l.prochain - maintenant : null;
    return { titre: tr('srv.l.pret', { nom }), sous: [l.lu ? tr('srv.l.lu', { age: duree(maintenant - l.lu) }) : tr('srv.l.luPasEncore'), prochain == null ? '' : prochain > 0 ? tr('srv.l.prochain', { dans: duree(prochain) }) : tr('srv.l.maintenant')].filter(Boolean).join(' · '), geste: '' };
  }
  if (l.code === 'deconnecte') return { titre: tr('srv.l.deconnecte', { nom }), sous: tr('srv.l.deconnecteSous'), geste: tr('srv.g.deconnecte') };
  if (l.code === 'captcha') return { titre: tr('srv.l.captcha', { nom }), sous: tr('srv.l.captchaSous'), geste: tr('srv.g.captcha') };
  if (l.code === 'pause') return { titre: tr('srv.l.pause', { nom }), sous: l.jusqua ? tr('srv.l.pauseJusqua', { heure: heureLoc(l.jusqua) }) : tr('srv.l.pauseSous'), geste: tr('srv.g.pause') };
  if (l.code === 'prudence') return { titre: tr('srv.l.prudence', { nom }), sous: tr('srv.l.prudenceSous'), geste: tr('srv.g.prudence') };
  if (l.code === 'budget') return { titre: tr('srv.l.budget', { nom }), sous: tr('srv.l.budgetSous'), geste: tr('srv.g.budget', { n: SRV_PLAFOND_LECTURES }) };
  if (l.code === 'off') return { titre: tr('srv.l.off', { nom }), sous: tr('srv.l.offSous'), geste: tr('srv.g.off') };
  return { titre: tr('srv.l.eteint', { nom }), sous: l.atMs ? tr('srv.l.eteintDepuis', { heure: heureLoc(l.atMs) }) : '—', geste: tr('srv.g.eteint') };
}

export default function EcranServeur({ onNav = null, base = `${SUPABASE_URL}/rest/v1`, entetes = sbAuth }) {
  if (!iconePosee()) poserIcone(Icon);
  const pres = usePresencesServeur(base, entetes);
  const maintenant = useSeconde();
  const lignes = lignesServeur(pres, maintenant);
  const servis = Array.isArray(lignes) ? lignes.filter((l) => l.code !== 'off' || l.compte) : lignes;
  const prets = Array.isArray(servis) ? servis.filter((l) => l.code === 'pret').length : 0;
  const nav = (p) => { const x = (pres || []).find((y) => String(y.id) === p.appareil); const a = x && x.appareil && typeof x.appareil === 'object' ? x.appareil : {}; return [NOMS_NAV[a.nav] || 'Chrome', NOMS_SYS[a.systeme] || ''].filter(Boolean).join(' · '); };
  const etapes = ['profil', 'extension', 'connecter', 'vinted', 'allumer', 'garder'];
  return (
    <Page titre={tr('srv.titre')} attrs={{ 'data-ecran-serveur': '', 'data-srv-lignes': Array.isArray(servis) ? String(servis.length) : servis === null ? 'passu' : 'lecture', 'data-srv-prets': String(prets) }}>
      {servis === undefined ? <Groupe titre={tr('srv.g.comptes')}><Attente forme="rangees" n={2}/></Groupe> : null}
      {servis === null ? <Groupe titre={tr('srv.g.comptes')} attrs={{ 'data-srv-etat': 'passu' }}><Rangee titre="—" sousTitre={tr('srv.passu')} sousLignes={2}/></Groupe> : null}
      {Array.isArray(servis) ? (
        <Groupe titre={tr('srv.g.comptes')} pied={servis.length ? tr('srv.pied', { n: prets, total: servis.length }) : ''} attrs={{ 'data-srv-comptes': String(servis.length) }}>
          {servis.length ? servis.map((l) => {
            const ph = phraseLigne(l, maintenant);
            const act = l.actions != null && l.cap ? tr('srv.l.actions', { n: l.actions, cap: l.cap }) : '';
            return (
              <React.Fragment key={l.appareil}>
                <Rangee icone={<Icon name={l.code === 'pret' ? 'check' : 'alert'} size={22}/>} titre={ph.titre} sousTitre={[ph.sous, act].filter(Boolean).join(' · ')} sousLignes={2}
                  valeur={nav(l)} fin={l.compte ? 'chevron' : null} onClick={l.compte && onNav ? () => { try { onNav('adistance'); } catch (_) {} } : null}
                  attrs={{ 'data-srv-ligne': l.appareil, 'data-srv-code': l.code, 'data-srv-compte': l.compte || '', 'data-srv-prochain': l.prochain ? String(Math.max(0, Math.round((l.prochain - maintenant) / 1000))) : '', 'data-srv-actions': l.actions == null ? '' : String(l.actions), 'data-srv-cap': l.cap == null ? '' : String(l.cap) }}/>
                {ph.geste ? <Pourquoi libelle={tr('srv.quoiFaire')} attrs={{ 'data-srv-geste': l.code }}><p>{ph.geste}</p></Pourquoi> : null}
              </React.Fragment>
            );
          }) : <Rangee titre={tr('srv.aucun')} sousTitre={tr('srv.aucunSous')} sousLignes={2} attrs={{ 'data-srv-aucun': '' }}/>}
        </Groupe>
      ) : null}
      <Groupe titre={tr('srv.g.vitesse')} attrs={{ 'data-srv-latence': String(Math.round(SRV_LATENCE.moyenneMs / 1000)), 'data-srv-pire': String(Math.round(SRV_LATENCE.pireMs / 1000)) }}>
        <Rangee icone={<Icon name="clock" size={22}/>} titre={tr('srv.v.titre', { moy: duree(SRV_LATENCE.moyenneMs) })} sousTitre={tr('srv.v.sous', { pire: duree(SRV_LATENCE.pireMs) })} sousLignes={2}/>
        <Pourquoi attrs={{ 'data-srv-pourquoi': 'vitesse' }}>
          <p>{tr('srv.v.p1', { n: SRV_PLAFOND_LECTURES })}</p>
          <p>{tr('srv.v.p2')}</p>
        </Pourquoi>
      </Groupe>
      <Groupe titre={tr('srv.g.installer')} attrs={{ 'data-srv-guide': String(etapes.length) }}>
        {etapes.map((k, i) => <Rangee key={k} titre={`${i + 1}. ${tr('srv.e.' + k)}`} attrs={{ 'data-srv-etape': k }}/>)}
        <Pourquoi libelle={tr('srv.commentFaire')} attrs={{ 'data-srv-pourquoi': 'regles' }}>
          {etapes.map((k, i) => <p key={k} data-srv-detail={k}><b>{i + 1}.</b> {tr('srv.e.' + k + 'Sous')}</p>)}
          <p>{tr('srv.e.regle1')}</p>
          <p>{tr('srv.e.regle2')}</p>
        </Pourquoi>
      </Groupe>
    </Page>
  );
}

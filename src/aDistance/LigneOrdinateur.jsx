// ═══════════════════════════════════════════════════════════════════════════
// « TON ORDINATEUR » SUR AUJOURD'HUI (22 nov., ext. 5.436) — UN toucher vers « Mes comptes »
// ═══════════════════════════════════════════════════════════════════════════
// Une rangée : « Ton ordinateur · allumé · 2 comptes » ou « … éteint depuis 21:40 », et « 3 gestes en attente ».
// Deux petites lectures projetées (les présences, les gestes qui attendent : identifiants seulement), relues à chaque
// ligne signalée et toutes les 60 s. Aucun ordinateur n'a jamais parlé ⇒ RIEN n'est montré (pas une carte de reproche, §2.10).
// La règle : src/aDistance.js (`etatOrdinateurs`). Textes par tr().
import React from 'react';
import { tr, heure as heureLoc } from '../i18n/index.js';
import { Groupe, Rangee } from '../natif/index.js';
import { Pourquoi } from '../natif/Actions.jsx';
import { lirePresences, etatOrdinateurs, signalFrais } from '../aDistance.js';
import { SUPABASE_URL, sbAuth } from '../App.jsx';

const NOMS_NAV = { chrome: 'Chrome', edge: 'Edge', opera: 'Opera', firefox: 'Firefox', orion: 'Orion' };
const NOMS_SYS = { mac: 'Mac', windows: 'Windows', linux: 'Linux', iphone: 'iPhone', ipad: 'iPad', android: 'Android', chromeos: 'Chromebook' };
const nomOrdi = (p) => [NOMS_NAV[p.nav] || 'Chrome', NOMS_SYS[p.sys] || ''].filter(Boolean).join(' · ');

export default function LigneOrdinateur({ onNav, Icon = null, base = `${SUPABASE_URL}/rest/v1`, entetes = sbAuth }) {
  const [pres, setPres] = React.useState(undefined);
  const [attente, setAttente] = React.useState(null);
  const lire = React.useCallback(() => {
    const dep = { base, entetes };
    lirePresences(dep).then(setPres).catch(() => setPres(null));
    fetch(`${base}/app_data?id=like.cmd_dist_*&meta->>etat=in.(attente,pris)&select=id,expire:meta->>expire`, { headers: entetes(), cache: 'no-store', signal: signalFrais() })
      .then((r) => (r.ok ? r.json() : null)).then((x) => setAttente(Array.isArray(x) ? x.filter((l) => Number(l.expire) > Date.now()).length : null)).catch(() => setAttente(null));
  }, [base, entetes]);
  React.useEffect(() => { lire(); const m = setInterval(lire, 60000); return () => clearInterval(m); }, [lire]);
  React.useEffect(() => {
    let t = null;
    const f = (e) => { const id = String((e && e.detail && e.detail.id) || ''); if ((id.startsWith('presence_') || id.startsWith('cmd_dist_')) && !t) t = setTimeout(() => { t = null; lire(); }, 300); };
    window.addEventListener('vrm:ligne', f);
    return () => { window.removeEventListener('vrm:ligne', f); if (t) clearTimeout(t); };
  }, [lire]);
  const e = etatOrdinateurs(pres);
  if (e.niveau !== 'allume' && e.niveau !== 'eteint') return null;
  const p = e.allumes[0] || e.dernier;
  const comptes = new Set(e.allumes.flatMap((o) => o.comptes.map((c) => c.site + ':' + c.id))).size;
  const titre = e.niveau === 'allume' ? tr('adist.jour.allume', { nom: nomOrdi(p), n: comptes }) : tr('adist.jour.eteint', { nom: nomOrdi(p), heure: heureLoc(p.atMs) });
  // (25 nov., « trop de texte ») Le titre court (« Ordinateur éteint · 07:37 ») ; la ligne dessous seulement quand des gestes
  // attendent l'ordinateur — le navigateur et ce qu'on peut faire à distance sont dans « Mes comptes » (›) et au lecteur d'écran.
  // (27 nov., Julien : « Ordinateur éteint · 21:20 » — « Vas-y fais tout ») ÉTEINT : UNE phrase visible de 8 mots au plus (ce qui
  // en découle : rien ne part), le reste sous « Pourquoi ? » — ce qui ne marche pas pendant ce temps (les gestes « À distance »
  // attendent, Vinted n'est plus relu) et le geste (ouvrir Chrome avec l'extension). Des gestes attendent : la phrase les compte.
  const eteint = e.niveau === 'eteint';
  const sous = attente ? tr('adist.jour.attente', { n: attente }) : eteint ? tr('adist.jour.eteintSous') : '';
  return (
    <Groupe attrs={{ 'data-adist-jour': e.niveau }}>
      <Rangee icone={Icon ? <Icon name="link" size={22}/> : null} titre={titre} sousTitre={sous} sousLignes={2} ton={eteint && attente ? 'ambre' : 'neutre'} fin="chevron"
        onClick={() => { try { onNav && onNav('adistance'); } catch (_) {} }} attrs={{ 'data-adist-jour-rangee': '', 'data-adist-jour-attente': attente == null ? '' : String(attente), 'data-adist-jour-phrase': sous ? '' : undefined, 'aria-label': [titre, nomOrdi(p), sous || tr('adist.jour.sous')].filter(Boolean).join(' · ') }}/>
      {eteint ? <Pourquoi attrs={{ 'data-adist-jour-pourquoi': '' }}>
        <p data-adist-pourquoi="manque">{tr('adist.jour.pqManque')}</p>
        <p data-adist-pourquoi="geste">{tr('adist.jour.pqGeste')}</p>
      </Pourquoi> : null}
    </Groupe>
  );
}

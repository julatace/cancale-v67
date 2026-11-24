// ═══════════════════════════════════════════════════════════════════════════
// LA VUE « CONNEXIONS » (24 nov., lot connexions-extension) — Paramètres → Connexions de l'extension
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « que on soit bcp plus informé sur les connexions d'extensions ». Une page : chaque navigateur où
// l'extension VRM tourne pour CE compte (nom, version, vu quand, ce qu'il lit, son dernier problème et SON geste),
// puis chaque compte vendeur (qui le lit, quand, la jauge des 50/h). La RÈGLE : src/connexions/connexions.js (pure).
// Lectures seules, projetées (jamais `select=data`), relues à l'ouverture puis toutes les 60 s TANT QUE la page est
// visible (aucune lecture quand l'onglet est caché). `undefined` on lit · `null` pas su (« — » et la raison) · valeur.
// `LigneConnexionsJournee` : la ligne d'Aujourd'hui, montrée seulement quand un geste est à faire (une lecture, pas de minuteur).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, dateRelative } from '../i18n/index.js';
import { Page, Groupe, Rangee, Actions, Pourquoi, Pastille, Attente, poserIcone, iconePosee } from '../natif/index.js';
import { vueConnexions, requeteConnexions, SANTE_DEPUIS } from './connexions.js';
import { lireLignesActions } from '../JaugeActions.jsx';
import { jaugeDuCompte } from '../jaugeActions.js';
import { installerExtensionIci } from '../navigateurExtension.js';
import { nomCompteLie } from '../comptesLies.js';
import { Icon, AUTH, EXT_ATTENDUE, EXT_CAPACITES, lireTout, lireCapturesDetail, useComptesAutresSites, faitsExtensionApp, useSansSouris } from '../App.jsx';
import './connexions.css';

export const RELIRE_MS = 60000;
const NOMS_NAV = { chrome: 'Chrome', edge: 'Edge', opera: 'Opera', firefox: 'Firefox', orion: 'Orion', brave: 'Brave', arc: 'Arc', safari: 'Safari' };
const NOMS_SYS = { mac: 'Mac', windows: 'Windows', linux: 'Linux', iphone: 'iPhone', ipad: 'iPad', android: 'Android', chromeos: 'Chromebook' };
const NOMS_SITES = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire', ebay: 'eBay' };
const DOMAINES = { vinted: 'https://www.vinted.fr', leboncoin: 'https://www.leboncoin.fr/compte/part/mes-annonces', vestiaire: 'https://www.vestiairecollective.com' };

export const nomNavigateur = (n) => [NOMS_NAV[n.nav] || tr('cnx.nav.inconnu'), NOMS_SYS[n.sys] || ''].filter(Boolean).join(' · ');
// « il y a 3 min » (Intl) ; rien d'inventé.
export function ilYa(at, maintenant) {
  const t = Number(at); if (!Number.isFinite(t) || t <= 0) return '';
  const min = Math.round((t - maintenant) / 60000);
  if (Math.abs(min) < 60) return dateRelative(Math.min(0, min), 'minute');
  const h = Math.round(min / 60);
  if (Math.abs(h) < 48) return dateRelative(h, 'hour');
  return dateRelative(Math.round(h / 24), 'day');
}

// ── Lectures ────────────────────────────────────────────────────────────────
// `suivre` : relire toutes les 60 s tant que la page est visible (la page) ; sinon une lecture (Aujourd'hui).
function useVisible() {
  const [v, setV] = React.useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  React.useEffect(() => { const f = () => setV(document.visibilityState !== 'hidden'); document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);
  return v;
}
export function useFaitsConnexions({ suivre = true, autresSites = true } = {}) {
  const visible = useVisible();
  const [lu, setLu] = React.useState({ rows: undefined, actions: undefined, captures: undefined, at: Date.now() });
  const [tour, setTour] = React.useState(0);
  const relire = React.useCallback(() => setTour((t) => t + 1), []);
  React.useEffect(() => {
    if (!visible) return undefined;   // onglet caché : rien ne part
    let mort = false;
    const owner = (AUTH.user && AUTH.user.id) || '';
    const q = requeteConnexions(owner);
    const lire = (frais) => Promise.all([
      q ? lireTout(q).then((r) => (Array.isArray(r) ? r : null), () => null) : Promise.resolve(null),
      lireLignesActions('', { frais }).then((r) => (Array.isArray(r) ? r : null), () => null),
      lireCapturesDetail(frais ? { force: true } : undefined).then((d) => (d ? d.by : null), () => null),
    ]).then(([rows, actions, captures]) => { if (!mort) setLu({ rows, actions, captures, at: Date.now() }); });
    lire(tour > 0);
    const m = suivre ? setInterval(() => lire(true), RELIRE_MS) : null;
    return () => { mort = true; if (m) clearInterval(m); };
  }, [visible, suivre, tour]);
  const [sites] = useComptesAutresSites(autresSites);
  return { ...lu, sites: autresSites ? sites : null, relire, visible };
}

// Les faits ⇒ la vue (la règle pure). `comptesVinted` : la table du vendeur ; `ecarte(uid)` : compte retiré de ses totaux.
export function calculerVue(f, { comptesVinted, ecarte = () => false, ici = '', maintenant = Date.now() }) {
  const liste = Array.isArray(comptesVinted) ? comptesVinted.filter((a) => a && a.vinted_user_id != null && !ecarte(String(a.vinted_user_id))) : [];
  const vinted = liste.map((a) => ({ id: String(a.vinted_user_id), nom: String(a.login || a.label || '') }));
  const s = f.sites || {};
  const lbc = Array.isArray(s.leboncoin) ? s.leboncoin.map((c) => ({ id: c.id, nom: nomCompteLie(c), lu: c.lu })) : [];
  const vc = Array.isArray(s.vestiaire) ? s.vestiaire.map((c) => ({ id: c.id, nom: nomCompteLie(c), lu: c.lu })) : [];
  const jauges = {};
  for (const c of vinted) jauges[c.id] = f.actions === undefined ? undefined : jaugeDuCompte(f.actions, c.id, maintenant);
  return vueConnexions({ rows: f.rows, attendue: EXT_ATTENDUE, maintenant, ici, depuis: (EXT_CAPACITES && EXT_CAPACITES.santesites) || SANTE_DEPUIS,
    comptes: { vinted, leboncoin: lbc, vestiaire: vc }, lus: { vinted: f.captures || {} }, jauges });
}

// ── Gestes ──────────────────────────────────────────────────────────────────
function ouvrir(lien, nouveau = true) { try { window.open(lien, nouveau ? '_blank' : '_self', 'noopener'); } catch (_) {} }
function gesteBouton(geste, site, n) {
  if (geste === 'mettre-a-jour') { const inst = installerExtensionIci(); return { cle: 'maj', icone: <Icon name="sync" size={18}/>, libelle: tr('cnx.geste.maj'), onClick: () => ouvrir(inst.lien, inst.boutique), plein: true }; }
  if (geste === 'ouvrir-site') return { cle: 'ouvrir', icone: <Icon name="link" size={18}/>, libelle: tr('cnx.geste.ouvrir', { site: NOMS_SITES[site] || 'Vinted' }), onClick: () => ouvrir(DOMAINES[site] || DOMAINES.vinted) };
  if (geste === 'recharger' && n && n.ici) return { cle: 'recharger', icone: <Icon name="sync" size={18}/>, libelle: tr('cnx.geste.recharger'), onClick: () => { try { window.location.reload(); } catch (_) {} } };
  return null;
}

// ── Un navigateur ───────────────────────────────────────────────────────────
function RangeeNavigateur({ n, maintenant, iciVrm, homonyme = false }) {
  // Deux installations au même nom (« Chrome · Mac ») : la fin de leur numéro les distingue.
  const nom = nomNavigateur(n) + (homonyme ? ' #' + n.court : '') + (n.ici ? ' · ' + tr('cnx.ici') : '');
  const vu = n.vu === 'passu' ? tr('cnx.vu.passu') : n.vu === 'direct' ? tr('cnx.vu.direct') : n.vu === 'absent' ? tr('cnx.vu.absent', { age: ilYa(n.atMs, maintenant) }) : tr('cnx.vu.recent', { age: ilYa(n.atMs, maintenant) });
  const v = n.version;
  const valeur = v.etat === 'a-jour' ? tr('cnx.version.aJour') : v.etat === 'ancienne' ? tr('cnx.version.fleche', { ver: v.ver, installer: v.installer || '—' }) : '—';
  // Ce qu'il lit : Vinted par compte, Leboncoin / Vestiaire par le dernier envoi réussi.
  const lit = [];
  const cv = n.sites.vinted.comptes;
  if (cv.length) lit.push(tr('cnx.lit.vinted', { comptes: cv.slice(0, 3).map((c) => c.nom || '—').join(', ') + (cv.length > 3 ? ' +' + (cv.length - 3) : '') }));
  for (const site of ['leboncoin', 'vestiaire']) if (n.sites[site].at) lit.push(tr('cnx.lit.site', { site: NOMS_SITES[site], age: ilYa(n.sites[site].at, maintenant) }));
  const p = n.probleme;
  const phrase = p ? tr(p.cle, { site: NOMS_SITES[p.site] || '', ver: v.ver, installer: v.installer || '—' }) : '';
  const geste = p ? gesteBouton(p.geste, p.site || 'vinted', n) : null;
  const lienVrm = n.ici && iciVrm ? iciVrm : '';
  // La santé par site (5.448) : « — » et la raison quand l'installation est trop ancienne pour la dire.
  const sante = n.sante === undefined ? 'trop-ancienne' : n.sante === null ? 'pas-dit' : n.sante.every((s) => s.k === 'ok') ? 'ok' : 'probleme';
  return (
    <Rangee titre={nom} sousTitre={[vu, lienVrm ? tr('cnx.vrm.' + lienVrm) : ''].filter(Boolean).join(' · ')} valeur={valeur} valeurForte={v.etat === 'ancienne'}
      icone={<Icon name="device" size={22}/>}
      note={lit.length ? lit.join(' · ') : tr('cnx.lit.rien')}
      pied={p ? (
        <div className="cnx-probleme" data-cnx-probleme={p.code}>
          <p className="cnx-phrase">{phrase}{p.at ? <span className="cnx-quand"> · {ilYa(p.at, maintenant)}</span> : null}</p>
          {geste ? <Actions elements={[geste]} attrs={{ 'data-cnx-geste': p.geste }}/> : null}
        </div>
      ) : null}
      attrs={{ 'data-cnx-navigateur': n.id, 'data-cnx-ici': n.ici ? '1' : '0', 'data-cnx-vu': n.vu, 'data-cnx-version': v.etat, 'data-cnx-ver': v.ver || '', 'data-cnx-installer': v.etat === 'ancienne' ? (v.installer || '') : '',
        'data-cnx-sante': sante, 'data-cnx-probleme-code': p ? p.code : '', 'data-cnx-lit': String(cv.length), 'data-cnx-vrm': lienVrm || undefined }}/>
  );
}

// ── Un compte vendeur ───────────────────────────────────────────────────────
function texteJauge(j) {
  if (j === undefined) return '…';
  if (!j) return '—';
  return tr('cnx.jauge', { n: j.n, max: j.max });
}
function RangeeCompte({ c, maintenant }) {
  const par = c.par ? nomNavigateur(c.par) + (c.par.ici ? ' · ' + tr('cnx.ici') : '') : '';
  const relu = c.relu === 'passu' ? tr('cnx.relu.passu') : c.relu === 'jamais' ? tr('cnx.relu.jamais') : tr('cnx.relu.age', { age: ilYa(c.at, maintenant) });
  const arret = c.arret ? (c.arret === 'deconnecte' ? 'session' : c.arret === 'moderation' ? 'moderation' : 'verification') : '';
  const geste = arret || c.relu === 'vieux' ? gesteBouton('ouvrir-site', c.site) : null;
  const phrase = arret ? tr('cnx.compte.' + arret) : c.relu === 'vieux' ? tr('cnx.compte.vieux', { site: NOMS_SITES[c.site], compte: c.nom || '—' }) : '';
  const prudence = c.jauge && c.jauge.prudence ? tr('cnx.prudence') : '';
  return (
    <Rangee titre={c.nom || '—'} sousTitre={[NOMS_SITES[c.site], relu, par].filter(Boolean).join(' · ')}
      valeur={c.site === 'vinted' ? texteJauge(c.jauge) : null} detailValeur={c.site === 'vinted' ? (prudence || tr('cnx.jauge.heure')) : ''}
      pied={phrase ? (
        <div className="cnx-probleme" data-cnx-compte-probleme={arret || 'vieux'}>
          <p className="cnx-phrase">{phrase}</p>
          {geste ? <Actions elements={[geste]}/> : null}
        </div>
      ) : null}
      attrs={{ 'data-cnx-compte': `${c.site}:${c.id}`, 'data-cnx-relu': c.relu, 'data-cnx-par': c.par ? c.par.id : '', 'data-cnx-jauge': c.site !== 'vinted' ? undefined : c.jauge === undefined ? 'lecture' : c.jauge === null ? 'pas-su' : `${c.jauge.n}/${c.jauge.max}`, 'data-cnx-arret': arret || undefined }}/>
  );
}

// ── La page ─────────────────────────────────────────────────────────────────
export default function EcranConnexions({ comptesVinted, ecarte = () => false, faits: faitsForces = null, maintenant: maintenantForce = null }) {
  if (!iconePosee()) poserIcone(Icon);
  const sansSouris = useSansSouris();
  const lus = useFaitsConnexions({ suivre: !faitsForces });
  const f = faitsForces || lus;
  const maintenant = maintenantForce || f.at || Date.now();
  // CE navigateur : son id d'installation (5.409) et à quel compte VRM son extension est reliée.
  let ici = '', iciVrm = '';
  try {
    const fx = faitsExtensionApp(sansSouris);
    const et = fx.ext && fx.ext.etat;
    ici = String((et && et.ici && et.ici.appareil) || '');
    const v = et && et.vrm;
    if (v && typeof v === 'object') {
      const moi = String((AUTH.user && AUTH.user.id) || '');
      iciVrm = v.connecte === false ? 'aucun' : v.connecte && v.user_id && moi && String(v.user_id) !== moi ? 'autre' : v.connecte ? 'moi' : '';
    }
  } catch (_) { /* pas su : rien n'est dit */ }
  const [anciensOuverts, setAnciensOuverts] = React.useState(false);
  const vue = calculerVue(f, { comptesVinted, ecarte, ici, maintenant });
  const N = vue.navigateurs;
  const anciens = Array.isArray(vue.anciens) ? vue.anciens : [];
  const etat = N === undefined ? 'lecture' : N === null ? 'pas-su' : String(N.length);
  return (
    <Page titre={tr('cnx.titre')} attrs={{ 'data-ecran-connexions': '', 'data-cnx-etat': etat, 'data-cnx-alerte': vue.alerte ? vue.alerte.code : '' }}>
      <Groupe titre={tr('cnx.groupe.navigateurs')} pied={N && N.length ? tr('cnx.pied.relu', { age: ilYa(maintenant, Date.now()) || tr('cnx.maintenant') }) : ''} attrs={{ 'data-cnx-groupe': 'navigateurs' }}>
        {N === undefined ? <Attente forme="rangees" n={3}/>
          : N === null ? <>
              <Rangee titre="—" sousTitre={tr('cnx.passu')} attrs={{ 'data-cnx-passu': '' }}/>
              <Actions elements={[{ cle: 'relire', icone: <Icon name="sync" size={18}/>, libelle: tr('cnx.reessayer'), onClick: f.relire || (() => {}) }]}/>
            </>
          : !N.length ? <Rangee titre={tr('cnx.aucun')} sousTitre={tr('cnx.aucun.sous')} attrs={{ 'data-cnx-aucun': '' }}/>
          : N.map((n) => <RangeeNavigateur key={n.id} n={n} maintenant={maintenant} iciVrm={n.ici ? iciVrm : ''} homonyme={N.filter((x) => nomNavigateur(x) === nomNavigateur(n)).length > 1}/>)}
      </Groupe>

      <Groupe titre={tr('cnx.groupe.comptes')} attrs={{ 'data-cnx-groupe': 'comptes' }}>
        {comptesVinted === undefined ? <Attente forme="rangees" n={2}/>
          : !vue.comptes.length ? <Rangee titre={tr('cnx.comptes.aucun')}/>
          : vue.comptes.map((c) => <RangeeCompte key={`${c.site}:${c.id}`} c={c} maintenant={maintenant}/>)}
      </Groupe>

      {anciens.length ? (
        <Groupe titre={tr('cnx.groupe.anciens')} repli={{ ouvert: anciensOuverts, onBascule: () => setAnciensOuverts((o) => !o), n: anciens.length }} attrs={{ 'data-cnx-groupe': 'anciens', 'data-cnx-anciens': String(anciens.length) }}>
          {anciens.map((n) => <Rangee key={n.id} titre={nomNavigateur(n)} sousTitre={n.atMs ? tr('cnx.vu.absent', { age: ilYa(n.atMs, maintenant) }) : tr('cnx.vu.passu')} valeur={n.version.ver || '—'}
            attrs={{ 'data-cnx-ancien': n.id, 'data-cnx-version': n.version.etat }}/>)}
        </Groupe>
      ) : null}

      <div className="cnx-pourquoi">
        <Pourquoi attrs={{ 'data-cnx-pourquoi': '' }}>
          <p>{tr('cnx.pourquoi.lignes')}</p>
          <p>{tr('cnx.pourquoi.jauge')}</p>
          <p>{tr('cnx.pourquoi.anciens')}</p>
          <p>{tr('cnx.pourquoi.sante', { v: (EXT_CAPACITES && EXT_CAPACITES.santesites) || SANTE_DEPUIS })}</p>
        </Pourquoi>
      </div>
    </Page>
  );
}

// ── La ligne d'Aujourd'hui ─────────────────────────────────────────────────
// Rien tant qu'on lit, rien sur « pas su », rien quand tout va bien : une ligne et UN bouton seulement quand un geste attend.
export function LigneConnexionsJournee({ comptesVinted, ecarte = () => false, onOuvrir, faits: faitsForces = null, maintenant: maintenantForce = null }) {
  const lus = useFaitsConnexions({ suivre: false, autresSites: false });
  const f = faitsForces || lus;
  const maintenant = maintenantForce || f.at || Date.now();
  if (f.rows === undefined || comptesVinted === undefined) return null;
  const vue = calculerVue({ ...f, sites: null }, { comptesVinted, ecarte, maintenant });
  const a = vue.alerte;
  if (!a) return null;
  const vars = { ...a.vars }; if (a.vars && a.vars.at) vars.age = ilYa(a.vars.at, maintenant);
  return (
    <div className="cnx-journee" role="status" data-cnx-journee={a.code}>
      <span className="cnx-journee-point" aria-hidden="true"/>
      <span className="cnx-journee-texte">{tr(a.cle, vars)}</span>
      <Actions elements={[{ cle: 'voir', icone: <Icon name="link" size={18}/>, libelle: tr('cnx.geste.voir'), onClick: onOuvrir }]}/>
    </div>
  );
}

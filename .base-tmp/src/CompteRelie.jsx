// ═══════════════════════════════════════════════════════════════════════════
// « shop_x EST RELIÉ À VRM » — LA FEUILLE D'ACCUEIL D'UN NOUVEAU COMPTE (8 nov.)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « Quand de nouveaux comptes sont liés, je veux des notifications, des
// animations, un accompagnement. » La règle (identité, mémoire, une fois, les
// étapes de la première lecture) est src/compteRelie.js ; ici, la FORME et les
// lectures de l'app.
//   · `AccueilComptesRelies` (monté par la coque, une fois) : quand la liste des
//     comptes est lue (Vinted, Leboncoin, Vestiaire, eBay), la fusionne dans SA
//     ligne `vrm_comptes_relies` (lire-fusionner-réécrire, comparer-et-échanger
//     sur `rev` ; une lecture ratée n'écrit RIEN), prévient le serveur d'un compte
//     neuf (`/api/push`, action `comptes` : la notification, une fois), puis
//     ouvre la feuille — seulement une fois `accueilli` ÉCRIT (un rechargement,
//     l'autre appareil : plus de feuille). Plusieurs comptes ensemble : UNE feuille.
//   · La feuille : l'avatar (photo de profil captée, sinon l'initiale), une coche
//     qui se dessine, la première lecture ÉTAPE PAR ÉTAPE cochée sur PREUVE lue
//     (annonces, ventes, achats, porte-monnaie : le nombre lu quand il est écrit,
//     « En cours » sinon, le geste si rien ne vient), puis trois choix (nom
//     court, dans les totaux, la règle des N° rappelée — rien n'est renuméroté)
//     et « Voir ses ventes ».
//   · Rattrapable : Paramètres → Comptes liés → « Revoir l'accueil »
//     (évènement `vrm:comptes-relies-revoir`).
// Mouvement réduit : aucune animation (la feuille est là, la coche est pleine).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import {
  LIGNE_COMPTES_RELIES, NOM_PLATEFORME_RELIEE, NOUVEAU_VENDEUR_MS, MAX_FEUILLE,
  comptesPresents, fusionnerComptes, aAccueillir, derniersRelies, marquer, normaliserMemoire, vuDepuis,
  etapesPremiereLecture, lectureFinie, idsLignesVinted, decouperCle,
} from './compteRelie.js';
import { nomCompteLie } from './comptesLies.js';
import { CLE_COMPTES_EXCLUS, estExclu, basculerExclu } from '../api/_lib/comptes-exclus.js';
import { CLE_NUMERO_ECRIT, lireReglageNumeroEcrit } from './numeroEcrit.js';
import {
  SUPABASE_URL, sbAuth, withOwner, filtreInventaire, AUTH, lireTout, useComptesAutresSites,
  Bouton, SheetShell, PhotoVinted, enTeteSession, load, save,
} from './App.jsx';
import './styles-compte-relie.css';

export const EVT_REVOIR = 'vrm:comptes-relies-revoir';
export const revoirAccueilComptes = () => { try { window.dispatchEvent(new Event(EVT_REVOIR)); } catch (_) {} };

// ── SA LIGNE : `null` sur une lecture ratée, { existe, data } sinon ──────────
async function lireLigne() {
  if (!AUTH.user) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${LIGNE_COMPTES_RELIES}${filtreInventaire()}&select=data`, { headers: sbAuth(), cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j) || j.length > 1) return null;
    if (!j[0]) return { existe: false, data: null };
    const d = j[0].data;
    return { existe: true, data: d && typeof d === 'object' && !Array.isArray(d) ? d : {} };
  } catch (_) { return null; }
}
async function ecrireLigne({ existe, rev, data }) {
  if (!AUTH.user) return 'ko';
  try {
    if (!existe) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
        method: 'POST', headers: { ...sbAuth(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify([withOwner({ id: LIGNE_COMPTES_RELIES, data })]),
      });
      if (r.ok) return 'ok';
      return r.status === 409 ? 'conflit' : 'ko';
    }
    const garde = rev == null ? 'data->>rev=is.null' : `data->>rev=eq.${rev}`;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${LIGNE_COMPTES_RELIES}${filtreInventaire()}&${garde}&select=id`, {
      method: 'PATCH', headers: { ...sbAuth(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) return 'ko';
    const j = await r.json().catch(() => null);
    if (Array.isArray(j) && j.length === 1) return 'ok';
    return Array.isArray(j) && j.length === 0 ? 'conflit' : 'ko';
  } catch (_) { return 'ko'; }
}
// transformer(memo lu, `null` = ligne absente) → la nouvelle mémoire, ou `null` (rien à écrire).
// Rend { etat: 'ok' | 'rien' | 'ko', data }.
async function modifierLigne(transformer, essais = 4) {
  for (let i = 0; i < essais; i++) {
    const l = await lireLigne();
    if (!l) return { etat: 'ko' };
    const apres = transformer(l.existe ? l.data : null);
    if (!apres) return { etat: 'rien', data: normaliserMemoire(l.data) };
    const revLue = l.existe && l.data && l.data.rev != null ? l.data.rev : null;
    const data = { ...normaliserMemoire(apres), rev: (Number(revLue) || 0) + 1 };
    const r = await ecrireLigne({ existe: l.existe, rev: revLue, data });
    if (r === 'ok') return { etat: 'ok', data };
    if (r !== 'conflit') return { etat: 'ko' };
  }
  return { etat: 'ko' };
}

// L'écran d'ouverture (#vrm-demarrage, index.html) couvre tout tant que l'app démarre :
// la feuille attend qu'il soit parti (au plus 20 s), sinon elle paraîtrait DESSOUS.
const demarrageParti = async (maxMs = 20000) => {
  const t0 = Date.now();
  while (typeof document !== 'undefined' && document.getElementById('vrm-demarrage') && Date.now() - t0 < maxMs) await new Promise((ok) => setTimeout(ok, 200));
  return !(typeof document !== 'undefined' && document.getElementById('vrm-demarrage'));
};
const mouvementReduit = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } };
const labelsVinted = () => load('vinted_account_labels', {}) || {};

// Les comptes présents tels que l'app les connaît. `undefined` tant qu'une
// plateforme est en cours de lecture (on attend), `null` par plateforme ratée.
function presentsDe(comptesVinted, autres) {
  if (!Array.isArray(comptesVinted) || !autres) return undefined;
  if (['leboncoin', 'vestiaire', 'ebay'].some((p) => autres[p] === undefined)) return undefined;
  const lab = labelsVinted();
  const vinted = comptesVinted.map((a) => ({ id: String((a && a.vinted_user_id) || ''), nom: String(lab[String(a && a.vinted_user_id)] || (a && a.login) || '') }));
  const nommer = (l) => (Array.isArray(l) ? l.map((c) => ({ ...c, nom: c.nom || '' })) : null);
  return comptesPresents({ vinted, leboncoin: nommer(autres.leboncoin), vestiaire: nommer(autres.vestiaire), ebay: nommer(autres.ebay) });
}

// ════════════════════════════════════════════════════════════════════════════
export function AccueilComptesRelies({ comptesVinted, pret, silence = false, onNav }) {
  const [autres, relireAutres] = useComptesAutresSites(!!pret);
  const [feuille, setFeuille] = React.useState(null);     // { cles, revoir }
  const memoRef = React.useRef(undefined);
  const presentsRef = React.useRef(null);
  const enVol = React.useRef(false);
  const aRefaire = React.useRef(false);
  const [tour, setTour] = React.useState(0);
  const presents = React.useMemo(() => (pret ? presentsDe(comptesVinted, autres) : undefined), [pret, comptesVinted, autres]);
  presentsRef.current = presents;
  const signature = presents ? presents.lues.join(',') + '|' + presents.liste.map((c) => c.cle).sort().join(',') : '';
  const feuilleRef = React.useRef(feuille); feuilleRef.current = feuille;
  const silenceRef = React.useRef(silence); silenceRef.current = silence;
  const monte = React.useRef(true);
  React.useEffect(() => { monte.current = true; return () => { monte.current = false; }; }, []);

  React.useEffect(() => {
    if (!presents || !AUTH.user) return undefined;
    if (enVol.current) { aRefaire.current = true; return undefined; }
    enVol.current = true;
    (async () => {
      try {
        const maintenant = Date.now();
        const cree = Date.parse(String((AUTH.user && AUTH.user.created_at) || ''));
        const nouveauVendeur = Number.isFinite(cree) && maintenant - cree >= 0 && maintenant - cree < NOUVEAU_VENDEUR_MS;
        let nouveaux = [];
        const f = await modifierLigne((m) => { const x = fusionnerComptes(m, presents, { maintenant, nouveauVendeur }); nouveaux = x.nouveaux; return x.change ? x.memo : null; });
        if (f.etat === 'ko') return;                         // pas su : rien écrit, rien montré
        memoRef.current = f.data;
        // Le serveur relit tout lui-même et notifie UNE fois (api/_lib/compte-relie.js).
        if (f.etat === 'ok' && nouveaux.length) { try { fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'comptes' }) }).catch(() => {}); } catch (_) {} }
        // ⚠️ Un « vu » écrit doit être MONTRÉ : on ne l'écrit que si la feuille peut
        //    paraître maintenant (ni visite, ni Bienvenue, ni autre feuille, toujours monté).
        if (!monte.current || silenceRef.current || feuilleRef.current) return;
        if (!aAccueillir(f.data, presents).length) return;
        if (!(await demarrageParti())) return;
        if (!monte.current || silenceRef.current || feuilleRef.current) return;
        let cles = [];
        const g = await modifierLigne((m) => { cles = aAccueillir(m, presents); return cles.length ? marquer(m, cles, 'accueilli', Date.now()) : null; });
        if (g.etat !== 'ok' || !cles.length) return;          // pas ÉCRIT ⇒ pas montré (sinon il revient)
        memoRef.current = g.data;
        if (monte.current) setFeuille({ cles, revoir: false });
      } finally { enVol.current = false; if (aRefaire.current && monte.current) { aRefaire.current = false; setTour((t) => t + 1); } }
    })();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, silence, tour]);

  React.useEffect(() => {
    const f = async () => {
      const p = presentsRef.current;
      if (!p) return;
      let m = memoRef.current;
      if (m === undefined) { const l = await lireLigne(); m = l ? normaliserMemoire(l.data) : null; memoRef.current = m || undefined; }
      let cles = m ? derniersRelies(m, p) : [];
      if (!cles.length) cles = p.liste.slice(0, MAX_FEUILLE).map((c) => c.cle);
      if (cles.length) setFeuille({ cles, revoir: true });
    };
    window.addEventListener(EVT_REVOIR, f);
    return () => window.removeEventListener(EVT_REVOIR, f);
  }, []);

  if (!feuille || !presents) return null;
  const comptes = feuille.cles.map((k) => presents.liste.find((c) => c.cle === k) || (() => { const d = decouperCle(k); return d ? { cle: k, ...d, nom: '' } : null; })()).filter(Boolean);
  if (!comptes.length) return null;
  return <FeuilleComptesRelies comptes={comptes} memo={memoRef.current} autres={autres} relireAutres={relireAutres} revoir={feuille.revoir}
    onFermer={() => setFeuille(null)} onNav={onNav}/>;
}

// ── LA PREMIÈRE LECTURE DES COMPTES VINTED, RELUE PENDANT QUE LA FEUILLE EST OUVERTE ──
// Des scalaires projetés (§4.4) : id, capture, nombre. `undefined` en cours ·
// `null` pas su · { lignes, photos }.
function useLectureVinted(uids, actif) {
  const [lu, setLu] = React.useState(undefined);
  const [tour, setTour] = React.useState(0);
  const cle = uids.join(',');
  React.useEffect(() => {
    if (!actif || !uids.length) return undefined;
    let mort = false;
    (async () => {
      const ids = uids.flatMap((u) => [...idsLignesVinted(u), `harvest_${u}_profile`]);
      const [lignes, releves] = await Promise.all([
        lireTout(`id=in.(${ids.join(',')})&select=id,cap:meta->>capturedAt,n:meta->>nItems,sup:meta->>supprime`).catch(() => null),
        Promise.all(uids.map((u) => lireTout(`id=like.harvest_${u}_releve_*&select=id,cap:meta->>capturedAt`).catch(() => null))),
      ]);
      let photos = {};
      if (!mort && Array.isArray(lignes) && lignes.some((r) => /_profile$/.test(String(r && r.id)))) {
        const ph = await lireTout(`id=in.(${uids.map((u) => `harvest_${u}_profile`).join(',')})&select=id,photo:data->payload->user->photo->>url`).catch(() => null);
        for (const r of (Array.isArray(ph) ? ph : [])) { const m = /^harvest_(\d+)_profile$/.exec(String(r && r.id)); if (m && /^https:\/\//.test(String(r.photo || ''))) photos[m[1]] = r.photo; }
      }
      if (mort) return;
      if (!Array.isArray(lignes) || releves.some((x) => !Array.isArray(x))) { setLu((v) => (v && v.lignes ? v : null)); return; }
      setLu({ lignes: [...lignes, ...releves.flat()], photos });
    })();
    return () => { mort = true; };
  }, [cle, actif, tour]);
  return [lu, () => setTour((t) => t + 1)];
}

function Avatar({ nom, photo, grand = false }) {
  const initiale = String(nom || '?').replace(/^n° /, '').slice(0, 1).toUpperCase() || '?';
  return (
    <span className={'vrm-cr-avatar' + (grand ? ' is-grand' : '')} data-cr-photo={photo ? 'oui' : 'non'} aria-hidden="true">
      {photo ? <PhotoVinted src={photo} alt="" loading="lazy"/> : initiale}
    </span>
  );
}
// La coche qui se dessine (un trait), ou rien.
const Coche = ({ className = '' }) => (
  <svg className={'vrm-cr-coche ' + className} viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

function Etape({ e, i }) {
  return (
    <li className="vrm-cr-etape" data-cr-etape={e.id} data-cr-etat={e.etat} data-cr-n={e.n == null ? '' : String(e.n)} style={{ '--i': i }}>
      <span className="vrm-cr-indic" aria-hidden="true">{e.etat === 'lu' ? <Coche/> : null}</span>
      <span className="vrm-cr-etape-texte">
        <span className="vrm-cr-etape-titre">{e.titre}</span>
        {e.geste ? <span className="vrm-cr-geste" data-cr-geste="">{e.geste}</span> : null}
      </span>
      <span className="vrm-cr-etape-valeur">{e.texte}</span>
    </li>
  );
}

function ChoixCompte({ c, nb }) {
  const [labels, setLabels] = React.useState(labelsVinted);
  const [masques, setMasques] = React.useState(() => new Set((load('vinted_accounts_hidden', []) || []).map(String)));
  const [exclus, setExclus] = React.useState(() => { const v = load(CLE_COMPTES_EXCLUS, {}); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; });
  const vinted = c.plateforme === 'vinted';
  const refEx = c.plateforme === 'ebay' ? c.id : c.id;
  const inclus = vinted ? !masques.has(String(c.id)) : !estExclu(exclus, c.plateforme, refEx);
  const basculer = () => {
    if (vinted) { setMasques((prev) => { const n = new Set(prev); const k = String(c.id); if (n.has(k)) n.delete(k); else n.add(k); save('vinted_accounts_hidden', [...n]); return n; }); return; }
    const n = basculerExclu(exclus, c.plateforme, refEx); setExclus(n); save(CLE_COMPTES_EXCLUS, n);
  };
  const ecrit = (() => { try { return lireReglageNumeroEcrit(load(CLE_NUMERO_ECRIT, null)).actif; } catch (_) { return false; } })();
  return (
    <div className="vrm-cr-choix" data-cr-choix={c.cle}>
      {vinted && (
        <label className="vrm-cr-champ">
          <span className="vrm-cr-champ-lib">Nom court</span>
          <input className="vrm-cr-saisie" defaultValue={labels[c.id] || ''} placeholder={c.nom || `n° ${c.id}`} aria-label={`Nom court de ${c.nom || 'ce compte'}`} data-cr-nom=""
            onBlur={(ev) => { const v = ev.target.value.trim().slice(0, 40); const u = { ...labelsVinted(), [c.id]: v }; if (!v) delete u[c.id]; setLabels(u); save('vinted_account_labels', u); }}/>
        </label>
      )}
      <label className="vrm-cr-ligne-choix">
        <span className="vrm-cr-ligne-texte">
          <span className="vrm-cr-champ-lib">Dans tes totaux et ton bilan</span>
          <span className="vrm-cr-aide">{inclus ? 'Ses ventes comptent dans ton chiffre.' : vinted ? 'Écarté : ses annonces et ses ventes sortent des écrans. Réversible dans Comptes liés.' : 'Écarté : ses ventes ne comptent pas.'}</span>
        </span>
        <span className="vrm-cr-switch">
          <input type="checkbox" role="switch" checked={inclus} onChange={basculer} aria-label={`${c.nom || 'Ce compte'} dans tes totaux`} data-cr-inclus={inclus ? '1' : '0'}/>
          <span aria-hidden="true"/>
        </span>
      </label>
      {vinted && (
        <p className="vrm-cr-regle" data-cr-numeros={ecrit ? 'toi' : 'suite'}>
          <span className="vrm-cr-champ-lib">Numéros</span>
          {ecrit ? 'Tu numérotes toi-même : VRM ne pose aucun N° sur ses annonces.' : `Ses annonces sans N° en reçoivent un, à la suite. Aucun N° déjà écrit là où tes articles sont rangés ne change${nb > 1 ? ', sur aucun compte' : ''}.`}
        </p>
      )}
    </div>
  );
}

function CarteCompte({ c, etapes, photo, seul, nb }) {
  const fini = lectureFinie(etapes);
  return (
    <section className="vrm-cr-carte" data-cr-compte={c.cle} data-cr-fini={fini ? '1' : '0'}>
      {!seul && (
        <div className="vrm-cr-carte-tete">
          <Avatar nom={c.nom || nomCompteLie(c)} photo={photo}/>
          <span className="vrm-cr-carte-nom vrm-sensible">{c.nom || nomCompteLie(c)}</span>
          <span className="vrm-cr-carte-plat">{NOM_PLATEFORME_RELIEE[c.plateforme]}</span>
        </div>
      )}
      <div className="vrm-cr-sous-titre">{fini ? 'Première lecture faite' : 'Première lecture'}</div>
      <ol className="vrm-cr-etapes">{etapes.map((e, i) => <Etape key={e.id} e={e} i={i}/>)}</ol>
      <ChoixCompte c={c} nb={nb}/>
    </section>
  );
}

function FeuilleComptesRelies({ comptes, memo, autres, relireAutres, revoir, onFermer, onNav }) {
  const uids = React.useMemo(() => comptes.filter((c) => c.plateforme === 'vinted').map((c) => c.id), [comptes]);
  const [lu, relire] = useLectureVinted(uids, true);
  const [maintenant, setMaintenant] = React.useState(() => Date.now());
  const reduit = React.useMemo(mouvementReduit, []);
  const etapesDe = (c) => {
    const depuis = lu === undefined ? null : vuDepuis(memo, c.cle);
    if (c.plateforme === 'vinted') return etapesPremiereLecture({ plateforme: 'vinted', uid: c.id, lignes: lu === undefined ? [] : lu === null ? null : lu.lignes, depuis, maintenant });
    const l = autres && autres[c.plateforme];
    const x = Array.isArray(l) ? l.find((y) => String(y.id) === String(c.id) || String(y.ref) === String(c.id)) : null;
    return etapesPremiereLecture({ plateforme: c.plateforme, lu: x ? (x.lu || null) : null, passu: l === null, depuis, maintenant });
  };
  const tout = comptes.map((c) => ({ c, etapes: etapesDe(c) }));
  const fini = tout.every((x) => lectureFinie(x.etapes));
  // Tant que la lecture n'est pas finie : relire toutes les 8 s (et au signal de l'extension).
  React.useEffect(() => {
    if (fini) return undefined;
    const t = setInterval(() => { setMaintenant(Date.now()); relire(); if (comptes.some((c) => c.plateforme !== 'vinted')) relireAutres(); }, 8000);
    const f = (e) => { const d = e && e.detail; if (d && d.type === 'maj') relire(); };
    window.addEventListener('vrm:ext', f);
    return () => { clearInterval(t); window.removeEventListener('vrm:ext', f); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fini]);
  const seul = comptes.length === 1;
  const c0 = comptes[0];
  const nom0 = c0.nom || nomCompteLie(c0);
  const photo = (c) => (c.plateforme === 'vinted' && lu && lu.photos ? lu.photos[c.id] || '' : '');
  const titre = seul ? `${nom0} est relié à VRM` : `${comptes.length} comptes reliés à VRM`;
  const sous = seul ? `Compte ${NOM_PLATEFORME_RELIEE[c0.plateforme]} · ${fini ? 'tout est lu.' : 'VRM fait sa première lecture.'}` : (fini ? 'Tout est lu.' : 'VRM fait leur première lecture.');
  const voir = () => { onFermer(); if (onNav) onNav(comptes.some((c) => c.plateforme === 'vinted') ? 'ventes' : 'vintedaccounts'); };
  return (
    <SheetShell onClose={onFermer} maxWidth={480} z={8600} data-compte-relie-feuille={comptes.length} data-cr-revoir={revoir ? '1' : '0'} data-cr-mouvement={reduit ? 'reduit' : 'plein'}>
      <div className={'vrm-cr' + (reduit ? ' is-reduit' : '')} data-cr-fini={fini ? '1' : '0'}>
        <div className="vrm-cr-tete">
          <div className="vrm-cr-avatars" data-cr-avatars={comptes.length}>
            {comptes.slice(0, 3).map((c, i) => <span key={c.cle} className="vrm-cr-avatar-pos" style={{ '--i': i }}><Avatar nom={c.nom || nomCompteLie(c)} photo={photo(c)} grand/></span>)}
            <span className="vrm-cr-badge" aria-hidden="true"><Coche className="is-badge"/></span>
          </div>
          <h2 className="vrm-cr-titre vrm-sensible" data-cr-titre="">{titre}</h2>
          <p className="vrm-cr-phrase">{sous}</p>
        </div>
        {tout.map(({ c, etapes }) => <CarteCompte key={c.cle} c={c} etapes={etapes} photo={photo(c)} seul={seul} nb={comptes.length}/>)}
        <div className="vrm-cr-pied">
          <Bouton variante="primaire" plein onClick={voir} data-cr-voir="">{comptes.some((c) => c.plateforme === 'vinted') ? (seul ? 'Voir ses ventes' : 'Voir les ventes') : 'Voir les comptes'}</Bouton>
          <Bouton variante="discret" onClick={onFermer} data-cr-fermer="">Fermer</Bouton>
        </div>
      </div>
    </SheetShell>
  );
}

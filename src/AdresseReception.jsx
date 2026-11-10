// ══════════════════════════════════════════════════════════════════════════════
// « TON ADRESSE VRM » — LE parcours unique (8 nov. ; refait le 10 nov. au soir)
// ══════════════════════════════════════════════════════════════════════════════
// Julien, 10 nov. : « je veux que ce soit beaucoup plus simple et intuitif, je
// veux que tout soit plus beau » ; « pk ça charge en continu ». Il déteste les
// murs de texte et les pop-ups qui ne font que déplacer le texte.
//
// UN SEUL parcours, le même partout (E-mails → Relier ma boîte, en tête ; et
// Paramètres → Mes e-mails → Mon adresse VRM, dans une feuille) :
//   barre 1 · 2 · 3 · ✓, une étape à l'écran, reprise là où il s'est arrêté ;
//   1. « Ton adresse VRM » en grand, « Copier » d'un toucher ;
//   2. le transfert : le compte (puces), son adresse Vinted, SA messagerie
//      détectée par le domaine (une grande tuile ; les autres sous « Autre
//      messagerie »), 3 pas = une phrase + un bouton (la bonne page de réglages).
//      Le code de confirmation que Gmail envoie à l'adresse VRM s'affiche ici,
//      tout seul, avec « Copier » et « Confirmer dans Gmail » (SON clic).
//      Adresse « Masquer mon adresse » d'Apple : « Choisis où Apple fait
//      suivre » + la liste des boîtes déjà reliées ;
//   3. l'e-mail d'essai, suivi en direct : en attente (calme) → « Reçu ✓ ».
// La règle vit au serveur (api/_lib/adresse-reception.js, route
// `email-rattacher?mode=adresse-unique`) : ici, on la MONTRE. Trois états :
// `undefined` en cours · `null` pas su (EtatPanne, Réessayer) · lu.
// ⚠️ Jamais de roue qui tourne sans fin : la roue seulement pendant SA
//    vérification ; sinon une horloge et « vérifié à … ».
// ══════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SheetShell } from './composants/SheetShell.jsx';
import { GroupeIos, RangeeIos } from './composants/Ios.jsx';
import { EtatPanne } from './composants/EtatPanne.jsx';
import { requeteJsonBornee } from './requeteJsonBornee.js';
import { ROUTE_ADRESSE, etatAdresse, codeAMontrer, ilYa, NOM_FOURNISSEUR, FOURNISSEURS, CE_QUI_EST_LU, lienEssai, ETAPES_FILTRE_GMAIL, nouveauCodeEssai, sujetEssai, etatEssai, gestesMiseEnService, DOC_MISE_EN_SERVICE, messagerieDeDomaine, messagerieDetectee, PAS_RELAIS, lienConfirmationSur, etapeDuParcours, CLE_PARCOURS } from './adresseReception.js';
import { EXPEDITEURS, regleFiltre } from './relierBoite.js';
import { ChoixCompte, Verification, IconeHorloge, IconeCoche, Roue } from './RelierCompte.jsx';
import './adresse-reception.css';

const Svg = ({ children, t = 18 }) => <svg viewBox="0 0 24 24" width={t} height={t} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
const ICONES = {
  arobase: <Svg><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></Svg>,
  vinted: <Svg><path d="M4 7h16l-1.5 12a2 2 0 0 1-2 1.8h-9a2 2 0 0 1-2-1.8z"/><path d="M9 7a3 3 0 0 1 6 0"/></Svg>,
  transporteurs: <Svg><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/></Svg>,
  sites: <Svg><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18"/></Svg>,
  actif: <Svg><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></Svg>,
  ouvrir: <Svg t={16}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></Svg>,
};

async function copier(texte) {
  try { await navigator.clipboard.writeText(texte); return true; } catch (_) {}
  try {
    const z = document.createElement('textarea'); z.value = texte; z.setAttribute('readonly', ''); z.style.position = 'fixed'; z.style.opacity = '0';
    document.body.appendChild(z); z.select(); const ok = document.execCommand('copy'); z.remove(); return ok;
  } catch (_) { return false; }
}

function BoutonCopier({ texte, mot = 'Copier', fait = 'Copié', className = 'vrm-b vrm-b-primaire', onCopie, ...rest }) {
  const [etat, setEtat] = useState('');
  const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button type="button" className={className} data-copie={etat || undefined} {...rest}
      onClick={async () => { const ok = await copier(texte); setEtat(ok ? 'ok' : 'ko'); if (ok && onCopie) onCopie(); clearTimeout(t.current); t.current = setTimeout(() => setEtat(''), 2200); }}>
      <span aria-live="polite">{etat === 'ok' ? `${fait} ✓` : etat === 'ko' ? 'Sélectionne-la' : mot}</span>
    </button>
  );
}

// La reprise : l'étape où il s'est arrêté et la messagerie choisie, sur CET
// appareil (un confort ; la preuve, elle, est au serveur).
const lireReprise = (adresse) => { try { const x = JSON.parse(localStorage.getItem(CLE_PARCOURS) || 'null'); return x && x.adresse === adresse ? x : null; } catch (_) { return null; } };
const ecrireReprise = (x) => { try { localStorage.setItem(CLE_PARCOURS, JSON.stringify(x)); } catch (_) {} };
// L'essai en cours, gardé sur CET appareil (il revient après un passage par l'app d'e-mail).
const CLE_ESSAI = 'vrm_essai_adresse_reception';
const lireEssaiLocal = (adresse) => { try { const x = JSON.parse(localStorage.getItem(CLE_ESSAI) || 'null'); return x && x.adresse === adresse && /^[A-Z2-9]{4}$/.test(x.code || '') ? x : null; } catch (_) { return null; } };
const ecrireEssaiLocal = (x) => { try { if (x) localStorage.setItem(CLE_ESSAI, JSON.stringify(x)); else localStorage.removeItem(CLE_ESSAI); } catch (_) {} };
// L'adresse de connexion à VRM (un indice de plus pour la messagerie ; jamais envoyée).
const adresseSession = () => { try { const s = JSON.parse(localStorage.getItem('vrm_session') || 'null'); return String((s && s.user && s.user.email) || ''); } catch (_) { return ''; } };
const heure = (ms) => (ms ? new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');
const espaceCode = (c) => String(c || '').replace(/(\d{3})(?=\d)/g, '$1 ');

// ── La lecture de l'adresse (et sa relecture, page visible) ─────────────────
function useAdresseVrm(headers, rapide) {
  const [d, setD] = useState(undefined);
  const [luA, setLuA] = useState(0);
  const [manuel, setManuel] = useState(false);
  const [maintenant, setMaintenant] = useState(Date.now());
  const auth = useRef(headers); auth.current = headers;
  const enCours = useRef(null);
  const appeler = useCallback(async (methode = 'GET', corps) => {
    enCours.current?.abort();
    const controle = new AbortController(); enCours.current = controle;
    try {
      const h = typeof auth.current === 'function' ? auth.current() : (auth.current || {});
      const r = await requeteJsonBornee(ROUTE_ADRESSE, { method: methode, cache: 'no-store', signal: controle.signal, headers: { ...h, ...(corps ? { 'Content-Type': 'application/json' } : {}) }, body: corps ? JSON.stringify(corps) : undefined });
      if (!r.ok || !r.json || r.json.ok !== true) return { ko: true, message: (r.json && r.json.message) || '' };
      setD(r.json); setMaintenant(Date.now()); setLuA(Date.now());
      return { ok: true };
    } catch (e) { return { ko: true, abandon: controle.signal.aborted }; }
    finally { if (enCours.current === controle) enCours.current = null; }
  }, []);
  const lire = useCallback(async (parLui = false) => {
    if (parLui) setManuel(true);
    const r = await appeler('GET');
    if (parLui) setManuel(false);
    if (r.ko && !r.abandon) setD((x) => (x === undefined ? null : x));
    return r;
  }, [appeler]);
  useEffect(() => {
    lire();
    const t = setInterval(() => { if (document.visibilityState === 'visible') lire(); else setMaintenant(Date.now()); }, 30000);
    const retourPage = () => { if (document.visibilityState === 'visible') lire(); };
    document.addEventListener('visibilitychange', retourPage);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', retourPage); enCours.current?.abort(); };
  }, [lire]);
  // Pendant l'attente (essai ou code) : relue toutes les 5 s, page visible — sans roue.
  useEffect(() => {
    if (!rapide) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') lire(); else setMaintenant(Date.now()); }, 5000);
    return () => clearInterval(t);
  }, [rapide, lire]);
  return { d, setD, lire, appeler, luA, manuel, maintenant, setMaintenant };
}

// ── La barre 1 · 2 · 3 · ✓ ──────────────────────────────────────────────────
const ETAPES = [[1, 'Adresse'], [2, 'Transfert'], [3, 'Essai'], [4, 'Reçu']];
function Progression({ etape, onAller }) {
  return (
    <ol className="vrm-pv-barre" data-progression={etape} aria-label="Ton avancée">
      {ETAPES.map(([n, mot]) => {
        const fait = etape > n || etape === 4;
        return (
          <li key={n} data-pas-barre={n} data-fait={fait ? '1' : undefined} aria-current={etape === n ? 'step' : undefined}>
            <button type="button" className="vrm-pv-barre-btn" onClick={() => onAller(n)} disabled={n === 4 && etape !== 4} aria-label={`Étape ${n === 4 ? '✓' : n} : ${mot}`}>
              <span className="vrm-pv-barre-rond" aria-hidden="true">{n === 4 || (fait && n < 4) ? <IconeCoche t={14}/> : n}</span>
              <span className="vrm-pv-barre-mot">{mot}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ── Le code de confirmation (Gmail, Yahoo, Outlook), affiché tout seul ──────
function CodeConfirmation({ code, maintenant, luA }) {
  if (!code) {
    return (
      <div className="vrm-pv-code" data-code-etape="attente">
        <span className="vrm-pv-etat-ic"><IconeHorloge/></span>
        <span className="vrm-pv-etat-txt"><b>Le code arrive ici, tout seul</b><span className="vrm-pv-etat-quand">{luA ? `vérifié à ${heure(luA)}` : ''}</span></span>
      </div>
    );
  }
  const nom = NOM_FOURNISSEUR[code.fournisseur] || 'ta messagerie';
  const lien = lienConfirmationSur(code);
  return (
    <section className="vrm-pv-code vrm-pv-code-recu" data-code-transfert={code.fournisseur} data-code-etape="recu" aria-label={`Confirmation de ${nom}`}>
      <p className="vrm-pv-code-sur">Code de {nom} · {ilYa(code.recuLe, maintenant)}</p>
      {code.code ? <p className="vrm-pv-code-valeur" data-code-valeur={code.code} translate="no">{espaceCode(code.code)}</p> : null}
      {code.source ? <p className="vrm-pv-note">Pour <b>{code.source}</b>. Pas ta boîte ? Ne confirme pas.</p> : null}
      {code.fournisseur === 'gmail' && !code.signe ? <p className="vrm-pv-note" data-code-non-signe="">Signature de Google non vérifiée.</p> : null}
      <div className="vrm-pv-actions">
        {code.code ? <BoutonCopier texte={code.code} mot="Copier le code" data-copier-code=""/> : null}
        {lien ? <a className={code.code ? 'vrm-b vrm-b-secondaire' : 'vrm-b vrm-b-primaire'} href={lien} target="_blank" rel="noopener noreferrer" data-lien-confirmation="">Confirmer dans {nom} ↗</a> : null}
      </div>
    </section>
  );
}

// Un pas : sa pastille, sa phrase, son bouton.
function Pas({ n, t, children }) {
  return (
    <li className="vrm-pv-pas" data-pas={n}>
      <span className="vrm-pv-pas-num" aria-hidden="true">{n}</span>
      <div className="vrm-pv-pas-corps"><p>{t}</p>{children}</div>
    </li>
  );
}

// Pas encore ouverte, vue du PROPRIÉTAIRE : ce qui manque (états de la route).
function MiseEnService({ m }) {
  const g = gestesMiseEnService(m);
  const MOT = { fait: 'Fait', 'a-faire': 'À faire', 'a-verifier': 'À vérifier' };
  return (
    <div className="vrm-ar-mes" data-mise-en-service="">
      <p className="vrm-pv-note">Toi seul vois ceci. Ce qui manque :</p>
      <ol className="vrm-ar-mes-liste">
        {g.map((x) => (
          <li key={x.id} data-geste={x.id} data-geste-etat={x.etat}>
            <span className="vrm-ar-mes-titre">{x.titre}</span>
            <span className="vrm-ar-mes-etat">{MOT[x.etat]}</span>
            <span className="vrm-ar-mes-detail">{x.detail}</span>
          </li>
        ))}
      </ol>
      <p className="vrm-pv-note">Le pas-à-pas : <code>{DOC_MISE_EN_SERVICE}</code></p>
    </div>
  );
}

// ══ LE PARCOURS ═══════════════════════════════════════════════════════════════
// `comptes` : les comptes à relier (src/relierCompte.js) ; `uid` : celui choisi ;
// `boites` : les boîtes qui arrivent déjà à VRM ; `lireDernier` : la preuve d'un
// compte ; `onPret(bool)` : l'adresse est-elle ouverte ? (l'écran garde l'ancien
// guide quand elle ne l'est pas).
export function ParcoursAdresseVrm({ headers, proprio = false, onBoite, comptes = [], uid = '', onChoisir, boites = [], lireDernier, onRelie, onPret, adressesConnues = [], onFermer }) {
  const [envoi, setEnvoi] = useState('');
  const [retour, setRetour] = useState('');
  const [confirmer, setConfirmer] = useState(false);
  const [essai, setEssai] = useState(null);
  const [prepare, setPrepare] = useState(() => nouveauCodeEssai());
  const [voulue, setVoulue] = useState(1);
  const [choixMessagerie, setChoixMessagerie] = useState('');
  const [voirAutres, setVoirAutres] = useState(false);
  const [boiteApple, setBoiteApple] = useState('');
  const [relies, setRelies] = useState(() => new Set());
  const essaiAttendu = useRef(false);
  const { d, setD, lire, appeler, luA, manuel, maintenant, setMaintenant } = useAdresseVrm(headers, essaiAttendu.current);

  const pret = !!(d && d.pret);
  const adresse = pret ? d.adresse : '';
  useEffect(() => { if (d !== undefined && onPret) onPret(d === null ? null : !!(d && d.pret)); }, [d, onPret]);
  const eEssai = etatEssai(d, essai, maintenant);
  const code = codeAMontrer(d, maintenant) ? d.code : null;
  essaiAttendu.current = eEssai.etat === 'attente' || eEssai.etat === 'passu' || (voulue === 2 && !code);

  const liste = Array.isArray(comptes) ? comptes : [];
  const c = liste.find((x) => x.uid === String(uid)) || null;
  const relie = !!(c && relies.has(c.uid));
  const etape = etapeDuParcours({ voulue, essai: eEssai.etat, relie, code: !!code });

  // La reprise : relue quand l'adresse est connue.
  useEffect(() => {
    if (!adresse) return;
    const x = lireReprise(adresse);
    if (x) { setVoulue(x.etape || 1); if (x.messagerie) setChoixMessagerie(x.messagerie); }
    const e = lireEssaiLocal(adresse); setEssai(e); if (e) setPrepare(e.code);
  }, [adresse]);
  // Un compte choisi depuis ailleurs (« Relier la boîte de … ») : droit au transfert.
  const uidPrec = useRef(uid);
  useEffect(() => { if (uid && uid !== uidPrec.current) { setVoulue((v) => (v < 2 ? 2 : v)); setChoixMessagerie(''); setVoirAutres(false); } uidPrec.current = uid; }, [uid]);
  useEffect(() => { if (uid) setVoulue((v) => (v < 2 ? 2 : v)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const aller = (n) => {
    if (n === 4) return;
    setVoulue(n); if (adresse) ecrireReprise({ adresse, etape: n, messagerie: choixMessagerie });
    if (n === 3) lire();
  };
  const choisirMessagerie = (m) => { setChoixMessagerie(m); setVoirAutres(false); if (adresse) ecrireReprise({ adresse, etape: voulue, messagerie: m }); };

  const lancerEssai = (cd) => {
    if (!adresse || (essai && essai.code === cd && eEssai.etat !== 'trop-long')) return;
    const x = { adresse, code: cd, depuis: Date.now() };
    setEssai(x); ecrireEssaiLocal(x); setMaintenant(Date.now());
  };
  const recommencerEssai = () => { const cd = nouveauCodeEssai(); setEssai(null); ecrireEssaiLocal(null); setPrepare(cd); setVoulue(3); if (adresse) ecrireReprise({ adresse, etape: 3, messagerie: choixMessagerie }); };
  const noterRelie = useCallback((u) => { setRelies((s) => (s.has(u) ? s : new Set([...s, u]))); if (onRelie) onRelie(u); }, [onRelie]);

  const basculer = async (actif) => {
    if (envoi || !d) return;
    const avant = d;
    setEnvoi('actif'); setRetour(''); setD({ ...d, actif });
    const r = await appeler('POST', { geste: 'actif', actif });
    if (r.ko) { setD(avant); setRetour(r.message || 'Pas enregistré. Réessaie.'); }
    setEnvoi('');
  };
  const remplacer = async () => {
    if (envoi) return;
    setEnvoi('remplacer'); setRetour('');
    const r = await appeler('POST', { geste: 'remplacer' });
    setEnvoi(''); setConfirmer(false);
    if (!r.ko) { recommencerEssai(); setVoulue(1); }
    setRetour(r.ko ? (r.message || 'Pas remplacée. Réessaie.') : 'Adresse remplacée. Mets la nouvelle dans ton transfert.');
  };

  // La messagerie : celle choisie, sinon celle de l'adresse du compte, sinon détectée.
  const mCompte = c ? messagerieDeDomaine(c.adresse) : '';
  const relais = !choixMessagerie && mCompte === 'relais-apple';
  const detectee = c ? (mCompte && mCompte !== 'relais-apple' ? mCompte : '') : messagerieDetectee([code && code.source, ...boites, ...adressesConnues, adresseSession()]);
  const mId = choixMessagerie || detectee || '';
  const f = FOURNISSEURS.find((x) => x.id === mId) || null;
  const regle = regleFiltre('gmail', EXPEDITEURS.map((x) => x.id)).texte;
  const [local, domaine] = adresse ? [adresse.slice(0, adresse.indexOf('@')), adresse.slice(adresse.indexOf('@'))] : ['', ''];
  const eAdr = etatAdresse(d, maintenant);
  const boiteRelais = boiteApple || boites[0] || '';

  const etat = d === undefined ? 'lecture' : d === null ? 'pas-su' : !d.pret ? 'pas-prete' : d.actif === false ? 'off' : 'active';
  const geste = (p, i) => {
    if (p.geste === 'ouvrir' && (p.lien || f.lien)) return <a className="vrm-b vrm-b-secondaire vrm-pv-ouvrir" href={p.lien || f.lien} target="_blank" rel="noopener noreferrer" data-ouvrir-messagerie={f ? f.id : 'relais'}>{p.lienMot || f.lienMot} {ICONES.ouvrir}</a>;
    if (p.geste === 'copier') return <BoutonCopier texte={adresse} mot="Copier mon adresse VRM" fait="Copiée" className="vrm-b vrm-b-secondaire" data-copier-pas={i}/>;
    if (p.geste === 'vinted') return <BoutonCopier texte="vinted" mot="Copier « vinted »" className="vrm-b vrm-b-secondaire"/>;
    if (p.geste === 'code') return <CodeConfirmation code={code} maintenant={maintenant} luA={luA}/>;
    if (p.geste === 'boite') return boites.length
      ? <label className="vrm-pv-select"><span className="vrm-ar-hors-champ">Boîte qui reçoit</span>
          <select value={boiteRelais} onChange={(ev) => setBoiteApple(ev.target.value)} data-relais-boite="">{boites.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
      : <p className="vrm-pv-note" data-relais-boite="aucune">Aucune boîte reliée pour l’instant.</p>;
    return null;
  };

  return (
    <div className="vrm-pv" data-parcours-adresse="" data-etat={etat} data-etape={pret ? etape : undefined}
      {...(c ? { 'data-relier-compte': c.uid, 'data-relier-compte-messagerie': c.messagerie } : {})}>
      {d === undefined && <div className="vrm-pv-carte vrm-ar-squelette" role="status" aria-label="Lecture de ton adresse…"><span/><span/><span/></div>}
      {d === null && <EtatPanne quoi="Ton adresse VRM" raison="La lecture n’a pas abouti. Rien n’a changé." onReessayer={() => lire(true)} data-adresse-reception="pas-su"/>}
      {d && !d.pret && (
        <section className="vrm-pv-carte vrm-ar-fermee" data-adresse-reception="pas-prete">
          <span className="vrm-ar-tuile" aria-hidden="true">{ICONES.arobase}</span>
          <h2>Bientôt disponible</h2>
          <p>Ton adresse VRM n’est pas encore ouverte.</p>
          {d.manque === 'cloisonnement' ? <p className="vrm-pv-note">Elle demande une base séparée par vendeur.</p> : null}
          {d.proprio === true || proprio ? <MiseEnService m={d.miseEnService}/> : null}
        </section>
      )}
      {d && !d.pret && liste.length ? (
        <section className="vrm-pv-carte" data-bloc="comptes">
          <h3 className="vrm-pv-titre">Quel compte ?</h3>
          <ChoixCompte comptes={liste} uid={c ? c.uid : ''} onChoisir={onChoisir}/>
          {c ? <Verification key={c.uid} compte={c} lireDernier={lireDernier} onRelie={noterRelie}/> : null}
        </section>
      ) : null}

      {pret && <>
        <Progression etape={etape} onAller={aller}/>

        {etape === 1 && (
          <section className="vrm-pv-carte vrm-pv-hero" data-bloc="adresse" data-actif={d.actif === false ? '0' : '1'} aria-label="Étape 1 : ton adresse VRM">
            <h2 className="vrm-pv-grand-titre">Ton adresse VRM</h2>
            <p className="vrm-pv-adresse" data-adresse-reception={adresse} translate="no"><span>{local}</span><wbr/><span className="vrm-pv-domaine">{domaine}</span></p>
            <div className="vrm-pv-actions">
              <BoutonCopier texte={adresse} mot="Copier l’adresse" fait="Copiée" data-copier-adresse="" className="vrm-b vrm-b-primaire vrm-pv-gros"/>
              <button type="button" className="vrm-b vrm-b-secondaire vrm-pv-gros" onClick={() => aller(2)} data-suivant="2">Suivant</button>
            </div>
            <p className="vrm-pv-ligne" data-ton={eAdr.ton} data-dernier={d.dernier ? d.dernier.at : ''}><span className="vrm-ar-point" aria-hidden="true"/>{eAdr.phrase}</p>
          </section>
        )}

        {etape === 2 && (
          <section className="vrm-pv-carte" data-bloc="transfert" aria-label="Étape 2 : le transfert">
            <h2 className="vrm-pv-grand-titre">Fais suivre tes e-mails</h2>
            {liste.length ? <ChoixCompte comptes={liste} uid={c ? c.uid : ''} onChoisir={onChoisir}/> : null}
            {c ? (
              <div className="vrm-pv-source" data-relier-compte-adresse-ligne="">
                <span className="vrm-pv-source-mot">Boîte de {c.login}</span>
                {c.adresse ? <code data-relier-compte-adresse="" className="vrm-sensible">{c.adresse}</code> : <em data-relier-compte-adresse="absente">pas notée (Comptes liés → Gérer)</em>}
                {c.adresse ? <BoutonCopier texte={c.adresse} mot="Copier" className="vrm-b vrm-b-discret vrm-pv-petit"/> : null}
              </div>
            ) : null}
            {relais ? (
              <div className="vrm-pv-relais" data-relier-boites={boites.length}>
                <p className="vrm-pv-phrase"><b>Choisis où Apple fait suivre.</b></p>
                <ol className="vrm-pv-pas-liste" data-etapes="relais-apple">{PAS_RELAIS.map((p, i) => <Pas key={i} n={i + 1} t={p.t}>{geste(p, i)}</Pas>)}</ol>
                <button type="button" className="vrm-lien-action vrm-ar-lien" onClick={() => { setChoixMessagerie('autre'); setVoirAutres(true); }} data-relais-autre="">Une autre boîte ?</button>
              </div>
            ) : (<>
              {f && !voirAutres ? (
                <div className="vrm-pv-tuile" data-messagerie-tuile={f.id}>
                  <span className="vrm-pv-tuile-logo" aria-hidden="true" data-logo={f.id}>{f.lettre}</span>
                  <span className="vrm-pv-tuile-nom"><b>{f.nom}</b><span>{choixMessagerie ? 'Ta messagerie' : 'Détectée d’après ton adresse'}</span></span>
                  <button type="button" className="vrm-lien-action vrm-pv-changer" onClick={() => setVoirAutres(true)} data-autre-messagerie="">Autre messagerie</button>
                </div>
              ) : (
                <div className="vrm-ar-choix" role="radiogroup" aria-label="Ta messagerie" data-choix-messagerie="">
                  {FOURNISSEURS.map((x) => (
                    <button key={x.id} type="button" role="radio" aria-checked={x.id === mId} className="vrm-ar-choix-btn" data-fournisseur={x.id} onClick={() => choisirMessagerie(x.id)}>{x.nom}</button>
                  ))}
                </div>
              )}
              {f ? <ol className="vrm-pv-pas-liste" data-etapes={f.id}>{f.pas.map((p, i) => <Pas key={f.id + i} n={i + 1} t={p.t}>{geste(p, i)}</Pas>)}</ol> : null}
              {code && !(f && f.pas.some((p) => p.geste === 'code')) ? <CodeConfirmation code={code} maintenant={maintenant} luA={luA}/> : null}
              {f && f.filtre ? (
                <details className="vrm-ar-repli" data-bloc="filtre-gmail">
                  <summary>Seulement Vinted et les colis ?</summary>
                  <ol className="vrm-ar-etapes">{ETAPES_FILTRE_GMAIL.map((t, i) => <li key={i}><span className="vrm-ar-num" aria-hidden="true">{i + 1}</span><span>{t}</span></li>)}</ol>
                  <p className="vrm-ar-regle" translate="no" data-regle-filtre="">{regle}</p>
                  <div className="vrm-pv-actions"><BoutonCopier texte={regle} mot="Copier la règle" className="vrm-b vrm-b-secondaire" data-copier-regle=""/></div>
                </details>
              ) : null}
            </>)}
            {c ? <Verification key={c.uid} compte={c} lireDernier={lireDernier} onRelie={noterRelie}/> : null}
            <div className="vrm-pv-actions vrm-pv-pied-etape">
              <button type="button" className="vrm-b vrm-b-primaire vrm-pv-gros" onClick={() => aller(3)} data-suivant="3">C’est fait</button>
            </div>
          </section>
        )}

        {etape === 3 && (
          <section className="vrm-pv-carte" data-bloc="essai" data-essai-etat={eEssai.etat} aria-label="Étape 3 : l'essai">
            <h2 className="vrm-pv-grand-titre">Vérifie que ça marche</h2>
            <p className="vrm-pv-phrase">Envoie-toi un e-mail d’essai.</p>
            <p className="vrm-ar-objet">Objet : <b translate="no" data-essai-code={essai ? essai.code : prepare}>{sujetEssai(essai ? essai.code : prepare)}</b></p>
            <div className="vrm-pv-actions">
              <a className={'vrm-b vrm-pv-gros ' + (eEssai.etat === 'repos' ? 'vrm-b-primaire' : 'vrm-b-secondaire')} href={lienEssai(adresse, essai ? essai.code : prepare)} data-essai="" onClick={() => lancerEssai(essai ? essai.code : prepare)}>{eEssai.etat === 'repos' ? 'Envoyer l’e-mail d’essai' : 'Le renvoyer'}</a>
              <BoutonCopier texte={sujetEssai(essai ? essai.code : prepare)} mot="Copier l’objet" className="vrm-b vrm-b-secondaire" data-copier-objet="" onCopie={() => lancerEssai(essai ? essai.code : prepare)}/>
            </div>
            {eEssai.etat !== 'repos' ? (
              <div className="vrm-pv-etat" data-essai-phrase="" data-ton={eEssai.etat === 'trop-long' ? 'ambre' : eEssai.etat === 'passu' ? 'passu' : 'attente'} role="status" aria-live="polite">
                <span className="vrm-pv-etat-ic">{manuel ? <Roue/> : <IconeHorloge/>}</span>
                <span className="vrm-pv-etat-txt"><b>{eEssai.etat === 'trop-long' ? 'Pas encore reçu' : eEssai.etat === 'passu' ? 'Pas su pour l’instant' : 'En attente…'}</b>
                  <span className="vrm-pv-etat-quand">{eEssai.etat === 'trop-long' ? 'Vérifie l’adresse collée' : luA ? `vérifié à ${heure(luA)}` : ''}</span></span>
                <button type="button" className="vrm-pv-verifier" disabled={manuel} onClick={() => lire(true)} data-essai-verifier="">Vérifier</button>
              </div>
            ) : null}
            {eEssai.etat === 'trop-long' ? <button type="button" className="vrm-lien-action vrm-ar-lien" onClick={recommencerEssai} data-essai-refaire="">Nouveau code</button> : null}
            {c ? <Verification key={c.uid} compte={c} lireDernier={lireDernier} onRelie={noterRelie}/> : null}
          </section>
        )}

        {etape === 4 && (
          <section className="vrm-pv-carte vrm-pv-fini" data-bloc="recu" role="status" data-essai-recu={essai ? essai.code : ''}>
            <span className="vrm-pv-fini-rond" aria-hidden="true"><IconeCoche t={34}/></span>
            <h2 className="vrm-pv-fini-titre">Reçu ✓</h2>
            <p className="vrm-pv-phrase">{relie && c ? `Les e-mails de ${c.login} arrivent.` : 'Ton adresse VRM marche.'}{eEssai.at ? ` ${ilYa(eEssai.at, maintenant)}` : ''}</p>
            <div className="vrm-pv-actions">
              {onBoite ? <button type="button" className="vrm-b vrm-b-primaire vrm-pv-gros" onClick={() => { onFermer && onFermer(); onBoite(); }} data-ouvrir-boite="">Voir mes e-mails</button> : null}
              <button type="button" className="vrm-b vrm-b-secondaire vrm-pv-gros" onClick={recommencerEssai} data-essai-refaire="">Refaire un essai</button>
            </div>
            {c ? <Verification key={c.uid} compte={c} lireDernier={lireDernier} onRelie={noterRelie}/> : null}
          </section>
        )}

        {retour ? <p className="vrm-ar-retour" role="status" data-retour="">{retour}</p> : null}
        <details className="vrm-pv-reglages" data-bloc="reglages-adresse">
          <summary>Réglages de l’adresse</summary>
          <GroupeIos pied={d.actif === false ? 'Désactivée : rien n’est rangé chez toi.' : null}>
            <RangeeIos icone={ICONES.actif} titre="Adresse active" interrupteur={{ on: d.actif !== false, onChange: basculer, disabled: !!envoi, label: 'Adresse active', attrs: { 'data-interrupteur-adresse': d.actif === false ? '0' : '1' } }}/>
          </GroupeIos>
          <GroupeIos titre="Ce que VRM lit">
            {CE_QUI_EST_LU.map((l) => <RangeeIos key={l.id} icone={ICONES[l.id]} titre={l.titre} detail={l.detail} data-lu={l.id}/>)}
          </GroupeIos>
          <p className="vrm-pv-note" data-bloc="vinted">Ou mets ton adresse VRM comme e-mail d’un compte Vinted.</p>
          <p className="vrm-pv-note" data-bloc="manuel">Pas de « Transférer » à la main : l’expéditeur se perd.</p>
          {confirmer
            ? <div className="vrm-ar-confirmer" role="group" aria-label="Remplacer l’adresse" data-confirmer-remplacer="">
                <p>L’ancienne s’arrête tout de suite.</p>
                <div className="vrm-pv-actions">
                  <button type="button" className="vrm-b vrm-b-secondaire" onClick={() => setConfirmer(false)} disabled={!!envoi}>Annuler</button>
                  <button type="button" className="vrm-b vrm-b-secondaire vrm-ar-destructif" onClick={remplacer} disabled={!!envoi} data-remplacer-ok="">{envoi === 'remplacer' ? 'Remplacement…' : 'Remplacer'}</button>
                </div>
              </div>
            : <button type="button" className="vrm-b vrm-b-discret" onClick={() => setConfirmer(true)} disabled={!!envoi} data-remplacer="">Remplacer l’adresse</button>}
        </details>
      </>}
    </div>
  );
}

// Paramètres → Mes e-mails → Mon adresse VRM : LE MÊME parcours, dans une feuille.
export function FeuilleAdresseReception({ headers, onFermer, FermeAuRetour, proprio = false, onBoite }) {
  const [etat, setEtat] = useState('lecture');
  return (
    <SheetShell onClose={onFermer} FermeAuRetour={FermeAuRetour} titre="Ton adresse VRM" maxWidth={560} z={9000} className="vrm-ar-feuille" data-feuille-adresse-reception="" data-etat={etat}>
      <ObservateurEtat onEtat={setEtat}>
        <ParcoursAdresseVrm headers={headers} proprio={proprio} onBoite={onBoite} onFermer={onFermer}/>
      </ObservateurEtat>
      <div className="vrm-pv-feuille-pied"><button type="button" className="vrm-b vrm-b-secondaire vrm-ar-termine" onClick={onFermer} data-termine="">Terminé</button></div>
    </SheetShell>
  );
}
// Recopie l'état du parcours sur la feuille (`data-etat`, lu par les bancs).
function ObservateurEtat({ onEtat, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const n = ref.current && ref.current.querySelector('[data-parcours-adresse]');
    if (!n) return undefined;
    const maj = () => onEtat(n.getAttribute('data-etat') || 'lecture');
    maj();
    const o = new MutationObserver(maj); o.observe(n, { attributes: true, attributeFilter: ['data-etat'] });
    return () => o.disconnect();
  }, [onEtat]);
  return <div ref={ref}>{children}</div>;
}

// L'ancienne entrée (une rangée qui ouvre la feuille), gardée pour qui l'importe.
export default function CarteAdresseReception({ headers, FermeAuRetour, proprio = false, onBoite, titre = 'Ton adresse VRM', detail = 'Tes e-mails Vinted arrivent seuls' }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <GroupeIos className="vrm-ar-entree" data-adresse-reception-entree="">
        <RangeeIos icone={ICONES.arobase} titre={titre} detail={detail} onClick={() => setOuvert(true)} data-ouvrir-adresse-reception=""/>
      </GroupeIos>
      {ouvert ? <FeuilleAdresseReception headers={headers} FermeAuRetour={FermeAuRetour} proprio={proprio} onBoite={onBoite} onFermer={() => setOuvert(false)}/> : null}
    </>
  );
}

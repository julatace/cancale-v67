// ════════════════════════════════════════════════════════════════════════════
//  LA FACTURE PRO — les écrans (2 novembre ; 6 novembre)
// ════════════════════════════════════════════════════════════════════════════
// Deux pièces :
//   · `FicheFacturation` — « Ma facture » : ta fiche entreprise (tout ce qu'une
//     facture doit porter), ta personnalisation (logo, couleur, note, message,
//     mentions de paiement), ta numérotation et l'envoi. À droite (en dessous au
//     téléphone), l'APERÇU d'une facture d'exemple se redessine à chaque frappe —
//     même incomplet : chaque mention obligatoire qui manque y est écrite
//     « à compléter » (en ambre).
//   · `FactureVente` — sur une vente d'un compte Pro, dans la liste ET sur la
//     fiche de la vente : « Envoyer la facture » — seulement quand l'acheteur
//     est PROUVÉ (src/facturePro/rattachement.js : même n° de transaction dans la
//     vente Vinted et dans l'e-mail de vente Pro, heure et montant concordants) ;
//     sinon la ligne dit pourquoi, et il n'y a pas de bouton (§5 : mieux vaut un
//     blanc qu'un faux).
//
// La règle vit dans ./facturePro/regle.js et ./facturePro/rattachement.js (les
// mêmes que le serveur) ; le numéro, l'émission, la preuve relue et l'envoi se
// font côté serveur (api/_lib/facture-pro.js). L'app ne fabrique jamais un
// numéro et n'envoie jamais un acheteur : le serveur le relit lui-même.
//
// Les outils de l'app (lecture de la base, confirmation, notifications) sont
// passés par `deps` : ce fichier n'importe rien d'App.jsx.
import { fetchBorne, DELAI_ROUTE_MS, NOM_DELAI } from './reseauBorne.js';
import React from 'react';
import './facture-pro.css';
import './facture-tva.css';
import { bi, EN, paiementAnglais, acheteurHorsFrance } from './facturePro/anglais.js';
import { SheetShell } from './composants/SheetShell.jsx';
import {
  REGIMES_TVA, FORMES, COULEURS, TAUX_TVA, estSociete, verifierSiret, manquantsVendeur, manquantsVente,
  contenuFacture, contenuApercu, estTrou, euros, emailValide, LOGO_MAX, MESSAGE_DEFAUT, nomFichier, jourParis,
  adresseVintedLisible, numeroFacture, anneeParis, emailFacture, MENTIONS_OBLIGATOIRES, mentionsManquantes, refusMarge,
} from './facturePro/regle.js';
import { preuveAcheteur, phraseRefus, FENETRE_APRES_S } from './facturePro/rattachement.js';
import { listeAEnvoyer, autoAllume, lignesRegistre, periodesRegistre, dansPeriode, trousNumerotation, csvRegistre, totauxRegistre, nomZip, SELECT_FACTURES_PRO } from './facturePro/registre.js';
import { useRechercheEntreprise, CarteVerifEntreprise, CarteMentionsForme } from './RechercheEntreprise.jsx';
import { comptesConnus, avecCompte } from './facturePro/comptes.js';
import { comptesProFacture } from './vintedPro.js';   // (11 nov., lot vinted-pro)

const ID_CFG = 'vrm_pro_facture';
const VIDE = { nom: '', forme: '', siret: '', adresse: '', codePostal: '', ville: '', tva_regime: '', tva_taux: '', tva: '', rcs: '', capital: '', email: '', telephone: '', prefixe: 'FA', couleur: COULEURS[0], logo: '', note: '', message: '', mentionPaiement: '', envoiPar: 'vrm', copie: true, envoiAuto: false };

// ── Une seule lecture de la fiche pour tout l'écran (trois états) ────────────
const _ecoutesCfg = new Set(); let _cfg; // undefined en cours · null pas su · objet
function poserCfg(v) { _cfg = v; _ecoutesCfg.forEach((f) => { try { f(v); } catch (_) {} }); }
// (9 nov., soir) « Ma configuration » écrit aussi cette fiche (SIRET et ce que le registre
// propose, sur son « C'est bon ») : elle annonce la ligne ENTIÈRE qu'elle vient d'écrire,
// la lecture partagée la reprend (sinon « Ma facture » montrerait l'ancienne).
if (typeof window !== 'undefined') {
  try { window.addEventListener('vrm:fiche-facturation', (e) => { const d = e && e.detail; if (d && typeof d === 'object') poserCfg({ ...VIDE, ...migrerAncienne(d) }); }); } catch (_) {}
}
export function useFicheFacturation(deps) {
  const [cfg, setCfg] = React.useState(_cfg);
  React.useEffect(() => {
    _ecoutesCfg.add(setCfg);
    if (_cfg === undefined || _cfg === null) deps.lireReglage(ID_CFG).then((d) => poserCfg(d === null ? null : { ...VIDE, ...migrerAncienne(d) })).catch(() => poserCfg(null));
    return () => { _ecoutesCfg.delete(setCfg); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return cfg;
}
// (11 nov., lot tva-marge) Le régime de TVA de SA fiche, pour qui n'affiche pas l'écran (la
// Comptabilité ne publie la TVA sur marge que pour « marge ») : '' = pas choisi, null = pas su.
export async function regimeTvaFiche(deps) {
  if (_cfg === undefined || _cfg === null) {
    try { const d = await deps.lireReglage(ID_CFG); if (d === null || d === undefined) return null; if (_cfg === undefined || _cfg === null) poserCfg({ ...VIDE, ...migrerAncienne(d) }); } catch (_) { return null; }
  }
  return _cfg ? String(_cfg.tva_regime || '') : null;
}
// La fiche d'avant (16 oct.) : `tauxTva` « 0 » = franchise. On ne DEVINE pas
// le régime à partir de rien : un taux > 0 dit « TVA classique », « 0 » ne dit
// rien de sûr (franchise ou marge) — il reste à choisir.
function migrerAncienne(d) {
  const x = { ...(d || {}) };
  if (!x.tva_regime && x.tauxTva && Number(String(x.tauxTva).replace(',', '.')) > 0) { x.tva_regime = 'normal'; x.tva_taux = Number(String(x.tauxTva).replace(',', '.')); }
  return x;
}

// ── L'état de l'envoi (serveur) : une lecture partagée, relue sur demande ────
// Trois états : undefined en cours · null pas su · l'objet du serveur.
const _ecoutesEtat = new Set(); let _etat; let _etatEnCours = null;
// (11 nov., lot DJ1) Écrire quelques champs de la fiche HORS de « Ma facture » (le choix
// d'un compte professionnel, sur une vente) : relue juste avant, fusionnée ; une lecture
// ratée n'écrit RIEN. `patch` : un objet, ou une fonction (fiche fraîche) → objet.
export async function ecrireChampsFiche(deps, patch) {
  try {
    const frais = await deps.lireReglage(ID_CFG);
    if (frais === null || frais === undefined) return false;
    const p = typeof patch === 'function' ? patch(frais || {}) : patch;
    const fusion = { ...(frais || {}), ...(p || {}) };
    const ok = await deps.ecrireReglage(ID_CFG, fusion);
    if (ok) poserCfg({ ...VIDE, ...migrerAncienne(fusion) });
    return !!ok;
  } catch (_) { return false; }
}

export function relireEtatEnvoi(deps) {
  if (_etatEnCours) return _etatEnCours;
  _etatEnCours = route(deps).then((r) => { _etat = r.code === 200 ? r.j : null; _etatEnCours = null; _ecoutesEtat.forEach((f) => { try { f(_etat); } catch (_) {} }); return _etat; });
  return _etatEnCours;
}
function useEtatEnvoi(deps) {
  const [e, setE] = React.useState(_etat);
  React.useEffect(() => { _ecoutesEtat.add(setE); if (_etat === undefined || _etat === null) relireEtatEnvoi(deps); return () => { _ecoutesEtat.delete(setE); }; }, [deps]);
  return e;
}
// Ce qui manque pour qu'une facture PARTE (pas pour qu'elle existe) : null = possible.
// Rend { geste, champ, texte } — le bouton dit le geste et y mène.
function bloqueEnvoi(cfg, etat) {
  if (!cfg || etat === undefined) return { geste: 'Lecture…', champ: null, texte: '' };
  if (etat === null) return { geste: 'Réessayer', champ: null, texte: "L'état de l'envoi n'a pas pu être lu (la base n'a pas répondu)." };
  if (cfg.envoiPar === 'boite') {
    if (!etat.boite || etat.boite.etat !== 'posee') return { geste: 'Connecter ma boîte', champ: 'boite', texte: 'Tu as choisi d’envoyer depuis ta propre boîte : connecte-la, ou laisse VRM envoyer.' };
    return null;
  }
  if (!emailValide(cfg.email)) return { geste: 'Ajouter mon e-mail', champ: 'email', texte: "VRM met ton adresse e-mail en copie et en « répondre à » : ajoute-la dans « Ma facture »." };
  if (!etat.vrm || !etat.vrm.pret) return { geste: 'Envoyer depuis ma boîte', champ: 'boite', texte: "L'envoi par VRM n'est pas encore ouvert. Tu peux envoyer depuis ta propre boîte, ou partager le PDF." };
  if (Number.isInteger(etat.vrm.aujourdhui) && etat.vrm.aujourdhui >= etat.vrm.plafond) return { geste: 'Plafond du jour atteint', champ: null, texte: `${etat.vrm.plafond} factures envoyées par VRM aujourd'hui : c'est le plafond. Réessaie demain, ou partage le PDF.` };
  return null;
}

// ── L'APERÇU (le même instantané que le PDF) ────────────────────────────────
// La facture d'EXEMPLE de « Ma facture » : un acheteur et un article inventés.
const EXEMPLE = { acheteur: { nom: 'Camille Exemple', adresse: '8 rue des Exemples\n75011 Paris', email: 'camille@exemple.fr' }, designation: 'Nike Air Max 90 — taille 42 (exemple)', centimes: 12950, venteLe: new Date(Date.now() - 2 * 86400000).toISOString(), reference: '0000000000', plateforme: 'Vinted' };
const L = (x, k) => (estTrou(x) ? <span key={k} className="vrm-fp-a-trou" data-fp-trou={x.trou}>{x.t}</span> : <span key={k}>{x}</span>);
export function ApercuFacture({ contenu, provisoire = false, numeroLibelle = '', sensible = false }) {
  if (!contenu) return null;
  const c = contenu; const T = c.totaux; const marge = c.regime === 'marge';
  const S = sensible ? { className: 'vrm-sensible', 'data-stream-type': 'acheteur' } : {};
  const trous = [c.vendeur.nom, ...c.vendeur.adresse, ...c.vendeur.legal, ...c.mentions, c.numeroTrou].filter(estTrou).length;
  // (10 nov., lot T) Facture en anglais : les mêmes libellés « français / English » que le PDF.
  const en = !!c.anglais; const B = (fr) => bi(fr, en);
  return (
    <div className="vrm-fp-apercu" data-fp-apercu={c.numero} data-fp-trous={trous} data-fp-langue={en ? 'fr-en' : 'fr'} style={{ '--fp-accent': c.couleur }}>
      <div className="vrm-fp-a-tete">
        {c.logo ? <img src={c.logo} alt="" className="vrm-fp-a-logo"/> : <span/>}
        <div className="vrm-fp-a-titre">
          <b>{B(c.type === 'avoir' ? 'AVOIR' : 'FACTURE')}</b>
          <span className="vrm-fp-a-num" data-fp-a-numero="">{c.numeroTrou ? L(c.numeroTrou, 'n') : provisoire ? (numeroLibelle || 'N° donné à l’émission') : `N° ${c.numero}`}</span>
          <span>{B('Émise le')} {c.emiseJour}</span>
          {c.origine ? <span>{B('Annule la facture')} {c.origine}</span> : null}
        </div>
      </div>
      <div className="vrm-fp-a-parties">
        <div data-fp-a-vendeur=""><small>{B('Vendeur')}</small><b>{estTrou(c.vendeur.nom) ? L(c.vendeur.nom, 'nom') : c.vendeur.nom}</b>{[...c.vendeur.adresse, ...c.vendeur.legal, c.vendeur.email, c.vendeur.telephone].filter((x) => estTrou(x) || x).map((l, i) => L(l, i))}</div>
        <div data-fp-a-acheteur="" {...S}><small>{B('Facturé à')}</small><b>{c.acheteur.nom}</b>{[...c.acheteur.adresse, c.acheteur.email].filter(Boolean).map((l, i) => <span key={i}>{l}</span>)}</div>
      </div>
      <p className="vrm-fp-a-infos">{B('Date de la vente')} : {c.venteJour} · {en && EN[c.nature] ? `${c.nature} / ${EN[c.nature]}` : c.nature}{c.reference ? ` · ${B('Référence')} : ${c.reference}` : ''}</p>
      <table className="vrm-fp-a-table"><thead><tr><th>{B('Désignation')}</th><th>{B('Qté')}</th><th>{B(marge ? 'Prix unitaire' : 'Prix unit. HT')}</th><th>{B(marge ? 'Total' : 'Total HT')}</th></tr></thead>
        <tbody>{c.lignes.map((l, i) => <tr key={i}><td>{l.designation}</td><td>{l.quantite}</td><td>{euros(l.unite)}</td><td>{euros(l.total)}</td></tr>)}</tbody></table>
      <dl className="vrm-fp-a-totaux">
        {c.regime === 'normal' ? <><div><dt>{B('Total HT')}</dt><dd>{euros(T.ht)}</dd></div><div><dt>{B('TVA')} {String(c.taux).replace('.', ',')}&nbsp;%</dt><dd>{euros(T.tva)}</dd></div><div className="is-fort"><dt>{B('Total TTC')}</dt><dd>{euros(T.ttc)}</dd></div></>
          : c.regime === 'franchise' ? <><div><dt>{B('Total HT')}</dt><dd>{euros(T.ht)}</dd></div><div><dt>{B('TVA')}</dt><dd>{B('non applicable')}</dd></div><div className="is-fort"><dt>{B(c.type === 'avoir' ? 'Montant à rembourser' : 'Net à payer')}</dt><dd>{euros(T.ttc)}</dd></div></>
          : <div className="is-fort"><dt>{B(c.type === 'avoir' ? 'Montant à rembourser' : 'Total à payer')}</dt><dd>{euros(T.ttc)}</dd></div>}
      </dl>
      <p className="vrm-fp-a-paye">{c.paiement}</p>
      {en ? <p className="vrm-fp-a-paye" data-fp-a-paye-en="">{paiementAnglais(c)}</p> : null}
      {c.mentions.map((m, i) => (estTrou(m) ? <p key={i} className="vrm-fp-a-mention">{L(m, 'm')}</p> : <p key={i} className="vrm-fp-a-mention">{m}{en && c.anglais.mentions && c.anglais.mentions[i] ? <><br/><span data-fp-a-mention-en="">{c.anglais.mentions[i]}</span></> : null}</p>))}
      {c.note ? <p className="vrm-fp-a-note">{c.note}</p> : null}
    </div>
  );
}

// ── Le logo : réduit dans le navigateur avant d'être rangé ──────────────────
async function reduireLogo(fichier) {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const k = Math.min(1, 600 / img.naturalWidth, 240 / img.naturalHeight);
    const w = Math.max(1, Math.round(img.naturalWidth * k)); const h = Math.max(1, Math.round(img.naturalHeight * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0, w, h);
    let d = cv.toDataURL('image/png');
    if (d.length > LOGO_MAX) {                         // trop lourd : JPEG sur fond blanc
      const cv2 = document.createElement('canvas'); cv2.width = w; cv2.height = h;
      const g2 = cv2.getContext('2d'); g2.fillStyle = '#fff'; g2.fillRect(0, 0, w, h); g2.drawImage(img, 0, 0, w, h);
      d = cv2.toDataURL('image/jpeg', 0.85);
    }
    return d.length <= LOGO_MAX ? d : null;
  } catch (_) { return null; } finally { URL.revokeObjectURL(url); }
}

// ── Ouvrir / partager un PDF ────────────────────────────────────────────────
async function ouvrirPdf(contenu, deps, { partager = false } = {}) {
  const { pdfFacture } = await import('./facturePro/pdf.js');
  const octets = await pdfFacture(contenu);
  const nom = nomFichier(contenu);
  const blob = new Blob([octets], { type: 'application/pdf' });
  if (partager) {
    try {
      const f = new File([blob], nom, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: nom }); return true; }
    } catch (e) { if (e && e.name === 'AbortError') return true; }
  }
  const url = URL.createObjectURL(blob);
  if (deps.ouvrirPdfOnglet && deps.ouvrirPdfOnglet(url, nom, `${contenu.type === 'avoir' ? 'Avoir' : 'Facture'} ${contenu.numero}`)) return true;
  const a = document.createElement('a'); a.href = url; a.download = nom; a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

// (11 nov., réseau instable) Les champs de « Ma facture » pas encore acceptés par la base.
const CLE_ATTENTE_FP = 'vrm_fp_attente';
const lireAttenteFp = () => { try { const o = JSON.parse(localStorage.getItem(CLE_ATTENTE_FP) || 'null'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (_) { return {}; } };
const poserAttenteFp = (o) => { try { if (Object.keys(o).length) localStorage.setItem(CLE_ATTENTE_FP, JSON.stringify(o)); else localStorage.removeItem(CLE_ATTENTE_FP); return true; } catch (_) { return false; } };

// ── Appeler la route du serveur ─────────────────────────────────────────────
async function route(deps, corps) {
  try {
    // (11 nov., réseau instable) Bornée : un bouton « Émettre » ne reste jamais
    // occupé sur une réponse qui ne vient pas (src/reseauBorne.js). Le serveur
    // rend la MÊME facture au rejeu (`deja`) : réessayer ne fait jamais un double.
    const r = await fetchBorne(fetch, '/api/compte?mode=facture-pro', corps ? { method: 'POST', headers: { 'Content-Type': 'application/json', ...deps.enTeteSession() }, body: JSON.stringify(corps) } : { headers: deps.enTeteSession() }, DELAI_ROUTE_MS);
    const j = await r.json().catch(() => null);
    return { code: r.status, j: j || {} };
  } catch (e) { return { code: 0, j: { message: typeof navigator !== 'undefined' && navigator.onLine === false && !(e && e.name === NOM_DELAI) ? "Pas de réseau : rien n'a été fait." : "La réponse n'est pas arrivée (réseau trop faible). Réessaie : si elle était partie, tu retrouveras la même facture, jamais une deuxième." } }; }
}
// (6 nov.) L'état de la boîte d'envoi ne vaut que LU : un 200 qui ne porte pas
// `boite` (page HTML servie à la place de la route, réponse d'une autre version
// du serveur, corps illisible) est « pas su » (`null`), jamais un objet vide —
// l'écran Facturation Pro tombait sur le garde-fou (`b.etat` sur undefined).
const boiteLue = (r) => (r && r.code === 200 && r.j && r.j.boite && typeof r.j.boite === 'object' && typeof r.j.boite.etat === 'string' ? r.j.boite : null);

// La feuille : `SheetShell` (portail, fond opaque, poignée, croix, FermeAuRetour).
function Feuille({ titre, fermer, children, deps, large = false, data }) {
  return <SheetShell onClose={fermer} titre={titre} maxWidth={large ? 760 : 560} FermeAuRetour={deps.FermeAuRetour} className="vrm-fp-fs" {...(data || {})}>
    <div className="vrm-fp-feuille-corps">{children}</div>
  </SheetShell>;
}

// ════════════════════════════════════════════════════════════════════════════
//  « MA FACTURE » : ton entreprise, ta facture, ton envoi — et l'aperçu en direct
// ════════════════════════════════════════════════════════════════════════════
export function FicheFacturation({ deps, focus = null, surPrete = null }) {
  const lu = useFicheFacturation(deps);
  const etat = useEtatEnvoi(deps);
  // (11 nov., lot vinted-pro) Combien de comptes Vinted sont Pro — LU (profil ou e-mail Vinted Pro), jamais deviné.
  const dFact = useFactures(deps);
  const nVintedPro = dFact && dFact.comptesPro ? [...dFact.comptesPro.values()].filter((v) => v === true).length : null;
  const [cfg, setCfg] = React.useState(null);
  const [statut, setStatut] = React.useState('');
  const minuteur = React.useRef(null);
  React.useEffect(() => { if (lu && !cfg) setCfg(lu); }, [lu, cfg]);

  const apercuRef = React.useRef(null);

  // Écrire : on RELIT la ligne juste avant (une autre carte — « Ton entreprise »
  // de Comptabilité — écrit la même), on fusionne nos champs, on écrit ; une
  // lecture ratée n'écrit RIEN.
  // (11 nov., réseau instable) Les champs pas encore acceptés par la base sont
  // GARDÉS sur l'appareil (`vrm_fp_attente`, effacé à la déconnexion comme tout
  // `vrm_*`) et renvoyés tout seuls (5 s, 15 s, 1 min, puis 2 min ; au retour du
  // réseau ; à la réouverture de la fiche) — jamais un « réessaie » qui perd ce
  // qu'il a tapé si la fiche se ferme. Un champ retapé pendant l'envoi reste en
  // attente (il n'est retiré que s'il vaut encore ce qui est parti).
  const reprise = React.useRef({ n: 0, t: null, enVol: false });
  const envoyer = React.useCallback(async () => {
    const rp = reprise.current;
    if (rp.enVol) return; if (rp.t) { clearTimeout(rp.t); rp.t = null; }
    const att = lireAttenteFp(); if (!Object.keys(att).length) return;
    rp.enVol = true;
    let ok = false;
    try {
      const frais = await deps.lireReglage(ID_CFG);
      if (frais !== null) {
        const fusion = { ...frais, ...att };
        ok = await deps.ecrireReglage(ID_CFG, fusion);
        if (ok) {
          const reste = lireAttenteFp();
          for (const k of Object.keys(att)) if (JSON.stringify(reste[k]) === JSON.stringify(att[k])) delete reste[k];
          poserAttenteFp(reste);
          poserCfg({ ...VIDE, ...migrerAncienne({ ...fusion, ...reste }) });
        }
      }
    } finally { rp.enVol = false; }
    if (ok && !Object.keys(lireAttenteFp()).length) { rp.n = 0; setStatut('✓ enregistré'); return; }
    if (ok) { rp.n = 0; rp.t = setTimeout(envoyer, 300); return; }
    setStatut('⏳ pas encore enregistré · réessai automatique (gardé sur cet appareil)');
    const d = [5000, 15000, 60000][rp.n] || 120000; rp.n++;
    rp.t = setTimeout(envoyer, d);
  }, [deps]);
  React.useEffect(() => {
    const f = () => { reprise.current.n = 0; envoyer(); };
    window.addEventListener('online', f);
    return () => { window.removeEventListener('online', f); if (reprise.current.t) clearTimeout(reprise.current.t); };
  }, [envoyer]);
  // À l'ouverture : ce qui attendait est remis dans la fiche, puis renvoyé.
  React.useEffect(() => { if (!lu) return; const att = lireAttenteFp(); if (Object.keys(att).length) { setCfg((c) => ({ ...(c || lu), ...att })); setStatut('⏳ pas encore enregistré · réessai automatique (gardé sur cet appareil)'); envoyer(); } }, [!!lu]);
  const ecrire = (next, champs) => {
    setCfg(next); setStatut('enregistrement…');
    const att = lireAttenteFp(); for (const k of champs) att[k] = next[k];
    if (!poserAttenteFp(att)) { setStatut("⚠ pas enregistré — cet appareil refuse de le garder, réessaie"); return; }
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => { reprise.current.n = 0; envoyer(); }, 600);
  };
  const upd = (k, v) => ecrire({ ...cfg, [k]: v }, [k]);
  const updPlusieurs = (o) => ecrire({ ...cfg, ...o }, Object.keys(o));

  // (9 nov., soir) Le SIRET fait chercher l'entreprise au registre public (SIREN EXACT) ;
  // ce qui est trouvé est PROPOSÉ dans « Vérifie ces informations » : rien n'est écrit
  // sans son « C'est bon », un champ qu'il a rempli n'est jamais écrasé sans son accord
  // (src/RechercheEntreprise.jsx, la même règle que « Ma configuration »). Avant, le nom
  // et l'adresse se posaient seuls dans les champs vides.
  const recherche = useRechercheEntreprise(deps.chercherEntreprise, cfg ? (cfg.siret || '') : null);
  // (11 nov., lot DJ1) « Pareil lorsqu'on choisit le statut » : la forme choisie montre ses mentions.
  const [formeVue, setFormeVue] = React.useState('');
  const allerAuChamp = (k) => { const el = document.querySelector(`[data-fp-champ="${k}"] input, [data-fp-champ="${k}"] select`); if (el) { try { el.focus({ preventScroll: false }); el.scrollIntoView({ block: 'center' }); } catch (_) {} } };

  React.useEffect(() => { if (focus && cfg) { const el = document.querySelector(`[data-fp-champ="${focus}"] input, [data-fp-champ="${focus}"] select, [data-fp-champ="${focus}"] button`); if (el) { try { el.focus({ preventScroll: false }); el.scrollIntoView({ block: 'center' }); } catch (_) {} } } }, [focus, !!cfg]);

  if (lu === undefined || (lu && !cfg)) return <div className="vrm-fp-carte" data-fp-fiche="charge">Lecture de ta fiche…</div>;
  if (lu === null) return <div className="vrm-fp-carte" data-fp-fiche="passu"><b>Ma facture</b><p className="vrm-fp-muet">Fiche pas lue : rien n'est perdu, rien n'est écrit par-dessus. Rouvre plus tard.</p></div>;

  const manque = manquantsVendeur(cfg);
  const champManque = new Set(manque.map((m) => m.champ));
  // Le prochain n° : celui du COMPTEUR du serveur (jamais deviné) ; pas su ⇒ « 0001 » d'exemple, dit tel.
  const prochainN = etat && Number.isInteger(etat.prochain) ? etat.prochain : null;
  const numeroExemple = numeroFacture(cfg.prefixe, anneeParis(Date.now()), prochainN || 1);
  let apercu = null;
  // (11 nov., lot DJ2) L'article d'exemple suit ce qu'il vend (une basket seulement pour Sneakers).
  let exemple = EXEMPLE;
  try { if (deps && typeof deps.vendActuel === 'function' && deps.vendActuel() !== 'sneakers' && typeof deps.exemples === 'function') exemple = { ...EXEMPLE, designation: deps.exemples().annonce.titre + ' (exemple)' }; } catch (_) { exemple = EXEMPLE; }
  try { apercu = contenuApercu(cfg, exemple, { numero: numeroExemple, emiseLe: Date.now() }).contenu; } catch (_) { apercu = null; }
  const mentionsKo = apercu ? new Set(mentionsManquantes(apercu)) : new Set();
  // (11 nov., lot tva-marge) En TVA sur marge, une facture qui montrerait de la TVA n'est jamais faite : la raison est DITE ici
  // (sinon l'aperçu disparaîtrait sans un mot) — p. ex. « TTC » écrit dans la note.
  const refusTva = cfg.tva_regime === 'marge' ? refusMarge(cfg, exemple) : '';
  const societe = estSociete(cfg.forme);
  const champ = ({ k, label, aide, type = 'text', placeholder, mode, auto, large: lg = false, majuscules = false }) => (
    <label key={k} className={`vrm-fp-champ${lg ? ' is-large' : ''}`} data-fp-champ={k} data-fp-manque={champManque.has(k) ? '1' : undefined}>
      <span>{label}</span>
      <input type={type} value={cfg[k] || ''} placeholder={placeholder} inputMode={mode} autoComplete={auto || 'off'} onChange={(e) => upd(k, majuscules ? e.target.value.toUpperCase() : e.target.value)}/>
      {aide ? <small>{aide}</small> : null}
    </label>
  );
  const exempleMail = apercu && !manque.length ? emailFacture(cfg, apercu, { via: cfg.envoiPar === 'boite' ? 'boite' : 'vrm' }) : null;
  return (
    <div className="vrm-fp-ma-facture" data-fp-fiche={manque.length ? 'incomplete' : 'prete'}>
      <div className="vrm-fp-fiche">
        <div className={`vrm-fp-etat${manque.length ? ' is-manque' : ''}`} data-fp-etat={manque.length ? manque.length : 0} role="status">
          {manque.length
            ? <><b>{manque.length === 1 ? 'Il manque une information' : `Il manque ${manque.length} informations`} pour faire une facture conforme</b><span>{manque.map((m) => m.l).join(' · ')}</span></>
            : <><b>Ta fiche est complète</b><span>Chaque vente prouvée d'un compte Pro peut recevoir sa facture.</span></>}
          {refusTva ? <span data-fp-refus-tva="">{refusTva}</span> : null}
          <div className="vrm-fp-voir-apercu"><button type="button" className="vrm-b vrm-b-secondaire" data-fp-voir-apercu="" onClick={() => { try { apercuRef.current && apercuRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) {} }}>Voir l'aperçu</button></div>
        </div>

        <section className="vrm-fp-section">
          <h3>Ton entreprise</h3>
          {/* (11 nov., lot DJ1) La recherche part à la VALIDATION : Entrée, sortie du champ, ou « Rechercher ». */}
          <label className="vrm-fp-champ" data-fp-champ="siret" data-fp-manque={champManque.has('siret') ? '1' : undefined}>
            <span>SIRET</span>
            <input type="text" value={cfg.siret || ''} placeholder="14 chiffres" inputMode="numeric" autoComplete="off" enterKeyHint="search" data-fp-siret=""
              onChange={(e) => upd('siret', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); recherche.lancer(); } }}
              onBlur={() => recherche.lancerUneFois()}/>
            <small>Sur ton avis de situation INSEE. Valide : VRM cherche ton entreprise.</small>
          </label>
          <CarteVerifEntreprise recherche={recherche} actuel={cfg} onModifier={allerAuChamp} onEcrire={(patch) => { updPlusieurs(patch); return true; }} data={{ 'data-fp-registre': '' }}/>
          <div className="vrm-fp-champ" data-fp-champ="forme" data-fp-manque={champManque.has('forme') ? '1' : undefined}>
            <span>Forme de l'entreprise</span>
            <select value={cfg.forme || ''} onChange={(e) => { upd('forme', e.target.value); setFormeVue(e.target.value); }} aria-label="Forme de l'entreprise">
              <option value="">Choisir…</option>
              {FORMES.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
            </select>
          </div>
          {formeVue && formeVue === cfg.forme ? <CarteMentionsForme forme={cfg.forme} cfg={cfg} onModifier={allerAuChamp} onEcrire={(patch) => updPlusieurs(patch)} fermer={() => setFormeVue('')}/> : null}
          {champ({ k: 'nom', label: cfg.forme === 'EI' || !cfg.forme ? 'Nom et prénom (ou nom commercial)' : 'Raison sociale', auto: 'organization', aide: cfg.forme === 'EI' ? '« EI » est ajouté après ton nom sur la facture (obligatoire).' : null })}
          {champ({ k: 'adresse', label: 'Adresse', auto: 'street-address', large: true })}
          <div className="vrm-fp-rangee">
            {champ({ k: 'codePostal', label: 'Code postal', mode: 'numeric', auto: 'postal-code' })}
            {champ({ k: 'ville', label: 'Ville', auto: 'address-level2' })}
          </div>
          {societe ? <div className="vrm-fp-rangee">
            {champ({ k: 'rcs', label: 'Immatriculation (RCS ou RM)', placeholder: 'RCS Rennes' })}
            {champ({ k: 'capital', label: 'Capital social (€)', mode: 'decimal', placeholder: '1 000' })}
          </div> : champ({ k: 'rcs', label: 'Immatriculation RCS ou RM (le cas échéant)', placeholder: 'RCS Rennes ou RM 35', aide: 'Si tu es inscrit au registre du commerce (RCS) ou au répertoire des métiers (RM).' })}
          {champ({ k: 'email', label: 'Ton e-mail (sur la facture, en copie et pour les réponses)', type: 'email', auto: 'email', mode: 'email', large: true })}
          {champ({ k: 'telephone', label: 'Téléphone (facultatif)', type: 'tel', auto: 'tel', mode: 'tel' })}
        </section>

        <section className="vrm-fp-section" data-fp-champ="tva_regime" data-fp-manque={champManque.has('tva_regime') ? '1' : undefined}>
          <h3>TVA</h3>
          <div className="vrm-fp-choix" role="radiogroup" aria-label="Régime de TVA">
            {REGIMES_TVA.map((r) => (
              <button key={r.v} type="button" role="radio" aria-checked={cfg.tva_regime === r.v} data-fp-regime={r.v} onClick={() => upd('tva_regime', r.v)}>
                <b>{r.l}</b><span>{r.d}</span>
              </button>
            ))}
          </div>
          {!cfg.tva_regime ? <p className="vrm-fp-muet">Micro sous le seuil de TVA : en général « Franchise ». Un doute ? Ton comptable.</p> : null}
          {cfg.tva_regime === 'normal' ? <div className="vrm-fp-champ" data-fp-champ="tva_taux" data-fp-manque={champManque.has('tva_taux') ? '1' : undefined}>
            <span>Taux de TVA</span>
            <select value={cfg.tva_taux || ''} onChange={(e) => upd('tva_taux', Number(e.target.value))} aria-label="Taux de TVA">
              <option value="">Choisir…</option>{TAUX_TVA.map((t) => <option key={t} value={t}>{String(t).replace('.', ',')}&nbsp;%</option>)}
            </select></div> : null}
          {cfg.tva_regime === 'normal' || cfg.tva_regime === 'marge' ? champ({ k: 'tva', label: 'N° de TVA intracommunautaire', placeholder: 'FR12345678901', majuscules: true }) : null}
        </section>

        {/* (11 nov., lot DJ1) « que sur compte professionnel, ou alors on demande au vendeur sur quel compte » */}
        <section className="vrm-fp-section" data-fp-comptes="">
          <h3>Sur quels comptes ?</h3>
          <p className="vrm-fp-muet" data-fp-vinted-pro={nVintedPro == null ? '' : String(nVintedPro)}>{nVintedPro ? `Vinted : ${nVintedPro} compte${nVintedPro > 1 ? 's' : ''} Pro, lu${nVintedPro > 1 ? 's' : ''} sur Vinted.` : nVintedPro === 0 ? 'Vinted : aucun compte Pro lu sur Vinted.' : 'Vinted : tes comptes Pro, ceux que Vinted dit professionnels.'}</p>
          {comptesConnus(cfg).length ? <div className="vrm-fp-comptes">
            {comptesConnus(cfg).map((c) => (
              <label key={c.cle} className="vrm-fp-compte" data-fp-compte={c.cle} data-fp-compte-oui={c.oui ? '1' : '0'}>
                <input type="checkbox" checked={c.oui} onChange={(e) => upd('comptesFacture', avecCompte(cfg, c.plateforme, c.compte, e.target.checked))}/>
                <span><b className="vrm-sensible" data-stream-type="compte">{c.compte}</b><small>{c.plateforme === 'ebay' ? 'eBay' : c.plateforme === 'vestiaire' ? 'Vestiaire' : 'Leboncoin'}</small></span>
              </label>
            ))}
          </div> : null}
          <p className="vrm-fp-muet">Leboncoin, eBay, Vestiaire : VRM te demande à la première vente de chaque compte.</p>
        </section>

        <section className="vrm-fp-section">
          <h3>Ta facture</h3>
          <div className="vrm-fp-logo" data-fp-champ="logo">
            {cfg.logo ? <img src={cfg.logo} alt="Ton logo"/> : <span className="vrm-fp-logo-vide">Pas de logo (facultatif)</span>}
            <label className="vrm-b vrm-b-secondaire">
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => {
                const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
                const d = await reduireLogo(f);
                if (!d) { deps.toast('Ce logo ne se lit pas (essaie un PNG ou un JPEG).'); return; }
                upd('logo', d);
              }}/>
              {cfg.logo ? 'Changer le logo' : 'Ajouter ton logo'}
            </label>
            {cfg.logo ? <button type="button" className="vrm-b vrm-b-discret" onClick={() => upd('logo', '')}>Retirer</button> : null}
          </div>
          <div className="vrm-fp-champ" data-fp-champ="couleur">
            <span>Couleur</span>
            <div className="vrm-fp-couleurs" role="radiogroup" aria-label="Couleur de la facture">
              {COULEURS.map((c) => <button key={c} type="button" role="radio" aria-checked={(cfg.couleur || COULEURS[0]) === c} aria-label={`Couleur ${c}`} style={{ background: c }} onClick={() => upd('couleur', c)}/>)}
            </div>
          </div>
          {champ({ k: 'mentionPaiement', label: 'Mentions de paiement (facultatif)', placeholder: 'Paiement reçu par Vinted.', large: true, aide: 'Ajouté après « Facture acquittée — payée le … via Vinted ».' })}
          <label className="vrm-fp-champ is-large" data-fp-champ="note"><span>Texte en bas de la facture (facultatif)</span>
            <textarea rows={2} value={cfg.note || ''} placeholder="Merci pour votre achat !" onChange={(e) => upd('note', e.target.value)}/></label>
        </section>

        <section className="vrm-fp-section" data-fp-numerotation="">
          <h3>Numérotation</h3>
          {champ({ k: 'prefixe', label: 'Début des numéros', majuscules: true, aide: 'Lettres majuscules et chiffres, 6 au plus. Ne le change plus une fois tes premières factures émises.' })}
          <p className="vrm-fp-muet" data-fp-prochain={prochainN == null ? '' : prochainN}>
            {prochainN != null
              ? <>Prochaine facture : <b className="vrm-fp-chiffre">{numeroExemple}</b>. Les numéros se suivent sans trou, un numéro donné n'est jamais réutilisé, et une facture émise ne se modifie plus (pour la corriger, VRM émet un avoir).</>
              : etat === undefined ? 'Lecture du compteur…' : "Le compteur n'a pas pu être lu : le numéro sera donné par le serveur à l'émission, à la suite des précédents."}
          </p>
        </section>

        <EnvoiFacture deps={deps} cfg={cfg} upd={upd} updPlusieurs={updPlusieurs} etat={etat}/>

        <section className="vrm-fp-section">
          <h3>Le message de l'e-mail</h3>
          <label className="vrm-fp-champ is-large" data-fp-champ="message"><span>Message à l'acheteur</span>
            <textarea rows={5} value={cfg.message || ''} placeholder={MESSAGE_DEFAUT} onChange={(e) => upd('message', e.target.value)}/>
            <small>{'{acheteur}, {numero}, {article} et {boutique} sont remplacés. Vide = le texte proposé.'}</small></label>
          {exempleMail ? <div className="vrm-fp-mail" data-fp-exemple-mail=""><small>Objet</small><b>{exempleMail.sujet}</b><small>De</small><span>{exempleMail.nomExpediteur}</span><small>Message</small><pre>{exempleMail.texte}</pre></div> : null}
        </section>
        {statut ? <p className="vrm-fp-statut" role="status">{statut}</p> : null}
        {surPrete && !manque.length ? <button type="button" className="vrm-b vrm-b-primaire vrm-b-plein" onClick={surPrete}>Revenir à la facture</button> : null}
      </div>

      <aside className="vrm-fp-apercu-col" ref={apercuRef} data-fp-apercu-col="">
        <div className="vrm-fp-apercu-tete">
          <b>Aperçu</b>
          <span>Ce que recevront tes acheteurs (exemple inventé).</span>
        </div>
        {apercu ? <ApercuFacture contenu={apercu} provisoire numeroLibelle={prochainN != null ? `N° ${numeroExemple}` : `N° ${numeroExemple} (exemple)`}/> : <p className="vrm-fp-muet">L'aperçu n'a pas pu se dessiner.</p>}
        <details className="vrm-fp-mentions" data-fp-mentions={MENTIONS_OBLIGATOIRES.length - mentionsKo.size}>
          <summary>Mentions obligatoires : {MENTIONS_OBLIGATOIRES.length - mentionsKo.size} sur {MENTIONS_OBLIGATOIRES.length}{mentionsKo.size ? ` — ${mentionsKo.size} à compléter` : ''}</summary>
          <ul>{MENTIONS_OBLIGATOIRES.map((m) => <li key={m.cle} data-fp-mention={m.cle} data-ok={mentionsKo.has(m.cle) ? '0' : '1'}>{mentionsKo.has(m.cle) ? 'À compléter · ' : '✓ '}{m.l}</li>)}</ul>
        </details>
        {apercu && !manque.length ? <button type="button" className="vrm-b vrm-b-secondaire" data-fp-exemple-pdf="" onClick={() => ouvrirPdf(apercu, deps)}>Voir l'exemple en PDF</button> : null}
      </aside>
    </div>
  );
}

// ── L'envoi : par VRM (défaut) ou depuis sa propre boîte ────────────────────
const AIDE_MDP = {
  gmail: 'Gmail : active la validation en deux étapes, puis crée un « mot de passe d’application » sur myaccount.google.com/apppasswords (16 lettres).',
  icloud: 'iCloud : sur account.apple.com → Connexion et sécurité → Mots de passe pour app.',
  yahoo: 'Yahoo : Sécurité du compte → Générer un mot de passe d’application.',
};
// (10 nov., lot Q) L'ENVOI AUTOMATIQUE — éteint par défaut, allumé seulement par SON geste
// (confirmé). Il pose `envoiAuto` ET `envoiAutoDepuis` ensemble : les ventes d'avant restent
// dans « À envoyer ». La pause (fiche incomplète, serveur d'envoi absent…) est dite telle que le
// serveur l'a écrite, avec le geste qui la lève.
function EnvoiAuto({ deps, cfg, updPlusieurs, etat }) {
  const on = autoAllume(cfg);
  const j = etat && etat.auto;
  const basculer = async () => {
    if (on) { updPlusieurs({ envoiAuto: false }); return; }
    if (!(await deps.askConfirm({ title: 'Envoyer les factures tout seul ?', desc: "Chaque nouvelle vente Pro dont l'acheteur est prouvé reçoit sa facture, sans ton clic. Jamais à une adresse devinée, jamais une vente annulée. Les ventes d'avant restent dans « À envoyer ».", ok: 'Activer' }))) return;
    updPlusieurs({ envoiAuto: true, envoiAutoDepuis: new Date().toISOString() });
  };
  const ratees = j && Array.isArray(j.essais) ? j.essais.filter((e) => e.issue !== 'envoyee') : [];
  return (
    <div className="vrm-fp-auto" data-fp-auto={on ? 'on' : 'off'}>
      <label className="vrm-fp-case"><input type="checkbox" checked={on} onChange={basculer} data-fp-auto-case=""/> <span>Envoyer chaque nouvelle facture tout seul</span></label>
      {on ? <p className="vrm-fp-muet">Depuis le {jourParis(cfg.envoiAutoDepuis)}{j && j.at ? ` · vérifié le ${jourParis(j.at)} à ${heureParis(j.at)}` : ' · pas encore passé'}.</p> : null}
      {on && j && j.pause ? <p className="vrm-fp-muet is-ambre" data-fp-auto-pause={j.pause.code}>{j.pause.texte}</p> : null}
      {on && ratees.length ? <ul className="vrm-fp-journal" data-fp-auto-ratees={ratees.length}>{ratees.slice(0, 5).map((e) => <li key={e.tx} data-fp-journal-etat={e.issue}><b>Vente {e.tx}</b><span>{e.issue === 'pas-prouvee' ? 'pas envoyée' : e.issue === 'incertaine' ? 'envoi incertain' : 'pas envoyée'} · {e.raison}</span></li>)}</ul> : null}
    </div>
  );
}
function EnvoiFacture({ deps, cfg, upd, updPlusieurs, etat }) {
  const [proprio, setProprio] = React.useState(false);
  React.useEffect(() => { let m = false; if (deps.lireProprietaire) Promise.resolve(deps.lireProprietaire()).then((v) => { if (!m) setProprio(v === true); }).catch(() => {}); return () => { m = true; }; }, [deps]);
  const par = cfg.envoiPar === 'boite' ? 'boite' : 'vrm';
  const v = etat && etat.vrm;
  return (
    <section className="vrm-fp-section" data-fp-champ="envoi" data-fp-envoi-par={par}>
      <h3>Envoi à l'acheteur</h3>
      <div className="vrm-fp-choix" role="radiogroup" aria-label="Qui envoie la facture">
        <button type="button" role="radio" aria-checked={par === 'vrm'} data-fp-par="vrm" onClick={() => upd('envoiPar', 'vrm')}>
          <b>VRM l'envoie pour toi (conseillé)</b>
          <span>« {String(cfg.nom || 'Ta boutique').trim() || 'Ta boutique'} via VRM » ; réponses chez toi, copie pour toi.</span>
        </button>
        <button type="button" role="radio" aria-checked={par === 'boite'} data-fp-par="boite" onClick={() => upd('envoiPar', 'boite')}>
          <b>Depuis ma propre boîte e-mail</b>
          <span>Gmail, iCloud, Orange… L'acheteur voit ton adresse.</span>
        </button>
      </div>
      {par === 'vrm' ? (
        etat === undefined ? <p className="vrm-fp-muet">Lecture…</p>
          : etat === null ? <p className="vrm-fp-muet">L'état de l'envoi n'a pas pu être lu. Rouvre cet écran dans un moment.</p>
          : <div className="vrm-fp-vrm" data-fp-vrm={v && v.pret ? 'pret' : 'ferme'}>
            {v && v.pret
              ? <p className="vrm-fp-boite-ok"><b>Prêt</b><span>Au plus {v.plafond} factures par jour{Number.isInteger(v.aujourdhui) ? ` (${v.aujourdhui} aujourd'hui)` : ''}.</span></p>
              : <p className="vrm-fp-boite-ok"><b>L'envoi par VRM n'est pas encore ouvert</b><span>{proprio
                ? `Geste du propriétaire : poser sur Vercel ${(v && v.manque && v.manque.length ? v.manque : ['RELANCES_SMTP_HOTE', 'RELANCES_SMTP_UTILISATEUR', 'RELANCES_SMTP_MOT_DE_PASSE', 'RELANCES_EXPEDITEUR']).join(', ')} (docs/ouvrir-aux-clients.md, étape 2b), puis redéployer.`
                : "En attendant, choisis « Depuis ma propre boîte », ou partage le PDF depuis la vente."}</span></p>}
            {!emailValide(cfg.email) ? <p className="vrm-fp-muet" data-fp-manque-email="">Ajoute ton e-mail plus haut : VRM le met en copie et en « répondre à ».</p> : null}
          </div>
      ) : <BoiteEnvoi deps={deps} cfg={cfg} upd={upd}/>}
      {updPlusieurs ? <EnvoiAuto deps={deps} cfg={cfg} updPlusieurs={updPlusieurs} etat={etat}/> : null}
    </section>
  );
}
export function BoiteEnvoi({ deps, cfg, upd }) {
  const [e, setE] = React.useState(undefined);
  const [form, setForm] = React.useState({ adresse: '', motDePasse: '', fournisseur: '', hote: '', port: '465' });
  const [occupe, setOccupe] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const charger = React.useCallback(async () => { const r = await relireEtatEnvoi(deps); setE(r || null); }, [deps]);
  React.useEffect(() => { charger(); }, [charger]);
  const domaine = (form.adresse.split('@')[1] || '').toLowerCase();
  const deduit = e && e.fournisseurs ? ({ 'gmail.com': 'gmail', 'googlemail.com': 'gmail', 'icloud.com': 'icloud', 'me.com': 'icloud', 'mac.com': 'icloud', 'orange.fr': 'orange', 'wanadoo.fr': 'orange', 'free.fr': 'free', 'sfr.fr': 'sfr', 'laposte.net': 'laposte', 'yahoo.fr': 'yahoo', 'yahoo.com': 'yahoo' })[domaine] || '' : '';
  const fourEff = form.fournisseur || deduit;
  const connecter = async () => {
    setOccupe('poser'); setMsg('');
    const r = await route(deps, { action: 'boite-poser', adresse: form.adresse, motDePasse: form.motDePasse, fournisseur: fourEff || undefined, hote: fourEff ? undefined : form.hote, port: fourEff ? undefined : Number(form.port) });
    setOccupe('');
    if (r.code === 200) { setForm({ ...form, motDePasse: '' }); relireEtatEnvoi(deps).then((x) => setE(x || null)); setMsg('Boîte connectée. Envoie-toi un essai pour vérifier.'); }
    else setMsg(r.j.message || "La connexion a échoué. Rien n'a été rangé.");
  };
  const essai = async () => { setOccupe('essai'); setMsg(''); const r = await route(deps, { action: 'boite-essai' }); setOccupe(''); setMsg(r.j.issue === 'envoye' ? `Essai envoyé à ${r.j.a}. Regarde ta boîte de réception.` : (r.j.message || "L'essai n'est pas parti.")); if (r.j.issue === 'envoye') charger(); };
  const retirer = async () => { if (!(await deps.askConfirm({ title: 'Déconnecter ta boîte ?', desc: "VRM ne pourra plus envoyer tes factures depuis cette boîte. Tes factures déjà émises ne changent pas.", ok: 'Déconnecter', danger: true }))) return; setOccupe('retirer'); const r = await route(deps, { action: 'boite-retirer', confirme: true }); setOccupe(''); if (r.code === 200) relireEtatEnvoi(deps).then((x) => setE(x || null)); else setMsg(r.j.message || 'Réessaie.'); };
  // (6 nov.) Une réponse 200 sans boîte lisible vaut « pas su » (jamais un écran qui tombe sur `b.etat`).
  const b = e && e.boite && typeof e.boite === 'object' && typeof e.boite.etat === 'string' ? e.boite : null;
  const passu = e === null || (e !== undefined && !b);
  return (
    <div className="vrm-fp-boite" data-fp-champ="boite" data-fp-boite={e === undefined ? 'charge' : passu ? 'passu' : b.etat}>
      {e === undefined ? <p className="vrm-fp-muet">Lecture…</p>
        : passu ? <p className="vrm-fp-muet">L'état de ta boîte d'envoi n'a pas pu être lu. Rouvre cet écran dans un moment.</p>
        : b.etat === 'posee' ? <>
          <p className="vrm-fp-boite-ok"><b>Les factures partent de {b.adresse}</b><span>L'acheteur voit ton adresse et peut te répondre.{b.essaiLe ? ` Dernier essai réussi le ${jourParis(b.essaiLe)}.` : ''}</span></p>
          <label className="vrm-fp-case"><input type="checkbox" checked={cfg.copie !== false} onChange={(ev) => upd('copie', ev.target.checked)}/> <span>M'envoyer une copie de chaque facture</span></label>
          <div className="vrm-fp-gestes">
            <button type="button" className="vrm-b vrm-b-secondaire" disabled={!!occupe} onClick={essai} data-fp-essai="">{occupe === 'essai' ? 'Envoi…' : "M'envoyer un essai"}</button>
            <button type="button" className="vrm-b vrm-b-discret" disabled={!!occupe} onClick={retirer}>Déconnecter</button>
          </div>
        </> : <>
          <p className="vrm-fp-muet">Ton mot de passe d'application reste chiffré, jamais remontré.</p>
          <label className="vrm-fp-champ"><span>Ton adresse e-mail</span><input type="email" inputMode="email" autoComplete="email" value={form.adresse} onChange={(ev) => setForm({ ...form, adresse: ev.target.value.trim() })}/></label>
          <label className="vrm-fp-champ"><span>Ta boîte</span>
            <select value={fourEff || 'autre'} onChange={(ev) => setForm({ ...form, fournisseur: ev.target.value === 'autre' ? '' : ev.target.value })}>
              {e.fournisseurs ? Object.entries(e.fournisseurs).map(([k, f]) => <option key={k} value={k}>{f.l}</option>) : null}
              <option value="autre">Autre (serveur à indiquer)</option>
            </select></label>
          {!fourEff ? <div className="vrm-fp-rangee">
            <label className="vrm-fp-champ"><span>Serveur d'envoi (SMTP)</span><input value={form.hote} placeholder="smtp.exemple.fr" onChange={(ev) => setForm({ ...form, hote: ev.target.value.trim() })}/></label>
            <label className="vrm-fp-champ"><span>Port</span><select value={form.port} onChange={(ev) => setForm({ ...form, port: ev.target.value })}><option value="465">465 (SSL)</option><option value="587">587 (STARTTLS)</option></select></label>
          </div> : null}
          <label className="vrm-fp-champ"><span>Mot de passe d'application</span><input type="password" autoComplete="new-password" value={form.motDePasse} onChange={(ev) => setForm({ ...form, motDePasse: ev.target.value })}/>
            <small>{AIDE_MDP[fourEff] || "Le mot de passe de ta boîte, ou un « mot de passe d'application » si ta boîte en demande un."}</small></label>
          <button type="button" className="vrm-b vrm-b-primaire" disabled={!!occupe || !emailValide(form.adresse) || !form.motDePasse} onClick={connecter} data-fp-connecter="">{occupe === 'poser' ? 'Vérification…' : 'Connecter ma boîte'}</button>
        </>}
      {msg ? <p className="vrm-fp-statut" role="status">{msg}</p> : null}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  SUR UNE VENTE : « Envoyer la facture »
// ════════════════════════════════════════════════════════════════════════════
// Les ventes Pro (e-mails de vente Vinted Pro) et les factures, lues UNE fois
// pour tout l'écran, en scalaires (§4.4 : jamais le formulaire de retour, jamais
// l'instantané entier dans une liste).
let _donnees; const _ecoutesDonnees = new Set(); let _enCours = null;
// (11 nov., lot DJ1 — « je viens de faire une vente sur mon compte Pro, et je n'ai pas le
// bouton ») Ces lectures étaient faites UNE fois par chargement : l'app restée ouverte
// (iPhone) ne voyait jamais l'e-mail de vente Pro arrivé ensuite ⇒ pas de bouton. Elles
// sont relues quand elles ont plus de `FACTURES_FRAICHES_MS` : au retour sur l'app, à
// l'ouverture d'une ligne, et quand une vente d'un compte Pro n'a pas encore son e-mail.
let _luA = 0;
export const FACTURES_FRAICHES_MS = 60 * 1000;
const factures_perimees = () => _donnees === undefined || Date.now() - _luA > FACTURES_FRAICHES_MS;
if (typeof document !== 'undefined') {
  try { document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && _ecoutesDonnees.size && factures_perimees() && _depsDonnees) relireFactures(_depsDonnees); }); } catch (_) {}
}
let _depsDonnees = null;
export function relireFactures(deps) {
  if (_enCours) return _enCours;
  _enCours = (async () => {
    const [ventes, profils, factures] = await Promise.all([
      deps.lireTout('id=like.email_sale_*&data->>pro=eq.true&select=transaction:data->>transaction,nom:data->>nomComplet,adresse:data->>adresse,email:data->>email,account:data->>account,designation:data->>designation,prix:data->>prix,receivedAt:data->>receivedAt,uid:data->>uid', { strict: true }),
      deps.lireTout('id=like.harvest_*_profile&select=id,uid:data->>uid,business:data->payload->user->business,business_account_id:data->payload->user->business_account_id,business_account:data->payload->user->business_account'),
      deps.lireTout(`id=like.email_invoice_*&select=${SELECT_FACTURES_PRO}`, { strict: true }),
    ]);
    const v = Array.isArray(ventes) && Array.isArray(factures) ? (() => {
      // Les e-mails de vente Pro PAR n° de transaction (une LISTE : deux e-mails au
      // même n° sont deux candidats que la règle doit voir).
      const ventesPro = new Map();
      for (const x of ventes) { if (!x || !x.transaction) continue; const k = String(x.transaction); if (!ventesPro.has(k)) ventesPro.set(k, []); ventesPro.get(k).push(x); }
      return {
        ventesPro,
        factures: new Map(factures.filter((x) => x && x.transaction && /^email_invoice_tx/.test(x.id)).map((x) => [String(x.transaction), x])),
        // Le profil Vinted du compte : professionnel ? (la MÊME règle que l'app,
        // `typeCompteVinted`) — true · false · absent (pas su).
        // (11 nov., lot vinted-pro) + les comptes dont Vinted a écrit « membre Vinted Pro » dans
        // un e-mail de vente, là où le profil n'est pas lu (src/vintedPro.js). Jamais un « false » inventé.
        comptesPro: comptesProFacture(new Map((Array.isArray(profils) ? profils : []).map((r) => {
          const uid = String(r.uid || ((r.id || '').match(/^harvest_(\d+)_profile$/) || [])[1] || '');
          return [uid, deps.typeCompteVinted({ user: { business: r.business, business_account_id: r.business_account_id, business_account: r.business_account } })];
        }).filter(([u, t]) => u && typeof t === 'boolean')), ventes.map((x) => x && x.uid)),
        avoirs: new Map(factures.filter((x) => x && x.transaction && /^email_invoice_av/.test(x.id)).map((x) => [String(x.transaction), x])),
        // (10 nov., lot Q) Toutes les lignes (registre, trous de la numérotation).
        toutes: factures.filter(Boolean),
      };
    })() : null;
    // Une relecture ratée ne remplace pas une lecture réussie (« rien lu » ne vaut pas « rien »).
    if (v || _donnees === undefined) _donnees = v;
    _enCours = null; _luA = Date.now();
    _ecoutesDonnees.forEach((f) => { try { f(_donnees); } catch (_) {} });
    return _donnees;
  })();
  return _enCours;
}
function useFactures(deps) {
  const [d, setD] = React.useState(_donnees);
  React.useEffect(() => { _depsDonnees = deps; _ecoutesDonnees.add(setD); if (factures_perimees()) relireFactures(deps); else if (_donnees !== d) setD(_donnees); return () => { _ecoutesDonnees.delete(setD); }; }, [deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return d;
}
async function lireContenu(deps, id) {
  const r = await deps.lireTout(`id=eq.${encodeURIComponent(id)}&select=contenu:data->contenu`, { strict: true });
  return Array.isArray(r) && r[0] && r[0].contenu ? r[0].contenu : null;
}
const heureParis = (t) => { try { return (globalThis.__vrmFmtHeureFP || (globalThis.__vrmFmtHeureFP = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }))).format(new Date(t)); } catch (_) { return ''; } };
const motEnvoi = (e, av) => (av && av.emiseLe ? `annulée par l'avoir ${av.numero}` : !e ? 'émise, pas encore envoyée' : e.etat === 'envoyee' ? `envoyée le ${jourParis(e.at)}` : e.etat === 'en-cours' ? 'envoi en cours…' : e.etat === 'incertaine' ? 'envoi incertain — à vérifier' : 'pas envoyée — touche pour voir pourquoi');

// (8 nov., « restes ventes ») UNE PHRASE PAR GROUPE (CLAUDE.md §7) : le refus d'une ligne
// (« Facture : acheteur pas prouvé : … ») identique sur DEUX lignes affichées ou plus se dit
// UNE fois, en tête de la liste (`FactureRaisonsTete`) ; ces lignes ne la répètent plus. Un
// refus qui parle du COMPTE (« ouvre Vinted sur ce compte ») se groupe par compte. Un refus
// propre à la ligne (l'écart d'heure, les deux prix) reste sur elle. Même calcul que la ligne
// (`preuveAcheteur`), rien de deviné : une vente qui n'est pas Pro, ou déjà facturée, n'a pas
// de refus. `groupe` : les ventes AFFICHÉES (forme de `vente`). `d` : `useFactures`.
const CODES_PAR_COMPTE = new Set(['vinted', 'compte']);
function refusDeLigne(vente, d) {
  if (!vente || !vente.tx || !d) return null;
  const tx = String(vente.tx);
  const mails = d.ventesPro.get(tx) || [];
  const f = d.factures.get(tx) || null;
  const proCompte = vente.uid != null ? d.comptesPro.get(String(vente.uid)) : undefined;
  if (f && f.emiseLe) return null;
  if (!(mails.length > 0 || proCompte === true)) return null;
  const preuve = preuveAcheteur({ tx, mails, commandes: vente.commandes || [], brouillon: f, adresseLisible: adresseVintedLisible });
  if (preuve.prouve) return null;
  const phrase = phraseRefus(preuve);
  const parCompte = CODES_PAR_COMPTE.has(preuve.code);
  return { code: preuve.code, phrase, cle: (parCompte ? String(vente.uid || '') + '|' : '|') + phrase, uid: parCompte ? String(vente.uid || '') : '', compte: parCompte ? String(vente.compte || '') : '' };
}
const _communes = new WeakMap();
export function refusCommuns(groupe, d) {
  if (!Array.isArray(groupe) || !d) return new Map();
  const c = _communes.get(groupe);
  if (c && c.d === d) return c.m;
  const m = new Map();
  for (const v of groupe) { const r = refusDeLigne(v, d); if (!r) continue; const g = m.get(r.cle) || { ...r, txs: [] }; g.txs.push(String(v.tx)); m.set(r.cle, g); }
  for (const [k, g] of [...m]) if (g.txs.length < 2) m.delete(k);
  _communes.set(groupe, { d, m });
  return m;
}
// L'en-tête : chaque refus commun, une fois, avec le nombre de ventes (et le compte s'il en dépend).
export function FactureRaisonsTete({ ventes, deps }) {
  const d = useFactures(deps);
  const m = refusCommuns(ventes, d);
  if (!m.size) return null;
  return <div className="vrm-fp-tete" data-fp-tete="" style={{ margin: '0 2px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
    {[...m.values()].map((g) => (
      <p key={g.cle} className="vrm-fp-muet vrm-fp-raison" style={{ margin: 0, fontSize: 13, lineHeight: 1.45, overflowWrap: 'anywhere' }} data-fp-tete-code={g.code} data-fp-tete-n={g.txs.length} data-fp-tete-txs={g.txs.join(',')}>
        Facture · {g.txs.length} ventes{g.compte ? <> de <span className="vrm-sensible" data-stream-type="compte">{g.compte}</span></> : null} : {g.phrase}.
      </p>
    ))}
  </div>;
}

// `vente` = { tx, uid, compte, titre, centimes, venteLe, commandes:[ventes Vinted portant ce n°] }.
// `ligne` : la forme courte, sur la ligne de la liste (à côté de la vente).
// `groupe` (ligne seulement) : les ventes affichées — un refus commun est dit en tête, pas ici.
export function FactureVente({ vente, deps, ligne = false, groupe = null }) {
  const d = useFactures(deps);
  const [ouverte, setOuverte] = React.useState(false);
  // (11 nov., lot DJ1) Une vente d'un compte Pro dont l'e-mail de vente n'est pas (encore)
  // lu : on relit les e-mails (au plus une fois par minute) — il arrive ~1 min après la vente.
  const sansMail = !!(d && vente && vente.tx && vente.uid != null && d.comptesPro.get(String(vente.uid)) === true && !(d.ventesPro.get(String(vente.tx)) || []).length && !d.factures.get(String(vente.tx)));
  React.useEffect(() => { if (sansMail && factures_perimees()) relireFactures(deps); }, [sansMail, deps]);
  if (!vente || !vente.tx || !d) return d === null && !ligne && vente && vente.tx ? <p className="vrm-fp-muet">Les factures n'ont pas pu être lues — réessaie dans un instant.</p> : null;
  const tx = String(vente.tx);
  const mails = d.ventesPro.get(tx) || [];
  const f = d.factures.get(tx) || null;
  const av = d.avoirs.get(tx) || null;
  // Une vente Pro se PROUVE : un e-mail Vinted Pro de CETTE transaction, ou le
  // profil du compte lu « professionnel ». « Pas su » ne montre rien.
  const proCompte = vente.uid != null ? d.comptesPro.get(String(vente.uid)) : undefined;
  const emise = !!(f && f.emiseLe);
  const pro = mails.length > 0 || proCompte === true || emise;
  if (!pro) return null;
  const e = f && f.envoi;
  let corps;
  let preuve = null;
  if (emise) {
    corps = (
      <button type="button" className={ligne ? 'vrm-fp-ligne-etat' : 'vrm-fp-vente-ligne'} data-fp-vente={e ? e.etat : 'emise'} data-sans-glisse="" onClick={() => setOuverte(true)}>
        <b>{ligne ? (e && e.etat === 'envoyee' ? `Facture envoyée le ${jourParis(e.at)}` : `Facture ${f.numero}`) : `Facture ${f.numero}`}</b>
        <span>{ligne ? (e && e.etat === 'envoyee' ? f.numero : motEnvoi(e, av)) : <>{motEnvoi(e, av)}{e && e.etat === 'envoyee' ? <> à <span className="vrm-sensible" data-stream-type="acheteur">{e.a}</span></> : null}</>}</span>
      </button>
    );
  } else {
    preuve = preuveAcheteur({ tx, mails, commandes: vente.commandes || [], brouillon: f, adresseLisible: adresseVintedLisible });
    // Le même refus sur d'autres lignes affichées : dit une fois en tête (`FactureRaisonsTete`).
    // Le bon de retour reste, lui, à côté de la vente.
    if (ligne && groupe && !preuve.prouve) { const r = refusDeLigne(vente, d); if (r && refusCommuns(groupe, d).has(r.cle)) return <div className="vrm-fp-ligne" data-fp-tx={tx} data-fp-forme="ligne"><BonRetour vente={vente} preuve={preuve} facture={f} deps={deps} ligne/></div>; }
    corps = preuve.prouve
      ? <button type="button" className={`vrm-b vrm-b-secondaire${ligne ? ' vrm-fp-ligne-bouton' : ' vrm-b-plein'}`} data-fp-vente="a-faire" data-fp-preuve="ok" data-sans-glisse="" onClick={() => setOuverte(true)}>Envoyer la facture</button>
      : <p className={ligne ? 'vrm-fp-ligne-raison' : 'vrm-fp-muet vrm-fp-raison'} data-fp-vente="pas-prouve" data-fp-preuve={preuve.code}>Facture : {phraseRefus(preuve)}.</p>;
  }
  return <div className={ligne ? 'vrm-fp-ligne' : 'vrm-fp-vente'} data-fp-tx={tx} data-fp-forme={ligne ? 'ligne' : 'fiche'}>
    {corps}
    <BonRetour vente={vente} preuve={preuve} facture={f} deps={deps} ligne={ligne}/>
    {ouverte ? <FeuilleFactureVente vente={vente} preuve={preuve} facture={f} avoir={av} deps={deps} fermer={() => setOuverte(false)}/> : null}
  </div>;
}

// ── LE BON DE RETOUR (11 nov., lot DJ1) ─────────────────────────────────────
// « à côté de chaque vente le bon de retour pour toutes les ventes sur un compte
// professionnel » : le formulaire de retour que Vinted a joint à l'e-mail de CETTE
// vente (rangé avec le brouillon `email_invoice_tx{n°}`, lu seulement au clic — jamais
// dans une liste, §4.4) ; sinon un bon dessiné par VRM pour cette vente
// (src/facturePro/bonRetour.js), avec l'adresse de retour de « Ma facture ».
async function ouvrirOctetsPdf(deps, octets, nom, titre) {
  const blob = new Blob([octets], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  if (deps.ouvrirPdfOnglet && deps.ouvrirPdfOnglet(url, nom, titre)) return;
  const a = document.createElement('a'); a.href = url; a.download = nom; a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function BonRetour({ vente, preuve, facture, deps, ligne }) {
  const cfg = useFicheFacturation(deps);
  const [occupe, setOccupe] = React.useState(false);
  const tx = String(vente.tx);
  const deVinted = !!(facture && facture.retour);
  const ouvrir = async () => {
    setOccupe(true);
    try {
      if (deVinted) {
        const r = await deps.lireTout(`id=eq.${encodeURIComponent('email_invoice_tx' + tx)}&select=b64:data->>retourB64,nom:data->>retourNom`, { strict: true }).catch(() => null);
        const b64 = Array.isArray(r) && r[0] && typeof r[0].b64 === 'string' ? r[0].b64 : '';
        if (b64.length > 100) {
          const bin = atob(b64); const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i);
          await ouvrirOctetsPdf(deps, o, (r[0].nom || `Formulaire-retour-${tx}.pdf`).replace(/[^\w.-]/g, '-'), 'Bon de retour');
          return;
        }
        if (r === null) { deps.toast("Le bon de retour n'a pas pu être lu — réessaie dans un instant."); return; }
      }
      const { contenuBonRetour, pdfBonRetour, nomFichierBonRetour } = await import('./facturePro/bonRetour.js');
      const c = contenuBonRetour(cfg || {}, { tx, designation: (preuve && preuve.designation) || vente.titre, venteLe: (preuve && preuve.venteLe) || vente.venteLe });
      if (!c.ok) { deps.toast(`Bon de retour : il manque ${c.manque.join(', ')} (Argent → Factures → Ma facture).`); return; }
      await ouvrirOctetsPdf(deps, await pdfBonRetour(c), nomFichierBonRetour(c), 'Bon de retour');
    } catch (_) { deps.toast("Le bon de retour n'a pas pu être préparé — réessaie."); } finally { setOccupe(false); }
  };
  return <button type="button" className={`vrm-b vrm-b-secondaire${ligne ? ' vrm-fp-ligne-bouton' : ' vrm-b-plein'}`} data-fp-bon-retour={deVinted ? 'vinted' : 'vrm'} data-sans-glisse="" disabled={occupe} onClick={ouvrir}>{occupe ? 'Un instant…' : 'Bon de retour'}</button>;
}

function FeuilleFactureVente({ vente, preuve, facture, avoir, deps, fermer }) {
  const cfg = useFicheFacturation(deps);
  const etat = useEtatEnvoi(deps);
  const tx = String(vente.tx);
  const [fiche, setFiche] = React.useState(false);
  const [designation, setDesignation] = React.useState(() => (preuve && preuve.prouve ? preuve.designation : '') || vente.titre || '');
  const [occupe, setOccupe] = React.useState('');
  const [retour, setRetour] = React.useState(null);
  const [emiseIci, setEmiseIci] = React.useState(null);
  const [envoiIci, setEnvoiIci] = React.useState(null);
  const [envoisIci, setEnvoisIci] = React.useState(null);
  React.useEffect(() => { if (!fiche) relireEtatEnvoi(deps); }, [deps, fiche]);
  const prouve = !!(preuve && preuve.prouve);
  // (10 nov., lot T) « Facture en anglais » : une option PAR facture, pré-cochée
  // seulement quand l'adresse prouvée finit par un pays étranger (un indice).
  const [anglais, setAnglais] = React.useState(() => !!(prouve && acheteurHorsFrance(preuve.acheteur && preuve.acheteur.adresse)));
  const donnees = prouve ? { acheteur: preuve.acheteur, designation, centimes: preuve.centimes, venteLe: preuve.venteLe, reference: tx, plateforme: 'Vinted' } : null;
  const emise = !!(facture && facture.emiseLe) || !!emiseIci;
  const numero = (emiseIci && emiseIci.numero) || (facture && facture.numero) || '';

  if (fiche) return <Feuille titre="Ma facture" fermer={() => { setFiche(false); relireEtatEnvoi(deps); }} deps={deps} large data={{ 'data-fp-feuille-fiche': '' }}><FicheFacturation deps={deps} focus={typeof fiche === 'string' ? fiche : null} surPrete={() => setFiche(false)}/></Feuille>;

  const mv = cfg ? manquantsVendeur(cfg) : [];
  const mvt = donnees ? manquantsVente(donnees, { pourEnvoi: true }) : [];
  const bloque = bloqueEnvoi(cfg, etat);
  let apercu = null; let mail = null;
  if (cfg && donnees && !mv.length && !manquantsVente(donnees).length) {
    try { apercu = contenuFacture(cfg, donnees, { numero: numero || (etat && Number.isInteger(etat.prochain) ? numeroFacture(cfg.prefixe, anneeParis(Date.now()), etat.prochain) : '…'), emiseLe: Date.now(), langue: anglais ? 'en' : 'fr' }); mail = emailFacture(cfg, apercu, { via: cfg.envoiPar === 'boite' ? 'boite' : 'vrm' }); } catch (_) {}
  }

  const envoyerFacture = async (renvoyer) => {
    if (renvoyer && !(await deps.askConfirm({ title: 'Renvoyer la facture ?', desc: `La même facture (${numero}) repart à l'acheteur.`, ok: 'Renvoyer' }))) return false;
    setOccupe('envoyer'); setRetour(null);
    const r = await route(deps, { action: 'envoyer', confirme: true, tx, renvoyer: !!renvoyer });
    setOccupe('');
    if (r.j.envoi) setEnvoiIci(r.j.envoi);
    if (Array.isArray(r.j.envois)) setEnvoisIci(r.j.envois);
    if (r.j.issue === 'envoye') setRetour(null);
    else if (r.j.issue === 'incertain') setRetour({ ko: true, t: `On ne sait pas si elle est partie : ${r.j.envoi.message} Regarde dans les messages envoyés avant de la renvoyer.` });
    else setRetour({ ko: true, t: `Pas envoyée. ${(r.j.envoi && r.j.envoi.message) || r.j.message || "La facture n'est pas partie."}` });
    relireFactures(deps); relireEtatEnvoi(deps);
    return r.j.issue === 'envoye';
  };
  const emettre = async (envoyer) => {
    if (!(await deps.askConfirm(envoyer
      ? { title: 'Envoyer la facture ?', desc: `À ${preuve.acheteur.nom} (${preuve.acheteur.email}).${cfg.envoiPar === 'boite' ? '' : ' Elle part de VRM à ton nom, avec toi en copie.'} Elle reçoit son numéro définitif et ne se modifie plus (pour la corriger, il faudra un avoir).`, ok: 'Envoyer' }
      : { title: 'Émettre la facture sans l’envoyer ?', desc: 'Elle reçoit son numéro définitif et ne se modifie plus. Tu pourras l’envoyer ensuite, ou partager le PDF.', ok: 'Émettre' }))) return;
    setOccupe('emettre'); setRetour(null);
    const r = await route(deps, { action: 'emettre', confirme: true, tx, compte: vente.compte || '', designation, langue: anglais ? 'en' : 'fr' });
    if (r.code !== 200) { setOccupe(''); setRetour({ ko: true, t: r.j.manquants ? `Il manque : ${r.j.manquants.map((m) => m.l).join(', ')}.` : (r.j.message || "La facture n'a pas pu être émise. Réessaie : elle gardera le même numéro.") }); return; }
    setEmiseIci(r.j.facture);
    if (envoyer) { await envoyerFacture(false); } else { setOccupe(''); setRetour({ t: `Facture ${r.j.facture.numero} émise.` }); }
    relireFactures(deps);
  };
  const voirPdf = async (partager, quoi = 'facture') => {
    setOccupe('pdf');
    const id = quoi === 'avoir' ? `email_invoice_av${tx}` : `email_invoice_tx${tx}`;
    const c = (quoi === 'facture' && emiseIci && emiseIci.contenu) || await lireContenu(deps, id);
    setOccupe('');
    if (!c) { deps.toast("Le PDF n'a pas pu être lu — réessaie dans un instant."); return; }
    await ouvrirPdf(c, deps, { partager });
  };
  const faireAvoir = async () => {
    if (!(await deps.askConfirm({ title: `Annuler la facture ${numero} ?`, desc: "VRM émet un avoir numéroté qui l'annule (vente annulée, remboursement). La facture reste dans ta comptabilité : une facture ne se supprime jamais.", ok: "Émettre l'avoir", danger: true }))) return;
    setOccupe('avoir'); const r = await route(deps, { action: 'avoir', confirme: true, tx }); setOccupe('');
    if (r.code === 200) { setRetour({ t: `Avoir ${r.j.avoir.numero} émis.` }); relireFactures(deps); } else setRetour({ ko: true, t: r.j.message || "L'avoir n'a pas pu être émis." });
  };

  const envoi = envoiIci || (facture && facture.envoi);
  const envois = envoisIci || (facture && Array.isArray(facture.envois) ? facture.envois : []);
  const dejaParti = !!(envoi && (envoi.etat === 'envoyee' || envoi.etat === 'incertaine'));
  const geste = (b) => (b && b.champ ? <button type="button" className="vrm-b vrm-b-primaire vrm-b-plein" data-fp-geste-manque={b.champ} onClick={() => setFiche(b.champ)}>{b.geste}</button> : b ? <button type="button" className="vrm-b vrm-b-primaire vrm-b-plein" data-fp-geste-manque="" disabled>{b.geste}</button> : null);
  return (
    <Feuille titre={emise ? `Facture ${numero}` : 'Envoyer la facture'} fermer={fermer} deps={deps} large data={{ 'data-fp-feuille-vente': tx }}>
      {cfg === undefined ? <p className="vrm-fp-muet">Lecture de ta fiche…</p>
        : cfg === null ? <p className="vrm-fp-muet">Ta fiche n'a pas pu être lue — réessaie dans un instant.</p>
        : emise ? <>
          <div className="vrm-fp-etat" data-fp-envoi={(envoi && envoi.etat) || 'aucun'}>
            <b>{avoir && avoir.emiseLe ? `Annulée par l'avoir ${avoir.numero}` : envoi && envoi.etat === 'envoyee' ? `Facture envoyée le ${jourParis(envoi.at)} à ${heureParis(envoi.at)}` : envoi && envoi.etat === 'incertaine' ? 'Envoi incertain' : envoi && envoi.etat === 'refusee' ? 'Pas envoyée' : 'Émise, pas encore envoyée'}</b>
            <span>{envoi && envoi.etat === 'envoyee' ? <>à <span className="vrm-sensible" data-stream-type="acheteur">{envoi.a}</span>{envoi.via === 'vrm' ? ', par VRM, toi en copie' : ''}{envoi.retour ? ', avec le formulaire de retour de Vinted' : ''}.</> : envoi && envoi.message ? envoi.message : 'Une facture émise ne se modifie plus.'}</span>
          </div>
          <div className="vrm-fp-gestes">
            <button type="button" className="vrm-b vrm-b-secondaire" disabled={!!occupe} onClick={() => voirPdf(false)} data-fp-pdf="">Voir le PDF</button>
            <button type="button" className="vrm-b vrm-b-secondaire" disabled={!!occupe} onClick={() => voirPdf(true)}>Partager</button>
            {!bloque && !(avoir && avoir.emiseLe) ? <button type="button" className="vrm-b vrm-b-primaire" disabled={!!occupe} data-fp-envoyer="" onClick={() => envoyerFacture(dejaParti)}>{occupe === 'envoyer' ? 'Envoi…' : dejaParti ? 'Renvoyer' : "Envoyer à l'acheteur"}</button> : null}
          </div>
          {bloque && !(avoir && avoir.emiseLe) && etat !== undefined ? <p className="vrm-fp-muet" data-fp-bloque="">{bloque.texte} {bloque.champ ? <button type="button" className="vrm-lien-action" onClick={() => setFiche(bloque.champ)}>{bloque.geste}</button> : null}</p> : null}
          {envois.length ? <section className="vrm-fp-section" data-fp-journal={envois.length}>
            <h3>Journal des envois</h3>
            <ul className="vrm-fp-journal">{[...envois].reverse().map((x, i) => <li key={i} data-fp-journal-etat={x.etat}><b>{jourParis(x.at)} à {heureParis(x.at)}</b><span>{x.etat === 'envoyee' ? 'envoyée' : x.etat === 'incertaine' ? 'incertaine' : 'pas envoyée'} · à <span className="vrm-sensible" data-stream-type="acheteur">{x.a}</span>{x.via === 'vrm' ? ' · par VRM' : ' · depuis ta boîte'}</span></li>)}</ul>
          </section> : null}
          {avoir && avoir.emiseLe ? <button type="button" className="vrm-b vrm-b-discret" onClick={() => voirPdf(false, 'avoir')}>Voir l'avoir {avoir.numero}</button>
            : <details className="vrm-fp-plus"><summary>Vente annulée ou remboursée ?</summary><p className="vrm-fp-muet">Une facture ne se supprime pas : elle s'annule par un avoir.</p><button type="button" className="vrm-b vrm-b-discret" disabled={!!occupe} onClick={faireAvoir} data-fp-avoir="">Annuler par un avoir</button></details>}
        </> : !prouve ? <div className="vrm-fp-etat is-manque" data-fp-preuve={preuve ? preuve.code : 'inconnu'}><b>Pas de facture pour cette vente</b><span>{phraseRefus(preuve) || 'acheteur pas prouvé'}.</span></div>
        : <>
          {mv.length ? <div className="vrm-fp-etat is-manque" data-fp-etat={mv.length}><b>Ta fiche « Ma facture » n'est pas complète</b><span>Il manque {mv.map((m) => m.l).join(', ')}.</span>
            <button type="button" className="vrm-b vrm-b-primaire" onClick={() => setFiche(mv[0].champ)} data-fp-completer="">Compléter ma fiche</button></div> : null}
          <section className="vrm-fp-section" data-fp-destinataire="">
            <h3>Destinataire</h3>
            <p className="vrm-fp-dest vrm-sensible" data-stream-type="acheteur"><b>{preuve.acheteur.nom}</b><span>{preuve.acheteur.email}</span></p>
            <p className="vrm-fp-muet" data-fp-preuve="ok">Acheteur prouvé : le même n° de transaction ({tx}) sur la vente et l'e-mail Pro, arrivé {preuve.ecartS < 0 ? `${-preuve.ecartS} s avant` : preuve.ecartS < 120 ? `${preuve.ecartS} s après` : `${Math.round(preuve.ecartS / 60)} min après`} la vente, même montant.</p>
          </section>
          <section className="vrm-fp-section">
            <h3>L'article</h3>
            <label className="vrm-fp-champ is-large"><span>Désignation</span><input value={designation} onChange={(e) => setDesignation(e.target.value)}/></label>
            <p className="vrm-fp-muet">Prix : <b className="vrm-fp-chiffre">{euros(preuve.centimes)}</b> — la vente Vinted, sans port ni protection acheteur.</p>
            <label className="vrm-fp-anglais" data-fp-anglais={anglais ? '1' : '0'}>
              <input type="checkbox" checked={anglais} onChange={(e) => setAnglais(e.target.checked)} disabled={!!occupe}/>
              <span><b>Facture en anglais</b><small>Français et anglais côte à côte. Toujours en euros.</small></span>
            </label>
          </section>
          {mail ? <section className="vrm-fp-section" data-fp-mail="">
            <h3>L'e-mail</h3>
            <div className="vrm-fp-mail"><small>De</small><span>{mail.nomExpediteur}{cfg.envoiPar === 'boite' ? '' : ` — réponses et copie à ${cfg.email || 'ton e-mail'}`}</span><small>Objet</small><b data-fp-objet="">{mail.sujet}</b><small>Message</small><pre className="vrm-sensible" data-stream-type="acheteur">{mail.texte}</pre><small>Pièce jointe</small><span>{nomFichier(apercu)}</span></div>
          </section> : null}
          {apercu ? <section className="vrm-fp-section"><h3>Aperçu de la facture</h3><ApercuFacture contenu={apercu} provisoire sensible numeroLibelle={etat && Number.isInteger(etat.prochain) && !numero ? `N° ${apercu.numero} (donné à l’émission)` : ''}/></section> : null}
          {!mv.length && mvt.length ? <p className="vrm-fp-muet" data-fp-manque-vente="">Il manque {mvt.map((m) => m.l).join(', ')}.</p> : null}
          <div className="vrm-fp-gestes is-bas">
            {bloque ? <>{bloque.texte ? <p className="vrm-fp-muet" data-fp-bloque="">{bloque.texte}</p> : null}{geste(bloque)}</>
              : <button type="button" className="vrm-b vrm-b-primaire vrm-b-plein" data-fp-emettre-envoyer="" disabled={!!occupe || !!mv.length || !!mvt.length} onClick={() => emettre(true)}>{occupe ? 'Un instant…' : 'Envoyer la facture'}</button>}
            <button type="button" className="vrm-b vrm-b-secondaire vrm-b-plein" data-fp-emettre="" disabled={!!occupe || !!mv.length || !!manquantsVente(donnees).length} onClick={() => emettre(false)}>Émettre sans envoyer</button>
          </div>
        </>}
      {retour ? <p className={`vrm-fp-retour-msg${retour.ko ? ' is-ko' : ''}`} role="status" data-fp-retour={retour.ko ? 'ko' : 'ok'}>{retour.t}</p> : null}
    </Feuille>
  );
}


// ════════════════════════════════════════════════════════════════════════════
//  (10 nov., lot Q) « À ENVOYER » — les ventes Pro sans facture envoyée
// ════════════════════════════════════════════════════════════════════════════
// La règle : src/facturePro/registre.js (`listeAEnvoyer`, la même que l'envoi
// automatique du serveur). Prouvée ⇒ elle part (une par une, ou « Tout envoyer »
// confirmé) ; pas prouvée ⇒ la raison, aucun bouton ; vente annulée avec une
// facture ⇒ l'avoir est PROPOSÉ (son clic). Les ventes Vinted viennent de la coque
// (`useVentesCoque`, déjà lues) : aucune lecture de plus.
const JOURS_COMPTE_PRO = 30;
function commandesDeCoque(ventes) {
  if (ventes === undefined) return undefined;
  if (!Array.isArray(ventes)) return null;
  const m = new Map();
  for (const o of ventes) {
    if (!o || o.transaction_id == null) continue;
    const k = String(o.transaction_id);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push({ transaction_id: k, date: o.date || null, price: o.price || null, status: o.status || '', uid: String((o._acc && o._acc.vinted_user_id) || o._uid || ''), title: o.title || '', compte: (o._acc && o._acc.login) || '' });
  }
  return m;
}
const motEtat = (it) => (it.etat === 'a-envoyer' ? (it.emise ? `Facture ${it.numero}, pas envoyée` : 'Acheteur prouvé')
  : it.etat === 'a-annuler' ? `Vente annulée · facture ${it.numero}`
  : it.etat === 'lecture' ? 'Lecture…'
  : it.raison ? it.raison.replace(/^acheteur pas prouvé : /, 'Pas prouvé : ') : '');
// (11 nov., lot actions-serie) « Facture Pro » sur une SÉLECTION de ventes (Ventes →
// Sélectionner) : EXACTEMENT les gestes de « Tout envoyer » ci-dessous (émettre si pas
// émise, puis envoyer à SON acheteur prouvé), limités aux ventes cochées ; une vente qui
// n'est pas Pro, pas prouvée ou déjà envoyée est « pas faite » avec SA raison. Une
// confirmation d'abord ; un 429/503 arrête la série (comme l'unitaire). Rend
// { faits, pasFaits } (src/selectionSerie.js) ou null si Annuler.
export async function envoyerFacturesSerie(deps, txs, ventes) {
  const voulues = [...new Set((txs || []).map(String))];
  const [d, etat] = await Promise.all([relireFactures(deps), relireEtatEnvoi(deps)]);
  let cfg = _cfg;
  if (cfg === undefined || cfg === null) { try { const x = await deps.lireReglage(ID_CFG); cfg = x === null ? null : { ...VIDE, ...migrerAncienne(x) }; poserCfg(cfg); } catch (_) { cfg = null; } }
  if (!d) return { faits: [], pasFaits: voulues.map((tx) => ({ cle: tx, raison: 'ventes Pro pas lues' })) };
  const commandesParTx = commandesDeCoque(ventes) || new Map();
  const liste = listeAEnvoyer({ ventesPro: d.ventesPro, factures: d.factures, avoirs: d.avoirs, commandesParTx, classer: deps.classifyOrderStatus || (() => 'pending'), adresseLisible: adresseVintedLisible, txsEnPlus: voulues.filter((tx) => { const c = (commandesParTx.get(tx) || [])[0]; return c && d.comptesPro.get(c.uid) === true; }) });
  const parTx = new Map((liste || []).map((it) => [String(it.tx), it]));
  const prets = [], pasFaits = [];
  for (const tx of voulues) {
    const it = parTx.get(tx);
    if (!it) { pasFaits.push({ cle: tx, raison: (d.factures.get(tx) && (d.factures.get(tx).envoi || d.factures.get(tx).envois)) ? 'déjà envoyée' : 'pas une vente Pro' }); continue; }
    if (it.etat !== 'a-envoyer') { pasFaits.push({ cle: tx, raison: it.raison ? String(it.raison).replace(/^acheteur pas prouvé : /, 'pas prouvé : ') : 'acheteur pas prouvé' }); continue; }
    prets.push(it);
  }
  const mv = cfg ? manquantsVendeur(cfg) : [{ l: 'ta fiche de facturation' }];
  const bloque = mv.length ? { texte: `il manque ${mv.map((m) => m.l).join(', ')}` } : bloqueEnvoi(cfg, etat);
  if (prets.length && bloque) { for (const it of prets.splice(0)) pasFaits.push({ cle: String(it.tx), raison: (bloque.texte || bloque.geste || 'envoi pas possible').replace(/\.$/, '').toLowerCase() }); }
  if (!prets.length) return { faits: [], pasFaits };
  if (!(await deps.askConfirm({ title: `Envoyer ${prets.length} facture${prets.length > 1 ? 's' : ''} ?`, desc: `Chacune à SON acheteur prouvé${cfg && cfg.envoiPar === 'boite' ? '' : ', par VRM, toi en copie'}.${pasFaits.length ? ` ${pasFaits.length} vente${pasFaits.length > 1 ? 's' : ''} de la sélection ne ${pasFaits.length > 1 ? 'partent' : 'part'} pas (raison dite après).` : ''}`, ok: 'Envoyer', cancel: 'Annuler' }))) return null;
  const faits = [];
  for (let i = 0; i < prets.length; i++) {
    const it = prets[i], tx = String(it.tx);
    if (!it.emise) {
      const r = await route(deps, { action: 'emettre', confirme: true, tx, compte: it.compte || '' });
      if (r.code !== 200) { pasFaits.push({ cle: tx, raison: r.j.manquants ? `il manque ${r.j.manquants.map((m) => m.l).join(', ')}` : (r.j.message || 'pas émise') }); if (r.code === 503 || r.j.manquants) { for (const x of prets.slice(i + 1)) pasFaits.push({ cle: String(x.tx), raison: 'série arrêtée' }); break; } continue; }
    }
    const r2 = await route(deps, { action: 'envoyer', confirme: true, tx });
    if (r2.j.issue === 'envoye') { faits.push(tx); continue; }
    pasFaits.push({ cle: tx, raison: (r2.j.envoi && r2.j.envoi.message) || r2.j.message || 'pas envoyée' });
    if (r2.code === 429 || r2.code === 503 || r2.code === 0) { for (const x of prets.slice(i + 1)) pasFaits.push({ cle: String(x.tx), raison: 'série arrêtée' }); break; }
  }
  relireFactures(deps); relireEtatEnvoi(deps);
  return { faits, pasFaits };
}
export function FacturesAEnvoyer({ deps }) {
  const d = useFactures(deps);
  const cfg = useFicheFacturation(deps);
  const etat = useEtatEnvoi(deps);
  const coque = deps.useVentesCoque ? deps.useVentesCoque() : { ventes: undefined };
  const [ouverte, setOuverte] = React.useState(null);
  const [fiche, setFiche] = React.useState(null);
  const [lot, setLot] = React.useState(null);
  const [msg, setMsg] = React.useState(null);
  const commandesParTx = React.useMemo(() => commandesDeCoque(coque.ventes), [coque.ventes]);
  const liste = React.useMemo(() => {
    if (!d) return null;
    const enPlus = [];
    if (commandesParTx) {
      const limite = Date.now() - JOURS_COMPTE_PRO * 86400000;
      for (const [tx, cs] of commandesParTx) { const c = cs[0]; if (c && d.comptesPro.get(c.uid) === true && (Date.parse(c.date || '') || 0) >= limite) enPlus.push(tx); }
    }
    return listeAEnvoyer({ ventesPro: d.ventesPro, factures: d.factures, avoirs: d.avoirs, commandesParTx, classer: deps.classifyOrderStatus || (() => 'pending'), adresseLisible: adresseVintedLisible, txsEnPlus: enPlus });
  }, [d, commandesParTx, deps]);
  if (d === undefined || cfg === undefined) return null;
  if (d === null) return <p className="vrm-fp-muet">Tes ventes Pro n'ont pas pu être lues — réessaie dans un instant.</p>;
  if (!liste || !liste.length) return null;
  const prets = liste.filter((x) => x.etat === 'a-envoyer');
  const mv = cfg ? manquantsVendeur(cfg) : [];
  const bloque = bloqueEnvoi(cfg, etat);
  const toutEnvoyer = async () => {
    if (!(await deps.askConfirm({ title: `Envoyer ${prets.length} facture${prets.length > 1 ? 's' : ''} ?`, desc: `Chacune à SON acheteur prouvé${cfg && cfg.envoiPar === 'boite' ? '' : ', par VRM, toi en copie'}. Elles reçoivent leur numéro définitif.`, ok: 'Tout envoyer' }))) return;
    setMsg(null); let parties = 0; const ratees = [];
    for (let i = 0; i < prets.length; i++) {
      const it = prets[i]; setLot({ i: i + 1, n: prets.length });
      if (!it.emise) {
        const r = await route(deps, { action: 'emettre', confirme: true, tx: it.tx, compte: it.compte || '' });
        if (r.code !== 200) { ratees.push(`${it.tx} : ${r.j.manquants ? `il manque ${r.j.manquants.map((m) => m.l).join(', ')}` : (r.j.message || 'pas émise')}`); if (r.code === 503 || r.j.manquants) break; continue; }
      }
      const r2 = await route(deps, { action: 'envoyer', confirme: true, tx: it.tx });
      if (r2.j.issue === 'envoye') { parties++; continue; }
      ratees.push(`${it.tx} : ${(r2.j.envoi && r2.j.envoi.message) || r2.j.message || 'pas envoyée'}`);
      if (r2.code === 429 || r2.code === 503 || r2.code === 0) break;
    }
    setLot(null);
    setMsg({ ko: ratees.length > 0, t: `${parties} envoyée${parties > 1 ? 's' : ''}${ratees.length ? ` · ${ratees.length} pas envoyée${ratees.length > 1 ? 's' : ''} — ${ratees.join(' · ')}` : ''}.` });
    relireFactures(deps); relireEtatEnvoi(deps);
  };
  const faireAvoir = async (it) => {
    if (!(await deps.askConfirm({ title: `Annuler la facture ${it.numero} ?`, desc: 'La vente est annulée sur Vinted. VRM émet un avoir numéroté qui annule la facture ; la facture reste dans ta comptabilité.', ok: "Émettre l'avoir", danger: true }))) return;
    const r = await route(deps, { action: 'avoir', confirme: true, tx: it.tx });
    setMsg(r.code === 200 ? { t: `Avoir ${r.j.avoir.numero} émis.` } : { ko: true, t: r.j.message || "L'avoir n'a pas pu être émis." });
    relireFactures(deps);
  };
  const venteDe = (it) => { const cs = (commandesParTx && commandesParTx.get(it.tx)) || []; return { tx: it.tx, uid: cs[0] ? cs[0].uid : undefined, compte: (cs[0] && cs[0].compte) || it.compte || '', titre: it.designation, venteLe: it.venteLe, commandes: cs }; };
  let geste = null;
  if (prets.length) {
    geste = mv.length ? <button type="button" className="vrm-b vrm-b-secondaire" data-fp-geste-manque="fiche" onClick={() => setFiche(mv[0].champ)}>Compléter ma fiche</button>
      : bloque && bloque.champ ? <button type="button" className="vrm-b vrm-b-secondaire" data-fp-geste-manque={bloque.champ} onClick={() => setFiche(bloque.champ)}>{bloque.geste}</button>
      : <button type="button" className="vrm-b vrm-b-primaire" data-fp-tout-envoyer={prets.length} disabled={!!lot || !!bloque} onClick={toutEnvoyer}>{lot ? `Envoi ${lot.i}/${lot.n}…` : `Tout envoyer (${prets.length})`}</button>;
  }
  return (
    <section className="vrm-fp-section vrm-fp-a-envoyer" data-fp-a-envoyer={liste.length} data-fp-prets={prets.length}>
      <div className="vrm-fp-tete-ligne"><h3>À envoyer</h3>{geste}</div>
      {prets.length && mv.length ? <p className="vrm-fp-muet is-ambre" data-fp-manque-fiche={mv.length}>Il manque {mv.map((m) => m.l).join(', ')}.</p> : null}
      {prets.length && !mv.length && bloque && bloque.texte ? <p className="vrm-fp-muet is-ambre" data-fp-bloque="">{bloque.texte}</p> : null}
      <ul className="vrm-fp-rangees">
        {liste.map((it) => {
          const peutOuvrir = it.etat === 'a-envoyer' || it.etat === 'a-verifier' || it.etat === 'sans-preuve';
          const corps = <span className="vrm-fp-rangee-txt"><b>{it.designation || `Vente ${it.tx}`}</b><span>{it.venteLe ? `${jourParis(it.venteLe)} · ` : ''}{motEtat(it)}</span></span>;
          return <li key={it.tx} data-fp-a-envoyer-tx={it.tx} data-fp-a-envoyer-etat={it.etat} data-fp-preuve={it.code || (it.etat === 'a-envoyer' ? 'ok' : '')}>
            {peutOuvrir ? <button type="button" className="vrm-fp-rangee is-chevron" onClick={() => setOuverte(it)}>{corps}</button>
              : <div className="vrm-fp-rangee">{corps}{it.etat === 'a-annuler' ? <button type="button" className="vrm-b vrm-b-secondaire" data-fp-proposer-avoir={it.tx} onClick={() => faireAvoir(it)}>Émettre l'avoir</button> : null}</div>}
          </li>;
        })}
      </ul>
      {msg ? <p className={`vrm-fp-retour-msg${msg.ko ? ' is-ko' : ''}`} role="status" data-fp-lot={msg.ko ? 'ko' : 'ok'}>{msg.t}</p> : null}
      {ouverte ? <FeuilleFactureVente vente={venteDe(ouverte)} preuve={ouverte.preuve || null} facture={d.factures.get(ouverte.tx) || null} avoir={d.avoirs.get(ouverte.tx) || null} deps={deps} fermer={() => setOuverte(null)}/> : null}
      {fiche ? <Feuille titre="Ma facture" fermer={() => { setFiche(null); relireEtatEnvoi(deps); }} deps={deps} large data={{ 'data-fp-feuille-fiche': '' }}><FicheFacturation deps={deps} focus={fiche} surPrete={() => setFiche(null)}/></Feuille> : null}
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  (10 nov., lot Q) LE REGISTRE DES FACTURES — une période, et son zip (PDF + CSV)
// ════════════════════════════════════════════════════════════════════════════
// Factures ET avoirs émis, dans l'ordre d'émission ; les trous de la numérotation
// sont DITS (un n° pris sans pièce) ; une facture émise ne se supprime jamais (il n'y
// a aucun geste pour ça) : elle s'annule par un avoir. Le zip : chaque PDF (le même
// instantané que celui envoyé) + le registre en CSV ; une pièce illisible ⇒ AUCUN zip
// (jamais un zip partiel présenté comme complet).
async function lireContenus(deps, ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 25) {
    const part = ids.slice(i, i + 25);
    const r = await deps.lireTout(`id=in.(${part.map(encodeURIComponent).join(',')})&select=id,contenu:data->contenu`, { strict: true });
    if (!Array.isArray(r)) return null;
    for (const x of r) if (x && x.contenu) out.set(x.id, x.contenu);
  }
  return out;
}
function telecharger(octets, nom, type) {
  const url = URL.createObjectURL(new Blob([octets], { type }));
  const a = document.createElement('a'); a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const libelleMois = (m) => { try { const t = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-15T12:00:00Z`)); return t.charAt(0).toUpperCase() + t.slice(1); } catch (_) { return m; } };
export function ListeFacturesPro({ deps }) {
  const d = useFactures(deps);
  const [occupe, setOccupe] = React.useState('');
  const [periode, setPeriode] = React.useState('');
  const [msg, setMsg] = React.useState(null);
  const tout = React.useMemo(() => (d ? lignesRegistre(d.toutes) : []), [d]);
  const per = React.useMemo(() => periodesRegistre(tout), [tout]);
  const trous = React.useMemo(() => (d ? trousNumerotation(d.toutes) : null), [d]);
  if (d === undefined) return null;
  if (d === null) return <p className="vrm-fp-muet">Tes factures Pro n'ont pas pu être lues — réessaie dans un instant.</p>;
  const p = periode || per.mois[0] || '';
  const lignes = p ? tout.filter((l) => dansPeriode(l, p)) : [];
  const tot = totauxRegistre(lignes);
  const manquants = trous ? [...trous.facture.manquants.map((n) => ({ n, s: 'facture' })), ...trous.avoir.manquants.map((n) => ({ n, s: 'avoir' }))] : [];
  const ouvrir = async (x) => {
    setOccupe(x.id);
    const c = await lireContenu(deps, x.id); setOccupe('');
    if (!c) { deps.toast("Le PDF n'a pas pu être lu — réessaie."); return; }
    ouvrirPdf(c, deps);
  };
  const exporter = async () => {
    setOccupe('zip'); setMsg(null);
    try {
      const contenus = await lireContenus(deps, lignes.map((l) => l.id));
      const manque = contenus ? lignes.filter((l) => !contenus.has(l.id)) : lignes;
      if (manque.length) { setMsg({ ko: true, t: `${manque.length} pièce${manque.length > 1 ? 's' : ''} pas lue${manque.length > 1 ? 's' : ''} : rien n'a été téléchargé. Réessaie.` }); return; }
      const [{ pdfFacture }, { zipStocke }] = await Promise.all([import('./facturePro/pdf.js'), import('./exportDonnees.js')]);
      const fichiers = [{ nom: `Registre-factures-${p}.csv`, texte: csvRegistre(lignes) }];
      for (const l of lignes) { const c = contenus.get(l.id); fichiers.push({ nom: nomFichier(c), octets: new Uint8Array(await pdfFacture(c)) }); }
      telecharger(zipStocke(fichiers), nomZip(p), 'application/zip');
      setMsg({ t: `Zip prêt : ${lignes.length} pièce${lignes.length > 1 ? 's' : ''} et le registre.` });
    } catch (_) { setMsg({ ko: true, t: "Le zip n'a pas pu être fabriqué : rien n'a été téléchargé." }); } finally { setOccupe(''); }
  };
  return (
    <section className="vrm-fp-section vrm-fp-registre" data-fp-liste={tout.length} data-fp-registre-periode={p} data-fp-registre-n={lignes.length}>
      <div className="vrm-fp-tete-ligne">
        <h3>Registre des factures</h3>
        {tout.length ? <select className="vrm-fp-periode" aria-label="Période" value={p} onChange={(e) => { setPeriode(e.target.value); setMsg(null); }} data-fp-periode="">
          {per.mois.map((m) => <option key={m} value={m}>{libelleMois(m)}</option>)}
          {per.ans.map((a) => <option key={a} value={a}>Année {a}</option>)}
        </select> : null}
      </div>
      {manquants.length ? <p className="vrm-fp-muet is-ambre" data-fp-trous={manquants.length}>Numéro{manquants.length > 1 ? 's' : ''} pris sans pièce : {manquants.slice(0, 8).map((x) => `${x.s === 'avoir' ? 'avoir ' : ''}n° ${x.n}`).join(', ')}{manquants.length > 8 ? '…' : ''}.</p> : null}
      {!tout.length ? <p className="vrm-fp-muet">Aucune facture émise pour l'instant.</p> : <>
        <ul className="vrm-fp-liste">
          {lignes.map((x) => {
            const e = x.envoi;
            const etat = x.annuleePar ? `annulée (${x.annuleePar})` : !e ? 'pas envoyée' : e.etat === 'envoyee' ? `envoyée le ${jourParis(e.at)}` : e.etat === 'incertaine' ? 'envoi incertain' : e.etat === 'en-cours' ? 'envoi en cours' : 'pas envoyée';
            return <li key={x.id}><button type="button" disabled={occupe === x.id} onClick={() => ouvrir(x)} data-fp-ligne={x.numero} data-fp-ligne-type={x.avoir ? 'avoir' : 'facture'}>
              <b>{x.numero}</b><span>{x.avoir ? `Avoir de ${x.origine} · ` : ''}<span className="vrm-sensible" data-stream-type="acheteur">{x.acheteur || '—'}</span> · {x.emiseJour} · {etat}</span>
              <em>{x.ttc != null ? euros(x.ttc) : '—'}</em>
            </button></li>;
          })}
        </ul>
        <div className="vrm-fp-registre-pied">
          <span data-fp-registre-total={tot.ttc}>{tot.n} pièce{tot.n > 1 ? 's' : ''} · <b className="vrm-fp-chiffre">{tot.inconnus ? `au moins ${euros(tot.ttc)}` : euros(tot.ttc)}</b></span>
          <button type="button" className="vrm-b vrm-b-secondaire" disabled={!lignes.length || !!occupe} onClick={exporter} data-fp-export-zip="">{occupe === 'zip' ? 'Préparation…' : 'Exporter (zip)'}</button>
        </div>
      </>}
      {msg ? <p className={`vrm-fp-retour-msg${msg.ko ? ' is-ko' : ''}`} role="status" data-fp-zip={msg.ko ? 'ko' : 'ok'}>{msg.t}</p> : null}
    </section>
  );
}

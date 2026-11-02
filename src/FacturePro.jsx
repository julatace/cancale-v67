// ════════════════════════════════════════════════════════════════════════════
//  LA FACTURE PRO — les écrans (2 novembre)
// ════════════════════════════════════════════════════════════════════════════
// Deux pièces :
//   · `FicheFacturation` — ta fiche entreprise (tout ce qu'une facture doit
//     porter), ta personnalisation (logo, couleur, note, message) et ta boîte
//     d'envoi. L'aperçu se redessine pendant que tu tapes : c'est la facture
//     telle qu'elle partira.
//   · `FactureVente` — sur une vente d'un compte Pro : « Envoyer la facture à
//     l'acheteur ». L'acheteur est prérempli depuis l'e-mail de vente Vinted
//     Pro (relié par SON n° de transaction, jamais par ressemblance — §5).
//
// La règle vit dans ./facturePro/regle.js (la même que le serveur) ; le
// numéro, l'émission et l'envoi se font côté serveur (api/_lib/facture-pro.js).
// L'app ne fabrique jamais un numéro.
//
// Les outils de l'app (lecture de la base, confirmation, notifications) sont
// passés par `deps` : ce fichier n'importe rien d'App.jsx.
import React from 'react';
import { createPortal } from 'react-dom';
import './facture-pro.css';
import {
  REGIMES_TVA, FORMES, COULEURS, TAUX_TVA, estSociete, verifierSiret, manquantsVendeur, manquantsVente,
  contenuFacture, euros, emailValide, LOGO_MAX, MESSAGE_DEFAUT, nomFichier, jourParis, adresseVintedLisible,
} from './facturePro/regle.js';

const ID_CFG = 'vrm_pro_facture';
const VIDE = { nom: '', forme: '', siret: '', adresse: '', codePostal: '', ville: '', tva_regime: '', tva_taux: '', tva: '', rcs: '', capital: '', email: '', telephone: '', prefixe: 'FA', couleur: COULEURS[0], logo: '', note: '', message: '', copie: true };

// ── Une seule lecture de la fiche pour tout l'écran (trois états) ────────────
const _ecoutesCfg = new Set(); let _cfg; // undefined en cours · null pas su · objet
function poserCfg(v) { _cfg = v; _ecoutesCfg.forEach((f) => { try { f(v); } catch (_) {} }); }
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
// La fiche d'avant (16 oct.) : `tauxTva` « 0 » = franchise. On ne DEVINE pas
// le régime à partir de rien : un taux > 0 dit « TVA classique », « 0 » ne dit
// rien de sûr (franchise ou marge) — il reste à choisir.
function migrerAncienne(d) {
  const x = { ...(d || {}) };
  if (!x.tva_regime && x.tauxTva && Number(String(x.tauxTva).replace(',', '.')) > 0) { x.tva_regime = 'normal'; x.tva_taux = Number(String(x.tauxTva).replace(',', '.')); }
  return x;
}

// ── L'APERÇU (le même instantané que le PDF) ────────────────────────────────
const EXEMPLE = { acheteur: { nom: 'Nom de l’acheteur', adresse: 'Son adresse\n00000 Sa ville', email: 'acheteur@exemple.fr' }, designation: 'Nike Air Max 90 — taille 42', centimes: 12950, venteLe: new Date(Date.now() - 2 * 86400000).toISOString(), reference: '0000000000', plateforme: 'Vinted' };
export function ApercuFacture({ contenu, provisoire = false }) {
  if (!contenu) return null;
  const c = contenu; const T = c.totaux; const marge = c.regime === 'marge';
  return (
    <div className="vrm-fp-apercu" data-fp-apercu={c.numero} style={{ '--fp-accent': c.couleur }}>
      <div className="vrm-fp-a-tete">
        {c.logo ? <img src={c.logo} alt="" className="vrm-fp-a-logo"/> : <span/>}
        <div className="vrm-fp-a-titre">
          <b>{c.type === 'avoir' ? 'AVOIR' : 'FACTURE'}</b>
          <span className="vrm-fp-a-num">{provisoire ? 'N° donné à l’émission' : `N° ${c.numero}`}</span>
          <span>Émise le {c.emiseJour}</span>
          {c.origine ? <span>Annule la facture {c.origine}</span> : null}
        </div>
      </div>
      <div className="vrm-fp-a-parties">
        <div><small>Vendeur</small><b>{c.vendeur.nom}</b>{[...c.vendeur.adresse, ...c.vendeur.legal, c.vendeur.email, c.vendeur.telephone].filter(Boolean).map((l, i) => <span key={i}>{l}</span>)}</div>
        <div><small>Facturé à</small><b>{c.acheteur.nom}</b>{[...c.acheteur.adresse, c.acheteur.email].filter(Boolean).map((l, i) => <span key={i}>{l}</span>)}</div>
      </div>
      <p className="vrm-fp-a-infos">Date de la vente : {c.venteJour} · {c.nature}{c.reference ? ` · Référence : ${c.reference}` : ''}</p>
      <table className="vrm-fp-a-table"><thead><tr><th>Désignation</th><th>Qté</th><th>{marge ? 'Prix unitaire' : 'Prix unit. HT'}</th><th>{marge ? 'Total' : 'Total HT'}</th></tr></thead>
        <tbody>{c.lignes.map((l, i) => <tr key={i}><td>{l.designation}</td><td>{l.quantite}</td><td>{euros(l.unite)}</td><td>{euros(l.total)}</td></tr>)}</tbody></table>
      <dl className="vrm-fp-a-totaux">
        {c.regime === 'normal' ? <><div><dt>Total HT</dt><dd>{euros(T.ht)}</dd></div><div><dt>TVA {String(c.taux).replace('.', ',')} %</dt><dd>{euros(T.tva)}</dd></div><div className="is-fort"><dt>Total TTC</dt><dd>{euros(T.ttc)}</dd></div></>
          : c.regime === 'franchise' ? <><div><dt>Total HT</dt><dd>{euros(T.ht)}</dd></div><div><dt>TVA</dt><dd>non applicable</dd></div><div className="is-fort"><dt>{c.type === 'avoir' ? 'Montant à rembourser' : 'Net à payer'}</dt><dd>{euros(T.ttc)}</dd></div></>
          : <div className="is-fort"><dt>{c.type === 'avoir' ? 'Montant à rembourser' : 'Total à payer'}</dt><dd>{euros(T.ttc)}</dd></div>}
      </dl>
      <p className="vrm-fp-a-paye">{c.paiement}</p>
      {c.mentions.map((m) => <p key={m} className="vrm-fp-a-mention">{m}</p>)}
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

// ── Appeler la route du serveur ─────────────────────────────────────────────
async function route(deps, corps) {
  try {
    const r = await fetch('/api/compte?mode=facture-pro', corps ? { method: 'POST', headers: { 'Content-Type': 'application/json', ...deps.enTeteSession() }, body: JSON.stringify(corps) } : { headers: deps.enTeteSession() });
    const j = await r.json().catch(() => null);
    return { code: r.status, j: j || {} };
  } catch (_) { return { code: 0, j: { message: "Pas de réseau : rien n'a été fait." } }; }
}

// Une feuille plein écran au téléphone, centrée sur ordinateur.
function Feuille({ titre, fermer, children, deps, large = false, data }) {
  const boite = React.useRef(null);
  const fr = React.useRef(fermer); fr.current = fermer;
  React.useEffect(() => {
    const avant = document.activeElement;
    try { boite.current && boite.current.focus({ preventScroll: true }); } catch (_) {}
    const k = (e) => { if (e.key === 'Escape' && !document.querySelector('[data-visionneuse-pdf]')) { e.preventDefault(); e.stopPropagation(); fr.current(); } };
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('keydown', k); try { avant && avant.focus && avant.focus({ preventScroll: true }); } catch (_) {} };
  }, []);
  const Retour = deps.FermeAuRetour;
  return createPortal(
    <div className="vrm-fp-voile" data-noswipe="1" onClick={fermer}>
      {Retour ? <Retour fermer={fermer}/> : null}
      <div ref={boite} className={`vrm-fp-feuille${large ? ' is-large' : ''}`} role="dialog" aria-modal="true" aria-label={titre} tabIndex={-1} onClick={(e) => e.stopPropagation()} {...(data || {})}>
        <div className="vrm-fp-feuille-tete">
          <button type="button" className="vrm-fp-retour" onClick={fermer} aria-label="Fermer">‹</button>
          <h2>{titre}</h2>
        </div>
        <div className="vrm-fp-feuille-corps">{children}</div>
      </div>
    </div>, document.body);
}

// ════════════════════════════════════════════════════════════════════════════
//  LA FICHE : ton entreprise, ta facture, ton envoi
// ════════════════════════════════════════════════════════════════════════════
export function FicheFacturation({ deps, focus = null, surPrete = null }) {
  const lu = useFicheFacturation(deps);
  const [cfg, setCfg] = React.useState(null);
  const [statut, setStatut] = React.useState('');
  const minuteur = React.useRef(null);
  React.useEffect(() => { if (lu && !cfg) setCfg(lu); }, [lu, cfg]);
  const [registre, setRegistre] = React.useState(null);
  const champsRef = React.useRef({});

  // Écrire : on RELIT la ligne juste avant (une autre carte — « Ton entreprise »
  // de Comptabilité — écrit la même), on fusionne nos champs, on écrit ; une
  // lecture ratée n'écrit RIEN.
  const ecrire = (next, champs) => {
    setCfg(next); setStatut('enregistrement…');
    if (minuteur.current) clearTimeout(minuteur.current);
    const a = { ...(champsRef.current || {}) }; for (const k of champs) a[k] = true; champsRef.current = a;
    minuteur.current = setTimeout(async () => {
      const aEcrire = Object.keys(champsRef.current); champsRef.current = {};
      const frais = await deps.lireReglage(ID_CFG);
      if (frais === null) { setStatut("⚠ pas enregistré — la base n'a pas répondu, réessaie"); return; }
      const fusion = { ...frais }; for (const k of aEcrire) fusion[k] = next[k];
      const ok = await deps.ecrireReglage(ID_CFG, fusion);
      if (ok) { poserCfg({ ...VIDE, ...migrerAncienne(fusion) }); setStatut('✓ enregistré'); } else setStatut("⚠ pas enregistré — la base n'a pas répondu, réessaie");
    }, 600);
  };
  const upd = (k, v) => ecrire({ ...cfg, [k]: v }, [k]);
  const updPlusieurs = (o) => ecrire({ ...cfg, ...o }, Object.keys(o));

  // Le SIRET retrouve le nom et l'adresse au registre public (par le SIREN EXACT).
  const sir = verifierSiret(cfg && cfg.siret);
  const chiffres = String((cfg && cfg.siret) || '').replace(/\D/g, '');
  React.useEffect(() => {
    if (!cfg || sir.etat !== 'ok' || !deps.chercherEntreprise) { setRegistre(null); return undefined; }
    let mort = false; setRegistre({ etat: 'encours' });
    deps.chercherEntreprise(chiffres).then((j) => {
      if (mort) return; setRegistre(j);
      if (j && j.etat === 'trouve') {
        const pose = {};
        if (!String(cfg.nom || '').trim()) pose.nom = j.nom;
        if (!String(cfg.adresse || '').trim() && j.adresse) { pose.adresse = j.adresse.replace(new RegExp(`\\s*${j.codePostal || '#'}.*$`), '').trim() || j.adresse; if (j.codePostal) pose.codePostal = j.codePostal; if (j.ville) pose.ville = j.ville; }
        if (Object.keys(pose).length) updPlusieurs(pose);
      }
    });
    return () => { mort = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiffres, !!cfg]);

  React.useEffect(() => { if (focus && cfg) { const el = document.querySelector(`[data-fp-champ="${focus}"] input, [data-fp-champ="${focus}"] select, [data-fp-champ="${focus}"] button`); if (el) { try { el.focus({ preventScroll: false }); el.scrollIntoView({ block: 'center' }); } catch (_) {} } } }, [focus, !!cfg]);

  if (lu === undefined || (lu && !cfg)) return <div className="vrm-fp-carte" data-fp-fiche="charge">Lecture de ta fiche…</div>;
  if (lu === null) return <div className="vrm-fp-carte" data-fp-fiche="passu"><b>Facturation Pro</b><p className="vrm-fp-muet">Ta fiche n'a pas pu être lue (la base n'a pas répondu). Rien n'est perdu et rien ne sera écrit par-dessus : rouvre cet écran dans un moment.</p></div>;

  const manque = manquantsVendeur(cfg);
  const champManque = new Set(manque.map((m) => m.champ));
  let apercu = null;
  try { apercu = manque.length ? null : contenuFacture(cfg, EXEMPLE, { numero: `${cfg.prefixe || 'FA'}-${new Date().getFullYear()}-0001`, emiseLe: Date.now() }); } catch (_) { apercu = null; }
  const societe = estSociete(cfg.forme);
  const champ = ({ k, label, aide, type = 'text', placeholder, mode, auto, large: lg = false, majuscules = false }) => (
    <label key={k} className={`vrm-fp-champ${lg ? ' is-large' : ''}`} data-fp-champ={k} data-fp-manque={champManque.has(k) ? '1' : undefined}>
      <span>{label}</span>
      <input type={type} value={cfg[k] || ''} placeholder={placeholder} inputMode={mode} autoComplete={auto || 'off'} onChange={(e) => upd(k, majuscules ? e.target.value.toUpperCase() : e.target.value)}/>
      {aide ? <small>{aide}</small> : null}
    </label>
  );
  return (
    <div className="vrm-fp-fiche" data-fp-fiche={manque.length ? 'incomplete' : 'prete'}>
      <div className={`vrm-fp-etat${manque.length ? ' is-manque' : ''}`} data-fp-etat={manque.length ? manque.length : 0} role="status">
        {manque.length
          ? <><b>{manque.length === 1 ? 'Il manque une information' : `Il manque ${manque.length} informations`} pour faire une facture conforme</b><span>{manque.map((m) => m.l).join(' · ')}</span></>
          : <><b>Ta fiche est complète</b><span>Chaque vente d'un compte Pro peut recevoir sa facture.</span></>}
      </div>

      <section className="vrm-fp-section">
        <h3>Ton entreprise</h3>
        {champ({ k: "siret", label: "SIRET", mode: "numeric", placeholder: "14 chiffres", aide: sir.etat === 'invalide' ? `Ce numéro ne semble pas valide : ${sir.raison}.` : registre && registre.etat === 'trouve' ? `Trouvé au registre : ${registre.nom}${registre.ferme ? ' — ⚠ entreprise fermée' : ''}` : registre && registre.etat === 'inconnu' ? 'Ce numéro n’est pas au registre public des entreprises.' : 'Sur ton avis de situation INSEE. Le nom et l’adresse se remplissent seuls.' })}
        <div className="vrm-fp-champ" data-fp-champ="forme" data-fp-manque={champManque.has('forme') ? '1' : undefined}>
          <span>Forme de l'entreprise</span>
          <select value={cfg.forme || ''} onChange={(e) => upd('forme', e.target.value)} aria-label="Forme de l'entreprise">
            <option value="">Choisir…</option>
            {FORMES.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
          </select>
        </div>
        {champ({ k: "nom", label: cfg.forme === 'EI' || !cfg.forme ? 'Nom et prénom (ou nom commercial)' : 'Raison sociale', auto: "organization", aide: cfg.forme === 'EI' ? '« EI » est ajouté après ton nom sur la facture (obligatoire).' : null })}
        {champ({ k: "adresse", label: "Adresse", auto: "street-address", large: true })}
        <div className="vrm-fp-rangee">
          {champ({ k: "codePostal", label: "Code postal", mode: "numeric", auto: "postal-code" })}
          {champ({ k: "ville", label: "Ville", auto: "address-level2" })}
        </div>
        {societe ? <div className="vrm-fp-rangee">
          {champ({ k: "rcs", label: "Immatriculation", placeholder: "RCS Rennes" })}
          {champ({ k: "capital", label: "Capital social (€)", mode: "decimal", placeholder: "1 000" })}
        </div> : champ({ k: "rcs", label: "Immatriculation (facultatif)", placeholder: "RCS Rennes", aide: "Si tu es inscrit au registre du commerce." })}
        {champ({ k: "email", label: "E-mail sur la facture", type: "email", auto: "email", mode: "email", large: true })}
        {champ({ k: "telephone", label: "Téléphone (facultatif)", type: "tel", auto: "tel", mode: "tel" })}
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
        {!cfg.tva_regime ? <p className="vrm-fp-muet">VRM ne choisit pas à ta place : demande à ton comptable si tu as un doute. Micro-entreprise sous le seuil de TVA ⇒ en général « Franchise ».</p> : null}
        {cfg.tva_regime === 'normal' ? <div className="vrm-fp-champ" data-fp-champ="tva_taux" data-fp-manque={champManque.has('tva_taux') ? '1' : undefined}>
          <span>Taux de TVA</span>
          <select value={cfg.tva_taux || ''} onChange={(e) => upd('tva_taux', Number(e.target.value))} aria-label="Taux de TVA">
            <option value="">Choisir…</option>{TAUX_TVA.map((t) => <option key={t} value={t}>{String(t).replace('.', ',')} %</option>)}
          </select></div> : null}
        {cfg.tva_regime === 'normal' || cfg.tva_regime === 'marge' ? champ({ k: "tva", label: "N° de TVA intracommunautaire", placeholder: "FR12345678901", majuscules: true }) : null}
      </section>

      <section className="vrm-fp-section">
        <h3>Ta facture</h3>
        <div className="vrm-fp-logo" data-fp-champ="logo">
          {cfg.logo ? <img src={cfg.logo} alt="Ton logo"/> : <span className="vrm-fp-logo-vide">Pas de logo</span>}
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
        {champ({ k: "prefixe", label: "Début des numéros", majuscules: true, aide: `Tes factures seront numérotées ${(cfg.prefixe || 'FA')}-${new Date().getFullYear()}-0001, 0002… sans trou. Ne le change plus une fois tes premières factures émises.` })}
        <label className="vrm-fp-champ is-large" data-fp-champ="note"><span>Texte en bas de la facture (facultatif)</span>
          <textarea rows={2} value={cfg.note || ''} placeholder="Merci pour ton achat !" onChange={(e) => upd('note', e.target.value)}/></label>
        <label className="vrm-fp-champ is-large" data-fp-champ="message"><span>Message de l'e-mail à l'acheteur</span>
          <textarea rows={5} value={cfg.message || ''} placeholder={MESSAGE_DEFAUT} onChange={(e) => upd('message', e.target.value)}/>
          <small>{'{acheteur}, {numero}, {article} et {boutique} sont remplacés. Vide = le texte proposé.'}</small></label>
      </section>

      <section className="vrm-fp-section">
        <h3>Aperçu</h3>
        {apercu ? <>
          <ApercuFacture contenu={apercu}/>
          <button type="button" className="vrm-b vrm-b-secondaire" data-fp-exemple-pdf="" onClick={() => ouvrirPdf(apercu, deps)}>Voir l'exemple en PDF</button>
        </> : <p className="vrm-fp-muet">L'aperçu s'affiche dès que ta fiche est complète.</p>}
      </section>

      <BoiteEnvoi deps={deps} cfg={cfg} upd={upd}/>
      {statut ? <p className="vrm-fp-statut" role="status">{statut}</p> : null}
      {surPrete && !manque.length ? <button type="button" className="vrm-b vrm-b-primaire vrm-b-plein" onClick={surPrete}>Revenir à la facture</button> : null}
    </div>
  );
}

// ── La boîte d'envoi ────────────────────────────────────────────────────────
const AIDE_MDP = {
  gmail: 'Gmail : active la validation en deux étapes, puis crée un « mot de passe d’application » sur myaccount.google.com/apppasswords (16 lettres).',
  icloud: 'iCloud : sur account.apple.com → Connexion et sécurité → Mots de passe pour app.',
  yahoo: 'Yahoo : Sécurité du compte → Générer un mot de passe d’application.',
};
export function BoiteEnvoi({ deps, cfg, upd }) {
  const [e, setE] = React.useState(undefined);
  const [form, setForm] = React.useState({ adresse: '', motDePasse: '', fournisseur: '', hote: '', port: '465' });
  const [occupe, setOccupe] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const charger = React.useCallback(async () => { const r = await route(deps); setE(r.code === 200 ? r.j : null); }, [deps]);
  React.useEffect(() => { charger(); }, [charger]);
  const domaine = (form.adresse.split('@')[1] || '').toLowerCase();
  const deduit = e && e.fournisseurs ? ({ 'gmail.com': 'gmail', 'googlemail.com': 'gmail', 'icloud.com': 'icloud', 'me.com': 'icloud', 'mac.com': 'icloud', 'orange.fr': 'orange', 'wanadoo.fr': 'orange', 'free.fr': 'free', 'sfr.fr': 'sfr', 'laposte.net': 'laposte', 'yahoo.fr': 'yahoo', 'yahoo.com': 'yahoo' })[domaine] || '' : '';
  const fourEff = form.fournisseur || deduit;
  const connecter = async () => {
    setOccupe('poser'); setMsg('');
    const r = await route(deps, { action: 'boite-poser', adresse: form.adresse, motDePasse: form.motDePasse, fournisseur: fourEff || undefined, hote: fourEff ? undefined : form.hote, port: fourEff ? undefined : Number(form.port) });
    setOccupe('');
    if (r.code === 200) { setForm({ ...form, motDePasse: '' }); setE((x) => ({ ...(x || {}), boite: r.j.boite })); setMsg('Boîte connectée. Envoie-toi un essai pour vérifier.'); }
    else setMsg(r.j.message || "La connexion a échoué. Rien n'a été rangé.");
  };
  const essai = async () => { setOccupe('essai'); setMsg(''); const r = await route(deps, { action: 'boite-essai' }); setOccupe(''); setMsg(r.j.issue === 'envoye' ? `Essai envoyé à ${r.j.a}. Regarde ta boîte de réception.` : (r.j.message || "L'essai n'est pas parti.")); if (r.j.issue === 'envoye') charger(); };
  const retirer = async () => { if (!(await deps.askConfirm({ title: 'Déconnecter ta boîte ?', desc: "VRM ne pourra plus envoyer tes factures. Tes factures déjà émises ne changent pas.", ok: 'Déconnecter', danger: true }))) return; setOccupe('retirer'); const r = await route(deps, { action: 'boite-retirer', confirme: true }); setOccupe(''); if (r.code === 200) setE((x) => ({ ...(x || {}), boite: { etat: 'aucune' } })); else setMsg(r.j.message || 'Réessaie.'); };
  const b = e && e.boite;
  return (
    <section className="vrm-fp-section" data-fp-champ="boite" data-fp-boite={e === undefined ? 'charge' : e === null ? 'passu' : b.etat}>
      <h3>Envoi à l'acheteur</h3>
      {e === undefined ? <p className="vrm-fp-muet">Lecture…</p>
        : e === null ? <p className="vrm-fp-muet">L'état de ta boîte d'envoi n'a pas pu être lu. Rouvre cet écran dans un moment.</p>
        : b.etat === 'posee' ? <>
          <p className="vrm-fp-boite-ok"><b>Les factures partent de {b.adresse}</b><span>L'acheteur voit ton adresse et peut te répondre.{b.essaiLe ? ` Dernier essai réussi le ${jourParis(b.essaiLe)}.` : ''}</span></p>
          <label className="vrm-fp-case"><input type="checkbox" checked={cfg.copie !== false} onChange={(ev) => upd('copie', ev.target.checked)}/> <span>M'envoyer une copie de chaque facture</span></label>
          <div className="vrm-fp-gestes">
            <button type="button" className="vrm-b vrm-b-secondaire" disabled={!!occupe} onClick={essai} data-fp-essai="">{occupe === 'essai' ? 'Envoi…' : "M'envoyer un essai"}</button>
            <button type="button" className="vrm-b vrm-b-discret" disabled={!!occupe} onClick={retirer}>Déconnecter</button>
          </div>
        </> : <>
          <p className="vrm-fp-muet">Les factures partent de TA boîte e-mail : l'acheteur reçoit un message de toi, avec la facture en PDF. VRM garde ton mot de passe d'application chiffré et ne te le montre plus jamais.</p>
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
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  SUR UNE VENTE : « Envoyer la facture à l'acheteur »
// ════════════════════════════════════════════════════════════════════════════
// Les ventes Pro (e-mails de vente Vinted Pro) et les factures, lues UNE fois
// pour tout l'écran, en scalaires (§4.4 : jamais le formulaire de retour, jamais
// l'instantané entier dans une liste).
let _donnees; const _ecoutesDonnees = new Set(); let _enCours = null;
export function relireFactures(deps) {
  if (_enCours) return _enCours;
  _enCours = (async () => {
    const [ventes, profils, factures] = await Promise.all([
      deps.lireTout('id=like.email_sale_*&data->>pro=eq.true&select=transaction:data->>transaction,nom:data->>nomComplet,adresse:data->>adresse,email:data->>email,account:data->>account,designation:data->>designation,prix:data->>prix', { strict: true }),
      deps.lireTout('id=like.harvest_*_profile&select=id,uid:data->>uid,business:data->payload->user->business,business_account_id:data->payload->user->business_account_id,business_account:data->payload->user->business_account'),
      deps.lireTout('id=like.email_invoice_*&select=id,numero:data->>number,status:data->>status,transaction:data->>transaction,emiseLe:data->>emiseLe,envoi:data->envoi,retour:data->>retourNom,annuleePar:data->>annuleePar,type:data->>type,acheteur:data->contenu->acheteur->>nom,ttc:data->contenu->totaux->>ttc', { strict: true }),
    ]);
    const v = Array.isArray(ventes) && Array.isArray(factures) ? {
      ventesPro: new Map(ventes.filter((x) => x && x.transaction).map((x) => [String(x.transaction), x])),
      factures: new Map(factures.filter((x) => x && x.transaction && /^email_invoice_tx/.test(x.id)).map((x) => [String(x.transaction), x])),
      // Le profil Vinted du compte : professionnel ? (la MÊME règle que l'app,
      // `typeCompteVinted`) — true · false · absent (pas su).
      comptesPro: new Map((Array.isArray(profils) ? profils : []).map((r) => {
        const uid = String(r.uid || ((r.id || '').match(/^harvest_(\d+)_profile$/) || [])[1] || '');
        return [uid, deps.typeCompteVinted({ user: { business: r.business, business_account_id: r.business_account_id, business_account: r.business_account } })];
      }).filter(([u, t]) => u && typeof t === 'boolean')),
      avoirs: new Map(factures.filter((x) => x && x.transaction && /^email_invoice_av/.test(x.id)).map((x) => [String(x.transaction), x])),
    } : null;
    _donnees = v; _enCours = null;
    _ecoutesDonnees.forEach((f) => { try { f(v); } catch (_) {} });
    return v;
  })();
  return _enCours;
}
function useFactures(deps) {
  const [d, setD] = React.useState(_donnees);
  React.useEffect(() => { _ecoutesDonnees.add(setD); if (_donnees === undefined) relireFactures(deps); return () => { _ecoutesDonnees.delete(setD); }; }, [deps]);
  return d;
}
async function lireContenu(deps, id) {
  const r = await deps.lireTout(`id=eq.${encodeURIComponent(id)}&select=contenu:data->contenu`, { strict: true });
  return Array.isArray(r) && r[0] && r[0].contenu ? r[0].contenu : null;
}

// `vente` = { tx, uid, compte, titre, centimes, venteLe }.
export function FactureVente({ vente, deps }) {
  const d = useFactures(deps);
  const [ouverte, setOuverte] = React.useState(false);
  if (!vente || !vente.tx) return null;
  const tx = String(vente.tx);
  const proMail = d ? d.ventesPro.get(tx) : null;
  const f = d ? d.factures.get(tx) : null;
  const av = d ? d.avoirs.get(tx) : null;
  // Une vente Pro se PROUVE : l'e-mail Vinted Pro de CETTE transaction, ou le
  // profil du compte lu « professionnel ». « Pas su » ne montre rien.
  const proCompte = d && vente.uid != null ? d.comptesPro.get(String(vente.uid)) : undefined;
  const pro = !!proMail || proCompte === true || !!(f && (f.numero || f.emiseLe));
  if (!pro) return null;
  const emise = !!(f && f.emiseLe);
  const e = f && f.envoi;
  let ligne;
  if (!emise) ligne = <button type="button" className="vrm-b vrm-b-secondaire vrm-b-plein" data-fp-vente="a-faire" onClick={() => setOuverte(true)}>Envoyer la facture à l'acheteur</button>;
  else ligne = (
    <button type="button" className="vrm-fp-vente-ligne" data-fp-vente={e ? e.etat : 'emise'} onClick={() => setOuverte(true)}>
      <b>Facture {f.numero}</b>
      <span>{av && av.emiseLe ? `annulée par l'avoir ${av.numero}` : !e ? 'émise, pas encore envoyée' : e.etat === 'envoyee' ? `envoyée le ${jourParis(e.at)} à ${e.a}` : e.etat === 'en-cours' ? 'envoi en cours…' : e.etat === 'incertaine' ? "envoi incertain — à vérifier" : "pas partie — touche pour voir pourquoi"}</span>
    </button>
  );
  return <div className="vrm-fp-vente" data-fp-tx={tx}>
    {d === null ? <p className="vrm-fp-muet">Les factures n'ont pas pu être lues — réessaie dans un instant.</p> : ligne}
    {ouverte ? <FeuilleFactureVente vente={vente} proMail={proMail} facture={f} avoir={av} deps={deps} fermer={() => setOuverte(false)}/> : null}
  </div>;
}

function FeuilleFactureVente({ vente, proMail, facture, avoir, deps, fermer }) {
  const cfg = useFicheFacturation(deps);
  const tx = String(vente.tx);
  const [fiche, setFiche] = React.useState(false);
  const [boite, setBoite] = React.useState(undefined);
  React.useEffect(() => { route(deps).then((r) => setBoite(r.code === 200 ? r.j.boite : null)); }, [deps, fiche]);
  // L'acheteur : l'e-mail Vinted Pro de CETTE transaction, sinon à saisir.
  const adresseProMail = proMail && proMail.adresse ? adresseVintedLisible(proMail.adresse) : '';
  const [form, setForm] = React.useState(() => ({
    nom: (proMail && proMail.nom) || '', adresse: adresseProMail, email: (proMail && proMail.email) || '',
    designation: (proMail && proMail.designation) || vente.titre || '', prix: vente.centimes ? (vente.centimes / 100).toFixed(2).replace('.', ',') : (proMail && proMail.prix ? String(proMail.prix).replace('.', ',') : ''),
  }));
  const [occupe, setOccupe] = React.useState('');
  const [retour, setRetour] = React.useState(null);
  const [emiseIci, setEmiseIci] = React.useState(null);
  const [envoiIci, setEnvoiIci] = React.useState(null);
  const centimes = Math.round(Number(String(form.prix).replace(/\s/g, '').replace(',', '.')) * 100);
  const donnees = { acheteur: { nom: form.nom, adresse: form.adresse, email: form.email }, designation: form.designation, centimes, venteLe: vente.venteLe, reference: tx, plateforme: 'Vinted' };
  const emise = !!(facture && facture.emiseLe) || !!emiseIci;
  const numero = (emiseIci && emiseIci.numero) || (facture && facture.numero) || '';

  if (fiche) return <Feuille titre="Facturation Pro" fermer={() => setFiche(false)} deps={deps} large data={{ 'data-fp-feuille-fiche': '' }}><FicheFacturation deps={deps} focus={typeof fiche === 'string' ? fiche : null} surPrete={() => setFiche(false)}/></Feuille>;

  const mv = cfg ? manquantsVendeur(cfg) : [];
  const mvt = manquantsVente(donnees, { pourEnvoi: !!(boite && boite.etat === 'posee') });
  let apercu = null;
  if (cfg && !mv.length && !manquantsVente(donnees).length) { try { apercu = contenuFacture(cfg, donnees, { numero: numero || '…', emiseLe: Date.now() }); } catch (_) {} }

  const emettre = async (envoyer) => {
    if (!(await deps.askConfirm({ title: envoyer ? 'Émettre et envoyer la facture ?' : 'Émettre la facture ?', desc: `${envoyer ? `Elle part à ${form.email}. ` : ''}Une facture émise reçoit son numéro définitif et ne se modifie plus (pour la corriger, il faudra un avoir).`, ok: envoyer ? 'Émettre et envoyer' : 'Émettre' }))) return;
    setOccupe('emettre'); setRetour(null);
    const r = await route(deps, { action: 'emettre', confirme: true, tx, compte: vente.compte || '', acheteur: donnees.acheteur, designation: donnees.designation, centimes, venteLe: vente.venteLe });
    if (r.code !== 200) { setOccupe(''); setRetour({ ko: true, t: r.j.manquants ? `Il manque : ${r.j.manquants.map((m) => m.l).join(', ')}.` : (r.j.message || "La facture n'a pas pu être émise. Réessaie : elle gardera le même numéro.") }); return; }
    setEmiseIci(r.j.facture);
    if (envoyer) { await envoyerFacture(false, r.j.facture); } else { setOccupe(''); setRetour({ t: `Facture ${r.j.facture.numero} émise.` }); }
    relireFactures(deps);
  };
  const envoyerFacture = async (renvoyer, fEmise) => {
    if (renvoyer && !(await deps.askConfirm({ title: 'Renvoyer la facture ?', desc: `La même facture (${numero}) repart à l'acheteur.`, ok: 'Renvoyer' }))) return;
    setOccupe('envoyer'); setRetour(null);
    const r = await route(deps, { action: 'envoyer', confirme: true, tx, renvoyer: !!renvoyer });
    setOccupe('');
    if (r.j.envoi) setEnvoiIci(r.j.envoi);
    if (r.j.issue === 'envoye') setRetour(null);
    else if (r.j.issue === 'incertain') setRetour({ ko: true, t: `On ne sait pas si elle est partie : ${r.j.envoi.message} Regarde dans tes messages envoyés avant de la renvoyer.` });
    else setRetour({ ko: true, t: (r.j.envoi && r.j.envoi.message) || r.j.message || "Elle n'est pas partie." });
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
  const boiteOk = boite && boite.etat === 'posee';
  return (
    <Feuille titre={emise ? `Facture ${numero}` : "Facture à l'acheteur"} fermer={fermer} deps={deps} large data={{ 'data-fp-feuille-vente': tx }}>
      {cfg === undefined ? <p className="vrm-fp-muet">Lecture de ta fiche…</p>
        : cfg === null ? <p className="vrm-fp-muet">Ta fiche n'a pas pu être lue — réessaie dans un instant.</p>
        : emise ? <>
          <div className="vrm-fp-etat" data-fp-envoi={(envoi && envoi.etat) || 'aucun'}>
            <b>{avoir && avoir.emiseLe ? `Annulée par l'avoir ${avoir.numero}` : envoi && envoi.etat === 'envoyee' ? `Envoyée le ${jourParis(envoi.at)}` : envoi && envoi.etat === 'incertaine' ? 'Envoi incertain' : envoi && envoi.etat === 'refusee' ? 'Pas partie' : 'Émise, pas encore envoyée'}</b>
            <span>{envoi && envoi.etat === 'envoyee' ? `à ${envoi.a}${envoi.retour ? ', avec le formulaire de retour de Vinted' : ''}.` : envoi && envoi.message ? envoi.message : 'Une facture émise ne se modifie plus.'}</span>
          </div>
          <div className="vrm-fp-gestes">
            <button type="button" className="vrm-b vrm-b-secondaire" disabled={!!occupe} onClick={() => voirPdf(false)} data-fp-pdf="">Voir le PDF</button>
            <button type="button" className="vrm-b vrm-b-secondaire" disabled={!!occupe} onClick={() => voirPdf(true)}>Partager</button>
            {boiteOk && !(avoir && avoir.emiseLe) ? <button type="button" className="vrm-b vrm-b-primaire" disabled={!!occupe} data-fp-envoyer="" onClick={() => envoyerFacture(!!(envoi && (envoi.etat === 'envoyee' || envoi.etat === 'incertaine')))}>{occupe === 'envoyer' ? 'Envoi…' : envoi && (envoi.etat === 'envoyee' || envoi.etat === 'incertaine') ? 'Renvoyer' : "Envoyer à l'acheteur"}</button> : null}
          </div>
          {!boiteOk && boite !== undefined ? <p className="vrm-fp-muet">Pour l'envoyer d'ici, <button type="button" className="vrm-lien-action" onClick={() => setFiche('boite')}>connecte ta boîte e-mail</button> — ou partage le PDF toi-même.</p> : null}
          {avoir && avoir.emiseLe ? <button type="button" className="vrm-b vrm-b-discret" onClick={() => voirPdf(false, 'avoir')}>Voir l'avoir {avoir.numero}</button>
            : <details className="vrm-fp-plus"><summary>Vente annulée ou remboursée ?</summary><p className="vrm-fp-muet">Une facture ne se supprime pas : elle s'annule par un avoir.</p><button type="button" className="vrm-b vrm-b-discret" disabled={!!occupe} onClick={faireAvoir} data-fp-avoir="">Annuler par un avoir</button></details>}
        </> : <>
          {mv.length ? <div className="vrm-fp-etat is-manque" data-fp-etat={mv.length}><b>Ta fiche entreprise n'est pas complète</b><span>Il manque {mv.map((m) => m.l).join(', ')}.</span>
            <button type="button" className="vrm-b vrm-b-primaire" onClick={() => setFiche(mv[0].champ)} data-fp-completer="">Compléter ma fiche</button></div> : null}
          <section className="vrm-fp-section">
            <h3>L'acheteur</h3>
            {proMail ? <p className="vrm-fp-muet">Repris de l'e-mail de vente Vinted Pro de cette commande.</p> : <p className="vrm-fp-muet">L'e-mail de vente Vinted Pro de cette commande n'est pas arrivé dans VRM : recopie les coordonnées depuis la commande sur Vinted.</p>}
            <label className="vrm-fp-champ"><span>Nom</span><input value={form.nom} autoComplete="off" onChange={(e) => setForm({ ...form, nom: e.target.value })}/></label>
            <label className="vrm-fp-champ is-large"><span>Adresse</span><textarea rows={3} value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })}/></label>
            <label className="vrm-fp-champ"><span>E-mail</span><input type="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.trim() })}/>{form.email && !emailValide(form.email) ? <small>Cette adresse ne semble pas valide.</small> : null}</label>
          </section>
          <section className="vrm-fp-section">
            <h3>L'article</h3>
            <label className="vrm-fp-champ is-large"><span>Désignation</span><input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}/></label>
            <label className="vrm-fp-champ"><span>Prix payé (€)</span><input inputMode="decimal" value={form.prix} onChange={(e) => setForm({ ...form, prix: e.target.value })}/><small>Le prix de l'article, sans les frais de port ni la protection acheteur (payés à Vinted).</small></label>
          </section>
          {apercu ? <section className="vrm-fp-section"><h3>Aperçu</h3><ApercuFacture contenu={apercu} provisoire/></section> : null}
          {!mv.length && mvt.length ? <p className="vrm-fp-muet" data-fp-manque-vente="">Il manque {mvt.map((m) => m.l).join(', ')}.</p> : null}
          <div className="vrm-fp-gestes is-bas">
            {boiteOk ? <button type="button" className="vrm-b vrm-b-primaire vrm-b-plein" data-fp-emettre-envoyer="" disabled={!!occupe || !!mv.length || !!mvt.length} onClick={() => emettre(true)}>{occupe ? 'Un instant…' : "Émettre et envoyer à l'acheteur"}</button> : null}
            <button type="button" className={`vrm-b ${boiteOk ? 'vrm-b-secondaire' : 'vrm-b-primaire'} vrm-b-plein`} data-fp-emettre="" disabled={!!occupe || !!mv.length || !!manquantsVente(donnees).length} onClick={() => emettre(false)}>{boiteOk ? 'Émettre sans envoyer' : 'Émettre la facture'}</button>
            {!boiteOk && boite !== undefined ? <p className="vrm-fp-muet">Pour que VRM l'envoie lui-même, <button type="button" className="vrm-lien-action" onClick={() => setFiche('boite')}>connecte ta boîte e-mail</button>. Sinon, tu pourras partager le PDF.</p> : null}
          </div>
        </>}
      {retour ? <p className={`vrm-fp-retour-msg${retour.ko ? ' is-ko' : ''}`} role="status" data-fp-retour={retour.ko ? 'ko' : 'ok'}>{retour.t}</p> : null}
    </Feuille>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  LA LISTE DES FACTURES ÉMISES (Comptabilité → Factures)
// ════════════════════════════════════════════════════════════════════════════
export function ListeFacturesPro({ deps }) {
  const d = useFactures(deps);
  const [occupe, setOccupe] = React.useState('');
  if (d === undefined) return null;
  if (d === null) return <p className="vrm-fp-muet">Tes factures Pro n'ont pas pu être lues — réessaie dans un instant.</p>;
  const lignes = [...d.factures.values(), ...d.avoirs.values()].filter((x) => x.emiseLe)
    .sort((a, b) => String(b.numero).localeCompare(String(a.numero), 'fr', { numeric: true }));
  const attente = [...d.ventesPro.keys()].filter((tx) => !(d.factures.get(tx) && d.factures.get(tx).emiseLe)).length;
  const ouvrir = async (x) => {
    setOccupe(x.id);
    const c = await lireContenu(deps, x.id); setOccupe('');
    if (!c) { deps.toast("Le PDF n'a pas pu être lu — réessaie."); return; }
    ouvrirPdf(c, deps);
  };
  return (
    <section className="vrm-fp-section" data-fp-liste={lignes.length}>
      <h3>Factures Pro émises</h3>
      {attente ? <p className="vrm-fp-muet" data-fp-attente={attente}>{attente === 1 ? '1 vente Pro attend sa facture' : `${attente} ventes Pro attendent leur facture`} : ouvre la vente dans Ventes et touche « Envoyer la facture à l'acheteur ».</p> : null}
      {!lignes.length ? <p className="vrm-fp-muet">Aucune facture émise pour l'instant.</p> : (
        <ul className="vrm-fp-liste">
          {lignes.map((x) => {
            const e = x.envoi; const av = /^email_invoice_av/.test(x.id);
            const etat = x.annuleePar ? `annulée (${x.annuleePar})` : !e ? 'pas envoyée' : e.etat === 'envoyee' ? `envoyée le ${jourParis(e.at)}` : e.etat === 'incertaine' ? 'envoi incertain' : e.etat === 'en-cours' ? 'envoi en cours' : 'pas partie';
            return <li key={x.id}><button type="button" disabled={occupe === x.id} onClick={() => ouvrir(x)} data-fp-ligne={x.numero}>
              <b>{x.numero}</b><span>{av ? 'Avoir · ' : ''}{x.acheteur || '—'} · {jourParis(x.emiseLe)} · {etat}</span>
              <em>{x.ttc != null && x.ttc !== '' ? euros(Number(x.ttc)) : '—'}</em>
            </button></li>;
          })}
        </ul>
      )}
    </section>
  );
}

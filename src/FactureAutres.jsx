// ════════════════════════════════════════════════════════════════════════════
//  LA FACTURE PRO — LEBONCOIN, EBAY, VESTIAIRE (10 nov., lot S)
// ════════════════════════════════════════════════════════════════════════════
// Dans le détail d'une vente Leboncoin, eBay ou Vestiaire d'un vendeur PRO (sa
// fiche « Ma facture » porte un SIRET valide) ET d'un compte qu'il a dit
// professionnel (11 nov., src/facturePro/comptes.js ; jamais répondu ⇒ on demande) :
//   · facture déjà émise ⇒ « Facture FA-… » (PDF, partager) ;
//   · la vente ne peut pas être facturée ⇒ la raison, en mots (src/facturePro/sources.js) ;
//   · sinon « Faire la facture » : l'acheteur (que la plateforme ne donne pas) se
//     RECOPIE, le prix et la date sont ceux de la vente lue, l'aperçu exact, puis
//     « Émettre la facture » (confirmé) — numéro de la MÊME suite que Vinted.
// VRM n'envoie pas ces factures par e-mail (aucune adresse prouvée) : PDF.
// Le serveur (api/_lib/facture-autres.js) relit la vente lui-même et refait la règle.
import React from 'react';
import { SheetShell } from './composants/SheetShell.jsx';
import { ApercuFacture, useFicheFacturation, FicheFacturation, relireFactures, ecrireChampsFiche } from './FacturePro.jsx';
import { compteFacturable, avecCompte, compteDeVente } from './facturePro/comptes.js';
import { verifierSiret, manquantsVendeur, manquantsVente, contenuFacture, euros, jourParis, nomFichier } from './facturePro/regle.js';
import { PLATEFORMES, venteAutre, idFactureAutre, manquantsAcheteurSaisi, venteFacture, ID_FACTURE_AUTRE_RE } from './facturePro/sources.js';

// ── Les factures de ces plateformes, lues une fois pour tout l'écran ─────────
// Trois états : undefined en cours · null pas su · Map id → ligne projetée (§4.4).
let _f; let _enCours = null; const _ecoutes = new Set();
export function relireFacturesAutres(deps) {
  if (_enCours) return _enCours;
  _enCours = deps.lireTout('or=(id.like.email_invoice_lbc*,id.like.email_invoice_ebay*,id.like.email_invoice_vc*)&select=id,numero:data->>number,emiseLe:data->>emiseLe,plateforme:data->>plateforme,reference:data->>reference,acheteur:data->contenu->acheteur->>nom,ttc:data->contenu->totaux->>ttc', { strict: true })
    .catch(() => null)
    .then((r) => {
      _f = Array.isArray(r) ? new Map(r.filter((x) => x && ID_FACTURE_AUTRE_RE.test(String(x.id)) && x.emiseLe).map((x) => [String(x.id), x])) : null;
      _enCours = null; _ecoutes.forEach((s) => { try { s(_f); } catch (_) {} });
      return _f;
    });
  return _enCours;
}
function useFacturesAutres(deps) {
  const [f, setF] = React.useState(_f);
  React.useEffect(() => { _ecoutes.add(setF); if (_f === undefined || _f === null) relireFacturesAutres(deps); return () => { _ecoutes.delete(setF); }; }, [deps]);
  return f;
}
async function lireContenu(deps, id) {
  const r = await deps.lireTout(`id=eq.${encodeURIComponent(id)}&select=contenu:data->contenu`, { strict: true }).catch(() => null);
  return Array.isArray(r) && r[0] && r[0].contenu ? r[0].contenu : null;
}
async function ouvrirPdf(contenu, deps, partager = false) {
  const { pdfFacture } = await import('./facturePro/pdf.js');
  const nom = nomFichier(contenu);
  const blob = new Blob([await pdfFacture(contenu)], { type: 'application/pdf' });
  if (partager) {
    try { const f = new File([blob], nom, { type: 'application/pdf' }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: nom }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  if (deps.ouvrirPdfOnglet && deps.ouvrirPdfOnglet(url, nom, `Facture ${contenu.numero}`)) return;
  const a = document.createElement('a'); a.href = url; a.download = nom; a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function route(deps, corps) {
  try {
    const r = await fetch('/api/compte?mode=facture-autre', { method: 'POST', headers: { 'Content-Type': 'application/json', ...deps.enTeteSession() }, body: JSON.stringify(corps) });
    const j = await r.json().catch(() => null);
    return { code: r.status, j: j || {} };
  } catch (_) { return { code: 0, j: { message: "Pas de réseau : rien n'a été fait." } }; }
}
// Pro = sa fiche « Ma facture » porte un SIRET valide. `undefined` = pas su encore.
const estPro = (cfg) => (cfg === undefined ? undefined : !!(cfg && verifierSiret(cfg.siret).etat === 'ok'));

// `plateforme` : leboncoin · ebay · vestiaire ; `vente` : la vente BRUTE de la plateforme
// (ligne de `lbc_ventes`, commande eBay, vente Vestiaire avec son `id`).
export function FactureAutreVente({ plateforme, vente, deps }) {
  const cfg = useFicheFacturation(deps);
  const f = useFacturesAutres(deps);
  const [ouverte, setOuverte] = React.useState(false);
  const [occupe, setOccupe] = React.useState(false);
  if (!PLATEFORMES[plateforme] || !vente) return null;
  const v = venteAutre(plateforme, vente);
  const ref = plateforme === 'leboncoin' ? String(vente.txId || '') : plateforme === 'ebay' ? String(vente.orderId || '') : String(vente.id || vente.productId || '');
  const id = ref ? idFactureAutre(plateforme, ref) : '';
  const emise = f instanceof Map && id ? f.get(id) : null;
  const voir = async (partager) => { setOccupe(true); const c = await lireContenu(deps, id); setOccupe(false); if (!c) { deps.toast("Le PDF n'a pas pu être lu — réessaie dans un instant."); return; } await ouvrirPdf(c, deps, partager); };
  if (emise) {
    return <div className="vrm-fp-vente vrm-fa" data-fa-plateforme={plateforme} data-fa-ref={ref} data-fa-etat="emise">
      <button type="button" className="vrm-fp-vente-ligne" disabled={occupe} onClick={() => voir(false)} data-fa-pdf="">
        <b>Facture {emise.numero}</b><span>émise le {jourParis(emise.emiseLe)} · à joindre au colis ou à partager</span>
      </button>
      <button type="button" className="vrm-b vrm-b-secondaire" disabled={occupe} onClick={() => voir(true)}>Partager</button>
      {/* La feuille qui vient de l'émettre reste ouverte (« Facture … émise », PDF) jusqu'à SA fermeture. */}
      {ouverte && v.ok ? <FeuilleFactureAutre v={v} cfg={cfg} deps={deps} deja={emise} fermer={() => setOuverte(false)}/> : null}
    </div>;
  }
  if (estPro(cfg) !== true || f === undefined) return null;
  // (11 nov., lot DJ1) Seulement un compte PROFESSIONNEL : jamais répondu ⇒ on DEMANDE ; « non » ⇒ rien.
  const compte = compteDeVente(plateforme, vente);
  const cf = compteFacturable(cfg, plateforme, compte);
  if (cf === 'demander') return <QuestionCompte plateforme={plateforme} compte={compte} nom={plateforme === 'ebay' ? String(vente._pseudo || compte) : compte} deps={deps}/>;
  if (cf !== true) return null;
  if (f === null) return <p className="vrm-fp-muet" data-fa-etat="pas-su">Facture : tes factures n'ont pas pu être lues — réessaie dans un instant.</p>;
  if (!v.ok) return <p className="vrm-fp-muet vrm-fp-raison" data-fa-plateforme={plateforme} data-fa-ref={ref} data-fa-etat="refus" data-fa-code={v.code}>Facture : {v.raison}.</p>;
  return <div className="vrm-fp-vente vrm-fa" data-fa-plateforme={plateforme} data-fa-ref={ref} data-fa-etat="a-faire">
    <button type="button" className="vrm-b vrm-b-secondaire vrm-b-plein" data-fa-faire="" onClick={() => setOuverte(true)}>Faire la facture</button>
    {ouverte ? <FeuilleFactureAutre v={v} cfg={cfg} deps={deps} fermer={() => setOuverte(false)}/> : null}
  </div>;
}

// « Ce compte est-il professionnel ? » — sur la vente, une fois par compte. SON clic écrit
// `comptesFacture` dans sa fiche (relue juste avant ; lecture ratée ⇒ rien écrit).
function QuestionCompte({ plateforme, compte, nom, deps }) {
  const [occupe, setOccupe] = React.useState(false);
  const L = PLATEFORMES[plateforme].l;
  const repondre = async (oui) => {
    setOccupe(true);
    const ok = await ecrireChampsFiche(deps, (frais) => ({ comptesFacture: avecCompte(frais, plateforme, compte, oui) }));
    setOccupe(false);
    if (!ok) deps.toast("Pas enregistré : la base n'a pas répondu. Réessaie.");
  };
  return <div className="vrm-fp-vente vrm-fa vrm-fa-question" data-fa-plateforme={plateforme} data-fa-etat="demander" data-fa-compte={compte}>
    <p className="vrm-fp-muet" style={{ margin: 0 }}>Facture Pro : <span className="vrm-sensible" data-stream-type="compte">{nom || compte}</span> est-il ton compte {L} professionnel ?</p>
    <div className="vrm-fp-gestes">
      <button type="button" className="vrm-b vrm-b-secondaire" disabled={occupe} data-fa-compte-oui="" onClick={() => repondre(true)}>Oui, facturer</button>
      <button type="button" className="vrm-b vrm-b-discret" disabled={occupe} data-fa-compte-non="" onClick={() => repondre(false)}>Non</button>
    </div>
  </div>;
}

function FeuilleFactureAutre({ v, cfg, deps, fermer, deja = null }) {
  const p = v.acheteurPropose || {};
  const [nom, setNom] = React.useState(p.nom || '');
  const [adresse, setAdresse] = React.useState(p.adresse || '');
  const [designation, setDesignation] = React.useState(v.designation || '');
  const [fiche, setFiche] = React.useState(false);
  const [occupe, setOccupe] = React.useState(false);
  const [retour, setRetour] = React.useState(null);
  const [emise, setEmise] = React.useState(deja);
  // Le PDF : l'instantané rendu à l'émission, sinon relu (la liste ne porte que les scalaires).
  const pdf = async (partager) => { const c = (emise && emise.contenu) || await lireContenu(deps, idFactureAutre(v.plateforme, v.ref)); if (!c) { deps.toast("Le PDF n'a pas pu être lu — réessaie dans un instant."); return; } await ouvrirPdf(c, deps, partager); };
  const L = PLATEFORMES[v.plateforme].l;
  const acheteur = { nom, adresse };
  const ma = manquantsAcheteurSaisi(acheteur);
  const mv = cfg ? manquantsVendeur(cfg) : [];
  const vente = venteFacture(v, acheteur, designation);
  const mvt = manquantsVente(vente);
  let apercu = null;
  if (cfg && !mv.length && !mvt.length) { try { apercu = contenuFacture(cfg, vente, { numero: '…', emiseLe: Date.now() }); } catch (_) {} }
  const emettre = async () => {
    if (!(await deps.askConfirm({ title: 'Émettre la facture ?', desc: 'Elle reçoit son numéro définitif et ne se modifie plus.', ok: 'Émettre' }))) return;
    setOccupe(true); setRetour(null);
    const r = await route(deps, { action: 'emettre', confirme: true, plateforme: v.plateforme, ref: v.ref, acheteur, designation });
    setOccupe(false);
    if (r.code !== 200) { setRetour(r.j.manquants ? `Il manque ${r.j.manquants.map((m) => m.l).join(', ')}.` : (r.j.message || "La facture n'a pas pu être émise. Réessaie : elle gardera le même numéro.")); return; }
    // Le registre d'Argent → Factures (lot Q) lit toutes les pièces `email_invoice_*` : il la montre aussi.
    setEmise(r.j.facture); relireFacturesAutres(deps); try { relireFactures(deps); } catch (_) {}
  };
  const titre = emise ? `Facture ${emise.numero}` : 'Faire la facture';
  return <SheetShell onClose={fermer} titre={fiche ? 'Ma facture' : titre} maxWidth={760} FermeAuRetour={deps.FermeAuRetour} className="vrm-fp-fs" data-fa-feuille={v.ref}>
    <div className="vrm-fp-feuille-corps">
      {fiche ? <FicheFacturation deps={deps} focus={typeof fiche === 'string' ? fiche : null} surPrete={() => setFiche(false)}/>
        : emise ? <>
          <div className="vrm-fp-etat" data-fa-emise={emise.numero}><b>Émise</b><span>À joindre au colis ou à partager.</span></div>
          <div className="vrm-fp-gestes">
            <button type="button" className="vrm-b vrm-b-primaire" onClick={() => pdf(false)} data-fa-pdf="">Voir le PDF</button>
            <button type="button" className="vrm-b vrm-b-secondaire" onClick={() => pdf(true)}>Partager</button>
          </div>
        </> : <>
          {mv.length ? <div className="vrm-fp-etat is-manque" data-fa-fiche={mv.length}><b>Ta fiche « Ma facture » n'est pas complète</b><span>Il manque {mv.map((m) => m.l).join(', ')}.</span>
            <button type="button" className="vrm-b vrm-b-primaire" onClick={() => setFiche(mv[0].champ)}>Compléter ma fiche</button></div> : null}
          <section className="vrm-fp-section" data-fa-acheteur="">
            <h3>L'acheteur</h3>
            <p className="vrm-fp-muet" data-fa-source={v.acheteurPropose ? 'propose' : 'saisi'}>{v.acheteurPropose ? `Lu dans la commande ${L} : vérifie-le.` : `${L} ne le donne pas : recopie-le du bordereau.`}</p>
            <label className="vrm-fp-champ is-large" data-fp-manque={ma.some((m) => m.champ === 'acheteurNom') ? '1' : '0'}><span>Nom</span><input className="vrm-sensible" data-stream-type="acheteur" value={nom} autoComplete="off" onChange={(e) => setNom(e.target.value)}/></label>
            <label className="vrm-fp-champ is-large" data-fp-manque={ma.some((m) => m.champ === 'acheteurAdresse') ? '1' : '0'}><span>Adresse</span><textarea className="vrm-sensible" data-stream-type="acheteur" rows={3} value={adresse} autoComplete="off" onChange={(e) => setAdresse(e.target.value)}/></label>
          </section>
          <section className="vrm-fp-section">
            <h3>L'article</h3>
            <label className="vrm-fp-champ is-large"><span>Désignation</span><input value={designation} onChange={(e) => setDesignation(e.target.value)}/></label>
            <p className="vrm-fp-muet" data-fa-prix={v.centimes}>Prix : <b className="vrm-fp-chiffre">{euros(v.centimes)}</b> — celui de la vente {L} n° {v.ref}, du {jourParis(v.venteLe)}.</p>
          </section>
          {apercu ? <section className="vrm-fp-section"><h3>Aperçu de la facture</h3><ApercuFacture contenu={apercu} provisoire sensible numeroLibelle="N° donné à l'émission"/></section> : null}
          {!mv.length && (ma.length || mvt.length) ? <p className="vrm-fp-muet" data-fa-manque="">Il manque {[...ma, ...mvt].map((m) => m.l).filter((x, i, t) => t.indexOf(x) === i).join(', ')}.</p> : null}
          <div className="vrm-fp-gestes is-bas">
            <button type="button" className="vrm-b vrm-b-primaire vrm-b-plein" data-fa-emettre="" disabled={occupe || !cfg || !!mv.length || !!ma.length || !!mvt.length} onClick={emettre}>{occupe ? 'Un instant…' : 'Émettre la facture'}</button>
          </div>
        </>}
      {retour ? <p className="vrm-fp-retour-msg is-ko" role="status" data-fa-retour="ko">{retour}</p> : null}
    </div>
  </SheetShell>;
}

// (La liste des factures émises est le registre d'Argent → Factures, src/FacturePro.jsx :
// il lit toutes les pièces `facture_pro`, Leboncoin et eBay comprises — pas de seconde liste.)

// Vestiaire : la même raison pour CHAQUE vente (le prix payé par l'acheteur n'est
// jamais relevé) ⇒ dite UNE fois, sous la liste (§7), au vendeur Pro seulement.
// `ventes` : les ventes Vestiaire affichées (brutes, avec `id`).
export function FactureVcTete({ ventes, deps }) {
  const cfg = useFicheFacturation(deps);
  const liste = Array.isArray(ventes) ? ventes.filter(Boolean) : [];
  if (estPro(cfg) !== true || !liste.length) return null;
  const v = venteAutre('vestiaire', liste[0]);
  if (v.ok) return null;
  return <p className="vrm-fp-muet vrm-fp-raison" data-fa-plateforme="vestiaire" data-fa-etat="refus" data-fa-code={v.code} data-fa-n={liste.length} style={{ marginTop: 8 }}>Facture Pro : {v.raison}.</p>;
}

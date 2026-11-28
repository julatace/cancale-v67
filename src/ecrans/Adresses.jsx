// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import React, { useState, useEffect } from 'react';
import { Bouton, askConfirm, isCloudReady, lireReglage, lireTout, load, onCloudReady, publierATrancher, save, toast } from '../App.jsx';

// ⟦← App.jsx #1⟧
import { EtatPanne } from "../composants/EtatPanne.jsx";
// ⟦← App.jsx #2⟧
// ⟦→ ecrans/Vestiaire.jsx #4⟧
// §11 : l'adresse de réception se compare avec LA forme du serveur (celle qui
// décide à qui appartient un email) — jamais une seconde normalisation ici.
import { normAdresse, ADRESSE_COLLECTRICE, estAdresseCollectrice } from "../../api/_lib/proprietaire-email.js";
// ⟦← App.jsx #3⟧
import { adressesSansCompte, comptesSansAdresse, relierAdresse, CLE_ADRESSES_ACHETEUR } from "../adressesSansCompte.js";

// ⟦← App.jsx #4⟧
// (10 nov.) `ComptesARelierColis` (le bandeau « N colis de X : ses e-mails n'arrivent pas ») est retiré :
// une marque discrète sur la carte du colis (`data-colis-sans-email`), la ligne de fraîcheur dit le reste.

// ── « ADRESSE SANS COMPTE » (6 nov., vague 2, point 5) ──────────────────────
// En tête de E-mails → Relier ma boîte. La règle est dans src/adressesSansCompte.js :
// SES e-mails rangés (`email_reception_*`, l'adresse de RÉCEPTION a décidé qu'ils
// sont à lui) arrivés sur une adresse qu'aucun compte Vinted ne porte. Deux gestes,
// sur SON clic : « Relier un compte » (le registre existant `vinted_account_emails`,
// ligne `main` à son nom, une adresse = un compte) et « C'est un compte acheteur »
// (`vrm_adresses_acheteur`, réversible). Le compte n'est JAMAIS deviné.
// Lecture : deux scalaires par ligne (date, adresses), jamais `select=data` (§4.4),
// toutes les pages (`lireTout`). Pas su ⇒ `EtatPanne`, jamais « aucune ».
function AdressesSansCompte({ comptes }) {
  const [lignes, setLignes] = useState(undefined);
  const [declarees, setDeclarees] = useState(undefined);
  const [comptesEmails, setComptesEmails] = useState(() => (isCloudReady() ? (load('vinted_account_emails', {}) || {}) : undefined));
  const [acheteurs, setAcheteurs] = useState(() => load(CLE_ADRESSES_ACHETEUR, {}) || {});
  const [choix, setChoix] = useState('');
  const charger = React.useCallback(async () => {
    setLignes(undefined); setDeclarees(undefined);
    const [l, d] = await Promise.all([
      lireTout('id=like.email_reception_*&select=at:data->>at,adresses:data->adresses', { strict: true }).catch(() => null),
      lireReglage('vrm_email_owners'),
    ]);
    setLignes(Array.isArray(l) ? l : null);
    setDeclarees(d === null ? null : ((d && d.adresses) || {}));
  }, []);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    const relire = () => { setComptesEmails(load('vinted_account_emails', {}) || {}); setAcheteurs(load(CLE_ADRESSES_ACHETEUR, {}) || {}); };
    const off = onCloudReady(relire);
    const f = (e) => { const k = e && e.detail && e.detail.k; if (k === 'vinted_account_emails' || k === CLE_ADRESSES_ACHETEUR) relire(); };
    window.addEventListener('vrm:save', f);
    return () => { off(); window.removeEventListener('vrm:save', f); };
  }, []);
  const liste = adressesSansCompte({ lignes, declarees, comptesEmails, acheteurs });
  // (9 nov., lot AC) « À trancher » consomme CE nombre (lu en entier seulement).
  const nSansCompte = Array.isArray(liste) ? liste.length : null;
  useEffect(() => { if (nSansCompte != null) publierATrancher('adresses-sans-compte', nSansCompte); }, [nSansCompte]);
  const libres = comptesSansAdresse(comptes, comptesEmails);
  const nomCompte = (a) => (a && (load('vinted_account_labels', {}) || {})[String(a.vinted_user_id)]) || (a && a.login) || `#${a && a.vinted_user_id}`;
  const relier = async (adresse, compte) => {
    const u = relierAdresse(comptesEmails, compte.vinted_user_id, adresse);
    if (!u) { toast('Cette adresse ou ce compte est déjà relié — change-le dans Comptes liés → Gérer.'); return; }
    const ok = await askConfirm({ title: `Relier ${adresse} à ${nomCompte(compte)} ?`, desc: `Les e-mails qui arrivent sur cette adresse seront ceux du compte ${nomCompte(compte)} (ventes, bordereaux, messages). Tu peux le changer dans Comptes liés → Gérer.`, ok: 'Relier', cancel: 'Annuler' });
    if (!ok) return;
    save('vinted_account_emails', u); setComptesEmails(u); setChoix('');
    toast(`${adresse} est reliée à ${nomCompte(compte)}.`);
  };
  const acheteur = async (adresse) => {
    const ok = await askConfirm({ title: 'C’est un compte acheteur ?', desc: `${adresse} sert à acheter : aucun compte vendeur à relier. VRM ne la signalera plus ici. Ses e-mails restent rangés comme avant.`, ok: 'Oui, acheteur', cancel: 'Annuler' });
    if (!ok) return;
    const n = { ...(load(CLE_ADRESSES_ACHETEUR, {}) || {}), [normAdresse(adresse)]: { at: new Date().toISOString() } };
    save(CLE_ADRESSES_ACHETEUR, n); setAcheteurs(n);
  };
  const annulerAcheteur = (adresse) => { const n = { ...(load(CLE_ADRESSES_ACHETEUR, {}) || {}) }; delete n[adresse]; save(CLE_ADRESSES_ACHETEUR, n); setAcheteurs(n); };
  const marquees = Object.keys(acheteurs || {});
  const jour = (d) => { const t = Date.parse(d || ''); return Number.isFinite(t) ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''; };
  if (liste === undefined) return null;   // en cours : rien ne s'affirme, rien ne clignote
  if (liste === null) return <div className="vrm-sans-compte" data-adresses-sans-compte="pas-su"><EtatPanne compact quoi="Les adresses sans compte" raison="Tes e-mails ou tes adresses n’ont pas pu être lus. Rien n’est changé." onReessayer={charger}/></div>;
  if (!liste.length && !marquees.length) return null;
  return (
    <section className="vrm-sans-compte" data-adresses-sans-compte={liste.length} aria-label="Adresses sans compte">
      {liste.length ? <h3 className="vrm-sans-compte-entete">Adresses sans compte</h3> : null}
      {liste.map((x) => (
        <div key={x.adresse} className="vrm-sans-compte-ligne" data-adresse-sans-compte={x.adresse} data-adresse-sans-compte-n={x.n}>
          {/* (10 nov., soir) Une ligne, deux boutons (DA6) : l'adresse, « N e-mails · date », Relier · Acheteur. */}
          <span className="vrm-sans-compte-ic" aria-hidden="true">@</span>
          <div className="vrm-sans-compte-tete">
            <span className="vrm-sans-compte-adresse vrm-sensible" data-stream-type="adresse">{x.adresse}</span>
            <span className="vrm-sans-compte-titre"><span className="vrm-boite-sr">Adresse sans compte : </span>{x.n} e-mail{x.n > 1 ? 's' : ''}{x.dernier ? ` · ${jour(x.dernier)}` : ''}</span>
          </div>
          <div className="vrm-sans-compte-gestes">
            <Bouton variante="secondaire" data-relier-compte={x.adresse} aria-expanded={choix === x.adresse} onClick={() => setChoix((c) => (c === x.adresse ? '' : x.adresse))}>Relier</Bouton>
            <Bouton variante="discret" data-compte-acheteur={x.adresse} aria-label="C’est un compte acheteur" onClick={() => acheteur(x.adresse)}>Acheteur</Bouton>
          </div>
          {choix === x.adresse && (
            <div className="vrm-sans-compte-choix" data-relier-choix-liste={libres.length}>
              {libres.length
                ? <>
                    <span className="vrm-sans-compte-aide">Quel compte ?</span>
                    {libres.map((a) => <Bouton key={a.vinted_user_id} variante="secondaire" data-relier-choix={String(a.vinted_user_id)} onClick={() => relier(x.adresse, a)}>{nomCompte(a)}</Bouton>)}
                  </>
                : <span className="vrm-sans-compte-aide" data-relier-aucun="">Tous tes comptes Vinted ont déjà une adresse — change-la dans Comptes liés → Gérer.</span>}
            </div>
          )}
        </div>
      ))}
      {marquees.length > 0 && (
        <details className="vrm-sans-compte-acheteurs" data-adresses-acheteur={marquees.length}>
          <summary>{marquees.length} adresse{marquees.length > 1 ? 's' : ''} marquée{marquees.length > 1 ? 's' : ''} « compte acheteur »</summary>
          {marquees.map((a) => <div key={a} className="vrm-sans-compte-acheteur"><span className="vrm-sensible" data-stream-type="adresse">{a}</span><button type="button" className="vrm-lien-action" data-annuler-acheteur={a} onClick={() => annulerAcheteur(a)}>Annuler</button></div>)}
        </details>
      )}
    </section>
  );
}
export { AdressesSansCompte };

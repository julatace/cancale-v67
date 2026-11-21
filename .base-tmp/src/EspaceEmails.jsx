import React from "react";
import "./espace-emails.css";
import "./emails-apercu.css";
import { tr } from './i18n/index.js';
// (2 nov.) Julien : « beaucoup d'incompréhension quand je vais dans les emails ».
// Quatre onglets NUS (plus d'explication à côté, plus de nombre : le nombre est
// écrit UNE fois, dans l'Aperçu, avec sa phrase — §7). Le nom accessible garde le
// mot d'avant (« Réception », « Journal », « Comptes et transfert ») : on retrouve
// l'onglet sous les deux noms.
// (5 nov., chantier G, revue 2.24) Ces rubriques vivent dans l'onglet « Relier ma boîte »
// de l'écran E-mails : un onglet « E-mails » dans l'écran « E-mails » ne disait rien — il
// s'appelle « Journal » (le nom accessible garde « E-mails »).
const rubriques = [
  ["reception", "Aperçu", "Aperçu · Réception"],
  ["journal", "Journal", "Journal · E-mails"],
  ["adresses", "Adresses", "Adresses · Comptes et transfert"],
  ["a-traiter", "À rattacher", "À rattacher"],
];
export default function EspaceEmails({
  onglet,
  onOnglet,
  idBase,
  theme = {},
  children,
}) {
  return (
    <section
      className="vrm-emails-espace"
      data-espace-emails
      data-onglet={onglet}
      style={{
        "--email-encre": theme.text,
        "--email-surface": theme.card,
        "--email-fond": theme.bg,
        "--email-ligne": theme.border,
        "--email-secondaire": theme.muted,
        "--email-accent": theme.accent,
        "--email-sur-accent": theme.onAccent,
        "--email-ambre": theme.warn,
      }}
    >
      {/* (5 nov., chantier G) Sous le choix « Boîte de réception · Relier ma boîte », le second niveau
          prend le dessin des filtres de l'app (`vrm-filtres`) : deux contrôles segmentés empilés se confondaient. */}
      <nav className="vrm-emails-rubriques vrm-filtres" aria-label={tr('emails.rubriquesEMails')}>
        {rubriques.map(([id, titre, nom]) => (
          <button
            key={id}
            type="button"
            aria-label={nom}
            aria-pressed={onglet === id}
            aria-controls={
              idBase +
              "-" +
              id +
              (id === "adresses" ? " " + idBase + "-reception" : "")
            }
            data-email-onglet={id}
            onClick={() => onOnglet(id)}
          >
            <strong>{titre}</strong>
          </button>
        ))}
      </nav>
      {children}
    </section>
  );
}

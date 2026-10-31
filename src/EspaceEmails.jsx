import React from "react";
import "./espace-emails.css";
const rubriques = [
  ["reception", "Réception", "Les emails reçus"],
  ["adresses", "Comptes", "Adresses et transfert"],
  ["a-traiter", "À rattacher", "Les emails mis de côté"],
];
export default function EspaceEmails({
  onglet,
  onOnglet,
  adresses,
  aRattacher,
  idBase,
  theme = {},
  children,
}) {
  return (
    <section
      className="vrm-emails-espace"
      data-espace-emails
      style={{
        "--email-encre": theme.text,
        "--email-surface": theme.card,
        "--email-fond": theme.bg,
        "--email-ligne": theme.border,
        "--email-secondaire": theme.muted,
        "--email-accent": theme.accent,
        "--email-sur-accent": theme.onAccent,
      }}
    >
      <header className="vrm-emails-entete">
        <span className="vrm-emails-embleme" aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="m4 7 8 6 8-6" />
          </svg>
        </span>
        <div>
          <h2>Emails</h2>
          <p>Réception et comptes reliés.</p>
        </div>
      </header>
      <nav className="vrm-emails-rubriques" aria-label="Rubriques des emails">
        {rubriques.map(([id, titre, description]) => {
          const n =
            id === "adresses"
              ? adresses
              : id === "a-traiter"
                ? aRattacher
                : null;
          return (
            <button
              key={id}
              type="button"
              aria-label={
                id === "adresses" ? "Comptes et transfert" : undefined
              }
              aria-pressed={onglet === id}
              aria-controls={
                idBase +
                "-" +
                id +
                (id === "adresses" ? " " + idBase + "-reception" : "")
              }
              onClick={() => onOnglet(id)}
            >
              <span>
                <strong>{titre}</strong>
                {n > 0 && <b className="vrm-emails-nombre">{n}</b>}
              </span>
              <small>{description}</small>
            </button>
          );
        })}
      </nav>
      {children}
    </section>
  );
}

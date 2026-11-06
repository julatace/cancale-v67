import React from "react";
import {
  articlesVendusAilleurs,
  conserverRetraitsNonConfirmes,
} from "./bilanSynchronisation.js";
import "./bilanSynchronisation.css";
import { PhotoVide } from "./composants/PhotoVide.jsx";
// (5 nov., chantier E2) Le composant seul (sa place dans Ma journée appartient à E1) :
// « Rien à retirer » plutôt que « 0 annonce à vérifier » (revue 3.5), des pluriels
// justes, une date de lecture courte, une vignette vide dessinée comme partout
// (`PhotoVide`), et des commandes de 44 px au doigt (ventes-e2.css).
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const dateCourte = (t) => {
  const d = new Date(t);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
};
// Keep unresolved alerts when navigating to the platform to handle a withdrawal.
// This memory belongs to one logged-in owner and is never persisted.
let memoire = { owner: null, vue: {} };
function retrouver(owner) {
  if (memoire.owner !== owner) memoire = { owner, vue: {} };
  return memoire.vue;
}
// (5 nov., chantier E1) La lecture est un CROCHET : Ma journée la lance au
// montage (« Vendus ailleurs » n'y est une carte de « À faire » que s'il y a
// quelque chose à vérifier) ; le repli d'origine (`VendusAilleurs`) la garde
// paresseuse. La mémoire est la même (par propriétaire, jamais rangée) : une
// lecture par session, « Revérifier » relit.
export function useVerifVendusAilleurs({ owner, ownerActuel, charger }) {
  const [vue, setVue] = React.useState(() => retrouver(owner)),
    gen = React.useRef(0),
    source = React.useRef();
  source.current = { ownerActuel, charger };
  React.useEffect(() => {
    gen.current++;
    setVue(retrouver(owner));
    return () => {
      gen.current++;
    };
  }, [owner]);
  const lire = async () => {
    const precedents = vue.owner === owner ? vue.lignes || [] : [];
    const n = ++gen.current;
    setVue({ owner, charge: true, lignes: precedents });
    let timer;
    try {
      const data = await Promise.race([
        source.current.charger(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error("Délai de lecture")), 20000);
        }),
      ]);
      if (n === gen.current && source.current.ownerActuel() === owner) {
        const calcul = articlesVendusAilleurs(data);
        const lignes = conserverRetraitsNonConfirmes(
          precedents,
          calcul.lignes,
          data,
        );
        const cle = (a) => [a.plateforme, a.compte, a.id].join(":");
        const resultat = {
          owner,
          manques: data.manques || [],
          ...calcul,
          lignes,
          confirmes: precedents.filter(
            (a) => !lignes.some((x) => cle(x) === cle(a)),
          ).length,
          at: Date.now(),
        };
        if (memoire.owner === owner) memoire.vue = resultat;
        setVue(resultat);
      }
    } catch (e) {
      if (n === gen.current && source.current.ownerActuel() === owner) {
        const resultat = {
          owner,
          erreur:
            "La vérification n’a pas abouti. Actualise les plateformes puis réessaie.",
          lignes: precedents.map((a) => ({ ...a, aConfirmer: true })),
        };
        if (memoire.owner === owner) memoire.vue = resultat;
        setVue(resultat);
      }
    } finally {
      clearTimeout(timer);
    }
  };
  const v = vue.owner === owner ? vue : {};
  return { v, lire };
}

export default function VendusAilleurs({
  owner,
  ownerActuel,
  charger,
  onNav,
  PhotoVinted,
}) {
  const { v, lire } = useVerifVendusAilleurs({ owner, ownerActuel, charger });
  return (
    <details
      className="vrm-bilan-sync"
      data-vendus-ailleurs
      onToggle={(e) => {
        if (e.currentTarget.open && !v.at && !v.charge && !v.erreur) lire();
      }}
    >
      <summary>
        {/* (2 nov., 22 h 30) Le titre court, le geste en pilule (carte « À faire » de Ma journée). */}
        <b className="vrm-va-titre">Vendus ailleurs</b>{" "}
        <span>
          {v.charge
            ? "Vérification…"
            : v.lignes
              ? v.lignes.length
                ? pluriel(v.lignes.length, "annonce à retirer", "annonces à retirer")
                : "Rien à retirer"
              : "Vérifier"}
        </span>
      </summary>
      <VendusAilleursDetail v={v} lire={lire} onNav={onNav} PhotoVinted={PhotoVinted} />
    </details>
  );
}

// Le détail : le corps du repli, ou de la feuille de Ma journée — les annonces à
// retirer, chacune avec son lien et « Gérer le retrait ».
export function VendusAilleursDetail({ v, lire, onNav, PhotoVinted }) {
  return (
    <>
      <p>Reliés par référence VRM, jamais par titre — retire-les sur leur plateforme.</p>
      <button type="button" disabled={v.charge} onClick={lire}>
        {v.charge ? "Lecture…" : "Revérifier les annonces"}
      </button>
      {v.erreur && <p role="alert">{v.erreur}</p>}
      {v.confirmes > 0 && (
        <p role="status">
          {pluriel(v.confirmes, "annonce confirmée", "annonces confirmées")} hors
          vente depuis la dernière vérification.
        </p>
      )}
      {v.manques?.length > 0 && (
        <p role="status">
          Vérification partielle : {v.manques.join(", ")}. L’absence d’alerte ne
          confirme pas que tout est retiré.
        </p>
      )}
      {v.ambigus > 0 && (
        <p>
          {pluriel(v.ambigus, "correspondance ambiguë écartée", "correspondances ambiguës écartées")}.
          Vérifie les numéros de rangement avant de retirer une annonce.
        </p>
      )}
      {v.lignes?.map((a) => (
        <article key={[a.plateforme, a.compte, a.id].join(":")}>
          <div className="vrm-vendu-photo">
            {a.photo && PhotoVinted ? (
              <PhotoVinted src={a.photo} alt="" loading="lazy" />
            ) : (
              <PhotoVide remplir />
            )}
          </div>
          <div>
            <strong>
              N°{a.numero} · {a.titre || "Article"}
            </strong>
            <small>
              {a.aConfirmer
                ? "Ancienne alerte à vérifier · vendu sur "
                : "Vendu sur "}
              {[...new Set(a.ventes.map((x) => x.plateforme))].join(", ")}
              {" · "}
              {a.aConfirmer
                ? "retrait non confirmé sur "
                : "encore proposé sur "}
              {a.plateforme}
            </small>
            <small>
              {a.compteNom || a.compte || "Compte sans nom"} · annonce {a.id}
            </small>
            {a.capture && Number.isFinite(new Date(a.capture).getTime()) && (
              <small>Lu le {dateCourte(a.capture)}</small>
            )}
          </div>
          <div className="vrm-va-gestes">
            <button type="button" onClick={() => onNav?.(a.onglet)}>
              Gérer le retrait
            </button>
            {a.lien && (
              <a href={a.lien} target="_blank" rel="noreferrer">
                Ouvrir l’annonce ↗
              </a>
            )}
          </div>
        </article>
      ))}
      {v.lignes?.length === 0 && (
        <p>Aucune correspondance à retirer dans les données récupérées.</p>
      )}
    </>
  );
}

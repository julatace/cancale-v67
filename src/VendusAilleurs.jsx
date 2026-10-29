import React from "react";
import {
  articlesVendusAilleurs,
  conserverRetraitsNonConfirmes,
} from "./bilanSynchronisation.js";
import "./bilanSynchronisation.css";
// Keep unresolved alerts when navigating to the platform to handle a withdrawal.
// This memory belongs to one logged-in owner and is never persisted.
let memoire = { owner: null, vue: {} };
function retrouver(owner) {
  if (memoire.owner !== owner) memoire = { owner, vue: {} };
  return memoire.vue;
}
export default function VendusAilleurs({
  owner,
  ownerActuel,
  charger,
  onNav,
  PhotoVinted,
}) {
  const [vue, setVue] = React.useState(() => retrouver(owner)),
    gen = React.useRef(0),
    source = React.useRef();
  source.current = { ownerActuel, charger };
  React.useEffect(() => {
    gen.current++;
    setVue(retrouver(owner));
    return ()=>{gen.current++;};
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
          ...data,
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
  return (
    <details
      className="vrm-bilan-sync"
      data-vendus-ailleurs
      onToggle={(e) => {
        if (e.currentTarget.open && !v.at && !v.charge && !v.erreur) lire();
      }}
    >
      <summary>
        Vendus ailleurs · annonces à retirer{" "}
        <span>
          {v.charge
            ? "Vérification…"
            : v.lignes
              ? `${v.lignes.length} annonce${v.lignes.length > 1 ? "s" : ""} à vérifier`
              : "Vérifier mes plateformes"}
        </span>
      </summary>
      <p>
        Articles reliés par référence VRM ou lien explicite, jamais par titre.
        Vérifie l’annonce et confirme son retrait sur la plateforme. Elle reste
        ici tant qu’une nouvelle lecture ne confirme pas qu’elle n’est plus en
        vente.
      </p>
      <button type="button" disabled={v.charge} onClick={lire}>
        {v.charge ? "Lecture…" : "Revérifier les annonces"}
      </button>
      {v.erreur && <p role="alert">{v.erreur}</p>}
      {v.confirmes > 0 && (
        <p role="status">
          {v.confirmes} annonce{v.confirmes > 1 ? "s" : ""} confirmée
          {v.confirmes > 1 ? "s" : ""} hors vente depuis la dernière
          vérification.
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
          {v.ambigus} correspondance(s) ambiguë(s) écartée(s). Vérifie les
          numéros de rangement avant de retirer une annonce.
        </p>
      )}
      {v.lignes?.map((a) => (
        <article key={[a.plateforme, a.compte, a.id].join(":")}>
          <div className="vrm-vendu-photo">
            {a.photo && PhotoVinted && (
              <PhotoVinted src={a.photo} alt="" loading="lazy" />
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
              {[...new Set(a.ventes.map((x) => x.plateforme))].join(", ")} ·
              {a.aConfirmer
                ? "retrait non confirmé sur "
                : "encore proposé sur "}
              {a.plateforme}
            </small>
            <small>
              {a.compteNom || a.compte || "Compte sans nom"} · annonce {a.id}
            </small>
            {a.capture && Number.isFinite(new Date(a.capture).getTime()) && (
              <small>
                Dernière lecture : {new Date(a.capture).toLocaleString("fr-FR")}
              </small>
            )}
          </div>
          {a.lien && (
            <a href={a.lien} target="_blank" rel="noreferrer">
              Ouvrir l’annonce ↗
            </a>
          )}
          <button type="button" onClick={() => onNav?.(a.onglet)}>
            Gérer le retrait
          </button>
        </article>
      ))}
      {v.lignes?.length === 0 && (
        <p>Aucune correspondance à retirer dans les données récupérées.</p>
      )}
    </details>
  );
}

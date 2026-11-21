import React from "react";
import {
  chaineArticle,
  identifiantVinted,
} from "./outilsArticlesVinted.js";
import "./outilsArticlesVinted.css";
const eur = (v) =>
  v == null || !Number.isFinite(v)
    ? "Non calculable"
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
      }).format(v);
// (11 nov., décision C10) L'ancien bloc « Annonces à compléter » est fondu dans la vue d'Annonces
// « À compléter » (src/AnnoncesACompleter.jsx, règle src/annoncesACompleter.js).
export function ComparaisonComptesVinted({
  rows,
  periode,
  disponible,
  stockDisponible,
  charger,
}) {
  return (
    <details className="vrm-outils" data-comparer-comptes>
      <summary>
        Comparer mes comptes Vinted <span>{rows.length} compte{rows.length > 1 ? 's' : ''}</span>
      </summary>
      <p>
        <b>{periode}</b> · ventes finalisées, à leur date de vente.
      </p>
      <button type="button" onClick={charger}>
        Actualiser tous les comptes
      </button>
      {!disponible && (
        <p role="status">
          Lecture des ventes incomplète : les chiffres ci-dessous sont partiels.
        </p>
      )}
      {!stockDisponible && (
        <p role="status">
          Stock non entièrement récupéré : les quantités restent partielles.
        </p>
      )}
      <div className="vrm-outils-table">
        <table>
          <thead>
            <tr>
              <th>Compte</th>
              <th>Finalisées</th>
              <th>CA connu</th>
              <th>Bénéfice calculable</th>
              <th>Stock actuel</th>
              <th>À envoyer</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.uid}>
                <th scope="row">{r.nom}</th>
                <td>{r.ventes}</td>
                <td>
                  {eur(r.ca)}
                  {r.prixManquants > 0 && (
                    <small>{r.prixManquants} prix inconnus</small>
                  )}
                </td>
                <td>
                  {eur(r.benefice)}
                  <small>
                    {r.couvertes}/{r.ventes} ventes : achat et frais confirmés
                  </small>
                </td>
                <td>{stockDisponible ? r.stock : `au moins ${r.stock}`}</td>
                <td>{r.taches}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Le bénéfice couvre uniquement les ventes avec prix d’achat et frais
        complets renseignés. Aucun montant manquant n’est remplacé par zéro.
      </p>
    </details>
  );
}
export function HistoriqueArticle({
  item,
  uid,
  owner,
  ownerActuel,
  lire,
  numeros,
  prix,
}) {
  const [etat, setEtat] = React.useState({}),
    [tour, setTour] = React.useState(0);
  const cle = JSON.stringify([owner, uid, item]);
  const source = React.useRef();
  source.current = { lire, ownerActuel };
  React.useEffect(() => {
    let actif = true;
    setEtat({ cle, charge: true });
    (async () => {
      try {
        if (
          !owner ||
          source.current.ownerActuel() !== owner ||
          !identifiantVinted(uid) ||
          !identifiantVinted(item)
        )
          throw Error("Compte ou article non confirmé.");
        const rows = await source.current.lire(
          `owner=eq.${encodeURIComponent(owner)}&id=like.coffre_${uid}_*&meta->>supprime=is.null&select=id,owner,item:data->>id,ancien:meta->>recreeDe,ancienData:data->>recreeDe,title:data->>title,price:data->price,saved:data->>savedAt`,
        );
        if (source.current.ownerActuel() !== owner)
          throw Error("Session modifiée.");
        if (
          rows.some(
            (r) => r.owner !== owner || !r.id.startsWith(`coffre_${uid}_`),
          )
        )
          throw Error("Historique non vérifié.");
        const archives = rows.map((r) => ({
          ...r,
          item: r.item || r.id.slice(`coffre_${uid}_`.length),
          ancien: r.ancienData || r.ancien,
        }));
        const chain = chaineArticle(item, archives, numeros);
        const conv = await source.current.lire(
          `owner=eq.${encodeURIComponent(owner)}&id=like.harvest_${uid}_conv_*&meta->>supprime=is.null&select=id,owner,item:data->payload->conversation->transaction->>item_id`,
        );
        if (
          !Array.isArray(conv) ||
          conv.some(
            (r) =>
              r.owner !== owner ||
              !new RegExp("^harvest_" + uid + "_conv_\\d+$").test(r.id),
          )
        )
          throw Error("Échanges non vérifiés.");
        if (actif && source.current.ownerActuel() === owner)
          setEtat({
            cle,
            chain,
            archives: archives.filter((r) => chain.ids.includes(r.item)),
            conv: conv.filter((r) => chain.ids.includes(String(r.item))),
          });
      } catch (e) {
        if (actif && source.current.ownerActuel() === owner)
          setEtat({ cle, erreur: e.message });
      }
    })();
    return () => {
      actif = false;
    };
  }, [cle, tour]);
  const vue = etat.cle === cle ? etat : {};
  const ids = vue.chain?.ids || [];
  return (
    <section className="vrm-historique" data-historique-article>
      <h3>Annonces et prix de cet article</h3>
      <button
        type="button"
        disabled={vue.charge}
        onClick={() => setTour((n) => n + 1)}
      >
        Actualiser l’historique
      </button>
      {vue.charge && <p>Lecture de l’historique…</p>}
      {vue.erreur && <p role="alert">{vue.erreur}</p>}
      {vue.chain?.conflit && (
        <p role="alert">
          Liens contradictoires : seules les données de cette annonce sont
          affichées.
        </p>
      )}
      {ids.map((id) => (
        <div key={id}>
          <a
            href={`https://www.vinted.fr/items/${id}`}
            target="_blank"
            rel="noreferrer"
          >
            {id === String(item)
              ? "Annonce consultée"
              : "Annonce liée par republication"}{" "}
            · {id} ↗
          </a>
          {numeros[id]?.numero && <small>N° VRM {numeros[id].numero}</small>}
          {vue.archives
            ?.filter((r) => r.item === id)
            .map((r) => (
              <small key={r.id}>
                Prix de la sauvegarde :{" "}
                {eur(
                  typeof r.price === "object"
                    ? Number(r.price?.amount)
                    : r.price != null
                      ? Number(r.price)
                      : null,
                )}
                {r.saved && Number.isFinite(Date.parse(r.saved))
                  ? ` · ${new Date(r.saved).toLocaleDateString("fr-FR")}`
                  : ""}
              </small>
            ))}
          {(prix || [])
            .filter(
              (r) => String(r.uid) === String(uid) && String(r.item) === id,
            )
            .map((r, i) => (
              <small key={i}>
                {eur(r.avant)} → {eur(r.apres)} ·{" "}
                {new Date(r.at).toLocaleString("fr-FR")}
              </small>
            ))}
        </div>
      ))}
      {vue.conv?.map((c) => (
        <a
          key={c.id}
          href={`https://www.vinted.fr/inbox/${c.id.slice(`harvest_${uid}_conv_`.length)}`}
          target="_blank"
          rel="noreferrer"
        >
          Conversation de l’article {c.item} ↗
        </a>
      ))}
      <p>
        Liens établis par identifiants de republication, jamais par
        ressemblance. Une ancienne annonce peut avoir été supprimée sur Vinted.
        Les prix non enregistrés dans VRM ne peuvent pas être reconstitués.
      </p>
    </section>
  );
}

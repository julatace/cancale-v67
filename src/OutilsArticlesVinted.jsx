import React from "react";
import {
  bilanAnnonce,
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
export function AnnoncesACompleter({
  items,
  numeros,
  drafts,
  ouvrir,
  charger,
  charge,
  PhotoVinted,
  incomplet = false,
}) {
  const [filtre, setFiltre] = React.useState("manque");
  const lignes = items.map((it) => ({
    it,
    b: bilanAnnonce(it, drafts[String(numeros[it.id]?.numero || it.id)]),
  }));
  const n = lignes.filter((x) => x.b.manque.length).length;
  const nInconnu = lignes.filter((x) => x.b.inconnu.length).length;
  // (30 oct.) Rien à compléter, rien d'illisible, lecture complète : le bloc se tait
  // (« 0 avec champs manquants » était une ligne de plus avant la recherche).
  if (!n && !nInconnu && !charge) return null;
  return (
    <details className="vrm-outils" data-annonces-completer>
      <summary>
        Annonces à compléter <span>{n ? `${n} avec champs manquants` : charge ? "lecture…" : `${nInconnu} à relire sur Vinted`}</span>
      </summary>
      <p>Un brouillon VRM : l’annonce en ligne ne change pas.</p>
      {incomplet && <p role="status">Lecture des annonces incomplète : ce bilan porte uniquement sur les données récupérées.</p>}
      <div className="vrm-outils-actions">
        <button
          type="button"
          aria-pressed={filtre === "manque"}
          onClick={() => setFiltre("manque")}
        >
          Manquants
        </button>
        <button
          type="button"
          aria-pressed={filtre === "inconnu"}
          onClick={() => setFiltre("inconnu")}
        >
          Données non récupérées
        </button>
        <button type="button" disabled={charge} onClick={charger}>
          Actualiser les annonces
        </button>
      </div>
      <div className="vrm-outils-liste">
        {lignes
          .filter((x) =>
            filtre === "manque" ? x.b.manque.length : x.b.inconnu.length,
          )
          .map(({ it, b }) => (
            <article key={it.id}>
              {it.photo && PhotoVinted && (
                <PhotoVinted src={it.photo} alt="" loading="lazy" />
              )}
              <div>
                <strong>{it.title || "Sans titre"}</strong>
                <small>
                  {it._acc?.login || it._acc?.username || "Compte Vinted"}
                  {numeros[it.id]?.numero
                    ? ` · N°${numeros[it.id].numero}`
                    : ""}
                </small>
                <small>
                  {filtre === "manque"
                    ? `À compléter : ${b.manque.join(", ")}`
                    : `Non récupéré : ${b.inconnu.join(", ")}`}
                  {b.prepare ? " · Brouillon préparé" : ""}
                </small>
              </div>
              <button type="button" onClick={() => ouvrir(String(it.id))}>
                Compléter
              </button>
            </article>
          ))}
      </div>
      {!lignes.some((x) =>
        filtre === "manque" ? x.b.manque.length : x.b.inconnu.length,
      ) && (
        <p>
          {charge
            ? "Lecture en cours…"
            : "Aucun champ signalé dans les annonces récupérées."}
        </p>
      )}
    </details>
  );
}
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
        Comparer mes comptes Vinted <span>{rows.length} comptes</span>
      </summary>
      <p>
        <b>{periode}</b> · ventes finalisées, à leur date de vente (masquées exclues).
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
              <th>À expédier</th>
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
                <td>{stockDisponible ? r.stock : `≥ ${r.stock}`}</td>
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

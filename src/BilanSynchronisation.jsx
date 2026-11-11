import React from "react";
import { resumerLecture } from "./bilanSynchronisation.js";
import "./bilanSynchronisation.css";
import { tr } from './i18n/index.js';
import { trj } from './i18n/react.js';
export default function BilanSynchronisation({ owner, sources, onNav }) {
  const memo = React.useRef({
    owner,
    donnees: new Map(),
    empreintes: new Map(),
    lignes: new Map(),
  });
  const [vue, setVue] = React.useState(null);
  const empreinte = JSON.stringify(sources);
  React.useEffect(() => {
    if (memo.current.owner !== owner)
      memo.current = {
        owner,
        donnees: new Map(),
        empreintes: new Map(),
        lignes: new Map(),
      };
    if (!owner) return;
    let change = false;
    const permis = new Set(
      sources.flatMap((s) =>
        (s.comptes || []).map((c) => s.id + ":" + String(c.uid)),
      ),
    );
    for (const k of memo.current.lignes.keys())
      if (!permis.has(k)) {
        // A returning source must be processed even when its payload is unchanged.
        memo.current.empreintes.delete(memo.current.lignes.get(k).source);
        memo.current.lignes.delete(k);
        memo.current.donnees.delete(k);
        change = true;
      }
    for (const s of sources) {
      if (s.charge || (!Array.isArray(s.items) && !s.erreur)) continue;
      const signature = JSON.stringify(s);
      if (memo.current.empreintes.get(s.id) === signature) continue;
      memo.current.empreintes.set(s.id, signature);
      const r = resumerLecture(memo.current.donnees, s);
      memo.current.donnees = r.next;
      for (const l of r.resultats)
        memo.current.lignes.set(l.source + ":" + l.uid, l);
      change = true;
    }
    if (change)
      setVue({
        owner,
        lignes: [...memo.current.lignes.values()],
        at: Date.now(),
      });
  }, [owner, empreinte]);
  if (!owner) return null;
  // (6 nov., « de vrais écrans de chargement ») Pendant la première lecture, la ligne
  // garde SA place (même forme, repliée) : elle n'arrive plus en poussant ce qui suit.
  if (vue?.owner !== owner)
    return (
      <details className="vrm-bilan-sync" data-bilan-synchronisation="" data-bilan-attente="">
        <summary>
          {tr('messages.donnees')} <span>{tr('messages.lecture')}</span>
        </summary>
      </details>
    );
  // Filter during render as well: effects run after the account list changes.
  const permis = new Set(
    sources.flatMap((s) =>
      (s.comptes || []).map((c) => s.id + ":" + String(c.uid)),
    ),
  );
  const lignes = vue.lignes.filter((l) => permis.has(l.source + ":" + l.uid));
  const changements = lignes.reduce(
    (n, l) => n + (l.ajouts?.length || 0) + (l.modifies?.length || 0),
    0,
  );
  const erreurs = new Set(
    lignes
      .filter((l) => l.etat === "erreur")
      .map((l) => l.uid + ":" + l.source),
  ).size;
  return (
    <details className="vrm-bilan-sync" data-bilan-synchronisation>
      <summary>
        {tr('messages.donnees')}{" "}
        <span>
          {changements
            ? tr('messages.changements', { n: String(changements) })
            : erreurs
              ? tr('journee.verifier')
              : tr('annonces.voirDetail')}
          {erreurs
            ? tr('messages.nonConfirmees', { n: String(erreurs) })
            : ""}
        </span>
      </summary>
      <p>
        {tr('messages.comparaisonAvecLecture')}
      </p>
      <time dateTime={new Date(vue.at).toISOString()}>
        {tr('messages.bilanVrm')}{" "}
        {new Date(vue.at).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        {tr('messages.heureCapturePlateforme')}
      </time>
      {lignes.map((l) => (
        <article key={l.source + ":" + l.uid}>
          <div>
            <strong>{l.nom}</strong>
            <small>
              {l.libelle} ·{" "}
              {l.etat === "erreur"
                ? l.precedentConserve
                  ? tr('messages.nonReluDerniere')
                  : tr('messages.lectureIndisponible')
                : l.etat === "initial"
                  ? tr('messages.elementsPremiereLecture', { n: String(l.connues) })
                  : `${l.ajouts.length} ajout${l.ajouts.length > 1 ? "s" : ""} · ${l.modifies.length} modification${l.modifies.length > 1 ? "s" : ""}`}
              {l.partiel ? tr('messages.historiqueLimiteIncomplet') : ""}
            </small>
          </div>
          {onNav && (
            <button
              type="button"
              onClick={() =>
                onNav(sources.find((s) => s.id === l.source)?.onglet)
              }
            >
              {tr('ventes.voir')}
            </button>
          )}
          {(l.ajouts?.length > 0 || l.modifies?.length > 0) && (
            <details>
              <summary>{tr('messages.elementsConcernes')}</summary>
              <ul>
                {[
                  ...l.ajouts.map((x) => ({ ...x, etat: "Ajouté" })),
                  ...l.modifies.map((x) => ({ ...x, etat: "Modifié" })),
                ]
                  .slice(0, 30)
                  .map((x) => (
                    <li key={x.id}>
                      {x.etat} · {x.titre || tr('messages.elementSansTitre')}{" "}
                      <small>{trj('messages.ref', { id: x.id })}</small>
                    </li>
                  ))}
              </ul>
              {l.ajouts.length + l.modifies.length > 30 && (
                <small>{tr('messages.30PremiersElements')}</small>
              )}
            </details>
          )}
        </article>
      ))}
    </details>
  );
}

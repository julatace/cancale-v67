// api/_lib/resume-soir.js
// ────────────────────────────────────────────────────────────────────────────
// LE RÉSUMÉ DU SOIR (10 nov., lot AT — proposition 3, validée par Julien).
// C'est le « rappel de la veille au soir » retenu le 11 octobre, AMÉLIORÉ : la
// MÊME notification (catégorie `soir`, mémo `soir_reminder_dedup`, cron du soir
// `/api/rappel-soir` → `?moment=soir`), jamais une deuxième. Elle ne dit plus que
// ce qu'il y a à faire DEMAIN :
//   · les colis à déposer dont la date limite LUE (e-mail du bordereau, eBay,
//     Vestiaire — api/_lib/limite-envoi.js) tombe demain, avec l'heure la plus
//     proche ; ceux déjà en retard ; les dates ESTIMÉES passées (« vérifie ») ;
//   · les colis à retirer dont le dernier jour LU tombe demain (la règle du
//     rappel du matin, `rappelsRetraitDuJour`, un jour plus loin) ;
//   · les offres Vestiaire REÇUES, à trancher, qui expirent avant demain soir
//     (l'échéance lue par l'extension). Vinted : aucune — ses offres n'expirent
//     pas (Julien, 5 nov.). eBay : les offres ne sont pas rangées en base (lues
//     en direct à l'ouverture) — rien n'est dit.
// Rien à faire demain ⇒ RIEN ne sonne (« rien demain » ne se dit pas). Le
// toucher ouvre le premier geste : Colis (prêts), sinon le colis à retirer (sa
// carte s'il est seul), sinon Messages · Vestiaire.
// Pur : aucune lecture, aucune écriture (api/ship-reminders.js lit, ce module décide).
// ────────────────────────────────────────────────────────────────────────────
import { texteSoir } from './notif-apercus.js';
import { DESTINATIONS } from './lien-notif.js';
import { jourParis } from './retrait-colis.js';
import { offresVestiaire } from '../../src/offresVestiaire.js';

// Les offres Vestiaire à trancher qui expirent entre maintenant et la fin de demain
// (heure de Paris). `ligne` : la ligne `vc_offres` projetée (`undefined` = pas su ⇒
// `null`, ligne absente ⇒ aucune offre). `horsPlan(compte)` : Solo, compte écarté.
export function offresVcDemain(ligne, { maintenant = Date.now(), demain, horsPlan = null } = {}) {
  if (ligne === undefined) return null;
  if (ligne === null) return [];
  const e = offresVestiaire(ligne, maintenant);
  if (e.etat !== 'lu' && e.etat !== 'jamais') return null;
  return (e.aTrancher || []).filter((o) => typeof o.expire === 'number' && o.expire > maintenant
    && jourParis(o.expire) <= demain && !(horsPlan && horsPlan(o.compte)));
}

// La décision. `colis` : null (pas su) ou { demain, heure, retard, aVerifier, manque } ;
// `retraits` : null (pas su) ou [{ suivi, lieu, tx }] ; `offres` : null (pas su) ou [...].
export function resumeDuSoir({ colis = null, retraits = null, offres = null } = {}) {
  const c = colis || {};
  const nColis = (c.demain || 0) + (c.retard || 0) + (c.aVerifier || 0);
  const r = Array.isArray(retraits) ? retraits : [];
  const o = Array.isArray(offres) ? offres : [];
  const compte = { colis: nColis, retraits: r.length, offres: o.length };
  if (!nColis && !r.length && !o.length) {
    const passu = [colis === null && 'colis', retraits === null && 'retraits', offres === null && 'offres'].filter(Boolean);
    return { envoyer: false, raison: passu.length ? `rien de su pour demain (${passu.join(', ')} pas lus) — rien envoyé` : 'rien demain — rien envoyé', compte };
  }
  const txt = texteSoir({
    colis: nColis ? c : null,
    retraits: { n: r.length, lieu: r.length === 1 ? r[0].lieu : '' },
    offres: { n: o.length },
    manque: nColis ? c.manque : null,
  });
  const url = nColis ? DESTINATIONS.colis({})
    : r.length ? DESTINATIONS.retrait(r.length === 1 ? { suivi: r[0].suivi, tx: r[0].tx } : {})
      : DESTINATIONS.vcOffres();
  return { envoyer: true, title: txt.title, body: txt.body, url, compte };
}

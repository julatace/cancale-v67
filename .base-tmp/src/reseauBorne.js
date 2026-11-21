// ══════════════════════════════════════════════════════════════════════════════
//  UNE REQUÊTE QUI NE RÉPOND PAS N'EST PAS UNE REQUÊTE EN COURS (11 nov. 2026)
// ══════════════════════════════════════════════════════════════════════════════
// Julien est souvent au point relais, en sous-sol : le réseau ne « coupe » pas
// toujours net — la connexion reste ouverte et RIEN ne revient (iOS laisse un
// `fetch` pendre plusieurs minutes, `navigator.onLine` reste vrai).
//
// MESURÉ sur `main` (banc `scripts/bancs/reseau-instable.cjs`, scénario T) :
// `cloudPush` envoyait la ligne `main` sans délai ; une requête tenue laissait
// `_pushEnVol` vrai POUR TOUJOURS — chaque geste suivant était noté « à relancer »
// et ne partait jamais tant que l'app restait ouverte, l'état restait « envoi en
// cours » (la mention « en attente d'envoi » ne s'affichait pas : elle attend un
// échec), et la relecture du nuage (`relireNuage`) attendait elle aussi.
//
// La règle : toute requête d'ÉCRITURE de l'app vers la base (et ses lectures de
// fusion) a une borne. Passée la borne, la requête est ABANDONNÉE et vaut
// « pas su » — jamais « refusé », jamais « enregistré ». Ce qu'elle portait reste
// dans la file d'envoi (src/fileEnvoi.js) ; si le serveur l'avait écrite quand
// même, le comparer-et-échanger sur `data.rev` le voit au rejeu (devancé ⇒
// relecture ⇒ fusion à trois voies ⇒ rien en double).
//
// Et un statut PASSAGER (408, 425, 429, 5xx, aucune réponse) n'est jamais un
// refus : le geste reste à l'écran et sur l'appareil, il repart tout seul.
// (Avant : « la base a répondu 429 » se lisait comme un refus 4xx et la pilule
// « Annuler » DÉFAISAIT le geste — un « Retiré » disparaissait sur une limite de
// débit.)
//
// Module PUR : exécuté tel quel par `scripts/audit-reseau-instable.cjs`.

export const DELAI_ECRITURE_MS = 20000;   // une écriture de la ligne `main` (≈ 100 Ko au plus)
export const DELAI_LECTURE_MS = 15000;    // une lecture de fusion (la ligne entière, ou ses scalaires)
export const DELAI_ROUTE_MS = 30000;      // une route serveur qui écrit (facture : PDF fabriqué côté serveur)

export const NOM_DELAI = 'DelaiReseau';

// `fetch` avec une borne. Rend la réponse, ou rejette (comme une coupure) :
// `err.name === 'DelaiReseau'` quand la borne est passée. Le signal de l'appelant
// (s'il y en a un) est respecté.
export function fetchBorne(fetchFn, url, init = {}, ms = DELAI_LECTURE_MS, minuterie = { poser: (f, d) => setTimeout(f, d), oter: (t) => clearTimeout(t) }) {
  const AC = typeof AbortController === 'function' ? AbortController : null;
  if (!AC) return fetchFn(url, init);
  const ctl = new AC();
  let parDelai = false;
  const t = minuterie.poser(() => { parDelai = true; try { ctl.abort(); } catch (_) {} }, ms);
  const sig = init && init.signal;
  if (sig) { if (sig.aborted) ctl.abort(); else { try { sig.addEventListener('abort', () => ctl.abort(), { once: true }); } catch (_) {} } }
  let p;
  try { p = Promise.resolve(fetchFn(url, { ...(init || {}), signal: ctl.signal })); }
  catch (e) { minuterie.oter(t); return Promise.reject(e); }
  return p.then((r) => { minuterie.oter(t); return r; }, (e) => {
    minuterie.oter(t);
    if (parDelai) { const err = new Error('la base n’a pas répondu à temps'); err.name = NOM_DELAI; throw err; }
    throw e;
  });
}

// Un statut HTTP qui dit « réessaie plus tard », pas « non ». 0 = aucune réponse.
export const statutPassager = (st) => {
  const n = Number(st) || 0;
  return n === 0 || n === 408 || n === 425 || n === 429 || n >= 500;
};

// La phrase de l'échec, pour l'état de la synchronisation (`_emitSync`). Une
// phrase PASSAGÈRE ne contient jamais « refus » ni « répondu 4xx » (la règle de
// `natureEchec`, src/gesteAnnulable.js, qui décide si l'écran revient en arrière).
export const raisonStatut = (st) => {
  const n = Number(st) || 0;
  if (n === 401 || n === 403) return `la base a refusé l'envoi (${n}) — ta session a peut-être expiré`;
  if (n === 429) return 'la base est saturée (429) — nouvel essai automatique';
  if (n === 408 || n === 425) return `la base n’a pas répondu à temps (${n}) — nouvel essai automatique`;
  if (n >= 500) return `la base ne répond pas (${n})`;
  if (n) return `la base a répondu ${n}`;
  return 'la base n’a pas répondu';
};

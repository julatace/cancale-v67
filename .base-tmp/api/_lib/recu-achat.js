// ─────────────────────────────────────────────────────────────────────────────
// LE REÇU D'ACHAT REÇU PAR EMAIL ET SON ACHAT — une règle pour le serveur (qui
// range le n° de transaction) et l'app (qui relie le reçu à l'achat), §11.
// Pure : aucune lecture, aucune écriture.
//
// (29 octobre) Julien : « Essaie pour les achats de mettre en place les factures
// si tu les reçois par mail. » MESURÉ (lecture seule, 117 lignes `email_achat_*`) :
//   · 81 sont des reçus Vinted (« Ton reçu pour la commande « … » »), AUCUN avec
//     un PDF joint (Vinted envoie le reçu dans le corps de l'email) ;
//   · CHACUN porte « *N° de transaction* 12345678901 » — l'astérisque du gras,
//     ENTRE le libellé et le nombre, cassait le motif du serveur : le champ
//     `transaction` est VIDE sur les 117 lignes, et la clé de la ligne est un
//     hachage ;
//   · ce n° est une IDENTITÉ (§5) : 61 des 81 reçus se relient ainsi à un achat
//     capté par l'extension, 0 doublon, aucun reçu relié à deux comptes. Les 20
//     autres ne correspondent à aucun achat capté (comptes plus moissonnés,
//     achat fait d'un de ses comptes à un autre) : ils restent dans l'archive,
//     jamais rattachés au hasard ;
//   · aucun email « facture » d'un autre site (Leboncoin, eBay) n'arrive.
// ⇒ Le n° se lit LIGNE PAR LIGNE, gras retiré, et seulement quand la ligne ne
//   porte QUE lui (« N° de transaction 123… », « Transaction : 123… ») : un
//   nombre au milieu d'une phrase n'est pas un n° de transaction.
// ⇒ Un reçu se relie à un achat par ce n° et RIEN d'autre — jamais le titre,
//   jamais la date (22 % des ventes portent un titre en double, §5).
// ⇒ (revue du 29 oct.) Le serveur range le n° dans `transaction`, mais la
//   ligne garde une clé PAR EMAIL (`email_achat_{empreinte}`) : un second
//   email du même n° (une copie transférée) n'écrase jamais le premier ni son
//   PDF. Les lignes d'un même n° se regroupent ICI, à la lecture.
// ─────────────────────────────────────────────────────────────────────────────

export const TX_RECU = /^(?:n[°º]?\s*de\s+)?transaction\s*:?\s*#?\s*(\d{6,})$/i;

// Les lignes d'un email, gras (`*…*`) et espaces insécables retirés.
export const lignesDuRecu = (texte) => String(texte == null ? '' : texte).replace(/\r/g, '').split('\n')
  .map((l) => l.replace(/\*+/g, ' ').replace(/[\t  ]/g, ' ').replace(/ {2,}/g, ' ').trim());

// Le n° de transaction écrit dans le texte du reçu, ou '' (jamais deviné).
export function transactionDuRecu(texte) {
  for (const l of lignesDuRecu(texte)) {
    const m = l.match(TX_RECU);
    if (m) return m[1];
  }
  return '';
}

// Le n° d'un reçu rangé : celui que le serveur a gardé, sinon celui du texte
// (les 117 lignes d'avant le 29 octobre n'ont que le texte).
export function transactionDeLaLigne(r) {
  const t = String((r && r.transaction) || '').trim();
  if (/^\d{6,}$/.test(t)) return t;
  return transactionDuRecu(r && r.texte);
}

// Index n° de transaction → reçu. Deux lignes pour le MÊME n° (deux emails du
// même reçu : une copie transférée, ou l'email rangé avant et après le
// 29 octobre) sont le même achat — l'identité tient — : on garde celle qui porte un PDF, puis celle
// dont le texte a son « Montant payé », puis la plus récente. `null` (pas su) et
// `undefined` (lecture en cours) donnent un index VIDE : aucun reçu ne se relie
// sur une lecture qui n'a pas eu lieu.
export function indexRecusParTransaction(recus, aSonDetail) {
  const index = new Map();
  if (!Array.isArray(recus)) return index;
  const score = (r) => (r && (r._pdf || r.pdfB64) ? 4 : 0) + (aSonDetail && aSonDetail(r) ? 2 : 0);
  const quand = (r) => { const t = Date.parse(r && r.receivedAt); return Number.isFinite(t) ? t : 0; };
  for (const r of recus) {
    const tx = transactionDeLaLigne(r);
    if (!tx) continue;                       // sans n°, un reçu ne désigne AUCUN achat
    const deja = index.get(tx);
    if (!deja || score(r) > score(deja) || (score(r) === score(deja) && quand(r) > quand(deja))) index.set(tx, r);
  }
  return index;
}

// Le reçu d'un achat : par SON n° de transaction, ou rien. Une commande
// reconstituée d'un email (« mail:… ») n'a pas de n° : rien.
export function recuDeLAchat(achat, index) {
  if (!achat || !index || typeof index.get !== 'function') return null;
  const tx = String(achat.transaction_id == null ? '' : achat.transaction_id).trim();
  if (!/^\d{6,}$/.test(tx)) return null;
  return index.get(tx) || null;
}

// (revue du 29 oct.) CE QUE L'ARCHIVE PEUT DIRE DE SES REÇUS — sans deviner de
// cause. Le premier jet écrivait « (compte pas capté ou masqué) » et « VRM n'a
// pas reçu son reçu » sur une mesure qui n'avait pas eu lieu : un reçu sans n°,
// ou celui d'un compte dont les achats n'ont simplement pas pu être lus.
//   recus    : les reçus (pas un tableau ⇒ null : pas su)
//   txAchats : les n° des achats AFFICHÉS (un Set ; absent ⇒ null : pas su)
//   nonLu(r) : vrai quand le reçu PEUT être celui d'un compte dont les achats
//              n'ont pas pu être lus — on ne le compare à rien (« pas su »).
// Rend { achats : n° DISTINCTS reliés (deux emails d'un même reçu font UN
// achat), lignes : reçus reliés, doublons compris, sansTx : reçus sans n°
// (ils ne désignent aucun achat), absents : n° lu mais aucun achat affiché ne
// le porte, passu : pas comparés }.
export function bilanRecusAchat(recus, txAchats, nonLu) {
  if (!Array.isArray(recus) || !txAchats || typeof txAchats.has !== 'function') return null;
  const achats = new Set();
  let lignes = 0, sansTx = 0, absents = 0, passu = 0;
  for (const r of recus) {
    const tx = transactionDeLaLigne(r);
    if (!tx) { sansTx++; continue; }
    if (txAchats.has(tx)) { achats.add(tx); lignes++; continue; }
    if (typeof nonLu === 'function' && nonLu(r)) { passu++; continue; }
    absents++;
  }
  return { achats: achats.size, lignes, sansTx, absents, passu };
}

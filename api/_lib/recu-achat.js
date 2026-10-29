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

// Index n° de transaction → reçu. Deux lignes pour le MÊME n° (un email reçu
// deux fois : l'ancienne ligne à clé hachée et la nouvelle à clé `{tx}`) sont le
// même achat — l'identité tient — : on garde celle qui porte un PDF, puis celle
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

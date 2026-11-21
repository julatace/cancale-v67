// ════════════════════════════════════════════════════════════════════════════
// LES ANNONCES RETIRÉES D'« EN LIGNE » PAR LES E-MAILS — PAR IDENTITÉ (11 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Revue de robustesse (métier, haute n° 5) : `emailSoldIds` retirait d'« En
// ligne » (et poussait au nuage, `vinted_annonces_email_sold`) les annonces dont
// le TITRE + TAILLE égalait celui d'un e-mail de vente. Une annonce non numérotée
// au même titre ne rendait pas la clé ambiguë ⇒ une paire encore chez lui
// disparaissait d'En ligne (« vendue » déduite d'une ressemblance, §5).
//
// Maintenant, une annonce n'est retirée que par IDENTITÉ :
//   • l'e-mail de vente porte son n° de transaction, et Vinted dit à quelle
//     annonce appartient cette transaction (`itemDeTx`, transaction → item_id) ;
//   • ou un BORDEREAU lui est relié par identité (`bordPour(itemId, numero)` :
//     N° du bordereau = N° de la fiche par `cleNum`, ou transaction → item).
// Une annonce (re)numérotée APRÈS cette vente / ce bordereau est une paire
// republiée, de retour chez lui : on ne la retire pas.
// Sans identité, l'e-mail ne retire rien. Règle PURE (audit-robustesse-metier).
// ─────────────────────────────────────────────────────────────────────────────

const ts = (v) => { const d = new Date(v || 0).getTime(); return Number.isFinite(d) ? d : 0; };

export function venduesParEmail({ enLigne, ventesEmail, itemDeTx = {}, numeros = {}, bordPour = null } = {}) {
  const out = new Set();
  if (!Array.isArray(enLigne)) return out;
  const fiche = (id) => (numeros && numeros[id]) || null;
  const entreeTs = (id) => { const e = fiche(id); return e ? ts(e.repriseAt || e.numberedAt) : 0; };
  const republieeApres = (id, refTs) => { const t = entreeTs(id); return !!(t && refTs && t > refTs); };
  const enLigneIds = new Set(enLigne.filter(Boolean).map((it) => String(it.id)));
  // 1. E-mail de vente → transaction → annonce (Vinted).
  for (const s of (ventesEmail || [])) {
    if (!s) continue;
    const tx = String(s.transaction || s._txMail || '').trim();
    if (!/^\d{6,20}$/.test(tx)) continue;
    const item = itemDeTx && itemDeTx[tx] != null ? String(itemDeTx[tx]) : '';
    if (!item || !enLigneIds.has(item)) continue;
    if (republieeApres(item, ts(s.receivedAt))) continue;
    out.add(item);
  }
  // 2. Bordereau relié par identité.
  if (typeof bordPour === 'function') {
    for (const it of enLigne) {
      if (!it || out.has(String(it.id))) continue;
      const e = fiche(it.id);
      const bord = bordPour(it.id, e && e.numero);
      if (!bord) continue;
      if (republieeApres(it.id, ts(bord.receivedAt))) continue;
      out.add(String(it.id));
    }
  }
  return out;
}

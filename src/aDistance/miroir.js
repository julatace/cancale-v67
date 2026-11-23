// ═══════════════════════════════════════════════════════════════════════════
// LE MIROIR D'UN COMPTE, DANS « MES COMPTES » (22 nov., ext. 5.436) — règles PURES
// ═══════════════════════════════════════════════════════════════════════════
// Ce que l'écran montre d'UN compte (Vinted, Leboncoin, Vestiaire) : ses annonces, ses ventes, ses conversations —
// LU dans SA base (ce que l'extension a capté, avec la date de la lecture), jamais deviné :
//   · les lignes lourdes (`harvest_{uid}_listings` ~30 Ko, `harvest_{uid}_orders_sold` ~30 Ko) sont projetées champ par
//     champ, 20 par page (§4.4 : jamais `select=data`) ;
//   · le N° et le plancher d'une annonce viennent de SA fiche, par IDENTITÉ (l'identifiant de l'annonce Vinted ; la fiche
//     d'un autre compte n'est jamais prise) — jamais par le titre (§5) ;
//   · le plancher : le prix mini, sinon l'achat + 10 % (src/reglesAuto.js `plancherBaisse`, la même règle que la baisse
//     par règle) ; un prix voulu SOUS le plancher n'est pas proposé (il le dit) ; aucune hausse (§3).
// Exécuté par scripts/audit-a-distance.cjs (section O).
// ═══════════════════════════════════════════════════════════════════════════
import { plancherBaisse } from '../reglesAuto.js';

export const MIROIR_N = 15;   // 15 par page : l’adresse projetée reste sous 7 Ko
const num = (v) => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };
const vrai = (v) => v === true || v === 'true';
const ms = (v) => { const t = Date.parse(String(v || '')); return Number.isFinite(t) ? t : null; };

// ── Vinted : les annonces ───────────────────────────────────────────────────
export function selectAnnoncesVinted(debut = 0, n = MIROIR_N) {
  const c = ['cap:data->>capturedAt', 'total:data->>nItems'];
  for (let i = 0; i < n; i++) {
    const k = debut + i, p = `data->payload->items->${k}`;
    c.push(`i${i}:${p}->>id`, `t${i}:${p}->>title`, `s${i}:${p}->>size`, `p${i}:${p}->price->>amount`, `h${i}:${p}->>is_hidden`, `c${i}:${p}->>is_closed`,
      `d${i}:${p}->>is_draft`, `r${i}:${p}->>is_reserved`, `f${i}:${p}->photo->>url`);
  }
  return c.join(',');
}
// `fiches` : `vinted_annonce_numeros` (par identifiant d'annonce) ; `achatParNum` : `vinted_buyprice_by_num`.
export function annoncesVintedDe(row, { uid, debut = 0, n = MIROIR_N, fiches = {}, achatParNum = {} } = {}) {
  if (!row || typeof row !== 'object') return null;
  const items = [];
  let lignes = 0;
  for (let i = 0; i < n; i++) {
    const id = row['i' + i];
    if (!/^\d{4,15}$/.test(String(id == null ? '' : id))) continue;
    lignes++;
    if (vrai(row['c' + i]) || vrai(row['d' + i])) continue;          // vendue / fermée, brouillon : pas une annonce à piloter
    const f0 = fiches && fiches[String(id)];
    const fiche = f0 && typeof f0 === 'object' && (f0.accountId == null || String(f0.accountId) === String(uid)) ? f0 : null;
    const pl = fiche ? plancherBaisse(fiche, achatParNum) : null;
    items.push({ id: String(id), titre: String(row['t' + i] || '').slice(0, 120), taille: String(row['s' + i] || '').slice(0, 20), prix: num(row['p' + i]),
      etat: vrai(row['h' + i]) ? 'masquee' : vrai(row['r' + i]) ? 'reservee' : 'enligne', photo: /^https:\/\/[^\s]+$/.test(String(row['f' + i] || '')) ? String(row['f' + i]) : '',
      num: fiche && fiche.numero != null ? String(fiche.numero).slice(0, 12) : '', plancher: pl ? { c: pl.c, de: pl.de } : null });
  }
  const total = num(row.total);
  return { capte: ms(row.cap), items, suite: lignes === n && (total == null || debut + n < total), total };
}

// ── Vinted : les ventes ─────────────────────────────────────────────────────
export function selectVentesVinted(debut = 0, n = MIROIR_N) {
  const c = ['cap:data->>capturedAt'];
  for (let i = 0; i < n; i++) {
    const k = debut + i, p = `data->payload->my_orders->${k}`;
    c.push(`x${i}:${p}->>transaction_id`, `t${i}:${p}->>title`, `s${i}:${p}->>status`, `u${i}:${p}->>transaction_user_status`, `p${i}:${p}->price->>amount`,
      `d${i}:${p}->>date`, `f${i}:${p}->photo->>url`, `v${i}:${p}->>conversation_id`);
  }
  return c.join(',');
}
const TERMINEE = /finalis|termin|compl[ée]t|annul|rembours|cancel/i;
// `aExpedier(o)` : LA règle de l'app (src/App.jsx, la même que l'extension et le widget), donnée par l'écran.
export function ventesVintedDe(row, { n = MIROIR_N, aExpedier = () => false } = {}) {
  if (!row || typeof row !== 'object') return null;
  const ventes = [];
  let lignes = 0;
  for (let i = 0; i < n; i++) {
    const tx = row['x' + i];
    if (!/^\d{1,20}$/.test(String(tx == null ? '' : tx))) continue;
    lignes++;
    const o = { transaction_id: String(tx), status: String(row['s' + i] || ''), transaction_user_status: String(row['u' + i] || '') };
    let envoyer = false; try { envoyer = !!aExpedier(o); } catch (_) { envoyer = false; }
    const groupe = envoyer ? 'envoyer' : (o.transaction_user_status === 'completed' || TERMINEE.test(o.status)) ? 'terminees' : 'route';
    ventes.push({ tx: String(tx), titre: String(row['t' + i] || '').slice(0, 120), statut: o.status.slice(0, 80), prix: num(row['p' + i]), date: ms(row['d' + i]),
      photo: /^https:\/\/[^\s]+$/.test(String(row['f' + i] || '')) ? String(row['f' + i]) : '', conv: /^\d{1,20}$/.test(String(row['v' + i] || '')) ? String(row['v' + i]) : '', groupe });
  }
  return { capte: ms(row.cap), ventes, suite: lignes === n };
}

// ── Leboncoin et Vestiaire ──────────────────────────────────────────────────
const sansPrefixe = (x) => String(x == null ? '' : x).replace(/^lbc-account:/i, '');
// Les annonces Leboncoin ne portent pas leur compte : sous UN compte relié, elles sont à lui ; sous plusieurs, on ne SAIT
// pas à qui est chacune ⇒ `null` (l'écran le dit), jamais un partage au hasard.
export function annoncesLbcDe(items, { nComptes = 1 } = {}) {
  if (!items || typeof items !== 'object') return null;
  if (nComptes !== 1) return { inconnu: true, items: [] };
  const l = [];
  for (const [id, a] of Object.entries(items)) {
    if (!a || !/^\d{6,12}$/.test(String(id)) || a.status === 'deleted') continue;
    const prix = num(a.price);
    const img = Array.isArray(a.images) ? a.images.find((u) => typeof u === 'string' && /^https:\/\//.test(u)) : '';
    l.push({ id: String(id), titre: String(a.subject || '').slice(0, 120), prix, etat: a.status === 'paused' || a.status === 'disabled' ? 'pause' : a.status === 'expired' ? 'expiree' : 'enligne',
      photo: img || '', num: a.ref != null ? String(a.ref).slice(0, 12) : '', vu: ms(a.seenAt) });
  }
  return { items: l.sort((a, b) => (b.vu || 0) - (a.vu || 0)) };
}
export function annoncesVcDe(items, { compte } = {}) {
  if (!items || typeof items !== 'object') return null;
  const l = [];
  for (const [id, a] of Object.entries(items)) {
    if (!a || !/^\d{3,15}$/.test(String(id)) || String(a.compte || '') !== String(compte)) continue;
    l.push({ id: String(id), titre: String(a.titre || '').slice(0, 120), prix: num(a.prix), etat: /pause|retir|hors/i.test(String(a.statut || '')) ? 'pause' : 'enligne',
      photo: /^https:\/\//.test(String(a.photo || '')) ? String(a.photo) : '', num: a.ref != null ? String(a.ref).slice(0, 12) : '', vu: num(a.vuAt) || ms(a.vuAt) });
  }
  return { items: l.sort((a, b) => (b.vu || 0) - (a.vu || 0)) };
}
// Les conversations d'un compte Leboncoin (`lbc_fil_*`, scalaires de `meta`) : le compte du FIL, par identité.
export function filsLbcDe(rows, compte) {
  if (!Array.isArray(rows)) return null;
  return rows.filter((x) => x && Number(x.n) > 0 && sansPrefixe(x.compte) === sansPrefixe(compte))
    .map((x) => ({ id: String(x.id || '').replace(/^lbc_fil_/, ''), texte: String(x.ap || '').slice(0, 160), at: ms(x.da), nonLu: x.dm === 'false' || x.dm === false, qui: '' }))
    .filter((x) => /^[\w-]{3,64}$/.test(x.id)).sort((a, b) => (b.at || 0) - (a.at || 0));
}
// Vestiaire : le compte vient de la LISTE des conversations (`vc_messages.conversations[conv].compte`).
export function filsVcDe(rows, convs, compte) {
  if (!Array.isArray(rows)) return null;
  const c = convs && typeof convs === 'object' ? convs : {};
  const out = [];
  const vus = new Set();
  for (const x of rows) {
    const id = String((x && x.id) || '').replace(/^vc_fil_/, ''); const v = c[id] || {};
    if (!/^[\w-]{3,40}$/.test(id) || String(v.compte || '') !== String(compte)) continue;
    vus.add(id);
    out.push({ id, texte: String(x.ap || v.apercu || '').slice(0, 160), at: ms(x.da) || ms(v.date), nonLu: v.nonLu === true, qui: String(v.titre || '').slice(0, 80) });
  }
  for (const [id, v] of Object.entries(c)) if (!vus.has(id) && v && String(v.compte || '') === String(compte) && /^[\w-]{3,40}$/.test(id)) out.push({ id, texte: String(v.apercu || '').slice(0, 160), at: ms(v.date), nonLu: v.nonLu === true, qui: String(v.titre || '').slice(0, 80) });
  return out.sort((a, b) => (b.at || 0) - (a.at || 0));
}
// Un fil Leboncoin / Vestiaire (`messages` : { t, at, deMoi }).
export function filAutreDe(messages) {
  if (!Array.isArray(messages)) return null;
  return messages.slice(-60).map((m, i) => ({ sorte: 'message', id: String(i), texte: String((m && m.t) || '').slice(0, 2000), moi: !!(m && m.deMoi === true), at: num(m && m.at) || ms(m && m.at) }));
}

// ── Changer le prix : ce que la feuille accepte ─────────────────────────────
// { ok, c } ou { raison } — 'illisible' · 'hausse' (≥ le prix vu) · 'plancher' (sous le prix mini / l'achat + 10 %) · 'minimum' (< 1 €).
export function prixVoulu(saisie, { prix, plancher = null } = {}) {
  const t = String(saisie == null ? '' : saisie).replace(/\s|€/g, '').replace(',', '.');
  const v = Number(t);
  if (!t || !Number.isFinite(v)) return { raison: 'illisible' };
  const c = Math.round(v * 100);
  if (c < 100) return { raison: 'minimum' };
  const avantC = Math.round(Number(prix) * 100);
  if (!Number.isFinite(avantC) || c >= avantC) return { raison: 'hausse' };
  if (plancher && Number.isInteger(plancher.c) && c < plancher.c) return { raison: 'plancher', plancherC: plancher.c };
  return { ok: true, c };
}

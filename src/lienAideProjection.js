// ── LA PROJECTION DU LIEN D'AIDE (14 nov., lot 120) — la LISTE BLANCHE, une seule fois ──
// La même fonction dans l'app (qui la fabrique depuis la photo de Ma journée,
// src/journeeHorsLigne.js) et dans le serveur (api/_lib/lien-aide.js, qui la refiltre
// à l'écriture ET à la lecture). Aucun import : le navigateur et Node la chargent tels quels.
// Ce qui sort : colis à envoyer (N°, titre, date limite, heure, transporteur, plateforme,
// lignes de bordereau), colis à retirer (titre, lieu, code, QR https, transporteur,
// date limite, n° de suivi). JAMAIS un montant (même glissé dans un titre), un compte,
// un message, une adresse d'acheteur, un réglage.
export const MAX_LIGNES = 80;
export const PDF_OK = /^(email_bord_\d{4,20}|harvest_\d{1,20}_label_\d{4,20})$/;
// Un montant ne passe JAMAIS, même glissé dans un titre (« Air Max 90 € »).
const SANS_MONTANT = /(?:\d[\d\s.,]*\s?(?:€|eur\b|euros?\b|\$|£))|(?:(?:€|\$|£)\s?\d[\d\s.,]*)/gi;
export const txtSansMontant = (v, n = 90) => String(v == null ? '' : v).replace(SANS_MONTANT, '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const jour = (j) => (/^\d{4}-\d{2}-\d{2}$/.test(String(j || '').slice(0, 10)) ? String(j).slice(0, 10) : '');
const heure = (h) => (/^\d{2}:\d{2}$/.test(String(h || '')) ? String(h) : '');
const qr = (q) => { const t = String(q || ''); return /^https:\/\/[^\s<>"']{4,1500}$/i.test(t) ? t : ''; };
const code = (c) => String(c == null ? '' : c).replace(/[^A-Za-z0-9 -]/g, '').trim().slice(0, 16);

// LA PROJECTION — liste blanche, champ par champ. Rien d'autre ne sort.
export function projectionLienAide(photo, maintenant = Date.now()) {
  const p = photo && typeof photo === 'object' ? photo : {};
  const envoyer = (Array.isArray(p.envoyer) ? p.envoyer : []).slice(0, MAX_LIGNES).map((e) => ({
    numero: txtSansMontant(e && e.numero, 12), titre: txtSansMontant(e && e.titre), limite: jour(e && (e.jour || e.limite)), heure: heure(e && e.heure),
    plateforme: e && e.plateforme === 'ebay' ? 'ebay' : 'vinted', transporteur: txtSansMontant(e && (e.trNom || e.transporteur), 30),
    pdf: (Array.isArray(e && e.pdf) ? e.pdf : []).map(String).filter((r) => PDF_OK.test(r)).slice(0, 2),
  }));
  const retirer = (Array.isArray(p.retirer) ? p.retirer : []).slice(0, MAX_LIGNES).map((r) => ({
    titre: txtSansMontant(r && r.titre), lieu: txtSansMontant(r && r.lieu, 120), code: code(r && r.code), qr: qr(r && r.qr),
    transporteur: txtSansMontant(r && r.transporteur, 30), limite: jour(r && r.limite), suivi: String((r && r.suivi) || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40),
  }));
  const at = Number.isFinite(p.at) ? p.at : maintenant;
  return { v: 1, at, envoyer, retirer, nEnvoyer: Number.isFinite(p.nEnvoyer) ? p.nEnvoyer : envoyer.length, nRetirer: Number.isFinite(p.nRetirer) ? p.nRetirer : retirer.length };
}


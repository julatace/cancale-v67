// ═══════════════════════════════════════════════════════════════════════════
// « TÉLÉCHARGER MES ANNONCES » — UNE COPIE PAR COMPTE (12 nov., validé par Julien)
// ═══════════════════════════════════════════════════════════════════════════
// Si Vinted ferme un compte, ses annonces partent avec. Un zip, fait DANS le
// navigateur (rien n'est envoyé à un serveur), qui se dézippe en UN dossier :
//   VRM-annonces-<pseudo>-<AAAA-MM-JJ>/
//     annonces.csv      N°, titre, prix, état, description, lien, photos (une ligne par annonce)
//     LISEZ-MOI.txt     ce qui est dedans, et ce qui MANQUE (nommé, jamais tu)
//     photos/           N°12-1.jpg … (ou l'identifiant de l'annonce sans N°)
// Lecture seule : ce que l'app a déjà (le dressing lu par l'extension, les N° posés
// par identifiant d'annonce `vinted_annonce_numeros`), les photos que le navigateur
// peut lire. Une description que VRM n'a pas lue reste vide et c'est DIT (« pas su »
// ≠ « rien »). Règle PURE, exécutée par scripts/audit-copie-annonces.cjs.

export const slugCompte = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'compte';
const jourIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dossierCopie = (login, quand = new Date()) => `VRM-annonces-${slugCompte(login)}-${jourIso(quand)}`;
export const nomZipCopie = (login, quand = new Date()) => `${dossierCopie(login, quand)}.zip`;

// Le prix Vinted est un OBJET `{ amount, currency_code }` (ou un nombre, ou une chaîne).
export function prixAnnonce(p) {
  const v = p && typeof p === 'object' ? p.amount : p;
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
export const urlsPhotos = (it) => {
  const out = [];
  const ajoute = (ph) => { const u = ph && typeof ph === 'object' ? (ph.full_size_url || ph.url) : (typeof ph === 'string' ? ph : null); if (typeof u === 'string' && /^https:\/\//.test(u) && !out.includes(u)) out.push(u); };
  if (Array.isArray(it && it.photos)) it.photos.forEach(ajoute);
  else if (it && it.photo) ajoute(it.photo);
  return out.slice(0, 20);
};
export const etatAnnonce = (it, aConfirmer) => (aConfirmer ? 'à confirmer' : it && it.is_closed ? 'fermée' : it && it.is_hidden ? 'masquée' : it && it.is_draft ? 'brouillon' : 'en ligne');

// Les annonces du compte : en ligne d'abord, puis le reste ; une annonce une fois (par identifiant).
export function annoncesDuCompte(dressing, fiches = {}) {
  const vus = new Set(); const out = [];
  const pose = (it, aConfirmer) => {
    const id = it && it.id != null ? String(it.id) : '';
    if (!/^\d{1,20}$/.test(id) || vus.has(id)) return;
    vus.add(id);
    const f = fiches && fiches[id];
    out.push({
      id, numero: f && f.numero != null && String(f.numero).trim() ? String(f.numero).trim() : '',
      titre: typeof it.title === 'string' ? it.title : '',
      description: typeof it.description === 'string' ? it.description : null,   // null = pas lue
      prix: prixAnnonce(it.price != null ? it.price : it.price_numeric),
      devise: (it.price && typeof it.price === 'object' && it.price.currency_code) || 'EUR',
      etat: etatAnnonce(it, aConfirmer),
      lien: typeof it.url === 'string' && /^https:\/\/www\.vinted\./.test(it.url) ? it.url : `https://www.vinted.fr/items/${id}`,
      photos: urlsPhotos(it),
    });
  };
  const items = Array.isArray(dressing && dressing.items) ? dressing.items : [];
  items.filter((it) => !(it && it.is_closed)).forEach((it) => pose(it, false));
  (Array.isArray(dressing && dressing._vrmAConfirmer) ? dressing._vrmAConfirmer : []).forEach((it) => pose(it, true));
  items.filter((it) => it && it.is_closed).forEach((it) => pose(it, false));
  return out;
}

const cellule = (v) => { const s = v == null ? '' : String(v); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const prixTexte = (p) => (p == null ? '' : p.toFixed(2).replace('.', ','));
export const nomPhoto = (a, i) => `${a.numero ? 'N' + slugCompte(a.numero) : a.id}-${i + 1}.jpg`;

// → { fichiers: [{ nom, texte|octets }], resume } ; `photos` : Map(url → Uint8Array) déjà lues.
export function fichiersCopie({ login, annonces, photos = new Map(), quand = new Date(), lu = null }) {
  const dossier = dossierCopie(login, quand);
  const fichiers = [];
  let nPhotos = 0, nManquees = 0, nDesc = 0;
  const lignes = [['N°', 'Titre', 'Prix', 'Devise', 'État', 'Description', 'Lien', 'Photos'].join(';')];
  for (const a of annonces) {
    const noms = [];
    a.photos.forEach((u, i) => { const o = photos.get(u); if (o instanceof Uint8Array && o.length) { const n = nomPhoto(a, i); noms.push(n); fichiers.push({ nom: `${dossier}/photos/${n}`, octets: o }); nPhotos++; } else nManquees++; });
    if (a.description != null) nDesc++;
    lignes.push([a.numero, a.titre, prixTexte(a.prix), a.devise, a.etat, a.description == null ? '' : a.description, a.lien, noms.join(' ')].map(cellule).join(';'));
  }
  const n = annonces.length;
  const lisez = [
    `Copie de tes annonces Vinted — compte ${login || '—'}`,
    `Faite le ${quand.toLocaleDateString('fr-FR')} par VRM, dans ton navigateur. Rien n'a été envoyé ailleurs.`,
    lu ? `Annonces telles que lues par l'extension le ${new Date(lu).toLocaleDateString('fr-FR')}.` : 'Date de lecture des annonces : pas sue.',
    '',
    `Annonces : ${n}`,
    `Photos jointes : ${nPhotos}${nManquees ? ` (${nManquees} pas lisibles d'ici : leur lien reste sur Vinted)` : ''}`,
    `Descriptions : ${nDesc} sur ${n}${nDesc < n ? ' (les autres n\'ont pas été lues par VRM : la colonne est vide)' : ''}`,
    '',
    'annonces.csv s\'ouvre avec Excel, Numbers ou LibreOffice (séparateur « ; »).',
  ].join('\r\n');
  fichiers.unshift({ nom: `${dossier}/LISEZ-MOI.txt`, texte: lisez }, { nom: `${dossier}/annonces.csv`, texte: '﻿' + lignes.join('\r\n') });
  return { fichiers, resume: { annonces: n, photos: nPhotos, photosManquees: nManquees, descriptions: nDesc, dossier } };
}

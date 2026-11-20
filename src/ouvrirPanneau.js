// 5.410 — décision de Julien du 20 nov. : « toute action doit être faite dans l'extension, on ne doit plus pouvoir
// faire d'action dans l'app ». L'app n'AGIT plus sur Vinted / Leboncoin / Vestiaire : elle OUVRE le panneau de
// l'extension sur le site, à la bonne page, la sélection pré-cochée et l'action pré-choisie. Rien ne part sans le
// toucher de confirmation de Julien DANS le panneau (les garde-fous de l'extension restent les seuls chemins d'écriture).
//
// Contrat (le même que le lecteur de l'extension, `lireLienPanneau` dans vinted-sync-extension/vrm-badge.js,
// tenu par scripts/audit-lien-panneau.cjs) :
//   https://www.vinted.fr/?vrm=panneau&page=<page>&ids=<id1,id2>&action=<action>
//   (même chose sur https://www.leboncoin.fr/ et https://www.vestiairecollective.com/)

export const SITES_PANNEAU = Object.freeze({
  vinted: 'https://www.vinted.fr/',
  leboncoin: 'https://www.leboncoin.fr/',
  vestiaire: 'https://www.vestiairecollective.com/',
});

export const PAGES_PANNEAU = Object.freeze(['accueil', 'articles', 'commandes', 'messagerie', 'notifications', 'automatisations', 'favoris', 'republier', 'prix', 'publier', 'parametres']);

export const ACTIONS_PANNEAU = Object.freeze(['baisser', 'masquer', 'afficher', 'republier', 'favoris', 'ouvrir', 'offre', 'repondre', 'publier']);

const ID_SUR = /^[\w-]{1,40}$/;
export const MAX_IDS_PANNEAU = 50;

// Rend le lien, ou null si le site n'est pas connu (jamais un lien vers un autre domaine).
// Une page inconnue devient « accueil » ; une action inconnue est retirée ; un identifiant qui n'est pas sûr est écarté
// (le lecteur de l'extension l'écarterait aussi : mieux vaut un panneau sans pré-sélection qu'une pré-sélection fausse).
export function lienPanneau({ site = 'vinted', page = 'accueil', ids = [], action = '' } = {}) {
  const base = SITES_PANNEAU[String(site || '').toLowerCase()];
  if (!base) return null;
  const p = PAGES_PANNEAU.includes(String(page || '').toLowerCase()) ? String(page).toLowerCase() : 'accueil';
  const q = new URLSearchParams();
  q.set('vrm', 'panneau');
  q.set('page', p);
  const liste = (Array.isArray(ids) ? ids : [ids]).map((x) => String(x == null ? '' : x).trim()).filter((x) => ID_SUR.test(x));
  const uniques = [...new Set(liste)].slice(0, MAX_IDS_PANNEAU);
  if (uniques.length) q.set('ids', uniques.join(','));
  const a = String(action || '').toLowerCase();
  if (ACTIONS_PANNEAU.includes(a)) q.set('action', a);
  return base + '?' + q.toString().replace(/%2C/g, ',');
}

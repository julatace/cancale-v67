// ── L'ADRESSE DE CONTACT DE VRM — UNE SEULE SOURCE POUR L'APP ───────────────
// Lue par la page d'accueil publique (src/Accueil.jsx) et par Réglages → Mon
// compte (src/App.jsx). Ouvrir VRM à d'autres revendeurs demande un moyen de
// joindre quelqu'un — et la politique de confidentialité y renvoie pour
// exercer ses droits.
//
// ⚠️ ELLE N'EXISTE PAS ENCORE, ET ON NE L'INVENTE PAS (§2.3, §5 : mieux vaut
//    un blanc qu'un faux). Tant qu'elle est vide, les deux écrans écrivent
//    « adresse de contact à venir » — jamais une adresse devinée qui ne
//    recevrait rien.
// ⚠️ GESTE DE JULIEN : la remplir ICI **et** dans `public/legal/editeur.js`
//    (champ `email`, lu par les cinq pages légales, qui ne peuvent pas importer
//    ce fichier). `scripts/audit-lancement.cjs` exige que les deux disent la
//    même chose : une adresse sur les pages légales et une autre dans l'app
//    serait deux réponses à « comment vous joindre ? ».
export const CONTACT_EMAIL = '';

export const CONTACT_A_VENIR = 'adresse de contact à venir';
const FORME = /^[^@\s<>"']+@[^@\s<>"']+\.[^@\s<>"']+$/;
// L'adresse, si elle est posée ET bien formée ; sinon '' (l'écran dit « à venir »).
export const contactEmail = () => (FORME.test(String(CONTACT_EMAIL).trim()) ? String(CONTACT_EMAIL).trim() : '');

// (16 nov., lot traduction-restes) « Quoi de neuf » : le français EST celui de src/nouveautes.js
// (une seule source ; la clé de chaque nouveauté : `qdn.n.<id>.titre` / `.phrase`). Les quatre autres
// langues : src/i18n/langues/<l>/nouveautes.js — une nouveauté ajoutée sans sa traduction rougit
// `audit-traduction` (D2).
import { NOUVEAUTES } from '../../../nouveautes.js';
export default Object.fromEntries(NOUVEAUTES.flatMap((n) => [[`qdn.n.${n.id}.titre`, n.titre], [`qdn.n.${n.id}.phrase`, n.phrase]]));

// (3 nov.) La forme COURTE d'une ligne « À faire » de Ma journée (maquette FusionJournee).
// Julien, sur ordinateur : « j'aime pas trop cet endroit » — trop de phrases, du jargon,
// « paires » (il vend aussi des sacs). Un titre court, une sous-ligne courte ; la phrase
// entière reste dans l'infobulle et le nom du bouton. Aucune règle, aucun compteur, aucune
// cible ne change : seulement les mots affichés. Vérifié par scripts/audit-journee-court.cjs.
export const enArticles = (t) => String(t || '')
  .replace(/\bla paire\b/g, "l'article").replace(/\bune paire\b/g, 'un article')
  .replace(/\bpaires\b/g, 'articles').replace(/\bpaire\b/g, 'article');
export const courtFusion = (j) => {
  const n = Number(j.n) || 0, s = n > 1 ? 's' : '';
  const t = String(j.title || '');
  const nums = (t.match(/N°[\w-]+/g) || []).slice(0, 3);
  if (j.id === 'numeros-en-double') return { court: `${n} numéro${s} en double`, detail: ((String(j.sub || '').match(/N°[\w-]+/g) || []).slice(0, 4)).join(', ') };
  if (j.id === 'double-vente') {
    if (/numéro/.test(t)) return { court: `${n} numéro${s} en double`, detail: nums.join(', ') };
    const m = /à (retirer|annuler)(?: de | d'| )?(Leboncoin|Vinted|Vestiaire|eBay)?/.exec(t);
    const ou = /vendue?s? (sur (?:Leboncoin|Vinted|Vestiaire|eBay)|ailleurs)/.exec(t);
    if (m) {
      const plat = m[2] || (/eBay/.test(t) ? 'eBay' : '');
      const verbe = m[1] === 'annuler' ? `à annuler sur ${plat || 'eBay'}` : `à retirer ${plat === 'eBay' ? "d'eBay" : 'de ' + plat}`;
      return { court: `${n} annonce${s} ${verbe}`, detail: [nums.join(', '), ou ? `vendu${s} ${ou[1]}` : ''].filter(Boolean).join(' · ') };
    }
  }
  if (j.id === 'vestiaire-envoyer') return { court: n > 1 ? `${n} ventes Vestiaire à envoyer` : 'Vente Vestiaire à envoyer', detail: /passée/.test(j.sub || '') ? 'Date limite passée' : /demain/.test(j.sub || '') ? "À envoyer d'ici demain" : 'Bordereau sur Vestiaire' };
  if (j.id === 'emails-personne') { const k = (/(\d+)/.exec(t) || [])[1]; return { court: k ? `${k} e-mail${Number(k) > 1 ? 's' : ''} à trier` : 'E-mails à trier', detail: 'Déclare tes adresses' }; }
  { const m = /(\d+) paires? à regarder pour eBay/.exec(t); if (m) return { court: `${m[1]} article${Number(m[1]) > 1 ? 's' : ''} pour eBay`, detail: '' }; }
  return null;
};

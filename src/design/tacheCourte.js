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
  // (3 nov.) Une ligne de « À faire » tient sur une ligne au téléphone (banc journee-mieux B) :
  // « Vérifier 1 colis coché « posté » » ⇒ « 1 dépôt à vérifier » ; « Déclarer l'URSSAF d'octobre »
  // ⇒ « URSSAF d'octobre » (le geste « Noter » est à côté).
  if (j.id === 'poste-sans-depart') return { court: `${n} dépôt${s} à vérifier`, detail: String(j.sub || '').split(' — ')[0] };
  if (j.urssaf && /^Déclarer l'URSSAF /.test(String(j.court || ''))) return { court: String(j.court).replace(/^Déclarer l'/, ''), detail: j.detail || '' };
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

// (3 nov., critique #11) La pastille porte le nombre : le titre ne le redit pas
// (« 1 » + « 1 vente Vestiaire à envoyer » ⇒ « Vente Vestiaire à envoyer »). Seulement
// quand le titre COMMENCE par ce même nombre ; sinon rien ne change.
export const titreSansNombre = (court, n) => {
  const t = String(court || '');
  if (!(Number(n) > 0)) return t;
  const m = new RegExp('^' + Number(n) + '\\s+(.+)$').exec(t);
  if (!m) return t;
  return m[1].charAt(0).toUpperCase() + m[1].slice(1);
};

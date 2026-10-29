// ── MESSAGE ET OFFRE DES FAVORIS, INSPIRÉS DE VINTEX (29 octobre) ─────────
// Julien, captures de Vintex à l'appui : « inspire-toi si tu trouves ça bien ».
// Repris : les variables du message ({username}, {a|b} variante) et l'offre
// « Diminuer (% ou €) / Fixer à », avec arrondi.
// ⚠️ Ce bloc est RECOPIÉ dans l'extension (background.js, entre les balises
// <favoris-message-regle>) : le test `favoris-message.test.mjs` exige les deux
// copies identiques. Changer l'une sans l'autre le rend rouge.
// <favoris-message-regle>
function erreurVariablesFavori(modele) {
  const texte = String(modele || '');
  const reste = texte.replace(/\{([^{}]*)\}/g, (tout, dedans) => {
    if (dedans === 'username') return '';
    const options = dedans.split('|');
    if (options.length >= 2 && options.every((o) => o.length <= 200)) return '';
    return '\u0000' + tout + '\u0000';
  });
  const inconnue = /\u0000(\{[^{}]*\})\u0000/.exec(reste);
  if (inconnue) return 'Variable inconnue : ' + inconnue[1].slice(0, 40) + '. Utilise {username} ou {a|b} (au moins deux choix séparés par |).';
  if (/[{}]/.test(reste)) return 'Une accolade n’est pas fermée. Utilise {username} ou {a|b}.';
  return '';
}
function personnaliserMessageFavori(modele, pseudo, hasard) {
  const tirer = typeof hasard === 'function' ? hasard : Math.random;
  const nom = typeof pseudo === 'string' ? pseudo.replace(/[{}\s]+/g, ' ').trim().slice(0, 80) : '';
  return String(modele || '')
    .replace(/\{([^{}]*)\}/g, (tout, dedans) => {
      if (dedans === 'username') return nom;
      const options = dedans.split('|');
      if (options.length < 2) return tout;
      return options[Math.min(options.length - 1, Math.floor(tirer() * options.length))];
    })
    .split('\n').map((l) => l.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.])/g, '$1').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}
// Le prix de l'offre, au centime, comme Vinted l'écrit (« 45.00 ») ; jamais ≥ au
// prix de l'annonce, jamais sous 1 €. offre = {mode:'pct'|'euros'|'prix', valeur, arrondi}.
function prixOffreFavori(montant, offre) {
  const m = Number(montant);
  if (!(isFinite(m) && m > 0) || !offre || typeof offre !== 'object') return null;
  const base = Math.round(m * 100), v = Number(offre.valeur);
  let c;
  if (offre.mode === 'pct') { if (!(Number.isInteger(v) && v >= 1 && v <= 99)) return null; c = Math.round(base * (100 - v) / 100); }
  else if (offre.mode === 'euros') { if (!(isFinite(v) && v > 0)) return null; c = base - Math.round(v * 100); }
  else if (offre.mode === 'prix') { if (!(isFinite(v) && v > 0)) return null; c = Math.round(v * 100); }
  else return null;
  if (offre.arrondi === true) c = Math.floor(c / 100) * 100;
  if (c < 100 || c >= base) return null;
  return (c / 100).toFixed(2);
}
// </favoris-message-regle>
export { erreurVariablesFavori, personnaliserMessageFavori, prixOffreFavori };
export const aDesVariablesFavori = (m) => /[{}]/.test(String(m || ''));

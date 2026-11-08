// ── LE BÉNÉFICE BRUT, CÔTÉ SERVEUR — UN MIROIR, PAS UNE COPIE (8 nov.) ────────
// Le bilan du mois par e-mail (api/_lib/bilan-mois.js) cumule la publication de
// l'écran Ventes (`vrm_benefice_jours`) avec la règle de l'APP (§11).
// ⚠️ NE RIEN MODIFIER ICI À LA MAIN : modifier App.jsx, puis refabriquer ce
//    fichier avec `node scripts/audit-bilan-mois.cjs --recopie` — l'audit exige
//    que chaque déclaration soit celle d'App.jsx au jeton près, puis les exécute.
/* eslint-disable */
export const jourClef = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

export const BENEF_CHAMPS = ['n', 'ca', 'frais', 'nCout', 'cout', 'caCouvert', 'fraisCouverts', 'fraisInconnus', 'nL', 'nCoutL', 'nE', 'nCoutE'];

export const beneficeVide = () => ({ n: 0, ca: 0, frais: 0, nCout: 0, cout: 0, caCouvert: 0, fraisCouverts: 0, fraisInconnus: 0, nL: 0, nCoutL: 0, nE: 0, nCoutE: 0 });

export const cumulerBenefice = (acc, b) => {
  if (!b) return acc;
  BENEF_CHAMPS.forEach((k, i) => { acc[k] = (acc[k] || 0) + (Number(Array.isArray(b) ? b[i] : b[k]) || 0); });
  return acc;
};

export const resumeBenefice = (acc) => {
  const brut = acc.caCouvert - acc.cout, fi = acc.fraisInconnus || 0;
  const net = fi > 0 ? null : (brut - acc.fraisCouverts) / 100;
  const nL = acc.nL || 0, nE = acc.nE || 0, nCoutL = acc.nCoutL || 0, nCoutE = acc.nCoutE || 0;
  return { n: acc.n, nCout: acc.nCout, ca: acc.ca / 100, frais: acc.frais / 100, cout: acc.cout / 100,
    caCouvert: acc.caCouvert / 100, fraisCouverts: acc.fraisCouverts / 100, brut: brut / 100, net, fraisInconnus: fi,
    par: { Vinted: { n: acc.n - nL - nE, nCout: acc.nCout - nCoutL - nCoutE }, Leboncoin: { n: nL, nCout: nCoutL }, eBay: { n: nE, nCout: nCoutE } } };
};

export const beneficeDesJours = (jours, de, a) => {
  const acc = beneficeVide();
  const k0 = jourClef(de), k1 = jourClef(a);
  for (const [k, b] of Object.entries(jours || {})) if (k >= k0 && k < k1) cumulerBenefice(acc, b);
  return resumeBenefice(acc);
};

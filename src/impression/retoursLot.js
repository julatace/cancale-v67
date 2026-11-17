// (16 nov. 2026, lot impression-retours) LES BORDEREAUX DE RETOUR DANS « IMPRIMER ».
// Julien : « Les colis imprimés tu peux mettre le retour, mais il faut bien préciser que c'est un retour et
// pas une vente. » Un retour = un ACHAT qu'il renvoie (e-mail « Bordereau de retour », ligne
// `email_bordretour_{tx}`, carte de `retoursAchat`). Il part dans le MÊME PDF que les envois de ventes, mais :
//   · sa ligne porte `retour: true`, `site: 'retour'`, la clé `r:{n° de transaction}` (identité : le n° seul) ;
//   · il n'entre JAMAIS dans « à envoyer », « N colis à envoyer », ni le nombre du bouton (`resumeLot` des ventes) :
//     il est compté à part (« + N retours », « dont N retours ») ;
//   · son PDF porte le cartouche RETOUR (mot en grand, cadre noir), jamais le tampon d'une vente.
// Pur : aucune lecture, aucun `tr` importé (les mots sont passés par l'appelant).

const str = (x) => (x == null ? '' : String(x));

// Les retours qui partent à l'impression : un PDF, pas remboursé, encore à DÉPOSER, jamais contredit par une
// vente (même règle que la section « Retours » d'avant). `imprimes` : { [cle]: iso } (déjà imprimés sur cet appareil).
export function lignesRetoursLot(res, { imprimes = {}, vendeurDe = null } = {}) {
  if (!res || res.etat !== 'lu' || !Array.isArray(res.cartes)) return [];
  const L = [], vus = new Set();
  for (const c of res.cartes) {
    const tx = str(c && c.tx).trim();
    if (!tx || vus.has(tx) || !c.pdf || c.contredit || (c.rembourse && c.rembourse.etat === 'oui') || c.etape !== 'a-deposer') continue;
    vus.add(tx);
    const cle = 'r:' + tx;
    let vendeur = '';
    if (typeof vendeurDe === 'function' && c.achat) { try { vendeur = str(vendeurDe(c.achat)).trim(); } catch (_) { vendeur = ''; } }
    L.push({
      cle, site: 'retour', retour: true, pdf: true, cochable: true, imprime: !!(imprimes && imprimes[cle]),
      tx, num: str(c.num).trim(), titre: str(c.titre).trim(), photo: c.photo || null, suivi: str(c.suivi),
      limiteIso: c.limiteIso || null, presse: !!c.presse, depassee: !!c.depassee, vendeur, pdfGarde: c.pdfGarde || '', carte: c,
    });
  }
  return L;
}

export const estRetour = (l) => !!(l && (l.retour === true || l.site === 'retour'));

// Ce qui part, séparé : les VENTES (le nombre du bouton, d'« à envoyer ») et les RETOURS (« + N retours »).
export function compterLot(lignes) {
  let ventes = 0, retours = 0;
  for (const l of lignes || []) { if (!l) continue; if (estRetour(l)) retours++; else ventes++; }
  return { ventes, retours, total: ventes + retours };
}

// Le PDF composé : combien de bordereaux, dont combien de retours (par les plages posées à la composition).
export function retoursDuPdf(res) {
  const p = (res && Array.isArray(res.plages)) ? res.plages : [];
  return { n: p.length, retours: p.filter((x) => x && x.retour).length };
}

// Les mots du cartouche RETOUR (PDF). `t` : la fonction `tr` de l'appelant (repli français).
export function motsTamponRetour({ num = '' } = {}, t = null) {
  const T = (k, d, v) => { try { const r = t ? t(k, v) : ''; return r && r !== k ? r : d; } catch (_) { return d; } };
  const n = str(num).trim();
  return {
    haut: T('impr.retour.pdfHaut', 'RETOUR'),
    num: n ? `N° ${n}` : '',
    bas: T('impr.retour.pdfBas', 'Achat renvoyé · pas une vente'),
    pied: T('impr.retour.pdfPied', 'Bordereau de retour VRM · tu renvoies un achat'),
  };
}

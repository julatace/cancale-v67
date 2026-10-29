// ── LA MICRO-ENTREPRISE : seuils, calendrier, options (29 octobre) ─────────
// Julien : « une jauge qui montre où tu en es par rapport au plafond et au seuil
// de TVA » ; « vois si la personne a choisi le versement libératoire » ; « si
// elle paie tous les mois, elle déclare son mois d'août mais elle paie en
// septembre ». Règle PURE (aucun accès au navigateur) : l'écran et l'audit
// l'appellent (§11).
//
// ⚠️ LES CHIFFRES SONT DES CHIFFRES OFFICIELS VÉRIFIÉS, PAS DES SOUVENIRS
// (lus le 29 octobre 2026 sur entreprendre.service-public.gouv.fr) :
//   · F32353 (« vérifié le 21 février 2026 ») — plafond du régime micro pour
//     la VENTE DE MARCHANDISES : 203 100 € (l'ancien 188 700 € ne vaut plus).
//     Dépassé DEUX années consécutives ⇒ sortie du régime micro au 1er janvier
//     suivant ; un dépassement isolé ne fait pas sortir.
//   · F21746 (« vérifié le 1er janvier 2026 ») — franchise en base de TVA,
//     vente de marchandises : seuil 85 000 €, seuil majoré 93 500 €. Le CA de
//     l'année dépasse 85 000 € (sans 93 500 €) ⇒ TVA au 1er janvier SUIVANT ;
//     il dépasse 93 500 € ⇒ TVA dès le JOUR du dépassement.
//   · F23267 — versement libératoire : +1 % pour la vente de marchandises,
//     payé avec les cotisations, au même rythme (mois ou trimestre) ; possible
//     si le revenu fiscal de référence N-2 est sous 29 579 € pour une personne
//     seule ; l'option se demande avant le 30 septembre pour l'année suivante.
//   · F36232 — déclaration ET paiement des cotisations auprès de l'URSSAF,
//     chaque mois ou chaque trimestre, sur le CA de la période PRÉCÉDENTE.
// Une année sans chiffres vérifiés ⇒ `seuilsDe` rend `null` : la jauge se tait
// plutôt que de comparer à un plafond périmé.

export const SEUILS_MICRO = {
  2026: {
    plafondVente: 203100,
    tvaBase: 85000,
    tvaMajore: 93500,
    rfrLiberatoire: 29579,
    verifie: '29 octobre 2026 (service-public.gouv.fr)',
  },
};
export const seuilsDe = (annee) => SEUILS_MICRO[annee] || null;
export const PROCHE_PCT = 80;

const r2 = (x) => Math.round(x * 100) / 100;

// Le CA d'une année, lu dans la ligne PUBLIÉE par l'écran Ventes
// (`vinted_urssaf_mois`, datée au VERSEMENT : l'argent encaissé, ce que compte
// la micro-entreprise). Trois états : `null` sans ligne (pas su — jamais 0),
// sinon `{ ca, mois, partiel, raisons }`. Partiel : une plateforme pas lue,
// des ventes sans date de versement (elles peuvent être de cette année).
export const caAnnee = (ligne, annee) => {
  if (!ligne || !Array.isArray(ligne.mois)) return null;
  let ca = 0, mois = 0;
  for (const m of ligne.mois) {
    if (!m || typeof m.ym !== 'string' || m.ym.slice(0, 4) !== String(annee)) continue;
    const v = Number(m.ca);
    if (!isFinite(v)) continue;
    ca += v; mois += 1;
  }
  const raisons = [];
  const src = ligne.sources || {};
  const pasSu = Object.keys(src).filter((k) => src[k] === 'pasSu');
  if (pasSu.length) raisons.push(`${pasSu.join(' et ')} pas lu${pasSu.length > 1 ? 's' : ''}`);
  if (ligne.aDater && Number(ligne.aDater.n) > 0) raisons.push(`${ligne.aDater.n} vente${ligne.aDater.n > 1 ? 's' : ''} sans date de versement`);
  return { ca: r2(ca), mois, partiel: raisons.length > 0, raisons };
};

// Un seuil : où on en est, et ce que ça veut dire. `ca` est un MINIMUM quand
// `partiel` : on n'affirme jamais « sous le seuil » sur un minimum proche.
const position = (ca, seuil) => ({ seuil, pct: seuil > 0 ? Math.min(999, Math.round((ca / seuil) * 1000) / 10) : 0, reste: r2(Math.max(0, seuil - ca)) });

// La jauge. `now` fixe l'année (heure locale). Rend `null` sans ligne publiée
// ou sans seuils vérifiés pour l'année. `projection` : le CA de fin d'année
// au rythme actuel, seulement après 60 jours (avant, il ne dit rien) et jamais
// sur un total partiel.
export const jaugeSeuils = ({ ligne, now = new Date() } = {}) => {
  const annee = now.getFullYear();
  const s = seuilsDe(annee);
  if (!s) return null;
  const cur = caAnnee(ligne, annee);
  if (!cur) return null;
  const prec = caAnnee(ligne, annee - 1);
  const debut = new Date(annee, 0, 1), fin = new Date(annee + 1, 0, 1);
  const jours = Math.max(1, Math.round((now - debut) / 86400000));
  const joursAn = Math.round((fin - debut) / 86400000);
  const projection = (!cur.partiel && jours >= 60 && cur.ca > 0) ? Math.round(cur.ca / jours * joursAn) : null;

  // TVA. Le CA N-1 n'est connu que comme un MINIMUM (VRM ne voit que ce qu'il a
  // capté) : un minimum au-dessus de 85 000 € est une certitude, en dessous
  // rien n'est affirmé.
  const tva = position(cur.ca, s.tvaBase);
  let tvaEtat;
  if (prec && prec.ca > s.tvaBase) tvaEtat = 'due_depuis_janvier';
  else if (cur.ca > s.tvaMajore) tvaEtat = 'majore_depasse';
  else if (cur.ca > s.tvaBase) tvaEtat = 'base_depasse';
  else if (tva.pct >= PROCHE_PCT) tvaEtat = 'proche';
  else tvaEtat = 'ok';
  tva.etat = tvaEtat;
  tva.majore = s.tvaMajore;
  tva.resteMajore = r2(Math.max(0, s.tvaMajore - cur.ca));

  const plafond = position(cur.ca, s.plafondVente);
  plafond.etat = cur.ca > s.plafondVente ? ((prec && prec.ca > s.plafondVente) ? 'sortie' : 'depasse')
    : plafond.pct >= PROCHE_PCT ? 'proche' : 'ok';

  const projTva = projection != null && projection > s.tvaBase && (tvaEtat === 'ok' || tvaEtat === 'proche');
  const projPlafond = projection != null && projection > s.plafondVente && (plafond.etat === 'ok' || plafond.etat === 'proche');
  return { annee, seuils: s, ca: cur.ca, mois: cur.mois, partiel: cur.partiel, raisons: cur.raisons,
    caPrec: prec ? prec.ca : null, projection, projTva, projPlafond, tva, plafond };
};

// Les options du micro-entrepreneur, rangées EXPLICITEMENT (`vrm_micro_options`,
// synchronisé). Le versement libératoire se DEMANDE : VRM ne lit pas son espace
// URSSAF. `null` = pas répondu (on n'en déduit rien d'officiel). L'ACRE :
// booléen. Une forme illisible ⇒ tout à `null`/faux, jamais deviné.
export const optionsMicro = (v) => {
  const o = v && typeof v === 'object' ? v : {};
  const lib = o.liberatoire === 'oui' || o.liberatoire === 'non' ? o.liberatoire : null;
  return { liberatoire: lib, acre: o.acre === true, at: Number(o.at) || 0 };
};

// Le calendrier de paiement. Mensuel : le CA du mois M se déclare ET se paie
// le mois M+1, du 1er au dernier jour. Trimestriel : 30 avril, 31 juillet,
// 31 octobre, 31 janvier (même règle que `nextUrssafDeadline` de l'app).
// Rend les `n` prochaines échéances dont la date limite n'est pas passée.
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const jour0 = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const calendrierUrssaf = (freq, now = new Date(), n = 3) => {
  const out = [];
  const today = jour0(now);
  const Y = now.getFullYear(), M = now.getMonth();
  if (freq === 'mensuel') {
    for (let k = -2; out.length < n && k < 24; k++) {
      const ps = new Date(Y, M + k, 1);
      const ouvre = new Date(ps.getFullYear(), ps.getMonth() + 1, 1);
      const limite = new Date(ps.getFullYear(), ps.getMonth() + 2, 0);
      if (jour0(limite) < today) continue;
      out.push({ periode: `${MOIS[ps.getMonth()]} ${ps.getFullYear()}`, ym: [`${ps.getFullYear()}-${String(ps.getMonth() + 1).padStart(2, '0')}`],
        ouvre, limite, moisPaiement: `${MOIS[ouvre.getMonth()]} ${ouvre.getFullYear()}`,
        ouverte: today >= jour0(ouvre), joursRestants: Math.round((jour0(limite) - today) / 86400000) });
    }
    return out;
  }
  const q0 = Math.floor(M / 3);
  for (let k = -2; out.length < n && k < 12; k++) {
    const qi = q0 + k, y = Y + Math.floor(qi / 4), q = ((qi % 4) + 4) % 4;
    const ouvre = new Date(y, q * 3 + 3, 1);
    const limite = new Date(y, q * 3 + 4, 0);
    if (jour0(limite) < today) continue;
    const yms = [0, 1, 2].map((i) => `${y}-${String(q * 3 + 1 + i).padStart(2, '0')}`);
    out.push({ periode: `T${q + 1} ${y} (${MOIS[q * 3]} à ${MOIS[q * 3 + 2]})`, ym: yms, ouvre, limite,
      moisPaiement: `${MOIS[ouvre.getMonth()]} ${ouvre.getFullYear()}`,
      ouverte: today >= jour0(ouvre), joursRestants: Math.round((jour0(limite) - today) / 86400000) });
  }
  return out;
};

// La phrase qui explique le rythme, avec un exemple RÉEL tiré du calendrier
// (jamais un mois inventé).
export const phraseRythme = (freq, now = new Date()) => {
  const p = calendrierUrssaf(freq, now, 1)[0];
  if (!p) return '';
  const j = (d) => `${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]}`;
  return freq === 'mensuel'
    ? `Chaque mois, tu déclares et tu paies le chiffre d'affaires du mois d'avant. Exemple : ${p.periode} se déclare et se paie du ${j(p.ouvre)} au ${j(p.limite)}.`
    : `Chaque trimestre, tu déclares et tu paies le chiffre d'affaires des trois mois d'avant. Exemple : ${p.periode} se déclare et se paie du ${j(p.ouvre)} au ${j(p.limite)}.`;
};

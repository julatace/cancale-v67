// ── src/natif/ecrans/RelancesVentes.jsx — « À relancer » dans Ventes (21 nov., ext. 5.425, `relances`) ─────────────────
// Julien (46) : « acheteurs qui ne finalisent pas, ou ne vont pas chercher le colis ». Les listes sont FAITES par
// l'extension (règle <relances-regle>, src/relancesAcheteurs.js : statuts PROUVÉS, litige jamais) et publiées dans SA
// ligne `vrm_relances_{uid}` (un propriétaire, §11) ; l'app les MONTRE et ne décide rien. « Relancer » ouvre le panneau
// de l'extension sur Commandes → « À relancer » (`lienPanneau`, règle du 20 nov. : toute action de plateforme s'y fait).
// Comptes séparés (règle du 12 nov.) : un groupe par compte, du plus récent au plus ancien dans chaque groupe.
//
// lire() → les lignes `vrm_relances_*` projetées ({ id, l: liste, at: listeAt, c: compte }) ou null (pas su ⇒ rien montré,
// jamais « personne à relancer ») · nomDe(uid) · onRelancer(uid) · comptes (banc : la liste déjà lue).
import React from 'react';
import { tr } from '../../i18n/index.js';
import { Groupe } from '../Groupe.jsx';
import { Rangee } from '../Rangee.jsx';
import { Pastille } from '../Pastille.jsx';

const jours = (t, now) => (Number.isFinite(Number(t)) && Number(t) > 0 ? Math.max(0, Math.floor((now - Number(t)) / 864e5)) : null);
export function phraseRelance(l, now = Date.now()) {
  const j = jours(l.depuis, now);
  if (l.motif === 'livre') return j == null ? tr('rlv.livre') : tr('rlv.livreDepuis', { n: j });
  const a = j == null ? tr('rlv.relais') : tr('rlv.relaisDepuis', { n: j });
  if (!Number.isFinite(Number(l.reste))) return a + ' · ' + tr('rlv.limitePasSue');
  if (Number(l.reste) <= 0) return a + ' · ' + tr('rlv.gardePassee');
  return a + ' · ' + tr(l.estimee ? 'rlv.resteEstime' : 'rlv.reste', { n: Number(l.reste) });
}

export function comptesRelances(rows, nomDe) {
  if (!Array.isArray(rows)) return null;
  return rows.map((r) => { const uid = String(r.c || (/^vrm_relances_(\d{1,20})$/.exec(String(r.id || '')) || [])[1] || '');
    return { uid, nom: (nomDe && uid ? nomDe(uid) : '') || '', lu: Date.parse(r.at || '') || null, lignes: Array.isArray(r.l) ? r.l : [] }; })
    .filter((c) => /^\d{1,20}$/.test(c.uid)).sort((a, b) => (Number(b.lu) || 0) - (Number(a.lu) || 0));
}
export default function RelancesVentes({ comptes: donnes = null, lire = null, nomDe = null, onRelancer, maintenant }) {
  const [ouvert, setOuvert] = React.useState(false);
  const [lus, setLus] = React.useState(undefined);
  React.useEffect(() => {
    if (donnes || typeof lire !== 'function') return undefined;
    let vivant = true;
    Promise.resolve().then(lire).then((rows) => { if (vivant) setLus(comptesRelances(rows, nomDe)); }, () => { if (vivant) setLus(null); });
    return () => { vivant = false; };
  }, []);   // une lecture au montage (lire / nomDe changent à chaque rendu de Ventes : jamais une boucle)
  const comptes = donnes || lus;
  const now = Number.isFinite(maintenant) ? maintenant : Date.now();
  const L = (Array.isArray(comptes) ? comptes : []).map((c) => ({ ...c, lignes: (c.lignes || []).filter((l) => l && l.ok === true) })).filter((c) => c.lignes.length);
  const n = L.reduce((s, c) => s + c.lignes.length, 0);
  if (!n) return null;
  return (
    <Groupe titre={tr('rlv.titre')} repli={{ ouvert, n, onBascule: () => setOuvert((v) => !v) }} className="n-rlv"
      attrs={{ 'data-rlv-groupe': ouvert ? 'ouvert' : 'replie', 'data-rlv-n': String(n) }}>
      {L.map((c) => (
        <React.Fragment key={c.uid}>
          {L.length > 1 || c.nom ? <p className="n-rlv-compte" data-rlv-compte={c.uid}>{c.nom || ('#' + c.uid)}{c.lu ? ' · ' + tr('rlv.lu', { n: Math.max(0, Math.round((now - c.lu) / 3600000)) }) : ''}</p> : null}
          {c.lignes.slice().sort((a, b) => (Number(a.depuis) || Infinity) - (Number(b.depuis) || Infinity)).map((l) => (
            <Rangee key={c.uid + ':' + l.tx + ':' + l.motif} titre={l.titre || tr('tableau.sansTitre')} lignes={2} sousTitre={phraseRelance(l, now)}
              valeur={<Pastille ton="ambre">{tr(l.rang === 2 ? 'rlv.rang2' : 'rlv.rang1')}</Pastille>} fin="chevron"
              onClick={() => onRelancer && onRelancer(c.uid)} attrs={{ 'data-rlv-rang': l.tx, 'data-rlv-motif': l.motif }}/>
          ))}
        </React.Fragment>
      ))}
      <p className="n-rlv-note" data-rlv-note="">{tr('rlv.note')}</p>
    </Groupe>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// « BAISSER LE PRIX » DES ANNONCES COCHÉES, DEPUIS VRM (24 nov., lot agir-tout)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « faire absolument tout si l'extension est connectée ». Il tape −X % ; chaque annonce montre « 85 € → 76,50 € » ;
// « Baisser » dépose UNE commande `prix` par annonce dans la file `cmd_dist_*` (baisse seulement, le prix VU voyage avec et
// l'extension le relit avant d'écrire, plafonds et pauses de l'extension) — au nom du compte de CHAQUE annonce, par la porte.
// Une annonce dont le compte n'est ouvert dans aucun onglet reste visible, en lecture seule, avec la raison ; rien ne part
// pour elle. La garde du prix (src/gardePrix.js) : une chute suspecte demande SA confirmation, comme « Changer le prix ».
import React from 'react';
import { tr } from '../i18n/index.js';
import { Feuille, Groupe, Rangee, Bouton } from '../natif/index.js';
import { useFaitsAgir, agirMaintenant, envoyerSerie } from './porte.js';
import { texteRaison } from './Agir.jsx';
import { gardePrixRegle } from '../gardePrix.js';

const eur = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString(undefined, { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2 }));
export const prixBaisse = (prix, pct) => { const p = Number(prix), x = Number(pct); if (!(p > 0) || !(x >= 1 && x <= 90)) return null; const c = Math.round(p * (100 - x)); return c >= 100 && c < Math.round(p * 100) ? c / 100 : null; };

// (25 nov.) Le prix CONSEILLÉ d'une annonce (« Baisses conseillées » : `cible`), sous son prix, 1 € au moins — tant qu'aucun
// pourcentage n'est saisi, c'est LUI qui part (la cible montrée « prix → cible »), jamais deviné.
export const cibleDe = (a) => { const c = Number(a && a.cible), p = Number(a && a.prix); return Number.isFinite(c) && c >= 1 && p > 0 && c < p ? Math.round(c * 100) / 100 : null; };
export default function BaisseSerie({ annonces = [], onFermer, autres = null }) {
  useFaitsAgir();
  const [pct, setPct] = React.useState('');
  const [issue, setIssue] = React.useState(null);
  const [enCours, setEnCours] = React.useState(false);
  const [confirme, setConfirme] = React.useState(false);
  const x = Number(String(pct).replace(',', '.'));
  const l = (annonces || []).filter((a) => a && a.id != null).map((a) => {
    const v = agirMaintenant('vinted', a.uid, 'baisser', 'file');
    const vers = x >= 1 && x <= 90 ? prixBaisse(a.prix, x) : cibleDe(a);
    const g = vers == null ? null : gardePrixRegle({ prixC: Math.round(vers * 100), actuelC: Math.round(Number(a.prix) * 100), plancher: null, mode: 'main', confirmeC: confirme ? Math.round(vers * 100) : null });
    return { a, v, vers, suspect: !!(g && !g.ok) };
  });
  const partent = l.filter((r) => r.v.ok && r.vers != null);
  const suspects = partent.filter((r) => r.suspect);
  const baisser = async () => {
    if (!partent.length || enCours) return;
    if (suspects.length && !confirme) { setConfirme(true); return; }
    setEnCours(true);
    const r = await envoyerSerie('baisser', 'prix', partent.map((p) => ({ site: 'vinted', compte: p.a.uid, id: p.a.id, num: p.a.numero || '', avant: p.a.prix, args: { id: String(p.a.id), prix: p.vers, prixAvant: p.a.prix } })));
    setEnCours(false); setIssue(r);
  };
  const raison = !(x >= 1 && x <= 90) && !l.some((r) => r.vers != null) ? tr('agir.baisse.taux') : !partent.length ? tr('agir.baisse.aucune') : '';
  return (
    <Feuille ouverte onFermer={onFermer} titre={tr('agir.baisse.titre')} attrs={{ 'data-agir-baisse': l.length }}
      pied={issue ? <Bouton variante="plein" onClick={onFermer} attrs={{ 'data-agir-baisse-fini': '' }}>{tr('agir.baisse.fini')}</Bouton>
        : <Bouton variante="plein" chargement={enCours} indisponible={!!raison} raison={raison} onClick={baisser} attrs={{ 'data-agir-baisse-go': String(partent.length) }}>
          {suspects.length && confirme ? tr('agir.baisse.confirmer', { n: partent.length }) : tr('agir.baisse.go', { n: partent.length })}</Bouton>}>
      <label className="n-champ" style={{ margin: '0 var(--n-marge, 16px) 12px', display: 'block' }}>
        <span className="n-champ-libelle">{tr('agir.baisse.de')}</span>
        <input inputMode="decimal" value={pct} onChange={(e) => { setPct(e.target.value.replace(/[^\d,.]/g, '').slice(0, 4)); setConfirme(false); }} data-agir-baisse-pct=""
          style={{ fontSize: 16, width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--n-filet, rgba(60,60,67,0.18))', background: 'var(--n-carte, #fff)', color: 'var(--n-encre, #1d1d1f)' }} aria-label={tr('agir.baisse.de')}/>
      </label>
      {suspects.length && confirme ? <p className="vrm-agir-feuille-p" role="alert" data-agir-baisse-garde={suspects.length}>{tr('agir.baisse.garde', { n: suspects.length })}</p> : null}
      {issue ? <p className="vrm-agir-feuille-p" role="status" data-agir-baisse-issue={issue.n}>{issue.n ? tr('agir.baisse.parti', { n: issue.n }) : texteRaison(issue.verdict) || tr('agir.envoi.base')}</p> : null}
      <Groupe>
        {l.slice(0, 60).map(({ a, v, vers }) => (
          <Rangee key={String(a.uid) + ':' + a.id} titre={a.titre || a.title || '—'} sousTitre={v.ok ? (a.compte || '') : texteRaison(v)} sousLignes={2}
            valeur={vers != null ? `${eur(a.prix)} → ${eur(vers)}` : eur(a.prix)} attrs={{ 'data-agir-baisse-ligne': a.id, 'data-agir': v.ok ? 'ok' : 'lecture' }}/>
        ))}
      </Groupe>
      {autres}
    </Feuille>
  );
}

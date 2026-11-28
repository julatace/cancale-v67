// ── src/ebay/SeriesEbay.jsx — eBay en série, sur SON clic (23 nov.) ──────────────────────────────
// Deux feuilles, même forme que les séries de Vinted (choisir · voir · une confirmation · un à un) :
//   FeuilleOffresEbay   l'offre aux observateurs (Negotiation API : eBay choisit à qui, VRM ne nomme personne, §3) ;
//   FeuilleRelanceEbay  la remise en vente des inactives (`RelistFixedPriceItem`, l'identifiant seul, §2.8).
// Chaque annonce part par la MÊME route qu'à l'unité (`/api/ebay`, `offre` / `relancer`) : toutes les gardes du
// serveur sont rejouées pour chacune (prix vu relu chez eBay, une offre par annonce en 48 h, SKU, ventes…).
// Rien ne part sans la confirmation ; « Tout arrêter » coupe avant l'annonce suivante. La règle : src/ebaySeries.js.
import React from 'react';
import { Feuille, Groupe, Rangee, Bouton, Champ } from '../natif/index.js';
import { tr, monnaie, date as dateTr } from '../i18n/index.js';
import { lignesOffres, offreDe, lireRemise, remiseValide, enSerie } from '../ebaySeries.js';

export { lignesOffres };
const eur = (c, devise = 'EUR') => (c == null ? '—' : monnaie(c / 100, devise));
const texteIssue = (i, sorte) => {
  if (!i) return '';
  if (i.etat === 'en-cours') return tr('ebaySeries.issue.enCours');
  if (i.etat === 'pas-envoye') return tr('ebaySeries.issue.pasEnvoye');
  if (i.etat === 'incertain') return tr('ebaySeries.issue.incertain');
  if (i.etat === 'refuse') return i.texte || tr('ebaySeries.issue.refuse');
  if (sorte === 'offre') { const n = Number(i.j && i.j.envoyees) || 0; return n ? tr('ebaySeries.offres.fait', { n }) : tr('ebaySeries.offres.faitEbay'); }
  return i.j && i.j.verifie === false ? tr('ebaySeries.relance.faitARelire') : tr('ebaySeries.relance.fait');
};
const tonIssue = (i) => (!i ? 'neutre' : i.etat === 'fait' ? 'neutre' : 'ambre');

// ── L'OFFRE AUX OBSERVATEURS ──
//   lignes : `lignesOffres(...)` ; appel(corps) ⇒ { code, j } ; corpsCompte(ref) ⇒ { compte… } ; confirmer(opts) ⇒ bool.
export function FeuilleOffresEbay({ lignes = [], onFermer, appel, corpsCompte = () => ({}), confirmer, surFini = null }) {
  const pretes = lignes.filter((l) => l.etat === 'prete');
  const [remiseTxt, setRemiseTxt] = React.useState('10');
  const [coches, setCoches] = React.useState(() => new Set(pretes.map((l) => l.cle)));
  const [issues, setIssues] = React.useState({});
  const [enCours, setEnCours] = React.useState(false);
  const arret = React.useRef(false);
  const remise = lireRemise(remiseTxt);
  const remiseOk = remiseValide(remise);
  const choisies = pretes.filter((l) => coches.has(l.cle) && !(issues[l.cle] && issues[l.cle].etat === 'fait'));
  const lancer = async () => {
    if (enCours || !remiseOk || !choisies.length) return;
    const ok = await confirmer({ title: tr('ebaySeries.offres.confTitre', { n: choisies.length, r: remise }), desc: tr('ebaySeries.offres.confDesc'), ok: tr('ebaySeries.offres.confOk'), cancel: tr('ebaySeries.annuler') });
    if (!ok) return;
    arret.current = false; setEnCours(true);
    await enSerie(choisies, (l) => { setIssues((m) => ({ ...m, [l.cle]: { etat: 'en-cours' } }));
      return appel({ action: 'offre', listingId: l.itemId, remise, confirme: true, prixVu: (l.prixCents / 100).toFixed(2), ...corpsCompte(l.compte) }); },
    { surLigne: (cle, i) => setIssues((m) => ({ ...m, [cle]: i })), arret: () => arret.current });
    setEnCours(false);
    if (surFini) surFini();
  };
  const faites = Object.values(issues).filter((i) => i && i.etat === 'fait').length;
  return (
    <Feuille ouverte onFermer={enCours ? () => {} : onFermer} titre={tr('ebaySeries.offres.titre')} attrs={{ 'data-ebay-serie': 'offres' }}
      pied={enCours
        ? <Bouton variante="teinte" large onClick={() => { arret.current = true; }} attrs={{ 'data-ebay-serie-arreter': '' }}>{tr('ebaySeries.arreter')}</Bouton>
        : <Bouton variante="plein" large indisponible={!remiseOk || !choisies.length} onClick={lancer} attrs={{ 'data-ebay-serie-lancer': String(choisies.length) }}>{tr('ebaySeries.offres.envoyer', { n: choisies.length })}</Bouton>}>
      <p style={{ margin: '0 var(--n-marge, 16px) 12px', color: 'var(--n-encre-2)' }}>{tr('ebaySeries.offres.explique')}</p>
      <Groupe>
        <div style={{ padding: '4px var(--n-marge, 16px) 8px' }}>
          <Champ libelle={tr('ebaySeries.offres.remise')} valeur={remiseTxt} onChange={(v) => { if (!enCours) setRemiseTxt(v); }} inputMode="numeric" suffixe="%" attrs={{ 'data-ebay-serie-remise': '' }}/>
          {!remiseOk ? <div style={{ color: 'var(--n-ambre)', fontSize: 13, marginTop: 6 }} data-ebay-serie-remise-err="">{tr('ebaySeries.offres.remiseErr')}</div> : null}
        </div>
      </Groupe>
      {faites ? <p style={{ margin: '0 var(--n-marge, 16px) 8px', color: 'var(--n-encre-2)' }} data-ebay-serie-resume={faites}>{tr('ebaySeries.resume', { faites, n: choisies.length + faites })}</p> : null}
      <Groupe>
        {lignes.map((l) => {
          const o = offreDe(l, remise);
          const i = issues[l.cle];
          const sous = l.etat === 'en-cours' ? tr('ebaySeries.offres.enCours', { date: dateTr(l.jusqua, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })
            : l.etat === 'prix-pas-lu' ? tr('ebaySeries.offres.prixPasLu')
            : [o.offreCents != null ? tr('ebaySeries.offres.prix', { offre: eur(o.offreCents), prix: eur(l.prixCents) }) : '', o.sousAchat ? tr('ebaySeries.offres.sousAchat', { achat: eur(l.achatCents) }) : ''].filter(Boolean).join(' · ');
          return (
            <Rangee key={l.cle} titre={(l.numero ? 'N°' + l.numero + ' · ' : '') + l.titre} sousTitre={sous} sousLignes={2}
              valeur={i ? texteIssue(i, 'offre') : null} ton={tonIssue(i)}
              selection={{ cochee: coches.has(l.cle), indisponible: l.etat !== 'prete' || enCours || (i && i.etat === 'fait'), libelle: l.titre,
                onChange: (v) => setCoches((s) => { const n = new Set(s); if (v) n.add(l.cle); else n.delete(l.cle); return n; }) }}
              attrs={{ 'data-ebay-serie-ligne': l.itemId, 'data-etat': l.etat, 'data-offre-cents': o.offreCents == null ? '' : String(o.offreCents), ...(o.sousAchat ? { 'data-sous-achat': '1' } : {}), ...(i ? { 'data-issue': i.etat } : {}) }}/>
          );
        })}
      </Groupe>
    </Feuille>
  );
}

// ── LA REMISE EN VENTE DES INACTIVES ──
//   lignes : [{ cle, itemId, compte, titre, numero, prixVu, devise }] (déjà jugées proposables par `relanceProposable`).
// À l'ouverture : la vérification à blanc de chacune (frais eBay), une à la fois ; refusée ⇒ pas cochable, la phrase dite.
export function FeuilleRelanceEbay({ lignes = [], onFermer, appel, corpsCompte = () => ({}), confirmer, surFini = null }) {
  const [verifs, setVerifs] = React.useState({});   // cle ⇒ { etat:'en-cours'|'ok'|'refuse', frais, devise, texte }
  const [coches, setCoches] = React.useState(() => new Set());
  const [issues, setIssues] = React.useState({});
  const [enCours, setEnCours] = React.useState(false);
  const arret = React.useRef(false);
  const corps = (l) => ({ itemId: l.itemId, numero: l.numero, prixVu: String(l.prixVu), ...corpsCompte(l.compte) });
  React.useEffect(() => {
    let stop = false;
    (async () => {
      for (const l of lignes) {
        if (stop) return;
        setVerifs((m) => ({ ...m, [l.cle]: { etat: 'en-cours' } }));
        let v; try { v = await appel({ action: 'relanceverif', ...corps(l) }); } catch (_) { v = null; }
        if (stop) return;
        const ok = !!(v && v.j && v.j.ok === true);
        const f = ok && v.j.frais && v.j.frais.total != null && Number.isFinite(Number(v.j.frais.total)) ? Math.round(Number(v.j.frais.total) * 100) : null;
        setVerifs((m) => ({ ...m, [l.cle]: ok ? { etat: 'ok', frais: f, devise: (v.j.frais && v.j.frais.devise) || l.devise || 'EUR' } : { etat: 'refuse', texte: (v && v.j && v.j.error) || tr('ebaySeries.issue.incertain') } }));
        if (ok) setCoches((s) => new Set(s).add(l.cle));
      }
    })();
    return () => { stop = true; };
  }, []);   // une fois, à l'ouverture
  const pretes = lignes.filter((l) => verifs[l.cle] && verifs[l.cle].etat === 'ok');
  const choisies = pretes.filter((l) => coches.has(l.cle) && !(issues[l.cle] && issues[l.cle].etat === 'fait'));
  const verifEnCours = lignes.some((l) => !verifs[l.cle] || verifs[l.cle].etat === 'en-cours');
  const fraisLus = choisies.filter((l) => verifs[l.cle].frais != null);
  const total = fraisLus.reduce((s, l) => s + verifs[l.cle].frais, 0);
  const manque = choisies.length - fraisLus.length;
  const totalTxt = !choisies.length ? '' : manque ? tr('ebaySeries.relance.totalPartiel', { total: eur(total), m: manque }) : tr('ebaySeries.relance.total', { total: eur(total) });
  const lancer = async () => {
    if (enCours || verifEnCours || !choisies.length) return;
    const ok = await confirmer({ title: tr('ebaySeries.relance.confTitre', { n: choisies.length }), desc: tr('ebaySeries.relance.confDesc') + '\n' + totalTxt, ok: tr('ebaySeries.relance.confOk'), cancel: tr('ebaySeries.annuler') });
    if (!ok) return;
    arret.current = false; setEnCours(true);
    await enSerie(choisies, (l) => { setIssues((m) => ({ ...m, [l.cle]: { etat: 'en-cours' } })); return appel({ action: 'relancer', ...corps(l), confirme: true }); },
      { surLigne: (cle, i) => setIssues((m) => ({ ...m, [cle]: i })), arret: () => arret.current });
    setEnCours(false);
    if (surFini) surFini();
  };
  return (
    <Feuille ouverte onFermer={enCours ? () => {} : onFermer} titre={tr('ebaySeries.relance.titre')} attrs={{ 'data-ebay-serie': 'relance' }}
      pied={enCours
        ? <Bouton variante="teinte" large onClick={() => { arret.current = true; }} attrs={{ 'data-ebay-serie-arreter': '' }}>{tr('ebaySeries.arreter')}</Bouton>
        : <Bouton variante="plein" large indisponible={verifEnCours || !choisies.length} chargement={verifEnCours} onClick={lancer} attrs={{ 'data-ebay-serie-lancer': String(choisies.length) }}>{tr('ebaySeries.relance.lancer', { n: choisies.length })}</Bouton>}>
      <p style={{ margin: '0 var(--n-marge, 16px) 12px', color: 'var(--n-encre-2)' }}>{tr('ebaySeries.relance.explique')}</p>
      {totalTxt ? <p style={{ margin: '0 var(--n-marge, 16px) 8px', color: 'var(--n-encre-2)' }} data-ebay-serie-frais={manque ? 'partiel' : String(total)}>{totalTxt}</p> : null}
      <Groupe>
        {lignes.map((l) => {
          const v = verifs[l.cle];
          const i = issues[l.cle];
          const sous = [eur(Math.round(Number(String(l.prixVu).replace(',', '.')) * 100), l.devise || 'EUR'),
            !v || v.etat === 'en-cours' ? tr('ebaySeries.relance.verif') : v.etat === 'refuse' ? v.texte : v.frais != null ? tr('ebaySeries.relance.frais', { frais: eur(v.frais, v.devise) }) : tr('ebaySeries.relance.fraisPasLus')].filter(Boolean).join(' · ');
          return (
            <Rangee key={l.cle} titre={'N°' + l.numero + ' · ' + l.titre} sousTitre={sous} sousLignes={2} valeur={i ? texteIssue(i, 'relance') : null} ton={tonIssue(i) === 'ambre' || (v && v.etat === 'refuse') ? 'ambre' : 'neutre'}
              selection={{ cochee: coches.has(l.cle), indisponible: !v || v.etat !== 'ok' || enCours || (i && i.etat === 'fait'), libelle: l.titre,
                onChange: (x) => setCoches((s) => { const n = new Set(s); if (x) n.add(l.cle); else n.delete(l.cle); return n; }) }}
              attrs={{ 'data-ebay-serie-ligne': l.itemId, 'data-verif': v ? v.etat : 'attente', ...(i ? { 'data-issue': i.etat } : {}) }}/>
          );
        })}
      </Groupe>
    </Feuille>
  );
}

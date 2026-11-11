// ═══════════════════════════════════════════════════════════════════════════
// « TON HISTORIQUE LEBONCOIN / VESTIAIRE / eBAY » (11 nov., lot import-historique-sites)
// Paramètres → Comptes → Mon historique, sous l'historique Vinted, avec la MÊME
// carte (classes `vrm-imp-*`, src/styles-import-depart.css). Règles et lectures :
// src/importSites.js. Rien n'est inventé : une ligne absente dit le geste à faire,
// une lecture ratée dit « pas su ».
//   · Leboncoin, Vestiaire : l'extension (5.365) lit, onglet ouvert sur le site ;
//     « Tout récupérer » repart de la première page, pour le compte de l'onglet.
//   · eBay : la route lit (l'API d'eBay) ; pendant que cette carte est ouverte,
//     l'app enchaîne les étapes (une à la fois) jusqu'à « fini ».
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { lireImportSites, lireSitesPresents, phraseImportSite, texteTypeSite, pctTypeSite } from './importSites.js';
import { lireTout, onVmrExt, vmrCmd, vmrExtPresent, extSait, Bouton, enTeteSession, corpsCompteEbay } from './App.jsx';
import { tr, nombre, heure } from './i18n/index.js';
import './styles-import-depart.css';

const NOM_SITE = { leboncoin: 'Leboncoin', vestiaire: 'Vestiaire Collective', ebay: 'eBay' };
const ETAPES_EBAY_MAX = 40;

function useLignes() {
  const [etat, setEtat] = React.useState({ lignes: undefined, sites: undefined, noms: {} });
  const [tour, setTour] = React.useState(0);
  React.useEffect(() => {
    let mort = false;
    (async () => {
      const [lignes, sites, comptes] = await Promise.all([
        lireImportSites(lireTout), lireSitesPresents(lireTout),
        lireTout('id=eq.lbc_accounts&select=a:data->accounts').catch(() => null),
      ]);
      const noms = {};
      const a = Array.isArray(comptes) && comptes[0] && comptes[0].a;
      if (a && typeof a === 'object') for (const [k, v] of Object.entries(a)) { const id = String(k).replace(/^lbc-account:/, ''); if (v && v.name) noms[id] = String(v.name).slice(0, 40); }
      if (!mort) setEtat({ lignes, sites, noms });
    })();
    return () => { mort = true; };
  }, [tour]);
  React.useEffect(() => {
    const f = (e) => { const d = e && e.detail; if (d && d.type === 'maj' && d.quoi === 'import') setTour((t) => t + 1); };
    const vis = () => { if (document.visibilityState === 'visible') setTour((t) => t + 1); };
    window.addEventListener('vrm:ext', f);
    document.addEventListener('visibilitychange', vis);
    const t = setInterval(() => { if (document.visibilityState === 'visible') setTour((x) => x + 1); }, 60000);
    return () => { window.removeEventListener('vrm:ext', f); document.removeEventListener('visibilitychange', vis); clearInterval(t); };
  }, []);
  return [etat, () => setTour((t) => t + 1)];
}

const NOMS_TYPES = { transactions: 'historiqueSites.type.transactions', details: 'historiqueSites.type.details', ventes: 'historiqueSites.type.ventes', achats: 'historiqueSites.type.achats' };
function Barre({ t, nom }) {
  const pc = pctTypeSite(t);
  return (
    <div className="vrm-imp-type" data-import-type={nom} data-import-lus={t ? t.lus : ''} data-import-total={t && t.total !== null ? t.total : ''} data-import-fini={t && t.fini ? '1' : '0'}>
      <div className="vrm-imp-type-l">
        <span>{tr(NOMS_TYPES[nom])}</span>
        <span className="vrm-imp-chiffre">{texteTypeSite(t, tr, (x) => nombre(x))}</span>
      </div>
      {pc !== null && !(t && t.fini) && !(t && t.limiteJours) ? (
        <div className="vrm-imp-barre" role="progressbar" aria-label={tr(NOMS_TYPES[nom])} aria-valuemin={0} aria-valuemax={t.total} aria-valuenow={Math.min(t.lus, t.total)}>
          <i style={{ width: `${Math.max(2, pc)}%` }} />
        </div>
      ) : null}
    </div>
  );
}

// eBay : appeler la route une étape à la fois. Rend la réponse, ou null (réseau).
async function etapeEbay(ref, depuisDebut) {
  try {
    const r = await fetch('/api/ebay', { method: 'POST', headers: { 'content-type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'historique', ...(depuisDebut ? { depuisDebut: true } : {}), ...corpsCompteEbay(ref) }) });
    let j = null; try { j = await r.json(); } catch (_) {}
    return { ok: r.ok && !!(j && j.ok), corps: j };
  } catch (_) { return null; }
}

export default function HistoriqueSites() {
  const [, force] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => onVmrExt(force), []);
  const [{ lignes, sites, noms }, relire] = useLignes();
  const [occupe, setOccupe] = React.useState('');
  const [issue, setIssue] = React.useState(null);
  const ebayCours = React.useRef(false);

  // eBay : tant que cette carte est ouverte, les comptes pas finis avancent (une étape à la fois).
  const refsEbay = sites && Array.isArray(sites.ebay) ? sites.ebay : [];
  const aFaireEbay = lignes && refsEbay.filter((ref) => { const l = lignes.find((x) => x.site === 'ebay' && x.compte === ref); return !l || (l.etat !== 'fini' && !l.cause); });
  const cleEbay = aFaireEbay ? aFaireEbay.join(',') : '';
  React.useEffect(() => {
    if (!cleEbay || ebayCours.current) return undefined;
    let mort = false;
    ebayCours.current = true;
    (async () => {
      for (const ref of cleEbay.split(',')) {
        for (let i = 0; i < ETAPES_EBAY_MAX && !mort; i++) {
          if (document.visibilityState !== 'visible') break;
          const r = await etapeEbay(ref, false);
          if (!r || !r.ok) break;
          const e = r.corps && r.corps.etat;
          relire();
          if (!e || e.etat === 'fini' || r.corps.deja || e.cause) break;
          await new Promise((ok) => setTimeout(ok, 1500));
        }
      }
      ebayCours.current = false;
    })();
    return () => { mort = true; };
  }, [cleEbay]);

  const sait = extSait('importsites');
  const lancer = async (l) => {
    const cle = l.site + ':' + l.compte;
    if (occupe) return;
    setOccupe(cle); setIssue({ cle, texte: tr('historiqueSites.issue.parti') });
    let r = null;
    if (l.site === 'ebay') {
      const e = await etapeEbay(l.compte, true);
      r = e && e.ok ? { accepte: true } : { accepte: false, raison: (e && e.corps && e.corps.error) || tr('historiqueSites.issue.muet') };
    } else if (!vmrExtPresent()) r = { accepte: false, raison: tr('historiqueSites.issue.sansExt') };
    else { try { r = await vmrCmd({ cmd: 'importSiteTout', site: l.site, compte: l.compte }, 20000); } catch (_) { r = null; } }
    setIssue({ cle, ok: !!(r && r.accepte), texte: r && r.accepte ? tr('historiqueSites.issue.lance') : ((r && r.raison) || tr('historiqueSites.issue.muet')) });
    setOccupe(''); relire();
  };

  if (lignes === undefined || sites === undefined) return <div className="vrm-imp vrm-imp-reglages" data-import-sites="lecture"><p className="vrm-imp-note">—</p></div>;
  if (lignes === null || sites === null) return <div className="vrm-imp vrm-imp-reglages" data-import-sites="passu"><p className="vrm-imp-note" role="status" data-import-passu="">{tr('historiqueSites.passu')}</p></div>;

  // Par site : ses lignes, ou le geste qui la fera naître (seulement les sites où il a quelque chose).
  const blocs = [];
  for (const site of ['leboncoin', 'vestiaire', 'ebay']) {
    const ls = lignes.filter((l) => l.site === site);
    const present = site === 'ebay' ? refsEbay.length > 0 : !!sites[site];
    if (!ls.length && !present) continue;
    blocs.push({ site, ls });
  }
  if (!blocs.length) return null;
  const nomLigne = (l, ls) => (l.site === 'leboncoin' ? (noms[l.compte] || '') : (ls.length > 1 ? (l.site === 'ebay' ? (l.compte === 'principal' ? tr('historiqueSites.ebayPrincipal') : '') : '') : ''));
  return (
    <div className="vrm-imp vrm-imp-reglages" data-import-sites={blocs.length} data-import-sait={sait}>
      {blocs.map(({ site, ls }) => (
        <div key={site} className="vrm-imp-ligne" data-import-site={site}>
          <div className="vrm-imp-tete"><span className="vrm-imp-nom">{tr('historiqueSites.titre', { site: NOM_SITE[site] })}</span></div>
          {!ls.length ? (
            <p className="vrm-imp-note" data-import-geste={site} data-ton="geste">
              {site === 'ebay' ? tr('historiqueSites.geste.ebay') : (sait === 'ok' ? tr(site === 'leboncoin' ? 'historiqueSites.phrase.modeleLbc' : 'historiqueSites.phrase.modeleVc') : tr('historiqueSites.geste.majExt', { v: '5.365.0' }))}
            </p>
          ) : null}
          {ls.map((l) => {
            const cle = l.site + ':' + l.compte;
            const iss = issue && issue.cle === cle ? issue : null;
            const nom = nomLigne(l, ls);
            return (
              <div key={cle} className="vrm-imp-compte" data-import-compte={l.compte} data-import-etat={l.etat}>
                <div className="vrm-imp-tete">
                  {nom ? <span className="vrm-imp-nom">{nom}</span> : null}
                  <span className="vrm-imp-phrase" data-ton={l.etat === 'arrete' || l.attend ? 'geste' : undefined}>{phraseImportSite(l, tr, (ms) => heure(ms))}</span>
                </div>
                {Object.entries(l.types).map(([n, t]) => <Barre key={n} t={t} nom={n} />)}
                {l.etat !== 'encours' && (l.site === 'ebay' || sait === 'ok') ? (
                  <Bouton variante="secondaire" data-import-tout={cle} disabled={!!occupe} onClick={() => lancer(l)}>{tr('historiqueSites.toutRecuperer')}</Bouton>
                ) : null}
                {iss ? <p className="vrm-imp-note" role="status" data-import-issue={iss.ok ? 'ok' : 'refus'}>{iss.texte}</p> : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── « PUBLIER AUSSI SUR… » DEPUIS LE DOSSIER (28 nov., ext. 5.458.0 `aussifile`) — la règle : src/aPublier/fileAussi.js ──
// Un article du dossier (numéroté) vers Leboncoin et Vestiaire : la feuille avant / après (la règle de « Publier aussi »,
// src/publier/aussi.js), SES réponses aux champs « à choisir », puis « Mettre en file » : une tâche PAR SITE, que
// l'extension lance seule quand un onglet de ce site est ouvert et connecté — sans limite de temps, jamais deux fois.
import React from 'react';
import { Feuille, Groupe, Rangee, Bouton, Actions } from '../natif/index.js';
import { tr } from '../i18n/index.js';
import { feuilleAussi, NOM_SITE_AUSSI } from '../publier/aussi.js';
import { FA_SITES, faCle, faEntree } from './fileAussi.js';

const OUVRIR = { leboncoin: 'https://www.leboncoin.fr/', vestiaire: 'https://fr.vestiairecollective.com/' };
const cleRep = (q) => (q.site ? q.site + '|' + q.champ : q.champ);
// La phrase d'une tâche (une par site).
export function texteTache(j) {
  if (!j) return '';
  const site = NOM_SITE_AUSSI[j.site] || j.site;
  if (j.etat === 'attente') return tr('fa.attente', { site });
  if (j.etat === 'en-cours') return tr('fa.enCours', { site });
  if (j.etat === 'fait') return tr('fa.fait', { site });
  if (j.etat === 'a-choisir') return tr('fa.aChoisir', { site });
  if (j.etat === 'pas-su') return tr('fa.pasSu', { site });
  if (j.etat === 'annule') return tr('fa.annule', { site });
  return tr('fa.arrete', { site });
}

export default function PublierAussiDossier({ brouillon, photosN = 0, taches = {}, cleNum, onMettre, onFermer }) {
  const b = brouillon || {};
  const [sites, setSites] = React.useState(() => FA_SITES.filter((s) => { const j = taches[faCle(s, b.numero, cleNum)]; return !j || ['arrete', 'annule', 'a-choisir'].includes(j.etat); }));
  const [rep, setRep] = React.useState(() => { const o = {}; for (const s of FA_SITES) { const j = taches[faCle(s, b.numero, cleNum)]; if (j && j.reponses) Object.assign(o, j.reponses); } return o; });
  const [envoi, setEnvoi] = React.useState(false);
  const [dit, setDit] = React.useState('');
  // L'aperçu : la MÊME feuille que l'extension (photos comptées seulement ; la marque de Vestiaire est relue par l'extension).
  const photos = Array.from({ length: Math.max(0, Math.min(20, photosN)) }, () => 'data:image/jpeg;base64,AAAA');
  const entree = faEntree(b, photos);
  const f = sites.length ? feuilleAussi(entree, { sites, reponses: rep, pct: {}, deja: Object.fromEntries(sites.map((s) => [s, false])), marqueVc: entree.marque ? { etat: 'listee', valeur: entree.marque } : null }) : null;
  const libres = FA_SITES.filter((s) => { const j = taches[faCle(s, b.numero, cleNum)]; return !j || ['arrete', 'annule', 'a-choisir'].includes(j.etat); });
  const pret = !!(f && f.ok && f.pret && sites.length);
  const mettre = async () => {
    if (!pret || envoi) return;
    setEnvoi(true); setDit('');
    const r = await onMettre(sites.map((s) => ({ site: s, brouillon: String(b.id), numero: String(b.numero), reponses: rep, pct: 0 })));
    setEnvoi(false);
    if (r && r.ok) onFermer && onFermer(); else setDit(tr('fa.pasEcrit'));
  };
  return (
    <Feuille ouverte onFermer={onFermer} titre={tr('fa.titre', { n: String(b.numero || '') })} detente="pleine" attrs={{ 'data-fa-feuille': String(b.id || ''), 'data-fa-pret': pret ? '1' : '0' }}
      pied={<Bouton variante="plein" large onClick={mettre} indisponible={!pret} raison={pret ? '' : !libres.length ? tr('fa.toutEnFile') : tr('fa.pasPret')} attrs={{ 'data-fa-mettre': sites.join(',') }}>{tr('fa.mettre', { n: String(sites.length) })}</Bouton>}>
      <Groupe titre={tr('fa.sites')}>
        {FA_SITES.map((s) => { const j = taches[faCle(s, b.numero, cleNum)]; const libre = libres.includes(s);
          return <Rangee key={s} titre={NOM_SITE_AUSSI[s]} sousTitre={j ? texteTache(j) : ''} fin={libre && sites.includes(s) ? 'coche' : null}
            onClick={libre ? () => setSites((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s])) : null} indisponible={!libre} raison={!libre && j ? texteTache(j) : ''}
            attrs={{ 'data-fa-site': s, 'aria-pressed': sites.includes(s) ? 'true' : 'false', 'data-fa-etat': j ? j.etat : '' }}/>; })}
      </Groupe>
      {f && f.ok ? sites.map((s) => { const S = f.sites[s]; if (!S) return null;
        return <Groupe key={s} titre={tr('fa.ceQuiPart', { site: NOM_SITE_AUSSI[s] })} attrs={{ 'data-fa-apercu': s, 'data-fa-apercu-etat': S.etat }}>
          {S.etat === 'refus' ? <Rangee titre={tr('fa.refus', { code: String((S.refus && S.refus.code) || '') })}/> : (S.lignes || []).map((l) => (
            <Rangee key={l.champ} titre={tr('fa.champ.' + (['titre', 'description', 'categorie', 'univers', 'type', 'marque', 'taille', 'etat', 'couleur', 'prix', 'photos'].includes(l.champ) ? l.champ : 'autre'))}
              sousTitre={l.etat === 'ok' ? String(l.site).slice(0, 80) : tr('fa.aChoisirCourt')} attrs={{ 'data-fa-ligne': l.champ, 'data-fa-ligne-etat': l.etat }}/>))}
        </Groupe>; }) : f ? <Groupe><Rangee titre={tr('fa.refus', { code: String(f.code || '') })} attrs={{ 'data-fa-apercu-refus': String(f.code || '') }}/></Groupe> : null}
      {f && f.ok ? (() => { const qs = []; const vus = new Set(); for (const s of sites) for (const q of ((f.sites[s] || {}).questions || [])) { const k = cleRep(q); if (vus.has(k) || q.raison === 'marques-vc-pas-lues') continue; vus.add(k); qs.push(q); }
        return qs.length ? <Groupe titre={tr('fa.questions')} attrs={{ 'data-fa-questions': String(qs.length) }}>
          {qs.map((q) => <label key={cleRep(q)} className="prep-desc" data-fa-question={cleRep(q)}>
            <span className="n-champ-libelle">{tr('fa.champ.' + (['categorie', 'univers', 'type', 'marque', 'taille', 'etat', 'couleur', 'pointure'].includes(q.champ) ? q.champ : 'autre'))}{q.site ? ' · ' + NOM_SITE_AUSSI[q.site] : ''}</span>
            <select className="prep-texte" value={rep[cleRep(q)] || ''} onChange={(e) => setRep((o) => ({ ...o, [cleRep(q)]: e.target.value }))} aria-label={q.champ}>
              <option value="">{tr('fa.choisir')}</option>
              {(q.choix || []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>)}
        </Groupe> : null; })() : null}
      {dit ? <p className="dap-etat" role="status">{dit}</p> : null}
      <div className="dap-actions"><Actions elements={FA_SITES.filter((s) => { const j = taches[faCle(s, b.numero, cleNum)]; return j && j.etat === 'attente'; }).map((s) => ({ cle: 'ouvrir-' + s, libelle: tr('fa.ouvrir', { site: NOM_SITE_AUSSI[s] }),
        onClick: () => { try { window.open(OUVRIR[s], '_blank', 'noopener'); } catch (_) {} }, attrs: { 'data-fa-ouvrir': s } }))}/></div>
    </Feuille>
  );
}

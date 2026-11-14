// ══════════════════════════════════════════════════════════════════════════════
//  LE CATALOGUE PRIVÉ — la feuille (14 nov., lot messages-achats-plus, n° 110)
// ══════════════════════════════════════════════════════════════════════════════
// Annonces → ⋯ Outils → « Catalogue privé ». IL choisit les annonces (cases, recherche
// par titre ou N°, la sélection d'Annonces pré-cochée), la durée (1, 7 ou 30 jours ; 7
// par défaut), s'il montre le N° ; « Créer le lien ». Le SERVEUR refait la projection
// depuis SES annonces lues (api/_lib/catalogue-prive.js) : jamais de prix d'achat, de
// compte, de pseudo. Ses liens actifs se retirent d'un toucher (le lien répond 404).
// Le navigateur n'envoie QUE des identifiants d'annonces — aucune donnée à montrer.
// ══════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useState } from 'react';
import { tr, date as dateLangue } from './i18n/index.js';
import { Feuille } from './ui/Feuille.jsx';
import { Ligne } from './ui/Ligne.jsx';
import './styles-aide-reponse.css';

export const ROUTE_CATALOGUE = '/api/compte?mode=catalogue';
const MAX = 60;
const Coche = ({ on }) => <span className="vrm-plus-case" data-coche={on ? '1' : '0'} aria-hidden="true">{on ? <svg width="12" height="12" viewBox="0 0 12 12"><path d="m2.5 6.2 2.3 2.3 4.7-4.9" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg> : null}</span>;

// `annonces` : [{ id, titre, photo, taille, prix, numero }] (ses annonces en ligne, de l'écran) ;
// `appeler(methode, corps)` ⇒ { ok, status, body } (la session de l'app) ; `preselection` : ids.
export default function CataloguePrive({ annonces = [], preselection = [], appeler, Photo = null, onClose }) {
  const [choix, setChoix] = useState(() => new Set((preselection || []).map(String).slice(0, MAX)));
  const [q, setQ] = useState('');
  const [jours, setJours] = useState(7);
  const [numero, setNumero] = useState(true);
  const [nom, setNom] = useState('');
  const [etat, setEtat] = useState({ k: 'pret' });   // pret · envoi · cree {url, n, absentes} · erreur {m}
  const [liens, setLiens] = useState(undefined);      // undefined lecture · null pas su · [..]
  const [copie, setCopie] = useState('');
  const relire = () => { setLiens(undefined); Promise.resolve(appeler && appeler('GET')).then((r) => setLiens(r && r.ok && r.body && Array.isArray(r.body.catalogues) ? r.body.catalogues : null)).catch(() => setLiens(null)); };
  useEffect(() => { relire(); }, []);
  const filtre = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^n°\s*/, '');
    const l = (annonces || []).filter((a) => a && a.id != null);
    if (!s) return l;
    return l.filter((a) => String(a.titre || '').toLowerCase().includes(s) || (a.numero != null && String(a.numero).toLowerCase() === s));
  }, [annonces, q]);
  const basculer = (id) => setChoix((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else if (n.size < MAX) n.add(id); return n; });
  const creer = async () => {
    if (!choix.size || etat.k === 'envoi') return;
    setEtat({ k: 'envoi' });
    try {
      const r = await appeler('POST', { action: 'creer', items: [...choix], jours, numero, titre: nom.trim() });
      if (r && r.ok && r.body && r.body.url) { setEtat({ k: 'cree', url: r.body.url, n: r.body.n, absentes: r.body.absentes || 0 }); relire(); }
      else setEtat({ k: 'erreur', m: (r && r.body && r.body.message) || tr('plus.cat.erreur') });
    } catch (_) { setEtat({ k: 'erreur', m: tr('plus.cat.erreur') }); }
  };
  const retirer = async (cid) => {
    try { const r = await appeler('POST', { action: 'revoquer', cid }); if (r && r.ok) relire(); } catch (_) {}
  };
  const copier = async (url) => { try { await navigator.clipboard.writeText(url); setCopie(url); setTimeout(() => setCopie(''), 2000); } catch (_) {} };
  const partager = async (url) => { try { await navigator.share({ url, title: nom.trim() || tr('plus.cat.titre') }); } catch (_) {} };
  const actifs = Array.isArray(liens) ? liens.filter((l) => l.etat === 'actif') : [];
  return (
    <Feuille titre={tr('plus.cat.titre')} onClose={onClose} data-catalogue-feuille={etat.k} className="vrm-ui-feuille vrm-plus-feuille">
      <p className="vrm-plus-desc">{tr('plus.cat.desc')}</p>
      {etat.k === 'cree' ? (
        <section data-catalogue-cree="">
          <p className="vrm-plus-couv">{tr('plus.cat.cree', { n: etat.n })}{etat.absentes ? ' · ' + tr('plus.cat.absentes', { n: etat.absentes }) : ''}</p>
          <code className="vrm-plus-url" data-catalogue-url="">{etat.url}</code>
          <div className="vrm-plus-actions">
            {typeof navigator !== 'undefined' && navigator.share ? <button type="button" className="vrm-plus-lien" onClick={() => partager(etat.url)}>{tr('plus.cat.partager')}</button> : null}
            <button type="button" className="vrm-plus-principal" data-catalogue-copier="" onClick={() => copier(etat.url)}>{copie === etat.url ? tr('plus.cat.copie') : tr('plus.cat.copier')}</button>
          </div>
        </section>
      ) : (<>
        <label className="vrm-plus-champ">{tr('plus.cat.chercher')}<input type="search" data-catalogue-recherche="" value={q} onChange={(e) => setQ(e.target.value)}/></label>
        <p className="vrm-plus-couv" data-catalogue-choisis={String(choix.size)}>{tr('plus.cat.choisis', { n: choix.size })} · {tr('plus.cat.max', { n: MAX })}</p>
        {filtre.length ? <div className="vrm-plus-groupe vrm-plus-liste" data-catalogue-liste={String(filtre.length)}>
          {filtre.slice(0, 300).map((a) => { const on = choix.has(String(a.id)); return (
            <Ligne key={a.id} photo={a.photo || null} Photo={Photo || undefined} titre={a.titre || '—'} sous={[a.taille, a.prix != null ? a.prix : ''].filter(Boolean).join(' · ')}
              num={a.numero ? <span className="vrm-plus-couv" style={{ margin: 0, fontWeight: 700 }}>N°{a.numero}</span> : null}
              onClick={() => basculer(String(a.id))} chevron={false} aria-pressed={on} data-catalogue-item={String(a.id)}><Coche on={on}/></Ligne>
          ); })}
        </div> : <p className="vrm-plus-vide">{tr('plus.cat.aucune')}</p>}
        <h3 className="vrm-plus-entete">{tr('plus.cat.duree')}</h3>
        <div className="vrm-plus-segment" role="group" aria-label={tr('plus.cat.duree')}>
          {[1, 7, 30].map((j) => <button key={j} type="button" aria-pressed={jours === j} data-catalogue-jours={j} onClick={() => setJours(j)}>{tr('plus.cat.jours', { n: j })}</button>)}
        </div>
        <label className="vrm-plus-bascule"><span>{tr('plus.cat.numero')}</span><input type="checkbox" data-catalogue-numero="" checked={numero} onChange={(e) => setNumero(e.target.checked)}/></label>
        <label className="vrm-plus-champ">{tr('plus.cat.nom')}<input data-catalogue-nom="" value={nom} maxLength={60} onChange={(e) => setNom(e.target.value)}/></label>
        {etat.k === 'erreur' ? <p className="vrm-plus-erreur" role="alert">{etat.m}</p> : null}
        <div className="vrm-plus-actions">
          <button type="button" className="vrm-plus-principal" data-catalogue-creer="" disabled={!choix.size || etat.k === 'envoi'} onClick={creer}>{etat.k === 'envoi' ? tr('plus.cat.creation') : tr('plus.cat.creer')}</button>
        </div>
      </>)}
      <h3 className="vrm-plus-entete">{tr('plus.cat.liens')}</h3>
      {liens === undefined ? <p className="vrm-plus-vide" role="status">{tr('plus.cat.lecture')}</p> : liens === null ? <p className="vrm-plus-vide" role="alert">{tr('plus.cat.pasSu')}</p> : !liens.length ? <p className="vrm-plus-vide">{tr('plus.cat.aucunLien')}</p> : (
        <div className="vrm-plus-groupe" data-catalogue-liens={String(actifs.length)}>
          {liens.slice(0, 20).map((l) => (
            <Ligne key={l.cid} titre={l.titre || tr('plus.cat.titre')} sous={[tr('plus.cat.articles', { n: l.n }), l.etat === 'actif' ? tr('plus.cat.actif', { d: dateLangue(l.expire, { day: 'numeric', month: 'short' }) }) : l.etat === 'expire' ? tr('plus.cat.expire') : tr('plus.cat.revoque')].join(' · ')}
              chevron={false} data-catalogue-lien={l.cid} data-catalogue-etat={l.etat}>
              {l.etat === 'actif' ? <><button type="button" className="vrm-plus-lien" onClick={() => copier(l.url)}>{copie === l.url ? tr('plus.cat.copie') : tr('plus.cat.copierCourt')}</button>
                <button type="button" className="vrm-plus-lien" data-catalogue-retirer={l.cid} onClick={() => retirer(l.cid)}>{tr('plus.cat.retirer')}</button></> : null}
            </Ligne>
          ))}
        </div>
      )}
    </Feuille>
  );
}

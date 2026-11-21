// ════════════════════════════════════════════════════════════════════════════
//  RÉGLAGES → ABONNEMENT → PARTENAIRES (15 nov.) — JULIEN SEUL
//  Le programme partenaire : 3 € par mois et par client payant, à vie, Solo ou Pro.
//  Ici : créer un partenaire (nom, code, contact facultatif), le mettre en pause,
//  l'avantage de ses filleuls (coupon Stripe, éteint par défaut), son lien privé
//  (rendu UNE fois), ses chiffres mois par mois, « Versé » sur SON clic, l'export
//  CSV. Tout vient de `/api/compte?mode=partenaires` (le serveur calcule ; l'écran
//  formate des nombres, il ne compte rien). Jamais un client nommé : des nombres.
//  Trois états : `undefined` lecture · `null` pas su · l'objet lu.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, monnaie, date as dateLoc } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import { GroupeIos } from '../composants/Ios.jsx';
import './partenaires.css';

const eur = (c) => (Number.isFinite(c) ? monnaie(c / 100, 'EUR') : '—');
export const libelleMois = (m) => (/^\d{4}-\d{2}$/.test(String(m || '')) ? dateLoc(new Date(m + '-15T12:00:00Z'), { month: 'long', year: 'numeric' }) : '—');
const jourCourt = (iso) => (iso ? dateLoc(iso, { day: 'numeric', month: 'short' }) : '—');
const aujourdHui = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ERREURS = { nom: 'partenaires.erreur.nom', code: 'partenaires.erreur.code', 'code-pris': 'partenaires.erreur.codePris', contact: 'partenaires.erreur.contact', 'non-installe': 'partenaires.erreur.nonInstalle',
  'coupon-inconnu': 'partenaires.avantage.inconnu', coupon: 'partenaires.avantage.inconnu', stripe: 'partenaires.avantage.stripe', mois: 'partenaires.verse.erreur', date: 'partenaires.verse.erreur', montant: 'partenaires.verse.erreur' };
const erreurDe = (j) => tr(ERREURS[j && j.raison] || 'partenaires.erreur.ecriture');

// La phrase de Julien : « 23 clients payants · 69,00 € à lui verser pour octobre (au 14 nov.) ».
export function ligneResume(c, au) {
  const n = c && c.payantsActifs != null ? c.payantsActifs : '—';
  const p = c && c.prochainVersement;
  const t = p ? tr('partenaires.ligne', { n, m: eur(p.centimes), mois: libelleMois(p.mois) }) : tr('partenaires.ligneRien', { n });
  return `${t} (${tr('partenaires.au', { date: jourCourt(au) })})`;
}

function Copier({ texte, toast, data }) {
  const copier = async () => { try { await navigator.clipboard.writeText(texte); toast(tr('partenaires.copie')); } catch (_) { toast(tr('partenaires.copieImpossible')); } };
  return <button type="button" className="sb-touche" onClick={copier} {...data}>{tr('partenaires.copier')}</button>;
}

function Nouveau({ appel, onFait, onAnnuler }) {
  const [v, setV] = React.useState({ nom: '', code: '', contact: '' });
  const [msg, setMsg] = React.useState('');
  const [occupe, setOccupe] = React.useState(false);
  const code = String(v.code || '').trim().toUpperCase();
  const envoyer = async (e) => {
    e.preventDefault();
    if (occupe) return;
    setOccupe(true); setMsg('');
    const j = await appel({ action: 'creer', nom: v.nom, code: v.code, contact: v.contact });
    setOccupe(false);
    if (j && j.ok) onFait(j); else setMsg(erreurDe(j));
  };
  return (
    <form className="vrm-pt-form" onSubmit={envoyer} data-partenaire-form="">
      <label className="vrm-pt-champ"><span>{tr('partenaires.champ.nom')}</span>
        <input className="sb-champ" value={v.nom} maxLength={40} onChange={(e) => setV({ ...v, nom: e.target.value })} autoComplete="off" data-champ="nom"/>
        <small>{tr('partenaires.champ.nomAide')}</small></label>
      <label className="vrm-pt-champ"><span>{tr('partenaires.champ.code')}</span>
        <input className="sb-champ vrm-pt-code" value={v.code} maxLength={16} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} autoCapitalize="characters" autoComplete="off" data-champ="code"/>
        <small>{tr('partenaires.champ.codeAide', { lien: 'vrm.center/p/' + (code || '…') })}</small></label>
      <label className="vrm-pt-champ"><span>{tr('partenaires.champ.contact')}</span>
        <input className="sb-champ" value={v.contact} maxLength={120} onChange={(e) => setV({ ...v, contact: e.target.value })} autoComplete="off" data-champ="contact"/>
        <small>{tr('partenaires.champ.contactAide')}</small></label>
      {msg ? <p className="vrm-pt-refus" role="alert" data-partenaire-refus="">{msg}</p> : null}
      <div className="vrm-pt-gestes">
        <button type="submit" className="sb-touche" disabled={occupe} aria-busy={occupe || undefined} data-partenaire-creer="">{tr('partenaires.creer')}</button>
        <button type="button" className="sb-lien" onClick={onAnnuler}>{tr('partenaires.annuler')}</button>
      </div>
    </form>
  );
}

function Verse({ mois, reste, appel, onFait, onAnnuler }) {
  const [le, setLe] = React.useState(aujourdHui());
  const [m, setM] = React.useState(reste > 0 ? (reste / 100).toFixed(2).replace('.', ',') : '');
  const [msg, setMsg] = React.useState('');
  const [occupe, setOccupe] = React.useState(false);
  const envoyer = async (e) => {
    e.preventDefault();
    const centimes = Math.round(Number(String(m).replace(/\s/g, '').replace(',', '.')) * 100);
    if (!Number.isInteger(centimes) || centimes <= 0) { setMsg(tr('partenaires.verse.erreur')); return; }
    setOccupe(true); setMsg('');
    const j = await appel({ mois, le, centimes });
    setOccupe(false);
    if (j && j.ok) onFait(); else setMsg(erreurDe(j));
  };
  return (
    <form className="vrm-pt-form vrm-pt-verse" onSubmit={envoyer} data-verse-form={mois}>
      <p className="vrm-pt-form-titre">{tr('partenaires.verse.titre', { mois: libelleMois(mois) })}</p>
      <div className="vrm-pt-deux">
        <label className="vrm-pt-champ"><span>{tr('partenaires.verse.date')}</span><input className="sb-champ" type="date" value={le} max={aujourdHui()} onChange={(e) => setLe(e.target.value)} data-champ="le"/></label>
        <label className="vrm-pt-champ"><span>{tr('partenaires.verse.montant')}</span><input className="sb-champ" inputMode="decimal" value={m} onChange={(e) => setM(e.target.value)} data-champ="montant"/></label>
      </div>
      <small className="vrm-pt-aide">{tr('partenaires.verse.aide')}</small>
      {msg ? <p className="vrm-pt-refus" role="alert">{msg}</p> : null}
      <div className="vrm-pt-gestes">
        <button type="submit" className="sb-touche" disabled={occupe} aria-busy={occupe || undefined} data-verse-confirmer="">{tr('partenaires.verse.confirmer')}</button>
        <button type="button" className="sb-lien" onClick={onAnnuler}>{tr('partenaires.annuler')}</button>
      </div>
    </form>
  );
}

function Avantage({ p, appel, onFait, toast }) {
  const [ouvert, setOuvert] = React.useState(false);
  const [v, setV] = React.useState(p.coupon || '');
  const [msg, setMsg] = React.useState('');
  const poser = async (coupon) => {
    setMsg('');
    const j = await appel({ action: 'coupon', id: p.id, coupon });
    if (j && j.ok) { setOuvert(false); onFait(); toast(coupon ? tr('partenaires.avantage.pose', { coupon }) : tr('partenaires.avantage.eteint')); }
    else setMsg(erreurDe(j));
  };
  return (
    <div className="vrm-pt-bloc" data-avantage={p.coupon ? 'pose' : 'eteint'}>
      <div className="vrm-pt-bloc-tete"><span>{tr('partenaires.avantage.titre')}</span><b>{p.coupon || tr('partenaires.avantage.eteint')}</b></div>
      {ouvert ? (<>
        <input className="sb-champ" value={v} maxLength={64} onChange={(e) => setV(e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))} autoComplete="off" data-champ="coupon"/>
        <small className="vrm-pt-aide">{tr('partenaires.avantage.aide')}</small>
        {msg ? <p className="vrm-pt-refus" role="alert" data-avantage-refus="">{msg}</p> : null}
        <div className="vrm-pt-gestes">
          <button type="button" className="sb-touche" disabled={!v} onClick={() => poser(v)} data-avantage-poser="">{tr('partenaires.avantage.poser')}</button>
          {p.coupon ? <button type="button" className="sb-touche" onClick={() => poser(null)}>{tr('partenaires.avantage.retirer')}</button> : null}
          <button type="button" className="sb-lien" onClick={() => setOuvert(false)}>{tr('partenaires.annuler')}</button>
        </div>
      </>) : <button type="button" className="sb-lien" onClick={() => setOuvert(true)} data-avantage-ouvrir="">{tr('partenaires.avantage.choisir')}</button>}
    </div>
  );
}

function Fiche({ p, au, appel, recharger, toast, telecharger, lienNeuf, setLienNeuf }) {
  const c = p.chiffres || {};
  const tot = c.totaux || {};
  const [verse, setVerse] = React.useState('');
  const neuf = lienNeuf && lienNeuf.id === p.id ? lienNeuf.url : '';
  const action = async (corps) => appel({ ...corps, id: p.id });
  return (
    <div className="vrm-pt-fiche" data-partenaire-fiche={p.code}>
      <div className="sb-bande vrm-pt-bande" data-bande="">
        <span><b data-chiffre="inscrits">{c.inscrits ?? '—'}</b><span>{tr('partenaires.bande.inscrits')}</span></span>
        <span><b data-chiffre="payants">{c.payantsActifs ?? '—'}</b><span>{tr('partenaires.bande.payants')}</span></span>
        <span><b data-chiffre="reste" data-centimes={tot.resteCentimes ?? ''}>{eur(tot.resteCentimes)}</b><span>{tr('partenaires.bande.aVerser')}</span></span>
        <span><b data-chiffre="attente" data-centimes={tot.attenteCentimes ?? ''}>{eur(tot.attenteCentimes)}</b><span>{tr('partenaires.bande.attente')}</span></span>
      </div>

      <div className="vrm-pt-bloc">
        <div className="vrm-pt-bloc-tete"><span>{tr('partenaires.sonLien')}</span></div>
        <div className="vrm-pt-lien"><code data-lien-partenaire="">{p.lien}</code><Copier texte={p.lien} toast={toast}/></div>
      </div>

      <div className="vrm-pt-bloc" data-lien-prive={neuf ? 'montre' : p.lienPrivePose ? 'pose' : 'aucun'}>
        <div className="vrm-pt-bloc-tete"><span>{tr('partenaires.lienPrive.titre')}</span></div>
        {neuf ? (<>
          <div className="vrm-pt-lien"><code data-lien-prive-url="">{neuf}</code><Copier texte={neuf} toast={toast} data={{ 'data-copier-prive': '' }}/></div>
          <small className="vrm-pt-aide">{tr('partenaires.lienPrive.aide')}</small>
        </>) : (<>
          <button type="button" className="sb-touche" data-lien-prive-nouveau="" onClick={async () => { const j = await action({ action: 'lien' }); if (j && j.ok) setLienNeuf({ id: p.id, url: j.lienPrive }); else toast(erreurDe(j)); }}>{tr('partenaires.lienPrive.nouveau')}</button>
          {p.lienPrivePose ? <small className="vrm-pt-aide">{tr('partenaires.lienPrive.nouveauAide')}</small> : null}
        </>)}
      </div>

      <h4 className="vrm-pt-sous">{tr('partenaires.historique')}</h4>
      {!c.mois || !c.mois.length ? <p className="vrm-pt-aide" data-mois-vide="">{tr('partenaires.mois.vide')}</p> : (
        <ul className="vrm-pt-mois" data-mois-n={c.mois.length}>
          {c.mois.map((m) => (
            <li key={m.mois} data-mois={m.mois} data-reste={m.resteCentimes} data-due={m.dueCentimes} data-verse={m.verseCentimes}>
              <div className="vrm-pt-mois-ligne">
                <div className="vrm-pt-mois-texte">
                  <b>{libelleMois(m.mois)}</b>
                  {m.nDues > 0 || m.verseCentimes > 0 ? <span>{tr('partenaires.mois.detail', { n: m.nDues, v: eur(m.verseCentimes) })}</span> : null}
                  {m.attenteCentimes > 0 ? <span>{tr('partenaires.mois.attente', { m: eur(m.attenteCentimes), j: 14 })}</span> : null}
                  {m.nAnnulees > 0 ? <span data-annulees={m.nAnnulees}>{tr('partenaires.mois.annulees', { n: m.nAnnulees })}</span> : null}
                </div>
                <div className="vrm-pt-mois-valeur">
                  {m.resteCentimes > 0 ? <b className="sb-ambre">{tr('partenaires.mois.reste', { m: eur(m.resteCentimes) })}</b>
                    : m.resteCentimes < 0 ? <b className="sb-ambre" data-trop="">{tr('partenaires.mois.trop', { m: eur(-m.resteCentimes) })}</b>
                    : m.dueCentimes > 0 ? <span>{tr('partenaires.mois.solde')}</span> : null}
                  {m.resteCentimes > 0 && verse !== m.mois ? <button type="button" className="sb-touche" onClick={() => setVerse(m.mois)} data-verse-ouvrir={m.mois}>{tr('partenaires.verse')}</button> : null}
                </div>
              </div>
              {verse === m.mois ? <Verse mois={m.mois} reste={m.resteCentimes} appel={(x) => action({ action: 'verse', ...x })} onAnnuler={() => setVerse('')}
                onFait={() => { setVerse(''); toast(tr('partenaires.verse.ok')); recharger(); }}/> : null}
            </li>
          ))}
        </ul>
      )}

      <Avantage p={p} appel={appel} onFait={recharger} toast={toast}/>

      <div className="vrm-pt-bloc" data-pause={p.pause ? '1' : '0'}>
        <small className="vrm-pt-aide">{tr('partenaires.pause.aide')}</small>
        <div className="vrm-pt-gestes">
          <button type="button" className="sb-touche" aria-pressed={p.pause} data-pause-basculer="" onClick={async () => { const j = await action({ action: 'pause', pause: !p.pause }); if (j && j.ok) recharger(); else toast(erreurDe(j)); }}>
            {p.pause ? tr('partenaires.pause.reprendre') : tr('partenaires.pause.mettre')}</button>
          <button type="button" className="sb-lien" onClick={() => telecharger(p)} data-csv="">{tr('partenaires.csv')}</button>
        </div>
      </div>
    </div>
  );
}

export default function Partenaires({ enTete, toast = () => {} }) {
  useLangue();
  const [L, setL] = React.useState(undefined);
  const [ouvert, setOuvert] = React.useState('');
  const [nouveau, setNouveau] = React.useState(false);
  const [lienNeuf, setLienNeuf] = React.useState(null);
  const lire = React.useCallback(async () => {
    try {
      const r = await fetch('/api/compte?mode=partenaires', { headers: enTete(), cache: 'no-store' });
      const j = await r.json().catch(() => null);
      setL(r.ok && j && j.ok ? j : null);
    } catch (_) { setL(null); }
  }, [enTete]);
  React.useEffect(() => { lire(); }, [lire]);
  const appel = React.useCallback(async (corps) => {
    try {
      const r = await fetch('/api/compte?mode=partenaires', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTete() }, body: JSON.stringify(corps) });
      return await r.json().catch(() => ({ ok: false }));
    } catch (_) { return { ok: false }; }
  }, [enTete]);
  const telecharger = async (p) => {
    try {
      const r = await fetch(`/api/compte?mode=partenaires&csv=${encodeURIComponent(p.id)}`, { headers: enTete(), cache: 'no-store' });
      if (!r.ok) { toast(tr('partenaires.erreur.ecriture')); return; }
      const b = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = `partenaire-${p.code}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (_) { toast(tr('partenaires.erreur.ecriture')); }
  };
  const titre = tr('partenaires.titre');
  if (L === undefined) return null;
  if (L === null) return <GroupeIos titre={titre} data-partenaires="pas-su"><div className="vrm-pt-vide"><b>{tr('partenaires.pasLu')}</b><span>{tr('partenaires.pasLuDetail')}</span></div></GroupeIos>;
  if (!L.installe) return <GroupeIos titre={titre} data-partenaires="pas-installe"><div className="vrm-pt-vide"><b>{tr('partenaires.pasInstalle')}</b><span>{tr('partenaires.pasInstalleDetail')}</span></div></GroupeIos>;
  const liste = Array.isArray(L.partenaires) ? L.partenaires : [];
  const pied = tr('partenaires.pied', { m: eur(L.commissionCentimes), j: L.delaiJours });
  return (
    <div className="vrm-pt" data-partenaires="lu" data-partenaires-n={liste.length}>
      <GroupeIos titre={titre} pied={pied}>
        {!liste.length && !nouveau ? <div className="vrm-pt-vide"><b>{tr('partenaires.aucun')}</b></div> : null}
        {liste.map((p) => (
          <div key={p.id} className="vrm-pt-item" data-partenaire={p.code} data-pause={p.pause ? '1' : '0'}>
            <button type="button" className="sb-rangee vrm-pt-rangee" aria-expanded={ouvert === p.id} onClick={() => setOuvert(ouvert === p.id ? '' : p.id)} data-partenaire-ouvrir={p.code}>
              <span className="vrm-pt-rangee-texte">
                <span className="sb-rangee-titre">{p.nom} · {p.code}{p.pause ? <em className="vrm-pt-pause"> · {tr('partenaires.enPause')}</em> : null}</span>
                <span className="sb-rangee-meta vrm-pt-resume" data-resume="">{ligneResume(p.chiffres, L.au)}</span>
              </span>
              <svg className="vrm-pt-chevron" width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m1.5 1.5 5 5-5 5"/></svg>
            </button>
            {ouvert === p.id ? <Fiche p={p} au={L.au} appel={appel} recharger={lire} toast={toast} telecharger={telecharger} lienNeuf={lienNeuf} setLienNeuf={setLienNeuf}/> : null}
          </div>
        ))}
        {nouveau ? <Nouveau appel={appel} onAnnuler={() => setNouveau(false)}
          onFait={async (j) => { setNouveau(false); toast(tr('partenaires.cree')); setLienNeuf({ id: j.id, url: j.lienPrive }); setOuvert(j.id); await lire(); }}/> : (
          <div className="vrm-pt-gestes vrm-pt-ajout"><button type="button" className="sb-touche" onClick={() => setNouveau(true)} data-partenaire-nouveau="">{tr('partenaires.nouveau')}</button></div>
        )}
      </GroupeIos>
    </div>
  );
}

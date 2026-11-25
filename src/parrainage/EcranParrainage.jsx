// ════════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN « PARRAINAGE » (25 nov. 2026) — Julien : « Tu dois faire un vrai interface »
//  La règle (décision du 25 nov.) : le filleul a −10 % sur son 1er mois (+ 1 semaine
//  offerte), le parrain touche 20 % de chaque mois payé par son filleul, tant qu'il paie,
//  versé « sur son abonnement » ou « par virement » (son choix).
//  L'écran ne CALCULE rien : le serveur (api/_lib/parrainage-regle.js) rend des nombres,
//  l'écran les met en forme. Jamais l'identité d'un filleul (« Filleul 2 »).
//  Trois états partout : `undefined` lecture (squelette) · `null` pas su (« — » + raison) · lu.
//  Sections : héros (gagné au total, ce mois, 12 mois en barres) · partager (lien, Partager,
//  WhatsApp / Messages / Copier / QR, « Offert par … ») · comment ça marche · tes gains
//  (4 tuiles, historique par mois) · mon choix (crédit / virement, IBAN masqué) · tes
//  filleuls · côté filleul (« Offert par … : −10 % … ») · côté Julien (« Parrains à verser »).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import qrcode from 'qrcode-generator';
import { tr, monnaie, date as dateLoc } from '../i18n/index.js';
import { useLangue } from '../i18n/react.js';
import { Page, Groupe, Rangee, Bouton, Segmente, Feuille, Heros, ActionsRondes, Tuiles, Tuile, Barres, Vide, Pourquoi } from '../natif/index.js';
import { Icon, enTeteSession, useEstProprietaire, load, toast } from '../App.jsx';
import { lienParrainage } from '../abonnement/etatAbonnement.js';
import { SqCarte, SqBarre, SqChiffre } from '../Squelette.jsx';
import './parrainage.css';

const eur = (c) => (Number.isFinite(c) ? monnaie(c / 100, 'EUR') : '—');
const jour = (iso) => (iso ? dateLoc(String(iso).slice(0, 10) + 'T12:00:00Z', { day: 'numeric', month: 'short' }) : '');
const libelleMois = (m) => (/^\d{4}-\d{2}$/.test(String(m || '')) ? dateLoc(new Date(m + '-15T12:00:00Z'), { month: 'long', year: 'numeric' }) : '');
const lettreMois = (m) => (/^\d{4}-\d{2}$/.test(String(m || '')) ? dateLoc(new Date(m + '-15T12:00:00Z'), { month: 'narrow' }) : '');
const REGLE_DEFAUT = { pourcent: 20, remise: 10, joursOfferts: 7, seuilCentimes: 2000, delaiJours: 14 };
const ETAT_CLE = { attente: 'attente', verification: 'verification', credite: 'credite', 'a-crediter': 'aCrediter', 'a-verser': 'aVerser', verse: 'verse', annule: 'annule' };
const ETAT_FILLEUL = { inscrit: 'inscrit', paye: 'paye', 'attente-toi': 'paye', plafond: 'paye', offert: 'offert', refuse: 'refuse' };

// ── La lecture (partagée avec Réglages et l'écran d'abonnement) ─────────────
export async function lireParrainage(fetcher = fetch) {
  try {
    const r = await fetcher('/api/compte?mode=parrainage', { headers: enTeteSession(), cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.ok ? j : null;
  } catch (_) { return null; }
}
async function poster(corps) {
  try {
    const r = await fetch('/api/compte?mode=parrainage', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify(corps) });
    const j = await r.json().catch(() => null);
    return j || { ok: false };
  } catch (_) { return { ok: false }; }
}

// ── Le QR code du lien, dessiné ici (qrcode-generator, MIT, aucun service) ───
export function QrLien({ texte, taille = 208 }) {
  const cases = React.useMemo(() => {
    try { const q = qrcode(0, 'M'); q.addData(texte); q.make(); const n = q.getModuleCount(); const out = []; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) out.push(`M${x + 2} ${y + 2}h1v1h-1z`); return { n, d: out.join('') }; } catch (_) { return null; }
  }, [texte]);
  if (!cases) return null;
  const c = cases.n + 4;
  return (
    <svg className="vrm-pr-qr" viewBox={`0 0 ${c} ${c}`} width={taille} height={taille} role="img" aria-label={tr('parrain.qr.titre')} data-parrainage-qr="">
      <rect width={c} height={c} fill="#fff"/><path d={cases.d} fill="#111"/>
    </svg>
  );
}

// ── Le squelette, à la forme finale ─────────────────────────────────────────
function SqueletteParrainage() {
  return (
    <div className="vrm-pr" aria-busy="true" data-parrainage="lecture">
      <SqCarte h={232}><SqBarre l={110} h={12}/><SqChiffre l="52%" h={44}/><SqBarre l={130} h={12}/><div style={{ height: 70 }}/></SqCarte>
      <SqCarte h={190}><SqBarre l={80} h={12}/><SqBarre l="86%" h={20}/><SqBarre l="100%" h={48} r={14}/></SqCarte>
      <SqCarte h={150}>{[0, 1, 2].map((i) => <div key={i} className="vrm-pr-sq-ligne"><SqBarre l={40} h={40} r={20}/><SqBarre l="60%" h={14}/></div>)}</SqCarte>
    </div>
  );
}

// ── Le nom « Offert par … » (feuille) ───────────────────────────────────────
function FeuilleNom({ ouverte, nom, onFermer, onFait }) {
  const [v, setV] = React.useState('');
  const [msg, setMsg] = React.useState('');
  React.useEffect(() => { if (ouverte) { setV(nom || String(load('vrm_prenom', '') || '').trim().slice(0, 24)); setMsg(''); } }, [ouverte, nom]);
  const envoyer = async (valeur) => {
    const j = await poster({ action: 'nom', nom: valeur });
    if (j && j.ok) { onFait(j.nom || null); toast(tr('parrain.nom.fait')); onFermer(); } else setMsg((j && j.message) || tr('parrain.erreur.ecriture'));
  };
  return (
    <Feuille ouverte={ouverte} onFermer={onFermer} titre={tr('parrain.nom.titre')} attrs={{ 'data-parrainage-nom-form': '' }}
      pied={<Bouton variante="plein" indisponible={!v.trim()} onClick={() => envoyer(v)} attrs={{ 'data-parrainage-nom-enregistrer': '' }}>{tr('parrain.nom.enregistrer')}</Bouton>}>
      <label className="vrm-pr-champ"><span>{tr('parrain.nom.champ')}</span>
        <input className="vrm-pr-saisie" value={v} maxLength={24} autoComplete="given-name" onChange={(e) => { setV(e.target.value.slice(0, 24)); setMsg(''); }}/></label>
      <p className="vrm-pr-aide">{tr('parrain.nom.aide')}</p>
      {msg ? <p role="alert" className="vrm-pr-alerte" data-parrainage-nom-refus="">{msg}</p> : null}
      {nom ? <Bouton variante="texte" onClick={() => envoyer('')}>{tr('parrain.nom.retirer')}</Bouton> : null}
    </Feuille>
  );
}

// ── L'IBAN (feuille) : saisi ici, jamais relu en clair ───────────────────────
function FeuilleIban({ ouverte, onFermer, onFait }) {
  const [iban, setIban] = React.useState('');
  const [titulaire, setTitulaire] = React.useState('');
  const [msg, setMsg] = React.useState('');
  React.useEffect(() => { if (ouverte) { setIban(''); setTitulaire(''); setMsg(''); } }, [ouverte]);
  const envoyer = async () => {
    const j = await poster({ action: 'iban', iban, titulaire });
    if (j && j.ok) { onFait(j.iban); toast(tr('parrain.iban.fait')); onFermer(); }
    else setMsg(j && j.raison === 'iban' ? tr('parrain.iban.faux') : j && j.raison === 'titulaire' ? tr('parrain.iban.titulaireFaux') : tr('parrain.erreur.ecriture'));
  };
  return (
    <Feuille ouverte={ouverte} onFermer={onFermer} titre={tr('parrain.iban.titre')} attrs={{ 'data-parrainage-iban-form': '' }}
      pied={<Bouton variante="plein" indisponible={!iban.trim() || !titulaire.trim()} onClick={envoyer} attrs={{ 'data-parrainage-iban-enregistrer': '' }}>{tr('parrain.iban.enregistrer')}</Bouton>}>
      <label className="vrm-pr-champ"><span>{tr('parrain.iban.champ')}</span>
        <input className="vrm-pr-saisie vrm-pr-iban" value={iban} maxLength={42} autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text"
          onChange={(e) => { setIban(e.target.value.toUpperCase()); setMsg(''); }} placeholder="FR76 …"/></label>
      <label className="vrm-pr-champ"><span>{tr('parrain.iban.titulaire')}</span>
        <input className="vrm-pr-saisie" value={titulaire} maxLength={70} autoComplete="name" onChange={(e) => { setTitulaire(e.target.value); setMsg(''); }}/></label>
      <p className="vrm-pr-aide">{tr('parrain.iban.aide')}</p>
      {msg ? <p role="alert" className="vrm-pr-alerte" data-parrainage-iban-refus="">{msg}</p> : null}
    </Feuille>
  );
}

// ── TOUS LES FILLEULS (25 nov., Julien : « voir TOUS ses filleuls et tous les paiements possibles ») ──
// Une ligne par filleul : « Filleul 3 » (ou le prénom QU'IL a choisi de montrer), son état, le gagné,
// le mois prochain s'il paie, ce qu'il POURRAIT rapporter s'il ne paie pas encore (une estimation, dite).
const moisCourt = (m) => (/^\d{4}-\d{2}$/.test(String(m || '')) ? dateLoc(new Date(m + '-15T12:00:00Z'), { month: 'short', year: 'numeric' }) : '');
export function phraseFilleul(f) {
  const plan = f.plan === 'pro' ? tr('parrain.plan.pro') : tr('parrain.plan.solo');
  switch (f.etat) {
    case 'paie': return f.depuis ? tr('parrain.fl.etat.paie', { mois: moisCourt(f.depuis), plan }) : tr('parrain.fl.etat.paieSans', { plan });
    case 'essai': return f.jusquau ? tr('parrain.fl.etat.essai', { date: jour(f.jusquau) }) : tr('parrain.fl.etat.essaiSans');
    case 'arrete': return f.le ? tr('parrain.fl.etat.arrete', { date: jour(f.le) }) : tr('parrain.fl.etat.arreteSans');
    case 'rembourse': return tr('parrain.fl.etat.rembourse');
    case 'refuse': return tr('parrain.fl.etat.refuse');
    case 'inscrit': return tr('parrain.fl.etat.inscrit');
    default: return tr('parrain.fl.etat.pasSu');
  }
}
const nomFilleul = (f) => f.nom || tr('parrain.historique.ligne', { n: f.rang });
export function ListeFilleuls({ filleuls, onOuvrir, titre }) {
  if (!Array.isArray(filleuls) || !filleuls.length) return null;
  return (
    <Groupe titre={titre || tr('parrain.filleuls.titre')} attrs={{ 'data-filleuls': filleuls.length }}>
      {filleuls.map((f) => (
        <Rangee key={f.rang} titre={nomFilleul(f)} sousTitre={phraseFilleul(f)} sousLignes={2}
          valeur={eur(f.gagneCentimes)}
          detailValeur={f.prochainCentimes != null ? tr('parrain.fl.prochain', { m: eur(f.prochainCentimes) }) : f.pourraitCentimes != null ? tr('parrain.fl.pourrait', { m: eur(f.pourraitCentimes) }) : ''}
          fin="chevron" onClick={() => onOuvrir(f)} attrs={{ 'data-filleul': f.etat || 'pas-su', 'data-filleul-rang': f.rang, 'data-filleul-nom': f.nom || '' }}/>
      ))}
    </Groupe>
  );
}
export function FeuilleFilleul({ filleul: f, onFermer }) {
  return (
    <Feuille ouverte={!!f} onFermer={onFermer} titre={f ? nomFilleul(f) : ''} detentes={['moitie', 'pleine']} attrs={{ 'data-filleul-detail': f ? f.rang : '' }}>
      {f ? <>
        <p className="vrm-pr-fl-etat">{phraseFilleul(f)}</p>
        <Groupe>
          <Rangee titre={tr('parrain.fl.detail.moisPayes')} valeur={String(f.moisPayes)}/>
          <Rangee titre={tr('parrain.fl.detail.gagne')} valeur={eur(f.gagneCentimes)} valeurForte/>
          {f.prochainCentimes != null ? <Rangee titre={tr('parrain.fl.detail.prochain')} valeur={eur(f.prochainCentimes)}/> : null}
          {f.pourraitCentimes != null ? <Rangee titre={tr('parrain.fl.detail.pourrait')} valeur={`~${eur(f.pourraitCentimes)}`} attrs={{ 'data-estimation': '' }}/> : null}
        </Groupe>
        <Groupe titre={tr('parrain.fl.detail.paiements')} attrs={{ 'data-filleul-paiements': (f.paiements || []).length }}>
          {!(f.paiements || []).length ? <Rangee titre={tr('parrain.fl.detail.aucun')}/>
            : [...f.paiements].reverse().map((x, i) => (
              <Rangee key={i} titre={jour(x.payeLe)} sousTitre={[tr('parrain.fl.detail.paye', { m: eur(x.payeCentimes) }), tr('parrain.etat.' + (ETAT_CLE[x.etat] || 'attente')), x.etat === 'attente' ? tr('parrain.historique.du', { date: jour(x.dueLe) }) : ''].filter(Boolean).join(' · ')}
                valeur={eur(x.partCentimes)} attrs={{ 'data-paiement': x.etat }}/>
            ))}
        </Groupe>
      </> : null}
    </Feuille>
  );
}
// ── CÔTÉ FILLEUL : « Montrer mon prénom à mon parrain » (décoché par défaut, son choix) ──
function MontrerPrenom({ montrer, onChange }) {
  const [feuille, setFeuille] = React.useState(false);
  const [v, setV] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const actif = !!(montrer && montrer.montrer);
  const envoyer = async (oui, nom) => {
    const j = await poster({ action: 'montrer', montrer: oui, ...(oui ? { nom } : {}) });
    if (j && j.ok) { onChange({ montrer: !!j.montrer, nom: j.nom || null }); toast(tr(oui ? 'parrain.montrer.fait' : 'parrain.montrer.retire')); setFeuille(false); return true; }
    setMsg((j && j.message) || tr('parrain.erreur.ecriture')); return false;
  };
  return (
    <>
      <Groupe attrs={{ 'data-parrainage-montrer': actif ? '1' : '0' }}>
        <Rangee titre={tr('parrain.montrer.lib')} sousTitre={actif && montrer.nom ? montrer.nom : tr('parrain.montrer.aide')} sousLignes={2}
          interrupteur={{ actif, onChange: (oui) => { if (oui) { setV(String(load('vrm_prenom', '') || '').trim().slice(0, 24)); setMsg(''); setFeuille(true); } else envoyer(false); }, attrs: { 'data-parrainage-montrer-interrupteur': '' } }}/>
      </Groupe>
      <Feuille ouverte={feuille} onFermer={() => setFeuille(false)} titre={tr('parrain.montrer.titre')} attrs={{ 'data-parrainage-montrer-form': '' }}
        pied={<Bouton variante="plein" indisponible={!v.trim()} onClick={() => envoyer(true, v)} attrs={{ 'data-parrainage-montrer-enregistrer': '' }}>{tr('parrain.nom.enregistrer')}</Bouton>}>
        <label className="vrm-pr-champ"><span>{tr('parrain.nom.champ')}</span>
          <input className="vrm-pr-saisie" value={v} maxLength={24} autoComplete="given-name" onChange={(e) => { setV(e.target.value.slice(0, 24)); setMsg(''); }}/></label>
        <p className="vrm-pr-aide">{tr('parrain.nom.aide')}</p>
        {msg ? <p role="alert" className="vrm-pr-alerte" data-parrainage-montrer-refus="">{msg}</p> : null}
      </Feuille>
    </>
  );
}

// ── CÔTÉ JULIEN : « Parrains à verser » ─────────────────────────────────────
export function ParrainsAVerser({ fetcher = fetch }) {
  useLangue();
  const [l, setL] = React.useState(undefined);
  const [confirme, setConfirme] = React.useState('');
  const [detail, setDetail] = React.useState(null);   // { parrain, vue } · { parrain, vue: undefined } en lecture · null
  const [filleul, setFilleul] = React.useState(null);
  const ouvrirParrain = async (x) => {
    setDetail({ ...x, vue: undefined });
    try {
      const r = await fetcher('/api/compte?mode=partenaires&vue=parrain&id=' + encodeURIComponent(x.parrain), { headers: enTeteSession(), cache: 'no-store' });
      const j = r.ok ? await r.json() : null;
      setDetail({ ...x, vue: j && j.ok ? j.vue : null });
    } catch (_) { setDetail({ ...x, vue: null }); }
  };
  const lire = React.useCallback(async () => {
    try {
      const r = await fetcher('/api/compte?mode=partenaires&vue=parrains', { headers: enTeteSession(), cache: 'no-store' });
      const j = r.ok ? await r.json() : null;
      setL(j && j.ok ? j : null);
    } catch (_) { setL(null); }
  }, [fetcher]);
  React.useEffect(() => { lire(); }, [lire]);
  const verse = async (p) => {
    const d = new Date(); const le = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    try {
      const r = await fetch('/api/compte?mode=partenaires', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTeteSession() }, body: JSON.stringify({ action: 'verse-parrain', parrain: p.parrain, centimes: p.centimes, le }) });
      const j = await r.json().catch(() => null);
      if (j && j.ok) { toast(tr('parrain.admin.fait')); setConfirme(''); lire(); } else toast(tr('parrain.erreur.ecriture'));
    } catch (_) { toast(tr('parrain.erreur.ecriture')); }
  };
  if (l === undefined) return <SqCarte h={120}>{[0, 1].map((i) => <div key={i} className="vrm-pr-sq-ligne"><SqBarre l={40} h={40} r={20}/><SqBarre l="55%" h={14}/></div>)}</SqCarte>;
  if (l === null) return <Groupe titre={tr('parrain.admin.titre')} attrs={{ 'data-parrains-verser': 'pas-su' }}><Rangee titre={tr('parrain.erreur.phrase')} sousTitre={tr('parrain.erreur.detail')} valeur="—"/></Groupe>;
  if (!l.installe) return <Groupe titre={tr('parrain.admin.titre')} attrs={{ 'data-parrains-verser': 'non-installe' }}><Rangee titre={tr('parrain.admin.nonInstalle')} valeur="—"/></Groupe>;
  return (
    <section className="vrm-pr-admin" data-parrains-verser={l.parrains.length} data-total-centimes={l.totalCentimes}>
      <Heros titre={tr('parrain.admin.titre')} valeur={eur(l.totalCentimes)} sous={tr('parrain.admin.total')} attrs={{ 'data-parrains-total': '' }}/>
      <Groupe>
        {!l.parrains.length ? <Rangee titre={tr('parrain.admin.vide')}/> : l.parrains.map((p) => (
          <div key={p.parrain} className="vrm-pr-admin-ligne" data-parrain-verser={p.pret ? 'pret' : 'sous-seuil'}>
            <Rangee icone={<Icon name="euro" size={22}/>} titre={p.nom || p.email || '—'} sousLignes={2}
              sousTitre={[p.email && p.nom ? p.email : '', p.depuis ? tr('parrain.admin.depuis', { date: jour(p.depuis) }) : '', p.pret ? '' : tr('parrain.admin.sousSeuil', { seuil: eur(l.seuilCentimes) })].filter(Boolean).join(' · ')}
              valeur={eur(p.centimes)} valeurForte/>
            <div className="vrm-pr-admin-iban">{p.iban ? <><code data-parrain-iban={p.iban}>{String(p.iban).replace(/(.{4})(?=.)/g, '$1 ')}</code>{p.titulaire ? <span> · {p.titulaire}</span> : null}</> : <span>{tr('parrain.admin.ibanManque')}</span>}</div>
            {p.pret ? (confirme === p.parrain
              ? <Bouton variante="teinte" large onClick={() => verse(p)} attrs={{ 'data-parrain-verse-confirmer': '' }}>{tr('parrain.admin.confirmer', { m: eur(p.centimes) })}</Bouton>
              : <Bouton variante="teinte" large icone={<Icon name="check" size={18}/>} onClick={() => setConfirme(p.parrain)} attrs={{ 'data-parrain-verse': '' }}>{tr('parrain.admin.verse')}</Bouton>) : null}
          </div>
        ))}
      </Groupe>
      {Array.isArray(l.tous) && l.tous.length ? (
        <Groupe titre={tr('parrain.admin.tous')} attrs={{ 'data-parrains-tous': l.tous.length }}>
          {l.tous.map((x) => (
            <Rangee key={x.parrain} icone={<Icon name="users" size={22}/>} titre={x.nom || x.email || '—'} sousTitre={tr('parrain.admin.tousLigne', { f: x.filleuls, p: x.payants })}
              valeur={eur(x.gagneCentimes)} fin="chevron" onClick={() => ouvrirParrain(x)} attrs={{ 'data-parrain-tous': x.parrain }}/>
          ))}
        </Groupe>
      ) : null}
      <Feuille ouverte={!!detail} onFermer={() => setDetail(null)} titre={detail ? (detail.nom || detail.email || '—') : ''} detentes={['moitie', 'pleine']} attrs={{ 'data-parrain-detail': detail ? detail.parrain : '' }}>
        {detail && detail.vue === undefined ? <SqCarte h={120}><SqBarre l="60%" h={14}/><SqBarre l="40%" h={14}/></SqCarte>
          : detail && detail.vue && detail.vue.installe ? <ListeFilleuls filleuls={detail.vue.filleuls} onOuvrir={setFilleul}/>
          : detail ? <Rangee titre={tr('parrain.erreur.phrase')} valeur="—"/> : null}
      </Feuille>
      <FeuilleFilleul filleul={filleul} onFermer={() => setFilleul(null)}/>
    </section>
  );
}

// ── CÔTÉ FILLEUL : « Offert par … : −10 % … » ───────────────────────────────
export function CarteFilleul({ filleul, regle = REGLE_DEFAUT, compacte = false, montrer = undefined, onMontrer = null }) {
  if (!filleul || !filleul.parraine) return null;
  const nom = filleul.offertPar || tr('parrain.nom.vide');
  const etat = filleul.moisOffert ? tr('parrain.filleul.fait') : filleul.attendVinted ? tr('parrain.filleul.attendVinted') : tr('parrain.filleul.auPaiement');
  return (
    <section className="vrm-pr-filleul" data-compacte={compacte ? '' : undefined} data-parraine={filleul.moisOffert ? 'offert' : filleul.attendVinted ? 'attend-vinted' : 'en-cours'}>
      <span className="vrm-pr-filleul-ic" aria-hidden="true"><Icon name="cadeau" size={26}/></span>
      <span className="vrm-pr-filleul-corps">
        <b>{tr('parrain.filleul.titre', { nom })}</b>
        <span className="vrm-pr-filleul-offre">{tr('parrain.filleul.offre', { remise: regle.remise })}</span>
        {!compacte ? <span className="vrm-pr-filleul-etat">{etat}</span> : null}
      </span>
    </section>
  );
}
function BlocFilleul({ filleul, regle, montrer, onMontrer }) {
  return <div className="vrm-pr-bloc-filleul"><CarteFilleul filleul={filleul} regle={regle}/>{montrer !== null ? <MontrerPrenom montrer={montrer} onChange={onMontrer}/> : null}</div>;
}
// Pour l'écran d'abonnement : la remise du filleul, visible avant de payer (lue une fois).
export function useFilleulParraine() {
  const [f, setF] = React.useState(undefined);
  React.useEffect(() => { let mort = false; lireParrainage().then((p) => { if (!mort) setF(p && p.ouvert && p.filleul && p.filleul.parraine ? { filleul: p.filleul, regle: p.regle || REGLE_DEFAUT } : null); }); return () => { mort = true; }; }, []);
  return f;
}

// ── L'ÉCRAN ─────────────────────────────────────────────────────────────────
export default function EcranParrainage({ fetcher = fetch }) {
  useLangue();
  const proprio = useEstProprietaire();
  const [p, setP] = React.useState(undefined);
  const [moisChoisi, setMoisChoisi] = React.useState(-1);
  const [feuille, setFeuille] = React.useState('');
  const [copie, setCopie] = React.useState(false);
  const [detailFilleul, setDetailFilleul] = React.useState(null);
  const lire = React.useCallback(() => lireParrainage(fetcher).then(setP), [fetcher]);
  React.useEffect(() => { lire(); }, [lire]);

  if (p === undefined) return <Page titre={tr('parrain.titre')}><SqueletteParrainage/></Page>;
  if (p === null) return (
    <Page titre={tr('parrain.titre')}>
      <div className="vrm-pr" data-parrainage="pas-su">
        <Vide icone={<Icon name="cadeau" size={40}/>} phrase={tr('parrain.erreur.phrase')} detail={tr('parrain.erreur.detail')}
          action={<Bouton variante="teinte" onClick={() => { setP(undefined); lire(); }}>{tr('parrain.reessayer')}</Bouton>}/>
      </div>
    </Page>
  );
  if (!p.installe || !p.ouvert) return (
    <Page titre={tr('parrain.titre')}>
      <div className="vrm-pr" data-parrainage="ferme">
        <div className="vrm-pr-bientot">
          <span className="vrm-pr-bientot-ic" aria-hidden="true"><Icon name="cadeau" size={44}/></span>
          <h2>{tr('parrain.ferme.phrase')}</h2>
          <p>{tr('parrain.ferme.detail')}</p>
          <ol className="vrm-pr-etapes vrm-pr-etapes-seules">{etapes(p.regle || REGLE_DEFAUT)}</ol>
        </div>
        {proprio ? <p className="vrm-pr-aide" data-parrainage-geste="">{!p.installe ? tr('parrain.ferme.nonInstalle') : tr('parrain.ferme.proprio')}</p> : null}
        {proprio ? <ParrainsAVerser fetcher={fetcher}/> : null}
      </div>
    </Page>
  );

  const regle = p.regle || REGLE_DEFAUT;
  const lien = lienParrainage(p.code);
  const g = p.gains && p.gains.installe ? p.gains : null;
  const c = g ? g.chiffres : null;
  const mode = g ? g.mode : 'credit';
  const filleuls = Array.isArray(p.filleuls) ? p.filleuls : null;
  const aucun = filleuls && !filleuls.length;
  const texte = tr('parrain.partager.texte');
  const peutPartager = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const copier = async () => {
    try { await navigator.clipboard.writeText(lien); setCopie(true); toast(tr('parrain.partager.copie')); setTimeout(() => setCopie(false), 1800); }
    catch (_) { toast(tr('parrain.partager.copieImpossible')); }
  };
  const partager = async () => {
    if (!peutPartager) return copier();
    try { await navigator.share({ title: tr('parrain.partager.titrePartage'), text: texte, url: lien }); } catch (e) { if (!(e && e.name === 'AbortError')) copier(); }
  };
  const ouvrirLien = (url) => { try { window.open(url, '_blank', 'noopener'); } catch (_) {} };
  const choisir = async (m) => {
    if (m === mode) return;
    setP((x) => ({ ...x, gains: { ...x.gains, mode: m } }));
    const j = await poster({ action: 'choix', mode: m });
    if (j && j.ok) toast(tr('parrain.choix.fait')); else { toast(tr('parrain.erreur.ecriture')); lire(); }
  };
  const parMois = c ? c.parMois : [];
  const choisie = moisChoisi >= 0 ? moisChoisi : parMois.length - 1;
  const detailMois = parMois[choisie] ? tr('parrain.heros.detailMois', { mois: libelleMois(parMois[choisie].mois), m: eur(parMois[choisie].centimes), n: parMois[choisie].n }) : '';
  // L'historique, groupé par mois de paiement.
  const groupes = [];
  for (const h of c ? c.historique : []) { const d = groupes[groupes.length - 1]; if (d && d.mois === h.mois) d.lignes.push(h); else groupes.push({ mois: h.mois, lignes: [h] }); }

  return (
    <Page titre={tr('parrain.titre')} plein={aucun ? null : <Bouton variante="plein" icone={<Icon name="send" size={18}/>} onClick={partager} attrs={{ 'data-partager-parrainage': '' }}>{tr('parrain.partager.bouton')}</Bouton>}>
      <div className="vrm-pr" data-parrainage="ouvert" data-mode={mode} data-parrainage-test={p.modeTest ? '1' : undefined}
        data-total-centimes={c ? c.totalCentimes : ''} data-filleuls-payants={c && c.filleulsPayants != null ? c.filleulsPayants : ''}>
        {p.modeTest ? <p className="vrm-pr-test">{tr('parrain.test')}</p> : null}
        {p.filleul && p.filleul.parraine ? <BlocFilleul filleul={p.filleul} regle={regle} montrer={p.montrer === undefined ? null : p.montrer} onMontrer={(m) => setP((x) => ({ ...x, montrer: m }))}/> : null}

        {/* 1. Le héros : gagné au total, ce mois, 12 mois en barres. */}
        <Heros className="vrm-pr-heros" titre={tr('parrain.heros.titre')} valeur={c ? eur(c.totalCentimes) : null}
          sous={c ? tr('parrain.heros.mois', { m: eur(c.moisCentimes) }) : tr('parrain.gainsNonInstalle')} attrs={{ 'data-parrainage-heros': '' }}
          trio={g && g.potentiel ? [
            { cle: 'potentiel', libelle: tr('parrain.potentiel.lib'), valeur: `~${eur(g.potentiel.moisCentimes)}`, pourquoi: tr('parrain.potentiel.estime'), attrs: { 'data-estimation': 'potentiel', 'data-centimes': g.potentiel.moisCentimes } },
            { cle: 'sitous', libelle: tr('parrain.potentiel.siTous'), valeur: `~${eur(g.potentiel.siTousCentimes)}`, pourquoi: tr('parrain.potentiel.estime'), attrs: { 'data-estimation': 'si-tous', 'data-centimes': g.potentiel.siTousCentimes } },
          ] : []}
          action={<span className="vrm-pr-heros-ic" aria-hidden="true"><Icon name="cadeau" size={22}/></span>}
          graphe={c ? <div className="vrm-pr-barres">
            <Barres libelle={tr('parrain.heros.graphe')} choisie={choisie} onChoisir={setMoisChoisi}
              barres={parMois.map((x) => ({ cle: x.mois, lettre: lettreMois(x.mois), libelle: `${libelleMois(x.mois)} · ${eur(x.centimes)}`, valeur: x.centimes }))}/>
            <p className="vrm-pr-barres-detail" aria-live="polite" data-parrainage-mois={parMois[choisie] ? parMois[choisie].mois : ''}>{detailMois}</p>
          </div> : null}/>

        {/* 2. Partager. */}
        <section className="vrm-pr-carte vrm-pr-partage" aria-label={tr('parrain.partager.libelle')}>
          <h2 className="vrm-pr-titre">{tr('parrain.partager.titre')}</h2>
          <button type="button" className="vrm-pr-lien" onClick={copier} data-lien-parrainage="" aria-label={`${tr('parrain.partager.copier')} ${lien}`}>
            <span className="vrm-pr-lien-texte">{lien.replace(/^https:\/\//, '')}</span>
            <span className="vrm-pr-lien-ic" aria-hidden="true"><Icon name={copie ? 'check' : 'copy'} size={18}/></span>
          </button>
          {aucun ? <Bouton variante="plein" icone={<Icon name="send" size={18}/>} onClick={partager} attrs={{ 'data-partager-parrainage': '' }}>{tr('parrain.partager.bouton')}</Bouton> : null}
          <ActionsRondes libelle={tr('parrain.partager.libelle')} elements={[
            { cle: 'wa', libelle: tr('parrain.partager.whatsapp'), icone: <Icon name="chat" size={22}/>, onClick: () => ouvrirLien('https://wa.me/?text=' + encodeURIComponent(texte + ' ' + lien)), attrs: { 'data-partager-whatsapp': '' } },
            { cle: 'sms', libelle: tr('parrain.partager.messages'), icone: <Icon name="mail" size={22}/>, onClick: () => ouvrirLien('sms:?&body=' + encodeURIComponent(texte + ' ' + lien)), attrs: { 'data-partager-sms': '' } },
            { cle: 'copier', libelle: copie ? tr('parrain.partager.copie') : tr('parrain.partager.copier'), icone: <Icon name={copie ? 'check' : 'copy'} size={22}/>, onClick: copier, attrs: { 'data-copier-parrainage': '' } },
            { cle: 'qr', libelle: tr('parrain.partager.qr'), icone: <Icon name="qr" size={22}/>, onClick: () => setFeuille('qr'), attrs: { 'data-parrainage-qr-ouvrir': '' } },
          ]}/>
          <Groupe>
            <Rangee icone={<Icon name="users" size={22}/>} titre={tr('parrain.nom.lib')} valeur={p.nom === undefined ? '—' : (p.nom || tr('parrain.nom.vide'))} fin="chevron"
              onClick={() => setFeuille('nom')} attrs={{ 'data-parrainage-nom-ouvrir': '', 'data-parrainage-nom': p.nom || '' }}/>
          </Groupe>
        </section>

        {aucun ? <Vide icone={<Icon name="users" size={40}/>} phrase={tr('parrain.vide.phrase')} detail={tr('parrain.vide.detail')}/> : null}

        {/* 3. Comment ça marche. */}
        <section className="vrm-pr-carte" data-parrainage-etapes="">
          <h2 className="vrm-pr-titre">{tr('parrain.etapes.titre')}</h2>
          <ol className="vrm-pr-etapes">{etapes(regle)}</ol>
          <Pourquoi>{tr('parrain.pourquoi', { pct: regle.pourcent, remise: regle.remise, j: regle.delaiJours })}</Pourquoi>
        </section>

        {/* 4. Tes gains. */}
        {c ? (
          <Tuiles titre={tr('parrain.gains.titre')} attrs={{ 'data-parrainage-gains': '' }}>
            <Tuile libelle={tr('parrain.tuile.payants')} valeur={c.filleulsPayants == null ? null : String(c.filleulsPayants)} detail={tr('parrain.tuile.payantsDetail', { n: c.filleulsAyantPaye })} attrs={{ 'data-tuile': 'payants' }}/>
            <Tuile libelle={tr('parrain.tuile.mois')} valeur={eur(c.moisCentimes)} detail={tr('parrain.tuile.moisDetail')} attrs={{ 'data-tuile': 'mois' }}/>
            <Tuile libelle={tr('parrain.tuile.attente')} valeur={eur(c.attenteCentimes)} detail={tr('parrain.tuile.attenteDetail', { j: regle.delaiJours })} attrs={{ 'data-tuile': 'attente' }}/>
            {mode === 'virement'
              ? <Tuile libelle={tr('parrain.tuile.verse')} valeur={eur(c.verseCentimes)} detail={tr('parrain.tuile.aVerser', { m: eur(c.aVerserCentimes) })} attrs={{ 'data-tuile': 'verse' }}/>
              : <Tuile libelle={tr('parrain.tuile.credite')} valeur={eur(c.crediteCentimes)} detail={tr('parrain.tuile.creditePhrase')} attrs={{ 'data-tuile': 'credite' }}/>}
          </Tuiles>
        ) : null}

        {/* 5. Mon choix. */}
        {g ? (
          <section className="vrm-pr-carte" data-parrainage-choix={mode}>
            <h2 className="vrm-pr-titre">{tr('parrain.choix.titre')}</h2>
            <Segmente libelle={tr('parrain.choix.libelle')} valeur={mode} onChange={choisir}
              options={[{ cle: 'credit', libelle: tr('parrain.choix.credit'), attrs: { 'data-choix': 'credit' } }, { cle: 'virement', libelle: tr('parrain.choix.virement'), attrs: { 'data-choix': 'virement' } }]}/>
            <p className="vrm-pr-phrase">{mode === 'virement' ? tr('parrain.choix.virementPhrase', { seuil: eur(regle.seuilCentimes) }) : tr('parrain.choix.creditPhrase')}</p>
            {mode === 'virement' ? (
              <Groupe>
                <Rangee titre={tr('parrain.choix.pret')} valeur={eur(c.aVerserCentimes)} valeurForte={c.virementPret} attrs={{ 'data-parrainage-pret': c.virementPret ? '1' : '0' }}/>
                <Rangee titre={tr('parrain.choix.seuil')} valeur={eur(regle.seuilCentimes)}/>
                <Rangee titre={tr('parrain.choix.iban')} valeur={g.iban || tr('parrain.choix.ibanVide')} fin="chevron" onClick={() => setFeuille('iban')} attrs={{ 'data-parrainage-iban': g.iban || '' }}/>
              </Groupe>
            ) : null}
          </section>
        ) : null}

        {/* 6. L'historique, par mois (jamais qui). */}
        {c ? (
          <div className="vrm-pr-historique" data-parrainage-historique={c.historique.length}>
            {!groupes.length ? <Groupe titre={tr('parrain.historique.titre')}><Rangee titre={tr('parrain.historique.vide')}/></Groupe>
              : groupes.map((gm, i) => (
                <Groupe key={gm.mois} titre={i === 0 ? `${tr('parrain.historique.titre')} · ${libelleMois(gm.mois)}` : libelleMois(gm.mois)}>
                  {gm.lignes.map((h, k) => (
                    <Rangee key={k} titre={tr('parrain.historique.ligne', { n: h.filleul || '—' })}
                      sousTitre={[tr('parrain.historique.du', { date: jour(h.dueLe) }), tr('parrain.etat.' + (ETAT_CLE[h.etat] || 'attente')), h.reduit ? tr('parrain.historique.reduit') : ''].filter(Boolean).join(' · ')}
                      valeur={eur(h.centimes)} attrs={{ 'data-gain': h.etat }}/>
                  ))}
                </Groupe>
              ))}
          </div>
        ) : null}

        {/* 7. Tes filleuls : une ligne par filleul (état, gagné, prochain / possible), détail au toucher. */}
        {g && Array.isArray(g.filleuls) && g.filleuls.length ? <ListeFilleuls filleuls={g.filleuls} onOuvrir={setDetailFilleul}/> : filleuls && filleuls.length ? (
          <Groupe titre={tr('parrain.filleuls.titre')} attrs={{ 'data-filleuls': filleuls.length }}>
            {filleuls.map((x) => (
              <Rangee key={x.rang} titre={tr('parrain.filleuls.ligne', { n: x.rang })} sousTitre={x.inscritLe ? tr('parrain.filleuls.inscrit', { date: jour(x.inscritLe) }) : ''}
                valeur={tr('parrain.filleuls.etat.' + (ETAT_FILLEUL[x.etat] || 'inscrit'))} attrs={{ 'data-filleul': x.etat }}/>
            ))}
          </Groupe>
        ) : null}

        {proprio ? <ParrainsAVerser fetcher={fetcher}/> : null}
      </div>

      <Feuille ouverte={feuille === 'qr'} onFermer={() => setFeuille('')} titre={tr('parrain.qr.titre')}>
        <div className="vrm-pr-qr-boite"><QrLien texte={lien}/><p>{tr('parrain.qr.phrase')}</p><code>{lien.replace(/^https:\/\//, '')}</code></div>
      </Feuille>
      <FeuilleNom ouverte={feuille === 'nom'} nom={p.nom} onFermer={() => setFeuille('')} onFait={(nom) => setP((x) => ({ ...x, nom }))}/>
      <FeuilleFilleul filleul={detailFilleul} onFermer={() => setDetailFilleul(null)}/>
      <FeuilleIban ouverte={feuille === 'iban'} onFermer={() => setFeuille('')} onFait={(iban) => setP((x) => ({ ...x, gains: { ...x.gains, iban } }))}/>
    </Page>
  );
}

function etapes(regle) {
  const e = [
    { ic: 'link', t: tr('parrain.etapes.1') },
    { ic: 'cadeau', t: tr('parrain.etapes.2', { remise: regle.remise }) },
    { ic: 'euro', t: tr('parrain.etapes.3', { pct: regle.pourcent }) },
  ];
  return e.map((x, i) => (
    <li key={i} className="vrm-pr-etape"><span className="vrm-pr-etape-ic" aria-hidden="true"><Icon name={x.ic} size={20}/></span><span className="vrm-pr-etape-n" aria-hidden="true">{i + 1}</span><span className="vrm-pr-etape-t">{x.t}</span></li>
  ));
}

// ── ACHATS : FOURNISSEURS · DÉLAI · LOTS (4 nov.) — règles : src/achatsSourcing.js ──
// Trois entrées sobres sous la carte d'Achats ; chacune ouvre une feuille.
// Rien n'est calculé ici (l'app passe les résultats des règles) et rien n'est
// écrit sans SON clic : « Relier », « Enregistrer », « Annuler », « C'est un lot ».
// Aucun texte explicatif : des titres, des nombres, des gestes.
// (5 nov.) Fournisseurs = les personnes QU'IL crée (src/fournisseurs.js), jamais
// les vendeurs Vinted chez qui il a acheté.
import React from 'react';
import { createPortal } from 'react-dom';
import { etatRepartition, partsEgales } from './achatsSourcing.js';
import { etatSaisieGros, baseRepartition, eurosC, texteDepense, texteMoyen, texteBeneficeFournisseur, texteCouverture, texteRelies } from './fournisseurs.js';
import './styles-annonces-outils.css';
import './styles-achats-outils.css';

const eurC = (c) => {
  if (c == null || !Number.isFinite(c)) return '—';
  const n = Math.abs(c), e = Math.floor(n / 100), r = n % 100;
  const ent = String(e).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (c < 0 ? '−' : '') + ent + (r ? ',' + String(r).padStart(2, '0') : '') + ' €';
};
const signeC = (c) => (c == null ? '—' : (c >= 0 ? '+' : '') + eurC(c));
const jours = (j) => (j == null ? '—' : `${Math.round(j * 10) / 10}`.replace('.', ',') + ' j');
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const nomMois = (k) => { const [a, m] = String(k).split('-'); const n = MOIS[Number(m) - 1] || k; return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + a; };
const pl = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;

function Feuille({ titre, data, onFermer, Retour, children, droite }) {
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onFermer(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onFermer]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="vrm-ao-voile vrm-aso-voile" {...data} onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      {Retour ? <Retour fermer={onFermer}/> : null}
      <div className="vrm-ao-feuille vrm-aso-feuille" role="dialog" aria-modal="true" aria-label={titre}>
        <header className="vrm-ao-tete">
          <h2>{titre}</h2>
          {droite || null}
          <button type="button" className="vrm-ao-x" aria-label="Fermer" data-aso-fermer="" onClick={onFermer}>×</button>
        </header>
        {children}
      </div>
    </div>, document.body);
}

function Choix({ label, value, options, onChange, data }) {
  return (
    <div role="group" aria-label={label} className="vrm-aso-seg" {...(data || {})}>
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} disabled={!!o.disabled} onClick={() => onChange(o.v)} {...(o.data || {})}>{o.l}</button>
      ))}
    </div>
  );
}

function Vignette({ src, Photo }) {
  return src && Photo ? <span className="vrm-aso-photo">{Photo(src)}</span> : <span className="vrm-aso-photo" aria-hidden="true"/>;
}

// ── 1. Fournisseurs : les personnes QU'IL crée (5 nov., src/fournisseurs.js) ──
// Julien : « c'est une personne à qui tu achètes en gros pas des vendeurs
// particuliers sur vinted ». Aucun vendeur Vinted n'entre ici : la liste vient
// du registre qu'il remplit (`vrm_fournisseurs`). Un achat en gros se crée
// depuis la fiche du fournisseur ; ses paires se relient à leurs N° par SON tap ;
// leur prix vient de SA répartition, et un prix saisi à la main n'est remplacé
// que s'il dit oui (la question est posée par l'app).
const jourLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const dateCourte = (d) => { const t = Date.parse(String(d || '') + 'T12:00:00'); return Number.isFinite(t) ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'date inconnue'; };
const enSaisie = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));

function Champ({ label, value, onChange, type = 'text', inputMode, placeholder, data, multi, autoComplete = 'off' }) {
  return (
    <label className="vrm-fo-champ">
      <span>{label}</span>
      {multi
        ? <textarea rows={3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} {...(data || {})}/>
        : <input type={type} inputMode={inputMode} autoComplete={autoComplete} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} {...(data || {})}/>}
    </label>
  );
}

function FormFournisseur({ depart, onEnregistrer, onAnnuler }) {
  const [c, setC] = React.useState(() => ({ nom: (depart && depart.nom) || '', tel: (depart && depart.tel) || '', email: (depart && depart.email) || '', note: (depart && depart.note) || '' }));
  const [err, setErr] = React.useState('');
  const [envoi, setEnvoi] = React.useState(false);
  const champ = (k) => (v) => { setErr(''); setC((x) => ({ ...x, [k]: v })); };
  const envoyer = async () => { if (envoi) return; setEnvoi(true); const r = await onEnregistrer(c); setEnvoi(false); if (r && r.erreur) setErr(r.erreur); };
  return (
    <div className="vrm-fo-form" data-fo-form="fournisseur">
      <Champ label="Nom" value={c.nom} onChange={champ('nom')} data={{ 'data-fo-champ': 'nom' }}/>
      <Champ label="Téléphone (si tu veux)" type="tel" inputMode="tel" value={c.tel} onChange={champ('tel')} data={{ 'data-fo-champ': 'tel' }}/>
      <Champ label="E-mail (si tu veux)" type="email" inputMode="email" value={c.email} onChange={champ('email')} data={{ 'data-fo-champ': 'email' }}/>
      <Champ label="Note (si tu veux)" multi value={c.note} onChange={champ('note')} data={{ 'data-fo-champ': 'note' }}/>
      {err ? <p className="vrm-aso-reste" data-fo-erreur="">{err}</p> : null}
      <button type="button" className="vrm-ao-principal" data-fo-enregistrer="fournisseur" disabled={envoi} onClick={envoyer}>Enregistrer</button>
      <button type="button" className="vrm-ao-second vrm-aso-annuler" data-fo-annuler="" onClick={onAnnuler}>Annuler</button>
    </div>
  );
}

function FormAchatGros({ depart, onEnregistrer, onAnnuler }) {
  const [c, setC] = React.useState(() => ({ date: (depart && depart.date) || jourLocal(), paires: depart ? String(depart.paires) : '', total: depart ? enSaisie(depart.total) : '', frais: depart && depart.frais ? enSaisie(depart.frais) : '' }));
  const [err, setErr] = React.useState('');
  const [envoi, setEnvoi] = React.useState(false);
  const champ = (k) => (v) => { setErr(''); setC((x) => ({ ...x, [k]: v })); };
  const envoyer = async () => { if (envoi) return; setEnvoi(true); const r = await onEnregistrer(c); setEnvoi(false); if (r && r.erreur) setErr(r.erreur); };
  return (
    <div className="vrm-fo-form" data-fo-form="achat">
      <Champ label="Date" type="date" value={c.date} onChange={champ('date')} data={{ 'data-fo-champ': 'date' }}/>
      <Champ label="Nombre de paires" inputMode="numeric" value={c.paires} onChange={champ('paires')} data={{ 'data-fo-champ': 'paires' }}/>
      <Champ label="Montant total (€)" inputMode="decimal" value={c.total} onChange={champ('total')} data={{ 'data-fo-champ': 'total' }}/>
      <Champ label="Frais, transport… (si tu veux, €)" inputMode="decimal" value={c.frais} onChange={champ('frais')} data={{ 'data-fo-champ': 'frais' }}/>
      {err ? <p className="vrm-aso-reste" data-fo-erreur="">{err}</p> : null}
      <button type="button" className="vrm-ao-principal" data-fo-enregistrer="achat" disabled={envoi} onClick={envoyer}>Enregistrer</button>
      <button type="button" className="vrm-ao-second vrm-aso-annuler" data-fo-annuler="" onClick={onAnnuler}>Annuler</button>
    </div>
  );
}

function Stat({ nom, valeur, sous, data }) {
  return <div className="vrm-fo-stat" {...(data || {})}><span>{nom}</span><b>{valeur}</b>{sous ? <small>{sous}</small> : null}</div>;
}

// Ce que dit la ligne d'une paire reliée, selon d'où vient son prix (origineDuPrix).
const ETAT_PRIX = {
  vide: (p) => (p == null ? 'prix à choisir' : 'prix à poser'),
  lot: (p, o) => (p != null && o.centimes === p ? 'prix posé' : 'prix à mettre à jour'),
  main: (p, o, garde) => (p != null && o.centimes === p ? 'prix posé' : `${garde ? 'prix gardé' : 'saisi à la main'} : ${o.centimes != null ? eurosC(o.centimes) : o.prix + ' €'}`),
};

function FicheAchatGros({ a, fichesLibres, actions, Photo }) {
  const r = a.repartition || { mode: 'egal', base: '' };
  const n = a.relies.length;
  const [relier, setRelier] = React.useState(false);
  const depart = React.useCallback(() => a.relies.map((x) => (Number.isSafeInteger(a.parts[x.cle]) ? enSaisie(a.parts[x.cle]) : '')), [a]);
  const [saisies, setSaisies] = React.useState(depart);
  React.useEffect(() => { setSaisies(depart()); }, [a.id, n, r.mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const etat = etatSaisieGros(a, a.relies, saisies);
  const base = baseRepartition(a);
  const egales = base != null ? partsEgales(base, a.paires) : [];
  const unePart = egales.length ? (egales[0] === egales[egales.length - 1] ? eurosC(egales[0]) : `${eurosC(egales[egales.length - 1])} à ${eurosC(egales[0])}`) : '—';
  const aPoser = a.plan.aEcrire + a.plan.aDemander;
  const plein = n >= a.paires;
  return (
    <div data-fo-fiche-achat={a.id} data-fo-relies={n} data-fo-sur={a.paires} data-fo-mode={r.mode} data-fo-base={r.base}>
      <section className="vrm-aso-carte vrm-fo-resume">
        <div className="vrm-aso-grand"><b data-fo-total={a.total}>{eurosC(a.total)}</b><span>{a.paires} paires · {dateCourte(a.date)}</span></div>
        <p className="vrm-aso-couv">
          {a.frais ? <><span className="vrm-aso-bloc" data-fo-frais={a.frais}>+ {eurosC(a.frais)} de frais</span> · </> : null}
          <span className="vrm-aso-bloc" data-fo-relies-txt="">{texteRelies({ relies: n, sur: a.paires })}</span>
        </p>
      </section>
      {a.frais ? (
        <Choix label="Montant à répartir" value={r.base} onChange={(v) => actions.regler(a.id, { base: v })} data={{ 'data-fo-base-seg': r.base }}
          options={[{ v: 'prix', l: `Prix seul ${eurosC(a.total)}`, data: { 'data-fo-base-choix': 'prix' } }, { v: 'frais', l: `Avec les frais ${eurosC(a.total + a.frais)}`, data: { 'data-fo-base-choix': 'frais' } }]}/>
      ) : null}
      <Choix label="Prix de chaque paire" value={r.mode} onChange={(v) => actions.regler(a.id, { mode: v })} data={{ 'data-fo-mode-seg': r.mode }}
        options={[{ v: 'egal', l: 'Part égale', data: { 'data-fo-mode-choix': 'egal' } }, { v: 'main', l: 'Paire par paire', data: { 'data-fo-mode-choix': 'main' } }]}/>
      {base == null ? <p className="vrm-aso-reste" data-fo-base-manque="">Choisis le montant à répartir</p>
        : r.mode === 'egal' ? <p className="vrm-aso-couv" data-fo-part-egale={egales[0]}>{unePart} par paire</p> : null}
      {n ? (
        <ul className="vrm-aso-liste" data-fo-liste-relies={n}>
          {a.relies.map((x, i) => (
            <li key={x.cle} className="vrm-aso-ligne is-achat vrm-fo-relie" data-fo-relie={x.numero} data-fo-part={x.part == null ? '' : x.part} data-fo-origine={x.origine.etat} data-fo-garde={x.garde ? '1' : ''}>
              <Vignette src={x.photo} Photo={Photo}/>
              <span className="vrm-aso-centre">
                <span className="vrm-aso-nom">N°{x.numero}</span>
                <span className="vrm-aso-sous">{x.titre ? <span>{x.titre} · </span> : null}<span className={'vrm-aso-bloc' + (x.origine.etat === 'main' && x.origine.centimes !== x.part && !x.garde ? ' vrm-fo-ambre' : '')}>{ETAT_PRIX[x.origine.etat](x.part, x.origine, x.garde)}</span></span>
              </span>
              <span className="vrm-fo-droite">
                {r.mode === 'main' ? (
                  <span className="vrm-aso-champ">
                    <input inputMode="decimal" autoComplete="off" value={saisies[i] || ''} aria-label={`Prix du N°${x.numero}`} data-fo-saisie={i}
                      aria-invalid={saisies[i] && etat.parts[i] == null ? 'true' : undefined}
                      onChange={(e) => { const v = e.target.value; setSaisies((s) => { const c = [...s]; c[i] = v; return c; }); }}/>
                    <b>€</b>
                  </span>
                ) : <b className="vrm-aso-montant">{eurosC(x.part)}</b>}
                <button type="button" className="vrm-ao-x vrm-fo-delier" aria-label={`Délier le N°${x.numero}`} data-fo-delier={x.numero} onClick={() => actions.delier(a.id, x.cle)}>×</button>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="vrm-ao-vide" data-fo-aucun-relie="">Relie les paires de cet achat à leurs N°.</p>}
      {r.mode === 'main' && n ? (
        <>
          <p className={'vrm-aso-reste' + (etat.ok ? ' is-juste' : '')} data-fo-reste={etat.reste == null ? '' : etat.reste} data-fo-saisie-ok={etat.ok ? '1' : ''}>
            {base == null ? '—' : etat.illisibles ? `${etat.illisibles} case${etat.illisibles > 1 ? 's' : ''} à remplir`
              : etat.depasse ? `${eurosC(-etat.reste)} de trop`
              : etat.reste === 0 ? 'Juste'
              : etat.toutes ? `Reste ${eurosC(etat.reste)}` : `Reste ${eurosC(etat.reste)} pour les ${a.paires - n} paires pas encore reliées`}
          </p>
          <button type="button" className="vrm-ao-second vrm-aso-plus" data-fo-garder-parts="" disabled={!etat.ok}
            onClick={() => actions.regler(a.id, { parts: Object.fromEntries(a.relies.map((x, i) => [x.cle, etat.parts[i]])) })}>Garder ces prix</button>
        </>
      ) : null}
      {relier ? <ChoixNumero fiches={fichesLibres} Photo={Photo} onAnnuler={() => setRelier(false)} onChoisir={(fi) => { actions.relier(a.id, fi); setRelier(false); }}/>
        : <button type="button" className="vrm-ao-second vrm-aso-plus" data-fo-relier="" disabled={plein} onClick={() => setRelier(true)}>{plein ? 'Toutes les paires sont reliées' : 'Relier un N°'}</button>}
      <button type="button" className="vrm-ao-principal" data-fo-poser-prix={aPoser} disabled={!aPoser} onClick={() => actions.poserPrix(a.id)}>
        {aPoser ? `Poser le prix d’achat (${aPoser})` : 'Prix d’achat à jour'}
      </button>
      <div className="vrm-fo-gestes">
        <button type="button" className="vrm-ao-second" data-fo-modifier-achat={a.id} onClick={() => actions.versModifierAchat(a.id)}>Modifier</button>
        <button type="button" className="vrm-ao-second" data-fo-retirer-achat={a.id} onClick={() => actions.retirerAchat(a.id)}>Retirer</button>
      </div>
    </div>
  );
}

function LigneHors({ b, children }) {
  return (
    <>
      <span className="vrm-aso-centre"><span className="vrm-aso-nom">{b.titre || 'Sans titre'}</span><span className="vrm-aso-sous">{[b.numero ? `N°${b.numero}` : '', b.prix == null ? 'prix illisible' : eurosC(b.prix), b.date ? dateCourte(b.date) : ''].filter(Boolean).join(' · ')}</span></span>
      {children}
    </>
  );
}

function FeuilleFournisseurs({ f, fichesLibres, onFermer, Retour, Photo }) {
  const [vue, setVue] = React.useState({ v: 'liste' });
  const lu = !!(f && f.lignes);
  const ligne = lu && vue.id ? f.lignes.find((l) => l.id === vue.id) || null : null;
  // Une fiche retirée (ici ou sur un autre appareil) : retour à la liste.
  React.useEffect(() => { if (lu && vue.id && !ligne) setVue({ v: 'liste' }); }, [lu, vue.id, ligne]);
  const achat = vue.aid && lu ? f.achats[vue.aid] || null : null;
  React.useEffect(() => { if ((vue.v === 'achat' || vue.v === 'achat-modifier') && lu && !achat) setVue({ v: 'fiche', id: vue.id }); }, [vue.v, vue.id, lu, achat]);
  const ventesLues = f ? f.ventesLues : undefined;
  const venteTxt = (x) => (ventesLues === true ? x : ventesLues === null ? '—' : '…');
  const actions = lu ? { ...f.actions, versModifierAchat: (aid) => setVue({ v: 'achat-modifier', id: vue.id, aid }),
    retirerAchat: async (aid) => { if (await f.actions.retirerAchat(aid)) setVue({ v: 'fiche', id: vue.id }); } } : null;
  const titre = vue.v === 'nouveau' ? 'Nouveau fournisseur' : /^achat/.test(vue.v) ? 'Achat en gros' : ligne ? ligne.nom : 'Fournisseurs';
  const retour = vue.v === 'liste' ? null : (vue.v === 'fiche' || vue.v === 'nouveau') ? { v: 'liste' } : vue.v === 'achat-modifier' ? { v: 'achat', id: vue.id, aid: vue.aid } : { v: 'fiche', id: vue.id };
  const nomRetour = !retour ? '' : retour.v === 'liste' ? 'Fournisseurs' : retour.v === 'achat' ? 'Achat en gros' : (ligne ? ligne.nom : 'Retour');
  const achatsDe = ligne ? Object.values(f.achats).filter((x) => x.fournisseur === ligne.id).sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0)) : [];
  const horsDe = ligne ? f.hors.filter((b) => b.fournisseur === ligne.id) : [];
  return (
    <Feuille titre={titre} data={{ 'data-aso-feuille': 'fournisseurs', 'data-fo-vue': vue.v, 'data-aso-etat': f === undefined ? 'encours' : f === null ? 'passu' : 'lu' }} onFermer={onFermer} Retour={Retour}>
      {retour ? <button type="button" className="vrm-fo-retour" data-fo-retour="" onClick={() => setVue(retour)}>‹ {nomRetour}</button> : null}
      {f === undefined ? <p className="vrm-ao-vide">…</p> : f === null ? <p className="vrm-ao-vide" data-aso-passu="">—</p> : (
        <>
          {vue.v === 'liste' ? (
            <>
              {!f.lignes.length ? <p className="vrm-ao-vide vrm-fo-vide" data-fo-vide="">Ajoute ton premier fournisseur : la personne à qui tu achètes en gros.</p> : (
                <ul className="vrm-aso-liste" data-fo-n={f.lignes.length}>
                  {f.lignes.map((l) => (
                    <li key={l.id} className="vrm-aso-ligne is-choix" data-fo-fournisseur={l.id} data-fo-nom={l.nom}>
                      <button type="button" className="vrm-aso-choisir vrm-fo-ouvrir" data-fo-ouvrir={l.id} onClick={() => setVue({ v: 'fiche', id: l.id })}>
                        <span className="vrm-aso-centre">
                          <span className="vrm-aso-nom">{l.nom}</span>
                          <span className="vrm-aso-sous"><span className="vrm-aso-bloc">{l.paires} paire{l.paires > 1 ? 's' : ''}</span> · <span className="vrm-aso-bloc">{texteDepense(l)}</span></span>
                        </span>
                        <span className="vrm-fo-chevron" aria-hidden="true">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="vrm-ao-principal" data-fo-ajouter="" onClick={() => setVue({ v: 'nouveau' })}>Ajouter un fournisseur</button>
            </>
          ) : null}
          {vue.v === 'nouveau' ? <FormFournisseur onAnnuler={() => setVue({ v: 'liste' })} onEnregistrer={async (c) => { const r = await f.actions.creer(c); if (r && r.id) setVue({ v: 'fiche', id: r.id }); return r; }}/> : null}
          {vue.v === 'modifier' && ligne ? <FormFournisseur depart={ligne} onAnnuler={() => setVue({ v: 'fiche', id: ligne.id })} onEnregistrer={async (c) => { const r = await f.actions.modifier(ligne.id, c); if (r && !r.erreur) setVue({ v: 'fiche', id: ligne.id }); return r; }}/> : null}
          {vue.v === 'fiche' && ligne ? (
            <div data-fo-fiche={ligne.id} data-fo-depense={ligne.depense} data-fo-au-moins={ligne.sansPrix ? '1' : ''} data-fo-paires={ligne.paires} data-fo-moyen={ligne.prixMoyen == null ? '' : ligne.prixMoyen}
              data-fo-revendues={ventesLues === true ? ligne.revendues : ''} data-fo-benefice={ventesLues === true && ligne.benefice != null ? ligne.benefice : ''} data-fo-achat-connu={ligne.achatConnu} data-fo-relies-total={ligne.relies}>
              {ligne.tel || ligne.email || ligne.note ? (
                <p className="vrm-aso-couv vrm-fo-contact">
                  {ligne.tel ? <a className="vrm-aso-bloc" href={'tel:' + ligne.tel.replace(/[^\d+]/g, '')} data-fo-tel="">{ligne.tel}</a> : null}
                  {ligne.tel && ligne.email ? ' · ' : ''}
                  {ligne.email ? <a className="vrm-aso-bloc" href={'mailto:' + ligne.email} data-fo-email="">{ligne.email}</a> : null}
                  {ligne.note ? <span className="vrm-fo-note" data-fo-note="">{ligne.note}</span> : null}
                </p>
              ) : null}
              <section className="vrm-aso-carte vrm-fo-stats">
                <Stat nom="Dépensé" valeur={texteDepense(ligne)} sous={ligne.sansPrix ? `${ligne.sansPrix} prix illisible${ligne.sansPrix > 1 ? 's' : ''}` : ''} data={{ 'data-fo-stat': 'depense' }}/>
                <Stat nom="Paires achetées" valeur={String(ligne.paires)} sous={ligne.paires ? `${ligne.relies} reliée${ligne.relies > 1 ? 's' : ''} à un N°` : ''} data={{ 'data-fo-stat': 'paires' }}/>
                <Stat nom="Prix moyen" valeur={texteMoyen(ligne)} sous="par paire" data={{ 'data-fo-stat': 'moyen' }}/>
                <Stat nom="Revendues" valeur={venteTxt(String(ligne.revendues))} data={{ 'data-fo-stat': 'revendues' }}/>
                <Stat nom="Bénéfice" valeur={venteTxt(texteBeneficeFournisseur(ligne))} sous={ventesLues === true ? [texteCouverture(ligne), f.partielSites && ligne.revendues ? 'ventes Vinted seulement' : ''].filter(Boolean).join(' · ') : ''} data={{ 'data-fo-stat': 'benefice' }}/>
              </section>
              <h3 className="vrm-aso-h3">Achats en gros<span className="vrm-aso-n">{achatsDe.length}</span></h3>
              {achatsDe.length ? (
                <ul className="vrm-aso-liste">
                  {achatsDe.map((x) => (
                    <li key={x.id} className="vrm-aso-ligne is-choix" data-fo-achat={x.id} data-fo-achat-relies={x.relies.length} data-fo-achat-sur={x.paires}>
                      <button type="button" className="vrm-aso-choisir vrm-fo-ouvrir" data-fo-ouvrir-achat={x.id} onClick={() => setVue({ v: 'achat', id: ligne.id, aid: x.id })}>
                        <span className="vrm-aso-centre">
                          <span className="vrm-aso-nom">{dateCourte(x.date)} · {x.paires} paires</span>
                          <span className="vrm-aso-sous"><span className="vrm-aso-bloc">{eurosC(x.total + (x.frais || 0))}</span> · <span className="vrm-aso-bloc">{texteRelies({ relies: x.relies.length, sur: x.paires })}</span></span>
                        </span>
                        <span className="vrm-fo-chevron" aria-hidden="true">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <button type="button" className="vrm-ao-principal vrm-aso-plus" data-fo-nouvel-achat="" onClick={() => setVue({ v: 'achat-nouveau', id: ligne.id })}>Nouvel achat en gros</button>
              {horsDe.length || f.rattachables.length ? <h3 className="vrm-aso-h3">Achats déjà saisis</h3> : null}
              {horsDe.length ? (
                <ul className="vrm-aso-liste">
                  {horsDe.map((b) => (
                    <li key={b.id} className="vrm-aso-ligne vrm-fo-hors" data-fo-hors={b.id}>
                      <LigneHors b={b}><button type="button" className="vrm-ao-second" data-fo-detacher={b.id} onClick={() => f.actions.detacher(b.id)}>Détacher</button></LigneHors>
                    </li>
                  ))}
                </ul>
              ) : null}
              {f.rattachables.length ? (vue.rattacher ? (
                <ul className="vrm-aso-liste" data-fo-rattachables={f.rattachables.length}>
                  {f.rattachables.map((b) => (
                    <li key={b.id} className="vrm-aso-ligne is-choix">
                      <button type="button" className="vrm-aso-choisir vrm-fo-ouvrir" data-fo-rattacher={b.id} aria-label={`Rattacher l’achat « ${b.titre || 'Sans titre'} » à ce fournisseur`} onClick={() => { f.actions.rattacher(b.id, ligne.id); setVue({ v: 'fiche', id: ligne.id }); }}>
                        <LigneHors b={b}><span className="vrm-fo-chevron" aria-hidden="true">+</span></LigneHors>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <button type="button" className="vrm-ao-second vrm-aso-plus" data-fo-voir-rattachables={f.rattachables.length} onClick={() => setVue({ v: 'fiche', id: ligne.id, rattacher: true })}>Rattacher un achat saisi « Fournisseur » ({f.rattachables.length})</button>) : null}
              <div className="vrm-fo-gestes">
                <button type="button" className="vrm-ao-second" data-fo-modifier={ligne.id} onClick={() => setVue({ v: 'modifier', id: ligne.id })}>Modifier</button>
                <button type="button" className="vrm-ao-second" data-fo-retirer={ligne.id} onClick={() => f.actions.retirer(ligne.id)}>Retirer</button>
              </div>
            </div>
          ) : null}
          {vue.v === 'achat-nouveau' && ligne ? <FormAchatGros onAnnuler={() => setVue({ v: 'fiche', id: ligne.id })} onEnregistrer={async (c) => { const r = await f.actions.creerAchat(ligne.id, c); if (r && r.id) setVue({ v: 'achat', id: ligne.id, aid: r.id }); return r; }}/> : null}
          {vue.v === 'achat-modifier' && achat ? <FormAchatGros depart={achat} onAnnuler={() => setVue({ v: 'achat', id: vue.id, aid: achat.id })} onEnregistrer={async (c) => { const r = await f.actions.modifierAchat(achat.id, c); if (r && !r.erreur) setVue({ v: 'achat', id: vue.id, aid: achat.id }); return r; }}/> : null}
          {vue.v === 'achat' && achat ? <FicheAchatGros key={achat.id} a={achat} fichesLibres={fichesLibres} actions={actions} Photo={Photo}/> : null}
        </>
      )}
    </Feuille>
  );
}

// ── Relier un N° à un achat (son clic) ──────────────────────────────────────
function ChoixNumero({ fiches, onChoisir, onAnnuler, Photo }) {
  const [q, setQ] = React.useState('');
  const mots = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const liste = (fiches || []).filter((f) => !mots.length || mots.every((m) => (`n°${f.numero} ${f.numero} ${f.titre || ''}`).toLowerCase().includes(m))).slice(0, 40);
  return (
    <div className="vrm-aso-choix" data-aso-choix-numero="">
      <div className="vrm-aso-cherche">
        <input type="search" inputMode="search" autoComplete="off" placeholder="N° ou titre" value={q} onChange={(e) => setQ(e.target.value)} data-aso-cherche="" aria-label="Chercher un N°"/>
        <button type="button" className="vrm-ao-second" onClick={onAnnuler} data-aso-choix-annuler="">Annuler</button>
      </div>
      {!liste.length ? <p className="vrm-ao-vide">Aucun N° libre</p> : (
        <ul className="vrm-aso-liste">
          {liste.map((f) => (
            <li key={f.cle} className="vrm-aso-ligne is-choix">
              <button type="button" className="vrm-aso-choisir" data-aso-relier-numero={f.numero} onClick={() => onChoisir(f)}>
                <Vignette src={f.photo} Photo={Photo}/>
                <span className="vrm-aso-centre"><span className="vrm-aso-nom">N°{f.numero}</span><span className="vrm-aso-sous">{f.titre || ''}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 2. Délai achat → mise en ligne ─────────────────────────────────────────
function FeuilleDelai({ d, fichesLibres, onRelier, onFiche, lienPublier, onFermer, Retour, Photo }) {
  const [voir, setVoir] = React.useState(30);
  const [relierPour, setRelierPour] = React.useState('');
  const ex = d && d.exclus;
  const nEx = ex ? ex.sansReception + ex.sansMiseEnLigne + ex.avant : 0;
  return (
    <Feuille titre="Délai de mise en ligne" data={{ 'data-aso-feuille': 'delai', 'data-aso-etat': d === undefined ? 'encours' : d === null ? 'passu' : 'lu' }} onFermer={onFermer} Retour={Retour}>
      {d === undefined ? <p className="vrm-ao-vide">…</p> : d === null ? <p className="vrm-ao-vide" data-aso-passu="">—</p> : (
        <>
          <section className="vrm-aso-carte" data-aso-mediane={d.mediane == null ? '' : d.mediane} data-aso-n={d.n}>
            <div className="vrm-aso-grand"><b>{jours(d.mediane)}</b><span>médiane · {pl(d.n, 'achat')}</span></div>
            {d.mois.length ? (
              <ul className="vrm-aso-mois">
                {d.mois.map((m) => (
                  <li key={m.mois} data-aso-mois={m.mois} data-aso-mois-mediane={m.mediane} data-aso-mois-n={m.n}>
                    <span>{nomMois(m.mois)}</span><b>{jours(m.mediane)}</b><small>{m.n}</small>
                  </li>
                ))}
              </ul>
            ) : null}
            {nEx ? (
              <p className="vrm-aso-couv" data-aso-exclus={nEx} data-aso-sans-reception={ex.sansReception} data-aso-sans-mel={ex.sansMiseEnLigne} data-aso-avant={ex.avant}>
                Hors calcul : {ex.sansReception ? <span className="vrm-aso-bloc">{ex.sansReception} sans date de réception</span> : null}
                {ex.sansReception && (ex.sansMiseEnLigne || ex.avant) ? ' · ' : ''}
                {ex.sansMiseEnLigne ? <span className="vrm-aso-bloc">{ex.sansMiseEnLigne} sans date de mise en ligne</span> : null}
                {ex.sansMiseEnLigne && ex.avant ? ' · ' : ''}
                {ex.avant ? <span className="vrm-aso-bloc">{ex.avant} en ligne avant réception</span> : null}
              </p>
            ) : null}
          </section>
          <h3 className="vrm-aso-h3">Reçus, pas encore en ligne{Array.isArray(d.pasEnLigne) ? <span className="vrm-aso-n" data-aso-pas-en-ligne={d.pasEnLigne.length}>{d.pasEnLigne.length}</span> : null}</h3>
          {d.pasEnLigne === null ? <p className="vrm-ao-vide" data-aso-pel-passu="">—</p>
            : !d.pasEnLigne.length ? <p className="vrm-ao-vide" data-aso-pel-vide="">Aucun</p> : (
              <ul className="vrm-aso-liste">
                {d.pasEnLigne.slice(0, voir).map((x) => (
                  <li key={x.tx} className="vrm-aso-ligne is-achat" data-aso-pel={x.tx} data-aso-relie={x.relie ? '1' : ''} data-aso-attente={x.attente == null ? '' : x.attente}>
                    <Vignette src={x.photo} Photo={Photo}/>
                    <span className="vrm-aso-centre">
                      <span className="vrm-aso-nom">{x.titre || 'Sans titre'}</span>
                      <span className="vrm-aso-sous">
                        {x.attente != null ? <span className="vrm-aso-bloc">reçu il y a {pl(x.attente, 'jour')}</span> : <span className="vrm-aso-bloc">reçu</span>}
                        {x.articles.filter((a) => a.numero).map((a) => <React.Fragment key={a.cle}> · <button type="button" className="vrm-aso-num" data-aso-fiche={a.numero} onClick={() => onFiche(a.numero)}>N°{a.numero}</button></React.Fragment>)}
                      </span>
                    </span>
                    {x.relie
                      ? <a className="vrm-ao-ouvrir" href={lienPublier} target="_blank" rel="noopener noreferrer" data-aso-publier={x.tx}>Mettre en ligne</a>
                      : <button type="button" className="vrm-ao-ouvrir vrm-aso-btn" data-aso-relier={x.tx} aria-expanded={relierPour === x.tx} onClick={() => setRelierPour((p) => (p === x.tx ? '' : x.tx))}>Relier</button>}
                    {relierPour === x.tx ? <div className="vrm-aso-sous-feuille"><ChoixNumero fiches={fichesLibres} Photo={Photo} onAnnuler={() => setRelierPour('')} onChoisir={(f) => { onRelier(x.tx, f); setRelierPour(''); }}/></div> : null}
                  </li>
                ))}
              </ul>
            )}
          {Array.isArray(d.pasEnLigne) && d.pasEnLigne.length > voir ? <button type="button" className="vrm-ao-second vrm-aso-plus" data-aso-voir-plus="" onClick={() => setVoir((v) => v + 30)}>Voir {Math.min(30, d.pasEnLigne.length - voir)} de plus</button> : null}
        </>
      )}
    </Feuille>
  );
}

// ── 3. Lots : la liste, puis « Répartir » ───────────────────────────────────
function Repartir({ lot, onEnregistrer, onAnnulerRepartition, onRelier, fichesLibres, onFermer, Retour, Photo }) {
  const peutPaye = lot.totalPaye != null;
  const [inclus, setInclus] = React.useState(lot.journal && lot.journal.inclus === 'paye' && peutPaye ? 'paye' : 'article');
  const total = inclus === 'paye' ? lot.totalPaye : lot.totalArticle;
  const n = lot.articles.length;
  // Préremplissage : les parts déjà posées (journal), sinon une PROPOSITION de parts égales.
  const depart = React.useCallback((t) => lot.articles.map((a, i) => {
    const deja = lot.journal && lot.journal.inclus === inclus && lot.journal.parts ? lot.journal.parts[a.cle] : null;
    if (Number.isSafeInteger(deja)) return (deja / 100).toFixed(2).replace('.', ',');
    const eg = partsEgales(t, n); return eg.length ? (eg[i] / 100).toFixed(2).replace('.', ',') : '';
  }), [lot, inclus, n]);
  const [saisies, setSaisies] = React.useState(() => depart(total));
  React.useEffect(() => { setSaisies(depart(total)); }, [inclus, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const [relier, setRelier] = React.useState(false);
  const etat = etatRepartition(total, saisies);
  return (
    <Feuille titre="Répartir" data={{ 'data-aso-feuille': 'repartir', 'data-aso-tx': lot.tx, 'data-aso-total': total == null ? '' : total, 'data-aso-reste': etat.reste == null ? '' : etat.reste, 'data-aso-juste': etat.juste ? '1' : '' }}
      onFermer={onFermer} Retour={Retour} droite={<span className="vrm-ao-num">{eurC(total)}</span>}>
      <div className="vrm-aso-lot-tete">
        <Vignette src={lot.photo} Photo={Photo}/>
        <span className="vrm-aso-centre"><span className="vrm-aso-nom">{lot.titre || 'Lot'}</span><span className="vrm-aso-sous">{lot.nLot ? `${n}/${lot.nLot} reliés` : pl(n, 'relié')}</span></span>
      </div>
      {peutPaye ? <Choix label="Montant" value={inclus} onChange={setInclus} data={{ 'data-aso-inclus': inclus }}
        options={[{ v: 'article', l: `Article ${eurC(lot.totalArticle)}`, data: { 'data-aso-inclus-choix': 'article' } }, { v: 'paye', l: `Payé ${eurC(lot.totalPaye)}`, data: { 'data-aso-inclus-choix': 'paye' } }]}/> : null}
      {n ? (
        <ul className="vrm-ao-sites vrm-aso-parts">
          {lot.articles.map((a, i) => (
            <li key={a.cle} className="vrm-ao-site vrm-aso-part" data-aso-part={a.cle} data-aso-part-num={a.numero || ''}>
              <span className="vrm-ao-site-nom"><b>{a.numero ? `N°${a.numero}` : 'Sans N°'}</b><small>{a.titre || ''}</small></span>
              <span className="vrm-aso-champ">
                <input inputMode="decimal" autoComplete="off" value={saisies[i] || ''} aria-label={`Part du N°${a.numero || ''}`} data-aso-saisie={i}
                  aria-invalid={etat.parts[i] == null ? 'true' : undefined}
                  onChange={(e) => { const v = e.target.value; setSaisies((s) => { const c = [...s]; c[i] = v; return c; }); }}/>
                <b>€</b>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="vrm-ao-vide" data-aso-aucun-relie="">Aucun N° relié</p>}
      {relier ? <ChoixNumero fiches={fichesLibres} Photo={Photo} onAnnuler={() => setRelier(false)} onChoisir={(f) => { onRelier(lot.tx, f); setRelier(false); }}/>
        : <button type="button" className="vrm-ao-second vrm-aso-plus" data-aso-ajouter-numero="" onClick={() => setRelier(true)}>Relier un N°</button>}
      {n ? (
        <p className={'vrm-aso-reste' + (etat.juste ? ' is-juste' : '')} data-aso-reste-txt="">
          {total == null ? '—' : etat.juste ? 'Juste' : etat.illisibles ? pl(etat.illisibles, 'case à remplir', 'cases à remplir') : `Reste ${etat.reste < 0 ? '−' : ''}${eurC(Math.abs(etat.reste))}`}
        </p>
      ) : null}
      {n > 1 && total != null ? <button type="button" className="vrm-ao-second vrm-aso-plus" data-aso-egal="" onClick={() => setSaisies(partsEgales(total, n).map((c) => (c / 100).toFixed(2).replace('.', ',')))}>Parts égales</button> : null}
      <button type="button" className="vrm-ao-principal" data-aso-enregistrer="" disabled={!etat.juste} onClick={() => onEnregistrer({ lot, saisies, inclus })}>Enregistrer</button>
      {lot.journal ? <button type="button" className="vrm-ao-second vrm-aso-annuler" data-aso-annuler-repartition={lot.tx} onClick={() => onAnnulerRepartition(lot)}>Annuler la répartition</button> : null}
    </Feuille>
  );
}

function FeuilleLots({ lots, achatsDeclarables, onDeclarer, onOuvrir, onFermer, Retour, Photo }) {
  const [ajout, setAjout] = React.useState(false);
  const [q, setQ] = React.useState('');
  const mots = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const candidats = (achatsDeclarables || []).filter((a) => !mots.length || mots.every((m) => String(a.titre || '').toLowerCase().includes(m))).slice(0, 40);
  return (
    <Feuille titre="Lots" data={{ 'data-aso-feuille': 'lots', 'data-aso-etat': lots === undefined ? 'encours' : lots === null ? 'passu' : 'lu' }} onFermer={onFermer} Retour={Retour}>
      {lots === undefined ? <p className="vrm-ao-vide">…</p> : lots === null ? <p className="vrm-ao-vide" data-aso-passu="">—</p> : (
        !lots.length ? <p className="vrm-ao-vide" data-aso-vide="">Aucun lot</p> : (
          <ul className="vrm-aso-liste" data-aso-n={lots.length}>
            {lots.map((l) => (
              <li key={l.tx} className="vrm-aso-ligne is-achat" data-aso-lot={l.tx} data-aso-lot-n={l.articles.length} data-aso-reparti={l.journal ? '1' : ''}>
                <Vignette src={l.photo} Photo={Photo}/>
                <span className="vrm-aso-centre">
                  <span className="vrm-aso-nom">{l.titre || 'Lot'}</span>
                  <span className="vrm-aso-sous"><span className="vrm-aso-bloc">{eurC(l.totalArticle)}</span> · <span className="vrm-aso-bloc">{l.nLot ? `${l.articles.length}/${l.nLot} reliés` : pl(l.articles.length, 'relié')}</span>{l.journal ? <> · <span className="vrm-aso-bloc">réparti</span></> : null}</span>
                </span>
                <button type="button" className="vrm-ao-ouvrir vrm-aso-btn" data-aso-repartir={l.tx} onClick={() => onOuvrir(l.tx)}>Répartir</button>
              </li>
            ))}
          </ul>
        )
      )}
      {ajout ? (
        <div className="vrm-aso-choix" data-aso-declarer-liste="">
          <div className="vrm-aso-cherche">
            <input type="search" autoComplete="off" placeholder="Titre de l'achat" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un achat" data-aso-cherche-achat=""/>
            <button type="button" className="vrm-ao-second" onClick={() => setAjout(false)}>Annuler</button>
          </div>
          <ul className="vrm-aso-liste">
            {candidats.map((a) => (
              <li key={a.tx} className="vrm-aso-ligne is-choix">
                <button type="button" className="vrm-aso-choisir" data-aso-declarer={a.tx} onClick={() => { onDeclarer(a.tx, true); setAjout(false); }}>
                  <Vignette src={a.photo} Photo={Photo}/>
                  <span className="vrm-aso-centre"><span className="vrm-aso-nom">{a.titre || 'Sans titre'}</span><span className="vrm-aso-sous">{eurC(a.prix)}{a.date ? ` · ${a.date}` : ''}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : <button type="button" className="vrm-ao-second vrm-aso-plus" data-aso-ajouter-lot="" onClick={() => setAjout(true)}>Ajouter un lot</button>}
    </Feuille>
  );
}

// ── L'entrée sur l'écran Achats ─────────────────────────────────────────────
export default function AchatsOutils({ fournisseurs, delai, lots, achatsDeclarables, fichesLibres, onOuvrir, onRelier, onRepartir, onAnnulerRepartition, onDeclarerLot, onFiche, lienPublier = 'https://www.vinted.fr/items/new', Retour, Photo, ouvertInitial = '' }) {
  const [ouvert, setOuvert] = React.useState(ouvertInitial);
  const [lotTx, setLotTx] = React.useState('');
  const ouvrir = (q) => { setOuvert(q); if (onOuvrir) onOuvrir(q); };
  const fermer = React.useCallback(() => setOuvert(''), []);
  const lot = lotTx && Array.isArray(lots) ? lots.find((l) => l.tx === lotTx) : null;
  const nLots = Array.isArray(lots) ? lots.length : null;
  const nPel = delai && Array.isArray(delai.pasEnLigne) ? delai.pasEnLigne.length : null;
  return (
    <>
      <nav className="vrm-aso-outils" aria-label="Outils des achats" data-aso-outils="">
        <button type="button" className="vrm-aso-outil" data-aso-ouvrir="fournisseurs" onClick={() => ouvrir('fournisseurs')}><span>Fournisseurs</span></button>
        <button type="button" className="vrm-aso-outil" data-aso-ouvrir="delai" onClick={() => ouvrir('delai')}><span>Délai</span>{nPel ? <small data-aso-outil-n={nPel}>{nPel}</small> : null}</button>
        <button type="button" className="vrm-aso-outil" data-aso-ouvrir="lots" onClick={() => ouvrir('lots')}><span>Lots</span>{nLots ? <small data-aso-outil-n={nLots}>{nLots}</small> : null}</button>
      </nav>
      {ouvert === 'fournisseurs' ? <FeuilleFournisseurs f={fournisseurs} fichesLibres={fichesLibres} onFermer={fermer} Retour={Retour} Photo={Photo}/> : null}
      {ouvert === 'delai' ? <FeuilleDelai d={delai} fichesLibres={fichesLibres} onRelier={onRelier} onFiche={onFiche} lienPublier={lienPublier} onFermer={fermer} Retour={Retour} Photo={Photo}/> : null}
      {ouvert === 'lots' && !lot ? <FeuilleLots lots={lots} achatsDeclarables={achatsDeclarables} onDeclarer={onDeclarerLot} onOuvrir={setLotTx} onFermer={fermer} Retour={Retour} Photo={Photo}/> : null}
      {ouvert === 'lots' && lot ? <Repartir key={lot.tx + ':' + lot.articles.length} lot={lot} fichesLibres={fichesLibres} onRelier={onRelier} Photo={Photo} Retour={Retour}
        onFermer={() => setLotTx('')}
        onEnregistrer={async (x) => { const ok = await onRepartir(x); if (ok) setLotTx(''); }}
        onAnnulerRepartition={async (l) => { const ok = await onAnnulerRepartition(l); if (ok) setLotTx(''); }}/> : null}
    </>
  );
}

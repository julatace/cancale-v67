// ══════════════════════════════════════════════════════════════════════════════
// « RELIER MA BOÎTE », ACCOMPAGNÉ (19 nov., lot emails-mail)
// ══════════════════════════════════════════════════════════════════════════════
// Julien, 19 nov. : « Relier la boîte mail : un processus beaucoup plus accompagné, beaucoup plus
// simple. » UNE étape par écran : la messagerie (Gmail, Outlook, iCloud, Autre) → l'adresse VRM (copiée
// d'un toucher) → les gestes de SA messagerie, chacun avec une capture DESSINÉE (src/relierMaBoite.js) →
// l'e-mail d'essai guetté en direct → « Reçu ✓ ».
//
// ⚠️ Lecture seule de la route EXISTANTE (`/api/email-rattacher?mode=adresse-unique`, le même hook que le
//    parcours de Paramètres : `useAdresseVrm`) ; aucune fonction serverless de plus, aucune écriture.
// ⚠️ « Reçu ✓ » se PROUVE : le code de l'objet de l'e-mail d'essai, rangé par le serveur à l'arrivée
//    (`etatEssai`), ou la preuve d'un compte (`Verification`, `lireDernier`) — jamais une heure, jamais un
//    clic sur « C'est fait ».
// ⚠️ La preuve d'adresse (lien envoyé à l'adresse, cliqué depuis SA session, api/_lib/preuve-adresse.js)
//    n'est pas touchée : ce parcours ne déclare aucune adresse.
// ⚠️ Trois états : `undefined` en cours · `null` pas su (Réessayer) · lu.
// ══════════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tr } from './i18n/index.js';
import { Bouton, Vide, Attente, Glyphe } from './natif/index.js';
import { useAdresseVrm, MiseEnService } from './AdresseReception.jsx';
import { ChoixCompte, Verification } from './RelierCompte.jsx';
import { codeAMontrer, ilYa, NOM_FOURNISSEUR, lienConfirmationSur, lienEssai, nouveauCodeEssai, sujetEssai, etatEssai, messagerieDeDomaine } from './adresseReception.js';
import { TUILES, AUTRES, ETAPES_MESSAGERIE, NOM_MESSAGERIE, messagerieProposee, filDuParcours, ecranCourant, compteEtapes, CLE_REPRISE, repriseLue } from './relierMaBoite.js';
import './adresse-reception.css';   // ChoixCompte et Verification gardent leur dessin
import './relier-ma-boite.css';

const MOT_VINTED = 'vinted';   // le mot que la règle cherche (jamais traduit : c'est l'expéditeur)
const CLE_ESSAI = 'vrm_essai_adresse_reception';   // le même essai que le parcours de Paramètres
const lireLocal = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const ecrireLocal = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) { /* navigation privée : rien gardé */ } };
const lireEssai = (adresse) => { try { const x = JSON.parse(lireLocal(CLE_ESSAI) || 'null'); return x && x.adresse === adresse && /^[A-Z2-9]{4}$/.test(x.code || '') ? x : null; } catch (_) { return null; } };
const heure = (ms) => (ms ? new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '');
const espaceCode = (c) => String(c || '').replace(/(\d{3})(?=\d)/g, '$1 ');
const adresseSession = () => { try { const s = JSON.parse(lireLocal('vrm_session') || 'null'); return String((s && s.user && s.user.email) || ''); } catch (_) { return ''; } };

async function copier(texte) {
  try { await navigator.clipboard.writeText(texte); return true; } catch (_) { /* repli ci-dessous */ }
  try {
    const z = document.createElement('textarea'); z.value = texte; z.setAttribute('readonly', ''); z.style.position = 'fixed'; z.style.opacity = '0';
    document.body.appendChild(z); z.select(); const ok = document.execCommand('copy'); z.remove(); return ok;
  } catch (_) { return false; }
}

// Un bouton qui copie et le DIT (« Copiée ✓ »), 2 s ; sans presse-papiers : « Sélectionne-la ».
function Copier({ texte, libelle, variante = 'teinte', attrs = null, onCopie }) {
  const [etat, setEtat] = useState('');
  const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <Bouton variante={variante} large attrs={{ ...(attrs || {}), 'data-copie': etat || undefined }}
      icone={<Glyphe nom={etat === 'ok' ? 'check' : 'copy'} taille={20}/>}
      onClick={async () => { const ok = await copier(texte); setEtat(ok ? 'ok' : 'ko'); if (ok && onCopie) onCopie(); clearTimeout(t.current); t.current = setTimeout(() => setEtat(''), 2200); }}>
      <span aria-live="polite">{etat === 'ok' ? tr('relier.copie') : etat === 'ko' ? tr('relier.copieKo') : libelle}</span>
    </Bouton>
  );
}

// ── LA CAPTURE DESSINÉE ─────────────────────────────────────────────────────
// Une fenêtre neutre « exemple » : aucune vraie capture, aucun logo, aucune vraie adresse. La ligne à
// toucher est cerclée d'accent, une flèche de souris posée dessus (figée en mouvement réduit).
function Scene({ scene, nom }) {
  if (!scene) return null;
  const items = scene.items || [];
  const s = scene.surligne;
  const fleche = <svg className="n-relier-fleche" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 3l13 9-6 1.4L15.5 20l-2.7 1.2-3.4-6.6L5 18.5z" fill="var(--n-carte)" stroke="var(--n-encre)" strokeWidth="1.5" strokeLinejoin="round"/></svg>;
  let corps = null;
  if (scene.k === 'menu') {
    corps = <ul className="n-relier-sc-menu">{items.map((k, i) => <li key={k} data-surligne={i === s ? '1' : undefined}><span className="n-relier-sc-puce"/>{tr(k)}{i === s ? fleche : null}</li>)}</ul>;
  } else if (scene.k === 'champ') {
    corps = <div className="n-relier-sc-champ"><p className="n-relier-sc-lib">{tr(items[0])}</p>
      <div className="n-relier-sc-saisie" data-surligne="1"><span>{tr('relier.sc.tonAdresse')}</span><i className="n-relier-sc-curseur"/></div>
      <span className="n-relier-sc-btn">{tr(items[1])}{fleche}</span></div>;
  } else if (scene.k === 'code') {
    corps = <div className="n-relier-sc-champ"><p className="n-relier-sc-lib">{tr(items[0])}</p>
      <div className="n-relier-sc-cases" data-surligne="1">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i}/>)}</div>
      <span className="n-relier-sc-btn">{tr(items[1])}{fleche}</span></div>;
  } else if (scene.k === 'coche') {
    const choix = items.slice(0, -1);
    corps = <div className="n-relier-sc-champ"><ul className="n-relier-sc-coches">{choix.map((k, i) => <li key={k} data-coche={i === s ? '1' : '0'} data-surligne={i === s ? '1' : undefined}><span className="n-relier-sc-rond"/>{tr(k)}</li>)}</ul>
      <span className="n-relier-sc-btn">{tr(items[items.length - 1])}{fleche}</span></div>;
  } else if (scene.k === 'regle') {
    corps = <div className="n-relier-sc-champ"><div className="n-relier-sc-regle"><span>{tr(items[0])}</span><span className="n-relier-sc-menu-d">{tr(items[1])}</span><span className="n-relier-sc-saisie" data-surligne="1">{MOT_VINTED}{fleche}</span></div></div>;
  }
  return (
    <figure className="n-relier-scene" data-scene={scene.k} aria-hidden="true">
      <div className="n-relier-fen">
        <div className="n-relier-fen-barre"><i/><i/><i/><span>{tr('relier.sc.exemple', { nom })}</span></div>
        <div className="n-relier-fen-corps">{corps}</div>
      </div>
    </figure>
  );
}

// ── LE CODE QUE SA MESSAGERIE ENVOIE À L'ADRESSE VRM (affiché tout seul) ────
function CodeEnDirect({ code, maintenant, luA }) {
  if (!code) {
    return <div className="n-relier-etat" data-code-etape="attente" role="status" aria-live="polite">
      <span className="n-relier-etat-ic" data-ton="attente" aria-hidden="true"><Glyphe nom="clock" taille={20}/></span>
      <span className="n-relier-etat-txt"><b>{tr('relier.code.attente')}</b>{luA ? <span>{tr('relier.verifieA', { heure: heure(luA) })}</span> : null}</span>
    </div>;
  }
  const nom = NOM_FOURNISSEUR[code.fournisseur] || tr('relier.taMessagerie');
  const lien = lienConfirmationSur(code);
  return (
    <section className="n-relier-code" data-code-transfert={code.fournisseur} data-code-etape="recu" aria-label={tr('relier.code.de', { nom, quand: ilYa(code.recuLe, maintenant) })}>
      <p className="n-relier-code-sur">{tr('relier.code.de', { nom, quand: ilYa(code.recuLe, maintenant) })}</p>
      {code.code ? <p className="n-relier-code-valeur" data-code-valeur={code.code} translate="no">{espaceCode(code.code)}</p> : null}
      {code.source ? <p className="n-relier-note">{tr('relier.code.pour', { source: code.source })}</p> : null}
      {code.code ? <Copier texte={code.code} libelle={tr('relier.code.copier')} attrs={{ 'data-copier-code': '' }}/> : null}
      {lien ? <a className="n-relier-lien" href={lien} target="_blank" rel="noopener noreferrer" data-lien-confirmation="">{tr('relier.code.confirmer', { nom })} ↗</a> : null}
    </section>
  );
}

// ══ LE PARCOURS ═══════════════════════════════════════════════════════════════
export default function RelierMaBoite({ headers, comptes = [], uid = '', onChoisir, boites = [], lireDernier, onRelie, onPret, onBoite, proprio = false }) {
  const { d, lire, luA, manuel, maintenant, setMaintenant } = useAdresseVrm(headers);
  const pret = !!(d && d.pret);
  const adresse = pret ? String(d.adresse || '') : '';
  useEffect(() => { if (d !== undefined && onPret) onPret(d === null ? null : !!(d && d.pret)); }, [d, onPret]);

  const liste = Array.isArray(comptes) ? comptes : [];
  const c = liste.find((x) => x.uid === String(uid)) || null;
  const [relies, setRelies] = useState(() => new Set());
  const relie = !!(c && relies.has(c.uid));
  const noterRelie = useCallback((u) => { setRelies((s) => (s.has(u) ? s : new Set([...s, u]))); if (onRelie) onRelie(u); }, [onRelie]);

  // La messagerie : celle qu'il a choisie, sinon proposée (domaine du compte, puis SES adresses).
  const proposee = useMemo(() => messagerieProposee({ compteAdresse: c ? c.adresse : '', adresses: [d && d.code && d.code.source, ...boites, adresseSession()] }), [c, d, boites]);
  const relaisApple = !!(c && messagerieDeDomaine(c.adresse) === 'relais-apple');
  const [messagerie, setMessagerie] = useState('');
  const [voulu, setVoulu] = useState('messagerie');
  const [voirAutres, setVoirAutres] = useState(false);
  const [essai, setEssai] = useState(null);
  const [prepare, setPrepare] = useState(() => nouveauCodeEssai());
  useEffect(() => {
    if (!adresse) return;
    const x = repriseLue(lireLocal(CLE_REPRISE), adresse);
    if (x) { setMessagerie(x.messagerie); setVoulu(x.ecran); }
    const e = lireEssai(adresse); setEssai(e); if (e) setPrepare(e.code);
  }, [adresse]);
  // Un compte choisi ailleurs (« Relier la boîte de … ») : on repart de sa messagerie.
  const uidPrec = useRef(uid);
  useEffect(() => { if (uid && uid !== uidPrec.current) { setMessagerie(''); setVoulu('messagerie'); } uidPrec.current = uid; }, [uid]);

  const eEssai = etatEssai(d, essai, maintenant);
  const recu = eEssai.etat === 'recu' || relie;
  const fil = useMemo(() => filDuParcours(messagerie), [messagerie]);
  const i = ecranCourant({ fil, voulu, recu });
  const ecran = fil[i];
  const code = codeAMontrer(d, maintenant) ? d.code : null;

  const aller = useCallback((id, m = messagerie) => {
    setVoulu(id); setVoirAutres(false);
    if (adresse) ecrireLocal(CLE_REPRISE, JSON.stringify({ adresse, messagerie: m, ecran: id }));
    if (id === 'essai') lire();
    try { const n = document.querySelector('[data-relier-ma-boite]'); if (n && n.getBoundingClientRect().top < 0) n.scrollIntoView({ block: 'start' }); } catch (_) { /* rien */ }
  }, [adresse, messagerie, lire]);
  const choisirMessagerie = (m) => { setMessagerie(m); aller('adresse', m); };

  // En direct : relue toutes les 5 s pendant l'essai et pendant le pas du code (page visible), sans roue.
  const guette = !recu && (ecran.id === 'essai' || ecran.geste === 'code');
  useEffect(() => {
    if (!guette) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') lire(); else setMaintenant(Date.now()); }, 5000);
    return () => clearInterval(t);
  }, [guette, lire, setMaintenant]);

  const lancerEssai = (cd) => {
    if (!adresse || (essai && essai.code === cd && eEssai.etat !== 'trop-long')) return;
    const x = { adresse, code: cd, depuis: Date.now() };
    setEssai(x); ecrireLocal(CLE_ESSAI, JSON.stringify(x)); setMaintenant(Date.now());
  };
  const recommencer = (vers = 'essai') => { const cd = nouveauCodeEssai(); setEssai(null); ecrireLocal(CLE_ESSAI, null); setPrepare(cd); setRelies(new Set()); aller(vers); };

  const etat = d === undefined ? 'lecture' : d === null ? 'pas-su' : !d.pret ? 'pas-prete' : d.actif === false ? 'off' : 'active';
  const nomM = NOM_MESSAGERIE[messagerie] || tr('relier.taMessagerie');
  const { n, total } = compteEtapes(fil, i);
  const precedent = i > 0 && ecran.k !== 'recu' ? fil[i - 1] : null;
  const codeEssai = essai ? essai.code : prepare;

  // ── Ce que montre chaque écran ────────────────────────────────────────────
  let contenu = null, plein = null;
  if (pret && ecran.k === 'messagerie') {
    const tuiles = voirAutres ? AUTRES : TUILES;
    contenu = <>
      <h2 className="n-relier-titre">{tr(voirAutres ? 'relier.autres.titre' : 'relier.messagerie.titre')}</h2>
      <p className="n-relier-phrase">{tr(voirAutres ? 'relier.autres.phrase' : 'relier.messagerie.phrase')}</p>
      {relaisApple && !voirAutres ? <p className="n-relier-note" data-relais-apple="">{tr('relier.relaisApple')}</p> : null}
      <div className="n-relier-tuiles" role="radiogroup" aria-label={tr('relier.messagerie.titre')} data-choix-messagerie={voirAutres ? 'autres' : 'tuiles'}>
        {tuiles.map((id) => {
          const det = id === proposee || (id === 'autre' && ['orange', 'free', 'yahoo'].includes(proposee));
          return <button key={id} type="button" role="radio" aria-checked={id === messagerie || (id === 'autre' && AUTRES.includes(messagerie)) ? 'true' : 'false'}
            className="n-relier-tuile" data-fournisseur={id} data-detectee={det ? '1' : undefined}
            onClick={() => (id === 'autre' ? setVoirAutres(true) : choisirMessagerie(id))}>
            <span className="n-relier-tuile-lettre" aria-hidden="true">{id === 'autre' || id === 'inconnue' ? '@' : (NOM_MESSAGERIE[id] || '?')[0]}</span>
            <span className="n-relier-tuile-nom">{id === 'autre' ? tr('relier.autre') : id === 'inconnue' ? tr('relier.inconnue') : NOM_MESSAGERIE[id]}</span>
            {det ? <span className="n-relier-tuile-det">{tr('relier.detectee')}</span> : <Glyphe nom="chevron" taille={14}/>}
          </button>;
        })}
      </div>
      {voirAutres ? <Bouton variante="texte" onClick={() => setVoirAutres(false)} attrs={{ 'data-relier-autres-retour': '' }}>{tr('relier.retour')}</Bouton> : null}
    </>;
  } else if (pret && ecran.k === 'adresse') {
    const [local, domaine] = [adresse.slice(0, adresse.indexOf('@')), adresse.slice(adresse.indexOf('@'))];
    contenu = <>
      <h2 className="n-relier-titre">{tr('relier.adresse.titre')}</h2>
      <p className="n-relier-phrase">{tr('relier.adresse.phrase', { nom: nomM })}</p>
      <div className="n-relier-adresse-carte">
        <p className="n-relier-adresse" data-adresse-reception={adresse} translate="no"><span>{local}</span><wbr/><span className="n-relier-domaine">{domaine}</span></p>
        <Copier texte={adresse} libelle={tr('relier.copierAdresse')} attrs={{ 'data-copier-adresse': '' }}/>
      </div>
      {d.actif === false ? <p className="n-relier-note" data-adresse-off="">{tr('relier.adresse.off')}</p> : null}
      {liste.length ? <div className="n-relier-compte" data-bloc="comptes">
        <p className="n-relier-sous">{tr('relier.compte.titre')}</p>
        <ChoixCompte comptes={liste} uid={c ? c.uid : ''} onChoisir={onChoisir}/>
        {c && c.adresse ? <p className="n-relier-note" data-relier-compte-adresse-ligne="">{tr('relier.compte.boite', { login: c.login })} <code className="vrm-sensible" data-relier-compte-adresse="">{c.adresse}</code></p> : null}
      </div> : null}
    </>;
    plein = <Bouton variante="plein" onClick={() => aller(fil[i + 1].id)} attrs={{ 'data-suivant': fil[i + 1].id }}>{tr('relier.suivant')}</Bouton>;
  } else if (pret && ecran.k === 'messagerie-etape') {
    const dernier = fil[i + 1] && fil[i + 1].k === 'essai';
    contenu = <>
      <h2 className="n-relier-titre">{tr(ecran.cle + '.titre')}</h2>
      <p className="n-relier-phrase">{tr(ecran.cle + '.phrase')}</p>
      <Scene scene={ecran.scene} nom={nomM}/>
      <div className="n-relier-geste" data-geste={ecran.geste || 'aucun'}>
        {ecran.geste === 'ouvrir' && ecran.lien ? <a className="n-relier-ouvrir" href={ecran.lien} target="_blank" rel="noopener noreferrer" data-ouvrir-messagerie={messagerie}>
          <span>{tr('relier.ouvrir', { nom: nomM })}</span><Glyphe nom="link" taille={18}/></a> : null}
        {ecran.geste === 'copier' ? <Copier texte={adresse} libelle={tr('relier.copierAdresse')} attrs={{ 'data-copier-pas': ecran.id }}/> : null}
        {ecran.geste === 'vinted' ? <Copier texte="vinted" libelle={tr('relier.copierVinted')} attrs={{ 'data-copier-vinted': '' }}/> : null}
        {ecran.geste === 'code' ? <CodeEnDirect code={code} maintenant={maintenant} luA={luA}/> : null}
      </div>
    </>;
    plein = <Bouton variante="plein" onClick={() => aller(fil[i + 1].id)} attrs={{ 'data-suivant': fil[i + 1].id }}>{tr(dernier ? 'relier.cestFait' : 'relier.suivant')}</Bouton>;
  } else if (pret && ecran.k === 'essai') {
    const attente = eEssai.etat !== 'repos';
    contenu = <>
      <h2 className="n-relier-titre">{tr('relier.essai.titre')}</h2>
      <p className="n-relier-phrase">{tr('relier.essai.phrase')}</p>
      <div className="n-relier-adresse-carte" data-bloc="essai">
        <p className="n-relier-sous">{tr('relier.essai.objet')}</p>
        <p className="n-relier-objet" translate="no" data-essai-code={codeEssai}>{sujetEssai(codeEssai)}</p>
        <Copier texte={sujetEssai(codeEssai)} libelle={tr('relier.essai.copierObjet')} attrs={{ 'data-copier-objet': '' }} onCopie={() => lancerEssai(codeEssai)}/>
      </div>
      {attente ? <div className="n-relier-etat" data-essai-phrase="" data-essai-etat={eEssai.etat} role="status" aria-live="polite">
        <span className="n-relier-etat-ic" data-ton={eEssai.etat === 'trop-long' ? 'ambre' : 'attente'} aria-hidden="true">{manuel ? <span className="n-relier-roue"/> : <Glyphe nom="clock" taille={20}/>}</span>
        <span className="n-relier-etat-txt"><b>{tr(eEssai.etat === 'trop-long' ? 'relier.essai.long' : eEssai.etat === 'passu' ? 'relier.essai.passu' : 'relier.essai.attente')}</b>
          <span>{eEssai.etat === 'trop-long' ? tr('relier.essai.longPhrase') : luA ? tr('relier.verifieA', { heure: heure(luA) }) : ''}</span></span>
        <Bouton variante="texte" chargement={manuel} onClick={() => lire(true)} attrs={{ 'data-essai-verifier': '' }}>{tr('relier.essai.verifier')}</Bouton>
      </div> : null}
      {eEssai.etat === 'trop-long' ? <Bouton variante="texte" onClick={() => recommencer('essai')} attrs={{ 'data-essai-refaire': '' }}>{tr('relier.essai.nouveau')}</Bouton> : null}
      {c ? <Verification key={c.uid} compte={c} lireDernier={lireDernier} onRelie={noterRelie}/> : null}
    </>;
    // LE geste : écrire l'e-mail d'essai depuis SA messagerie (mailto) ; VRM guette l'arrivée.
    plein = <a className="n-bouton n-relier-plein-lien" data-n-variante="plein" href={lienEssai(adresse, codeEssai)} data-essai="" onClick={() => lancerEssai(codeEssai)}>
      <span className="n-bouton-libelle">{tr(attente ? 'relier.essai.renvoyer' : 'relier.essai.envoyer')}</span></a>;
  } else if (pret && ecran.k === 'recu') {
    contenu = <div className="n-relier-fini" data-bloc="recu" role="status" data-essai-recu={essai ? essai.code : ''}>
      <span className="n-relier-fini-rond" aria-hidden="true"><Glyphe nom="check" taille={34}/></span>
      <h2 className="n-relier-titre">{tr('relier.recu.titre')}</h2>
      <p className="n-relier-phrase">{relie && c ? tr('relier.recu.compte', { login: c.login }) : tr('relier.recu.phrase')}{eEssai.at ? ` · ${ilYa(eEssai.at, maintenant)}` : ''}</p>
      <div className="n-relier-fini-gestes">
        <Bouton variante="texte" onClick={() => recommencer('essai')} attrs={{ 'data-essai-refaire': '' }}>{tr('relier.recu.refaire')}</Bouton>
        <Bouton variante="texte" onClick={() => { setMessagerie(''); recommencer('messagerie'); }} attrs={{ 'data-relier-autre-boite': '' }}>{tr('relier.recu.autre')}</Bouton>
      </div>
      {c ? <Verification key={c.uid} compte={c} lireDernier={lireDernier} onRelie={noterRelie}/> : null}
    </div>;
    plein = onBoite ? <Bouton variante="plein" onClick={onBoite} attrs={{ 'data-ouvrir-boite': '' }}>{tr('relier.recu.voir')}</Bouton> : null;
  }

  return (
    <div className="n-relier" data-relier-ma-boite="" data-parcours-adresse="" data-etat={etat} data-ecran={pret ? ecran.id : undefined} data-messagerie={messagerie || undefined}
      {...(c ? { 'data-relier-compte': c.uid } : {})}>
      {d === undefined ? <div className="n-relier-carte" role="status" aria-label={tr('relier.lecture')}><Attente forme="texte" n={3}/></div> : null}
      {d === null ? <div className="n-relier-carte" data-adresse-reception="pas-su"><Vide icone={<Glyphe nom="mail" taille={40}/>} phrase={tr('relier.passu')}
        action={<Bouton onClick={() => lire(true)} chargement={manuel}>{tr('commun.reessayer')}</Bouton>}/></div> : null}
      {d && !d.pret ? <div className="n-relier-carte" data-adresse-reception="pas-prete">
        <Vide icone={<Glyphe nom="mail" taille={40}/>} phrase={tr('relier.ferme.titre')} detail={tr('relier.ferme.phrase')}/>
        {d.proprio === true || proprio ? <div className="vrm-pv"><MiseEnService m={d.miseEnService}/></div> : null}
        {c ? <div className="vrm-pv"><Verification key={c.uid} compte={c} lireDernier={lireDernier} onRelie={noterRelie}/></div> : null}
      </div> : null}
      {pret ? <>
        {ecran.k !== 'messagerie' && ecran.k !== 'recu' ? <div className="n-relier-tete" data-relier-progression={`${n}/${total}`}>
          <span className="n-relier-etape">{tr('relier.etape', { n, total })}</span>
          <span className="n-relier-barre" aria-hidden="true"><i style={{ width: `${Math.round((n / total) * 100)}%` }}/></span>
        </div> : null}
        <section className="n-relier-carte n-relier-ecran" key={ecran.id} data-relier-ecran={ecran.id} aria-label={ecran.k === 'messagerie-etape' ? tr(ecran.cle + '.titre') : undefined}>
          {contenu}
        </section>
        {(plein || precedent) ? <div className="n-relier-pied">
          {plein}
          {precedent ? <Bouton variante="texte" onClick={() => aller(precedent.id)} attrs={{ 'data-precedent': precedent.id }}>{tr('relier.retour')}</Bouton> : null}
        </div> : null}
      </> : null}
    </div>
  );
}

// Les étapes d'une messagerie, pour qui veut les compter (bancs).
export { ETAPES_MESSAGERIE };

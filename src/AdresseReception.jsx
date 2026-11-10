// ══════════════════════════════════════════════════════════════════════════════
// « TON ADRESSE VRM » — la feuille de l'adresse de réception unique (8 nov.)
// ══════════════════════════════════════════════════════════════════════════════
// Julien, 8 nov. : « il faut absolument qu'on mette ça en place » (comme vtools).
// Chaque vendeur a SA propre adresse VRM : il y fait suivre ses e-mails, ou la
// donne à un compte Vinted. La règle est au serveur (api/_lib/adresse-reception.js,
// route `email-rattacher?mode=adresse-unique`) ; cette feuille la MONTRE :
//   · l'adresse en grand, « Copier », « Envoyer un e-mail d'essai », et la preuve
//     que ça marche (« Dernier e-mail reçu il y a 3 min ») ;
//   · le code de confirmation que Gmail (ou Yahoo) a envoyé à SON adresse — le
//     geste qui bloque tout le monde ailleurs — avec « Copier » et le lien ;
//   · « Adresse active », ce que VRM lit, le pas-à-pas par messagerie (schéma du
//     champ où coller), « Ou l'e-mail d'un compte Vinted », le transfert à la
//     main dit tel qu'il est (mesuré : scripts/audit-adresse-reception.cjs, M) ;
//   · « Remplacer l'adresse » (confirmé sur place) et « Terminé ».
// Trois états : `undefined` en cours · `null` pas su (EtatPanne, Réessayer) · lu.
// ══════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SheetShell } from './composants/SheetShell.jsx';
import { GroupeIos, RangeeIos } from './composants/Ios.jsx';
import { EtatPanne } from './composants/EtatPanne.jsx';
import { requeteJsonBornee } from './requeteJsonBornee.js';
import { ROUTE_ADRESSE, etatAdresse, codeAMontrer, ilYa, NOM_FOURNISSEUR, FOURNISSEURS, CE_QUI_EST_LU, lienEssai, RELAIS_APPLE, ETAPES_FILTRE_GMAIL, nouveauCodeEssai, sujetEssai, etatEssai, gestesMiseEnService, DOC_MISE_EN_SERVICE } from './adresseReception.js';
import { EXPEDITEURS, regleFiltre } from './relierBoite.js';
import './adresse-reception.css';

const Svg = ({ children, t = 18 }) => <svg viewBox="0 0 24 24" width={t} height={t} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
const ICONES = {
  arobase: <Svg><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></Svg>,
  vinted: <Svg><path d="M4 7h16l-1.5 12a2 2 0 0 1-2 1.8h-9a2 2 0 0 1-2-1.8z"/><path d="M9 7a3 3 0 0 1 6 0"/></Svg>,
  transporteurs: <Svg><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/></Svg>,
  sites: <Svg><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18"/></Svg>,
  actif: <Svg><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></Svg>,
};

async function copier(texte) {
  try { await navigator.clipboard.writeText(texte); return true; } catch (_) {}
  try {
    const z = document.createElement('textarea'); z.value = texte; z.setAttribute('readonly', ''); z.style.position = 'fixed'; z.style.opacity = '0';
    document.body.appendChild(z); z.select(); const ok = document.execCommand('copy'); z.remove(); return ok;
  } catch (_) { return false; }
}

function BoutonCopier({ texte, mot = 'Copier', className = 'vrm-b vrm-b-primaire', onCopie, ...rest }) {
  const [etat, setEtat] = useState('');
  const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button type="button" className={className} data-copie={etat || undefined} {...rest}
      onClick={async () => { const ok = await copier(texte); setEtat(ok ? 'ok' : 'ko'); if (ok && onCopie) onCopie(); clearTimeout(t.current); t.current = setTimeout(() => setEtat(''), 2200); }}>
      <span aria-live="polite">{etat === 'ok' ? 'Copié' : etat === 'ko' ? 'Sélectionne-la pour copier' : mot}</span>
    </button>
  );
}

// Le schéma du champ où coller (une capture dessinée, sans texte de la vraie page).
function Schema({ f, adresse }) {
  return (
    <figure className="vrm-ar-schema" aria-hidden="true" data-schema={f.id}>
      <div className="vrm-ar-schema-barre"><i/><i/><i/><span>{f.nom} · {f.ecran.titre}</span></div>
      <div className="vrm-ar-schema-corps">
        <span className="vrm-ar-schema-libelle">{f.ecran.champ}</span>
        <span className="vrm-ar-schema-champ"><span>{adresse}</span></span>
        <span className="vrm-ar-schema-bouton">{f.ecran.bouton}</span>
      </div>
    </figure>
  );
}

// L'essai en cours, gardé sur CET appareil (un confort : il revient après un
// passage par l'app d'e-mail ; jamais une preuve — la preuve est au serveur).
const CLE_ESSAI = 'vrm_essai_adresse_reception';
const lireEssaiLocal = (adresse) => { try { const x = JSON.parse(localStorage.getItem(CLE_ESSAI) || 'null'); return x && x.adresse === adresse && /^[A-Z2-9]{4}$/.test(x.code || '') ? x : null; } catch (_) { return null; } };
const ecrireEssaiLocal = (x) => { try { if (x) localStorage.setItem(CLE_ESSAI, JSON.stringify(x)); else localStorage.removeItem(CLE_ESSAI); } catch (_) {} };

// Le numéro rond d'une étape du parcours.
const Pas = ({ n, titre, fait }) => (
  <h3 className="vrm-ar-pas" data-pas={n} data-pas-fait={fait ? '1' : undefined}>
    <span className="vrm-ar-pas-num" aria-hidden="true">{fait ? <Svg t={14}><path d="m5 12.5 4.5 4.5L19 7.5"/></Svg> : n}</span>
    <span><span className="vrm-ar-hors-champ">Étape {n} : </span>{titre}</span>
  </h3>
);

// Étape 3 : l'e-mail d'essai, suivi en direct.
function Essai({ adresse, d, maintenant, essai, prepare, onLancer, onRecommencer }) {
  const e = etatEssai(d, essai, maintenant);
  const code = essai ? essai.code : prepare;
  return (
    <section className="vrm-ar-bloc vrm-ar-essai" data-bloc="essai" data-essai-etat={e.etat} aria-labelledby="vrm-ar-essai-titre">
      <div id="vrm-ar-essai-titre"><Pas n={3} titre="Vérifie que ça marche" fait={e.etat === 'recu'}/></div>
      {e.etat === 'recu' ? (
        <div className="vrm-ar-recu" role="status" data-essai-recu={essai.code}>
          <p className="vrm-ar-recu-grand"><Svg t={22}><path d="m5 12.5 4.5 4.5L19 7.5"/></Svg> Reçu</p>
          <p className="vrm-ar-texte">Ton adresse VRM marche{e.at ? ` · ${ilYa(e.at, maintenant)}` : ''}.</p>
          <p className="vrm-ar-note">Le transfert se verra au prochain e-mail de Vinted.</p>
          <button type="button" className="vrm-lien-action vrm-ar-lien" onClick={onRecommencer} data-essai-refaire="">Refaire un essai</button>
        </div>
      ) : (<>
        <p className="vrm-ar-texte">Envoie-toi un e-mail depuis ta boîte habituelle.</p>
        <p className="vrm-ar-objet">Objet : <b translate="no" data-essai-code={code}>{sujetEssai(code)}</b></p>
        <div className="vrm-ar-actions">
          <a className={'vrm-b ' + (e.etat === 'repos' ? 'vrm-b-primaire' : 'vrm-b-secondaire')} href={lienEssai(adresse, code)} data-essai="" onClick={() => onLancer(code)}>{e.etat === 'repos' ? 'Envoyer l’e-mail d’essai' : 'Le renvoyer'}</a>
          <BoutonCopier texte={sujetEssai(code)} mot="Copier l’objet" className="vrm-b vrm-b-secondaire" data-copier-objet="" onCopie={() => onLancer(code)}/>
        </div>
        <p className="vrm-ar-essai-phrase" data-ton={e.etat === 'attente' ? 'attente' : e.etat === 'repos' ? 'off' : 'passu'} aria-live="polite" data-essai-phrase="">
          <span className="vrm-ar-point" aria-hidden="true"/>
          <span><b>{e.etat === 'attente' ? 'J’attends ton e-mail…' : e.etat === 'trop-long' ? 'Pas encore reçu.' : e.etat === 'passu' ? 'Pas su pour l’instant : je relis.' : 'Pas encore envoyé.'}</b>
            {e.etat === 'attente' ? ' Ça prend souvent moins d’une minute.' : e.etat === 'trop-long' ? ' Vérifie l’adresse collée, puis renvoie-le.' : ''}</span>
        </p>
        {e.etat === 'trop-long' ? <button type="button" className="vrm-lien-action vrm-ar-lien" onClick={onRecommencer} data-essai-refaire="">Recommencer avec un nouveau code</button> : null}
      </>)}
    </section>
  );
}

// Pas encore ouverte, vue du PROPRIÉTAIRE : ce qui manque (états de la route).
function MiseEnService({ m }) {
  const g = gestesMiseEnService(m);
  const MOT = { fait: 'Fait', 'a-faire': 'À faire', 'a-verifier': 'À vérifier' };
  return (
    <div className="vrm-ar-mes" data-mise-en-service="">
      <p className="vrm-ar-note">Toi seul vois ceci. Ce qui manque pour l’ouvrir :</p>
      <ol className="vrm-ar-mes-liste">
        {g.map((x) => (
          <li key={x.id} data-geste={x.id} data-geste-etat={x.etat}>
            <span className="vrm-ar-mes-titre">{x.titre}</span>
            <span className="vrm-ar-mes-etat">{MOT[x.etat]}</span>
            <span className="vrm-ar-mes-detail">{x.detail}</span>
          </li>
        ))}
      </ol>
      <p className="vrm-ar-note">Le pas-à-pas complet : <code>{DOC_MISE_EN_SERVICE}</code></p>
    </div>
  );
}

export function FeuilleAdresseReception({ headers, onFermer, FermeAuRetour, proprio = false, onBoite }) {
  const [d, setD] = useState(undefined);
  const [envoi, setEnvoi] = useState('');          // '' · 'actif' · 'remplacer'
  const [retour, setRetour] = useState('');
  const [confirmer, setConfirmer] = useState(false);
  const [service, setService] = useState('gmail');
  const [maintenant, setMaintenant] = useState(Date.now());
  const [essai, setEssai] = useState(null);        // { adresse, code, depuis } — l'essai lancé
  const [prepare, setPrepare] = useState(() => nouveauCodeEssai());
  const auth = useRef(headers); auth.current = headers;
  const enCours = useRef(null);

  const appeler = useCallback(async (methode = 'GET', corps) => {
    enCours.current?.abort();
    const controle = new AbortController(); enCours.current = controle;
    try {
      const h = typeof auth.current === 'function' ? auth.current() : (auth.current || {});
      const r = await requeteJsonBornee(ROUTE_ADRESSE, { method: methode, cache: 'no-store', signal: controle.signal, headers: { ...h, ...(corps ? { 'Content-Type': 'application/json' } : {}) }, body: corps ? JSON.stringify(corps) : undefined });
      if (!r.ok || !r.json || r.json.ok !== true) return { ko: true, message: (r.json && r.json.message) || '' };
      setD(r.json); setMaintenant(Date.now());
      return { ok: true };
    } catch (e) { return { ko: true, abandon: controle.signal.aborted }; }
    finally { if (enCours.current === controle) enCours.current = null; }
  }, []);
  const lire = useCallback(async () => { const r = await appeler('GET'); if (r.ko && !r.abandon) setD((x) => (x === undefined ? null : x)); return r; }, [appeler]);

  const pret = d && d.pret;
  const adresse = pret ? d.adresse : '';
  const eEssai = etatEssai(d, essai, maintenant);
  const attend = eEssai.etat === 'attente' || eEssai.etat === 'passu';

  useEffect(() => {
    lire();
    // Relue toutes les 30 s, page visible : le code de Gmail et le premier e-mail apparaissent seuls.
    const t = setInterval(() => { if (document.visibilityState === 'visible') lire(); else setMaintenant(Date.now()); }, 30000);
    const retourPage = () => { if (document.visibilityState === 'visible') lire(); };
    document.addEventListener('visibilitychange', retourPage);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', retourPage); enCours.current?.abort(); };
  }, [lire]);
  // Un essai lancé (même avant de passer par l'app d'e-mail) revient sur CETTE adresse.
  useEffect(() => { if (adresse) { const x = lireEssaiLocal(adresse); setEssai(x); if (x) setPrepare(x.code); } }, [adresse]);
  // Pendant l'attente de l'e-mail d'essai : relue toutes les 5 s (page visible).
  useEffect(() => {
    if (!attend) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') lire(); else setMaintenant(Date.now()); }, 5000);
    return () => clearInterval(t);
  }, [attend, lire]);

  const lancerEssai = (code) => {
    if (!adresse || (essai && essai.code === code && eEssai.etat !== 'trop-long')) return;
    const x = { adresse, code, depuis: Date.now() };
    setEssai(x); ecrireEssaiLocal(x); setMaintenant(Date.now());
  };
  const recommencerEssai = () => { const c = nouveauCodeEssai(); setEssai(null); ecrireEssaiLocal(null); setPrepare(c); };

  const basculer = async (actif) => {
    if (envoi || !d) return;
    const avant = d;
    setEnvoi('actif'); setRetour(''); setD({ ...d, actif });
    const r = await appeler('POST', { geste: 'actif', actif });
    if (r.ko) { setD(avant); setRetour(r.message || 'Pas enregistré — rien n’a changé. Réessaie.'); }
    setEnvoi('');
  };
  const remplacer = async () => {
    if (envoi) return;
    setEnvoi('remplacer'); setRetour('');
    const r = await appeler('POST', { geste: 'remplacer' });
    setEnvoi(''); setConfirmer(false);
    if (!r.ko) recommencerEssai();
    setRetour(r.ko ? (r.message || 'Pas remplacée — ton adresse n’a pas changé. Réessaie.') : 'Adresse remplacée. Mets la nouvelle dans ton transfert.');
  };

  const [local, domaine] = adresse ? [adresse.slice(0, adresse.indexOf('@')), adresse.slice(adresse.indexOf('@'))] : ['', ''];
  const e = etatAdresse(d, maintenant);
  const f = FOURNISSEURS.find((x) => x.id === service) || FOURNISSEURS[0];
  const code = codeAMontrer(d, maintenant) ? d.code : null;
  const voitGestes = !!(d && !d.pret && (d.proprio === true || proprio));
  const regle = regleFiltre('gmail', EXPEDITEURS.map((x) => x.id)).texte;
  const recu = !!(d && d.dernier);

  return (
    <SheetShell onClose={onFermer} FermeAuRetour={FermeAuRetour} titre="Recevoir tes e-mails Vinted" maxWidth={600} z={9000} className="vrm-ar-feuille"
      data-feuille-adresse-reception="" data-etat={d === undefined ? 'lecture' : d === null ? 'pas-su' : !d.pret ? 'pas-prete' : d.actif === false ? 'off' : 'active'}>
      <div className="vrm-ar">
        {d === undefined && <div className="vrm-ar-hero vrm-ar-squelette" role="status" aria-label="Lecture de ton adresse…"><span/><span/><span/></div>}
        {d === null && <EtatPanne quoi="Ton adresse VRM" raison="La lecture n’a pas abouti. Rien n’est perdu, rien n’a changé." onReessayer={lire} data-adresse-reception="pas-su"/>}
        {d && !d.pret && (
          <section className="vrm-ar-hero vrm-ar-fermee" data-adresse-reception="pas-prete">
            <span className="vrm-ar-tuile" aria-hidden="true">{ICONES.arobase}</span>
            <h2>Bientôt disponible</h2>
            <p>Ton adresse VRM n’est pas encore ouverte.</p>
            <p className="vrm-ar-note">{d.manque === 'cloisonnement' ? 'Elle demande une base séparée par vendeur.' : 'Tes adresses habituelles marchent toujours, rien ne change.'}</p>
            {voitGestes ? <MiseEnService m={d.miseEnService}/> : null}
          </section>
        )}
        {pret && <>
          <p className="vrm-ar-chapo">Trois étapes, une seule fois. Ensuite, tout arrive seul.</p>
          <section className="vrm-ar-hero" data-actif={d.actif === false ? '0' : '1'} aria-labelledby="vrm-ar-pas-1">
            <div id="vrm-ar-pas-1"><Pas n={1} titre="Copie ton adresse VRM" fait={recu}/></div>
            <p className="vrm-ar-sur">{d.actif === false ? 'Ton adresse de réception · désactivée' : 'Elle est à toi seul.'}</p>
            <p className="vrm-ar-adresse" data-adresse-reception={adresse} translate="no"><span>{local}</span><wbr/><span className="vrm-ar-domaine">{domaine}</span></p>
            <div className="vrm-ar-actions">
              <BoutonCopier texte={adresse} mot="Copier l’adresse" data-copier-adresse="" className={code ? 'vrm-b vrm-b-secondaire' : 'vrm-b vrm-b-primaire'}/>
            </div>
            <p className="vrm-ar-etat" data-ton={e.ton} data-dernier={d.dernier ? d.dernier.at : ''} aria-live="polite">
              <span className="vrm-ar-point" aria-hidden="true"/>
              <span><b>{e.phrase}</b>{d.dernier && d.dernier.sujet ? <span className="vrm-ar-sujet"> · {d.dernier.sujet}</span> : null}</span>
            </p>
          </section>

          {code && (
            <section className="vrm-ar-code" data-code-transfert={code.fournisseur} aria-label={`Confirmation de ${NOM_FOURNISSEUR[code.fournisseur] || 'ta messagerie'}`}>
              <p className="vrm-ar-code-sur">{NOM_FOURNISSEUR[code.fournisseur] || 'Ta messagerie'} demande une confirmation · {ilYa(code.recuLe, maintenant)}</p>
              {code.code ? <p className="vrm-ar-code-valeur" data-code-valeur={code.code} translate="no">{code.code.replace(/(\d{3})(?=\d)/g, '$1 ')}</p> : null}
              {code.source ? <p className="vrm-ar-code-source">Demande de <b>{code.source}</b>. Si ce n’est pas ta boîte, ne confirme pas.</p> : null}
              {code.fournisseur === 'gmail' && !code.signe ? <p className="vrm-ar-code-source" data-code-non-signe="">Signature de Google non vérifiée : compare bien l’adresse.</p> : null}
              <div className="vrm-ar-actions">
                {code.code ? <BoutonCopier texte={code.code} mot="Copier le code" data-copier-code=""/> : null}
                {code.lien ? <a className={code.code ? 'vrm-b vrm-b-secondaire' : 'vrm-b vrm-b-primaire'} href={code.lien} target="_blank" rel="noopener noreferrer" data-lien-confirmation="">Confirmer chez {NOM_FOURNISSEUR[code.fournisseur] || 'le fournisseur'} ↗</a> : null}
              </div>
            </section>
          )}

          <section className="vrm-ar-bloc" data-bloc="transfert" aria-labelledby="vrm-ar-pas-2">
            <div id="vrm-ar-pas-2"><Pas n={2} titre="Crée le transfert automatique" fait={recu && eEssai.etat === 'recu'}/></div>
            <p className="vrm-ar-texte">Ta messagerie envoie une copie. Tu gardes tout chez toi.</p>
            <div className="vrm-ar-choix" role="radiogroup" aria-label="Ta messagerie">
              {FOURNISSEURS.map((x) => (
                <button key={x.id} type="button" role="radio" aria-checked={x.id === service} className="vrm-ar-choix-btn" data-fournisseur={x.id} onClick={() => setService(x.id)}>{x.nom}</button>
              ))}
            </div>
            <p className="vrm-ar-ou">{f.ou}</p>
            <ol className="vrm-ar-etapes" data-etapes={f.id}>{f.etapes.map((t, i) => (
              <li key={i}><span className="vrm-ar-num" aria-hidden="true">{i + 1}</span>
                <span>{t}
                  {f.code === i ? (code && code.fournisseur === f.id
                    ? <span className="vrm-ar-code-etape" data-code-etape="recu"> <b translate="no">{code.code ? code.code.replace(/(\d{3})(?=\d)/g, '$1 ') : 'Lien reçu'}</b> · reçu {ilYa(code.recuLe, maintenant)}, en haut.</span>
                    : <span className="vrm-ar-code-etape" data-code-etape="attente"> En attente : il arrive dans la minute.</span>) : null}
                </span>
              </li>))}
            </ol>
            <Schema f={f} adresse={adresse}/>
            {f.note ? <p className="vrm-ar-note">{f.note}</p> : null}
            {f.filtre ? (
              <details className="vrm-ar-repli" data-bloc="filtre-gmail">
                <summary>Seulement Vinted et les colis ?</summary>
                <ol className="vrm-ar-etapes">{ETAPES_FILTRE_GMAIL.map((t, i) => <li key={i}><span className="vrm-ar-num" aria-hidden="true">{i + 1}</span><span>{t}</span></li>)}</ol>
                <p className="vrm-ar-regle" translate="no" data-regle-filtre="">{regle}</p>
                <div className="vrm-ar-actions"><BoutonCopier texte={regle} mot="Copier la règle" className="vrm-b vrm-b-secondaire" data-copier-regle=""/></div>
                <p className="vrm-ar-note">Avec le filtre, saute l’étape 5.</p>
              </details>
            ) : null}
            {f.relais ? (
              <details className="vrm-ar-repli" data-bloc="relais-apple">
                <summary>Ton adresse finit par @privaterelay.appleid.com ?</summary>
                <ol className="vrm-ar-etapes">{RELAIS_APPLE.map((t, i) => <li key={i}><span className="vrm-ar-num" aria-hidden="true">{i + 1}</span><span>{t}</span></li>)}</ol>
              </details>
            ) : null}
            {f.lien ? <a className="vrm-lien-action vrm-ar-lien" href={f.lien} target="_blank" rel="noopener noreferrer">{f.lienMot} ↗</a> : null}
          </section>

          <Essai adresse={adresse} d={d} maintenant={maintenant} essai={essai} prepare={prepare} onLancer={lancerEssai} onRecommencer={recommencerEssai}/>

          <GroupeIos titre="Réception" pied={d.actif === false ? 'Désactivée : ce qui arrive est gardé à part, jamais chez un autre.' : 'Tout e-mail livré à cette adresse est rangé chez toi.'}>
            <RangeeIos icone={ICONES.actif} titre="Adresse active" interrupteur={{ on: d.actif !== false, onChange: basculer, disabled: !!envoi, label: 'Adresse active', attrs: { 'data-interrupteur-adresse': d.actif === false ? '0' : '1' } }}/>
          </GroupeIos>

          <GroupeIos titre="Ce que VRM lit">
            {CE_QUI_EST_LU.map((l) => <RangeeIos key={l.id} icone={ICONES[l.id]} titre={l.titre} detail={l.detail} data-lu={l.id}/>)}
          </GroupeIos>

          <section className="vrm-ar-bloc" data-bloc="vinted">
            <h3>Ou l’e-mail d’un compte Vinted</h3>
            <p className="vrm-ar-texte">Sur Vinted : Paramètres → Compte → E‑mail. Mets ton adresse VRM.</p>
            <p className="vrm-ar-note">Vinted t’écrit alors ici seulement, plus dans ta boîte.</p>
          </section>

          <section className="vrm-ar-bloc vrm-ar-avertir" data-bloc="manuel">
            <h3>Pas de transfert à la main</h3>
            <p className="vrm-ar-texte">« Transférer » un e-mail perd son expéditeur d’origine.</p>
            <p className="vrm-ar-texte">Le point relais et le bordereau peuvent se perdre.</p>
          </section>

          <section className="vrm-ar-bloc" data-bloc="boite">
            <p className="vrm-ar-texte">Tes e-mails reçus arrivent dans ta boîte VRM.</p>
            {onBoite ? <button type="button" className="vrm-lien-action vrm-ar-lien" onClick={() => { onFermer && onFermer(); onBoite(); }}>Ouvrir ma boîte VRM</button> : null}
          </section>

          {retour ? <p className="vrm-ar-retour" role="status" data-retour="">{retour}</p> : null}
          <div className="vrm-ar-pied">
            {confirmer
              ? <div className="vrm-ar-confirmer" role="group" aria-label="Remplacer l’adresse" data-confirmer-remplacer="">
                  <p>L’ancienne cesse tout de suite. Ce qui y arrive est gardé à part.</p>
                  <p>Tu devras mettre la nouvelle dans ton transfert.</p>
                  <div className="vrm-ar-actions">
                    <button type="button" className="vrm-b vrm-b-secondaire" onClick={() => setConfirmer(false)} disabled={!!envoi}>Annuler</button>
                    <button type="button" className="vrm-b vrm-b-secondaire vrm-ar-destructif" onClick={remplacer} disabled={!!envoi} data-remplacer-ok="">{envoi === 'remplacer' ? 'Remplacement…' : 'Remplacer'}</button>
                  </div>
                </div>
              : <button type="button" className="vrm-b vrm-b-discret" onClick={() => setConfirmer(true)} disabled={!!envoi} data-remplacer="">Remplacer l’adresse</button>}
            <button type="button" className="vrm-b vrm-b-secondaire vrm-ar-termine" onClick={onFermer} data-termine="">Terminé</button>
          </div>
        </>}
      </div>
    </SheetShell>
  );
}

// L'entrée (Paramètres → E-mails → Adresses, « Relier ma boîte ») : une rangée qui ouvre la feuille.
export default function CarteAdresseReception({ headers, FermeAuRetour, proprio = false, onBoite, titre = 'Recevoir tes e-mails Vinted dans VRM', detail = 'Ton adresse VRM, puis un transfert automatique' }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <GroupeIos className="vrm-ar-entree" data-adresse-reception-entree="">
        <RangeeIos icone={ICONES.arobase} titre={titre} detail={detail} onClick={() => setOuvert(true)} data-ouvrir-adresse-reception=""/>
      </GroupeIos>
      {ouvert ? <FeuilleAdresseReception headers={headers} FermeAuRetour={FermeAuRetour} proprio={proprio} onBoite={onBoite} onFermer={() => setOuvert(false)}/> : null}
    </>
  );
}

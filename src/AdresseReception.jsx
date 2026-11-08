// ══════════════════════════════════════════════════════════════════════════════
// « TON ADRESSE VRM » — la feuille de l'adresse de réception unique (8 nov.)
// ══════════════════════════════════════════════════════════════════════════════
// Julien, 8 nov. : « il faut absolument qu'on mette ça en place » (comme vtools).
// Chaque vendeur a SA propre adresse VRM : il y fait suivre ses e-mails, ou la
// donne à un compte Vinted. La règle est au serveur (api/_lib/adresse-reception.js,
// route `email-rattacher?mode=adresse-unique`) ; cette feuille la MONTRE :
//   · l'adresse en grand, « Copier », « Envoyer un e-mail d'essai », et la preuve
//     que ça marche (« Dernier e-mail reçu il y a 3 min ») ;
//   · le code de confirmation que Gmail (ou Yahoo) a envoyé à SON adresse — le
//     geste qui bloque tout le monde ailleurs — avec « Copier » et le lien ;
//   · « Adresse active », ce que VRM lit, le pas-à-pas par messagerie (schéma du
//     champ où coller), « Ou l'e-mail d'un compte Vinted », le transfert à la
//     main dit tel qu'il est (mesuré : scripts/audit-adresse-reception.cjs, M) ;
//   · « Remplacer l'adresse » (confirmé sur place) et « Terminé ».
// Trois états : `undefined` en cours · `null` pas su (EtatPanne, Réessayer) · lu.
// ══════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SheetShell } from './composants/SheetShell.jsx';
import { SegmenteBase } from './composants/Bouton.jsx';
import { GroupeIos, RangeeIos } from './composants/Ios.jsx';
import { EtatPanne } from './composants/EtatPanne.jsx';
import { requeteJsonBornee } from './requeteJsonBornee.js';
import { ROUTE_ADRESSE, etatAdresse, codeAMontrer, ilYa, NOM_FOURNISSEUR, FOURNISSEURS, CE_QUI_EST_LU, lienEssai } from './adresseReception.js';
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

function BoutonCopier({ texte, mot = 'Copier', className = 'vrm-b vrm-b-primaire', ...rest }) {
  const [etat, setEtat] = useState('');
  const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button type="button" className={className} data-copie={etat || undefined} {...rest}
      onClick={async () => { const ok = await copier(texte); setEtat(ok ? 'ok' : 'ko'); clearTimeout(t.current); t.current = setTimeout(() => setEtat(''), 2200); }}>
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

export function FeuilleAdresseReception({ headers, onFermer, FermeAuRetour, proprio = false, onBoite }) {
  const [d, setD] = useState(undefined);
  const [envoi, setEnvoi] = useState('');          // '' · 'actif' · 'remplacer'
  const [retour, setRetour] = useState('');
  const [confirmer, setConfirmer] = useState(false);
  const [service, setService] = useState('gmail');
  const [maintenant, setMaintenant] = useState(Date.now());
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

  useEffect(() => {
    lire();
    // Relue toutes les 30 s, page visible : le code de Gmail et le premier e-mail apparaissent seuls.
    const t = setInterval(() => { if (document.visibilityState === 'visible') lire(); else setMaintenant(Date.now()); }, 30000);
    const retourPage = () => { if (document.visibilityState === 'visible') lire(); };
    document.addEventListener('visibilitychange', retourPage);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', retourPage); enCours.current?.abort(); };
  }, [lire]);

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
    setRetour(r.ko ? (r.message || 'Pas remplacée — ton adresse n’a pas changé. Réessaie.') : 'Adresse remplacée. Mets la nouvelle dans ton transfert.');
  };

  const pret = d && d.pret;
  const adresse = pret ? d.adresse : '';
  const [local, domaine] = adresse ? [adresse.slice(0, adresse.indexOf('@')), adresse.slice(adresse.indexOf('@'))] : ['', ''];
  const e = etatAdresse(d, maintenant);
  const f = FOURNISSEURS.find((x) => x.id === service) || FOURNISSEURS[0];
  const code = codeAMontrer(d, maintenant) ? d.code : null;

  return (
    <SheetShell onClose={onFermer} FermeAuRetour={FermeAuRetour} titre="Ton adresse VRM" maxWidth={560} z={9000} className="vrm-ar-feuille"
      data-feuille-adresse-reception="" data-etat={d === undefined ? 'lecture' : d === null ? 'pas-su' : !d.pret ? 'pas-prete' : d.actif === false ? 'off' : 'active'}>
      <div className="vrm-ar">
        {d === undefined && <div className="vrm-ar-hero vrm-ar-squelette" role="status" aria-label="Lecture de ton adresse…"><span/><span/><span/></div>}
        {d === null && <EtatPanne quoi="Ton adresse VRM" raison="La lecture n’a pas abouti. Rien n’est perdu, rien n’a changé." onReessayer={lire} data-adresse-reception="pas-su"/>}
        {d && !d.pret && (
          <section className="vrm-ar-hero vrm-ar-fermee" data-adresse-reception="pas-prete">
            <span className="vrm-ar-tuile" aria-hidden="true">{ICONES.arobase}</span>
            <h2>Bientôt ici : ton adresse VRM</h2>
            <p>{d.manque === 'domaine' ? 'L’adresse de réception de VRM n’est pas encore ouverte : il lui manque son domaine.' : 'L’adresse de réception de VRM n’est pas encore disponible sur cette installation.'}</p>
            {proprio ? <p className="vrm-ar-note" data-adresse-proprio="">Pour l’ouvrir : un domaine dédié sur Cloudflare (Email Routing → catch-all → le Worker), puis <code>DOMAINE_RECEPTION</code> sur le serveur — le pas-à-pas est dans <code>docs/email-pipeline.md</code>.</p>
              : <p className="vrm-ar-note">En attendant, tes adresses habituelles continuent de marcher (Adresses, plus haut).</p>}
          </section>
        )}
        {pret && <>
          <section className="vrm-ar-hero" data-actif={d.actif === false ? '0' : '1'}>
            <p className="vrm-ar-sur">{d.actif === false ? 'Ton adresse de réception · désactivée' : 'Ton adresse de réception'}</p>
            <p className="vrm-ar-adresse" data-adresse-reception={adresse} translate="no"><span>{local}</span><wbr/><span className="vrm-ar-domaine">{domaine}</span></p>
            <div className="vrm-ar-actions">
              <BoutonCopier texte={adresse} mot="Copier l’adresse" data-copier-adresse=""/>
              <a className="vrm-b vrm-b-secondaire" href={lienEssai(adresse)} data-essai="">Envoyer un e-mail d’essai</a>
            </div>
            <p className="vrm-ar-etat" data-ton={e.ton} data-dernier={d.dernier ? d.dernier.at : ''} aria-live="polite">
              <span className="vrm-ar-point" aria-hidden="true"/>
              <span><b>{e.phrase}</b>{d.dernier && d.dernier.sujet ? <span className="vrm-ar-sujet"> · {d.dernier.sujet}</span> : null}</span>
            </p>
          </section>

          {code && (
            <section className="vrm-ar-code" data-code-transfert={code.fournisseur} aria-label={`Confirmation de ${NOM_FOURNISSEUR[code.fournisseur] || 'ta messagerie'}`}>
              <p className="vrm-ar-code-sur">{NOM_FOURNISSEUR[code.fournisseur] || 'Ta messagerie'} demande une confirmation · {ilYa(code.recuLe, maintenant)}</p>
              {code.code ? <p className="vrm-ar-code-valeur" data-code-valeur={code.code} translate="no">{code.code.replace(/(\d{3})(?=\d)/g, '$1 ')}</p> : null}
              {code.source ? <p className="vrm-ar-code-source">Demande de <b>{code.source}</b>. Si ce n’est pas ta boîte, ne confirme pas.</p> : null}
              {code.fournisseur === 'gmail' && !code.signe ? <p className="vrm-ar-code-source" data-code-non-signe="">Signature de Google non vérifiée : compare bien l’adresse.</p> : null}
              <div className="vrm-ar-actions">
                {code.code ? <BoutonCopier texte={code.code} mot="Copier le code" data-copier-code=""/> : null}
                {code.lien ? <a className={code.code ? 'vrm-b vrm-b-secondaire' : 'vrm-b vrm-b-primaire'} href={code.lien} target="_blank" rel="noopener noreferrer" data-lien-confirmation="">Confirmer chez {NOM_FOURNISSEUR[code.fournisseur] || 'le fournisseur'} ↗</a> : null}
              </div>
            </section>
          )}

          <GroupeIos titre="Réception" pied={d.actif === false ? 'Désactivée : ce qui arrive à cette adresse est gardé à part, jamais rangé chez toi ni chez un autre.' : 'Tout e-mail livré à cette adresse est rangé chez toi : elle est à toi seul.'}>
            <RangeeIos icone={ICONES.actif} titre="Adresse active" interrupteur={{ on: d.actif !== false, onChange: basculer, disabled: !!envoi, label: 'Adresse active', attrs: { 'data-interrupteur-adresse': d.actif === false ? '0' : '1' } }}/>
          </GroupeIos>

          <GroupeIos titre="Ce que VRM lit">
            {CE_QUI_EST_LU.map((l) => <RangeeIos key={l.id} icone={ICONES[l.id]} titre={l.titre} detail={l.detail} data-lu={l.id}/>)}
          </GroupeIos>

          <section className="vrm-ar-bloc" data-bloc="transfert">
            <h3>Un transfert automatique</h3>
            <p className="vrm-ar-texte">Dans ta messagerie, fais suivre tes e-mails vers ton adresse VRM. Tu les gardes aussi chez toi.</p>
            <SegmenteBase label="Ta messagerie" value={service} onChange={setService} plein className="vrm-ar-seg" options={FOURNISSEURS.map((x) => ({ v: x.id, l: x.nom, data: { 'data-fournisseur': x.id } }))}/>
            <p className="vrm-ar-ou">{f.ou}</p>
            <ol className="vrm-ar-etapes" data-etapes={f.id}>{f.etapes.map((t, i) => <li key={i}><span className="vrm-ar-num" aria-hidden="true">{i + 1}</span><span>{t}</span></li>)}</ol>
            <Schema f={f} adresse={adresse}/>
            {f.id === 'gmail' ? <p className="vrm-ar-note">Pour ne faire suivre que Vinted et les transporteurs : après l’étape 3, un filtre « De : vinted.fr OR mondialrelay OR chronopost » → Transférer à ton adresse VRM.</p> : null}
            <a className="vrm-lien-action vrm-ar-lien" href={f.lien} target="_blank" rel="noopener noreferrer">{f.lienMot} ↗</a>
          </section>

          <section className="vrm-ar-bloc" data-bloc="vinted">
            <h3>Ou l’e-mail d’un compte Vinted</h3>
            <p className="vrm-ar-texte">Sur Vinted : Paramètres → Compte → E-mail, mets ton adresse VRM. Vinted t’écrit alors directement ici, sans transfert — tu lis ces e-mails dans ta boîte VRM (plus dans ta boîte habituelle).</p>
          </section>

          <section className="vrm-ar-bloc vrm-ar-avertir" data-bloc="manuel">
            <h3>Pas de transfert à la main</h3>
            <p className="vrm-ar-texte">« Transférer » un e-mail un par un fait perdre son expéditeur d’origine. VRM lit encore une vente ou un code de colis si le message garde la ligne « De : Vinted » ou « De : Mondial Relay », mais le point relais, la date d’arrivée et le bordereau (s’il n’est pas joint) se perdent. Le transfert automatique garde tout.</p>
          </section>

          <section className="vrm-ar-bloc" data-bloc="boite">
            <p className="vrm-ar-texte">Les e-mails reçus apparaissent dans ta boîte VRM, comme les autres.</p>
            {onBoite ? <button type="button" className="vrm-lien-action vrm-ar-lien" onClick={() => { onFermer && onFermer(); onBoite(); }}>Ouvrir ma boîte VRM</button> : null}
          </section>

          {retour ? <p className="vrm-ar-retour" role="status" data-retour="">{retour}</p> : null}
          <div className="vrm-ar-pied">
            {confirmer
              ? <div className="vrm-ar-confirmer" role="group" aria-label="Remplacer l’adresse" data-confirmer-remplacer="">
                  <p>L’ancienne adresse cesse tout de suite : ce qui y arrive ensuite est gardé à part, jamais donné à un autre. Tu devras mettre la nouvelle dans ton transfert.</p>
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
export default function CarteAdresseReception({ headers, FermeAuRetour, proprio = false, onBoite, titre = 'Ton adresse VRM', detail = 'Une adresse à toi : fais-y suivre tes e-mails' }) {
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

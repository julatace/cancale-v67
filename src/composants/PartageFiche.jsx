// ── « PARTAGER » UNE FICHE (11 nov., lot partage-fiche) ─────────────────────
// La feuille ouverte depuis une annonce (Annonces → « … » → Partager) ou le
// Stock (fiche d'une paire → Partager). Elle montre EXACTEMENT ce que verra le
// client (la règle `nettoyerFiche`, la même que le serveur), puis crée le lien
// vrm.center/p/<jeton> et ouvre le partage du téléphone (sinon copie le lien).
// Gestes comptés : « … » → « Partager » → « Créer et partager » = 3.
// Trois états de la lecture de SES liens : `undefined` en cours · `null` pas su · liste.
// Règle et serveur : src/partageFiche.js, api/_lib/partage-fiche.js.
import React from 'react';
import { nettoyerFiche, NOM_SITE, DUREES_JOURS, DUREE_DEFAUT, dateCourte, prixTexte } from '../partageFiche.js';
import './partage-fiche.css';

const ROUTE = '/api/compte?mode=partage';
// « 18 nov. » finit déjà par un point : jamais « 18 nov.. ».
const finPhrase = (t) => (/[.!?]$/.test(t) ? t : t + '.');
const memeArticle = (p, ident) => !!(p && p.ident && ident && ((ident.itemId && p.ident.itemId === ident.itemId) || (!ident.itemId && ident.num && p.ident.num === ident.num)));

// Le partage du téléphone, sinon le presse-papiers. Rend 'partage' | 'copie' | 'annule' | 'refuse'.
export async function partagerLien(url, titre, nav = (typeof navigator !== 'undefined' ? navigator : null)) {
  if (nav && typeof nav.share === 'function') {
    try { await nav.share({ title: titre || 'Article', url }); return 'partage'; }
    catch (e) { if (e && e.name === 'AbortError') return 'annule'; if (e && e.name === 'NotAllowedError') return 'refuse'; }
  }
  try { await nav.clipboard.writeText(url); return 'copie'; } catch (_) { return 'refuse'; }
}

export default function PartageFiche({ source, onFermer, Feuille, Bouton, Segmente, toast = () => {}, enTete = () => ({}), envoyer, nav }) {
  const f = envoyer || ((...a) => fetch(...a));
  const ident = (source && source.ident) || {};
  const liensTrouves = (source && Array.isArray(source.liens)) ? source.liens : [];
  const [sites, setSites] = React.useState(null);        // Set des sites cochés (null = tous ceux trouvés)
  const [pseudo, setPseudo] = React.useState(false);
  const [duree, setDuree] = React.useState(DUREE_DEFAUT);
  const [liste, setListe] = React.useState(undefined);
  const [occupe, setOccupe] = React.useState('');
  const appel = React.useCallback(async (init) => {
    try {
      const r = await f(ROUTE, { ...(init || {}), headers: { ...enTete(), ...(init && init.body ? { 'Content-Type': 'application/json' } : {}) } });
      const j = await r.json().catch(() => null);
      return r.status === 200 && j && j.ok === true ? j : { erreur: (j && j.message) || 'Rien n’a changé. Réessaie.' };
    } catch (_) { return { erreur: 'Pas de réseau. Réessaie.' }; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => { appel().then((j) => setListe(j.erreur ? null : (j.partages || []))); }, [appel]);

  const cochés = sites || new Set(liensTrouves.map((l) => l.site));
  const brut = source && source.fiche ? { ...source.fiche, liens: liensTrouves.filter((l) => cochés.has(l.site)), pseudo: pseudo ? (source.pseudo || '') : '' } : null;
  const fiche = brut ? nettoyerFiche(brut) : null;
  const actuel = Array.isArray(liste) ? liste.find((p) => memeArticle(p, ident)) || null : null;
  const autres = Array.isArray(liste) ? liste.filter((p) => p !== actuel) : [];

  const partager = async (p) => {
    const r = await partagerLien(p.url, fiche ? fiche.titre : p.titre, nav);
    if (r === 'copie') toast('Lien copié. Colle-le dans ton message.', 'ok');
    // Le téléphone a refusé d'ouvrir son partage après l'attente du serveur : le lien
    // est prêt, « Partager le lien » le rouvre d'un geste.
    else if (r === 'refuse') toast('Lien prêt : touche « Partager le lien ».', 'info');
  };
  const creer = async () => {
    if (!fiche) return;
    setOccupe('creer');
    const j = await appel({ method: 'POST', body: JSON.stringify({ action: 'creer', fiche: brut, ident, duree }) });
    setOccupe('');
    if (j.erreur) { toast(j.erreur, 'err'); return; }
    setListe((l) => [j.partage, ...(Array.isArray(l) ? l : [])]);
    try { window.dispatchEvent(new Event('vrm:partage-cree')); } catch (_) {}
    await partager(j.partage);
  };
  const actualiser = async () => {
    if (!fiche || !actuel) return;
    setOccupe('maj');
    const j = await appel({ method: 'POST', body: JSON.stringify({ action: 'actualiser', ligne: actuel.ligne, fiche: brut }) });
    setOccupe('');
    if (j.erreur) { toast(j.erreur, 'err'); return; }
    setListe((l) => (l || []).map((p) => (p.ligne === actuel.ligne ? { ...p, ...j.partage } : p)));
    toast('Fiche mise à jour. Le lien ne change pas.', 'ok');
  };
  const arreter = async (p) => {
    setOccupe('arreter:' + p.ligne);
    const j = await appel({ method: 'POST', body: JSON.stringify({ action: 'arreter', ligne: p.ligne }) });
    setOccupe('');
    if (j.erreur) { toast(j.erreur, 'err'); return; }
    setListe((l) => (l || []).filter((x) => x.ligne !== p.ligne));
    toast('Partage arrêté. Le lien ne marche plus.', 'ok');
  };
  const copier = async (p) => {
    try { await navigator.clipboard.writeText(p.url); toast('Lien copié.', 'ok'); } catch (_) { toast('Copie impossible ici : appuie longuement sur le lien.', 'info'); }
  };

  const details = fiche ? [fiche.taille ? `Taille ${fiche.taille}` : '', fiche.etat].filter(Boolean).join(' · ') : '';
  const etatPartage = actuel ? (actuel.vendu ? 'vendu' : 'actif') : 'aucun';
  return (
    <Feuille onClose={onFermer} titre="Partager" sousTitre="Un lien pour un client, hors Vinted" maxWidth={460} data-partage-feuille={etatPartage}>
      <div className="vrm-partage">
        {!fiche ? <p className="vrm-partage-note" data-partage-impossible="">Rien à montrer : il faut un titre ou une photo.</p> : (
          <figure className="vrm-partage-apercu" data-partage-apercu="" aria-label="Ce que ton client verra">
            {fiche.photos[0] ? <img src={fiche.photos[0]} alt="" referrerPolicy="no-referrer" data-sans-visionneuse=""/> : <span className="vrm-partage-sansphoto" aria-hidden="true"/>}
            <figcaption>
              <span className="vrm-partage-titre">{fiche.titre}</span>
              {details ? <span className="vrm-partage-details">{details}</span> : null}
              <span className="vrm-partage-prix" data-partage-apercu-prix={fiche.prix == null ? '' : String(fiche.prix)}>{actuel && actuel.vendu ? 'Vendu' : fiche.prix != null ? prixTexte(fiche.prix) : 'Prix pas lu'}</span>
              {fiche.photos.length > 1 ? <span className="vrm-partage-details">{fiche.photos.length} photos</span> : null}
            </figcaption>
          </figure>
        )}
        <p className="vrm-partage-note" data-partage-prive="">Jamais montrés : prix d’achat, N°, compte, adresse.</p>

        {!actuel && fiche ? (<>
          <div className="vrm-partage-groupe" data-partage-liens-choix={liensTrouves.length}>
            <span className="vrm-partage-lib">Liens des annonces</span>
            {source && source.chercheLiens ? <span className="vrm-partage-note" data-partage-cherche="">Je cherche ses autres annonces…</span> : null}
            {liensTrouves.length ? liensTrouves.map((l) => (
              <label key={l.site + l.url} className="vrm-partage-case">
                <input type="checkbox" checked={cochés.has(l.site)} onChange={() => { const s = new Set(cochés); if (s.has(l.site)) s.delete(l.site); else s.add(l.site); setSites(s); }} data-partage-site={l.site}/>
                <span>Voir sur {NOM_SITE[l.site] || l.site}</span>
              </label>
            )) : (!source || !source.chercheLiens) ? <span className="vrm-partage-note" data-partage-sans-lien="">Aucune annonce en ligne trouvée.</span> : null}
          </div>
          {source && source.pseudo ? (
            <label className="vrm-partage-case" data-partage-pseudo-choix="">
              <input type="checkbox" checked={pseudo} onChange={() => setPseudo((x) => !x)}/>
              <span>Montrer mon pseudo</span>
            </label>
          ) : null}
          {cochés.has('vinted') && liensTrouves.some((l) => l.site === 'vinted') ? <p className="vrm-partage-note">L’annonce Vinted montre ton pseudo.</p> : null}
          <div className="vrm-partage-groupe">
            <span className="vrm-partage-lib">Lien valable</span>
            <Segmente label="Durée du lien" plein value={duree} onChange={setDuree}
              options={DUREES_JOURS.map((d) => ({ v: d, l: d === 1 ? '1 jour' : `${d} jours`, data: { 'data-partage-duree': String(d) } }))}/>
          </div>
          <div className="vrm-fs-pied">
            <Bouton variante="primaire" plein icone="link" occupe={occupe === 'creer'} disabled={liste === undefined} onClick={creer} data-partage-creer="">Créer le lien et partager</Bouton>
          </div>
        </>) : null}

        {actuel ? (
          <div className="vrm-partage-groupe" data-partage-actuel={actuel.ligne}>
            <span className="vrm-partage-lib">{actuel.vendu ? 'Lien actif · la page dit « Vendu »' : 'Lien actif'}</span>
            <input className="vrm-partage-url" readOnly value={actuel.url} onFocus={(e) => { try { e.target.select(); } catch (_) {} }} aria-label="Le lien" data-partage-url=""/>
            <span className="vrm-partage-note" data-partage-expire="">{finPhrase(`Valable jusqu’au ${dateCourte(Date.parse(actuel.expire), false)}`)}</span>
            <Bouton variante="primaire" plein icone="link" onClick={() => partager(actuel)} data-partage-ouvrir="">Partager le lien</Bouton>
            <div className="vrm-partage-gestes">
              <button type="button" className="vrm-lien-action" onClick={() => copier(actuel)} data-partage-copier="">Copier</button>
              {fiche && !actuel.vendu ? <button type="button" className="vrm-lien-action" disabled={!!occupe} onClick={actualiser} data-partage-actualiser="">Mettre à jour</button> : null}
              <button type="button" className="vrm-lien-action vrm-partage-arreter" disabled={!!occupe} onClick={() => arreter(actuel)} data-partage-arreter="">Arrêter le partage</button>
            </div>
          </div>
        ) : null}

        {liste === null ? <p className="vrm-partage-note" data-partage-passu="">Tes liens n’ont pas pu être lus. Réessaie.</p> : null}
        {autres.length ? (
          <details className="vrm-partage-autres" data-partage-autres={autres.length}>
            <summary>Mes autres liens actifs ({autres.length})</summary>
            <ul>
              {autres.map((p) => (
                <li key={p.ligne}>
                  <span className="vrm-partage-autre-titre">{p.titre || 'Article'}{p.vendu ? ' · Vendu' : ''}</span>
                  <span className="vrm-partage-note">Jusqu’au {dateCourte(Date.parse(p.expire), false)}</span>
                  <span className="vrm-partage-gestes">
                    <button type="button" className="vrm-lien-action" onClick={() => copier(p)}>Copier</button>
                    <button type="button" className="vrm-lien-action vrm-partage-arreter" disabled={!!occupe} onClick={() => arreter(p)} data-partage-arreter-autre={p.ligne}>Arrêter</button>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </Feuille>
  );
}

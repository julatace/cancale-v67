import React, { useState, useEffect, useMemo } from 'react';
import { etatEmballages, lireReglage, poserType, retirerType, poserDefaut, choisirPourColis, typeDuColis, AUCUN, CLE_EMBALLAGES, propositionFormat, commeDerniereFois } from './emballages.js';
import { modeleSur } from './ceQuiRapporte.js';
import { tr } from './i18n/index.js';
import './styles-calculette-emballages.css';
import './styles-colis-plus.css';

// ════════════════════════════════════════════════════════════════════════════
//  LE STOCK D'EMBALLAGES (10 nov., lot L) — la carte du Stock, sa feuille de
//  saisie, et le choix (facultatif) de l'emballage d'un colis dans « Préparer ».
//  Tout se calcule dans src/emballages.js (le reste est DÉRIVÉ des « Colis fait »).
//  Couleurs (§7) : neutre ; AMBRE quand il en reste au seuil ou dessous (un geste :
//  en racheter) ; jamais rouge.
// ════════════════════════════════════════════════════════════════════════════

const CLES_FAITS = ['vinted_ship_done', 'vrm_lbc_colis_done', 'vrm_vc_colis_done'];
const dateCourte = (ms) => new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

// Relit les « Colis fait » à chaque écriture de leurs clés (ici ou sur un autre appareil).
function useFaits(lireFaits) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const f = (e) => { const k = e && e.detail && e.detail.k; if (!k || CLES_FAITS.includes(k) || k === CLE_EMBALLAGES) setN((x) => x + 1); };
    const s = (e) => { if (!e || CLES_FAITS.includes(e.key)) setN((x) => x + 1); };
    window.addEventListener('vrm:save', f); window.addEventListener('storage', s);
    return () => { window.removeEventListener('vrm:save', f); window.removeEventListener('storage', s); };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => { try { return lireFaits(); } catch (_) { return null; } }, [n]);
}

function FeuilleEmballage({ type, onClose, onEnregistrer, onRetirer, Feuille, exemple = 'Carton moyen' }) {
  const [nom, setNom] = useState(type ? type.nom : '');
  const [n, setNbr] = useState(type && type.restant != null ? String(Math.max(0, type.restant)) : '');
  const [cout, setCout] = useState(type ? type.cout : '');
  const [seuil, setSeuil] = useState(type && type.seuil != null ? String(type.seuil) : '');
  // (14 nov., 97) Une fourniture prise par CHAQUE colis (scotch…) et combien de colis fait une unité.
  const [tous, setTous] = useState(!!(type && type.tous));
  const [pour, setPour] = useState(type && type.tous && type.pour > 1 ? String(type.pour) : '');
  const [err, setErr] = useState('');
  const nAvant = type && type.restant != null ? String(Math.max(0, type.restant)) : '';
  const valider = (e) => {
    e.preventDefault();
    // Le comptage n'est re-daté que s'il a CHANGÉ le nombre (sinon le décompte continue).
    const r = onEnregistrer({ id: type ? type.id : '', nom, cout, n: n === nAvant && type ? '' : n, seuil, tous, pour: tous ? pour : '' });
    if (r && r.erreur) setErr(r.erreur); else onClose();
  };
  const corps = (
    <form className="vrm-emb2-form" onSubmit={valider} data-emballage-feuille={type ? type.id : 'nouveau'}>
      <label><span>Nom</span><input autoFocus={!type} value={nom} maxLength={32} placeholder={exemple} data-emb-champ="nom" onChange={(e) => { setNom(e.target.value); setErr(''); }}/></label>
      <label><span>J’en ai</span><input inputMode="numeric" value={n} placeholder="40" data-emb-champ="n" onChange={(e) => { setNbr(e.target.value); setErr(''); }}/></label>
      <label><span>Coût d’un emballage</span><span className="vrm-calc-saisie"><input inputMode="decimal" value={cout} placeholder="facultatif" data-emb-champ="cout" onChange={(e) => { setCout(e.target.value); setErr(''); }}/><span aria-hidden="true">€</span></span></label>
      <label><span>Préviens-moi à</span><input inputMode="numeric" value={seuil} placeholder="5" data-emb-champ="seuil" onChange={(e) => { setSeuil(e.target.value); setErr(''); }}/></label>
      <label className="vrm-cp-coche"><input type="checkbox" checked={tous} data-emb-champ="tous" onChange={(e) => { setTous(e.target.checked); setErr(''); }}/><span>{tr('cp.four.tous')}</span></label>
      {tous ? <label><span>{tr('cp.four.pour')}</span><input inputMode="numeric" value={pour} placeholder="25" data-emb-champ="pour" onChange={(e) => { setPour(e.target.value); setErr(''); }}/></label> : null}
      {err ? <p className="vrm-emb2-err" role="alert" data-emb-erreur="">{err}</p> : null}
      <div className="vrm-emb2-actions">
        {type && onRetirer ? <button type="button" className="vrm-emb2-b" data-emb-retirer={type.id} onClick={() => { onRetirer(type.id); onClose(); }}>Retirer</button> : null}
        <button type="submit" className="vrm-emb2-b is-plein" data-emb-enregistrer="">Enregistrer</button>
      </div>
    </form>
  );
  return Feuille ? <Feuille onClose={onClose} titre={type ? type.nom : 'Nouvel emballage'} maxWidth={420}>{corps}</Feuille> : corps;
}

// La carte du Stock. `reglage` : `vrm_emballages` ; `ecrire(r)` : SON clic seulement ;
// `lireFaits()` : les « Colis fait » datés (`colisFaits`).
// (11 nov., lot DJ2) `exemple` : le nom d'emballage proposé selon ce qu'il vend (src/vocabulaireVendeur.js).
export function EmballagesCarte({ reglage, ecrire, lireFaits, Feuille, exemple }) {
  const faits = useFaits(lireFaits);
  const etat = useMemo(() => etatEmballages(reglage, faits || []), [reglage, faits]);
  const [ouvert, setOuvert] = useState(null);   // null · 'nouveau' · id
  const r = lireReglage(reglage);
  const enregistrer = (x) => { const res = poserType(reglage, x); if (res.erreur) return res; ecrire(res.reglage); return null; };
  const typeOuvert = ouvert && ouvert !== 'nouveau' ? etat.types.find((t) => t.id === ouvert) : null;
  return (
    <section className="vrm-emb2" aria-label="Emballages" data-emballages={etat.types.length} data-emballages-alertes={etat.alertes}>
      <div className="vrm-emb2-tete">
        <span>Emballages</span>
        <button type="button" className="vrm-emb2-ajout" data-emb-ajouter="" onClick={() => setOuvert('nouveau')}>Ajouter</button>
      </div>
      {!etat.types.length ? <p className="vrm-emb2-vide" data-emb-vide="">Note tes emballages (cartons, sacs) : chaque colis fait en retire un.</p> : (
        <ul className="vrm-emb2-liste">
          {etat.types.map((t) => (
            <li key={t.id}>
              <button type="button" className={'vrm-emb2-l' + (t.alerte ? ' is-alerte' : '')} data-emb-type={t.id} data-emb-restant={t.restant == null ? '' : String(t.restant)} data-emb-alerte={t.alerte ? '1' : '0'} onClick={() => setOuvert(t.id)}>
                <span className="vrm-emb2-nom">
                  <b>{t.nom}</b>
                  <small>{t.compte ? `compté le ${dateCourte(t.compte.at)} · ${t.utilises} utilisé${t.utilises > 1 ? 's' : ''}` : 'pas encore compté'}{r.defaut === t.id && etat.plusieurs ? ' · par défaut' : ''}{t.cout ? ` · ${t.cout} €` : ''}</small>
                  {t.tous || t.jours != null ? <small className="vrm-cp-four" data-emb-tous={t.tous ? String(t.pour) : undefined} data-emb-jours={t.jours == null ? undefined : String(t.jours)}>
                    {[t.tous ? tr('cp.four.chaqueColis') : '', t.tous && t.pour > 1 && t.colisPossibles != null && t.colisPossibles > 0 ? tr('cp.four.colisPossibles', { n: t.colisPossibles }) : '', t.jours != null ? tr('cp.four.rythme', { n: t.jours }) : ''].filter(Boolean).join(' · ')}
                  </small> : null}
                </span>
                <span className="vrm-emb2-n">{t.restant == null ? '—' : Math.max(0, t.restant)}</span>
                <span className="vrm-emb2-chevron" aria-hidden="true">›</span>
              </button>
              {t.recompter ? <p className="vrm-emb2-alerte" data-emb-recompter={t.id}>Plus de colis que comptés : recompte-les.</p>
                : t.alerte ? <p className="vrm-emb2-alerte" data-emb-alerte-txt={t.id}>{t.restant <= 0 ? 'Il n’en reste plus.' : 'Bientôt plus : pense à en racheter.'}</p> : null}
            </li>
          ))}
        </ul>
      )}
      {etat.plusieurs ? (
        <div className="vrm-emb2-defaut" role="radiogroup" aria-label="Emballage par défaut">
          <span>Par défaut</span>
          {etat.types.filter((t) => !t.tous).map((t) => <button key={t.id} type="button" role="radio" aria-checked={r.defaut === t.id} className={'vrm-calc-puce' + (r.defaut === t.id ? ' is-on' : '')} data-emb-defaut={t.id} onClick={() => ecrire(poserDefaut(reglage, r.defaut === t.id ? '' : t.id).reglage)}>{t.nom}</button>)}
        </div>
      ) : null}
      {etat.sansType ? <p className="vrm-emb2-note" data-emb-sans-type={etat.sansType}>{etat.sansType} colis sans emballage choisi : pas décomptés.</p> : null}
      {etat.types.length ? <p className="vrm-emb2-note">Les colis eBay ne sont pas décomptés.</p> : null}
      {ouvert ? <FeuilleEmballage key={ouvert} type={typeOuvert} Feuille={Feuille} exemple={exemple} onClose={() => setOuvert(null)} onEnregistrer={enregistrer}
        onRetirer={(id) => ecrire(retirerType(reglage, id).reglage)}/> : null}
    </section>
  );
}

// « Préparer mes colis » : le choix FACULTATIF de l'emballage de CE colis (seulement
// s'il en a plusieurs). Le défaut est pré-choisi ; « Aucun » ne décompte rien.
// (14 nov., 96) `titre` : le modèle de la vente (`modeleSur`, une proposition) ; SON choix est
// retenu pour ce modèle, et le colis suivant du même modèle se voit PROPOSER ce format
// (« Prendre » — rien n'est posé sans son toucher).
// (14 nov., 97) `lireFaits` : les « Colis fait » datés — une ligne ambre quand une fourniture
// est au seuil qu'il a choisi (« Plus que 2 · Carton moyen »), avant d'en manquer.
export function ChoixEmballageColis({ reglage, cle, ecrire, titre = '', lireFaits = null }) {
  const r = lireReglage(reglage);
  const faits = useMemo(() => { try { return typeof lireFaits === 'function' ? lireFaits() : null; } catch (_) { return null; } }, [lireFaits, reglage]); // eslint-disable-line react-hooks/exhaustive-deps
  const alertes = useMemo(() => (faits ? etatEmballages(reglage, faits).types.filter((t) => t.alerte) : []), [reglage, faits]);
  const modele = useMemo(() => (titre ? modeleSur('', titre) : null), [titre]);
  if (!cle) return null;
  const types = r.types.filter((t) => !t.tous);
  const ligneAlertes = alertes.length ? (
    <p className="vrm-cp-alerte" data-emb-alerte-prep={alertes.map((t) => t.id).join(',')} role="status">
      {alertes.map((t) => (t.restant <= 0 ? tr('cp.four.plusDe', { nom: t.nom }) : tr('cp.four.plusQue', { n: t.restant, nom: t.nom }))).join(' · ')}. {tr('cp.four.racheter')}
    </p>) : null;
  if (types.length < 2) return ligneAlertes;
  const actuel = r.choix[cle] === AUCUN ? AUCUN : typeDuColis(r, cle);
  const poser = (id) => ecrire(choisirPourColis(reglage, cle, id === (r.defaut || '') ? '' : id, { modele, retenu: id === AUCUN ? '' : id }).reglage);
  const prop = propositionFormat(reglage, cle, modele);
  const comme = !prop && commeDerniereFois(reglage, cle, modele) && r.choix[cle];
  return (
    <>
      {prop ? (
        <p className="vrm-cp-propose" data-emb-propose={prop.id} data-emb-propose-modele={modele ? modele.cle : ''}>
          <span>{tr('cp.format.propose', { type: prop.nom, modele: prop.modele })}</span>
          <button type="button" className="vrm-cp-lien" data-emb-prendre={prop.id} onClick={() => poser(prop.id)}>{tr('cp.format.prendre')}</button>
        </p>) : null}
      <div className="vrm-emb2-choix" role="radiogroup" aria-label="Emballage de ce colis" data-emb-choix-colis={cle} data-emb-choix={actuel || ''}>
        <span>Emballage</span>
        {types.map((t) => <button key={t.id} type="button" role="radio" aria-checked={actuel === t.id} className={'vrm-calc-puce' + (actuel === t.id ? ' is-on' : '')} data-emb-choix-type={t.id} onClick={() => poser(t.id)}>{t.nom}</button>)}
        <button type="button" role="radio" aria-checked={actuel === AUCUN} className={'vrm-calc-puce' + (actuel === AUCUN ? ' is-on' : '')} data-emb-choix-type={AUCUN} onClick={() => poser(AUCUN)}>Aucun</button>
      </div>
      {comme && modele ? <p className="vrm-cp-note" data-emb-comme="">{tr('cp.format.comme', { modele: modele.nom })}</p> : null}
      {prop || comme ? <p className="vrm-cp-note">{tr('cp.format.ouSert')}</p> : null}
      {ligneAlertes}
    </>
  );
}

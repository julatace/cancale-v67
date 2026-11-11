import React, { useState, useEffect, useMemo } from 'react';
import { etatEmballages, lireReglage, poserType, retirerType, poserDefaut, choisirPourColis, typeDuColis, AUCUN, CLE_EMBALLAGES } from './emballages.js';
import './styles-calculette-emballages.css';

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

function FeuilleEmballage({ type, onClose, onEnregistrer, onRetirer, Feuille }) {
  const [nom, setNom] = useState(type ? type.nom : '');
  const [n, setNbr] = useState(type && type.restant != null ? String(Math.max(0, type.restant)) : '');
  const [cout, setCout] = useState(type ? type.cout : '');
  const [seuil, setSeuil] = useState(type && type.seuil != null ? String(type.seuil) : '');
  const [err, setErr] = useState('');
  const nAvant = type && type.restant != null ? String(Math.max(0, type.restant)) : '';
  const valider = (e) => {
    e.preventDefault();
    // Le comptage n'est re-daté que s'il a CHANGÉ le nombre (sinon le décompte continue).
    const r = onEnregistrer({ id: type ? type.id : '', nom, cout, n: n === nAvant && type ? '' : n, seuil });
    if (r && r.erreur) setErr(r.erreur); else onClose();
  };
  const corps = (
    <form className="vrm-emb2-form" onSubmit={valider} data-emballage-feuille={type ? type.id : 'nouveau'}>
      <label><span>Nom</span><input autoFocus={!type} value={nom} maxLength={32} placeholder="Boîte à chaussures" data-emb-champ="nom" onChange={(e) => { setNom(e.target.value); setErr(''); }}/></label>
      <label><span>J’en ai</span><input inputMode="numeric" value={n} placeholder="40" data-emb-champ="n" onChange={(e) => { setNbr(e.target.value); setErr(''); }}/></label>
      <label><span>Coût d’un emballage</span><span className="vrm-calc-saisie"><input inputMode="decimal" value={cout} placeholder="facultatif" data-emb-champ="cout" onChange={(e) => { setCout(e.target.value); setErr(''); }}/><span aria-hidden="true">€</span></span></label>
      <label><span>Préviens-moi à</span><input inputMode="numeric" value={seuil} placeholder="5" data-emb-champ="seuil" onChange={(e) => { setSeuil(e.target.value); setErr(''); }}/></label>
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
export function EmballagesCarte({ reglage, ecrire, lireFaits, Feuille }) {
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
          {etat.types.map((t) => <button key={t.id} type="button" role="radio" aria-checked={r.defaut === t.id} className={'vrm-calc-puce' + (r.defaut === t.id ? ' is-on' : '')} data-emb-defaut={t.id} onClick={() => ecrire(poserDefaut(reglage, r.defaut === t.id ? '' : t.id).reglage)}>{t.nom}</button>)}
        </div>
      ) : null}
      {etat.sansType ? <p className="vrm-emb2-note" data-emb-sans-type={etat.sansType}>{etat.sansType} colis sans emballage choisi : pas décomptés.</p> : null}
      {etat.types.length ? <p className="vrm-emb2-note">Les colis eBay ne sont pas décomptés.</p> : null}
      {ouvert ? <FeuilleEmballage key={ouvert} type={typeOuvert} Feuille={Feuille} onClose={() => setOuvert(null)} onEnregistrer={enregistrer}
        onRetirer={(id) => ecrire(retirerType(reglage, id).reglage)}/> : null}
    </section>
  );
}

// « Préparer mes colis » : le choix FACULTATIF de l'emballage de CE colis (seulement
// s'il en a plusieurs). Le défaut est pré-choisi ; « Aucun » ne décompte rien.
export function ChoixEmballageColis({ reglage, cle, ecrire }) {
  const r = lireReglage(reglage);
  if (r.types.length < 2 || !cle) return null;
  const actuel = r.choix[cle] === AUCUN ? AUCUN : typeDuColis(r, cle);
  const poser = (id) => ecrire(choisirPourColis(reglage, cle, id === (r.defaut || '') ? '' : id).reglage);
  return (
    <div className="vrm-emb2-choix" role="radiogroup" aria-label="Emballage de ce colis" data-emb-choix-colis={cle} data-emb-choix={actuel || ''}>
      <span>Emballage</span>
      {r.types.map((t) => <button key={t.id} type="button" role="radio" aria-checked={actuel === t.id} className={'vrm-calc-puce' + (actuel === t.id ? ' is-on' : '')} data-emb-choix-type={t.id} onClick={() => poser(t.id)}>{t.nom}</button>)}
      <button type="button" role="radio" aria-checked={actuel === AUCUN} className={'vrm-calc-puce' + (actuel === AUCUN ? ' is-on' : '')} data-emb-choix-type={AUCUN} onClick={() => poser(AUCUN)}>Aucun</button>
    </div>
  );
}

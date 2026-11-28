// ════════════════════════════════════════════════════════════════════════════
//  eBAY › AUTOMATISMES (28 nov. 2026, lot ebay-automatismes) — la page de SES réglages
// ════════════════════════════════════════════════════════════════════════════
// Julien : « copie tous les concurrents, fais pareil pour eBay ». Par compte eBay, chacun ÉTEINT par défaut :
//   · Baisse par règle (−5/−10/−15 % après 7/14/30 j sans vente) ;
//   · Offre aux observateurs (−x % après 24/48/72 h d'observateurs, une fois par annonce et par période) ;
//   · Contre-offre par paliers (doux, standard, direct) — jamais une acceptation : c'est eBay, à SON seuil ;
//   · Remise en vente des invendus (N par jour, seulement sans frais par défaut, SKU VRM-{n°} gardé) ;
//   · Prix eBay ajusté (+x % pour couvrir les frais) : proposé à la publication, il remonte aussi le plancher ;
//   · Modifier en masse (cocher ⇒ −x %, un nouveau prix, ou terminer ; récapitulatif, puis SON « Appliquer ») ;
//   · Vendre un similaire (balayer une annonce ⇒ un brouillon prérempli, sans N° : il choisit la paire) ;
//   · Ce qui a été fait en son nom (le journal) et « Lancer maintenant ».
// Le plancher (prix mini, sinon achat + 10 %) n'est JAMAIS franchi ; sans plancher, rien. Tout passe par la route
// `api/ebay.js` (autolire · autoregler · autolancer · masse · similaire) ; les règles : src/ebay/automatismes.js.
// Tout texte par tr() (eauto.*).
// ════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useCallback } from 'react';
import { tr, monnaie, date as dateTr, heure as heureTr, nombre } from '../i18n/index.js';
import { appelerEbay } from '../ebayRequetes.js';
import { Groupe, Rangee, Segmente, Bouton, Feuille, Vignette, Plaque } from '../natif/index.js';
import { reglagesCompte, avecReglages, BAISSE_PCT, BAISSE_JOURS, OFFRE_PCT, OFFRE_HEURES, OFFRE_PERIODE_JOURS, PALIERS_PRESETS, RELANCE_PAR_JOUR,
  MAJORATION_PCT, MASSE_PCT, MASSE_MAX, majorationDe, avecMajoration, MAJORATION_CLE, ligneMasse, unAllume } from './automatismes.js';

const eur = (c, devise = 'EUR') => (Number.isInteger(c) ? monnaie(c / 100, devise || 'EUR') : '—');
const quand = (t) => (t ? dateTr(t, { day: 'numeric', month: 'short' }) + ' · ' + heureTr(t) : '');
// Un texte qui peut manquer (une raison d'eBay inconnue) : sa clé, sinon le repli.
const trOu = (k, v, repli) => { const r = tr(k, v); return r === k ? repli : r; };
const choix = (liste, fmt) => liste.map((v) => ({ cle: String(v), libelle: fmt(v), attrs: { 'data-eauto-choix': String(v) } }));

// La phrase d'une ligne du journal (ce qui a été fait en son nom).
function phraseJournal(e) {
  const num = e.num ? tr('eauto.j.num', { num: e.num }) : '';
  const k = 'eauto.j.' + (e.moteur || 'autre') + '.' + (e.etat || 'fait');
  const v = { num, avant: eur(e.avantC), apres: eur(e.apresC), pct: String(e.pct || ''), palier: String(e.palier || ''), raison: e.raison ? trOu('eauto.raison.' + e.raison, {}, String(e.raison).slice(0, 80)) : '' };
  return trOu(k, v, tr('eauto.j.autre', v));
}

export default function AutomatismesEbay({ compte = 'principal', headers, confirm, load, save, onBrouillons }) {
  const corpsCompte = compte && compte !== 'principal' ? { compte } : {};
  const [etat, setEtat] = useState(undefined);       // undefined en cours · { ko } pas su · la lecture
  const [reglages, setReglages] = useState(null);
  const [message, setMessage] = useState('');
  const [maj, setMaj] = useState(() => majorationDe(load ? load(MAJORATION_CLE, null) : null, compte));
  const [coches, setCoches] = useState(() => new Set());
  const [op, setOp] = useState('10');
  const [prixNeuf, setPrixNeuf] = useState('');
  const [recap, setRecap] = useState(null);
  const [resultat, setResultat] = useState(null);

  const lire = useCallback(async () => {
    let r;
    try { r = await appelerEbay('autolire', { ...corpsCompte, annonces: true }, headers); }
    catch (e) { r = { ok: false, ko: { raison: e.reason || 'pas-su', erreur: e.message } }; }
    setEtat(r);
    if (r && r.ok) {
      setReglages(reglagesCompte(r.reglages));
      // « Un automatisme est allumé » (sur tous ses appareils) : alors seulement l'app publie le plancher (src/App.jsx).
      if (save && load && load('vrm_ebay_auto_actif', false) !== unAllume(r.reglages)) save('vrm_ebay_auto_actif', unAllume(r.reglages));
    }
  }, [compte, headers]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setEtat(undefined); setCoches(new Set()); lire(); }, [lire]);

  // SON geste sur un réglage : allumer DEMANDE (la route l'exige aussi) ; éteindre ou changer un palier ne demande rien.
  const regler = async (moteur, champs) => {
    const avant = reglages || reglagesCompte(null);
    const apres = avecReglages(avant, { [moteur]: champs });
    const allume = !avant[moteur].actif && apres[moteur].actif;
    if (allume && confirm) {
      const ok = await confirm({ title: tr('eauto.conf.titre.' + moteur), desc: tr('eauto.conf.desc.' + moteur, { pct: String(apres[moteur].pct || ''), jours: String(apres[moteur].jours || ''), heures: String(apres[moteur].heures || ''), parJour: String(apres[moteur].parJour || '') }), ok: tr('eauto.conf.ok') });
      if (!ok) return;
    }
    setReglages(apres);
    try {
      const r = await appelerEbay('autoregler', { ...corpsCompte, reglages: { [moteur]: champs }, confirme: allume ? true : undefined }, headers, { write: true });
      setReglages(reglagesCompte(r.reglages));
      if (save) { save('vrm_ebay_auto_actif', unAllume(r.reglages)); if (unAllume(r.reglages)) { try { window.dispatchEvent(new Event('vrm:planchers-ebay')); } catch (_) {} } }
      setMessage('');
    } catch (e) { setReglages(avant); setMessage(e.message || tr('eauto.erreur')); }
  };
  const poserMajoration = (v) => {
    const k = Number(v); setMaj(k);
    if (save && load) save(MAJORATION_CLE, avecMajoration(load(MAJORATION_CLE, null), compte, k));
  };

  if (etat === undefined) return <div className="eauto" data-eauto="lecture"><Groupe titre={tr('eauto.titre')}><Rangee titre={tr('eauto.lecture')}/></Groupe></div>;
  if (!etat || !etat.ok) return (
    <div className="eauto" data-eauto="panne">
      <Groupe titre={tr('eauto.titre')} pied={tr('eauto.panne.pied')}>
        <Rangee titre={tr('eauto.panne')} sousTitre={(etat && (etat.error || (etat.ko && etat.ko.erreur))) || ''} sousLignes={2}/>
      </Groupe>
      <Bouton variante="teinte" onClick={() => { setEtat(undefined); return lire(); }} attrs={{ 'data-eauto-reessayer': '' }}>{tr('eauto.reessayer')}</Bouton>
    </div>
  );
  const R = reglages || reglagesCompte(null);
  const pl = etat.planchers || {};
  const plOk = pl.etat === 'ok';
  const annonces = Array.isArray(etat.annonces) ? etat.annonces : null;
  const parId = new Map((annonces || []).map((a) => [a.itemId, a]));
  const resume = {
    baisse: tr('eauto.baisse.resume', { pct: String(R.baisse.pct), jours: String(R.baisse.jours) }),
    offres: tr('eauto.offres.resume', { pct: String(R.offres.pct), heures: String(R.offres.heures), periode: String(R.offres.periode) }),
    paliers: tr('eauto.paliers.resume.' + R.paliers.preset),
    relance: tr(R.relance.gratuitSeul ? 'eauto.relance.resumeGratuit' : 'eauto.relance.resume', { n: String(R.relance.parJour) }),
  };
  const moteur = (m, enfants) => (
    <Groupe titre={tr('eauto.' + m + '.titre')} pied={tr('eauto.' + m + '.pied')} attrs={{ 'data-eauto-groupe': m }}>
      <Rangee titre={tr('eauto.' + m + '.lib')} sousTitre={R[m].actif ? resume[m] : tr('eauto.eteint')} sousLignes={2}
        interrupteur={{ actif: R[m].actif, onChange: (v) => regler(m, { actif: !!v }), libelle: tr('eauto.' + m + '.lib') }}
        attrs={{ 'data-eauto-moteur': m, 'data-eauto-actif': R[m].actif ? '1' : '0' }}/>
      <div className="eauto-choix" data-eauto-reglages={m}>{enfants}</div>
    </Groupe>
  );
  const seg = (m, champ, liste, fmt) => <Segmente libelle={tr('eauto.' + m + '.' + champ)} valeur={String(R[m][champ])} onChange={(v) => regler(m, { [champ]: champ === 'preset' ? v : Number(v) })} options={choix(liste, fmt)}/>;

  // ── LA MODIFICATION EN MASSE ─────────────────────────────────────────────
  const opMasse = op === 'prix' ? 'prix' : op === 'fin' ? 'fin' : 'pct';
  const cochees = [...coches].map((id) => parId.get(id)).filter(Boolean);
  const revoir = () => {
    const lignes = cochees.map((a) => {
      const lm = ligneMasse({ op: opMasse, prixC: a.prixC, valeur: opMasse === 'pct' ? Number(op) : prixNeuf, plancher: a.plancherC != null ? { c: a.plancherC } : null });
      return { a, ...lm };
    });
    setResultat(null); setRecap({ op: opMasse, pct: opMasse === 'pct' ? Number(op) : null, prix: prixNeuf, lignes });
  };
  const appliquer = async () => {
    const ok = recap.lignes.filter((l) => l.ok);
    if (!ok.length) return '';
    const r = await appelerEbay('masse', { ...corpsCompte, op: recap.op, pct: recap.pct, prix: recap.prix, confirme: true, lignes: ok.map((l) => ({ itemId: l.a.itemId, prixVu: (l.a.prixC / 100).toFixed(2) })) }, headers, { write: true, timeoutMs: 55000 });
    setResultat(r); setCoches(new Set());
    await lire();
    return tr('eauto.masse.fait', { n: String(r.faites || 0), total: String(ok.length) });
  };
  const similaire = async (a) => {
    try {
      await appelerEbay('similaire', { ...corpsCompte, itemId: a.itemId }, headers, { write: true });
      setMessage(tr('eauto.similaire.fait', { titre: a.titre }));
      await lire();
    } catch (e) { setMessage(e.message || tr('eauto.erreur')); }
  };

  return (
    <div className="eauto" data-eauto="pret" data-eauto-compte={compte}>
      {message ? <p className="eauto-message" role="status" data-eauto-message="">{message}</p> : null}
      {/* Le plancher : la règle qui ne se franchit jamais, et sa fraîcheur. */}
      <Groupe titre={tr('eauto.plancher.titre')} pied={tr('eauto.plancher.pied')} attrs={{ 'data-eauto-groupe': 'plancher' }}>
        <Rangee titre={tr(plOk ? 'eauto.plancher.ok' : 'eauto.plancher.' + (pl.etat === 'absent' ? 'absent' : pl.etat === 'perime' ? 'perime' : 'passu'), { n: nombre(pl.n || 0) })}
          sousTitre={pl.at ? tr('eauto.plancher.at', { quand: quand(pl.at) }) : ''} ton={plOk ? 'neutre' : 'ambre'} attrs={{ 'data-eauto-plancher': pl.etat || 'passu' }}
          onClick={plOk ? null : () => { try { window.dispatchEvent(new Event('vrm:planchers-ebay')); } catch (_) {} setTimeout(lire, 4000); }} fin={plOk ? null : 'chevron'}/>
      </Groupe>

      {moteur('baisse', <>{seg('baisse', 'pct', BAISSE_PCT, (v) => '−' + v + ' %')}{seg('baisse', 'jours', BAISSE_JOURS, (v) => tr('eauto.jours', { n: String(v) }))}</>)}
      {moteur('offres', <>{seg('offres', 'pct', OFFRE_PCT, (v) => '−' + v + ' %')}{seg('offres', 'heures', OFFRE_HEURES, (v) => tr('eauto.heures', { n: String(v) }))}{seg('offres', 'periode', OFFRE_PERIODE_JOURS, (v) => tr('eauto.periode', { n: String(v) }))}</>)}
      {moteur('paliers', seg('paliers', 'preset', Object.keys(PALIERS_PRESETS), (v) => tr('eauto.paliers.' + v)))}
      {moteur('relance', <>{seg('relance', 'parJour', RELANCE_PAR_JOUR, (v) => tr('eauto.parJour', { n: String(v) }))}
        <Segmente libelle={tr('eauto.relance.frais')} valeur={R.relance.gratuitSeul ? 'gratuit' : 'tout'} onChange={(v) => regler('relance', { gratuitSeul: v === 'gratuit' })}
          options={[{ cle: 'gratuit', libelle: tr('eauto.relance.gratuit'), attrs: { 'data-eauto-choix': 'gratuit' } }, { cle: 'tout', libelle: tr('eauto.relance.tout'), attrs: { 'data-eauto-choix': 'tout' } }]}/></>)}

      <Groupe titre={tr('eauto.maj.titre')} pied={tr('eauto.maj.pied')} attrs={{ 'data-eauto-groupe': 'majoration' }}>
        <div className="eauto-choix" data-eauto-reglages="majoration">
          <Segmente libelle={tr('eauto.maj.titre')} valeur={String(maj)} onChange={poserMajoration} options={choix(MAJORATION_PCT, (v) => (v ? '+' + v + ' %' : tr('eauto.maj.aucune')))}/>
        </div>
      </Groupe>

      {/* La modification en masse et « Vendre un similaire » : ses annonces en ligne, chacune avec son N° et son plancher. */}
      <Groupe titre={tr('eauto.masse.titre')} pied={annonces ? tr('eauto.masse.pied', { max: String(MASSE_MAX) }) : tr('eauto.masse.pasLu')} attrs={{ 'data-eauto-groupe': 'masse' }}>
        {annonces && !annonces.length ? <Rangee titre={tr('eauto.masse.aucune')}/> : null}
        {(annonces || []).map((a) => (
          <Rangee key={a.itemId} titre={a.titre || a.itemId} lignes={2} vignette={<Vignette src={a.photo} alt="" taille={44}/>} plaque={a.num ? <Plaque numero={a.num}/> : null}
            sousTitre={a.num ? (a.plancherC != null ? tr('eauto.masse.plancher', { p: eur(a.plancherC, a.devise) }) : tr('eauto.masse.sansPlancher')) : tr('eauto.masse.sansSku')}
            valeur={eur(a.prixC, a.devise)} detailValeur={a.observateurs ? tr('eauto.masse.obs', { n: nombre(a.observateurs) }) : ''}
            selection={{ cochee: coches.has(a.itemId), libelle: tr('eauto.masse.cocher', { titre: a.titre || a.itemId }), indisponible: !coches.has(a.itemId) && coches.size >= MASSE_MAX,
              onChange: (v) => setCoches((s) => { const n = new Set(s); if (v) n.add(a.itemId); else n.delete(a.itemId); return n; }) }}
            actions={[{ cle: 'similaire', libelle: tr('eauto.similaire'), ton: 'neutre', onClick: () => similaire(a) }]}
            href={a.url || ''} attrs={{ 'data-eauto-annonce': a.itemId, 'data-eauto-num': a.num || '', 'data-eauto-plancher-c': a.plancherC != null ? String(a.plancherC) : '' }}/>
        ))}
      </Groupe>
      {annonces && annonces.length ? (
        <div className="eauto-masse" data-eauto-masse="">
          <Segmente libelle={tr('eauto.masse.op')} valeur={op} onChange={setOp}
            options={[...MASSE_PCT.map((v) => ({ cle: String(v), libelle: '−' + v + ' %', attrs: { 'data-eauto-op': String(v) } })), { cle: 'prix', libelle: tr('eauto.masse.prix'), attrs: { 'data-eauto-op': 'prix' } }, { cle: 'fin', libelle: tr('eauto.masse.fin'), attrs: { 'data-eauto-op': 'fin' } }]}/>
          {op === 'prix' ? <label className="eauto-champ"><span>{tr('eauto.masse.nouveauPrix')}</span><input value={prixNeuf} onChange={(e) => setPrixNeuf(e.target.value)} inputMode="decimal" placeholder="49" data-eauto-prix=""/></label> : null}
          <Bouton variante="teinte" large indisponible={!cochees.length || (op === 'prix' && !prixNeuf.trim())} raison={!cochees.length ? tr('eauto.masse.rien') : ''} onClick={revoir} attrs={{ 'data-eauto-revoir': String(cochees.length) }}>
            {tr('eauto.masse.revoir', { n: String(cochees.length) })}
          </Bouton>
        </div>
      ) : null}

      <Groupe titre={tr('eauto.journal.titre')} pied={etat.dernier && etat.dernier.at ? tr('eauto.journal.dernier', { quand: quand(etat.dernier.at), n: String(etat.dernier.gestes || 0) }) : tr('eauto.journal.jamais')} attrs={{ 'data-eauto-groupe': 'journal' }}>
        {(etat.journal || []).filter((e) => e.moteur !== 'reglage').slice(0, 30).map((e, i) => (
          <Rangee key={i} titre={phraseJournal(e)} sousLignes={2} sousTitre={quand(e.at)} ton={e.etat === 'incertain' ? 'ambre' : 'neutre'} attrs={{ 'data-eauto-journal': e.moteur, 'data-eauto-etat': e.etat }}/>
        ))}
        {!(etat.journal || []).some((e) => e.moteur !== 'reglage') ? <Rangee titre={tr('eauto.journal.vide')}/> : null}
      </Groupe>
      <Bouton variante="texte" indisponible={!unAllume(R)} raison={!unAllume(R) ? tr('eauto.lancer.rien') : ''} attrs={{ 'data-eauto-lancer': '' }}
        onClick={async () => { const r = await appelerEbay('autolancer', corpsCompte, headers, { write: true, timeoutMs: 55000 }); await lire(); return tr('eauto.lancer.fait', { n: String((r.bilan && r.bilan.gestes) || 0) }); }}>{tr('eauto.lancer')}</Bouton>
      {onBrouillons ? <Bouton variante="texte" onClick={onBrouillons} attrs={{ 'data-eauto-brouillons': '' }}>{tr('eauto.brouillons')}</Bouton> : null}

      {recap ? (
        <Feuille onFermer={() => setRecap(null)} titre={tr('eauto.recap.titre.' + recap.op, { n: String(recap.lignes.length), pct: String(recap.pct || '') })} attrs={{ 'data-eauto-recap': recap.op }}>
          <Groupe pied={tr('eauto.recap.pied.' + recap.op)}>
            {recap.lignes.map((l) => (
              <Rangee key={l.a.itemId} titre={l.a.titre || l.a.itemId} plaque={l.a.num ? <Plaque numero={l.a.num}/> : null}
                sousTitre={l.ok ? (recap.op === 'fin' ? tr('eauto.recap.fin') : tr('eauto.recap.ligne', { avant: eur(l.a.prixC, l.a.devise), apres: eur(l.apresC, l.a.devise) })) : trOu('eauto.raison.' + l.raison, { p: eur(l.plancherC, l.a.devise) }, l.raison)}
                ton={l.ok ? 'neutre' : 'ambre'} attrs={{ 'data-eauto-ligne': l.a.itemId, 'data-eauto-ligne-ok': l.ok ? '1' : '0', 'data-eauto-apres-c': l.apresC != null ? String(l.apresC) : '' }}/>
            ))}
          </Groupe>
          {resultat ? <p className="eauto-message" role="status" data-eauto-resultat={String(resultat.faites || 0)}>{tr('eauto.masse.fait', { n: String(resultat.faites || 0), total: String((resultat.lignes || []).length) })}</p> : null}
          <Bouton variante={recap.op === 'fin' ? 'destructif' : 'plein'} confirmation={recap.op === 'fin' ? tr('eauto.recap.finConfirmer', { n: String(recap.lignes.filter((l) => l.ok).length) }) : ''}
            indisponible={!recap.lignes.some((l) => l.ok) || !!resultat} raison={!recap.lignes.some((l) => l.ok) ? tr('eauto.recap.aucune') : ''} onClick={appliquer} attrs={{ 'data-eauto-appliquer': String(recap.lignes.filter((l) => l.ok).length) }}>
            {tr('eauto.recap.appliquer.' + recap.op, { n: String(recap.lignes.filter((l) => l.ok).length) })}
          </Bouton>
        </Feuille>
      ) : null}
    </div>
  );
}

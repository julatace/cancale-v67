// ── LE LIVRE DE POLICE (10 nov., lot R) — Argent → Déclarer ────────────────
// La règle et les sources officielles : src/livrePolice.js. Ici, seulement
// l'écran : un bloc isolé (sa lecture, son état), proposé à un statut PRO
// choisi (`livrePolicePropose`), lu seulement quand il l'ouvre.
//   · les achats = ceux du « Registre des achats » (`registreDe`, la MÊME
//     écriture que la carte Registres et l'export comptable, passée par Compta) ;
//   · « Inscrire » donne les n° d'ordre à la suite, sur SON clic, jamais changés ;
//   · le pseudo d'un vendeur Vinted = SA transaction lue côté acheteur, projetée
//     (jamais `select=data`) ; pas lu ⇒ « à compléter » et « Pas lu » nommé ;
//   · PDF et tableur faits dans le navigateur ; jamais le mot « conforme ».
import React from 'react';
import { Bouton, C, Card, Pourquoi, AUTH, CLOISONNE, SUPABASE_URL, askConfirm, fetchEmailAchats, lireReglage, lireTout, recusAchatDe, sbAuth, telechargerFichier, toast, useProfilFiscal, withOwner } from './App.jsx';
import { moisDePeriode } from './registres.js';
import { livrePolicePropose, livreDePolice, aCompleter, aInscrire, idsTransactions, pseudoVendeurTx, lireLivrePolice, inscrireEnBase, csvLivre, pdfLivre, nomFichierLivre, libellePeriodePolice } from './livrePolice.js';

const ymDe = (t) => { const d = new Date(t); return isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const periodesPolice = (maintenant = Date.now()) => {
  const d = new Date(maintenant); const an = d.getFullYear();
  const mois = []; const m = new Date(an, d.getMonth(), 1);
  for (let i = 0; i < 13; i++) { mois.push(ymDe(m)); m.setMonth(m.getMonth() - 1); }
  const trim = []; for (let t = Math.floor(d.getMonth() / 3) + 1; t >= 1; t--) trim.push(`${an}-T${t}`);
  return [String(an), ...trim, String(an - 1), ...mois];
};
const deps = () => ({ url: SUPABASE_URL, entetes: () => sbAuth(), avecOwner: (r) => withOwner(r), owner: (AUTH.user && AUTH.user.id) || '', cloisonne: !!CLOISONNE });

// Les pseudos des vendeurs Vinted des lignes d'une période : Map tx → pseudo ; null = pas lu.
async function lirePseudos(lignes, uidDeTx) {
  const ids = idsTransactions(lignes, uidDeTx);
  const out = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const lot = ids.slice(i, i + 100);
    const rows = await lireTout(`id=in.(${lot.join(',')})&select=id,tx:data->payload->transaction->>id,side:data->payload->transaction->>user_side,vendeur:data->payload->transaction->seller->>login`, { strict: true }).catch(() => null);
    if (!Array.isArray(rows)) return null;
    for (const r of rows) {
      if (!r || !lot.includes(r.id)) continue;
      const tx = String(r.tx || String(r.id).split('_txn_')[1] || '');
      const p = pseudoVendeurTx(r);
      if (tx && p) out.set(tx, p);
    }
  }
  return out;
}

export default function LivrePoliceCarte({ lireAchats, registreDe, panelOff }) {
  const profil = useProfilFiscal();
  const [ouvert, setOuvert] = React.useState(false);
  const periodes = React.useMemo(() => periodesPolice(), []);
  const [periode, setPeriode] = React.useState(periodes[0]);
  // undefined en cours · null pas su · valeur lue
  const [achats, setAchats] = React.useState(undefined);
  const [recus, setRecus] = React.useState(undefined);
  const [etat, setEtat] = React.useState(undefined);      // { existe, etat } | null
  const [pseudos, setPseudos] = React.useState(undefined);
  const [enCours, setEnCours] = React.useState('');
  React.useEffect(() => {
    if (!ouvert) return undefined;
    let mort = false;
    Promise.resolve().then(() => lireAchats()).then((a) => { if (!mort) setAchats(Array.isArray(a) ? a : null); }).catch(() => { if (!mort) setAchats(null); });
    fetchEmailAchats().then((r) => { if (!mort) setRecus(recusAchatDe(r)); }).catch(() => { if (!mort) setRecus(null); });
    lireLivrePolice(deps()).then((e) => { if (!mort) setEtat(e); });
    return () => { mort = true; };
  }, [ouvert, lireAchats]);
  const pret = achats !== undefined && recus !== undefined;
  const registre = React.useMemo(() => (pret && achats !== null ? registreDe({ achats, recus, periode, panelOff }) : (pret ? null : undefined)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pret, achats, recus, periode, panelOff]);
  // Toutes les années où il a acheté : l'inscription suit TOUS les achats, pas une période.
  const tous = React.useMemo(() => {
    if (!pret || achats === null) return null;
    const ans = new Set([String(new Date().getFullYear())]);
    for (const o of achats) { const y = ymDe(Date.parse((o && o.date) || '')).slice(0, 4); if (y) ans.add(y); }
    const out = [];
    for (const y of [...ans].sort()) { const R = registreDe({ achats, recus, periode: y, panelOff }); if (R) out.push(...R.lignes); }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret, achats, recus, panelOff]);
  const uidDeTx = React.useMemo(() => { const m = new Map(); for (const o of (achats || [])) if (o && o.transaction_id != null && o._uid) m.set(String(o.transaction_id), String(o._uid)); return (tx) => m.get(tx) || ''; }, [achats]);
  React.useEffect(() => {
    if (!registre) { setPseudos(registre === null ? null : undefined); return undefined; }
    let mort = false; setPseudos(undefined);
    lirePseudos(registre.lignes, uidDeTx).then((p) => { if (!mort) setPseudos(p); });
    return () => { mort = true; };
  }, [registre, uidDeTx]);
  if (!livrePolicePropose(profil)) return null;

  const etatLivre = etat && etat.etat ? etat.etat : null;
  const L = registre && pseudos !== undefined && etat !== undefined
    ? livreDePolice({ registre, etat: etatLivre, pseudos, dansPeriode: (ts) => moisDePeriode(periode).includes(ymDe(ts)) })
    : null;
  const nouveaux = tous && etatLivre ? aInscrire(tous, etatLivre) : [];
  const lu = L ? 'lu' : (registre === null || etat === null) ? 'passu' : 'encours';
  const ac = aCompleter(L);
  const inscrireTout = async () => {
    if (!nouveaux.length || enCours) return;
    const ok = await askConfirm({ title: `Inscrire ${nouveaux.length} achat${nouveaux.length > 1 ? 's' : ''} ?`, desc: `Ils reçoivent les n° ${etatLivre.dernier + 1} à ${etatLivre.dernier + nouveaux.length}. Ces numéros ne changeront plus.`, ok: 'Inscrire', cancel: 'Annuler' });
    if (!ok) return;
    setEnCours('inscrire');
    const r = await inscrireEnBase(tous, deps());
    if (r.ok) { setEtat({ existe: true, etat: r.etat }); toast(`${r.nouveaux} achat${r.nouveaux > 1 ? 's' : ''} inscrit${r.nouveaux > 1 ? 's' : ''}`); }
    else toast(r.raison === 'abime' ? 'Livre illisible : rien n’a été inscrit' : 'Pas inscrit : la base n’a pas répondu. Réessaie.');
    setEnCours('');
  };
  const exporter = async (forme) => {
    if (!L || enCours) return;
    setEnCours(forme);
    try {
      let ent = null; try { ent = await lireReglage('vrm_pro_facture'); } catch (_) { ent = null; }
      const entreprise = ent && String(ent.nom || '').trim() ? { nom: String(ent.nom).trim(), siret: String(ent.siret || '').trim() } : null;
      if (forme === 'csv') telechargerFichier(new Blob([csvLivre(L, { entreprise })], { type: 'text/csv;charset=utf-8' }), nomFichierLivre(L, 'csv'), 'text/csv;charset=utf-8');
      else telechargerFichier(new Blob([await pdfLivre(L, { entreprise })], { type: 'application/pdf' }), nomFichierLivre(L, 'pdf'), 'application/pdf');
    } catch (err) { toast('Livre pas créé : ' + ((err && err.message) || err)); }
    setEnCours('');
  };
  const inscrits = etatLivre ? Object.keys(etatLivre.ordre).length : null;
  const sel = { height: 44, borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 15, padding: '0 10px', fontFamily: 'inherit', minWidth: 0, maxWidth: '100%' };
  return (
    <Card><div className="vrm-livre-police" data-livre-police={ouvert ? lu : 'ferme'} data-livre-n={L ? L.n : ''} data-livre-inscrits={inscrits == null ? '' : inscrits}
      data-livre-dernier={etatLivre ? etatLivre.dernier : ''} data-livre-a-inscrire={tous && etatLivre ? nouveaux.length : ''}
      data-livre-identite={L ? L.manque.identite : ''} data-livre-vendeur-manque={L ? L.manque.vendeur : ''} data-livre-pas-lu={L ? L.pasLu.join(',') : ''}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ flex: '1 1 160px', minWidth: 0 }}>
          <span data-titre-section="" style={{ display: 'block', fontSize: 15, fontWeight: 600, color: C.text, letterSpacing: -0.15 }}>Livre de police</span>
          <span style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 2 }}>Tes achats pour revendre, numérotés</span>
        </span>
        {!ouvert ? <Bouton variante="secondaire" icone="doc" data-livre-ouvrir="" onClick={() => setOuvert(true)}>Ouvrir</Bouton> : null}
      </div>
      {ouvert ? <>
        <div className="vrm-display" data-livre-resume="" style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 12, fontVariantNumeric: 'tabular-nums' }}>
          <b style={{ fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: -0.6 }}>{etat === undefined ? '…' : inscrits == null ? '—' : inscrits}</b>
          <span style={{ fontSize: 13, color: C.muted }}>{etat === null ? 'livre pas lu' : etat && !etat.etat ? 'livre illisible' : `inscrit${inscrits > 1 ? 's' : ''}${etatLivre && etatLivre.dernier ? ` · dernier n° ${etatLivre.dernier}` : ''}`}</span>
        </div>
        {nouveaux.length ? <div style={{ marginTop: 10 }}>
          <Bouton variante="danger" icone="pencil" data-livre-inscrire={nouveaux.length} occupe={enCours === 'inscrire'} disabled={!!enCours} onClick={inscrireTout}>{`Inscrire ${nouveaux.length} achat${nouveaux.length > 1 ? 's' : ''}`}</Bouton>
        </div> : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <select aria-label="Période du livre de police" data-livre-periode="" value={periode} onChange={(e) => setPeriode(e.target.value)} style={{ ...sel, flex: '1 1 150px' }}>
            {periodes.map((p) => <option key={p} value={p}>{libellePeriodePolice(p)}</option>)}
          </select>
          <span style={{ display: 'flex', gap: 8, flex: '0 0 auto' }}>
            <Bouton variante="secondaire" icone="doc" data-livre-pdf="" aria-label="Télécharger le livre de police en PDF" disabled={!L || !!enCours} onClick={() => exporter('pdf')}>{enCours === 'pdf' ? '…' : 'PDF'}</Bouton>
            <Bouton variante="secondaire" icone="save" data-livre-csv="" aria-label="Télécharger le livre de police en tableur" disabled={!L || !!enCours} onClick={() => exporter('csv')}>{enCours === 'csv' ? '…' : 'Tableur'}</Bouton>
          </span>
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 8, fontVariantNumeric: 'tabular-nums' }} data-livre-periode-n="">
          {lu === 'encours' ? 'Je lis tes achats…' : lu === 'passu' ? '— achats pas lus' : `${L.n} achat${L.n > 1 ? 's' : ''} sur la période`}
          {L && L.pasLu.length ? <span data-livre-pas-lu-txt=""> · pas lu : {L.pasLu.join(', ')}</span> : null}
        </div>
        {/* (11 nov., décision C7 — Julien : « tranche ») L'identité civile des vendeurs (données de
            tiers) n'est JAMAIS saisie ni rangée dans VRM : elle se remplit sur l'export (colonne
            « Identité du vendeur »). Dit en une phrase, à côté des boutons d'export. */}
        <div data-livre-identite-export="" style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>L’identité des vendeurs se remplit sur l’export, pas dans VRM.</div>
        {ac.length ? <div data-livre-a-completer="" style={{ marginTop: 10 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>À compléter</span>
          {ac.map(([k, n]) => <div key={k} data-livre-manque={k} style={{ display: 'flex', gap: 8, justifyContent: 'space-between', fontSize: 13, color: C.text, padding: '4px 0' }}><span style={{ minWidth: 0 }}>{k}</span><b className="vrm-display" style={{ color: C.warn, fontVariantNumeric: 'tabular-nums' }}>{n}</b></div>)}
        </div> : null}
        <div style={{ marginTop: 10 }}>
          <Pourquoi label="Pourquoi ?">
            Un revendeur professionnel d’objets d’occasion tient ce registre (code pénal, art. 321-7 et R321-1 et suivants) et se déclare en préfecture (cerfa 11733).
            Chaque achat reçoit un n° d’ordre qui ne change jamais. Aucune plateforme ne donne l’identité civile des vendeurs.
            Sources : <a href="https://entreprendre.service-public.gouv.fr/vosdroits/F39552" target="_blank" rel="noopener noreferrer">service-public.gouv.fr</a> · <a href="https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006070719/LEGISCTA000006117615/" target="_blank" rel="noopener noreferrer">Légifrance</a>.
          </Pourquoi>
        </div>
      </> : null}
    </div></Card>
  );
}

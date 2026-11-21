// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { useState, useEffect } from 'react';
import { Bouton, C, Icon, PhotoVinted, ScreenHead, VENTES_MASQUEES_AUCUNE, _acctCache, _persistAcctCache, achatsMasques, dateFr, ecrireAchatsMasques, fetchHarvestOrders, onCloudReady, orderPhoto, save, toast } from '../App.jsx';


// ⟦← App.jsx #1⟧
// ⟦→ ecrans/Reglages.jsx #46⟧

// ── ONGLET « MASQUÉS » — VENTES MASQUÉES · ACHATS MASQUÉS ────────────────────
// 30 sept. : d'abord rangé dans Réglages, puis Julien : « fais un onglet dédié,
// pas en vrac dans les paramètres », et « si je réaffiche, je veux que les
// photos apparaissent ». Tout ce qui est écarté de la compta, au même endroit,
// avec ce que c'était (PHOTO, titre, date, montant, compte) et un bouton pour
// le réafficher. Lit les mêmes moissons que les écrans Ventes / Achats
// (`fetchHarvestOrders`) ; l'identité est le n° de transaction (§5).
// « Pas su » ≠ « rien » : tant que la lecture n'est pas revenue, on le dit.
function EcranMasques({ comptes, ordi }) {
  const [onglet, setOnglet] = useState('achats');   // (29 oct.) une vente ne se masque plus
  const [vMasq, setVMasq] = useState(() => VENTES_MASQUEES_AUCUNE().map(String));
  const [aMasq, setAMasq] = useState(() => [...achatsMasques()]);
  const [det, setDet] = useState(undefined); // undefined = en cours · null = pas su · {tx: commande}
  useEffect(() => onCloudReady(() => {
    setVMasq((cur) => cur.length ? cur : VENTES_MASQUEES_AUCUNE().map(String));
    setAMasq((cur) => cur.length ? cur : [...achatsMasques()]);
  }), []);
  useEffect(() => { let stop = false; (async () => {
    try {
      const m = {}; let lu = false;
      await Promise.all((comptes || []).map(async (a) => {
        for (const cote of ['sold', 'purchased']) {
          const p = await fetchHarvestOrders(a.vinted_user_id, cote);
          if (p) lu = true;
          for (const o of ((p && p.my_orders) || [])) m[String(o.transaction_id)] = { ...o, _login: a.login || '', _cote: cote };
        }
      }));
      if (!stop) setDet(lu || !(comptes || []).length ? m : null);
    } catch (_) { if (!stop) setDet(null); }
  })(); return () => { stop = true; }; }, [comptes]);
  const reafficher = (tx) => {
    if (onglet === 'ventes') { const n = vMasq.filter(x => x !== tx); setVMasq(n); save('vinted_sales_hidden', n); }
    else { const n = aMasq.filter(x => x !== tx); setAMasq(n); ecrireAchatsMasques(n); if (_acctCache['purchased']) { delete _acctCache['purchased']; _persistAcctCache(); } }
    toast('Réaffiché — il compte de nouveau dans la compta.');
  };
  const liste = onglet === 'ventes' ? vMasq : aMasq;
  const eur = (o) => { const v = o && (o.price && o.price.amount != null ? Number(o.price.amount) : null); return v != null && isFinite(v) ? v.toFixed(2).replace('.', ',') + '\u00a0€' : ''; };
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ScreenHead icon="eyeOff" title="Masqués" desc="Les achats que tu as retirés de la compta — réaffiche-les d'un clic."/>
      {/* (30 oct.) Une pastille seule (« Achats masqués ») ne filtrait rien : un
          seul onglet n'est pas un choix. Le nombre reste dit, en clair. */}
      <div data-masques-n={aMasq.length} style={{ fontSize: 13, color: C.muted }}>{aMasq.length} achat{aMasq.length > 1 ? 's' : ''} masqué{aMasq.length > 1 ? 's' : ''}</div>
      {!liste.length ? (
        <div style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 12, padding: '18px 16px', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          {onglet === 'ventes' ? "Aucune vente masquée. Le ✕ d'une vente, sur l'écran Ventes, la range ici." : "Aucun achat masqué. L'icône « œil barré » d'un achat, sur l'écran Achats, le range ici."}
        </div>
      ) : (
        <>
          {det === null && <div style={{ fontSize: 12, color: C.muted }}>Détail pas relu : la liste est juste, seuls photos, titres et montants manquent.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: ordi ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)', gap: 10 }}>
            {liste.map((tx) => { const o = det && det[tx]; const ph = o ? orderPhoto(o) : null;
              return (
                <div key={tx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, border: `1px solid ${C.border}`, background: C.card, borderRadius: 12 }}>
                  <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 12, overflow: 'hidden', background: C.card2 || C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>
                    {ph ? <PhotoVinted src={ph} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      : <Icon name={det === undefined ? 'sync' : 'box'} size={20}/>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o ? o.title : (det === undefined ? 'Lecture…' : `Transaction ${tx}`)}</div>
                    {o && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{[o.date ? dateFr(o.date) : '', o._login, eur(o)].filter(Boolean).join(' · ')}</div>}
                  </div>
                  <Bouton variante="secondaire" className="vrm-b-petit" onClick={() => reafficher(tx)} style={{ flexShrink: 0 }}>Réafficher</Bouton>
                </div>
              ); })}
          </div>
        </>
      )}
    </div>
  );
}
export { EcranMasques };

// ── LA CARTE DE REMERCIEMENT (14 nov., lot 130) ────────────────────────────────
// Paramètres → « Carte de remerciement » : sa signature, sa boutique, son message,
// un aperçu, puis « Imprimer 4 cartes » (A4 à découper) ou « Une carte (A6) ».
// La règle et le PDF : src/carteMerci.js. ⚠️ Rien de l'acheteur, jamais (§3).
// Le réglage vit sur CET appareil et dans le nuage par `lire`/`ecrire` de l'app
// (`vrm_carte_merci`, ses propres champs seulement).
import React from 'react';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { contenuCarteMerci, pdfCarteMerci, MERCI_MAX } from './carteMerci.js';
import './styles-confort.css';

export const CLE_CARTE_MERCI = 'vrm_carte_merci';

export function ReglageCarteMerci({ lire, ecrire, telecharger }) {
  useLangue();
  const [r, setR] = React.useState(() => { try { return lire() || {}; } catch (_) { return {}; } });
  const [occupe, setOccupe] = React.useState(false);
  const c = contenuCarteMerci(r, { messageDefaut: tr('confort.merci.messageDefaut') });
  const poser = (k, v) => { const n = { ...r, [k]: v }; setR(n); try { ecrire(n); } catch (_) {} };
  const imprimer = async (parPage) => {
    setOccupe(true);
    try {
      const octets = await pdfCarteMerci(c, { parPage, titre: tr('confort.merci.mot') });
      telecharger(new Blob([octets], { type: 'application/pdf' }), parPage === 1 ? 'carte-merci-a6.pdf' : 'cartes-merci-a4.pdf', 'application/pdf');
    } catch (_) {}
    setOccupe(false);
  };
  const champ = (k, lib, long = false) => (
    <label className="vrm-cf-champ">{lib}
      {long ? <textarea rows={3} maxLength={MERCI_MAX[k]} value={r[k] || ''} placeholder={k === 'message' ? tr('confort.merci.messageDefaut') : ''} onChange={(e) => poser(k, e.target.value)} data-merci-champ={k}/>
        : <input maxLength={MERCI_MAX[k]} value={r[k] || ''} onChange={(e) => poser(k, e.target.value)} data-merci-champ={k}/>}
    </label>
  );
  return (
    <div className="vrm-cf vrm-cf-pile" data-carte-merci="">
      <p className="vrm-cf-doux">{tr('confort.merci.explique')}</p>
      {champ('signature', tr('confort.merci.signature'))}
      {champ('boutique', tr('confort.merci.boutique'))}
      {champ('message', tr('confort.merci.message'), true)}
      {champ('lien', tr('confort.merci.lien'))}
      <div className="vrm-cf-carte" style={{ textAlign: 'center', padding: '28px 20px', aspectRatio: '148 / 105', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }} data-merci-apercu="">
        <b style={{ fontSize: 34, letterSpacing: '-.03em' }}>{tr('confort.merci.mot')}</b>
        <i style={{ fontSize: 15, lineHeight: 1.45 }}>{c.message}</i>
        {c.signature ? <b style={{ fontSize: 15 }}>{c.signature}</b> : null}
        {c.boutique ? <span className="vrm-cf-doux">{c.boutique}</span> : null}
        {c.lien ? <span className="vrm-cf-doux">{c.lien}</span> : null}
      </div>
      <div className="vrm-cf-rangee">
        <button type="button" className="vrm-cf-primaire" disabled={occupe} onClick={() => imprimer(4)} data-merci-imprimer="4">{tr('confort.merci.quatre')}</button>
        <button type="button" className="vrm-cf-second" disabled={occupe} onClick={() => imprimer(1)} data-merci-imprimer="1">{tr('confort.merci.une')}</button>
      </div>
    </div>
  );
}

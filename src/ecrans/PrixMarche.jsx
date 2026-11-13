// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { C, Card, LignePanne, ScreenHead } from '../App.jsx';
import Pourquoi from '../composants/PourquoiReplie.jsx';
import { tr } from '../i18n/index.js';


// ⟦← App.jsx #1⟧
function PrixMarche({ data, baseKO, sousNav = null }) {
  const eur2 = (n) => n.toFixed(n % 1 ? 2 : 0).replace('.', ',');
  const groups = data && data.groups;
  const valo = data && data.valo;
  const eti = { fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 };
  return (
    <div data-prix-marche="" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHead icon="euro" title={tr('nav.compta')} sous={sousNav ? <div className="vrm-stats-sous-nav" data-stats-sous-nav="">{sousNav}</div> : null}
        desc="Ce que tes ventes disent du prix — par modèle et taille, pour tarifer et racheter juste." />
      {baseKO ? (
        <LignePanne>{tr('stats.ventesLuesPrix')}</LignePanne>
      ) : groups == null ? (
        <div style={{ fontSize: 13, color: C.muted }}>{tr('stats.lectureVentes')}</div>
      ) : (<>
        {valo && valo.reconnu > 0 && (
          <Card style={{ padding: 18 }}>
            <div style={{ ...eti, marginBottom: 4 }}>{tr('stats.valeurStockLigne')}</div>
            <div className="vrm-display" style={{ fontSize: 28, fontWeight: 700, color: C.text }}>≈ {eur2(valo.marche)}&nbsp;€</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
              {tr('ventes.texte3')} <b>{valo.reconnu}</b> {tr('annonces.annonce')}{valo.reconnu > 1 ? 's' : ''} {tr('stats.ligneDontConnait')}{valo.total > valo.reconnu ? <> {tr('stats.texte7')} {valo.total} {tr('stats.autresOntEncore')}</> : null}.
              {valo.affiche > 0 && (() => { const ec = Math.round((valo.affiche / (valo.marcheAffiche || valo.marche) - 1) * 100);   // (12 nov.) mêmes annonces des deux côtés
                return <> {tr('stats.affiches')} <b>{eur2(valo.affiche)}&nbsp;€</b>{Math.abs(ec) >= 5 ? <> {tr('stats.soit')} <b style={{ color: C.text }}>{ec > 0 ? '+' : ''}{ec}%</b> {ec > 0 ? 'au-dessus' : tr('stats.dessous')} {tr('stats.marche')}</> : tr('stats.ligneAvecMarche')}.</>; })()}
            </div>
          </Card>
        )}
        {groups.length === 0 ? (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>
            {tr('stats.encoreAssezVentes')} <b>{tr('stats.moinsDeuxVentes')}</b> {tr('stats.memeModeleTaille')}
          </div>
        </Card>
      ) : (<>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
          {tr('emails.texte4')} <b>{tr('stats.ventesFinalisees')}</b>{tr('stats.texte8')} <b>{tr('stats.modeleTaille')}</b> {tr('stats.2VentesMoins')}{' '}
          <Pourquoi>{tr('stats.modeleHorsGrands')}</Pourquoi>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map((gr, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${C.border}`, background: C.card, borderRadius: 12, padding: '11px 14px', boxShadow: C.shadow || 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, textTransform: 'capitalize' }}>
                  {gr.modele} <span style={{ color: C.accentTexte, fontWeight: 700, textTransform: 'none' }}>T{gr.taille}</span>
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {gr.n} {tr('journee.vente')}{gr.n > 1 ? 's' : ''} {tr('stats.texte9')} {eur2(gr.min)} à {eur2(gr.max)}&nbsp;€{gr.stock > 0 ? tr('stats.stock', { stock: String(gr.stock) }) : ''}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 }}>{tr('stats.prixMedian')}</div>
                <div className="vrm-display" style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{eur2(gr.med)}&nbsp;€</div>
              </div>
            </div>
          ))}
        </div>
      </>)}
      </>)}
    </div>
  );
}
export { PrixMarche };

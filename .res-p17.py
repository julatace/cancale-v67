import re
p='vinted-sync-extension/vrm-ui.js'
s=open(p,encoding='utf8').read()
lines=s.split('\n')
out=[]
for l in lines:
    if l.startswith('    cb_directe: {'):
        out.append('''    cb_seule: { fr: "C’est la seule méthode : tout passe par la page de Vinted, aucune requête envoyée par VRM.", en: "It is the only method: everything goes through Vinted’s page, no request sent by VRM.", es: "Es el único método: todo pasa por la página de Vinted, VRM no envía ninguna petición.", it: "È l’unico metodo: tutto passa dalla pagina di Vinted, VRM non invia alcuna richiesta.", de: "Das ist die einzige Methode: alles läuft über die Vinted-Seite, VRM sendet keine Anfrage." },''')
        continue
    if l.startswith('    cb_directe_note: {'):
        out.append('''    cb_directe_ignoree: { fr: "L’ancienne méthode « directe » enregistrée est ignorée : elle a été retirée.", en: "The saved former “direct” method is ignored: it has been removed.", es: "El antiguo método «directo» guardado se ignora: se ha retirado.", it: "Il vecchio metodo «diretto» salvato è ignorato: è stato rimosso.", de: "Die gespeicherte frühere „direkte“ Methode wird ignoriert: sie wurde entfernt." },''')
        continue
    out.append(l)
open(p,'w',encoding='utf8').write('\n'.join(out))
p='vinted-sync-extension/vrm-badge.js'
s=open(p,encoding='utf8').read()
old="""      ${choix('formulaire', 'cb_formulaire', 'cb_formulaire_note')}${choix('directe', 'cb_directe', 'cb_directe_note')}"""
assert s.count(old)==1
s=s.replace(old,"""      ${choix('formulaire', 'cb_formulaire', 'cb_formulaire_note')}<p class="note5" data-cb-seule>${esc(TU('cb_seule'))}</p>${g.methodeAvant === 'directe' ? `<p class="note5" data-cb-directe-ignoree>${esc(TU('cb_directe_ignoree'))}</p>` : ''}""")
open(p,'w',encoding='utf8').write(s)
print('ok')

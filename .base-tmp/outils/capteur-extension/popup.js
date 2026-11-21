const $ = (id) => document.getElementById(id);
const maj = () => chrome.runtime.sendMessage({ action: 'etat' }, (r) => {
  $('etat').innerHTML = r && r.actif ? `🔴 Enregistrement en cours — <span id="n">${r.n}</span> requêtes` : `⚪ À l'arrêt — ${r ? r.n : 0} requêtes gardées`;
});
$('go').onclick = () => chrome.runtime.sendMessage({ action: 'demarrer' }, maj);
$('stop').onclick = () => chrome.runtime.sendMessage({ action: 'arreter' }, maj);
$('rep').onclick = () => chrome.runtime.sendMessage({ action: 'repere', texte: 'action Vintex' }, maj);
$('dl').onclick = () => chrome.runtime.sendMessage({ action: 'releve' }, (r) => {
  const blob = new Blob([JSON.stringify(r.releve || [], null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'releve-vinted-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json'; a.click();
});
maj(); setInterval(maj, 1000);

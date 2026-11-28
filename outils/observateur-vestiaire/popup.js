'use strict';
const $ = (id) => document.getElementById(id);
async function maj() {
  const o = await chrome.storage.local.get(['obs_on', 'obs_complet']);
  const on = o.obs_on === true;
  $('voyant').dataset.on = on ? '1' : '0';
  $('on-txt').textContent = on ? 'Enregistrement en cours' : 'Arrêté';
  $('basculer').textContent = on ? 'Arrêter' : 'Allumer l\'enregistrement';
  $('basculer').dataset.on = on ? '1' : '0';
  let n = 0; try { n = await window.VRMBase.compter(); } catch (_) {}
  $('etat').textContent = (on ? 'En cours' + (o.obs_complet ? ' (capture complète)' : '') + ' · ' : 'Arrêté · ') + n.toLocaleString('fr-FR') + ' événement' + (n > 1 ? 's' : '') + ' noté' + (n > 1 ? 's' : '');
}
$('basculer').addEventListener('click', async () => { await chrome.storage.local.set({ obs_on: $('basculer').dataset.on !== '1' }); maj(); });
$('ouvrir').addEventListener('click', () => { chrome.tabs.create({ url: chrome.runtime.getURL('page.html') }); window.close(); });
// L'export se fait dans la page de l'extension (un popup se ferme dès qu'on clique ailleurs : le téléchargement serait coupé).
$('exporter').addEventListener('click', () => { chrome.tabs.create({ url: chrome.runtime.getURL('page.html#exporter') }); window.close(); });
$('effacer').addEventListener('click', async () => {
  if (!confirm('Effacer tout ce qui a été noté ? Rien ne pourra être récupéré.')) return;
  await chrome.runtime.sendMessage({ quoi: 'effacer' });
  maj();
});
maj();
setInterval(maj, 2000);

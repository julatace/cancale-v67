'use strict';
const $ = (id) => document.getElementById(id);
async function maj() {
  const o = await chrome.storage.local.get(['obs_on', 'obs_complet']);
  $('on').checked = o.obs_on === true;
  let n = 0; try { n = await window.VRMBase.compter(); } catch (_) {}
  $('etat').textContent = (o.obs_on === true ? 'En cours' + (o.obs_complet ? ' (capture complète)' : '') + ' · ' : 'Éteint · ') + n.toLocaleString('fr-FR') + ' événement' + (n > 1 ? 's' : '') + ' noté' + (n > 1 ? 's' : '');
}
$('on').addEventListener('change', async (e) => { await chrome.storage.local.set({ obs_on: e.target.checked }); maj(); });
$('ouvrir').addEventListener('click', () => { chrome.tabs.create({ url: chrome.runtime.getURL('page.html') }); window.close(); });
maj();

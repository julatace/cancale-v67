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
async function majExpl() {
  let s = null; try { const r = await chrome.runtime.sendMessage({ quoi: 'expl_etat' }); s = r && r.etat; } catch (_) {}
  const z = $('expl-etat');
  if (!s) { z.textContent = 'Pas lancée.'; z.dataset.n = '0'; $('expl-arreter').hidden = true; $('expl-reprendre').hidden = true; $('expl-lancer').hidden = false; return; }
  const enAttente = (s.file || []).length + (s.courant ? 1 : 0);
  z.dataset.n = String(s.n || 0); z.dataset.actif = s.actif ? '1' : '0';
  z.textContent = (s.n || 0) + ' page' + ((s.n || 0) > 1 ? 's' : '') + ' vue' + ((s.n || 0) > 1 ? 's' : '') + ' · ' + enAttente + ' en attente · ' + (s.actif ? 'exploration en cours' : (s.arret ? (s.arret.fini ? 'terminée : ' : 'arrêtée : ') + s.arret.raison : 'arrêtée'));
  $('expl-arreter').hidden = !s.actif;
  $('expl-lancer').hidden = !!s.actif;
  $('expl-lancer').textContent = s.n ? 'Recommencer depuis le début' : 'Explorer le site tout seul';
  $('expl-reprendre').hidden = !!s.actif || !enAttente || !!(s.arret && s.arret.fini);
}
$('expl-lancer').addEventListener('click', async () => { await chrome.runtime.sendMessage({ quoi: 'expl_lancer' }); majExpl(); });
$('expl-reprendre').addEventListener('click', async () => { await chrome.runtime.sendMessage({ quoi: 'expl_reprendre' }); majExpl(); });
$('expl-arreter').addEventListener('click', async () => { await chrome.runtime.sendMessage({ quoi: 'expl_arreter' }); majExpl(); });
maj(); majExpl();
setInterval(() => { maj(); majExpl(); }, 1000);

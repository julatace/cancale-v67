// ── src/natif/visuel/photosProfil.js — la photo de profil de chaque compte, UNE lecture partagée (25 nov., logo-vinted-pp) ──
// Julien (iPhone, Annonces) : « le logo de Vinted, mais pour le compte la pp du compte Vinted ». Le rond du compte
// (`AvatarCompte`, src/natif/visuel/Inventaire.jsx) montre la VRAIE photo de profil du compte quand elle est captée.
//
// IDENTITÉ (CLAUDE.md §5) : la photo d'un compte vient de SA ligne — `harvest_{uid}_profile` du MÊME uid — et seulement si
// la ligne ne dit pas un autre compte (`payload.user.id` absent ou égal à l'uid). Jamais d'un pseudo ressemblant, jamais
// d'une ligne orpheline. https seulement. Leboncoin, eBay, Vestiaire : aucune photo de profil captée aujourd'hui ⇒ l'initiale.
//
// LECTURE : une seule, projetée (jamais `select=data`), au PREMIER rond monté (rien au démarrage), pour la session en cours
// (`qui`). « Pas su » (lecture ratée) ⇒ `null` : l'initiale, et une nouvelle tentative au plus tôt 60 s après.
// L'écran pose le lecteur (`lire(requete)` → lignes | lance) et le rendu de la photo (`Photo(props)` = PhotoVinted, la règle
// des photos du CDN de Vinted, scripts/audit-photos-vinted.cjs) : ce module n'importe rien de l'app.
import React from 'react';

export const REQUETE_PHOTOS_COMPTES = 'id=like.harvest_*_profile&select=id,photo:data->payload->user->photo->>url,pid:data->payload->user->>id';
const RE_LIGNE = /^harvest_(\d{1,20})_profile$/;
const REESSAI_MS = 60000;

// Les lignes lues → { uid: url }. Une ligne qui dit un AUTRE compte, une adresse pas https : écartées.
export function photosDesLignes(lignes) {
  const out = {};
  for (const r of Array.isArray(lignes) ? lignes : []) {
    const m = RE_LIGNE.exec(String((r && r.id) || ''));
    if (!m) continue;
    const pid = r.pid == null || r.pid === '' ? null : String(r.pid);
    if (pid !== null && pid !== m[1]) continue;
    const url = String(r.photo || '');
    if (!/^https:\/\/[^\s"'<>]+$/i.test(url)) continue;
    out[m[1]] = url;
  }
  return out;
}

// La clé d'un rond (`site:compte`) → l'uid de SA ligne de profil, ou null (un site sans photo captée).
export const uidPhotoDe = (cle) => { const m = /^vinted:(\d{1,20})$/.exec(String(cle || '')); return m ? m[1] : null; };

let source = null;            // { lire, qui, Photo }
let etat = { qui: '', photos: undefined, le: 0, enVol: false };
const abonnes = new Set();
const prevenir = () => { for (const f of abonnes) { try { f(); } catch (_) {} } };

export function poserSourcePhotosComptes(s) { source = s || null; }
export const photoComptesRendu = () => (source && source.Photo) || null;

const quiCourant = () => { try { return String((source && (typeof source.qui === 'function' ? source.qui() : source.qui)) || ''); } catch (_) { return ''; } };
function lancer() {
  if (!source || typeof source.lire !== 'function') return;
  const qui = quiCourant();
  if (!qui) return;
  if (etat.qui !== qui) etat = { qui, photos: undefined, le: 0, enVol: false };
  if (etat.enVol || etat.photos) return;
  if (etat.photos === null && Date.now() - etat.le < REESSAI_MS) return;
  etat.enVol = true;
  Promise.resolve().then(() => source.lire(REQUETE_PHOTOS_COMPTES)).then((l) => (Array.isArray(l) ? photosDesLignes(l) : null), () => null).then((photos) => {
    if (etat.qui !== qui) return;
    etat = { qui, photos, le: Date.now(), enVol: false };
    prevenir();
  });
}

const abonner = (f) => { abonnes.add(f); lancer(); return () => abonnes.delete(f); };
// Une photo n'est servie qu'au vendeur qui l'a lue (deux vendeurs dans le même onglet : jamais la photo de l'autre).
const instant = () => { const q = quiCourant(); return q && q === etat.qui ? etat.photos : undefined; };

// La photo du compte `cle` : une adresse, ou null (pas de photo, pas su, autre site).
export function usePhotoCompte(cle) {
  const uid = uidPhotoDe(cle);
  const photos = React.useSyncExternalStore(uid ? abonner : abonnerRien, uid ? instant : rien, rien);
  return uid && photos && photos[uid] ? photos[uid] : null;
}
const rien = () => undefined;
const abonnerRien = () => () => {};

// Pour les bancs et les tests : repartir de zéro.
export function __oublierPhotosComptes() { etat = { qui: '', photos: undefined, le: 0, enVol: false }; }

// « La même photo » (15 nov.) — ce que l'app publie, ce que la feuille, Ma journée et les
// écrans des sites lisent. UN propriétaire (§11) : `chargerMemePhoto` (App.jsx) calcule avec
// src/memePhoto.js et publie ici. Rien ici n'écrit en base, rien ne relie.
let etat = null;                                       // null = pas encore calculé (« pas su »)
const abonnes = new Set();
export function publierMemePhoto(x) { etat = x || null; for (const f of [...abonnes]) { try { f(); } catch (_) { /* un abonné cassé n'arrête pas les autres */ } } }
export const lireMemePhoto = () => etat;
export function abonnerMemePhoto(f) { abonnes.add(f); return () => abonnes.delete(f); }
// Ouvrir la feuille (n'importe quel écran) : `site` = 'Leboncoin' | 'eBay' | 'Vestiaire' | null (tous).
export const EVT_OUVRIR_MEME_PHOTO = 'vrm:meme-photo-ouvrir';
export function ouvrirMemePhoto(site = null) { try { window.dispatchEvent(new CustomEvent(EVT_OUVRIR_MEME_PHOTO, { detail: { site } })); } catch (_) { /* hors navigateur */ } }

#!/bin/bash
# Mutations : chaque règle réaffaiblie doit rendre l'audit ROUGE.
# Usage : bash scripts/mutations-messages-achats-plus.sh "$PWD" <dossier temporaire>  (14 nov., lot messages-achats-plus)
SRC="$1"; M="$2"
rm -rf "$M"; mkdir -p "$M"
for d in src api scripts vinted-sync-extension vercel.json package.json; do cp -r "$SRC/$d" "$M/"; done
ln -sf /home/user/cancale-v67/node_modules "$M/node_modules"
run() { # nom fichier python-remplacement
  local nom="$1" f="$2" a="$3" b="$4"
  cp "$M/$f" "$M/$f.bak"
  python3 -c "import sys;p=sys.argv[1];s=open(p).read();a=sys.argv[2];b=sys.argv[3];assert a in s,('absent',a);open(p,'w').write(s.replace(a,b,1))" "$M/$f" "$a" "$b" || { echo "  ?? mutation « $nom » : motif absent"; mv "$M/$f.bak" "$M/$f"; return; }
  if (cd "$M" && timeout 300 node scripts/audit-messages-achats-plus.cjs >/dev/null 2>&1); then echo "  ❌ mutation « $nom » : reste verte"; else echo "  ✅ mutation « $nom » : ROUGE"; fi
  mv "$M/$f.bak" "$M/$f"
}
run "109 sans les mots allemands de dispo" src/questionsFrequentes.js "de: ['verfugbar', 'noch verfugbar', 'noch da'," "de: ['zzz',"
run "109 taille proposée sans info (devinée)" src/questionsFrequentes.js "if (!inf.taille) return { texte: '', manque: 'taille' };" "if (!inf.taille) return { texte: 'Taille ' + tailleFiche };"
run "109 dispo sous une annonce partie" src/questionsFrequentes.js "return partie ? { texte: '', manque: 'partie' } : { texte: REPONSES.dispo[l] };" "return { texte: REPONSES.dispo[l] };"
run "108 infos par titre" src/infosPaire.js "const cles = clesPaire(paire, cleNum);
  if (!cles.length) return null;
  const n = cles[0]" "const cles = [...clesPaire(paire, cleNum), ...Object.keys(carte)];
  if (!cles.length) return null;
  const n = (cles[0] || '')"
run "110 projection qui garde tout" api/_lib/catalogue-prive.js "const x = { titre: str(p.titre).slice(0, 120)," "const x = { ...p, titre: str(p.titre).slice(0, 120),"
run "110 expiration ignorée" api/_lib/catalogue-prive.js "if (!Number.isFinite(exp) || exp <= maintenant) { await retirerIndex(jeton); return absent(); }" "if (!Number.isFinite(exp)) { return absent(); }"
run "110 révocation ignorée" api/_lib/catalogue-prive.js "if (!c || !memeJeton(jeton, c.j) || String(c.r) === 'true') return absent();" "if (!c || !memeJeton(jeton, c.j)) return absent();"
run "110 article d'un autre accepté" api/_lib/catalogue-prive.js "const it = parId.get(id);" "const it = parId.get(id) || { id, title: 'Annonce de B' };"
run "131 par titre" src/achatMemeAnnonce.js "const item = idOk(itemDeTx && itemDeTx[tx]); if (!item) continue;" "const item = idOk(itemDeTx && itemDeTx[tx]) || String(o.title || '');"
run "125 vendeur par pseudo" src/carnetVendeurs.js "poser(txOk(t.tx), vendeurOk(t.sid), t.login);" "poser(txOk(t.tx), String(t.login || t.sid), t.login);"
run "125 total sans couverture" src/carnetVendeurs.js "if (!v || !vendeurOk(v.id)) continue;" "if (!v || !vendeurOk(v.id)) { total--; continue; }"
run "111 prix pas su = oui" src/listeRecherche.js "if (p == null) return { ok: false, raison: 'prix', pasSu: true };" "if (p == null) return { ok: true };"
run "111 une requête Vinted de plus" vinted-sync-extension/background.js "async function donneesInfosPage(uid) {" "async function donneesInfosPage(uid) { await requeteVinted('lecture', async () => null).catch(() => null);"
run "108/109 la rangée envoie" src/AideReponse.jsx "if (!desactive && typeof onInserer === 'function') onInserer(insererDansReponse(valeur, t));" "if (!desactive && typeof onEnvoyer === 'function') onEnvoyer(t);"

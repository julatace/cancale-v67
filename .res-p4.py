p='vinted-sync-extension/background.js'
s=open(p,encoding='utf8').read()
def rep(old,new,n=1):
    global s
    c=s.count(old)
    assert c==n,(c,old[:80])
    s=s.replace(old,new)

# Mode vacances : plus de geste rejoué ; lu seulement
i=s.index("  const corps = corpsVacancesPour(recette, voulu);\n  if (!corps || !/^(PUT|POST|PATCH)$/")
j=s.index("// ══════════════════════════════════════════════════════════════════════════════", i)
s=s[:i]+"""  void recette;
  // ⚠️ 5.414 (`toutinterface`, Julien, 21 nov. : « on ne fait plus les requêtes ») : VRM ne REJOUE plus la requête apprise
  //    du mode vacances. Ce réglage vit dans les Paramètres de Vinted (pas encore mené par l'interface : son chemin n'a
  //    pas été relevé) ⇒ rien ne part, et c'est dit avec le geste à faire. L'état reste LU (profil) ailleurs.
  noterDiag('vacances_par_interface_pas_encore');
  return { accepte: false, code: 'interface-pas-encore', sens, raison: voulu ? 'Mets le compte en vacances sur vinted.fr (Paramètres → Mode vacances) : VRM n’envoie plus ce réglage par requête. Rien n’est parti.' : 'Rouvre le compte sur vinted.fr (Paramètres → Mode vacances) : VRM n’envoie plus ce réglage par requête. Rien n’est parti.' };
}

"""+s[j:]
open(p,'w',encoding='utf8').write(s)
print('ok')

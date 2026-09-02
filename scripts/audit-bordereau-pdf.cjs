#!/usr/bin/env node
// BANC : la récupération du PDF INSISTE quand Vinted ne l'a pas encore produit,
// et n'insiste PAS sur un refus dur. Exécute la VRAIE fonction du fichier.
const fs=require('fs'), vm=require('vm'), path=require('path');
// ⚠️ Chemin RELATIF au script : un chemin absolu relirait toujours le dépôt
// courant, donc la preuve « ça échoue sur le code d'avant » serait truquée (§5.80).
const SRC=fs.readFileSync(path.join(__dirname,'..','vinted-sync-extension','background.js'),'utf8');
const deb=SRC.indexOf('const LABEL_ATTENTES_MS');
const fin=SRC.indexOf('async function genererBordereauxEnAttente');
const bloc=SRC.slice(deb,fin);
let ko=0; const ok=t=>console.log('✅ '+t); const nok=(t,d)=>{ko++;console.log('❌ '+t+(d?' — '+d:''));};

const essai = async (nom, reponses, attenduOk, attenduEssais) => {
  let n=0; const diag=[];
  const ctx={ console,
    setTimeout:(f)=>f(),                       // pas d'attente réelle au banc
    noterDiag:async(k)=>{diag.push(k);},
    recupererLabel:async()=>{ const r=reponses[Math.min(n,reponses.length-1)]; n++; return r; } };
  vm.createContext(ctx);
  vm.runInContext(bloc+'\nglobalThis.__f = recupererLabelInsiste;', ctx);
  const r=await ctx.__f({},'1','tx');
  const pbs=[];
  if(!!r.ok!==attenduOk) pbs.push(`ok=${r.ok} au lieu de ${attenduOk}`);
  if(n!==attenduEssais) pbs.push(`${n} essai(s) au lieu de ${attenduEssais}`);
  pbs.length?nok(nom,pbs.join(' · ')):ok(`${nom} → ${n} essai(s), ${r.ok?'PDF envoyé':'abandon'}${diag.length?' ['+diag.join(',')+']':''}`);
};

(async()=>{
  const pasEncore={ok:false,raison:"Vinted n'a pas donné l'URL du PDF"};
  const pasExpe={ok:false,raison:"Vinted n'expose pas encore l'expédition de cette vente"};
  const dur={ok:false,raison:'Téléchargement du PDF refusé par le navigateur — recharge l\'extension (permissions)'};
  const vide={ok:false,raison:'PDF vide'};
  const bon={ok:true};

  await essai('PDF prêt du premier coup', [bon], true, 1);
  await essai('PDF prêt au 2e essai', [pasEncore,bon], true, 2);
  await essai('PDF prêt au 4e (dernier) essai', [pasEncore,pasEncore,pasEncore,bon], true, 4);
  await essai("l'expédition n'existe pas encore, puis oui", [pasExpe,bon], true, 2);
  await essai('jamais prêt → abandon après 4 essais', [pasEncore], false, 4);
  await essai('refus DUR (permissions) → aucun réessai', [dur], false, 1);
  await essai('PDF vide → aucun réessai', [vide], false, 1);

  // ── LE RENDEZ-VOUS : un PDF téléchargé à la main sait à quelle vente il est ──
  // Mesuré le 2 septembre : `tomj606` a DEUX ventes qui attendent l'envoi sans
  // aucun bordereau. La règle « un seul candidat » (juste, §24) ne pouvait donc
  // en relier aucun des deux, et le second écrasait le premier.
  // ⚠️ On ne SORT PAS si le rendez-vous n'existe pas : on rejoue l'ancien
  // `storeLabel` seul, pour montrer contrôle par contrôle ce qu'il ne savait pas
  // faire. Un audit qui s'arrête au premier manque ne prouve qu'une chose.
  const iRdv = SRC.indexOf('const BORD_ATTENDU =');
  const iSL = SRC.indexOf("// Range le dernier bordereau (PDF) telecharge");
  const blocRdv = SRC.slice(iRdv >= 0 ? iRdv : iSL, SRC.indexOf('// CAPTURE DU BORDEREAU — PAR LES TÉLÉCHARGEMENTS'));
  const avecRdv = /function attendreBordereau/.test(blocRdv);
  if (!avecRdv) nok('le rendez-vous de bordereau existe', 'attendreBordereau introuvable — on rejoue l\'ancien storeLabel');
  {
    const monter = (magasin, ventes, dejaCapte) => {
      const ecrites = [];
      const chrome = { storage: { local: {
        get: async (k) => (k in magasin ? { [k]: magasin[k] } : {}),
        set: async (o) => { Object.assign(magasin, o); },
        remove: async (k) => { delete magasin[k]; },
      } } };
      const ctx = { chrome, console, Date, Set, String, Object, JSON,
        activeAccountId: async () => '42',
        AWAITING_SHIP: (st) => /bordereau|paiement/i.test(String(st || '')),
        logActivity: () => {},
        sbGet: async (q) => (/orders_sold/.test(q)
          ? [{ data: { payload: { my_orders: ventes } } }]
          : dejaCapte.map(tx => ({ tx }))),
        supabaseUpsert: async (_t, lignes) => { ecrites.push(...lignes.map(l => l.id)); },
      };
      vm.createContext(ctx); vm.runInContext(blocRdv, ctx);
      // Sur l'ancien code, la fonction n'existe pas : on la remplace par un
      // no-op pour que les contrôles s'exécutent quand même et disent la vérité.
      if (typeof ctx.attendreBordereau !== 'function') ctx.attendreBordereau = async () => ({ ok: false });
      return { ctx, ecrites };
    };
    const deuxVentes = [
      { transaction_id: 21883380310, status: 'Bordereau envoyé au vendeur' },
      { transaction_id: 21928427030, status: 'Bordereau envoyé au vendeur' },
    ];
    // 1) DEUX colis en attente : sans rendez-vous, on ne devine pas (règle §24).
    {
      const { ctx, ecrites } = monter({}, deuxVentes, []);
      await ctx.storeLabel('www.vinted.fr', 'https://x/l.pdf', 'AA');
      ecrites.some(id => /_label_\d+$/.test(id))
        ? nok('sans rendez-vous, deux colis possibles → aucune attribution', 'un colis a été choisi au hasard : ' + ecrites.join(','))
        : ok('sans rendez-vous, deux colis possibles → aucune attribution (§24)');
    }
    // 2) AVEC rendez-vous : le PDF est relié à LA vente qu'on a ouverte.
    {
      const magasin = {};
      const { ctx, ecrites } = monter(magasin, deuxVentes, []);
      await ctx.attendreBordereau('42', '21928427030');
      await ctx.storeLabel('www.vinted.fr', 'https://x/l.pdf', 'AA');
      ecrites.includes('harvest_42_label_21928427030')
        ? ok('avec rendez-vous, le PDF est relié à la bonne vente')
        : nok('avec rendez-vous, le PDF est relié à la bonne vente', ecrites.join(',') || 'aucune ligne');
    }
    // 3) USAGE UNIQUE : un second PDF ne reprend pas la même identité.
    {
      const magasin = {};
      const { ctx, ecrites } = monter(magasin, deuxVentes, []);
      await ctx.attendreBordereau('42', '21928427030');
      await ctx.storeLabel('www.vinted.fr', 'https://x/1.pdf', 'AA');
      const apres = ecrites.length;
      await ctx.storeLabel('www.vinted.fr', 'https://x/2.pdf', 'BB');
      ecrites.slice(apres).some(id => id === 'harvest_42_label_21928427030')
        ? nok('le rendez-vous est à usage unique', 'le 2e PDF a repris la même vente')
        : ok('le rendez-vous est à usage unique');
    }
    // 4) PÉRIMÉ : au-delà de 15 min, on ne relie plus rien sur un souvenir.
    {
      const magasin = { vrmBordAttendu: { uid: '42', tx: '21928427030', at: Date.now() - 20 * 60 * 1000 } };
      const { ctx, ecrites } = monter(magasin, deuxVentes, []);
      await ctx.storeLabel('www.vinted.fr', 'https://x/l.pdf', 'AA');
      ecrites.some(id => /_label_\d+$/.test(id))
        ? nok('un rendez-vous périmé ne relie plus rien', 'attribution sur un souvenir de 20 min')
        : ok('un rendez-vous périmé ne relie plus rien');
    }
    // 5) AUTRE COMPTE : un rendez-vous ne traverse pas les comptes.
    {
      const magasin = { vrmBordAttendu: { uid: '99', tx: '21928427030', at: Date.now() } };
      const { ctx, ecrites } = monter(magasin, deuxVentes, []);
      await ctx.storeLabel('www.vinted.fr', 'https://x/l.pdf', 'AA');
      ecrites.some(id => /_label_\d+$/.test(id))
        ? nok("un rendez-vous d'un autre compte ne s'applique pas", ecrites.join(','))
        : ok("un rendez-vous d'un autre compte ne s'applique pas");
    }
    // 6) La règle « un seul candidat » marche toujours (aucune régression).
    {
      const { ctx, ecrites } = monter({}, [deuxVentes[0]], []);
      await ctx.storeLabel('www.vinted.fr', 'https://x/l.pdf', 'AA');
      ecrites.includes('harvest_42_label_21883380310')
        ? ok('un seul colis possible → toujours relié (aucune régression)')
        : nok('un seul colis possible → toujours relié', ecrites.join(',') || 'aucune ligne');
    }
  }
  // Le panneau doit proposer le chemin manuel quand la récupération échoue.
  const PAN = fs.readFileSync(path.join(__dirname,'..','vinted-sync-extension','vinted-panel.js'),'utf8');
  /bordManuel = \{ uid, tx \}/.test(PAN) && /action: 'attendreBord'/.test(PAN)
    ? ok("un échec de récupération propose d'ouvrir la vente sur Vinted")
    : nok("un échec de récupération propose d'ouvrir la vente sur Vinted", 'le message d\'erreur reste un cul-de-sac');

  console.log(ko?`\n${ko} cas non conforme(s).`:'\nLa récupération du PDF insiste juste ce qu\'il faut, et un échec a une porte de sortie.');
  process.exit(ko?1:0);
})();

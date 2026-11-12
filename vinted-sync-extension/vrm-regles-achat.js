// vrm-regles-achat.js — COPIE REFABRIQUÉE de src/calculetteAchat.js, src/dejaEnStock.js et de
// extractBrand/extractModel/extractColors/prixAchatDe (src/App.jsx) par
// scripts/regles-achat-extension.cjs --recopie. NE PAS MODIFIER ICI (§5 : une règle, un propriétaire).
var __vrmReglesAchat = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // regles-achat-entree.js
  var regles_achat_entree_exports = {};
  __export(regles_achat_entree_exports, {
    SITES_CALCULETTE: () => SITES_CALCULETTE,
    calculer: () => calculer,
    eurosCalc: () => eurosCalc,
    extractBrand: () => extractBrand,
    extractColors: () => extractColors,
    extractModel: () => extractModel,
    fraisSite: () => fraisSite,
    memeModele: () => memeModele,
    pairesDuModele: () => pairesDuModele,
    prixAchatDe: () => prixAchatDe
  });

  // src/profilVendeur.js
  var CATEGORIES_VENDS = [
    { v: "sneakers", titre: "Sneakers" },
    { v: "vetements", titre: "Vêtements" },
    { v: "luxe", titre: "Luxe & créateurs" },
    { v: "sacs", titre: "Sacs & maroquinerie" },
    { v: "montres", titre: "Montres & bijoux" },
    { v: "lunettes", titre: "Lunettes" },
    // (11 nov., lot DJ2) « il y a des personnes qui vendent des lunettes »
    { v: "accessoires", titre: "Accessoires" },
    { v: "vintage", titre: "Vintage" },
    { v: "enfants", titre: "Enfants & puériculture" },
    { v: "livres", titre: "Livres & BD" },
    { v: "jeux", titre: "Jeux vidéo & consoles" },
    { v: "hightech", titre: "High-tech" },
    { v: "cartes", titre: "Cartes à collectionner" },
    { v: "jouets", titre: "Jouets & figurines" },
    { v: "maison", titre: "Maison & déco" },
    { v: "sport", titre: "Sport & outdoor" },
    { v: "beaute", titre: "Beauté" },
    { v: "musique", titre: "Vinyles & musique" },
    { v: "autre", titre: "Autre chose" }
  ];
  var IDS_CATEGORIES = CATEGORIES_VENDS.map((c2) => c2.v);

  // src/beneficePaire.js
  function centimes(v) {
    if (v == null || String(v).trim() === "") return null;
    const s = String(v).trim().replace(",", ".");
    if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(s)) return null;
    const [a, b = ""] = s.split(".");
    return Number(a) * 100 + Number(b.padEnd(2, "0"));
  }
  var champsCharges = [["commission", "Commission plateforme"], ["transportVendeur", "Port payé par moi"], ["remboursement", "Remboursement acheteur"], ["autresFrais", "Autres frais"], ["emballage", "Emballage"]];
  function coutsVente(e = {}) {
    var _a;
    let cents = (_a = centimes(e == null ? void 0 : e.fees)) != null ? _a : 0, valid = !((e == null ? void 0 : e.fees) != null && String(e.fees).trim() !== "" && centimes(e.fees) == null);
    for (const [key] of champsCharges) {
      const v = e == null ? void 0 : e[key], c2 = centimes(v);
      if (v != null && String(v).trim() !== "" && c2 == null) valid = false;
      cents += c2 != null ? c2 : 0;
    }
    return { cents, total: cents / 100, complet: valid && (e == null ? void 0 : e.fraisComplets) === true, valid };
  }
  function beneficePaire(prix, e) {
    const vente = centimes(prix), achat = centimes(e == null ? void 0 : e.buyPrice), charges = coutsVente(e);
    return { ...charges, vente, achat, benefice: vente == null || achat == null || !charges.valid ? null : (vente - achat - charges.cents) / 100 };
  }

  // src/coutVente.js
  var vide = (v) => v == null || String(v).trim() === "";
  function cascadeVente(prix, fiche, { annulee = false, autreDevise = false } = {}) {
    if (annulee) return { etat: "annulee", vente: null, achat: null, frais: null, emballage: null, benefice: null, emballageSaisi: false };
    const e = fiche || {};
    const b = beneficePaire(prix, e);
    const emballageSaisi = !vide(e.emballage);
    const emb = emballageSaisi ? centimes(e.emballage) : null;
    const frais = b.valid ? b.cents - (emb != null ? emb : 0) : null;
    const base = { vente: autreDevise ? null : b.vente, achat: b.achat, frais, emballage: emb, emballageSaisi };
    if (autreDevise || b.vente == null) return { ...base, etat: "prix", benefice: null };
    if (!b.valid) return { ...base, etat: "illisible", benefice: null };
    if (b.achat == null) return { ...base, etat: "achat", benefice: null };
    return { ...base, etat: b.complet ? "ok" : "partiel", benefice: b.vente - b.achat - b.cents };
  }

  // src/fraisPlateformes.js
  var ORDRE = ["Vinted", "eBay", "Vestiaire", "Leboncoin"];
  var c = (x) => Math.round(Number(x) * 100);
  var eurLu = (m) => m && typeof m === "object" && m.value != null && String(m.value).trim() !== "" && isFinite(Number(m.value)) && m.currency === "EUR" ? Number(m.value) : null;
  var jourOk = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s);
  function fraisParPlateforme({ releve, ebay, packs, de, a, excluAutre, R } = {}) {
    const P = {};
    const site = (k) => P[k] || (P[k] = { plateforme: k, n: 0, nLus: 0, cBase: 0, cFrais: 0, cPacks: 0, nPacks: 0, baseLue: true, passu: false, commission: k === "eBay" || k === "Vestiaire" });
    const dans = (t) => Number.isFinite(t) && t >= de && t < a;
    if (Array.isArray(releve)) {
      for (const l of releve) {
        if (!Array.isArray(l)) continue;
        const plat = String(l[0] || "");
        if (plat === "eBay" || !ORDRE.includes(plat)) continue;
        if (!dans(Number(l[3]))) continue;
        const S = site(plat);
        S.n += 1;
        if (l[4] == null || !isFinite(Number(l[4]))) {
          S.baseLue = false;
          continue;
        }
        S.cBase += c(l[4]);
        if (plat === "Vestiaire") continue;
        S.nLus += 1;
        S.cFrais += l[6] == null ? 0 : c(l[6]);
      }
    } else for (const k of ["Vinted", "Leboncoin", "Vestiaire"]) site(k).passu = true;
    if (Array.isArray(ebay)) {
      for (const o of ebay) {
        if (!o || !o.orderId || String(o.orderPaymentStatus || "").toUpperCase() !== "PAID" || !R.commandeEbayEngagee(o)) continue;
        if (excluAutre && excluAutre("ebay", o)) continue;
        if (!dans(Date.parse(o.creationDate || ""))) continue;
        const S = site("eBay");
        S.n += 1;
        const du = eurLu(o.paymentSummary && o.paymentSummary.totalDueSeller);
        const f = eurLu(o.totalMarketplaceFee);
        if (du == null || f == null) continue;
        S.nLus += 1;
        S.cBase += c(du);
        S.cFrais += c(f);
      }
    } else site("eBay").passu = true;
    for (const p of Array.isArray(packs) ? packs : []) {
      if (!p || !jourOk(p.date)) continue;
      const t = Date.parse(String(p.date).slice(0, 10) + "T12:00:00");
      if (!dans(t)) continue;
      const m = Number(p.montant);
      if (!isFinite(m) || m <= 0) continue;
      const S = site(ORDRE.includes(p.plateforme) ? p.plateforme : "Autre");
      S.cPacks += c(m);
      S.nPacks += 1;
    }
    const sites = Object.values(P).map((S) => {
      const frais = (S.cFrais + S.cPacks) / 100;
      const base = S.cBase / 100;
      const couverture = S.commission ? { lus: S.nLus, n: S.n } : null;
      const complet = !S.passu && S.baseLue && (!couverture || couverture.lus === couverture.n);
      const pct = S.plateforme === "Vestiaire" || S.plateforme === "Autre" || !(S.cBase > 0) || S.passu || couverture && couverture.lus === 0 ? null : Math.round((S.cFrais + S.cPacks) / S.cBase * 1e3) / 10;
      return {
        plateforme: S.plateforme,
        n: S.n,
        base,
        frais: S.passu ? null : frais,
        commission: S.cFrais / 100,
        options: S.cPacks / 100,
        nOptions: S.nPacks,
        pct,
        couverture,
        complet,
        passu: S.passu,
        commissionPasLue: S.plateforme === "Vestiaire" && S.n > 0
      };
    }).filter((s) => s.passu || s.n > 0 || s.options > 0).sort((x, y) => ORDRE.indexOf(x.plateforme) + 99 * (x.plateforme === "Autre") - (ORDRE.indexOf(y.plateforme) + 99 * (y.plateforme === "Autre")));
    return { sites, total: Math.round(sites.reduce((t, s) => t + (s.frais == null ? 0 : c(s.frais)), 0)) / 100, partiel: sites.some((s) => !s.complet || s.commissionPasLue) };
  }

  // src/calculetteAchat.js
  var SITES_CALCULETTE = [
    { cle: "vinted", nom: "Vinted" },
    { cle: "leboncoin", nom: "Leboncoin" },
    { cle: "ebay", nom: "eBay" },
    { cle: "vestiaire", nom: "Vestiaire" }
  ];
  function fraisSite(site, { ebayCommandes = null, commandeEbayEngagee = null } = {}) {
    if (site === "vinted") return { etat: "zero", phrase: "Vinted ne prend rien au vendeur" };
    if (site === "leboncoin") return { etat: "zero", phrase: "Leboncoin ne prend rien au vendeur" };
    if (site === "vestiaire") return { etat: "pasLu", phrase: "Commission Vestiaire pas lue" };
    if (site !== "ebay") return { etat: "pasLu", phrase: "Frais pas connus" };
    if (!Array.isArray(ebayCommandes) || typeof commandeEbayEngagee !== "function") return { etat: "pasLu", phrase: "Frais eBay pas encore lus" };
    const F = fraisParPlateforme({ releve: [], ebay: ebayCommandes, packs: [], de: 0, a: Infinity, R: { commandeEbayEngagee } });
    const s = F.sites.find((x) => x.plateforme === "eBay");
    const lus = s && s.couverture ? s.couverture.lus : 0;
    if (!s || !lus || !(s.base > 0)) return { etat: "pasLu", phrase: "Frais eBay pas encore lus" };
    const taux = Math.round(Math.round(s.commission * 100) / Math.round(s.base * 100) * 1e3);
    return { etat: "taux", taux, n: lus, phrase: `${(taux / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % d’après tes ${lus} vente${lus > 1 ? "s" : ""} eBay` };
  }
  var lisible = (t) => {
    const s = String(t == null ? "" : t).trim().replace(/\s*€$/, "").replace(/\s/g, "");
    return s === "" ? "" : s;
  };
  function calculer({ achat, revente, site, emballage = "" }, contexte = {}) {
    const a = lisible(achat), v = lisible(revente), e = lisible(emballage);
    if (!a || !v) return { etat: "vide" };
    if (centimes(a) == null || centimes(v) == null || e && centimes(e) == null) return { etat: "illisible" };
    const f = fraisSite(site, contexte);
    const commission = f.etat === "taux" ? String((Math.round(centimes(v) * f.taux / 1e3) / 100).toFixed(2)) : "";
    const fiche = { buyPrice: a, ...commission ? { commission } : {}, ...e ? { emballage: e } : {}, fraisComplets: true };
    const c2 = cascadeVente(v, fiche);
    if (c2.etat !== "ok" && c2.etat !== "partiel") return { etat: "illisible" };
    const manque = [];
    if (f.etat === "pasLu") manque.push(f.phrase);
    if (!e) manque.push("emballage pas compté");
    const borne = manque.length ? "au-plus" : f.etat === "taux" ? "environ" : "exact";
    return { etat: "ok", cascade: c2, benefice: c2.benefice, borne, frais: f, manque };
  }
  var eurosCalc = (c2) => {
    if (c2 == null || !Number.isFinite(c2)) return "—";
    const e = Math.abs(c2) / 100;
    return (c2 < 0 ? "−" : "") + (Number.isInteger(e) ? e.toLocaleString("fr-FR") : e.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + " €";
  };

  // src/suggestionsAchat.js
  function tailleNorm(s) {
    const t = String(s == null ? "" : s).toLowerCase().replace(/\s+/g, " ").trim();
    const m = /(?:^|[^0-9])(3[0-9]|4[0-9]|5[0-2])(?:\s*([12])\s*\/\s*3|\s*[.,]\s*5|\s*½)?(?![0-9])/.exec(t);
    if (!m) return "";
    const reste = m[0].slice(m[0].indexOf(m[1]) + m[1].length);
    if (m[2]) return `${m[1]} ${m[2]}/3`;
    if (/[.,½]/.test(reste)) return `${m[1]}.5`;
    return m[1];
  }
  function tailleDuTitre(titre) {
    const t = String(titre || "").toLowerCase();
    const apres = /(?:taille|pointure|size|maat|eu|fr|\bt|\bn)\s*[.:]?\s*((?:3[4-9]|4[0-9]|5[0-2])(?:\s*[12]\s*\/\s*3|\s*[.,]\s*5|\s*½)?)(?![0-9])/.exec(t);
    if (apres) return tailleNorm(apres[1]);
    const seul = /(?:^|[^0-9.,/])((?:3[4-9]|4[0-9]|5[0-2])(?:\s+[12]\s*\/\s*3|[.,]5|½)?)(?![0-9/])/.exec(t);
    return seul ? tailleNorm(seul[1]) : "";
  }

  // src/dejaEnStock.js
  var bas = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  var VIDES = /* @__PURE__ */ new Set(["taille", "pointure", "size", "homme", "femme", "enfant", "mixte", "neuf", "neuve", "neuves", "tres", "bon", "bonne", "etat", "paire", "paires", "chaussures", "chaussure", "baskets", "basket", "sneakers", "sneaker", "avec", "sans", "pour", "les", "des", "une", "eur", "lot", "boite", "original", "originale", "authentique", "vintage", "rare"]);
  var motsModele = (titre, marque, couleursDe) => {
    const mq = bas(marque).split(/[^a-z0-9]+/).filter(Boolean);
    return new Set(bas(titre).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !VIDES.has(w) && !mq.includes(w) && !(typeof couleursDe === "function" && (couleursDe(w) || []).length)));
  };
  var tailleDe = (x) => (x && x.taille ? tailleNorm(x.taille) : "") || tailleDuTitre(x && x.titre || "");
  function memeModele(a, b, { marqueDe, modeleDe = null, couleursDe = null } = {}) {
    if (!a || !b || typeof marqueDe !== "function") return false;
    const ma = bas(marqueDe(String(a.marque || "")) || a.marque || marqueDe(String(a.titre || "")));
    const mb = bas(marqueDe(String(b.marque || "")) || b.marque || marqueDe(String(b.titre || "")));
    if (!ma || !mb || ma !== mb) return false;
    const ta = tailleDe(a), tb = tailleDe(b);
    if (ta && tb && ta !== tb) return false;
    const oa = typeof modeleDe === "function" ? modeleDe(String(a.titre || "")) : null;
    const ob = typeof modeleDe === "function" ? modeleDe(String(b.titre || "")) : null;
    if (oa && ob) return bas(oa) === bas(ob);
    const wa = motsModele(a.titre, ma, couleursDe), wb = motsModele(b.titre, mb, couleursDe);
    for (const w of wa) if (wb.has(w)) return true;
    return false;
  }
  function pairesDuModele({ cible, stock, sauf = null, marqueDe, modeleDe = null, couleursDe = null, maintenant = Date.now() } = {}) {
    if (!cible || !String(cible.titre || "").trim() || !Array.isArray(stock) || typeof marqueDe !== "function") return { n: 0, paires: [] };
    const vus = /* @__PURE__ */ new Set(), paires = [];
    for (const s of stock) {
      if (!s || s.id == null) continue;
      const id = String(s.id);
      if (vus.has(id) || sauf != null && id === String(sauf)) continue;
      vus.add(id);
      if (!memeModele(cible, s, { marqueDe, modeleDe, couleursDe })) continue;
      const d = Number(s.depuisMs);
      paires.push({
        id,
        num: String(s.num || ""),
        titre: String(s.titre || ""),
        taille: tailleDe(s) || "",
        photo: s.photo || null,
        jours: Number.isFinite(d) && d > 0 && d <= maintenant ? Math.floor((maintenant - d) / 864e5) : null
      });
    }
    paires.sort((x, y) => (y.jours == null ? -1 : y.jours) - (x.jours == null ? -1 : x.jours));
    return { n: paires.length, paires };
  }

  // regles-achat-entree.js
  var KNOWN_BRANDS = [
    "New Balance",
    "Under Armour",
    "Air Jordan",
    "Le Coq Sportif",
    "Sergio Tacchini",
    "Nike",
    "Adidas",
    "Asics",
    "Jordan",
    "Puma",
    "Reebok",
    "Vans",
    "Converse",
    "Lacoste",
    "Wilson",
    "Babolat",
    "Head",
    "Yonex",
    "Salomon",
    "Brooks",
    "Hoka",
    "Mizuno",
    "Fila",
    "Saucony",
    "New Era",
    "Kappa",
    "Hummel",
    "Umbro",
    "Ellesse",
    "Diadora",
    "Lotto"
  ];
  function extractBrand(text) {
    if (!text) return null;
    const t = text.toLowerCase();
    for (const b of KNOWN_BRANDS) {
      if (t.includes(b.toLowerCase())) return b;
    }
    return null;
  }
  var COULEURS = {
    noir: ["noir", "noire", "black", "nero", "negro", "schwarz", "zwart"],
    blanc: ["blanc", "blanche", "white", "bianco", "blanco", "weiss", "wit"],
    gris: ["gris", "grise", "grey", "gray", "grigio", "grau", "grijs"],
    bleu: ["bleu", "bleue", "blue", "blu", "azul", "blau", "blauw", "marine", "navy"],
    vert: ["vert", "verte", "green", "verde", "grun", "grün", "groen", "mineral green"],
    rouge: ["rouge", "red", "rosso", "rojo", "rot", "rood"],
    rose: ["rose", "pink", "rosa", "roze"],
    jaune: ["jaune", "yellow", "giallo", "amarillo", "gelb", "geel"],
    orange: ["orange", "arancione", "naranja", "oranje"],
    violet: ["violet", "purple", "viola", "morado", "lila", "paars"],
    beige: ["beige", "sable", "sand", "crema", "creme", "crème", "cream"],
    marron: ["marron", "brown", "marrone", "braun", "bruin"]
  };
  function extractColors(text) {
    if (!text) return [];
    const t = String(text).toLowerCase().replace(/[^a-zà-ÿ0-9]+/g, " ");
    const vues = /* @__PURE__ */ new Set();
    for (const [nom, mots] of Object.entries(COULEURS))
      for (const m of mots) if (new RegExp("(^| )" + m + "( |$)").test(t)) {
        vues.add(nom);
        break;
      }
    return [...vues];
  }
  var KNOWN_MODELS = [
    "zoom fly",
    "p-6000",
    "p6000",
    "p 6000",
    "air max 95",
    "air max 97",
    "air max 1",
    "air max 90",
    "air max",
    "air force",
    "pegasus",
    "vaporfly",
    "alphafly",
    "dunk",
    "blazer",
    "cortez",
    "spezial",
    "samba",
    "gazelle",
    "campus",
    "handball",
    "superstar",
    "stan smith",
    "forum",
    "sl 72",
    "gel-resolution",
    "gel resolution",
    "gel-nimbus",
    "gel nimbus",
    "gel-kayano",
    "gel kayano",
    "gel-lyte",
    "gel lyte",
    "fuelcell",
    "xt-6",
    "xt 6",
    "speedcross",
    "medalist",
    "mexico 66",
    "california",
    "old skool",
    "chuck"
  ];
  function extractModel(text) {
    if (!text) return null;
    const t = String(text).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
    let best = null;
    for (const m of KNOWN_MODELS) {
      const k = m.replace(/[^a-z0-9]+/g, " ").trim();
      if (contientModele(t, k) && (!best || k.length > best.length)) best = k;
    }
    return best;
  }
  function contientModele(t, k) {
    if (!/\d$/.test(k)) return t.includes(k);
    let i = t.indexOf(k);
    while (i >= 0) {
      if (!/\d/.test(t.charAt(i + k.length))) return true;
      i = t.indexOf(k, i + 1);
    }
    return false;
  }
  var prixAchatDe = (fiche, buyByNum) => {
    const e = fiche || {};
    const num = e.numero != null ? String(e.numero).trim() : "";
    const brut = e.buyPrice != null && String(e.buyPrice).trim() !== "" ? e.buyPrice : num && buyByNum && buyByNum[num] != null ? buyByNum[num] : null;
    if (brut == null || String(brut).trim() === "") return null;
    const n = parseFloat(String(brut).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  return __toCommonJS(regles_achat_entree_exports);
})();

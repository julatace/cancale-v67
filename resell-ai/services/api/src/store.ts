// Persistance OPTIONNELLE. Si Prisma + DATABASE_URL sont dispo, on l'utilise ;
// sinon on tombe sur un magasin en MÉMOIRE, pour que l'API tourne même sans base
// (démo, extension). Même interface dans les deux cas.

export interface ItemRow {
  id: string;
  title: string;
  brand?: string | null;
  size?: string | null;
  condition?: string | null;
  price: number;
  buyPrice?: number | null;
  photoCount: number;
  views: number;
  favourites: number;
  ageDays: number;
  status: string;
}

export interface Store {
  kind: "prisma" | "memory";
  listItems(): Promise<ItemRow[]>;
  saveSuggestion(itemId: string, kind: string, payload: unknown): Promise<void>;
}

// ── Magasin mémoire (fallback) ───────────────────────────────────────────────
function memoryStore(): Store {
  const items: ItemRow[] = [
    { id: "demo1", title: "Nike Air Max 90", brand: "Nike", size: "42", condition: "Bon état", price: 60, buyPrice: 25, photoCount: 4, views: 48, favourites: 1, ageDays: 41, status: "online" },
    { id: "demo2", title: "adidas Samba OG", brand: "adidas", size: "40", condition: "Très bon état", price: 75, buyPrice: 30, photoCount: 2, views: 12, favourites: 5, ageDays: 6, status: "online" },
    { id: "demo3", title: "veste vintage", price: 35, photoCount: 1, views: 90, favourites: 0, ageDays: 74, status: "online" },
  ];
  const suggestions: any[] = [];
  return {
    kind: "memory",
    async listItems() { return items; },
    async saveSuggestion(itemId, kind, payload) { suggestions.push({ itemId, kind, payload, at: Date.now() }); },
  };
}

// ── Magasin Prisma ───────────────────────────────────────────────────────────
async function prismaStore(): Promise<Store | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const mod = await import("@prisma/client");
    const prisma = new mod.PrismaClient();
    await prisma.$queryRaw`SELECT 1`; // vérifie la connexion
    return {
      kind: "prisma",
      async listItems() {
        const items = await prisma.item.findMany({ include: { metrics: { orderBy: { capturedAt: "desc" }, take: 1 } } });
        return items.map((it: any) => {
          const m = it.metrics[0] || { views: 0, favourites: 0 };
          const ageDays = Math.floor((Date.now() - new Date(it.listedAt).getTime()) / 86400000);
          return { id: it.id, title: it.title, brand: it.brand, size: it.size, condition: it.condition, price: it.price, buyPrice: it.buyPrice, photoCount: it.photoCount, views: m.views, favourites: m.favourites, ageDays, status: it.status };
        });
      },
      async saveSuggestion(itemId, kind, payload) {
        try { await prisma.suggestion.create({ data: { itemId, kind, payload: payload as any } }); } catch { /* item de démo hors base */ }
      },
    };
  } catch {
    return null; // base indisponible → mémoire
  }
}

export async function getStore(): Promise<Store> {
  return (await prismaStore()) ?? memoryStore();
}

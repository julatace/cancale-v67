// Seed de démo (nécessite une base + `npm run prisma:push`). Sans DATABASE_URL,
// le script le dit et sort proprement — l'API tourne alors en mémoire.

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("Pas de DATABASE_URL : rien à semer (l'API utilisera le magasin mémoire).");
    return;
  }
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const seller = await prisma.seller.upsert({
    where: { email: "demo@resell.ai" },
    update: {},
    create: { email: "demo@resell.ai" },
  });

  const items = [
    { title: "Nike Air Max 90 blanche", brand: "Nike", size: "42", condition: "Bon état", price: 60, buyPrice: 25, photoCount: 4, views: 48, favourites: 1, ageDays: 41 },
    { title: "adidas Samba OG", brand: "adidas", size: "40", condition: "Très bon état", price: 75, buyPrice: 30, photoCount: 2, views: 12, favourites: 5, ageDays: 6 },
    { title: "veste vintage", brand: null, size: null, condition: null, price: 35, buyPrice: 10, photoCount: 1, views: 90, favourites: 0, ageDays: 74 },
  ];

  for (const it of items) {
    const listedAt = new Date(Date.now() - it.ageDays * 86400000);
    const created = await prisma.item.create({
      data: {
        sellerId: seller.id, title: it.title, brand: it.brand, size: it.size, condition: it.condition,
        price: it.price, buyPrice: it.buyPrice, photoCount: it.photoCount, listedAt,
        metrics: { create: { views: it.views, favourites: it.favourites } },
      },
    });
    console.log("Créé :", created.title);
  }
  console.log("Seed terminé.");
}

main().catch((e) => { console.error(e); process.exit(1); });

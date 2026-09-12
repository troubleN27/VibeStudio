import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma";

/**
 * Seed-скрипт для локальной разработки.
 *
 * Идемпотентен: повторный запуск обновляет поля существующих залов/услуг
 * (photoUrl, description, price, durationMin) и не создаёт дублей.
 * Это позволяет менять контент в этом файле и просто перезапускать seed.
 */

const ADMIN_LOGIN = process.env.SEED_ADMIN_LOGIN ?? "admin";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin123";

async function main() {
  console.log("🌱 Seeding database...");

  /* ---------------------------------------------------------------------
   * 1. Администратор
   * ------------------------------------------------------------------- */
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await prisma.adminUser.upsert({
    where: { login: ADMIN_LOGIN },
    update: { passwordHash },
    create: { login: ADMIN_LOGIN, passwordHash }
  });

  console.log(
    `✅ Admin user: login="${ADMIN_LOGIN}" password="${ADMIN_PASSWORD}"`
  );

  /* ---------------------------------------------------------------------
   * 2. Залы
   *
   * photoUrl — подобранные фотографии интерьеров, соответствующие тематике
   * каждого зала. Все ссылки — Unsplash CDN, стабильные и без API-ключа.
   * ------------------------------------------------------------------- */
  const hallDefs = [
    {
      name: "Лофт",
      description:
        "Просторный лофт с панорамными окнами, кирпичными стенами и высокими потолками. Идеален для fashion- и портретных съёмок.",
      photoUrl:
        "https://images.unsplash.com/photo-1764726331208-71cb385ab08c?w=1200&q=80&auto=format&fit=crop"
    },
    {
      name: "Минимализм",
      description:
        "Светлый зал с однотонными стенами и профессиональным светом. Подходит для предметной и каталожной съёмки.",
      photoUrl:
        "https://images.unsplash.com/photo-1636540661852-5fbbbffd2c2f?w=1200&q=80&auto=format&fit=crop"
    },
    {
      name: "Циклорама",
      description:
        "Зал с белой циклорамой 6×4 м — универсальная площадка для рекламных, продуктовых и fashion-съёмок.",
      photoUrl:
        "https://images.unsplash.com/photo-1745193308101-faf4ddc81ad3?w=1200&q=80&auto=format&fit=crop"
    }
  ];

  const halls: { id: string; name: string }[] = [];

  for (const def of hallDefs) {
    const existing = await prisma.hall.findFirst({ where: { name: def.name } });
    if (existing) {
      // Обновляем контент существующего зала — важно для повторных seed-запусков
      const updated = await prisma.hall.update({
        where: { id: existing.id },
        data: {
          description: def.description,
          photoUrl: def.photoUrl
        },
        select: { id: true, name: true }
      });
      halls.push(updated);
      continue;
    }
    const created = await prisma.hall.create({
      data: {
        name: def.name,
        description: def.description,
        photoUrl: def.photoUrl,
        isActive: true
      },
      select: { id: true, name: true }
    });
    halls.push(created);
  }

  console.log(`✅ Halls: ${halls.map((h) => h.name).join(", ")}`);

  /* ---------------------------------------------------------------------
   * 3. Рабочие часы — все дни недели 10:00–22:00
   * ------------------------------------------------------------------- */
  for (const hall of halls) {
    for (let day = 0; day < 7; day++) {
      await prisma.workingHours.upsert({
        where: {
          hallId_dayOfWeek: { hallId: hall.id, dayOfWeek: day }
        },
        update: { startTime: "10:00", endTime: "22:00" },
        create: {
          hallId: hall.id,
          dayOfWeek: day,
          startTime: "10:00",
          endTime: "22:00"
        }
      });
    }
  }

  console.log("✅ Working hours: 10:00–22:00 all days");

  /* ---------------------------------------------------------------------
   * 4. Услуги
   * ------------------------------------------------------------------- */
  type ServiceDef = {
    hallName: string;
    name: string;
    description: string;
    price: number;
    durationMin: number;
  };

  const serviceDefs: ServiceDef[] = [
    // Лофт
    {
      hallName: "Лофт",
      name: "Портретная съёмка, 1 час",
      description: "Съёмка одного образа, 1 час аренды зала.",
      price: 250_000,
      durationMin: 60
    },
    {
      hallName: "Лофт",
      name: "Портретная съёмка, 2 часа",
      description: "Два образа, 2 часа аренды зала.",
      price: 450_000,
      durationMin: 120
    },
    {
      hallName: "Лофт",
      name: "Love story, 3 часа",
      description: "Парная съёмка, 3 часа аренды зала.",
      price: 650_000,
      durationMin: 180
    },
    // Минимализм
    {
      hallName: "Минимализм",
      name: "Предметная съёмка, 1 час",
      description: "Съёмка товаров на нейтральном фоне.",
      price: 200_000,
      durationMin: 60
    },
    {
      hallName: "Минимализм",
      name: "Каталожная съёмка, 2 часа",
      description: "Съёмка нескольких позиций с разным светом.",
      price: 380_000,
      durationMin: 120
    },
    // Циклорама
    {
      hallName: "Циклорама",
      name: "Рекламная съёмка, 2 часа",
      description: "Циклорама + базовый набор света.",
      price: 500_000,
      durationMin: 120
    },
    {
      hallName: "Циклорама",
      name: "Full day, 8 часов",
      description: "Полный день съёмок с циклорамой.",
      price: 1_500_000,
      durationMin: 480
    }
  ];

  const hallByName = new Map(halls.map((h) => [h.name, h.id] as const));

  for (const def of serviceDefs) {
    const hallId = hallByName.get(def.hallName);
    if (!hallId) continue;

    const existing = await prisma.service.findFirst({
      where: { hallId, name: def.name }
    });

    if (existing) {
      await prisma.service.update({
        where: { id: existing.id },
        data: {
          description: def.description,
          price: def.price,
          durationMin: def.durationMin,
          isActive: true
        }
      });
      continue;
    }

    await prisma.service.create({
      data: {
        hallId,
        name: def.name,
        description: def.description,
        price: def.price,
        durationMin: def.durationMin,
        isActive: true
      }
    });
  }

  console.log(`✅ Services: ${serviceDefs.length} synced`);

  /* ---------------------------------------------------------------------
   * 5. Тестовая блокировка (только в dev)
   * ------------------------------------------------------------------- */
  if (process.env.NODE_ENV !== "production") {
    const loft = halls.find((h) => h.name === "Лофт");
    if (loft) {
    const blockedDate = new Date();
    blockedDate.setUTCDate(blockedDate.getUTCDate() + 7);
    const dateUtc = new Date(
      Date.UTC(
        blockedDate.getUTCFullYear(),
        blockedDate.getUTCMonth(),
        blockedDate.getUTCDate()
      )
    );

    const existingBlock = await prisma.blockedSlot.findFirst({
      where: { hallId: loft.id, date: dateUtc }
    });
    if (!existingBlock) {
      await prisma.blockedSlot.create({
        data: {
          hallId: loft.id,
          date: dateUtc,
          startTime: "14:00",
          endTime: "16:00",
          reason: "Техническое обслуживание (demo-блокировка)"
        }
      });
      console.log(
        `✅ Blocked slot: ${loft.name} on ${dateUtc
          .toISOString()
          .slice(0, 10)} 14:00–16:00`
      );
      }
    }
  }

  /* ---------------------------------------------------------------------
   * 6. Тестовый клиент + бронь (только в dev)
   * ------------------------------------------------------------------- */
  if (process.env.NODE_ENV !== "production") {
    const hall = halls[0];
    const service = await prisma.service.findFirst({
      where: { hallId: hall.id }
    });

    if (hall && service) {
      const client = await prisma.client.upsert({
        where: { phone: "+998901112233" },
        update: {},
        create: {
          name: "Тестовый Клиент",
          phone: "+998901112233"
        }
      });

      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const bookingDate = new Date(
        Date.UTC(
          tomorrow.getUTCFullYear(),
          tomorrow.getUTCMonth(),
          tomorrow.getUTCDate()
        )
      );

      const existingBooking = await prisma.booking.findFirst({
        where: {
          hallId: hall.id,
          clientId: client.id,
          date: bookingDate,
          startTime: "12:00"
        }
      });

      if (!existingBooking) {
        const endMinutes = 12 * 60 + service.durationMin;
        const endTime = `${String(Math.floor(endMinutes / 60)).padStart(
          2,
          "0"
        )}:${String(endMinutes % 60).padStart(2, "0")}`;

        await prisma.booking.create({
          data: {
            hallId: hall.id,
            serviceId: service.id,
            clientId: client.id,
            date: bookingDate,
            startTime: "12:00",
            endTime,
            totalPrice: service.price,
            status: "CONFIRMED",
            source: "WEBSITE"
          }
        });
        console.log(
          `✅ Test booking: ${client.name} on ${bookingDate
            .toISOString()
            .slice(0, 10)} 12:00 — ${endTime}`
        );
      }
    }
  }

  console.log("🎉 Seeding completed.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
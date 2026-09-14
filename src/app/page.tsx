import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Logo from "@/components/ui/Logo";
import { initialsOf } from "@/lib/format";
import {
  IconArrowRight,
  IconBot,
  IconCalendar,
  IconCalendarCheck,
  IconCamera,
  IconCheck,
  IconChevronDown,
  IconGrid,
  IconMail,
  IconPhone,
  IconQuote,
  IconSend,
  IconSparkle,
  IconStar,
  IconWallet,
  IconZap
} from "@/components/ui/icons";

/**
 * Username Telegram-бота берём из переменной окружения.
 * Задаётся в .env как NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=<username без @>.
 */
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
const BOT_URL = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}` : "https://t.me";

const NAV_LINKS = [
  { href: "#halls", label: "Залы" },
  { href: "#features", label: "Возможности" },
  { href: "#how", label: "Как бронировать" },
  { href: "#faq", label: "Частые вопросы" }
];

/**
 * Лендинг — серверный компонент. Загружаем залы напрямую из БД,
 * чтобы секция «Наши залы» всегда была актуальной.
 *
 * force-dynamic: на Vercel страница не при prerender'e обращается к БД,
 * данные залов отдаются при каждом запросе (свежие правки из админки).
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const halls = await prisma.hall.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      photoUrl: true
    }
  });

  return (
    <main className="bg-ink-950">
      {/* ============================= Header ============================= */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/80 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between gap-6">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Logo light />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-white/65 transition-colors hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <Link
            href="/booking"
            className="btn-invert h-9 !rounded-lg px-4 text-sm sm:h-10 sm:px-5"
          >
            Забронировать
          </Link>
        </div>
      </header>

      {/* ============================== Hero ============================== */}
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-hero-grid" />
          <div
            className="absolute -top-40 left-1/2 h-[560px] w-[860px] -translate-x-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(105,65,232,0.32), rgba(105,65,232,0.08) 55%, transparent 100%)"
            }}
          />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-brand-600/10 blur-3xl" />
          <div
            className="absolute inset-x-0 bottom-0 h-24"
            style={{
              background:
                "linear-gradient(to top, rgba(255,255,255,0.035), transparent)"
            }}
          />
        </div>

        <div className="container-page relative pb-20 pt-16 sm:pt-24 lg:pb-28">
          <div className="mb-10 animate-fade-in-up">
            <Link
              href="/"
              className="group inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 py-1.5 pl-2 pr-5 backdrop-blur transition-colors hover:border-brand-500/40 hover:bg-white/10"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm transition-transform group-hover:scale-105">
                <IconCamera width={13} height={13} className="text-white" strokeWidth={2} />
              </span>
              <span className="text-sm font-semibold tracking-tight text-white">
                Vibe Studio
              </span>
            </Link>
          </div>
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div
                className="inline-flex animate-fade-in-up items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur"
                style={{ animationDelay: "40ms" }}
              >
                <span className="flex h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse-soft" />
                Онлайн-бронирование · Telegram-бот · 24/7
              </div>

              <h1
                className="mt-6 animate-fade-in-up text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
                style={{ animationDelay: "100ms" }}
              >
                Студия, где кадры
                <br className="hidden sm:block" />{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 via-brand-400 to-brand-500">
                  превращаются
                </span>{" "}
                в истории
              </h1>

              <p
                className="mt-6 max-w-xl animate-fade-in-up text-base leading-relaxed text-white/60 sm:text-lg"
                style={{ animationDelay: "160ms" }}
              >
                Пространство для фото- и видеосъёмок с продуманным светом,
                декором и оборудованием. Выбирайте зал, услугу и удобное время
                — без звонков и согласований.
              </p>

              <div
                className="mt-9 flex animate-fade-in-up flex-col gap-3 sm:flex-row"
                style={{ animationDelay: "220ms" }}
              >
                <Link href="/booking" className="btn-lg btn-primary">
                  Выбрать зал и время
                  <IconArrowRight width={18} height={18} />
                </Link>
                <a
                  href={BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-lg btn-outline-light"
                >
                  <IconBot width={18} height={18} />
                  Забронировать в Telegram
                </a>
              </div>

              <dl
                className="mt-14 grid animate-fade-in-up grid-cols-3 gap-6 border-t border-white/10 pt-8"
                style={{ animationDelay: "300ms" }}
              >
                <HeroStat
                  value={halls.length > 0 ? String(halls.length) : "—"}
                  label="пространства студии"
                />
                <HeroStat value="2 мин" label="от выбора до брони" />
                <HeroStat value="24/7" label="онлайн-запись" />
              </dl>
            </div>

            {/* Продуктовый мокап */}
            <div
              className="relative animate-fade-in-up"
              style={{ animationDelay: "260ms" }}
            >
              <div className="pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-brand-600/10 blur-2xl" />
              <AppMock hallsCount={halls.length} />
            </div>
          </div>
        </div>
      </section>

      {/* ============================= Halls ============================= */}
      <section id="halls" className="scroll-mt-20 bg-white/[0.02] py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading
            eyebrow="Пространства"
            title="Три настроения для вашей съёмки"
            description="Подберите зал под задачу — от камерных портретов до рекламных съёмок. Всё пространство уже готово к работе."
            align="left"
          />

          {halls.length === 0 ? (
            <div className="empty mt-12">
              <IconCamera width={28} height={28} className="text-stone-400" />
              <p className="mt-3 text-sm text-stone-500">
                Студия готовится к открытию — залы появятся совсем скоро
              </p>
            </div>
          ) : (
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {halls.map((hall, i) => (
                <article
                  key={hall.id}
                  className={`group relative overflow-hidden rounded-2xl shadow-soft transition-all duration-300 hover:shadow-lift ${
                    i === 0
                      ? "md:col-span-2 lg:col-span-1"
                      : ""
                  }`}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    {hall.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hall.photoUrl}
                        alt={hall.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <HallPlaceholder name={hall.name} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/20 to-transparent" />
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <h3 className="text-xl font-semibold text-white">
                      {hall.name}
                    </h3>
                    {hall.description && (
                      <p className="mt-1.5 line-clamp-2 max-w-md text-sm leading-relaxed text-white/70">
                        {hall.description}
                      </p>
                    )}
                    <Link
                      href="/booking"
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-white transition-colors hover:text-brand-200"
                    >
                      Забронировать
                      <IconArrowRight
                        width={16}
                        height={16}
                        className="transition-transform duration-200 group-hover:translate-x-0.5"
                      />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* =========================== Features ============================ */}
      <section id="features" className="scroll-mt-20 py-20 sm:py-28">
        <div className="container-page">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <SectionHeading
                eyebrow="Возможности"
                title="Всё, что нужно для съёмки, уже внутри"
                description="Мы вложили в студию то, что обычно приходится собирать по кусочкам. Осталось только приехать и снимать."
                align="left"
              />
              <Link href="/booking" className="btn-primary mt-8">
                Проверить свободные слоты
                <IconCalendar width={18} height={18} />
              </Link>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FeatureItem
                icon={<IconCalendarCheck />}
                title="Онлайн-бронирование"
                text="Зал, услуга и время — за пару минут. Слот закрепляется мгновенно."
              />
              <FeatureItem
                icon={<IconBot />}
                title="Telegram-бот"
                text="Запись и история ваших визитов в удобном чате, без приложений."
              />
              <FeatureItem
                icon={<IconGrid />}
                title="Разные залы"
                text="Лофт, минимализм, циклорама — под каждый сценарий съёмки."
              />
              <FeatureItem
                icon={<IconZap />}
                title="Мгновенное подтверждение"
                text="Никаких «перезвоните позже»: бронь активна сразу после отправки."
              />
              <FeatureItem
                icon={<IconSparkle />}
                title="Продуманный свет и декор"
                text="Профессиональное оборудование, аксессуары и готовые фоны."
              />
              <FeatureItem
                icon={<IconWallet />}
                title="Прозрачные цены"
                text="Стоимость услуги видна до подтверждения — без скрытых платежей."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ========================== How it works ========================= */}
      <section id="how" className="scroll-mt-20 bg-white/[0.02] py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading
            eyebrow="Как это работает"
            title="От идеи до брони — три шага"
            description="Процесс продуман так, чтобы с ним справился каждый, даже на телефоне."
          />

          <ol className="relative mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-3">
            <div className="absolute left-[16.66%] right-[16.66%] top-7 hidden border-t border-dashed border-stone-300 sm:block" />
            <StepCard
              number="01"
              title="Выберите зал"
              text="Посмотрите пространства студии и их услуги — всё с наглядными описаниями."
            />
            <StepCard
              number="02"
              title="Найдите время"
              text="Календарь покажет только свободные слоты на нужную дату."
            />
            <StepCard
              number="03"
              title="Подтвердите бронь"
              text="Оставьте контакт — и запись мгновенно появляется в Telegram-боте."
            />
          </ol>
        </div>
      </section>

      {/* ========================= Testimonials ========================== */}
      <section className="bg-ink-950 py-20 text-white sm:py-28">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium uppercase tracking-widest text-brand-300">
              Отзывы
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Что говорят те, кто уже снимал
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            <Testimonial
              quote="Бронирование заняло две минуты. Приехали — свет уже настроен, декор на месте. Лучший опыт за все годы съёмок в городе."
              name="Анна К."
              role="Свадебный фотограф"
              initials="АК"
            />
            <Testimonial
              quote="Telegram-бот — это отдельная любовь. Записи, напоминания, история визитов. Ничего не теряется и не забывается."
              name="Тимур Р."
              role="Коммерческие съёмки"
              initials="ТР"
            />
            <Testimonial
              quote="Циклорама — то, что нужно для рекламы. Клиенты приезжают, снимают и уезжают довольными. Заполняемость это подтверждает."
              name="Малика С."
              role="Продакшн-студия"
              initials="МС"
            />
          </div>
        </div>
      </section>

      {/* ============================== FAQ ============================== */}
      <section id="faq" className="scroll-mt-20 bg-white/[0.02] py-20 sm:py-28">
        <div className="container-page">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div>
              <SectionHeading
                eyebrow="FAQ"
                title="Частые вопросы"
                description="Не нашли ответ — напишите нам в Telegram, отвечаем быстро."
                align="left"
              />
              <a
                href={BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary mt-8"
              >
                <IconSend width={18} height={18} />
                Написать в Telegram
              </a>
            </div>

            <div className="divide-y divide-ink-800 rounded-2xl border border-ink-800 bg-ink-900 shadow-soft">
              <FaqItem
                question="Можно ли перенести или отменить бронь?"
                answer="Да. Отменить или перенести запись можно напрямую в Telegram-боте внутри 48 часов от даты съёмки. Для экстренных случаев есть контакты студии."
              />
              <FaqItem
                question="Что входит в аренду зала?"
                answer="Студийный свет и оборудование, базовый декор, фон и рабочая зона для ретуши. Конкретный состав зависит от выбранной услуги — он описан при бронировании."
              />
              <FaqItem
                question="Как далеко вперёд можно забронировать?"
                answer="Календарь открыт на 90 дней. Слоты появляются по расписанию зала и исчезают сразу после подтверждения брони."
              />
              <FaqItem
                question="Нужна ли предоплата?"
                answer="Нет. Бронь фиксируется бесплатно по имени и телефону. Оплата — на месте любым удобным способом."
              />
              <FaqItem
                question="Работаете ли вы с незнакомыми с телефона фотографами?"
                answer="Конечно. Мы принимаем всех: от любителей до профессионалов. В Telegram-боте можно посмотреть расписание и записаться на любую услугу."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============================ CTA ================================ */}
      <section className="relative overflow-hidden bg-ink-950 py-20 text-white sm:py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-hero-grid" />
          <div
            className="absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(105,65,232,0.28), transparent 70%)"
            }}
          />
        </div>

        <div className="container-page relative mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Готовы к съёмке?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
            Выберите зал и время прямо сейчас — бронь подтвердится мгновенно,
            а напоминание придёт в Telegram.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/booking" className="btn-lg btn-primary">
              Забронировать студию
              <IconArrowRight width={18} height={18} />
            </Link>
            <a
              href={BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-lg btn-outline-light"
            >
              <IconBot width={18} height={18} />
              Открыть Telegram-бот
            </a>
          </div>
        </div>
      </section>

      {/* ============================ Footer ============================= */}
      <footer className="border-t border-white/10 bg-ink-950 text-white">
        <div className="container-page py-14">
          <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
            <div>
              <Logo light />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/50">
                Фото- и видеостудия с онлайн-бронированием. Современные залы,
                продуманный свет и сервис уровня, к которому привыкаешь.
              </p>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-white/40">
                Навигация
              </div>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><a href="#halls" className="text-white/60 transition-colors hover:text-white">Залы</a></li>
                <li><a href="#features" className="text-white/60 transition-colors hover:text-white">Возможности</a></li>
                <li><a href="#how" className="text-white/60 transition-colors hover:text-white">Как бронировать</a></li>
                <li><Link href="/booking" className="text-white/60 transition-colors hover:text-white">Онлайн-бронирование</Link></li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-white/40">
                Контакты
              </div>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <a href="tel:+998901234567" className="inline-flex items-center gap-2.5 text-white/60 transition-colors hover:text-white">
                    <IconPhone width={16} height={16} /> +998 (90) 123-45-67
                  </a>
                </li>
                <li>
                  <a href="mailto:hello@vibestudio.uz" className="inline-flex items-center gap-2.5 text-white/60 transition-colors hover:text-white">
                    <IconMail width={16} height={16} /> hello@vibestudio.uz
                  </a>
                </li>
                <li>
                  <a
                    href={BOT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 text-white/60 transition-colors hover:text-white"
                  >
                    <IconBot width={16} height={16} />
                    {BOT_USERNAME ? `@${BOT_USERNAME}` : "Telegram-бот"}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row">
            <p className="text-xs text-white/35">
              © {new Date().getFullYear()} Vibe Studio. Все права защищены.
            </p>
            <p className="flex items-center gap-2 text-xs text-white/35">
              г. Ташкент · ежедневно с 10:00 до 22:00
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* =========================================================================
 * Компоненты
 * ========================================================================= */

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {value}
      </dt>
      <dd className="mt-1 text-xs text-white/50 sm:text-sm">{label}</dd>
    </div>
  );
}

function AppMock({ hallsCount }: { hallsCount: number }) {
  const slots = ["10:00", "11:00", "12:00", "13:00", "14:00"];
  return (
    <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-lift backdrop-blur-xl sm:p-5">
      {/* Заголовок карточки */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/20 text-brand-200">
            <IconCamera width={18} height={18} />
          </span>
          <div>
            <div className="text-sm font-semibold text-white">Съёмка в студии</div>
            <div className="text-xs text-white/45">Зал «Лофт» · Портрет</div>
          </div>
        </div>
        <span className="pill border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Слот свободен
        </span>
      </div>

      {/* Мини-календарь */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-white/45">
          <span>Август 2026</span>
          <span className="flex gap-3">
            <span>‹</span>
            <span>›</span>
          </span>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] text-white/40">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              className={`flex aspect-square items-center justify-center rounded-md ${
                i === 5
                  ? "bg-brand-500 font-medium text-white"
                  : i === 6
                  ? "text-white/80"
                  : "text-white/35"
              }`}
            >
              {i + 1}
            </span>
          ))}
        </div>
      </div>

      {/* Время */}
      <div className="mt-4">
        <div className="text-xs text-white/45">Свободное время</div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {slots.map((t, i) => (
            <span
              key={t}
              className={`flex h-9 items-center justify-center rounded-lg text-xs font-medium ${
                i === 2
                  ? "bg-brand-500 text-white shadow-glow"
                  : "border border-white/10 bg-white/[0.04] text-white/60"
              }`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Итог */}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <div>
          <div className="text-xs text-white/45">Итого</div>
          <div className="text-sm font-semibold text-white">
            420 000{" "}
            <span className="text-xs font-normal text-white/45">сум</span>
          </div>
        </div>
        <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 text-xs font-medium text-white">
          <IconCheck width={14} height={14} strokeWidth={2.5} />
          Подтвердить
        </span>
      </div>

      {/* Плавающие бейджи */}
      <div className="absolute -right-3 -top-3 hidden animate-fade-in-up items-center gap-2 rounded-xl border border-white/10 bg-ink-800/90 px-3 py-2 shadow-lift backdrop-blur sm:flex" style={{ animationDelay: "420ms" }}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
          <IconCheck width={13} height={13} strokeWidth={2.5} />
        </span>
        <span className="text-xs font-medium text-white">Бронь подтверждена</span>
      </div>
      <div className="absolute -bottom-4 -left-3 hidden animate-fade-in-up items-center gap-2 rounded-xl border border-white/10 bg-ink-800/90 px-3 py-2 shadow-lift backdrop-blur sm:flex" style={{ animationDelay: "520ms" }}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20 text-brand-200">
          <IconBot width={13} height={13} />
        </span>
        <span className="text-xs font-medium text-white">
          {hallsCount > 0 ? "Напоминание в Telegram" : "Запись через Telegram"}
        </span>
      </div>
    </div>
  );
}

function HallPlaceholder({ name }: { name: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950">
      <div className="flex flex-col items-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/80">
          <IconCamera width={24} height={24} />
        </span>
        <span className="mt-3 text-xs font-medium uppercase tracking-widest text-white/35">
          {initialsOf(name)}
        </span>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center"
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  const isCenter = align === "center";
  return (
    <div className={isCenter ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <div
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-300 ${
          isCenter ? "mx-auto" : ""
        }`}
      >
        <span className="h-1 w-1 rounded-full bg-brand-500" />
        {eyebrow}
      </div>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-stone-500">
          {description}
        </p>
      )}
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  text
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="group rounded-2xl border border-ink-800 bg-ink-900 p-6 shadow-soft transition-all duration-200 hover:border-brand-500/40 hover:shadow-lift">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300 transition-colors duration-200 group-hover:bg-brand-600 group-hover:text-white">
        {icon}
      </span>
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{text}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  text
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <li className="relative flex flex-col items-center rounded-2xl border border-ink-800 bg-ink-900 px-6 py-8 text-center shadow-soft">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white shadow-glow">
        {number}
      </span>
      <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-stone-500">{text}</p>
    </li>
  );
}

function Testimonial({
  quote,
  name,
  role,
  initials
}: {
  quote: string;
  name: string;
  role: string;
  initials: string;
}) {
  return (
    <figure className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur transition-colors duration-200 hover:border-white/20">
      <div className="flex gap-1 text-amber-300/90">
        {Array.from({ length: 5 }).map((_, i) => (
          <IconStar key={i} width={15} height={15} />
        ))}
      </div>
      <IconQuote width={26} height={26} className="mt-5 text-brand-400/70" />
      <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-white/80">
        {quote}
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white">
          {initials}
        </span>
        <div>
          <div className="text-sm font-medium text-white">{name}</div>
          <div className="text-xs text-white/45">{role}</div>
        </div>
      </figcaption>
    </figure>
  );
}

function FaqItem({
  question,
  answer
}: {
  question: string;
  answer: string;
}) {
  return (
    <details className="group px-6 py-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[15px] font-medium text-white [&::-webkit-details-marker]:hidden">
        {question}
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-ink-700 text-stone-400 transition-transform duration-200 group-open:rotate-180 group-open:text-brand-400">
          <IconChevronDown width={16} height={16} />
        </span>
      </summary>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-500">
        {answer}
      </p>
    </details>
  );
}
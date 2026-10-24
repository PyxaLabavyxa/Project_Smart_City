import type { ZhorikPose } from "@/shared/ui/zhorik";

type TourStep = {
  href: string; target: string; title: string; text: string;
  pose: ZhorikPose; guide?: "hanging" | "inset"; side?: "right";
  include?: readonly string[]; attached?: boolean; overlapGuide?: boolean; normalHint?: boolean; scrollAnchor?: string; reserveNavigation?: boolean; wholeItems?: string;
};

export const tourSteps: readonly TourStep[] = [
  {
    href: "/",
    target: "home-overview",
    reserveNavigation: false,
    include: ['[data-tour="home-health"]'],
    attached: true,
    pose: "peek",
    title: "Ваш дом — рядом",
    text: "Привет! Я Жорик. Здесь можно переключаться между своими квартирами. На главной — состояние дома, активные обращения и запланированные работы."
  },
  {
    href: "/plan",
    target: "plan-map",
    attached: true,
    overlapGuide: true,
    pose: "point",
    side: "right",
    title: "Дом на плане",
    text: "Выберите этаж и нажмите на помещение: увидите обращения в общих зонах или сможете написать соседу. Значок △ отмечает активную проблему."
  },
  {
    href: "/issues",
    target: "report-issue",
    scrollAnchor: '[data-tour="issues-heading"]',
    attached: true,
    pose: "hanging",
    guide: "hanging",
    title: "Сообщить о проблеме",
    text: "Что-то сломалось? Нажмите «Создать обращение», укажите место, опишите проблему и добавьте фото. Обращение получит управляющая компания."
  },
  {
    href: "/issues",
    target: "issue-overview",
    scrollAnchor: '[data-tour="issues-heading"]',
    include: ['[data-tour="issues-heading"]'],
    wholeItems: '[data-tour="issue-list"] > li',
    normalHint: true,
    reserveNavigation: false,
    attached: true,
    pose: "peek",
    title: "Следите за обращениями",
    text: "Во вкладке «Мои» — ваши обращения со статусами и ответами УК. Во вкладке «Все» — обращения дома. Найти нужное помогут поиск и фильтры."
  },
  {
    href: "/cameras",
    target: "camera-overview",
    normalHint: true,
    include: ['[data-tour="camera-card"]'],
    attached: true,
    pose: "peek",
    title: "Камеры дома и ваша камера",
    text: "Смотрите камеры дома или подключите свою кнопкой «Добавить». Личная камера видна только вам, общая — соседям после одобрения УК."
  },
  {
    href: "/utilities",
    target: "utility-navigation",
    normalHint: true,
    include: ['[data-tour="utility-charges"]'],
    attached: true,
    pose: "point",
    side: "right",
    title: "Начисления и показания",
    text: "В «Квитанциях» — начисления за выбранный месяц. В «Показаниях» можно передать значения счётчиков. Всё относится к выбранной квартире."
  },
  {
    href: "/messages",
    target: "message-header",
    include: ['[data-tour="house-group-chat"]'],
    normalHint: true,
    attached: true,
    pose: "peek",
    title: "На связи с соседями",
    text: "Нажмите «+», чтобы выбрать квартиру и написать соседу без обмена телефонами. Если к дому подключён чат MAX, переход в него тоже будет здесь."
  },
  {
    href: "/contacts",
    target: "management-contacts",
    include: ['[data-tour="management-info"] > :nth-child(3)'],
    normalHint: true,
    attached: true,
    pose: "peek",
    title: "УК — на связи",
    text: "Здесь — связь с УК, диспетчерская и часы приёма. Ниже — аварийная служба. Раздел доступен в «Ещё»."
  },
  {
    href: "/more",
    target: "invite-neighbors",
    pose: "hanging",
    guide: "hanging",
    title: "Пригласите соседей",
    text: "Поделитесь ссылкой на свой дом или скачайте листовку с QR-кодом для подъезда. Настройки и повтор обучения тоже доступны в разделе «Ещё»."
  }
];

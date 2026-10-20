import type { ZhorikPose } from "@/shared/ui/zhorik";

type TourStep = {
  href: string; target: string; title: string; text: string;
  pose: ZhorikPose; guide?: "hanging" | "inset"; side?: "right";
};

export const tourSteps: readonly TourStep[] = [
  { href: "/", target: "choose-house", pose: "open", title: "Привет! Я Жорик", text: "Помогу освоиться в Домоведе. Начнём с адреса: здесь можно выбрать одну из ваших квартир." },
  { href: "/issues", target: "report-issue", pose: "hanging", guide: "hanging", title: "Создать обращение", text: "Кнопка внизу открывает создание обращения. Начните с выбора места." },
  { href: "/issues", target: "issue-controls", pose: "point", title: "Обращения: статусы и поиск", text: "Переключайте активные и решённые обращения. В фильтрах можно искать по тексту, категории, подъезду и этажу или оставить только свои." },
  { href: "/issues", target: "issue-location", pose: "peek", guide: "inset", title: "Место проблемы", text: "Выберите подъезд, двор или квартиру. Для подъезда уточните зону на плане, затем — подкатегорию." },
  { href: "/plan", target: "plan-selection", pose: "point", side: "right", title: "Выберите этаж или квартиру", text: "Выберите подъезд и этаж. Или введите номер квартиры и нажмите «Найти»." },
  { href: "/plan", target: "plan-map", pose: "point", side: "right", title: "Помещения на плане", text: "Нажмите на квартиру, лифт или холл, чтобы увидеть обращения. Значок △ отмечает активную проблему." },
  { href: "/plan", target: "plan-room", pose: "rest", title: "Действия с квартирой", text: "Нажмите на квартиру. В её карточке — обращения, связь с соседями и кнопка сообщения о проблеме." },
  { href: "/messages", target: "message-panel", pose: "open", title: "Написать соседу", text: "Здесь ваши переписки. Нажмите «Написать» и выберите квартиру. Телефоны и личные контакты соседей скрыты." },
  { href: "/utilities", target: "utility-bill", pose: "point", side: "right", title: "Проверить квитанцию", text: "Здесь сумма к оплате, ниже — начисления по услугам. Проверьте период и срок." },
  { href: "/utilities", target: "meter-reading", pose: "point", side: "right", title: "Передать показания", text: "Введите новые показания счётчиков и нажмите «Передать показания». Значения не должны быть меньше предыдущих." },
  { href: "/cameras", target: "camera-card", pose: "peek", side: "right", title: "Открыть камеру", text: "Нажмите на карточку, чтобы рассмотреть кадр из подъезда или двора. Рядом указано состояние камеры." },
  { href: "camera", target: "camera-report", pose: "hanging", guide: "hanging", title: "Проблема в кадре?", text: "Эта кнопка откроет обращение. Место камеры подставится само." },
  { href: "/health", target: "health-overview", pose: "rest", title: "Состояние дома", text: "Здесь оценка здоровья дома. Ниже — история на графике и состояние систем. Оценка зависит от обращений жителей." },
  { href: "/more", target: "replay-tour", pose: "open", title: "Вернуться к подсказкам", text: "Обучение всегда можно повторить этой кнопкой. Здесь же находятся план, переписки и информация о доме. Готово!" },
];

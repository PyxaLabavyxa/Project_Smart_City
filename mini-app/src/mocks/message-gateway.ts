import type { MessageGateway, Message } from "@/entities/message";
import { validLocation, type House } from "@/entities/house";
export const demoMessages: readonly Message[] = [
  { id: "message-1", apartment: 69, text: "Здравствуйте! У вас тоже слабый напор воды?", direction: "incoming", createdAt: "2026-09-23T10:10:00+03:00" },
  { id: "message-2", apartment: 69, text: "Да, уже создали обращение.", direction: "outgoing", createdAt: "2026-09-23T10:12:00+03:00" },
  { id: "message-3", apartment: 69, text: "Спасибо! Теперь напор нормальный, проверили на кухне.", direction: "incoming", createdAt: "2026-09-24T09:15:00+03:00" },
  { id: "message-4", apartment: 70, text: "Добрый день! В субботу ненадолго перекроем воду для замены крана. Вам удобно с 11 до 12?", direction: "incoming", createdAt: "2026-09-25T18:30:00+03:00" },
  { id: "message-5", apartment: 70, text: "Да, спасибо, что предупредили.", direction: "outgoing", createdAt: "2026-09-25T18:42:00+03:00" },
  { id: "message-6", apartment: 72, text: "Здравствуйте! Нашли ключ у лифта на нашем этаже. Если ваш — напишите, пожалуйста.", direction: "incoming", createdAt: "2026-09-26T12:05:00+03:00" },
];
export const createMockMessageGateway = (house: House): MessageGateway => ({
  async send(place, text, requestId) {
    if (!validLocation(house, place) || place.zone !== "apartment" || place.apartment === house.residentApartment || !text.trim() || text.length > 2000) throw new Error("Выберите другую квартиру и введите сообщение.");
    await new Promise(resolve => setTimeout(resolve, 250));
    return { id: requestId, apartment: place.apartment, text: text.trim(), direction: "outgoing", createdAt: new Date().toISOString() };
  },
});

import type { MessageGateway, Message } from "@/entities/message";
import { validLocation, demoHouse, type House } from "@/entities/house";
export const demoMessages: readonly Message[] = [
  { id: "message-1", apartment: 69, text: "Здравствуйте! У вас тоже слабый напор воды?", direction: "incoming", createdAt: "2026-09-23T10:10:00+03:00" },
  { id: "message-2", apartment: 69, text: "Да, уже создали обращение.", direction: "outgoing", createdAt: "2026-09-23T10:12:00+03:00" },
];
export const createMockMessageGateway = (house: House): MessageGateway => ({
  async send(place, text, requestId) {
    if (!validLocation(house, place) || place.zone !== "apartment" || place.apartment === house.residentApartment || !text.trim() || text.length > 2000) throw new Error("Выберите другую квартиру и введите сообщение.");
    await new Promise(resolve => setTimeout(resolve, 250));
    return { id: requestId, apartment: place.apartment, text: text.trim(), direction: "outgoing", createdAt: new Date().toISOString() };
  },
});
export const mockMessageGateway = createMockMessageGateway(demoHouse);

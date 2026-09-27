import type { HouseLocation } from "@/entities/house";
export type Message = { id: string; apartment: number; text: string; direction: "incoming" | "outgoing"; createdAt: string };
export interface MessageGateway { send(place: HouseLocation, text: string, requestId: string): Promise<Message> }

import type { HouseLocation } from "@/entities/house";
export type Message = { id: string; apartment: number; text: string; direction: "incoming" | "outgoing"; createdAt: string };
export interface MessageGateway { list?(signal?: AbortSignal): Promise<readonly Message[]>; send(place: HouseLocation, text: string, requestId: string): Promise<Message> }

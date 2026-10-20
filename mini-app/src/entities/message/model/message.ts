import type { ChatPhoto, ChatDraftPhoto } from "@/shared/api/chat-photos";
import type { HouseLocation } from "@/entities/house";
export type Message = { id: string; apartment: number; text: string; photos?: readonly ChatPhoto[]; direction: "incoming" | "outgoing"; createdAt: string };
export interface MessageGateway { list?(signal?: AbortSignal): Promise<readonly Message[]>; send(place: HouseLocation, text: string, requestId: string, photos?: readonly ChatDraftPhoto[]): Promise<Message> }

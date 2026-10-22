"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { conversationHref } from "@/shared/api/conversation-route";
import { findApartment, PlaceLink, useHouseSelection, type HouseLocation } from "@/entities/house";
import { useMessages } from "@/entities/message";
import { Icon } from "@/shared/ui/icon";
import { RequestState } from "@/shared/ui/navigation/request-state";
import { Conversation } from "./conversation";
import { ChatScreen } from "@/shared/ui/chat-screen";
import styles from "@/shared/ui/chat-screen.module.css";

export function ApartmentChat({ apartment }: { apartment: number }) {
  const { house } = useHouseSelection();
  const router = useRouter();
  const search = useSearchParams();
  const href = conversationHref(apartment, house.residentApartmentId);
  useEffect(() => { if (!search.has("from")) router.replace(href, { scroll: false }); }, [href, router, search]);
  const { loading, error, reload } = useMessages();
  const place = findApartment(house, apartment);
  const own = apartment === house.residentApartment;
  const fallback: HouseLocation & { zone: "apartment" } = { houseId: house.id, entrance: 1, floor: 1, zone: "apartment", apartment };
  return <ChatScreen title={`Квартира ${apartment}`} subtitle={`${house.address} · ${place ? `Подъезд ${place.entrance} · этаж ${place.floor}` : "Нет в структуре дома"}`} avatar={apartment} backHref={`/messages?from=${house.residentApartmentId}`} backLabel="Назад к перепискам" action={place && <PlaceLink place={place} returnTo={href} className={styles.plan}>На плане <Icon name="plan" size={19} /></PlaceLink>}>
    <RequestState loading={loading} error={error} reload={reload} />
    <Conversation place={place?.zone === "apartment" ? place : fallback} readOnly={own ? "Это ваша квартира. Выберите другую квартиру в списке переписок." : !place ? "Квартира удалена из структуры дома. Переписка сохранена, отправка недоступна." : undefined} />
  </ChatScreen>;
}

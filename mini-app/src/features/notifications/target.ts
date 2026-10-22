type Choice = { id: number; houseId: string };

export function notificationApartment<T extends Choice>(choices: readonly T[], houseId: string | null, apartmentId: number | null, currentId?: number): T | undefined {
  if (!houseId) return undefined;
  if (apartmentId != null) return choices.find(choice => choice.id === apartmentId && choice.houseId === houseId);
  return choices.find(choice => choice.id === currentId && choice.houseId === houseId) ?? choices.find(choice => choice.houseId === houseId);
}

// A chat link selects only a home already authorized by the resident profile.
export function launchApartmentId(apartments: readonly { id: number; houseId: string }[], houseId?: string): number | undefined {
  return (houseId ? apartments.find(apartment => apartment.houseId === houseId) : apartments[0])?.id;
}

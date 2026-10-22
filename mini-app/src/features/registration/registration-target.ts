type Company = { id: number; houses: { id: number; address: string }[] };

export function registrationTarget(companies: Company[], houseId?: string) {
  if (houseId) {
    for (const company of companies) {
      const house = company.houses.find(item => String(item.id) === houseId);
      if (house) return { companyId: company.id, houseId: house.id, address: house.address };
    }
    return undefined;
  }
  return { companyId: companies[0]?.id ?? 0, houseId: 0, address: "" };
}

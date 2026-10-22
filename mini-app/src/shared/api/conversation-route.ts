/** `from` is an authorized resident apartment ID, never the neighbour's number. */
export function conversationHref(neighbour: number, ownApartmentId?: number) {
  return `/messages/${neighbour}${ownApartmentId ? `?from=${ownApartmentId}` : ""}`;
}

export function conversationApartment(search: string): number | undefined {
  const values = new URLSearchParams(search).getAll("from");
  if (!values.length) return undefined;
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0]) || !Number.isSafeInteger(Number(values[0]))) return NaN;
  return Number(values[0]);
}

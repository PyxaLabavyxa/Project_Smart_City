import { notFound } from "next/navigation";
import { ApartmentChat } from "@/features/select-recipient";

export default async function Page({ params }: { params: Promise<{ apartment: string }> }) {
  const { apartment } = await params;
  if (!/^[1-9]\d*$/.test(apartment) || !Number.isSafeInteger(Number(apartment))) notFound();
  return <ApartmentChat apartment={Number(apartment)} />;
}

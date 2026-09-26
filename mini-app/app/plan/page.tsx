import { PlanPage } from "@/_pages/plan";
import { demoHouse, parseLocation } from "@/entities/house";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const initialPlace = parseLocation(demoHouse, await searchParams);
  return <PlanPage key={JSON.stringify(initialPlace)} initialPlace={initialPlace} />;
}

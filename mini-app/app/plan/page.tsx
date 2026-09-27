import { PlanPage } from "@/_pages/plan";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <PlanPage key={JSON.stringify(params)} params={params} />;
}

import { IssuesPage } from "@/_pages/issues";
export default async function Page({ searchParams }: { searchParams: Promise<{ category?: string | string[] }> }) {
  const { category } = await searchParams;
  return <IssuesPage key={String(category ?? "")} initialCategory={typeof category === "string" ? category : ""} />;
}

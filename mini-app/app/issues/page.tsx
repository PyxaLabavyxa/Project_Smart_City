import { IssuesPage } from "@/_pages/issues";
import { Suspense } from "react";
import { SectionLoading } from "@/shared/ui/navigation/section-loading";
export default function Page() {
  return <Suspense fallback={<SectionLoading />}><IssuesPage /></Suspense>;
}

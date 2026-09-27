import { SectionPage } from "@/shared/ui/navigation";
import { StructureEditor } from "@/features/configure-house";
export default function Page() {
  return <SectionPage title="Структура дома" description="Подъезды, этажи и нумерация квартир" backHref="/plan" backLabel="К плану дома"><StructureEditor /></SectionPage>;
}

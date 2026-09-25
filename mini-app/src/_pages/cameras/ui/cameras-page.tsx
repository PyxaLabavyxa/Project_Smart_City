import { NavigationLinks, SectionPage } from "@/shared/ui/navigation";
import { demoCameras } from "../model/demo-cameras";

export function CamerasPage() {
  return <SectionPage title="Камеры" description="Общие зоны вашего дома" backHref="/" backLabel="На главную">
    <NavigationLinks label="Камеры общих зон" items={demoCameras.map(camera => ({
      href: `/cameras/${camera.id}`, title: camera.name, description: "Открыть карточку камеры",
    }))} />
  </SectionPage>;
}

export function CameraDetailsPage({ id }: { id: string }) {
  const camera = demoCameras.find(item => item.id === id);
  return <SectionPage title={camera?.name ?? "Камера не найдена"} description={camera ? "ул. Центральная, 18 · камера общей зоны" : "Выберите камеру из списка общих зон."} backHref="/cameras" backLabel="Все камеры">
    {camera && <>
      <p>Расположение камеры можно посмотреть в разделе «План дома».</p>
      <NavigationLinks label="Место камеры" items={[{ href: "/plan", title: "Открыть план дома" }]} />
    </>}
  </SectionPage>;
}

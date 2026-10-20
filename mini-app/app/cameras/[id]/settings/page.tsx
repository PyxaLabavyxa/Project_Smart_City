import { CameraSettingsPage } from "@/_pages/cameras/ui/add-camera";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CameraSettingsPage id={id} />;
}

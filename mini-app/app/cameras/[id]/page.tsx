import { CameraDetailsPage } from "@/_pages/cameras";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CameraDetailsPage id={id} />;
}

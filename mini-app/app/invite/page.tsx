import { InviteNeighbors } from "@/features/invite-neighbors/invite-neighbors";
import { HouseAddress } from "@/widgets/house-address";

export default function InvitePage() {
  return <InviteNeighbors headerContent={<HouseAddress compact showMeta={false} />} />;
}

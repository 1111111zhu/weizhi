import { CmpClientsClient } from "../../clients/page-client";

export const instant = false;

export default function NewClientPage() {
  return <CmpClientsClient formMode="new" />;
}

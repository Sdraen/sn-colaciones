import type { Metadata } from "next";
import { AuthSessionBridge } from "./session-bridge";

export const metadata: Metadata = { title: "Activando acceso" };

export default function ActivateAuthPage() {
  return <AuthSessionBridge />;
}

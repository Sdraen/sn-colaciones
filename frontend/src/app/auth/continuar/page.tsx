import { redirect } from "next/navigation";
import { getCurrentApiUser } from "@/lib/api/server";
import {
  homeByRole,
  isAdministrativeRole,
  mfaPath,
  safeNextPath,
} from "@/lib/auth-flow";

export const dynamic = "force-dynamic";

export default async function ContinueAuthenticationPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [params, user] = await Promise.all([searchParams, getCurrentApiUser()]);
  const requestedPath = safeNextPath(params.next);

  if (!user) {
    redirect(`/login?${new URLSearchParams({ next: requestedPath })}`);
  }

  const destination = requestedPath === "/" ? homeByRole(user.role) : requestedPath;
  if (isAdministrativeRole(user.role) && user.assuranceLevel !== "aal2") {
    redirect(mfaPath(destination));
  }

  redirect(destination);
}

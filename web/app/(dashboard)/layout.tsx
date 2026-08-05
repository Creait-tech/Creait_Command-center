import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <DashboardShell>
      {children}
      <WelcomeTour />
    </DashboardShell>
  );
}

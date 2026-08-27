import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MeetingAgendaProvider } from "@/components/meeting-agendas/agenda-provider";
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
      {/* Puts the org's saved EOS agendas in front of the code defaults before
          anything that can start a meeting renders. Renders no markup. */}
      <MeetingAgendaProvider />
      {children}
      <WelcomeTour />
    </DashboardShell>
  );
}

import { loadAgendaOverrides } from "@/components/meeting-agendas/agenda-source";
import { AgendaHydrator } from "@/components/meeting-agendas/agenda-hydrator";

/**
 * Reads the org's saved meeting agendas on the server and hands them to the
 * browser-side applier. Mounted once in the dashboard layout so every route
 * that can start a meeting has the right agendas without each page knowing
 * that agendas are stored in a table at all.
 *
 * A read failure returns no overrides, which leaves the EOS defaults in force.
 */
export async function MeetingAgendaProvider() {
  const agendas = await loadAgendaOverrides();
  if (agendas.length === 0) return null;
  return <AgendaHydrator agendas={agendas} />;
}

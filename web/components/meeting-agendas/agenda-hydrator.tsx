"use client";

import { applyAgendaOverrides, type MeetingAgenda } from "@/lib/meeting-agendas";

/**
 * Layers the org's saved agendas over the EOS defaults for this browser tab.
 *
 * This exists so the meeting room never had to change. `MEETING_AGENDAS[type]`
 * and `getAgenda(type)` are still the same synchronous lookups they always
 * were; this component is what makes them answer with the org's saved agenda.
 *
 * The apply happens during render rather than in an effect, and this component
 * sits above the page in the dashboard layout, so the overrides are in place
 * before anything that reads an agenda renders — no first paint of the EOS
 * default followed by a swap.
 *
 * Renders nothing. `applyAgendaOverrides` is a no-op on the server by design
 * (module scope there is shared between requests, so one org's agendas must
 * never be written into it), which is safe here because no agenda text reaches
 * the initial HTML — the meeting picker's menu and the meeting dialog both
 * render on interaction.
 */
export function AgendaHydrator({ agendas }: { agendas: MeetingAgenda[] }) {
  applyAgendaOverrides(agendas);
  return null;
}

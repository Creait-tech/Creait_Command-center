/**
 * Regenerate sim/intake-schema.json — the driver's source of truth for
 * question ids, types, options, table rows/columns and allowUnknown.
 *
 * Run from the web/ directory of the repo:
 *   ./node_modules/.bin/tsx ../../../tmp/.../sim/dump-intake-schema.ts
 * (see the header of intake-driver.js for the exact command)
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  INTAKE_QUESTIONS,
  INTAKE_SECTIONS,
  TABLE_ROW_KEY,
  TRANSITION_OBJECTIVES,
  UNKNOWN,
  UNKNOWN_LABEL,
  INTAKE_TITLE,
  INTAKE_COMPLETION,
} from "@/lib/assessment-intake";

const here = dirname(fileURLToPath(import.meta.url));

const out = {
  generatedFrom: "web/lib/assessment-intake.ts",
  title: INTAKE_TITLE,
  completion: INTAKE_COMPLETION,
  unknown: UNKNOWN,
  unknownLabel: UNKNOWN_LABEL,
  tableRowKey: TABLE_ROW_KEY,
  transitionObjectives: TRANSITION_OBJECTIVES,
  sections: INTAKE_SECTIONS,
  questions: INTAKE_QUESTIONS.map((q) => ({
    id: q.id,
    section: q.section,
    type: q.type,
    prompt: q.prompt,
    help: q.help,
    options: q.options,
    columns: q.columns,
    rows: q.rows,
    maxRows: q.maxRows,
    allowUnknown: q.allowUnknown,
    required: q.required,
  })),
};

writeFileSync(join(here, "intake-schema.json"), JSON.stringify(out, null, 1));
console.log("questions", out.questions.length);

/**
 * Static registry of the calibration cases. Each JSON file is a complete
 * engagement plus its answer key (see lib/calibration.ts for the shape and
 * resources/calibration-cases/README.md for how they were made). This module
 * is server-only by convention: the key must never reach the browser before
 * an attempt is submitted, so client components receive caseMaterials(), not
 * the case.
 */

import type { CalibrationCaseFile } from "@/lib/calibration";

import case00_summit_exterior from "./case00-summit-exterior.json";
import case01_reid_comfort_heating_air from "./case01-reid-comfort-heating-air.json";
import case02_brightside_family_dental from "./case02-brightside-family-dental.json";
import case03_northstar_growth_agency from "./case03-northstar-growth-agency.json";
import case04_loomcraft_home_goods from "./case04-loomcraft-home-goods.json";
import case05_okafor_lee_law from "./case05-okafor-lee-law.json";
import case06_delgado_hospitality_group from "./case06-delgado-hospitality-group.json";
import case07_fieldnote_software from "./case07-fieldnote-software.json";
import case08_whitaker_custom_builders from "./case08-whitaker-custom-builders.json";
import case09_meridian_staffing_partners from "./case09-meridian-staffing-partners.json";
import case10_ironpath_fitness from "./case10-ironpath-fitness.json";
import case11_luxe_aesthetics_med_spa from "./case11-luxe-aesthetics-med-spa.json";
import case12_fontaine_freight_solutions from "./case12-fontaine-freight-solutions.json";
import case13_liu_partners_accounting from "./case13-liu-partners-accounting.json";
import case14_greenscape_pros from "./case14-greenscape-pros.json";
import case15_summit_peak_it from "./case15-summit-peak-it.json";
import case16_brooks_realty_collective from "./case16-brooks-realty-collective.json";
import case17_kowalski_precision_machining from "./case17-kowalski-precision-machining.json";
import case18_carter_franchise_holdings from "./case18-carter-franchise-holdings.json";
import case19_marchetti_consulting from "./case19-marchetti-consulting.json";
import case20_verdant_health_coaching from "./case20-verdant-health-coaching.json";

export const CALIBRATION_CASE_FILES: Record<string, CalibrationCaseFile> = {
  "case00-summit-exterior": case00_summit_exterior as unknown as CalibrationCaseFile,
  "case01-reid-comfort-heating-air": case01_reid_comfort_heating_air as unknown as CalibrationCaseFile,
  "case02-brightside-family-dental": case02_brightside_family_dental as unknown as CalibrationCaseFile,
  "case03-northstar-growth-agency": case03_northstar_growth_agency as unknown as CalibrationCaseFile,
  "case04-loomcraft-home-goods": case04_loomcraft_home_goods as unknown as CalibrationCaseFile,
  "case05-okafor-lee-law": case05_okafor_lee_law as unknown as CalibrationCaseFile,
  "case06-delgado-hospitality-group": case06_delgado_hospitality_group as unknown as CalibrationCaseFile,
  "case07-fieldnote-software": case07_fieldnote_software as unknown as CalibrationCaseFile,
  "case08-whitaker-custom-builders": case08_whitaker_custom_builders as unknown as CalibrationCaseFile,
  "case09-meridian-staffing-partners": case09_meridian_staffing_partners as unknown as CalibrationCaseFile,
  "case10-ironpath-fitness": case10_ironpath_fitness as unknown as CalibrationCaseFile,
  "case11-luxe-aesthetics-med-spa": case11_luxe_aesthetics_med_spa as unknown as CalibrationCaseFile,
  "case12-fontaine-freight-solutions": case12_fontaine_freight_solutions as unknown as CalibrationCaseFile,
  "case13-liu-partners-accounting": case13_liu_partners_accounting as unknown as CalibrationCaseFile,
  "case14-greenscape-pros": case14_greenscape_pros as unknown as CalibrationCaseFile,
  "case15-summit-peak-it": case15_summit_peak_it as unknown as CalibrationCaseFile,
  "case16-brooks-realty-collective": case16_brooks_realty_collective as unknown as CalibrationCaseFile,
  "case17-kowalski-precision-machining": case17_kowalski_precision_machining as unknown as CalibrationCaseFile,
  "case18-carter-franchise-holdings": case18_carter_franchise_holdings as unknown as CalibrationCaseFile,
  "case19-marchetti-consulting": case19_marchetti_consulting as unknown as CalibrationCaseFile,
  "case20-verdant-health-coaching": case20_verdant_health_coaching as unknown as CalibrationCaseFile,
};

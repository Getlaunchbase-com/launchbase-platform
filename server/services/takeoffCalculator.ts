/**
 * Takeoff Calculator & NEC Code Lookup
 *
 * Provides electrical calculation tools for the IBEW 134 vertical:
 *   - NEC code search and lookup
 *   - Wire gauge recommendation
 *   - Conduit fill calculation
 *   - Voltage drop calculation
 *   - Material takeoff from IBEW Task Library
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Load reference data
// ---------------------------------------------------------------------------

const CONTRACTS_DIR = path.resolve(__dirname, "../contracts");

let necData: any = null;
let taskLibrary: any = null;

function loadNecData() {
  if (necData) return necData;
  const raw = fs.readFileSync(path.join(CONTRACTS_DIR, "nec_code_data.json"), "utf8");
  necData = JSON.parse(raw);
  return necData;
}

function loadTaskLibrary() {
  if (taskLibrary) return taskLibrary;
  const raw = fs.readFileSync(path.join(CONTRACTS_DIR, "IBEW_LV_TaskLibrary_v1.json"), "utf8");
  taskLibrary = JSON.parse(raw);
  return taskLibrary;
}

// ---------------------------------------------------------------------------
// NEC Code Lookup
// ---------------------------------------------------------------------------

export interface NecResult {
  code: string;
  title: string;
  requirement: string;
  category: string;
}

/**
 * Search NEC codes by keyword query. Returns matching sections.
 */
export function searchNecCode(query: string): NecResult[] {
  const nec = loadNecData();
  const q = query.toLowerCase();
  const results: NecResult[] = [];

  for (const [code, section] of Object.entries(nec.sections) as [string, any][]) {
    const text = `${code} ${section.title} ${section.requirement} ${(section.keywords || []).join(" ")}`.toLowerCase();
    if (text.includes(q)) {
      results.push({
        code,
        title: section.title,
        requirement: section.requirement,
        category: section.category,
      });
    }
  }

  return results.slice(0, 10);
}

/**
 * Direct lookup of a specific NEC section by code.
 */
export function getNecSection(code: string): NecResult | null {
  const nec = loadNecData();
  const section = nec.sections[code];
  if (!section) return null;
  return {
    code,
    title: section.title,
    requirement: section.requirement,
    category: section.category,
  };
}

// ---------------------------------------------------------------------------
// Wire Gauge Calculator
// ---------------------------------------------------------------------------

// Copper resistance in ohms per 1000 ft at 75°C
const WIRE_RESISTANCE: Record<string, number> = {
  "14": 3.14, "12": 1.98, "10": 1.24, "8": 0.778,
  "6": 0.491, "4": 0.308, "3": 0.245, "2": 0.194,
  "1": 0.154, "1/0": 0.122, "2/0": 0.0967,
  "3/0": 0.0766, "4/0": 0.0608,
};

const WIRE_AMPACITY: Record<string, number> = {
  "14": 15, "12": 20, "10": 30, "8": 40,
  "6": 55, "4": 70, "3": 85, "2": 95,
  "1": 110, "1/0": 125, "2/0": 145,
  "3/0": 165, "4/0": 195,
};

const GAUGE_ORDER = ["14", "12", "10", "8", "6", "4", "3", "2", "1", "1/0", "2/0", "3/0", "4/0"];

export interface WireGaugeResult {
  recommendedGauge: string;
  ampacity: number;
  voltageDrop: number;
  voltageDropPercent: number;
  passes3Percent: boolean;
}

/**
 * Recommend wire gauge based on amps, distance (one way, feet), and voltage.
 * Uses NEC 3% voltage drop guideline for branch circuits.
 */
export function calculateWireGauge(
  amps: number,
  distanceFt: number,
  voltage: number,
  maxDropPercent: number = 3,
): WireGaugeResult {
  for (const gauge of GAUGE_ORDER) {
    const ampacity = WIRE_AMPACITY[gauge];
    if (ampacity < amps) continue;

    const resistance = WIRE_RESISTANCE[gauge];
    // VD = 2 × I × R × L / 1000 (for single-phase)
    const vd = (2 * amps * resistance * distanceFt) / 1000;
    const vdPct = (vd / voltage) * 100;

    if (vdPct <= maxDropPercent) {
      return {
        recommendedGauge: `#${gauge} AWG`,
        ampacity,
        voltageDrop: Math.round(vd * 100) / 100,
        voltageDropPercent: Math.round(vdPct * 100) / 100,
        passes3Percent: vdPct <= 3,
      };
    }
  }

  // If nothing qualifies, return largest available
  const largest = GAUGE_ORDER[GAUGE_ORDER.length - 1];
  const res = WIRE_RESISTANCE[largest];
  const vd = (2 * amps * res * distanceFt) / 1000;
  return {
    recommendedGauge: `#${largest} AWG (may need parallel runs)`,
    ampacity: WIRE_AMPACITY[largest],
    voltageDrop: Math.round(vd * 100) / 100,
    voltageDropPercent: Math.round((vd / voltage) * 100 * 100) / 100,
    passes3Percent: false,
  };
}

// ---------------------------------------------------------------------------
// Voltage Drop Calculator
// ---------------------------------------------------------------------------

export interface VoltageDropResult {
  voltageDrop: number;
  voltageDropPercent: number;
  voltageAtLoad: number;
  passes: boolean;
  recommendation: string;
}

/**
 * Calculate voltage drop for a specific wire gauge.
 */
export function calculateVoltageDrop(
  amps: number,
  distanceFt: number,
  gauge: string,
  voltage: number,
): VoltageDropResult {
  const resistance = WIRE_RESISTANCE[gauge];
  if (!resistance) {
    return {
      voltageDrop: 0,
      voltageDropPercent: 0,
      voltageAtLoad: voltage,
      passes: false,
      recommendation: `Unknown wire gauge: ${gauge}`,
    };
  }

  const vd = (2 * amps * resistance * distanceFt) / 1000;
  const vdPct = (vd / voltage) * 100;
  const voltageAtLoad = voltage - vd;
  const passes = vdPct <= 3;

  return {
    voltageDrop: Math.round(vd * 100) / 100,
    voltageDropPercent: Math.round(vdPct * 100) / 100,
    voltageAtLoad: Math.round(voltageAtLoad * 100) / 100,
    passes,
    recommendation: passes
      ? `#${gauge} AWG is acceptable (${vdPct.toFixed(1)}% drop)`
      : `#${gauge} AWG exceeds 3% drop guideline (${vdPct.toFixed(1)}%). Consider upsizing.`,
  };
}

// ---------------------------------------------------------------------------
// Conduit Fill Calculator
// ---------------------------------------------------------------------------

export interface ConduitFillResult {
  conduitSize: string;
  conduitType: string;
  fillPercent: number;
  maxFillPercent: number;
  passes: boolean;
  recommendation: string;
}

/**
 * Calculate conduit fill percentage per NEC Chapter 9.
 */
export function calculateConduitFill(
  conductors: Array<{ gauge: string; count: number }>,
  conduitType: "emt" | "pvc_40" = "emt",
): ConduitFillResult[] {
  const nec = loadNecData();
  const wireAreas = nec.tables.wire_area_sqin.thhn;
  const conduitAreas = nec.tables.conduit_area_sqin[conduitType];

  // Total conductor count for fill percentage rule
  const totalConductors = conductors.reduce((sum, c) => sum + c.count, 0);
  const maxFillPct = totalConductors === 1 ? 53 : totalConductors === 2 ? 31 : 40;

  // Calculate total wire area
  let totalWireArea = 0;
  for (const c of conductors) {
    const area = wireAreas[c.gauge];
    if (!area) continue;
    totalWireArea += area * c.count;
  }

  const results: ConduitFillResult[] = [];
  for (const [size, area] of Object.entries(conduitAreas) as [string, number][]) {
    const fillPct = (totalWireArea / area) * 100;
    const passes = fillPct <= maxFillPct;
    results.push({
      conduitSize: `${size}"`,
      conduitType: conduitType.toUpperCase(),
      fillPercent: Math.round(fillPct * 10) / 10,
      maxFillPercent: maxFillPct,
      passes,
      recommendation: passes
        ? `${size}" ${conduitType.toUpperCase()} is acceptable (${fillPct.toFixed(1)}% fill)`
        : `${size}" ${conduitType.toUpperCase()} exceeds ${maxFillPct}% fill (${fillPct.toFixed(1)}%)`,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Material Takeoff from IBEW Task Library
// ---------------------------------------------------------------------------

export interface TakeoffItem {
  deviceType: string;
  description: string;
  quantity: number;
  laborHours: number;
  materials: Array<{
    code: string;
    quantity: number;
    uom: string;
  }>;
}

export interface TakeoffResult {
  items: TakeoffItem[];
  totalLaborHours: number;
  laborRate: number;
  totalLaborCost: number;
  materialSummary: Record<string, { quantity: number; uom: string }>;
}

/**
 * Estimate materials and labor from IBEW Task Library.
 */
export function estimateTakeoff(
  devices: Array<{ type: string; quantity: number }>,
  laborRate: number = 85,
): TakeoffResult {
  const lib = loadTaskLibrary();
  const canonical = lib.canonical;
  const wasteFactor = lib.defaults?.waste_factor ?? 0.1;

  const items: TakeoffItem[] = [];
  const materialSummary: Record<string, { quantity: number; uom: string }> = {};
  let totalLaborHours = 0;

  for (const device of devices) {
    const entry = canonical[device.type];
    if (!entry) {
      items.push({
        deviceType: device.type,
        description: `Unknown device: ${device.type}`,
        quantity: device.quantity,
        laborHours: 0,
        materials: [],
      });
      continue;
    }

    const task = entry.tasks[0]; // primary task
    if (!task) continue;

    const laborHrs = task.base_hours * device.quantity;
    totalLaborHours += laborHrs;

    const mats = (task.materials || []).map((m: any) => {
      const qty = Math.ceil(m.qty_per_ea * device.quantity * (1 + wasteFactor));
      // Accumulate into summary
      if (!materialSummary[m.material_code]) {
        materialSummary[m.material_code] = { quantity: 0, uom: m.uom };
      }
      materialSummary[m.material_code].quantity += qty;
      return { code: m.material_code, quantity: qty, uom: m.uom };
    });

    items.push({
      deviceType: device.type,
      description: entry.description,
      quantity: device.quantity,
      laborHours: Math.round(laborHrs * 100) / 100,
      materials: mats,
    });
  }

  return {
    items,
    totalLaborHours: Math.round(totalLaborHours * 100) / 100,
    laborRate,
    totalLaborCost: Math.round(totalLaborHours * laborRate * 100) / 100,
    materialSummary,
  };
}

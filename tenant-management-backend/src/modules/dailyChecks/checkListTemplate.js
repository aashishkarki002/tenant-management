/**
 * checklist.templates.js
 *
 * Pure-data factory functions.  Each function returns an array of
 * checkSectionSchema-compatible objects that seed a new DailyChecklist
 * document.  The caller passes a `buildingConfig` object that describes
 * the physical assets of the specific property/block so quantities and
 * item labels are accurate.
 *
 * buildingConfig shape (all fields optional, sane defaults apply):
 * {
 *   blockLabel:           string,   // e.g. "Block A"
 *
 *   // CCTV
 *   cctvCameras:          { label: string, count: number }[],
 *
 *   // ELECTRICAL
 *   electricalFixtures:   { label: string, count: number }[],
 *   // e.g. [{ label: "Staircase Lights – Floor 1", count: 6 }, ...]
 *
 *   // SANITARY
 *   sanitaryFixtures:     { label: string, count: number }[],
 *
 *   // COMMON AREA (any labelled common space)
 *   commonAreas:          string[],
 *   // e.g. ["Lobby", "Rooftop", "Corridor – Floor 2"]
 *
 *   // PARKING
 *   parkingZones:         { key: string, label: string }[],
 *   // e.g. [{ key: "B1", label: "Basement 1" }, { key: "B2", label: "Basement 2" }]
 *
 *   // FIRE
 *   fireExtinguishers:    { label: string, count: number }[],
 *   hydrantPoints:        string[],
 *   // e.g. ["Hydrant – Ground Floor", "Hydrant – Floor 3"]
 *
 *   // WATER TANKS
 *   overheadTanks:        { label: string, capacityLiters: number }[],
 *   firefightingTank:     { label: string, capacityLiters: number } | null,
 *   rainwaterTank:        { label: string, capacityLiters: number } | null,
 *   dailyTank:            { label: string, capacityLiters: number } | null,
 *   septicTanks:          { label: string }[],
 * }
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function item(label, quantity = null) {
  return { label, quantity, isOk: true, notes: "", linkedMaintenanceId: null };
}

function section(sectionKey, sectionLabel, items) {
  return { sectionKey, sectionLabel, items };
}

// ─── CCTV ─────────────────────────────────────────────────────────────────────

export function buildCctvSections(cfg = {}) {
  const cameras = cfg.cctvCameras ?? [
    { label: "Main Entrance Camera", count: 1 },
    { label: "Lobby Camera", count: 2 },
    { label: "Parking Camera", count: 2 },
    { label: "Staircase Camera", count: 1 },
    { label: "Rooftop Camera", count: 1 },
  ];

  const cameraItems = cameras.map((c) =>
    item(`${c.label} – Recording OK`, c.count),
  );
  const systemItems = [
    item("DVR/NVR Powered & Recording"),
    item("Storage / HDD Status (>10 % free)"),
    item("Monitor Display Working"),
    item("Network / PoE Switch Online"),
    item("Backup Power (UPS) Charged"),
    item("Time & Date Stamp Correct"),
  ];

  return [
    section("CCTV_CAMERAS", "CCTV Camera Status", cameraItems),
    section("CCTV_SYSTEM", "CCTV System & Recording", systemItems),
  ];
}

// ─── ELECTRICAL ───────────────────────────────────────────────────────────────

export function buildElectricalSections(cfg = {}) {
  const fixtures = cfg.electricalFixtures ?? [
    { label: "Lobby / Reception Lights", count: 8 },
    { label: "Staircase Lights", count: 12 },
    { label: "Corridor Lights", count: 10 },
    { label: "Basement Lights", count: 6 },
    { label: "Rooftop / Terrace Lights", count: 4 },
    { label: "Emergency Exit Signs", count: 4 },
    { label: "Outdoor / Façade Lights", count: 6 },
  ];

  const bulbItems = fixtures.map((f) =>
    item(`${f.label} (${f.count} nos) – All functional`, f.count),
  );

  const panelItems = [
    item("Main Distribution Board – No Tripped MCBs"),
    item("Sub-Distribution Boards – No Faults"),
    item("Earthing / Grounding Continuity"),
    item("Generator Auto-Transfer Switch – Operational"),
    item("UPS / Inverter Battery – Charged"),
    item("Cable Trays / Conduits – No Exposed Wiring"),
  ];

  return [
    section("ELEC_FIXTURES", "Lighting Fixtures", bulbItems),
    section("ELEC_PANEL", "Electrical Panels & Safety", panelItems),
  ];
}

// ─── SANITARY ─────────────────────────────────────────────────────────────────

export function buildSanitarySections(cfg = {}) {
  const fixtures = cfg.sanitaryFixtures ?? [
    { label: "Common Toilet – Ground Floor", count: 2 },
    { label: "Common Toilet – Each Floor", count: 2 },
    { label: "Staff Toilet", count: 1 },
  ];

  const fixtureItems = fixtures.map((f) =>
    item(`${f.label} – No Leaks / Blockage`, f.count),
  );

  const generalItems = [
    item("Drainage / Floor Drains – Clear & Flowing"),
    item("Main Sewer Line – No Overflow"),
    item("Water Supply Pressure – Normal"),
    item("Tap / Valve Condition – No Drips"),
    item("Toilet Flush – Functioning"),
    item("Hand Wash Basins – No Blockage"),
    item("Cleanliness & Odour – Acceptable"),
  ];

  return [
    section("SANITARY_FIXTURES", "Sanitary Fixtures", fixtureItems),
    section("SANITARY_GENERAL", "Drainage & Plumbing", generalItems),
  ];
}

// ─── COMMON AREA ──────────────────────────────────────────────────────────────

export function buildCommonAreaSections(cfg = {}) {
  const areas = cfg.commonAreas ?? [
    "Lobby",
    "Staircase",
    "Corridors",
    "Rooftop",
  ];

  const areaItems = areas.map((a) =>
    item(`${a} – Lights / Fans / AC Operational`),
  );

  const generalItems = [
    item("Entrance Gate / Main Door – Functioning"),
    item("Elevator – Operational (if applicable)"),
    item("Notice Board / Signage – Updated"),
    item("Cleanliness – Swept & Mopped"),
    item("Waste Bins – Emptied"),
    item("Security Lighting – Working at Night"),
  ];

  return [
    section("COMMON_AREAS", "Common Areas", areaItems),
    section("COMMON_GENERAL", "General Facilities", generalItems),
  ];
}

// ─── PARKING ──────────────────────────────────────────────────────────────────

export function buildParkingSections(cfg = {}) {
  const zones = cfg.parkingZones ?? [
    { key: "BASEMENT_1", label: "Basement 1" },
    { key: "BASEMENT_2", label: "Basement 2" },
  ];

  return zones.map((z) =>
    section(`PARKING_${z.key}`, `Parking – ${z.label}`, [
      item(`${z.label} – All Lights Functional`),
      item(`${z.label} – Ventilation Fans Running`),
      item(`${z.label} – Entry / Exit Barrier Working`),
      item(`${z.label} – Floor Drainage Clear`),
      item(`${z.label} – Fire Extinguisher Mounted & Tagged`),
      item(`${z.label} – Emergency Lighting / Exit Signs Working`),
      item(`${z.label} – CCTV Coverage – No Blind Spots`),
      item(`${z.label} – No Fuel / Oil Leaks`),
      item(`${z.label} – Wheel Chocks / Line Markings Visible`),
    ]),
  );
}

// ─── FIRE MANAGEMENT ──────────────────────────────────────────────────────────

export function buildFireSections(cfg = {}) {
  const extinguishers = cfg.fireExtinguishers ?? [
    { label: "Ground Floor – Lobby", count: 2 },
    { label: "Each Floor – Corridor", count: 1 },
    { label: "Basement Parking", count: 2 },
    { label: "Generator Room", count: 1 },
    { label: "Electrical Room", count: 1 },
  ];

  const extItems = extinguishers.map((e) =>
    item(`${e.label} – Seal Intact, Gauge in Green, Not Expired`, e.count),
  );

  const hydrantPoints = cfg.hydrantPoints ?? [
    "Ground Floor",
    "Floor 3",
    "Floor 6 (Top)",
    "Basement",
  ];

  const hydrantItems = hydrantPoints.map((h) =>
    item(`Hydrant Point – ${h} – Valve Accessible & Not Blocked`),
  );

  const systemItems = [
    item("Fire Alarm Panel – No Fault Indicators"),
    item("Smoke / Heat Detectors – Test Light Green"),
    item("Sprinkler System – Pipes / Heads Intact (No Physical Damage)"),
    item("Firefighting Pump – Primed & Ready"),
    item("Jockey Pump – Running (Pressure Maintenance)"),
    item("Fire Pump Room – Clean & Accessible"),
    item("Emergency Exit Doors – Unlocked & Unobstructed"),
    item("Fire Escape Routes – Clear of Obstructions"),
    item("Break-Glass Units – Undamaged"),
    item("Fire Hose Reels – Wound & Mounted"),
  ];

  return [
    section("FIRE_EXTINGUISHER", "Fire Extinguishers", extItems),
    section("FIRE_HYDRANT", "Hydrant Points", hydrantItems),
    section("FIRE_SYSTEM", "Firefighting System & Alarm", systemItems),
  ];
}

// ─── WATER TANKS ─────────────────────────────────────────────────────────────
//
// Frequency guide that is stored as `checklistType` on the parent document:
//  - Daily:         DAILY_TANK level check, general leak/pump check
//  - Weekly ×2:     Water quality / sanitation check
//  - Monthly:       De-sludging / septic tank inspection
//
// This function builds the *items* — the caller must set the right
// `checklistType` on the DailyChecklist document.

export function buildWaterTankSections(cfg = {}, checklistType = "DAILY") {
  const sections = [];

  // ── Overhead / Rooftop Tank(s) ────────────────────────────────────────────
  const overheadTanks = cfg.overheadTanks ?? [
    { label: "Overhead Tank – Main", capacityLiters: 10000 },
  ];
  const overheadItems = overheadTanks.flatMap((t) => {
    const base = [
      item(`${t.label} (${t.capacityLiters}L) – Minimum 50 % Full`),
      item(`${t.label} – Float Valve / Auto-Fill Working`),
      item(`${t.label} – No Cracks / Leaks on Tank Body`),
      item(`${t.label} – Lid / Cover Secured`),
    ];
    if (checklistType === "WEEKLY_TWICE" || checklistType === "WEEKLY") {
      base.push(
        item(`${t.label} – Water Colour Clear (No Turbidity)`),
        item(`${t.label} – No Algae / Biofilm Growth`),
        item(`${t.label} – Inlet / Outlet Screens Clean`),
      );
    }
    return base;
  });
  sections.push(
    section("WATER_OVERHEAD", "Overhead / Rooftop Tanks", overheadItems),
  );

  // ── Firefighting Reserve Tank ─────────────────────────────────────────────
  const ffTank = cfg.firefightingTank ?? {
    label: "Firefighting Reserve Tank",
    capacityLiters: 25000,
  };
  const ffItems = [
    item(`${ffTank.label} (${ffTank.capacityLiters}L) – 100 % Full (Critical)`),
    item(`${ffTank.label} – No Leaks on Tank / Pipes`),
    item(`${ffTank.label} – Inlet Valve Open`),
    item(`${ffTank.label} – Level Indicator Functioning`),
  ];
  sections.push(
    section("WATER_FIREFIGHTING", "Firefighting Reserve Tank", ffItems),
  );

  // ── Rainwater Harvesting Tank ─────────────────────────────────────────────
  if (cfg.rainwaterTank !== null) {
    const rwt = cfg.rainwaterTank ?? {
      label: "Rainwater Harvesting Tank",
      capacityLiters: 5000,
    };
    const rwtItems = [
      item(`${rwt.label} (${rwt.capacityLiters}L) – Level Check`),
      item(`${rwt.label} – Inlet Filter Screen – Clean & Unblocked`),
      item(`${rwt.label} – Overflow Pipe – Clear`),
      item(`${rwt.label} – First-Flush Diverter – Functional`),
    ];
    if (checklistType === "WEEKLY_TWICE" || checklistType === "WEEKLY") {
      rwtItems.push(
        item(`${rwt.label} – Water Quality – No Odour / Colour`),
        item(`${rwt.label} – Mosquito Prevention – No Stagnation`),
      );
    }
    sections.push(section("WATER_RAINWATER", "Rainwater Harvesting", rwtItems));
  }

  // ── Daily / Ground-Level Storage Tank ────────────────────────────────────
  const dailyTank = cfg.dailyTank ?? {
    label: "Daily Storage / Sump Tank",
    capacityLiters: 8000,
  };
  const dtItems = [
    item(`${dailyTank.label} (${dailyTank.capacityLiters}L) – Adequate Level`),
    item(`${dailyTank.label} – Transfer Pump Running Normally`),
    item(`${dailyTank.label} – No Unusual Noise from Pump`),
    item(`${dailyTank.label} – No Leaks / Sweating on Tank`),
    item(`${dailyTank.label} – Pump Auto-Start / Float Switch Working`),
  ];
  sections.push(section("WATER_DAILY_TANK", "Daily / Sump Tank", dtItems));

  // ── Septic Tank (monthly de-sludging check) ───────────────────────────────
  const septicTanks = cfg.septicTanks ?? [{ label: "Septic Tank – Main" }];
  if (checklistType === "MONTHLY") {
    const septicItems = septicTanks.flatMap((st) => [
      item(`${st.label} – Sludge Level Assessed by Licensed Operator`),
      item(`${st.label} – De-sludging / Emptying Completed if Required`),
      item(`${st.label} – No Ground Seepage / Wet Patches Nearby`),
      item(`${st.label} – Ventilation Pipe Clear & Unblocked`),
      item(`${st.label} – Access Covers Secured After Inspection`),
      item(`${st.label} – Odour Treatment Applied`),
    ]);
    sections.push(
      section("WATER_SEPTIC", "Septic Tank – Monthly De-sludging", septicItems),
    );
  } else {
    // Even on daily/weekly runs, do a basic visual check
    const septicItems = septicTanks.map((st) =>
      item(`${st.label} – No Overflow / Wet Patch Around Tank`),
    );
    sections.push(
      section("WATER_SEPTIC", "Septic Tank – Visual Check", septicItems),
    );
  }

  // ── Water Sanitation (weekly × 2) ────────────────────────────────────────
  if (checklistType === "WEEKLY_TWICE" || checklistType === "WEEKLY") {
    sections.push(
      section("WATER_SANITATION", "Water Quality & Sanitation", [
        item("Chlorination / Dosing – Completed per Schedule"),
        item("pH Level – Within 6.5–8.5 Range"),
        item("Turbidity – Clear (Not Cloudy)"),
        item("Colour / Odour – No Abnormality"),
        item("Dosing Pump – Functional"),
        item("Sanitation Log – Updated & Signed"),
      ]),
    );
  }

  return sections;
}

// ─── Master factory ───────────────────────────────────────────────────────────
// Returns sections for a given category.

export function buildChecklistSections(
  category,
  buildingConfig = {},
  checklistType = "DAILY",
) {
  switch (category) {
    case "CCTV":
      return buildCctvSections(buildingConfig);
    case "ELECTRICAL":
      return buildElectricalSections(buildingConfig);
    case "SANITARY":
      return buildSanitarySections(buildingConfig);
    case "COMMON_AREA":
      return buildCommonAreaSections(buildingConfig);
    case "PARKING":
      return buildParkingSections(buildingConfig);
    case "FIRE":
      return buildFireSections(buildingConfig);
    case "WATER_TANK":
      return buildWaterTankSections(buildingConfig, checklistType);
    default:
      throw new Error(`Unknown checklist category: ${category}`);
  }
}

import mongoose from 'mongoose';

const uri = 'mongodb+srv://aashish_tenant_db:aashish_tenant_db@tenant-db.9mcjtfl.mongodb.net/?appName=tenant-db';
await mongoose.connect(uri);
console.log('Connected');

// Models
const innerBlockSchema = new mongoose.Schema({
  name: { type: String, required: true },
  block: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
});
const InnerBlock = mongoose.models.InnerBlock || mongoose.model('InnerBlock', innerBlockSchema);

const unitSchema = new mongoose.Schema({
  name: { type: String, required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  block: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', required: true },
  innerBlock: { type: mongoose.Schema.Types.ObjectId, ref: 'InnerBlock', required: true },
  actualSquareFeet: Number,
  floorNumber: Number,
  isOccupied: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  currentLease: { type: mongoose.Schema.Types.Mixed },
  occupancyHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { timestamps: true });
const Unit = mongoose.models.Unit || mongoose.model('Unit', unitSchema);

// Known IDs
const PROPERTY_ID = '6970f5a7464f3514eb16051c'; // Sallyan House
const BLOCK_BS    = '6970f5a7464f3514eb16051e'; // Birendra Sadan
const BLOCK_NS    = '6970f5a7464f3514eb160520'; // Narendra Sadan
const IB_SAGAR   = '6970f5a7464f3514eb160522'; // Sagar Block
const IB_JYOTI   = '6970f5a7464f3514eb160524'; // Jyoti Block
const IB_UMANGA  = '6970f5a7464f3514eb160526'; // Umanga Block
const IB_SAURYA  = '6970f5a7464f3514eb160528'; // Saurya Block

// Create Sagar-Jyoti Block if not exists
let ibSagarJyoti = await InnerBlock.findOne({ name: /sagar.jyoti/i });
if (!ibSagarJyoti) {
  ibSagarJyoti = await InnerBlock.create({
    name: 'Sagar-Jyoti Block',
    block: BLOCK_BS,
    property: PROPERTY_ID,
  });
  console.log('Created Sagar-Jyoti Block:', ibSagarJyoti._id);
} else {
  console.log('Sagar-Jyoti Block already exists:', ibSagarJyoti._id);
}
const IB_SJB = ibSagarJyoti._id.toString();

// Floor mapping
const floorMap = {
  'Ground ':   0,
  'Ground B ': 0,
  'First ':    1,
  'First B ':  1,
  'Second':    2,
  'Second B ': 2,
  'Third ':    3,
  'Third B':   3,
  'Fourth B ': 4,
  'Fifth B ':  5,
};

// Unit data: [name, floor, sqft, blockId, innerBlockId]
const rawUnits = [
  // Birendra Sadan - Sagar Block (Ground)
  ['BS-SB-G1', 'Ground ',   326.25,  BLOCK_BS, IB_SAGAR],
  ['BS-SB-G2', 'Ground ',   245,     BLOCK_BS, IB_SAGAR],
  ['BS-SB-G3', 'Ground ',   252.752, BLOCK_BS, IB_SAGAR],
  ['BS-SB-G4', 'Ground ',   332.5,   BLOCK_BS, IB_SAGAR],
  ['BS-SB-G5', 'Ground ',   328.61,  BLOCK_BS, IB_SAGAR],
  ['BS-SB-G6', 'Ground ',   307.736, BLOCK_BS, IB_SAGAR],
  // Birendra Sadan - Jyoti Block (Ground)
  ['BS-JB-G1', 'Ground ',   342,     BLOCK_BS, IB_JYOTI],
  ['BS-JB-G2', 'Ground ',   347.57,  BLOCK_BS, IB_JYOTI],
  ['BS-JB-G3', 'Ground ',   354.78,  BLOCK_BS, IB_JYOTI],
  ['BS-JB-G4', 'Ground ',   330,     BLOCK_BS, IB_JYOTI],
  ['BS-JB-G5', 'Ground ',   307,     BLOCK_BS, IB_JYOTI],
  ['BS-JB-G6', 'Ground ',   308.68,  BLOCK_BS, IB_JYOTI],
  // Birendra Sadan - Sagar Block (First)
  ['BS-SB-F1', 'First ',    294.5,   BLOCK_BS, IB_SAGAR],
  ['BS-SB-F2', 'First ',    214,     BLOCK_BS, IB_SAGAR],
  ['BS-SB-F3', 'First ',    222,     BLOCK_BS, IB_SAGAR],
  ['BS-SB-F4', 'First ',    302,     BLOCK_BS, IB_SAGAR],
  ['BS-SB-F5', 'First ',    300,     BLOCK_BS, IB_SAGAR],
  ['BS-SB-F6', 'First ',    280,     BLOCK_BS, IB_SAGAR],
  // Birendra Sadan - Sagar-Jyoti Block (First)
  ['BS-SJB-1', 'First ',    186,     BLOCK_BS, IB_SJB],
  // Birendra Sadan - Jyoti Block (First)
  ['BS-JB-F1', 'First ',    308,     BLOCK_BS, IB_JYOTI],
  ['BS-JB-F2', 'First ',    317.5,   BLOCK_BS, IB_JYOTI],
  ['BS-JB-F3', 'First ',    325,     BLOCK_BS, IB_JYOTI],
  ['BS-JB-F4', 'First ',    305,     BLOCK_BS, IB_JYOTI],
  ['BS-JB-F5', 'First ',    278,     BLOCK_BS, IB_JYOTI],
  ['BS-JB-F6', 'First ',    290,     BLOCK_BS, IB_JYOTI],
  // Birendra Sadan - Sagar Block (Second)
  ['BS-SB-S1', 'Second',    294.5,   BLOCK_BS, IB_SAGAR],
  ['BS-SB-S2', 'Second',    214,     BLOCK_BS, IB_SAGAR],
  ['BS-SB-S3', 'Second',    222.06,  BLOCK_BS, IB_SAGAR],
  ['BS-SB-S4', 'Second',    302.14,  BLOCK_BS, IB_SAGAR],
  ['BS-SB-S5', 'Second',    300,     BLOCK_BS, IB_SAGAR],
  ['BS-SB-S6', 'Second',    280,     BLOCK_BS, IB_SAGAR],
  // Birendra Sadan - Sagar-Jyoti Block (Second)
  ['BS-SJB-2', 'Second',    186,     BLOCK_BS, IB_SJB],
  // Birendra Sadan - Jyoti Block (Second)
  ['BS-JB-S1', 'Second',    309,     BLOCK_BS, IB_JYOTI],
  ['BS-JB-S2', 'Second',    317.5,   BLOCK_BS, IB_JYOTI],
  ['BS-JB-S3', 'Second',    324.5,   BLOCK_BS, IB_JYOTI],
  ['BS-JB-S4', 'Second',    304.4,   BLOCK_BS, IB_JYOTI],
  ['BS-JB-S5', 'Second',    278,     BLOCK_BS, IB_JYOTI],
  ['BS-JB-S6', 'Second',    290,     BLOCK_BS, IB_JYOTI],
  // Birendra Sadan - Sagar Block (Third)
  ['BS-SB-T1', 'Third ',    294.5,   BLOCK_BS, IB_SAGAR],
  ['BS-SB-T2', 'Third ',    214,     BLOCK_BS, IB_SAGAR],
  ['BS-SB-T3', 'Third ',    222.06,  BLOCK_BS, IB_SAGAR],
  ['BS-SB-T4', 'Third ',    302.14,  BLOCK_BS, IB_SAGAR],
  ['BS-SB-T5', 'Third ',    300,     BLOCK_BS, IB_SAGAR],
  ['BS-SB-T6', 'Third ',    280,     BLOCK_BS, IB_SAGAR],
  // Birendra Sadan - Sagar-Jyoti Block (Third)
  ['BS-SJB-3', 'Third ',    186,     BLOCK_BS, IB_SJB],
  // Birendra Sadan - Jyoti Block (Third)
  ['BS-JB-T1', 'Third ',    308.06,  BLOCK_BS, IB_JYOTI],
  ['BS-JB-T2', 'Third ',    317.31,  BLOCK_BS, IB_JYOTI],
  ['BS-JB-T3', 'Third ',    324.42,  BLOCK_BS, IB_JYOTI],
  ['BS-JB-T4', 'Third ',    304.4,   BLOCK_BS, IB_JYOTI],
  ['BS-JB-T5', 'Third ',    277.6,   BLOCK_BS, IB_JYOTI],
  ['BS-JB-T6', 'Third ',    290.2,   BLOCK_BS, IB_JYOTI],
  // Narendra Sadan - Saurya Block (Ground B)
  ['NS-SB-G1', 'Ground B ', 615.72,  BLOCK_NS, IB_SAURYA],
  ['NS-SB-G2', 'Ground B ', 596,     BLOCK_NS, IB_SAURYA],
  ['NS-SB-G3', 'Ground B ', 538,     BLOCK_NS, IB_SAURYA],
  // Narendra Sadan - Umanga Block (Ground B)
  ['NS-UB-G1', 'Ground B ', 742,     BLOCK_NS, IB_UMANGA],
  ['NS-UB-G2', 'Ground B ', 720.94,  BLOCK_NS, IB_UMANGA],
  ['NS-UB-G3', 'Ground B ', 725.29,  BLOCK_NS, IB_UMANGA],
  ['NS-UB-G4', 'Ground B ', 272.77,  BLOCK_NS, IB_UMANGA],
  // Narendra Sadan - Saurya Block (First-Fifth B)
  ['NS-SB-1',  'First B ',  1750,    BLOCK_NS, IB_SAURYA],
  ['NS-SB-2',  'Second B ', 1750,    BLOCK_NS, IB_SAURYA],
  ['NS-SB-3',  'Third B',   1750,    BLOCK_NS, IB_SAURYA],
  ['NS-SB-4',  'Fourth B ', 1750,    BLOCK_NS, IB_SAURYA],
  ['NS-SB-5',  'Fifth B ',  1495,    BLOCK_NS, IB_SAURYA],
  // Narendra Sadan - Umanga Block (First-Fifth B)
  ['NS-UB-1',  'First B ',  2540,    BLOCK_NS, IB_UMANGA],
  ['NS-UB-2',  'Second B ', 2540,    BLOCK_NS, IB_UMANGA],
  ['NS-UB-3',  'Third B',   2540,    BLOCK_NS, IB_UMANGA],
  ['NS-UB-4',  'Fourth B ', 2540,    BLOCK_NS, IB_UMANGA],
  ['NS-UB-5',  'Fifth B ',  2540,    BLOCK_NS, IB_UMANGA],
];

// Upsert: create if missing, patch only missing metadata fields if exists.
// Never touches currentLease, isOccupied, or occupancyHistory.
let created = 0, patched = 0, skipped = 0;

for (const [name, floor, sqft, blockId, innerBlockId] of rawUnits) {
  const floorNumber = floorMap[floor] ?? 0;
  const existing = await Unit.findOne({ name });

  if (!existing) {
    await Unit.create({
      name,
      property: PROPERTY_ID,
      block: blockId,
      innerBlock: innerBlockId,
      actualSquareFeet: sqft,
      floorNumber,
      isOccupied: false,
      isDeleted: false,
    });
    console.log(`CREATE  ${name}  ${sqft} sqft  floor=${floorNumber}`);
    created++;
    continue;
  }

  // Build a patch of only the fields that are null/undefined on the existing doc.
  // This preserves currentLease, isOccupied, occupancyHistory, etc.
  const patch = {};
  if (existing.actualSquareFeet == null) patch.actualSquareFeet = sqft;
  if (existing.floorNumber == null)      patch.floorNumber = floorNumber;
  if (existing.block == null)            patch.block = blockId;
  if (existing.innerBlock == null)       patch.innerBlock = innerBlockId;
  if (existing.property == null)         patch.property = PROPERTY_ID;
  if (existing.isDeleted == null)        patch.isDeleted = false;

  if (Object.keys(patch).length === 0) {
    console.log(`SKIP    ${name} (all fields present)`);
    skipped++;
    continue;
  }

  await Unit.updateOne({ _id: existing._id }, { $set: patch });
  console.log(`PATCH   ${name}  fields: ${Object.keys(patch).join(', ')}`);
  patched++;
}

console.log(`\nDone: ${created} created, ${patched} patched, ${skipped} skipped`);
await mongoose.disconnect();

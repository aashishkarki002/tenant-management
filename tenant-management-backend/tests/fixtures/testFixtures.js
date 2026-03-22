/**
 * Test fixtures for creating test data
 */
import mongoose from 'mongoose';

/**
 * Generate a test ObjectId (deterministic for same index)
 */
export function createTestId(prefix = 'test', index = 0) {
  // Create a deterministic 24-char hex string
  // Convert prefix to hex, pad with zeros, add index
  const prefixHex = Buffer.from(prefix).toString('hex').slice(0, 16);
  const indexHex = index.toString(16).padStart(8, '0');
  const hex = (prefixHex + indexHex).padEnd(24, '0').slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}

/**
 * Create test tenant fixture
 */
export function createTenantFixture(overrides = {}) {
  return {
    _id: overrides._id || createTestId('tenant'),
    name: overrides.name || 'Test Tenant',
    email: overrides.email || 'tenant@test.com',
    status: overrides.status || 'active',
    isDeleted: overrides.isDeleted || false,
    totalRentPaisa: overrides.totalRentPaisa || 5000000, // Rs 50,000
    tdsPaisa: overrides.tdsPaisa || 0,
    block: overrides.block || createTestId('block'),
    innerBlock: overrides.innerBlock || createTestId('inner'),
    property: overrides.property || createTestId('property'),
    units: overrides.units || [],
    rentPaymentFrequency: overrides.rentPaymentFrequency || 'monthly',
    camRatePerSqftPaisa: overrides.camRatePerSqftPaisa !== undefined ? overrides.camRatePerSqftPaisa : 0,
    ...overrides,
  };
}

/**
 * Create test rent fixture
 */
export function createRentFixture(overrides = {}) {
  return {
    _id: overrides._id || createTestId('rent'),
    tenant: overrides.tenant || createTestId('tenant'),
    block: overrides.block || createTestId('block'),
    innerBlock: overrides.innerBlock || createTestId('inner'),
    property: overrides.property || createTestId('property'),
    
    // Amounts in paisa
    rentAmountPaisa: overrides.rentAmountPaisa !== undefined ? overrides.rentAmountPaisa : 100_000,
    paidAmountPaisa: overrides.paidAmountPaisa !== undefined ? overrides.paidAmountPaisa : 0,
    tdsAmountPaisa: overrides.tdsAmountPaisa !== undefined ? overrides.tdsAmountPaisa : 0,
    lateFeePaisa: overrides.lateFeePaisa !== undefined ? overrides.lateFeePaisa : 0,
    
    // Status
    status: overrides.status || 'pending',
    lateFeeApplied: overrides.lateFeeApplied || false,
    lateFeeCompounding: overrides.lateFeeCompounding || false,
    
    // Dates
    nepaliDueDate: overrides.nepaliDueDate || '2081-04-30',
    englishDueDate: overrides.englishDueDate || new Date('2024-08-15'),
    nepaliMonth: overrides.nepaliMonth !== undefined ? overrides.nepaliMonth : 4,
    nepaliYear: overrides.nepaliYear !== undefined ? overrides.nepaliYear : 2081,
    englishMonth: overrides.englishMonth !== undefined ? overrides.englishMonth : 8,
    englishYear: overrides.englishYear !== undefined ? overrides.englishYear : 2024,
    nepaliDate: overrides.nepaliDate || '2081-04-01',
    
    // Metadata
    createdBy: overrides.createdBy || createTestId('admin'),
    units: overrides.units || [],
    rentFrequency: overrides.rentFrequency || 'monthly',
    
    ...overrides,
  };
}

/**
 * Create test admin fixture
 */
export function createAdminFixture(overrides = {}) {
  return {
    _id: overrides._id || createTestId('admin'),
    name: overrides.name || 'Test Admin',
    email: overrides.email || 'admin@test.com',
    role: overrides.role || 'admin',
    ...overrides,
  };
}

/**
 * Late fee policy fixtures
 */
export const lateFeeFixtures = {
  fixed: {
    key: 'lateFeePolicy',
    value: {
      enabled: true,
      type: 'fixed',
      amount: 500,
      gracePeriodDays: 5,
      compounding: false,
      maxLateFeeAmount: 0,
      appliesTo: 'rent',
    },
  },
  
  flatPercentage: {
    key: 'lateFeePolicy',
    value: {
      enabled: true,
      type: 'percentage',
      amount: 2,
      gracePeriodDays: 5,
      compounding: false,
      maxLateFeeAmount: 0,
      appliesTo: 'rent',
    },
  },
  
  simpleDaily: {
    key: 'lateFeePolicy',
    value: {
      enabled: true,
      type: 'simple_daily',
      amount: 2,
      gracePeriodDays: 5,
      compounding: false,
      maxLateFeeAmount: 0,
      appliesTo: 'rent',
    },
  },
  
  compound: {
    key: 'lateFeePolicy',
    value: {
      enabled: true,
      type: 'percentage',
      amount: 2,
      gracePeriodDays: 5,
      compounding: true,
      maxLateFeeAmount: 0,
      appliesTo: 'rent',
    },
  },
  
  withCap: {
    key: 'lateFeePolicy',
    value: {
      enabled: true,
      type: 'fixed',
      amount: 1000,
      gracePeriodDays: 5,
      compounding: false,
      maxLateFeeAmount: 500,
      appliesTo: 'rent',
    },
  },
  
  disabled: {
    key: 'lateFeePolicy',
    value: {
      enabled: false,
      type: 'fixed',
      amount: 500,
      gracePeriodDays: 5,
      compounding: false,
      maxLateFeeAmount: 0,
      appliesTo: 'rent',
    },
  },
};

/**
 * Helper to seed test database
 */
export async function seedTestDatabase({ tenants = [], rents = [], admins = [], configs = [] }) {
  const { Tenant } = await import('../../src/modules/tenant/Tenant.Model.js');
  const { Rent } = await import('../../src/modules/rents/rent.Model.js');
  const adminModel = await import('../../src/modules/auth/admin.Model.js');
  const { SystemConfig } = await import('../../src/modules/systemConfig/SystemConfig.Model.js');
  
  if (tenants.length) await Tenant.insertMany(tenants);
  if (rents.length) await Rent.insertMany(rents);
  if (admins.length) await adminModel.default.insertMany(admins);
  if (configs.length) await SystemConfig.insertMany(configs);
}

/**
 * Helper to clean test database
 */
export async function cleanTestDatabase() {
  const { Tenant } = await import('../../src/modules/tenant/Tenant.Model.js');
  const { Rent } = await import('../../src/modules/rents/rent.Model.js');
  const adminModel = await import('../../src/modules/auth/admin.Model.js');
  const { SystemConfig } = await import('../../src/modules/systemConfig/SystemConfig.Model.js');
  const { CronLog } = await import('../../src/cron/model/CronLog.js');
  
  await Promise.all([
    Tenant.deleteMany({}),
    Rent.deleteMany({}),
    adminModel.default.deleteMany({}),
    SystemConfig.deleteMany({}),
    CronLog.deleteMany({}),
  ]);
}

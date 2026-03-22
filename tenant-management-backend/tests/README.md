# Testing Documentation

## Overview

This document describes the comprehensive test suite for the tenant-management-backend cron system, focusing on Nepali calendar-based rent lifecycle and late fee calculations.

## Test Structure

```
tests/
├── unit/                     # Pure function tests (< 1ms each)
│   ├── computeLateFee.test.js       # All 4 late fee policy modes
│   └── nepaliDateHelper.test.js     # Date arithmetic & formatting
├── integration/              # DB interaction tests (< 5s per test)
│   ├── handleMonthlyRents.test.js   # Rent creation & overdue marking
│   └── applyLateFees.test.js        # Late fee application w/ policies
├── smoke/                    # End-to-end tests (< 30s)
│   └── rentModel.smoke.test.js      # Rent schema & pre-save hooks
├── fixtures/                 # Test data
│   ├── golden-bs-dates.json         # Verified BS ↔ English conversions
│   └── testFixtures.js              # Reusable test data builders
└── utils/                    # Test utilities
    ├── nepaliTimeMachine.js         # Time-travel for date-dependent tests
    └── testReporter.js              # Test summary reporter
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test suite
npm test -- tests/unit/computeLateFee.test.js

# Run in watch mode
npm run test:watch

# Run integration tests only
npm test -- tests/integration/
```

## Test Categories

### Unit Tests (tests/unit/)

Fast, isolated tests for pure functions with no external dependencies.

**computeLateFee.test.js**
- Fixed fee: Flat amount regardless of days
- Flat percentage: One-time percentage charge
- Simple daily: Linear growth (2%/day)
- Compound daily: Exponential growth (1.02^days)
- Edge cases: Zero balance, negative days, caps

**nepaliDateHelper.test.js**
- Date arithmetic: addNepaliDays, addNepaliMonths
- Date difference: diffNepaliDays across boundaries
- Formatting: ISO string conversion
- Golden reference validation: Known BS ↔ English pairs
- Month-shape matrix: 2081 month lengths (29–32 days)

### Integration Tests (tests/integration/)

Database-backed tests using MongoDB Memory Server.

**handleMonthlyRents.test.js**
- Rent creation on first day of month
- Idempotency: Second run creates no duplicates
- Overdue marking: Previous month unpaid → overdue
- Tenant filtering: Active only, skip deleted
- Month boundaries: Year-end (Chaitra) and new year (Baisakh)

**applyLateFees.test.js**
- All 4 policy modes with real DB state
- Grace period enforcement
- Cap application
- Daily growth tracking (simple & compound)
- Multi-rent processing
- CronLog creation

### Smoke Tests (tests/smoke/)

End-to-end validation of critical paths.

**rentModel.smoke.test.js**
- Pre-save hook status calculation
- Overdue preservation through partial payments
- Late fee impact on status
- Paisa integer enforcement

## Time-Travel Testing

The `nepaliTimeMachine.js` utility allows freezing time to specific Nepali dates for deterministic testing of date-dependent logic.

```javascript
import { freezeToNepaliDate } from '../../utils/nepaliTimeMachine.js';

test('creates rents on Baisakh 1', async () => {
  const restore = freezeToNepaliDate(2081, 1, 1); // Baisakh 1, 2081
  try {
    await masterCron({ forceRun: true });
    const rents = await Rent.find({ nepaliYear: 2081, nepaliMonth: 1 });
    expect(rents.length).toBeGreaterThan(0);
  } finally {
    restore();
  }
});
```

## Golden Reference Dataset

The `golden-bs-dates.json` file contains verified Nepali ↔ English date conversions covering:
- Month boundaries (first & last days)
- Year boundary (Chaitra → Baisakh)
- Months with varying lengths (29–32 days)

All date conversion tests validate against this dataset to catch regressions in the `nepali-datetime` library.

## Test Fixtures

Reusable test data builders in `testFixtures.js`:

```javascript
import { createRentFixture, createTenantFixture, lateFeeFixtures } from '../fixtures/testFixtures.js';

// Create test rent
const rent = createRentFixture({
  rentAmountPaisa: 100_000,
  status: 'overdue',
  nepaliDueDate: '2081-04-30',
});

// Create test tenant
const tenant = createTenantFixture({
  name: 'Test Tenant',
  totalRentPaisa: 5_000_000,
});

// Use predefined late fee policy
await SystemConfig.create(lateFeeFixtures.compound);
```

## Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Unit tests | 100% | ✓ |
| Integration tests | 90% | ✓ |
| Critical paths | 100% | ✓ |

## CI/CD Integration

Tests run on every PR via GitHub Actions:

```yaml
- name: Run tests
  run: npm test -- --coverage --maxWorkers=2
  
- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Debugging Failed Tests

```bash
# Run with verbose output
npm test -- --verbose

# Run single test
npm test -- -t "creates one rent per active tenant"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Known Limitations

1. **MongoDB Memory Server**: Slower on first run (downloads MongoDB binary)
2. **Time-travel**: Cannot test real-time cron scheduling, only business logic
3. **Transactions**: In-memory MongoDB doesn't support replica sets (single-doc transactions work)

## Future Enhancements

- [ ] Property-based testing with `fast-check`
- [ ] Chaos testing (random date injection)
- [ ] Nightly regression against golden dataset
- [ ] Visual regression for notification templates
- [ ] Load testing for bulk rent creation (1000+ tenants)

## References

- Testing guide: `/tenant-management-backend/system-prompt.md` (Section 3)
- Nepali calendar: https://en.wikipedia.org/wiki/Vikram_Samvat
- Jest ESM support: https://jestjs.io/docs/ecmascript-modules

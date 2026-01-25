# Quote Calculator Engine

A production-ready multi-resort quote calculation engine for travel/hospitality.

## Features

- Multi-leg quote creation
- Deterministic pricing calculation with full audit trail
- Version immutability
- State machine lifecycle (DRAFT → SENT → CONVERTED/REJECTED/EXPIRED)
- Structured logging with correlation IDs
- Fail-fast startup validation

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm 9+

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
# Smoke test
npx tsx tests/smoke-test.ts

# Performance baseline
npx tsx tests/performance/run-baseline.ts
```

## Project Structure

```
src/
├── core/           # Domain types, entities, calculation engine
├── services/       # QuoteService, CalculationService
├── data/           # Repository interfaces and JSON implementation
├── output/         # PDF and Email services
├── startup/        # Startup validation
└── ui/             # UI components (React)

tests/
├── smoke-test.ts   # Production smoke test
├── performance/    # Performance baselines
├── regression/     # Regression tests
└── negative/       # Negative path tests

docs/               # Sprint documentation
```

## API Usage

```typescript
import { QuoteService, CalculationService } from './src/services';
import { loadDataStore } from './src/core/calculation';
import { createJsonDataContext } from './src/data/repositories/json-repository';

// Load seed data
const seedData = JSON.parse(fs.readFileSync('./src/data/seed/maldives.json', 'utf-8'));
const referenceData = loadDataStore(seedData);

// Create services
const dataContext = createJsonDataContext('/path/to/data');
const quoteService = new QuoteService(dataContext);
const calcService = new CalculationService(dataContext, referenceData);

// Create and calculate a quote
const quote = await quoteService.create({
  client_name: 'John Smith',
  client_email: 'john@example.com',
  currency_code: 'USD',
  validity_days: 14,
});

const version = await calcService.calculate({
  quote_id: quote.value.id,
  legs: [{ /* leg details */ }],
});
```

## Version

v1.0.0 - Production Release

## License

Proprietary

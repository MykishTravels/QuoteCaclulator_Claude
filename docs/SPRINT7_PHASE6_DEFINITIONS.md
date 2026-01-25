# Phase 6: Performance Baseline Definitions

## 1. SCALE PARAMETERS

### 1.1 What is "Large" for This System?

| Dimension | Typical | Large | Extreme |
|-----------|---------|-------|---------|
| **Legs per quote** | 1-2 | 5 | 10 |
| **Nights per leg** | 3-7 | 14 | 30 |
| **Adults per leg** | 2 | 4 | 6 |
| **Children per leg** | 0-2 | 4 | 6 |
| **Activities per leg** | 0-2 | 5 | 10 |
| **Discounts per leg** | 0-1 | 3 | 5 |
| **Total line items** | ~20 | ~100 | ~500 |

### 1.2 Derived Complexity

| Scenario | Legs | Nights | Guests | Activities | Discounts | Est. Line Items |
|----------|------|--------|--------|------------|-----------|-----------------|
| **Minimal** | 1 | 3 | 2 | 0 | 0 | ~15 |
| **Typical** | 2 | 5 | 4 | 2 | 1 | ~60 |
| **Large** | 5 | 14 | 8 | 5 | 3 | ~300 |
| **Extreme** | 10 | 30 | 12 | 10 | 5 | ~1000 |

---

## 2. ACCEPTABLE THRESHOLDS

### 2.1 Calculation Performance

| Operation | Typical (ms) | Large (ms) | Extreme (ms) | Unacceptable |
|-----------|--------------|------------|--------------|--------------|
| `calculateLeg()` | <50 | <100 | <500 | >1000 |
| `calculateQuote()` (typical) | <100 | <500 | <2000 | >5000 |
| `calculateQuote()` (extreme) | N/A | N/A | <5000 | >10000 |

### 2.2 Service Operations

| Operation | Acceptable | Unacceptable |
|-----------|------------|--------------|
| `QuoteService.create()` | <50ms | >200ms |
| `QuoteService.send()` | <100ms | >500ms |
| `CalculationService.calculate()` | <2000ms | >5000ms |
| `PDFService.generate()` | <5000ms | >10000ms |

### 2.3 Memory

| Scenario | Acceptable | Unacceptable |
|----------|------------|--------------|
| Single quote calculation | <50MB heap growth | >200MB |
| Large quote (10 legs) | <100MB heap growth | >500MB |

---

## 3. COMPLEXITY EXPECTATIONS

### 3.1 Expected Big-O

| Component | Expected | Pathological |
|-----------|----------|--------------|
| Nightly rate lookup | O(nights) | O(nights²) |
| Tax calculation | O(taxes × line_items) | O(taxes × line_items²) |
| Discount application | O(discounts × line_items) | O(discounts² × line_items) |
| Leg calculation | O(nights + activities + taxes) | O(nights × activities × taxes) |
| Quote calculation | O(legs × leg_complexity) | O(legs² × leg_complexity) |

### 3.2 Red Flags to Detect

1. **Quadratic growth** - Time doubles when input doubles
2. **Exponential growth** - Time explodes with small input increase
3. **Memory leaks** - Heap doesn't stabilize after GC
4. **Blocking operations** - Single operation takes >10s

---

## 4. MEASUREMENT APPROACH

### 4.1 What We Measure

- **Wall clock time** for end-to-end operations
- **Component time** for isolated functions
- **Scaling behavior** (2x input → how much time increase?)

### 4.2 What We Do NOT Measure

- Disk I/O (varies by system)
- Network latency (not applicable for v1)
- UI rendering time

### 4.3 Test Structure

```typescript
// Measure, don't assert
const start = performance.now();
await operation();
const elapsed = performance.now() - start;

// Document results
console.log(`${name}: ${elapsed.toFixed(2)}ms`);
results.push({ name, elapsed, inputSize });
```

---

## 5. SCENARIOS TO TEST

### 5.1 Calculation Scaling

| Test | Input Variation | Purpose |
|------|-----------------|---------|
| `legs_scaling` | 1, 2, 5, 10 legs | Detect O(legs²) |
| `nights_scaling` | 3, 7, 14, 30 nights | Detect O(nights²) |
| `guests_scaling` | 2, 4, 8, 12 guests | Detect O(guests²) |
| `activities_scaling` | 0, 2, 5, 10 activities | Detect O(activities²) |
| `discounts_scaling` | 0, 1, 3, 5 discounts | Detect O(discounts²) |

### 5.2 Combined Load

| Test | Configuration | Purpose |
|------|---------------|---------|
| `minimal_quote` | 1 leg, 3 nights, 2 guests | Baseline |
| `typical_quote` | 2 legs, 5 nights, 4 guests | Real-world baseline |
| `large_quote` | 5 legs, 14 nights, 8 guests | Stress test |
| `extreme_quote` | 10 legs, 30 nights, 12 guests | Upper bound |

---

## 6. OUTPUT FORMAT

Results will be documented as:

```
=== PERFORMANCE BASELINE RESULTS ===
Date: 2026-01-24
System: [Node version, OS]

CALCULATION SCALING (legs):
  1 leg:   45ms
  2 legs:  82ms  (1.8x)
  5 legs:  195ms (4.3x)
  10 legs: 410ms (9.1x)
  Scaling: LINEAR ✓

CALCULATION SCALING (nights):
  3 nights:  28ms
  7 nights:  42ms  (1.5x)
  14 nights: 68ms  (2.4x)
  30 nights: 125ms (4.5x)
  Scaling: LINEAR ✓

[etc.]
```

---

## 7. NON-GOALS

This phase does NOT:
- Optimize anything
- Add caching
- Parallelize operations
- Refactor for performance
- Set hard pass/fail thresholds

It ONLY documents current performance as a baseline for future comparison.

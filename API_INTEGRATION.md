# Bond Sports API Integration Guide

## Overview

This document details how the Bond Sports Program Discovery Platform integrates with the Bond Public API.

## API Configuration

### Base Setup
```typescript
// src/api/bondClient.ts
const BASE_URL = 'https://public.api.bondsports.co/v1';
const API_KEY = 'zhoZODDEKuaexCBkvumrU7c84TbC3zsC4hENkjlz';
```

### Authentication
All requests use the `x-api-key` header:
```typescript
headers: {
  'x-api-key': API_KEY,
}
```

---

## Implemented Endpoints

### 1. Get Programs
**Method:** `GET /organization/{orgId}/programs`

**Purpose:** Fetch all programs from an organization

**Parameters:**
```
expand=sessions,sessions.products,sessions.products.prices
```

**Returns:**
```typescript
{
  data: Program[],
  meta: {
    pagination: {
      total: number,
      per_page: number,
      current_page: number,
      last_page: number
    }
  }
}
```

**Usage:**
```typescript
const programs = await bondClient.getPrograms('516');
```

**Response Example:**
```json
{
  "data": [
    {
      "id": "prog_123",
      "name": "Morning Yoga",
      "type": "class",
      "sport": "yoga",
      "facility_id": "fac_456",
      "sessions": [
        {
          "id": "sess_789",
          "name": "Beginner Yoga",
          "start_date": "2025-01-20",
          "end_date": "2025-03-20",
          "start_time": "09:00:00",
          "end_time": "10:00:00",
          "capacity": 20,
          "current_enrollment": 15,
          "products": [
            {
              "id": "prod_111",
              "name": "Drop-in Class",
              "prices": [
                {
                  "amount": 2000,
                  "currency": "USD"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

### 2. Get Sessions
**Method:** `GET /organization/{orgId}/programs/{programId}/sessions`

**Purpose:** Fetch sessions for a specific program

**Parameters:**
```
expand=products,products.prices,segments,events
```

**Usage:**
```typescript
const sessions = await bondClient.getSessions('516', 'prog_123');
```

**Response Example:**
```json
{
  "data": [
    {
      "id": "sess_789",
      "program_id": "prog_123",
      "name": "Beginner Yoga",
      "start_date": "2025-01-20",
      "end_date": "2025-03-20",
      "products": [...],
      "segments": [...],
      "events": [...]
    }
  ]
}
```

---

### 3. Get Products
**Method:** `GET /organization/{orgId}/programs/{programId}/sessions/{sessionId}/products`

**Purpose:** Fetch products (pricing tiers) for a session

**Parameters:**
```
expand=prices
```

**Usage:**
```typescript
const products = await bondClient.getProducts('516', 'prog_123', 'sess_789');
```

**Response Example:**
```json
{
  "data": [
    {
      "id": "prod_111",
      "session_id": "sess_789",
      "name": "Drop-in Class",
      "type": "pay_per_class",
      "prices": [
        {
          "id": "price_111",
          "amount": 2000,
          "currency": "USD",
          "age_group": "adult"
        },
        {
          "id": "price_112",
          "amount": 1000,
          "currency": "USD",
          "age_group": "child"
        }
      ]
    },
    {
      "id": "prod_222",
      "name": "10-Class Package",
      "type": "package",
      "prices": [
        {
          "amount": 15000,
          "currency": "USD"
        }
      ]
    }
  ]
}
```

---

### 4. Get Segments
**Method:** `GET /organization/{orgId}/programs/{programId}/sessions/{sessionId}/segments`

**Purpose:** Fetch class segments/schedule within a session

**Parameters:**
```
expand=events
```

**Usage:**
```typescript
const segments = await bondClient.getSegments('516', 'prog_123', 'sess_789');
```

**Response Example:**
```json
{
  "data": [
    {
      "id": "seg_111",
      "session_id": "sess_789",
      "name": "January Schedule",
      "start_date": "2025-01-20",
      "end_date": "2025-01-31",
      "events": [
        {
          "id": "evt_111",
          "name": "Class",
          "start_time": "09:00:00",
          "end_time": "10:00:00",
          "location": "Studio A"
        }
      ]
    }
  ]
}
```

---

### 5. Get Events
**Method:** `GET /organization/{orgId}/programs/{programId}/sessions/{sessionId}/events`

**Purpose:** Fetch individual events/classes

**Usage:**
```typescript
const events = await bondClient.getEvents('516', 'prog_123', 'sess_789');
```

**Response Example:**
```json
{
  "data": [
    {
      "id": "evt_111",
      "name": "Monday Class",
      "start_time": "09:00:00",
      "end_time": "10:00:00",
      "location": "Studio A",
      "facility_id": "fac_456"
    }
  ]
}
```

---

## Caching System

### How It Works
The `BondClient` implements a 5-minute in-memory cache to reduce API calls:

```typescript
// Cache structure
const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
```

### Cache Key Generation
```typescript
getCacheKey(endpoint, params) {
  return `${endpoint}:${JSON.stringify(params)}`;
}
```

### Example
```typescript
// First call - hits API
const programs1 = await bondClient.getPrograms('516');

// Second call within 5 minutes - returns cached data
const programs2 = await bondClient.getPrograms('516');

// After 5 minutes - expires and hits API again
const programs3 = await bondClient.getPrograms('516');
```

---

## Error Handling

### API Errors
The client catches and handles errors gracefully:

```typescript
try {
  const programs = await bondClient.getPrograms('516');
} catch (error) {
  console.error('API Error:', error.message);
  // Error is displayed in UI
}
```

### Validation
- Empty organization arrays are skipped
- Missing sessions/products are handled with defaults
- Network errors display user-friendly messages

---

## Organizations

Currently configured with 11 Toca organizations:

| Org ID | Name |
|--------|------|
| 516 | Toca 1 |
| 512 | Toca 2 |
| 513 | Toca 3 |
| 519 | Toca 4 |
| 518 | Toca 5 |
| 521 | Toca 6 |
| 514 | Toca 7 |
| 515 | Toca 8 |
| 510 | Toca 9 |
| 520 | Toca 10 |
| 522 | Toca 11 |
| 511 | Toca 12 |

**Default:** All 12 organizations

**Configuration:** `QUICKSTART.md` or URL parameter `org_ids=516_512_513`

---

## Data Flow

### 1. User Loads Page
```
App.tsx
  ↓
parseUrlParams() → Extract org_ids from URL
  ↓
usePrograms() → Fetch from all orgs
  ↓
bondClient.getPrograms() → Check cache → API call → Cache response
  ↓
Update state with programs
```

### 2. User Filters
```
FilterSidebar onChange
  ↓
handleFiltersChange(newFilters)
  ↓
useFilteredPrograms() → Client-side filtering on cached data
  ↓
Update displayed results
  ↓
buildUrlWithParams() → Update URL bar
```

### 3. User Expands Session
```
ProgramCard [expanded state]
  ↓
Show sessions from program.sessions (already loaded)
  ↓
Display session info with formatting
```

---

## TypeScript Types

### Program
```typescript
interface Program {
  id: string;
  name: string;
  description?: string;
  type?: string;  // class, clinic, camp, lesson, etc.
  sport?: string;  // yoga, tennis, soccer, etc.
  facility_id?: string;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
  sessions?: Session[];
}
```

### Session
```typescript
interface Session {
  id: string;
  program_id: string;
  name?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  capacity?: number;
  current_enrollment?: number;
  status?: string;
  recurring?: boolean;
  products?: Product[];
  segments?: Segment[];
  events?: Event[];
}
```

### Product
```typescript
interface Product {
  id: string;
  session_id: string;
  name: string;
  description?: string;
  type?: string;
  prices?: Price[];
}
```

### Price
```typescript
interface Price {
  id: string;
  product_id: string;
  amount: number;  // in cents
  currency: string;  // USD, etc.
  age_group?: string;
  discount?: number;
}
```

---

## Performance Tips

### Optimize API Calls
1. Use the `expand` parameter to get nested data in one call
2. Rely on caching - don't make unnecessary repeated calls
3. Filter on client-side after initial load

### Example
```typescript
// Good - Gets everything in one call
const programs = await bondClient.getPrograms('516');
// Returns programs with sessions, products, and prices included

// Bad - Multiple unnecessary calls
const programs = await bondClient.getPrograms('516');
for (const program of programs) {
  const sessions = await bondClient.getSessions('516', program.id); // Avoid!
}
```

---

## Debugging

### View Cache Contents
```typescript
// In browser console
bondClient.cache.forEach((entry, key) => {
  console.log(key, entry.data);
});
```

### Check Network Requests
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "Fetch/XHR"
4. Look for requests to `public.api.bondsports.co`

### View API Response
```typescript
// In your browser console
await bondClient.getPrograms('516');
// Returns full response with all nested data
```

---

## Future Enhancements

- [ ] Add pagination support for large datasets
- [ ] Implement server-side filtering
- [ ] Add GraphQL endpoint option
- [ ] Add webhooks for real-time updates
- [ ] Add batch operations for multiple orgs
- [ ] Add data validation/sanitization

---

## Support

For API questions or issues:
1. Check Bond Sports API documentation
2. Review browser DevTools Network tab
3. Check `bondClient.ts` for implementation details
4. Review API response in console

---

**Last Updated:** January 20, 2025
**API Version:** v1
**Platform:** Bond Sports Public API

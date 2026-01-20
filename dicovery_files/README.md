# Bond Sports Program Discovery Platform

A modern React + TypeScript + Vite application for discovering sports programs and activities from Bond Sports facilities.

## Features

✅ **Program Discovery** - Browse all programs across multiple facilities
✅ **Smart Filtering** - Filter by facility, program type, activity, and date range
✅ **Live Search** - Search programs by name in real-time
✅ **Responsive Design** - Works perfectly on desktop, tablet, and mobile
✅ **Session Details** - Expandable session information with pricing and availability
✅ **URL Parameter System** - Configure filters via URL parameters for easy embedding
✅ **API Caching** - 5-minute in-memory cache to minimize API calls
✅ **Error Handling** - Graceful error states and loading indicators

## Quick Start

### Prerequisites
- Node.js 16+ and npm

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd bond-discovery

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:5173
```

### Build for Production

```bash
npm run build

# Output will be in the 'dist' folder
npm run preview  # Preview the build locally
```

## Project Structure

```
bond-discovery/
├── src/
│   ├── api/
│   │   └── bondClient.ts           # Bond Sports API client with caching
│   ├── components/
│   │   ├── ProgramCard.tsx         # Program display card
│   │   ├── FilterSidebar.tsx       # Filter controls
│   │   └── DiscoveryGrid.tsx       # Results grid layout
│   ├── hooks/
│   │   └── usePrograms.ts          # Custom hooks for data fetching
│   ├── types/
│   │   └── bond.ts                 # TypeScript interfaces
│   ├── utils/
│   │   └── formatters.ts           # Utility functions
│   ├── App.tsx                     # Main app component
│   ├── main.tsx                    # React entry point
│   └── index.css                   # Tailwind styles
├── index.html                      # HTML entry point
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── .gitignore
```

## API Integration

### Base Configuration
- **Base URL:** `https://public.api.bondsports.co/v1`
- **Auth:** `x-api-key` header
- **API Key:** Configured in `src/api/bondClient.ts`

### Endpoints Used

1. **GET /organization/{orgId}/programs**
   - Fetches programs with sessions, products, and pricing
   - Expand: `sessions,sessions.products,sessions.products.prices`

2. **GET /organization/{orgId}/programs/{programId}/sessions**
   - Fetches sessions for a specific program
   - Expand: `products,products.prices,segments,events`

3. **GET /organization/{orgId}/programs/{programId}/sessions/{sessionId}/products**
   - Fetches products/offerings for a session
   - Expand: `prices`

4. **GET /organization/{orgId}/programs/{programId}/sessions/{sessionId}/segments**
   - Fetches segments (class schedules)
   - Expand: `events`

5. **GET /organization/{orgId}/programs/{programId}/sessions/{sessionId}/events**
   - Fetches individual events/classes

## URL Parameters

The platform supports URL parameters for easy customization:

```
/?org_ids=516_512_513
  &facility_ids=101_102
  &program_types=class,clinic
  &sports=yoga,tennis
  &show_filters=facility,program_type,date_range,activity
  &view_mode=discovery
  &program_name=yoga
  &start_date=2025-01-20
  &end_date=2025-02-20
```

### Available Parameters

| Parameter | Format | Example | Description |
|-----------|--------|---------|-------------|
| `org_ids` | Underscore-separated | `516_512_513` | Organization IDs to query |
| `facility_ids` | Underscore-separated | `101_102` | Filter by facilities |
| `program_types` | Comma-separated | `class,clinic,camp` | Filter by program types |
| `sports` | Comma-separated | `yoga,tennis,soccer` | Filter by activities/sports |
| `program_name` | String | `yoga` | Search programs by name |
| `start_date` | ISO date | `2025-01-20` | Filter by start date |
| `end_date` | ISO date | `2025-02-20` | Filter by end date |
| `show_filters` | Comma-separated | `facility,program_type,date_range` | Which filters to show |
| `view_mode` | String | `discovery` | View mode (discovery, schedule, direct) |

## Usage Examples

### Default Configuration
```
http://localhost:5173
```
Shows all programs from all organizations with default filters.

### Specific Facilities
```
http://localhost:5173/?facility_ids=516&show_filters=program_type,date_range
```
Shows programs from facility 516 with only program type and date range filters.

### Yoga Classes Only
```
http://localhost:5173/?sports=yoga&program_types=class&show_filters=facility,date_range
```
Shows only yoga classes with facility and date range filters.

### Embedded in Webflow
```html
<iframe 
  src="https://yourdomain.com/bond-discovery/?org_ids=516_512&show_filters=program_type,date_range"
  width="100%"
  height="800"
  frameborder="0"
></iframe>
```

## Deployment

### Vercel (Recommended)

```bash
# Connect your GitHub repo to Vercel
# Vercel automatically detects Vite and builds
# Build command: npm run build
# Output directory: dist
```

### Static Hosting (S3, Netlify, GitHub Pages)

```bash
npm run build
# Upload the 'dist' folder to your hosting provider
```

### Docker

```bash
# Build Docker image
docker build -t bond-discovery .

# Run container
docker run -p 3000:80 bond-discovery
```

#### Dockerfile Example

```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Customization

### Adding Custom Styles

Edit `tailwind.config.js` to customize colors and styles:

```js
theme: {
  extend: {
    colors: {
      brand: {
        primary: '#yourcolor',
      }
    }
  }
}
```

### Changing API Key

Update `src/api/bondClient.ts`:

```typescript
const API_KEY = 'your-api-key-here';
```

### Adding More Filters

1. Add filter type to `DiscoveryFilters` in `src/types/bond.ts`
2. Add UI component to `FilterSidebar.tsx`
3. Add filtering logic to `useFilteredPrograms` hook in `src/hooks/usePrograms.ts`

## Performance

- **API Caching:** 5-minute in-memory cache prevents duplicate requests
- **Lazy Loading:** Program cards render efficiently with pagination
- **Code Splitting:** Vite automatically optimizes bundle sizes
- **Responsive Images:** Image optimization via CSS

## Troubleshooting

### Programs not loading?
1. Check API key in `bondClient.ts`
2. Verify organization IDs are correct
3. Check browser console for errors
4. Ensure CORS is enabled on API

### Filters not working?
1. Verify filter values match API response data
2. Check `useFilteredPrograms` logic
3. Ensure URL parameters are properly encoded

### Build errors?
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Development

### Code Quality
- TypeScript strict mode enabled
- ESLint ready (can be added)
- Prettier ready (can be added)

### Testing
```bash
npm run build  # Check for build errors
npm run preview  # Test production build locally
```

## Support

For API documentation, visit: [Bond Sports Public API Docs]

## License

Proprietary - Bond Sports 2025

## Next Steps

- [ ] Add session booking integration
- [ ] Add calendar/schedule view
- [ ] Add admin controls
- [ ] Add analytics tracking
- [ ] Add accessibility improvements
- [ ] Add unit tests
- [ ] Add E2E tests

---

**Built with ❤️ using React, TypeScript, Vite, and Tailwind CSS**

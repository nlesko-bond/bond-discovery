# Quick Start Guide

## 🚀 Get Running in 2 Minutes

### Step 1: Install Dependencies
```bash
cd /home/claude/bond-discovery
npm install
```

### Step 2: Start Development Server
```bash
npm run dev
```

The app will open at: **http://localhost:5173**

### Step 3: See It Working

You should see:
- ✅ Bond Discovery header with logo
- ✅ Filter sidebar on the left (Facility, Program Type, Activity, Date Range, Search)
- ✅ Grid of program cards loading from the API
- ✅ Each card showing program info, price, and expandable sessions

---

## 📋 What's Included

### Core Features Ready to Use
- ✅ Program discovery with live filtering
- ✅ Smart caching (5-minute cache for API calls)
- ✅ TypeScript types for all API responses
- ✅ Responsive design (works on mobile, tablet, desktop)
- ✅ URL parameter configuration
- ✅ Expandable session details
- ✅ Error handling and loading states

### API Integration
- ✅ All 6 Bond Sports API endpoints implemented
- ✅ Organized by org ID (516-522)
- ✅ Real API key configured
- ✅ Automatic response caching

---

## 🎯 How It Works

### 1. **Filters** (Left Sidebar)
   - Click to expand/collapse each filter
   - Select multiple options
   - Real-time filtering on client side
   - "Clear All" button to reset

### 2. **Program Cards** (Main Grid)
   - Shows program name, type, sport, price
   - Click "View Sessions" to expand
   - See session dates, times, capacity
   - Responsive grid (1-3 columns)

### 3. **URL Parameters**
   - Add `?sports=yoga` to filter by yoga
   - Add `?org_ids=516` to show only one organization
   - Add `?show_filters=facility,date_range` to customize visible filters
   - Changes sync automatically to URL bar

---

## 🧪 Test It Out

### Try These URLs

**All programs (default)**
```
http://localhost:5173
```

**Yoga only**
```
http://localhost:5173/?sports=yoga
```

**Classes from facility 516**
```
http://localhost:5173/?org_ids=516&program_types=class
```

**With limited filters**
```
http://localhost:5173/?show_filters=program_type,date_range
```

---

## 📁 Project Layout

```
src/
├── api/bondClient.ts       ← API client with caching
├── types/bond.ts           ← TypeScript interfaces  
├── utils/formatters.ts     ← Helper functions
├── hooks/usePrograms.ts    ← Data fetching hooks
├── components/
│   ├── ProgramCard.tsx     ← Individual program display
│   ├── FilterSidebar.tsx   ← Filter controls
│   └── DiscoveryGrid.tsx   ← Results grid
├── App.tsx                 ← Main app layout
├── main.tsx                ← React entry point
└── index.css               ← Tailwind styles
```

---

## 🔧 Building for Production

```bash
# Build the app
npm run build

# Preview the build
npm run preview

# Output will be in 'dist/' folder
```

---

## 🚀 Deployment

### Vercel (Easiest)
```bash
# Connect your GitHub repo to Vercel
# It automatically detects Vite and deploys
```

### Static Hosting
```bash
# Build and upload dist/ to:
# - AWS S3
# - Netlify
# - GitHub Pages
# - Any static host
```

### Docker
```bash
docker build -t bond-discovery .
docker run -p 3000:80 bond-discovery
```

---

## 💡 Next Steps

### Want to customize?
1. **Colors:** Edit `tailwind.config.js`
2. **API Key:** Update `src/api/bondClient.ts`
3. **Add filters:** Modify `FilterSidebar.tsx` and `useFilteredPrograms`
4. **Change layout:** Update `DiscoveryGrid.tsx`

### Want to extend?
- Add session booking
- Add calendar view
- Add reviews/ratings
- Add wishlist feature
- Add admin panel

---

## ❓ Common Issues

### Programs not showing?
```bash
# Try reinstalling
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Port 5173 already in use?
```bash
# Kill the process or use different port
lsof -ti:5173 | xargs kill -9
npm run dev -- --port 5174
```

### Build failing?
```bash
# Check for TypeScript errors
npm run build
```

---

## 📞 Support

Questions? Check:
- `README.md` - Full documentation
- `src/api/bondClient.ts` - API configuration
- Browser console for error messages

---

**Ready?** Run `npm run dev` and start exploring! 🎉

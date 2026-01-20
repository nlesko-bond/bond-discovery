# GitHub Setup Instructions for Bond Discovery

## 📝 Steps to Push to Your Repository

### Step 1: Create Repository on GitHub
1. Go to https://github.com/new
2. **Repository name:** `bond-discovery`
3. **Description:** `Bond Sports Program Discovery Platform`
4. **Public** (so it can be shared)
5. **Initialize without README** (we already have one)
6. Click **Create repository**

### Step 2: Download & Extract Files

You have two options:

#### Option A: Use the ZIP file (Easiest)
1. Download `bond-discovery.zip` from the outputs
2. Extract it to your local machine
3. Open terminal in the extracted folder

#### Option B: Clone empty repo first
```bash
git clone https://github.com/nlesko-bond/bond-discovery.git
cd bond-discovery
```

### Step 3: Add Files & Push

If you used **Option A** (ZIP):
```bash
cd bond-discovery
git init
git add .
git commit -m "Initial commit: Bond Sports Program Discovery Platform"
git branch -M main
git remote add origin https://github.com/nlesko-bond/bond-discovery.git
git push -u origin main
```

If you used **Option B** (Clone):
```bash
# Copy all extracted files into the cloned folder
# Then:
git add .
git commit -m "Initial commit: Bond Sports Program Discovery Platform"
git push -u origin main
```

### Step 4: Verify on GitHub
1. Go to https://github.com/nlesko-bond/bond-discovery
2. You should see all your files
3. Check that `src/`, `package.json`, README.md, etc. are there

---

## 🚀 After Files Are in GitHub

### Deploy to Vercel (1 minute)
1. Go to https://vercel.com
2. Click "New Project"
3. Select your `bond-discovery` repository
4. Click "Deploy"
5. Your app will be live at: `bond-discovery.vercel.app`

### Or Deploy to Netlify
1. Go to https://netlify.com
2. Click "New site from Git"
3. Select your repository
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Deploy!

---

## 📦 Project Contents

What you're pushing:

```
bond-discovery/
├── src/                          (9 files)
│   ├── api/bondClient.ts        - API integration
│   ├── components/              - React components
│   ├── hooks/usePrograms.ts     - Data fetching
│   ├── types/bond.ts            - TypeScript types
│   ├── utils/formatters.ts      - Helper functions
│   ├── App.tsx                  - Main app
│   ├── main.tsx                 - Entry point
│   └── index.css                - Styles
│
├── Configuration (6 files)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── index.html
│
├── Documentation (5 files)
│   ├── README.md                - Full docs
│   ├── QUICKSTART.md            - Quick start
│   ├── API_INTEGRATION.md       - API details
│   ├── DEPLOYMENT.md            - Deploy guide
│   └── PROJECT_SUMMARY.txt      - Overview
│
└── Git files
    └── .gitignore
```

---

## ✅ Verify Your Repository

After pushing, you should see:

```
✓ README.md (1 file)
✓ src/ folder with 9 TypeScript files
✓ package.json with all dependencies
✓ Configuration files
✓ Documentation files
✓ .gitignore
```

---

## 🔑 API Configuration

Everything is pre-configured:
- **API Key:** Already in `src/api/bondClient.ts`
- **Org IDs:** 516, 512, 513, 519, 518, 521, 514, 515, 510, 520, 522, 511
- **Base URL:** https://public.api.bondsports.co/v1

---

## 🚀 Local Development After Push

Once files are on GitHub:

```bash
# Clone your repo
git clone https://github.com/nlesko-bond/bond-discovery.git
cd bond-discovery

# Install and run
npm install
npm run dev

# Open http://localhost:5173
```

---

## 📋 Troubleshooting

### Files not showing on GitHub?
- Refresh the page
- Check branch is `main` (not `master`)
- Verify push completed without errors

### Git authentication issues?
- Use personal access token instead of password
- Generate at: https://github.com/settings/tokens
- Use token as password when git asks

### Node modules showing?
- They shouldn't! (excluded by .gitignore)
- If they do, delete and recommit:
  ```bash
  git rm -r --cached node_modules
  git commit -m "Remove node_modules"
  git push
  ```

---

## 📞 Next Steps

1. ✅ Create GitHub repo
2. ✅ Download and push files
3. ✅ Deploy to Vercel/Netlify
4. ✅ Share the live link
5. ✅ Gather feedback
6. ✅ Iterate and improve

---

## 💡 Quick Reference

Your repository: https://github.com/nlesko-bond/bond-discovery

Live app (after deploy): https://bond-discovery.vercel.app (or Netlify equivalent)

Questions? Check the documentation files in your repo!

---

**All files are ready - just download and push!** 🎉

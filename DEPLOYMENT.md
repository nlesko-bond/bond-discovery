# Deployment Guide

Complete step-by-step guide for deploying the Bond Sports Program Discovery Platform.

## Pre-Deployment Checklist

- [ ] All tests passing locally (`npm run build`)
- [ ] No console errors
- [ ] All filters working correctly
- [ ] API key is valid and secure
- [ ] Domain/URL decided
- [ ] SSL certificate ready (if self-hosted)

---

## Option 1: Vercel (Recommended - Free)

Vercel is perfect for React/Vite apps. Deployment takes 2 minutes.

### Steps

#### 1. Push to GitHub
```bash
cd /home/claude/bond-discovery
git remote add origin https://github.com/yourusername/bond-discovery.git
git branch -M main
git push -u origin main
```

#### 2. Connect to Vercel
1. Go to https://vercel.com
2. Click "New Project"
3. Select your GitHub repository
4. Vercel auto-detects Vite (no config needed!)
5. Click "Deploy"

#### 3. Configure Environment (Optional)
In Vercel dashboard:
1. Go to Settings → Environment Variables
2. Add `VITE_API_KEY=your_api_key` (if you want to keep it secret)
3. Update `bondClient.ts` to use `import.meta.env.VITE_API_KEY`

#### 4. Auto-Deploy on Git Push
```bash
# Every push to main automatically redeploys
git commit -am "Update program filters"
git push  # Automatically deployed!
```

### Result
Your app will be live at: `bond-discovery.vercel.app`

---

## Option 2: Netlify (Free)

Similar to Vercel, good alternative.

### Steps

#### 1. Build Locally
```bash
npm run build
```

#### 2. Deploy via Web UI
1. Go to https://netlify.com
2. Drag and drop the `dist/` folder
3. Deploy!

#### 3. Connect Git (for Auto-Deploy)
1. Link your GitHub account
2. Select the repository
3. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Deploy!

### Result
Your app will be live at: `bond-discovery-xxx.netlify.app`

---

## Option 3: AWS S3 + CloudFront (Static Hosting)

Best for production with custom domain.

### Steps

#### 1. Build the App
```bash
npm run build
# Creates dist/ folder
```

#### 2. Create S3 Bucket
```bash
aws s3 mb s3://bond-discovery-prod
```

#### 3. Enable Static Website Hosting
```bash
aws s3 website s3://bond-discovery-prod \
  --index-document index.html \
  --error-document index.html
```

#### 4. Upload Build
```bash
aws s3 sync dist/ s3://bond-discovery-prod \
  --delete \
  --cache-control max-age=31536000 \
  --exclude "index.html"

# For index.html, no caching
aws s3 cp dist/index.html s3://bond-discovery-prod/index.html \
  --cache-control max-age=0
```

#### 5. Create CloudFront Distribution
```bash
# In AWS Console:
# 1. CloudFront → Create Distribution
# 2. Origin: S3 bucket
# 3. Cache policy: CachingOptimized
# 4. Enable compression
# 5. Create
```

#### 6. Point Domain
In Route53:
1. Create A record pointing to CloudFront domain
2. Add CNAME for www

### Result
Your app will be live at: `discovery.yourdomain.com`

---

## Option 4: Docker + Self-Hosted

For complete control or corporate deployment.

### Build Docker Image

#### 1. Create Dockerfile
```dockerfile
# Build stage
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 2. Create nginx.conf
```nginx
server {
    listen 80;
    server_name _;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Route all others to index.html for React Router
    location / {
        try_files $uri $uri/ /index.html;
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

#### 3. Build Image
```bash
docker build -t bond-discovery:latest .
```

#### 4. Run Container
```bash
docker run -p 80:80 -d \
  --name bond-discovery \
  bond-discovery:latest
```

#### 5. Access App
```
http://localhost
```

### Push to Registry

#### Docker Hub
```bash
docker login
docker tag bond-discovery:latest yourname/bond-discovery:latest
docker push yourname/bond-discovery:latest
```

#### Deploy to Container Service
```bash
# Google Cloud Run
gcloud run deploy bond-discovery \
  --image yourname/bond-discovery:latest \
  --platform managed

# AWS ECS
# Use AWS Console or CLI

# Kubernetes
kubectl apply -f bond-discovery-deployment.yaml
```

---

## Option 5: GitHub Pages (Free, Static Only)

Best for demo/portfolio.

### Steps

#### 1. Update vite.config.ts
```typescript
export default defineConfig({
  base: '/bond-discovery/', // Your repo name
  // ... rest of config
})
```

#### 2. Build
```bash
npm run build
```

#### 3. Deploy
```bash
# Push dist to gh-pages branch
git push origin `git subtree split --prefix dist`:gh-pages --force
```

#### 4. Configure GitHub
1. Go to Settings → Pages
2. Select `gh-pages` branch
3. Your site will be live at: `yourname.github.io/bond-discovery`

---

## Production Configuration

### Environment Variables

Create `.env.production`:
```bash
VITE_API_URL=https://public.api.bondsports.co/v1
VITE_API_KEY=zhoZODDEKuaexCBkvumrU7c84TbC3zsC4hENkjlz
VITE_APP_NAME=Bond Discovery
```

Update code:
```typescript
// src/api/bondClient.ts
const BASE_URL = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;
```

### Performance Optimization

#### 1. Enable Compression
```typescript
// vite.config.ts
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    compression()
  ]
})
```

#### 2. Bundle Analysis
```bash
npm install --save-dev vite-plugin-visualizer
```

#### 3. Optimize Images
- Convert to WebP
- Use lazy loading
- Add responsive images

### Security

#### 1. Headers (nginx)
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' https: data: blob: 'unsafe-inline'" always;
```

#### 2. HTTPS Only
```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    return 301 https://$server_name$request_uri;
}
```

#### 3. Hide API Key
Never expose API key in frontend code. Instead:
1. Create backend proxy
2. Use API key only on backend
3. Frontend calls backend endpoint
4. Backend forwards to Bond API

---

## Monitoring & Logging

### Check Deployment Status

#### Vercel
```bash
vercel --prod
```

#### Netlify
```bash
netlify deploy --prod --dir=dist
```

#### Docker
```bash
docker logs -f bond-discovery
```

### Monitor Performance

#### Lighthouse
```bash
# In Chrome DevTools
# Audits tab → Run audit
```

#### Sentry (Error Tracking)
```bash
npm install @sentry/react
# Add to src/main.tsx
```

---

## Rollback

### Git-based Deployments
```bash
# Revert last commit
git revert HEAD
git push  # Auto-redeploys

# Or deploy specific commit
git push origin commit-hash:main
```

### Docker
```bash
# Switch to previous image
docker stop bond-discovery
docker run -p 80:80 -d bond-discovery:previous
```

---

## Troubleshooting

### 404 Errors
**Problem:** Single-page app 404 on route changes

**Solution:** Configure web server to serve `index.html` for all routes

```nginx
try_files $uri $uri/ /index.html;
```

### CSS Not Loading
**Problem:** Styles don't appear after deploy

**Solution:** Check `base` path in `vite.config.ts`

```typescript
base: '/'  // Adjust if in subdirectory
```

### API Not Responding
**Problem:** Programs don't load in production

**Solution:** Check:
1. API key is correct
2. CORS is enabled
3. Network requests in DevTools
4. Check browser console

### Slow Performance
**Problem:** App loads slowly

**Solution:**
1. Check bundle size: `npm run build -- --analyze`
2. Enable caching headers
3. Enable compression
4. Use CDN

---

## Deployment Checklist by Platform

### ✅ Vercel
- [ ] GitHub repo created
- [ ] Connected to Vercel
- [ ] Auto-deploy enabled
- [ ] Custom domain configured
- [ ] Environment variables set (if needed)

### ✅ Netlify
- [ ] dist/ folder built
- [ ] Uploaded via UI or CLI
- [ ] Build command configured: `npm run build`
- [ ] Publish directory: `dist`
- [ ] Custom domain configured

### ✅ S3 + CloudFront
- [ ] S3 bucket created and public
- [ ] Static website hosting enabled
- [ ] dist/ uploaded to S3
- [ ] CloudFront distribution created
- [ ] Domain DNS configured
- [ ] SSL certificate valid

### ✅ Docker
- [ ] Dockerfile created
- [ ] Docker image built
- [ ] Image pushed to registry (optional)
- [ ] Container running and tested
- [ ] Port 80 forwarded
- [ ] Restart policy configured

### ✅ GitHub Pages
- [ ] Repository public
- [ ] vite.config.ts `base` set correctly
- [ ] Build and deploy script working
- [ ] GitHub Pages enabled
- [ ] Custom domain configured (optional)

---

## Post-Deployment

### 1. Test in Production
```bash
# Test all filters
# Test API calls
# Test responsive design
# Check console for errors
```

### 2. Set Up Monitoring
```bash
# Add Sentry, DataDog, or CloudWatch
# Monitor uptime and errors
```

### 3. Configure Analytics
```bash
# Add Google Analytics or Plausible
# Track user behavior
```

### 4. Set Up Backups
```bash
# For database (if added later)
# Automated daily backups
```

### 5. Document the Deployment
```bash
# Store deployment notes
# Record credentials safely
# Document rollback procedures
```

---

## Getting Help

- **Vercel Docs:** https://vercel.com/docs
- **Netlify Docs:** https://docs.netlify.com
- **AWS S3 Docs:** https://docs.aws.amazon.com/s3/
- **Docker Docs:** https://docs.docker.com
- **Nginx Docs:** https://nginx.org/en/docs/

---

## Next Steps After Deployment

1. Monitor uptime and performance
2. Gather user feedback
3. Iterate on features
4. Add analytics tracking
5. Consider session booking integration
6. Add admin panel

---

**Deployment Date:** [Your Date]
**Environment:** Production
**Version:** 1.0.0
**Status:** Live ✅

---

**Need help?** Check the main `README.md` or `QUICKSTART.md` for more info.

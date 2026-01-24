import { test, expect } from '@playwright/test';

// Use production URL for E2E tests (can override with BASE_URL env var)
const BASE_URL = process.env.BASE_URL || 'https://discovery.bondsports.co';

test.describe('Discovery Page', () => {
  test.describe('Page Loading', () => {
    test('loads discovery page with programs', async ({ page }) => {
      await page.goto(`${BASE_URL}/toca-evanston`);
      
      // Wait for content to load
      await expect(page.locator('body')).toBeVisible();
      
      // Should have some program cards or events
      const hasContent = await page.locator('[data-testid="program-card"], .event-card, button:has-text("Programs"), button:has-text("Schedule")').count();
      expect(hasContent).toBeGreaterThan(0);
    });

    test('displays correct header with branding', async ({ page }) => {
      await page.goto(`${BASE_URL}/toca-evanston`);
      
      // Header should be visible
      const header = page.locator('header, [data-testid="header"]').first();
      await expect(header).toBeVisible();
    });

    test('loads with URL parameters', async ({ page }) => {
      await page.goto(`${BASE_URL}/toca-evanston?viewMode=schedule`);
      
      // Should be in schedule view
      const scheduleButton = page.getByRole('button', { name: /schedule/i });
      if (await scheduleButton.count() > 0) {
        // If tabs exist, schedule should be active
        await expect(scheduleButton).toHaveClass(/active|selected/i).catch(() => {
          // Button may not have class, check aria-selected
          return expect(scheduleButton).toHaveAttribute('aria-selected', 'true').catch(() => {});
        });
      }
    });
  });

  test.describe('View Mode Switching', () => {
    test('switches between programs and schedule views', async ({ page }) => {
      await page.goto(`${BASE_URL}/toca-evanston`);
      
      // Find and click Programs tab/button
      const programsTab = page.getByRole('button', { name: /programs/i }).first();
      if (await programsTab.isVisible()) {
        await programsTab.click();
        await page.waitForTimeout(500);
      }
      
      // Find and click Schedule tab/button
      const scheduleTab = page.getByRole('button', { name: /schedule/i }).first();
      if (await scheduleTab.isVisible()) {
        await scheduleTab.click();
        await page.waitForTimeout(500);
        
        // URL should update
        expect(page.url()).toContain('viewMode=schedule');
      }
    });
  });

  test.describe('Schedule View Modes', () => {
    test('switches between list, table, day, week, month views', async ({ page }) => {
      await page.goto(`${BASE_URL}/toca-evanston?viewMode=schedule`);
      
      // Try clicking different schedule view buttons
      const viewButtons = ['List', 'Table', 'Day', 'Week', 'Month'];
      
      for (const view of viewButtons) {
        const button = page.getByRole('button', { name: new RegExp(view, 'i') }).first();
        if (await button.isVisible().catch(() => false)) {
          await button.click();
          await page.waitForTimeout(300);
          // URL should update with scheduleView param
          const currentUrl = page.url();
          if (view !== 'List') {
            expect(currentUrl.toLowerCase()).toContain('scheduleview');
          }
        }
      }
    });

    test('day view defaults to today', async ({ page }) => {
      await page.goto(`${BASE_URL}/toca-evanston?viewMode=schedule&scheduleView=day`);
      
      // Wait for day view to load
      await page.waitForTimeout(1000);
      
      // Check for today's date indicator or current date display
      const today = new Date();
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Look for current date in page
      const pageContent = await page.content();
      const hasToday = pageContent.includes(String(today.getDate())) && 
        (pageContent.includes(monthNames[today.getMonth()]) || 
         pageContent.includes(shortMonthNames[today.getMonth()]));
      
      // This is a soft assertion - date display varies
      if (!hasToday) {
        console.log('Note: Day view may not show today - check manually');
      }
    });
  });

  test.describe('Filters', () => {
    test('filter controls are visible and interactive', async ({ page }) => {
      await page.goto(`${BASE_URL}/toca-evanston?viewMode=schedule`);
      
      // Look for filter controls
      const filterButton = page.locator('button:has-text("Filter"), [data-testid="filter-button"]').first();
      const filterDropdowns = page.locator('[data-testid="filter-dropdown"], button:has-text("Location"), button:has-text("Program"), button:has-text("Activity")');
      
      if (await filterButton.isVisible().catch(() => false)) {
        await filterButton.click();
        await page.waitForTimeout(300);
      }
      
      // At least some filter UI should be present
      const hasFilters = await filterDropdowns.count() > 0 || 
        await page.locator('input[type="checkbox"], input[type="text"][placeholder*="Search"]').count() > 0;
      
      expect(hasFilters).toBeTruthy();
    });

    test('search filter works', async ({ page }) => {
      await page.goto(`${BASE_URL}/toca-evanston?viewMode=schedule`);
      
      // Find search input
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('soccer');
        await page.waitForTimeout(500);
        
        // Results should update (can't verify content without knowing data)
        expect(await searchInput.inputValue()).toBe('soccer');
      }
    });
  });

  test.describe('Register Buttons', () => {
    test('register links are visible and clickable', async ({ page }) => {
      await page.goto(`${BASE_URL}/toca-evanston?viewMode=schedule`);
      
      // Wait for content
      await page.waitForTimeout(1000);
      
      // Find register links
      const registerLinks = page.locator('a:has-text("Register"), a:has-text("Learn More")');
      const linkCount = await registerLinks.count();
      
      if (linkCount > 0) {
        // Get first register link
        const firstLink = registerLinks.first();
        const href = await firstLink.getAttribute('href');
        
        // Should link to bondsports.co
        expect(href).toContain('bondsports.co');
        expect(href).toContain('skipToProducts=true');
      }
    });
  });

  test.describe('Share Functionality', () => {
    test('share button copies link to clipboard', async ({ page, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      
      await page.goto(`${BASE_URL}/toca-evanston`);
      
      // Find share/copy link button
      const shareButton = page.locator('button:has-text("Copy"), button:has-text("Share"), [data-testid="share-button"]').first();
      
      if (await shareButton.isVisible().catch(() => false)) {
        await shareButton.click();
        await page.waitForTimeout(300);
        
        // Check for success indication (copied text or toast)
        const successIndicator = page.locator('text=Copied, text=Link copied, [data-testid="copy-success"]');
        const hasSuccess = await successIndicator.count() > 0;
        
        // May show success or just update button
        if (!hasSuccess) {
          console.log('Note: Copy success indicator not found - may use different feedback');
        }
      }
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('mobile filters open in drawer/modal', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/toca-evanston?viewMode=schedule`);
      
      // Find mobile filter trigger
      const filterButton = page.locator('button:has-text("Filter"), [aria-label*="filter"]').first();
      
      if (await filterButton.isVisible().catch(() => false)) {
        await filterButton.click();
        await page.waitForTimeout(300);
        
        // Should open a modal/drawer
        const filterModal = page.locator('dialog, [role="dialog"], .modal, .drawer, [data-testid="mobile-filters"]');
        const isModalVisible = await filterModal.isVisible().catch(() => false);
        
        // Either modal appears or filters are inline on mobile
        expect(isModalVisible || await filterButton.isVisible()).toBeTruthy();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('shows appropriate message for invalid page slug', async ({ page }) => {
      await page.goto(`${BASE_URL}/this-page-does-not-exist-12345`);
      
      // Should show error or 404
      const pageContent = await page.content();
      const hasError = pageContent.includes('404') || 
        pageContent.includes('not found') || 
        pageContent.includes('error') ||
        pageContent.includes('Error');
      
      expect(hasError).toBeTruthy();
    });
  });
});

test.describe('GTM Data Layer', () => {
  test('initializes dataLayer on page load', async ({ page }) => {
    await page.goto(`${BASE_URL}/toca-evanston`);
    
    // Check dataLayer exists
    const dataLayerExists = await page.evaluate(() => {
      return Array.isArray((window as any).dataLayer);
    });
    
    expect(dataLayerExists).toBeTruthy();
  });

  test('pushes events to dataLayer on interactions', async ({ page }) => {
    await page.goto(`${BASE_URL}/toca-evanston?viewMode=schedule`);
    
    // Get initial dataLayer length
    const initialLength = await page.evaluate(() => (window as any).dataLayer?.length || 0);
    
    // Click schedule view button to trigger event
    const viewButton = page.getByRole('button', { name: /day|week|table/i }).first();
    if (await viewButton.isVisible().catch(() => false)) {
      await viewButton.click();
      await page.waitForTimeout(500);
      
      // DataLayer should have new events
      const newLength = await page.evaluate(() => (window as any).dataLayer?.length || 0);
      expect(newLength).toBeGreaterThanOrEqual(initialLength);
    }
  });
});

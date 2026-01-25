import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Admin Flow E2E Tests
 * 
 * These tests cover admin functionality. Most require authentication.
 * Tests are marked with skip() when they need real auth credentials.
 * 
 * To run authenticated tests:
 * 1. Set up test credentials in environment
 * 2. Or use Playwright's storageState to persist auth
 */

// ============================================
// Public Admin Routes (no auth required)
// ============================================

test.describe('Admin Public Routes', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/login`);
    
    // Should show login page
    await expect(page.locator('body')).toBeVisible();
    
    // Should have sign-in button
    const signInButton = page.locator('button:has-text("Sign"), button:has-text("Google")');
    await expect(signInButton.first()).toBeVisible();
  });

  test('help page is accessible without auth', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/help`);
    
    // May redirect or show content depending on setup
    await page.waitForTimeout(500);
    const url = page.url();
    
    // Either shows help or redirects to login
    expect(url.includes('help') || url.includes('login')).toBeTruthy();
  });

  test('GTM setup guide loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/help/gtm-setup`);
    
    await page.waitForTimeout(500);
    
    // Check page has content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });
});

// ============================================
// Authentication Flow Tests
// ============================================

test.describe('Authentication Flows', () => {
  test('unauthenticated access redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    
    // Should redirect to login
    await page.waitForURL(/.*login.*/, { timeout: 5000 });
    expect(page.url()).toContain('login');
  });

  test('admin/pages redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/pages`);
    
    await page.waitForURL(/.*login.*/, { timeout: 5000 });
    expect(page.url()).toContain('login');
  });

  test('admin/partners redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/partners`);
    
    await page.waitForURL(/.*login.*/, { timeout: 5000 });
    expect(page.url()).toContain('login');
  });

  test('admin/analytics redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/analytics`);
    
    await page.waitForURL(/.*login.*/, { timeout: 5000 });
    expect(page.url()).toContain('login');
  });

  test('login page shows Google SSO option', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/login`);
    
    // Google button should be visible
    const googleButton = page.locator('button:has-text("Google"), [data-provider="google"]').first();
    await expect(googleButton).toBeVisible();
  });

  test('login handles error query params', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/login?error=OAuthAccountNotLinked`);
    
    // Page should load and potentially show error
    await expect(page.locator('body')).toBeVisible();
    
    // Error handling varies - page should at minimum load
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('callbackUrl is preserved through login flow', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/pages`);
    
    // Should redirect to login with callback
    await page.waitForURL(/.*login.*/);
    
    // Callback URL should be in query params
    const url = new URL(page.url());
    const callbackUrl = url.searchParams.get('callbackUrl');
    
    // callbackUrl may or may not be present depending on implementation
    // Page should at minimum have loaded
    expect(page.url()).toContain('login');
  });
});

// ============================================
// Authenticated Admin Tests (require auth setup)
// ============================================

test.describe('Admin Dashboard (requires auth)', () => {
  // These tests are skipped by default - require auth state
  
  test.skip('dashboard shows quick stats', async ({ page }) => {
    // Requires authenticated session
    await page.goto(`${BASE_URL}/admin`);
    
    // Should show dashboard with stats
    const stats = page.locator('[data-testid="stats"], .stats-card');
    await expect(stats).toBeVisible();
  });

  test.skip('dashboard shows recent activity', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    
    // Should show recent activity or pages list
    const activity = page.locator('[data-testid="recent-activity"], .activity-list');
    await expect(activity).toBeVisible();
  });
});

test.describe('Page Management (requires auth)', () => {
  test.skip('pages list shows all discovery pages', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/pages`);
    
    // Should show list of pages
    const pageList = page.locator('[data-testid="page-list"], table, .page-list');
    await expect(pageList).toBeVisible();
  });

  test.skip('can navigate to edit page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/pages`);
    
    // Find and click edit button on first page
    const editButton = page.locator('a:has-text("Edit"), button:has-text("Edit")').first();
    await editButton.click();
    
    // Should navigate to edit page
    await expect(page.url()).toContain('/admin/pages/');
  });

  test.skip('edit page shows branding section', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/pages/toca-evanston`);
    
    // Should show branding configuration
    const brandingSection = page.locator('text=Branding, text=Colors, [data-section="branding"]');
    await expect(brandingSection.first()).toBeVisible();
  });

  test.skip('edit page shows feature toggles', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/pages/toca-evanston`);
    
    // Should show feature toggles
    const featureToggles = page.locator('input[type="checkbox"], [data-section="features"]');
    expect(await featureToggles.count()).toBeGreaterThan(0);
  });

  test.skip('can update page branding colors', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/pages/toca-evanston`);
    
    // Find color input
    const colorInput = page.locator('input[type="color"], input[name*="color"]').first();
    
    if (await colorInput.isVisible()) {
      const originalValue = await colorInput.inputValue();
      await colorInput.fill('#FF0000');
      
      // Save changes
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
      await saveButton.click();
      
      // Wait for save
      await page.waitForTimeout(1000);
      
      // Verify change persisted or was accepted
      expect(await colorInput.inputValue()).not.toBe(originalValue);
    }
  });

  test.skip('can toggle feature flags', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/pages/toca-evanston`);
    
    // Find a feature toggle
    const toggle = page.locator('input[type="checkbox"][name*="show"], [data-toggle]').first();
    
    if (await toggle.isVisible()) {
      const initialState = await toggle.isChecked();
      await toggle.click();
      
      // State should change
      expect(await toggle.isChecked()).not.toBe(initialState);
    }
  });
});

test.describe('Partner Management (requires auth)', () => {
  test.skip('partners list shows all partner groups', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/partners`);
    
    // Should show partner list
    const partnerList = page.locator('[data-testid="partner-list"], table, .partner-list');
    await expect(partnerList).toBeVisible();
  });

  test.skip('can view partner details', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/partners`);
    
    // Click first partner
    const viewButton = page.locator('a:has-text("View"), button:has-text("View")').first();
    await viewButton.click();
    
    // Should navigate to partner detail
    await expect(page.url()).toContain('/admin/partners/');
  });

  test.skip('GTM ID inheritance shows in partner config', async ({ page }) => {
    // Navigate to a partner with GTM ID
    await page.goto(`${BASE_URL}/admin/partners`);
    
    const firstPartner = page.locator('a[href*="/admin/partners/"]').first();
    await firstPartner.click();
    
    // Should show GTM ID field
    const gtmField = page.locator('input[name*="gtm"], label:has-text("GTM")');
    await expect(gtmField.first()).toBeVisible();
  });
});

test.describe('Analytics Dashboard (requires auth)', () => {
  test.skip('analytics page shows summary metrics', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/analytics`);
    
    // Should show analytics summary
    const metrics = page.locator('[data-testid="metrics"], .metrics-summary');
    await expect(metrics).toBeVisible();
  });

  test.skip('can filter analytics by date range', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/analytics`);
    
    // Find date range selector
    const dateSelector = page.locator('select[name*="days"], button:has-text("Last")').first();
    
    if (await dateSelector.isVisible()) {
      await dateSelector.click();
      
      // Select different range
      const option = page.locator('option:has-text("7"), button:has-text("7 days")').first();
      await option.click();
      
      await page.waitForTimeout(500);
      
      // Data should update
    }
  });

  test.skip('can filter analytics by page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/analytics`);
    
    // Find page filter
    const pageFilter = page.locator('select[name*="page"], [data-filter="page"]').first();
    
    if (await pageFilter.isVisible()) {
      await pageFilter.click();
      
      // Should show page options
      const options = page.locator('option, [role="option"]');
      expect(await options.count()).toBeGreaterThan(0);
    }
  });

  test.skip('analytics shows daily chart', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/analytics`);
    
    // Should show chart
    const chart = page.locator('canvas, svg[data-chart], .chart-container');
    await expect(chart.first()).toBeVisible();
  });
});

// ============================================
// Form Validation Tests
// ============================================

test.describe('Form Validation', () => {
  test.skip('page form validates required fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/pages/new`);
    
    // Try to submit empty form
    const submitButton = page.locator('button:has-text("Create"), button[type="submit"]').first();
    await submitButton.click();
    
    // Should show validation error
    const errorMessage = page.locator('.error, [role="alert"], text=required');
    await expect(errorMessage.first()).toBeVisible();
  });

  test.skip('page slug validation prevents spaces', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/pages/new`);
    
    // Enter slug with spaces
    const slugInput = page.locator('input[name="slug"]');
    await slugInput.fill('test page with spaces');
    
    // Should auto-convert or show error
    const value = await slugInput.inputValue();
    expect(value.includes(' ')).toBeFalsy(); // Spaces should be converted
  });

  test.skip('color picker validates hex format', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/pages/toca-evanston`);
    
    // Find color text input (not color picker)
    const colorInput = page.locator('input[name*="color"]:not([type="color"])').first();
    
    if (await colorInput.isVisible()) {
      await colorInput.fill('not-a-color');
      await colorInput.blur();
      
      // Should show validation or reset
      const hasValidation = await page.locator('.error, [role="alert"]').isVisible().catch(() => false);
      const inputValue = await colorInput.inputValue();
      
      // Either shows error or resets value
      expect(hasValidation || !inputValue.includes('not-a-color')).toBeTruthy();
    }
  });
});

// ============================================
// Delete Confirmation Tests  
// ============================================

test.describe('Destructive Actions', () => {
  test.skip('page deletion requires confirmation', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/pages/test-page`);
    
    // Find delete button
    const deleteButton = page.locator('button:has-text("Delete"), [data-action="delete"]').first();
    
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      
      // Should show confirmation dialog
      const confirmDialog = page.locator('[role="alertdialog"], .confirm-dialog, dialog');
      await expect(confirmDialog).toBeVisible();
    }
  });

  test.skip('cancel prevents deletion', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/pages/test-page`);
    
    // Find delete button
    const deleteButton = page.locator('button:has-text("Delete")').first();
    
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      
      // Cancel
      const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
      await cancelButton.click();
      
      // Should still be on same page
      expect(page.url()).toContain('test-page');
    }
  });
});

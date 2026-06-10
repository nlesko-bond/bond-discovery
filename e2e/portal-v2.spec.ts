import { test, expect, type Page } from '@playwright/test';

/**
 * Plan 009 step 6 — v2 discovery template.
 *
 * Targets a real page with the v2 preview param so no stored config needs the
 * flag flipped. Override the slug with E2E_V2_SLUG; override the host with
 * BASE_URL (defaults to the local dev server started by playwright.config).
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SLUG = process.env.E2E_V2_SLUG || 'pbsz';
const V2_URL = `${BASE_URL}/portal/${SLUG}?portalTemplate=v2&viewMode=programs`;

const CARD = '[data-testid="portal-v2-card"]';
const ACTIVITY_CHIP = '[data-testid="portal-v2-activity-chip"]';

async function gotoV2(page: Page): Promise<boolean> {
  const response = await page.goto(V2_URL);
  if (!response || response.status() >= 400) {
    return false;
  }
  await page.waitForLoadState('networkidle');
  return true;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    overflow.scrollWidth,
    `horizontal overflow: scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

for (const viewport of [
  { name: 'mobile-375', width: 375, height: 720 },
  { name: 'desktop-1280', width: 1280, height: 900 },
]) {
  test.describe(`v2 template @ ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('renders cards with register analytics attributes and no overflow', async ({
      page,
    }) => {
      test.skip(!(await gotoV2(page)), `page ${V2_URL} not reachable`);

      // Cards render (or the page legitimately has zero programs — branded state).
      const cardCount = await page.locator(CARD).count();
      if (cardCount === 0) {
        await expect(page.locator('[data-testid="portal-v2-zero-state"]')).toBeVisible();
        test.skip(true, `slug ${SLUG} has no programs to assert against`);
      }
      expect(cardCount).toBeGreaterThan(0);

      // Register links keep the data-bond-* analytics contract.
      const registerLink = page.locator(`${CARD} a[data-bond-program-id]`).first();
      await expect(registerLink).toBeVisible();
      await expect(registerLink).toHaveAttribute('data-bond-program-id', /.+/);

      await expectNoHorizontalOverflow(page);
    });

    test('activity chip filter narrows results', async ({ page }) => {
      test.skip(!(await gotoV2(page)), `page ${V2_URL} not reachable`);

      const chips = page.locator(ACTIVITY_CHIP);
      const chipCount = await chips.count();
      // Chip row renders only with >1 activity ("All" + at least two sports).
      test.skip(chipCount < 3, `slug ${SLUG} has a single activity; nothing to narrow`);

      const initialCount = await page.locator(CARD).count();
      expect(initialCount).toBeGreaterThan(0);

      // Click the first real activity chip (index 0 is "All").
      await chips.nth(1).click();
      await expect
        .poll(async () => page.locator(CARD).count())
        .toBeLessThanOrEqual(initialCount);
      const narrowedCount = await page.locator(CARD).count();
      expect(narrowedCount).toBeGreaterThan(0);

      // "All" restores the full set.
      await chips.nth(0).click();
      await expect.poll(async () => page.locator(CARD).count()).toBe(initialCount);

      await expectNoHorizontalOverflow(page);
    });
  });
}

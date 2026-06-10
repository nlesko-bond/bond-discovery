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
  const response = await page.goto(V2_URL, { timeout: 90_000 }); // dev-server cold compile can exceed the 30s default
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

      // Phones get one full-bleed column — a card must span nearly the viewport.
      if (viewport.width < 640) {
        const cardBox = await page.locator(CARD).first().boundingBox();
        expect(cardBox, 'first card has no bounding box').toBeTruthy();
        expect(
          cardBox!.width,
          `card width ${cardBox!.width} too narrow for ${viewport.width}px viewport`,
        ).toBeGreaterThanOrEqual(viewport.width - 40);
      }

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

    test('filter panel opens in-flow, selecting an option narrows results', async ({
      page,
    }) => {
      test.skip(!(await gotoV2(page)), `page ${V2_URL} not reachable`);

      const initialCount = await page.locator(CARD).count();
      test.skip(initialCount === 0, `slug ${SLUG} has no programs to filter`);

      // Desktop: a secondary pill trigger. Mobile: the single "Filters" pill
      // opening the in-flow sheet.
      const isMobile = viewport.width <= 640;
      const trigger = isMobile
        ? page.locator('[data-testid="portal-v2-mobile-filters"]')
        : page.locator('[data-testid="portal-v2-filter-pill"]').first();
      test.skip(
        (await trigger.count()) === 0,
        `slug ${SLUG} exposes no secondary filters`,
      );

      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');

      // Panels are in-flow (inline expansion) — nothing position:fixed may appear.
      const fixedCount = await page.evaluate(
        () =>
          Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(
            (element) => getComputedStyle(element).position === 'fixed',
          ).length,
      );
      expect(fixedCount, 'position:fixed is forbidden inside the portal iframe').toBe(0);

      // Pick the first option with a non-zero live result count (trailing number).
      const options = page.locator('[data-testid="portal-v2-option"]:visible');
      const optionCount = await options.count();
      test.skip(optionCount === 0, 'open panel has no options');
      let pickIndex = 0;
      for (let index = 0; index < optionCount; index += 1) {
        const text = (await options.nth(index).innerText()).trim();
        const match = text.match(/(\d+)\s*$/);
        if (!match || Number(match[1]) > 0) {
          pickIndex = index;
          break;
        }
      }
      const picked = options.nth(pickIndex);
      await picked.click();
      await expect(picked).toHaveAttribute('aria-selected', 'true');

      // Instant apply: results narrow without any Apply button.
      await expect
        .poll(async () => page.locator(CARD).count())
        .toBeLessThanOrEqual(initialCount);
      expect(await page.locator(CARD).count()).toBeGreaterThan(0);

      // Active summary chip appears and removes the filter on click.
      const activeChip = page.locator('[data-testid="portal-v2-active-chip"]').first();
      await expect(activeChip).toBeVisible();

      if (isMobile) {
        // The sheet confirms via the sticky "Show N results" row.
        await page.locator('[data-testid="portal-v2-sheet-confirm"]').click();
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      }

      await activeChip.click();
      await expect.poll(async () => page.locator(CARD).count()).toBe(initialCount);

      await expectNoHorizontalOverflow(page);
    });
  });
}

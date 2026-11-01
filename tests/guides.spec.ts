import { test, expect } from '@playwright/test';

test.describe('Guides Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/guides');
  });

  test('should display guides page with title and subtitle', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Guides & Articles');
    await expect(page.locator('.guides-header__subtitle')).toContainText('Expert advice');
  });

  test('should display category filter buttons', async ({ page }) => {
    const categoryNav = page.locator('.category-nav');
    await expect(categoryNav).toBeVisible();

    // Check all category buttons exist
    await expect(categoryNav.locator('button')).toHaveCount(5);
    await expect(categoryNav.getByText('All')).toBeVisible();
    await expect(categoryNav.getByText('Buying Guides')).toBeVisible();
    await expect(categoryNav.getByText('Tutorials')).toBeVisible();
    await expect(categoryNav.getByText('Comparisons')).toBeVisible();
    await expect(categoryNav.getByText('News')).toBeVisible();
  });

  test('should display featured section with hero card', async ({ page }) => {
    const featuredSection = page.locator('.featured-section');
    await expect(featuredSection).toBeVisible();

    // Check featured section title
    await expect(featuredSection.locator('.section-title')).toContainText('Featured');

    // Check hero card exists
    const heroCard = page.locator('.guide-card--hero');
    await expect(heroCard).toBeVisible();
  });

  test('should display guide cards with actual images', async ({ page }) => {
    const cards = page.locator('.guide-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Check that cards have images
    for (let i = 0; i < Math.min(count, 3); i++) {
      const card = cards.nth(i);
      const imageWrapper = card.locator('.guide-card__image-wrapper');
      await expect(imageWrapper).toBeVisible();

      // Either has an actual image or a fallback
      const hasImage = await card.locator('.guide-card__image').count() > 0;
      const hasFallback = await card.locator('.guide-card__image-fallback').count() > 0;
      expect(hasImage || hasFallback).toBeTruthy();
    }
  });

  test('should display category badges on images', async ({ page }) => {
    const cards = page.locator('.guide-card');
    const count = await cards.count();

    for (let i = 0; i < Math.min(count, 3); i++) {
      const card = cards.nth(i);
      const badge = card.locator('.guide-card__category-badge');
      await expect(badge).toBeVisible();

      // Badge should have a background color
      const bgColor = await badge.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      );
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('should display reading time on cards', async ({ page }) => {
    // At least some cards should have reading time
    const readingTimes = page.locator('.guide-card__reading-time');
    const count = await readingTimes.count();
    expect(count).toBeGreaterThan(0);

    // Verify reading time format
    const firstReadingTime = readingTimes.first();
    await expect(firstReadingTime).toContainText('min');
  });

  test('should display correct content in each guide card', async ({ page }) => {
    const cards = page.locator('.guide-card');
    const count = await cards.count();

    for (let i = 0; i < Math.min(count, 3); i++) {
      const card = cards.nth(i);

      // Each card should have a title
      const title = card.locator('.guide-card__title');
      await expect(title).toBeVisible();
      const titleText = await title.textContent();
      expect(titleText?.length).toBeGreaterThan(5);

      // Each card should have a description
      const description = card.locator('.guide-card__description');
      await expect(description).toBeVisible();

      // Each card should have a date
      const date = card.locator('time');
      await expect(date).toBeVisible();

      // Each card should have "Read" link
      await expect(card.locator('.guide-card__read-more')).toBeVisible();
    }
  });

  test('should display tags on featured cards', async ({ page }) => {
    const featuredCards = page.locator('.guide-card--featured');
    const count = await featuredCards.count();

    if (count > 0) {
      // At least the hero card should have tags
      const heroCard = page.locator('.guide-card--hero');
      const tags = heroCard.locator('.guide-card__tags');
      const tagsExist = await tags.count() > 0;

      if (tagsExist) {
        await expect(tags).toBeVisible();
        const tagItems = tags.locator('.guide-card__tag');
        const tagCount = await tagItems.count();
        expect(tagCount).toBeGreaterThan(0);
        expect(tagCount).toBeLessThanOrEqual(3); // Max 3 tags shown
      }
    }
  });

  test('should filter guides when clicking category buttons', async ({ page }) => {
    const allButton = page.locator('.category-nav__btn').filter({ hasText: 'All' });
    const tutorialsButton = page.locator('.category-nav__btn').filter({ hasText: 'Tutorials' });

    // Get initial count of all visible cards
    const allCards = page.locator('.guide-card:visible');
    const initialCount = await allCards.count();
    expect(initialCount).toBeGreaterThan(0);

    // Click on Tutorials filter
    await tutorialsButton.click();
    await expect(tutorialsButton).toHaveClass(/category-nav__btn--active/);

    // Featured section should be hidden when filtering
    const featuredSection = page.locator('.featured-section');
    await expect(featuredSection).toBeHidden();

    // Only tutorial cards should be visible in main grid
    const visibleCards = page.locator('.guides-grid .guide-card:visible');
    const visibleCount = await visibleCards.count();

    for (let i = 0; i < visibleCount; i++) {
      const category = await visibleCards.nth(i).getAttribute('data-category');
      expect(category).toBe('tutorials');
    }

    // Click All to show all cards again
    await allButton.click();
    await expect(allButton).toHaveClass(/category-nav__btn--active/);

    // Featured section should be visible again
    await expect(featuredSection).toBeVisible();
  });

  test('guide cards should be clickable and navigate to guide pages', async ({ page }) => {
    const firstCard = page.locator('.guide-card').first();
    const link = firstCard.locator('.guide-card__link');

    const href = await link.getAttribute('href');
    expect(href).toMatch(/^\/guides\/.+/);

    await link.click();
    await expect(page).toHaveURL(new RegExp(href!.replace(/\//g, '\\/')));
  });

  test('should have image hover zoom effect', async ({ page }) => {
    const firstCard = page.locator('.guide-card').first();
    const image = firstCard.locator('.guide-card__image');

    // Check if there's an actual image
    const imageCount = await image.count();
    if (imageCount > 0) {
      // Get initial transform
      const initialTransform = await image.evaluate((el) =>
        window.getComputedStyle(el).transform
      );

      // Hover over the card
      await firstCard.hover();
      await page.waitForTimeout(500);

      // Get transform after hover
      const hoverTransform = await image.evaluate((el) =>
        window.getComputedStyle(el).transform
      );

      // Transform should include scale on hover
      expect(hoverTransform).not.toBe(initialTransform);
    }
  });

  test('should have proper visual hierarchy and spacing', async ({ page }) => {
    // Page header should be centered
    const header = page.locator('.guides-header');
    await expect(header).toHaveCSS('text-align', 'center');

    // Featured grid should be a grid
    const featuredGrid = page.locator('.featured-grid');
    if (await featuredGrid.count() > 0) {
      const display = await featuredGrid.evaluate((el) =>
        window.getComputedStyle(el).display
      );
      expect(display).toBe('grid');
    }

    // Cards grid should be a grid
    const grid = page.locator('.guides-grid');
    const display = await grid.evaluate((el) =>
      window.getComputedStyle(el).display
    );
    expect(display).toBe('grid');

    // Category nav should be centered with flex
    const nav = page.locator('.category-nav');
    await expect(nav).toHaveCSS('display', 'flex');
    await expect(nav).toHaveCSS('justify-content', 'center');
  });

  test('guide card images should not be empty gray', async ({ page }) => {
    const imageWrappers = page.locator('.guide-card__image-wrapper');
    const count = await imageWrappers.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const wrapper = imageWrappers.nth(i);

      // Should have either an image or a fallback with gradient
      const hasImage = await wrapper.locator('.guide-card__image').count() > 0;
      const hasFallback = await wrapper.locator('.guide-card__image-fallback').count() > 0;

      expect(hasImage || hasFallback).toBeTruthy();

      if (hasImage) {
        const img = wrapper.locator('.guide-card__image');
        const src = await img.getAttribute('src');
        expect(src).toBeTruthy();
        expect(src?.length).toBeGreaterThan(0);
      }

      if (hasFallback) {
        const fallback = wrapper.locator('.guide-card__image-fallback');
        const style = await fallback.getAttribute('style');
        expect(style).toContain('linear-gradient');
      }
    }
  });

  test('should display "More Articles" section when there are regular guides', async ({ page }) => {
    const moreArticlesTitle = page.locator('.all-guides-section .section-title');

    // If there are both featured and regular guides, this section should be visible
    const featuredSection = page.locator('.featured-section');
    const guidesGrid = page.locator('.guides-grid .guide-card');

    const hasFeatured = await featuredSection.count() > 0;
    const hasRegularGuides = await guidesGrid.count() > 0;

    if (hasFeatured && hasRegularGuides) {
      await expect(moreArticlesTitle).toBeVisible();
      await expect(moreArticlesTitle).toContainText('More Articles');
    }
  });

  test('hero card should have horizontal layout on desktop', async ({ page }) => {
    // Check viewport is desktop size
    const viewportSize = page.viewportSize();
    if (viewportSize && viewportSize.width >= 900) {
      const heroCard = page.locator('.guide-card--hero');
      if (await heroCard.count() > 0) {
        const heroLink = heroCard.locator('.guide-card__link');
        const display = await heroLink.evaluate((el) =>
          window.getComputedStyle(el).display
        );
        expect(display).toBe('grid');
      }
    }
  });
});

test.describe('Guides Page - Visual Regression', () => {
  test('guides page should look correct', async ({ page }) => {
    await page.goto('/guides');
    await page.waitForLoadState('networkidle');

    // Wait for images to load
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('guides-page-redesign.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.15,
    });
  });

  test('featured card should have visible image', async ({ page }) => {
    await page.goto('/guides');
    await page.waitForLoadState('networkidle');

    const heroCard = page.locator('.guide-card--hero');
    if (await heroCard.count() > 0) {
      await expect(heroCard).toHaveScreenshot('hero-card.png', {
        maxDiffPixelRatio: 0.15,
      });
    }
  });
});

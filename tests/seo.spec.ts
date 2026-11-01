import { test, expect } from '@playwright/test';

test.describe('SEO - Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/AIGPUValue/);
  });

  test('should have meta description', async ({ page }) => {
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.{50,}/);
  });

  test('should have canonical URL', async ({ page }) => {
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', /https:\/\/aigpuvalue\.com/);
  });

  test('should have Open Graph tags', async ({ page }) => {
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /.+/);
  });

  test('should have Twitter Card tags', async ({ page }) => {
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    await expect(page.locator('meta[name="twitter:url"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', /.+/);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);
  });

  test('should have viewport meta tag', async ({ page }) => {
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute('content', /width=device-width/);
  });

  test('should have lang attribute on html', async ({ page }) => {
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'en');
  });
});

test.describe('SEO - Guide Pages', () => {
  test('guide page should have JSON-LD structured data', async ({ page }) => {
    await page.goto('/guides/best-budget-gpu-stable-diffusion-2025');

    const jsonLdScripts = await page.locator('script[type="application/ld+json"]').all();
    expect(jsonLdScripts.length).toBeGreaterThan(0);

    const jsonLdContent = await jsonLdScripts[0].textContent();
    const jsonLd = JSON.parse(jsonLdContent || '{}');

    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('Article');
    expect(jsonLd.headline).toBeTruthy();
    expect(jsonLd.description).toBeTruthy();
    expect(jsonLd.datePublished).toBeTruthy();
    expect(jsonLd.author).toBeTruthy();
    expect(jsonLd.publisher).toBeTruthy();
  });

  test('guide page should have unique title and description', async ({ page }) => {
    await page.goto('/guides/best-budget-gpu-stable-diffusion-2025');

    const title = await page.title();
    expect(title).toContain('Best Budget GPUs');
    expect(title).toContain('AIGPUValue');

    const metaDescription = page.locator('meta[name="description"]');
    const descContent = await metaDescription.getAttribute('content');
    expect(descContent).toContain('graphics card');
  });

  test('guide page should have breadcrumb navigation', async ({ page }) => {
    await page.goto('/guides/best-budget-gpu-stable-diffusion-2025');

    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).toBeVisible();

    await expect(breadcrumb.locator('a[href="/"]')).toContainText('Home');
    await expect(breadcrumb.locator('a[href="/guides"]')).toContainText('Guides');
  });

  test('guide page should have semantic article structure', async ({ page }) => {
    await page.goto('/guides/best-budget-gpu-stable-diffusion-2025');

    const article = page.locator('article');
    await expect(article).toBeVisible();

    // Should have time element with datetime attribute inside article
    const timeElement = article.locator('time[datetime]').first();
    await expect(timeElement).toBeVisible();
    const datetime = await timeElement.getAttribute('datetime');
    expect(datetime).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});

test.describe('SEO - Guides Index', () => {
  test('guides index should have proper meta tags', async ({ page }) => {
    await page.goto('/guides');

    const title = await page.title();
    expect(title).toContain('Guides');

    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.{30,}/);
  });
});

test.describe('SEO - Sitemap & Robots', () => {
  // Note: Sitemap files are generated at build time, not served in dev mode
  // These tests verify the robots.txt is properly configured

  test('robots.txt should be accessible', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    expect(response?.status()).toBe(200);

    const content = await page.content();
    expect(content).toContain('User-agent');
    expect(content).toContain('Sitemap');
  });

  test('robots.txt should reference sitemap', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    const content = await page.content();
    expect(content).toContain('sitemap-index.xml');
  });

  test('robots.txt should allow all crawlers', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    const content = await page.content();
    expect(content).toContain('Allow: /');
  });
});

test.describe('SEO - GPU Pages', () => {
  test('GPU page should have proper SEO structure', async ({ page }) => {
    await page.goto('/gpus/rtx-4090');

    // Should have unique title
    const title = await page.title();
    expect(title).toContain('RTX 4090');

    // Should have meta description
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.{30,}/);

    // Should have canonical URL
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', /rtx-4090/);
  });
});

test.describe('SEO - Accessibility Basics', () => {
  test('all images should have alt attributes', async ({ page }) => {
    await page.goto('/guides');
    await page.waitForLoadState('networkidle');

    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      expect(alt).not.toBeNull();
    }
  });

  test('skip link should exist for accessibility', async ({ page }) => {
    await page.goto('/');

    const skipLink = page.locator('a.skip-link');
    await expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  test('main content should have id for skip link', async ({ page }) => {
    await page.goto('/');

    const main = page.locator('main#main-content');
    await expect(main).toBeVisible();
  });
});

test.describe('SEO - Performance Hints', () => {
  test('should preconnect to external resources', async ({ page }) => {
    await page.goto('/');

    const preconnects = await page.locator('link[rel="preconnect"]').all();
    expect(preconnects.length).toBeGreaterThan(0);
  });

  test('should have favicon', async ({ page }) => {
    await page.goto('/');

    const favicon = page.locator('link[rel="icon"]');
    await expect(favicon).toHaveAttribute('href', /favicon/);
  });
});

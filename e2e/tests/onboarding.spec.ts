import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test('should display the onboarding page', async ({ page }) => {
    await page.goto('/onboarding');

    await expect(page.getByRole('heading', { name: /discover your business/i })).toBeVisible();
    await expect(page.getByPlaceholder(/company/i)).toBeVisible();
    await expect(page.getByPlaceholder(/yourcompany.com/i)).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/onboarding');

    const analyzeButton = page.getByRole('button', { name: /analyze/i });
    
    // Button should be disabled when fields are empty
    await expect(analyzeButton).toBeDisabled();

    // Fill in company name only
    await page.getByPlaceholder(/company/i).first().fill('Test Company');
    await expect(analyzeButton).toBeDisabled();

    // Fill in website
    await page.getByPlaceholder(/yourcompany.com/i).fill('https://test.com');
    await expect(analyzeButton).toBeEnabled();
  });

  test('should show loading state when analyzing', async ({ page }) => {
    await page.goto('/onboarding');

    // Fill in the form
    await page.getByPlaceholder(/company/i).first().fill('Test Company');
    await page.getByPlaceholder(/yourcompany.com/i).fill('https://test.com');

    // Mock the API response
    await page.route('**/api/clients', async (route) => {
      await route.fulfill({
        status: 201,
        body: JSON.stringify({ 
          data: { id: 'client-1', name: 'Test Company', website: 'https://test.com' } 
        }),
      });
    });

    await page.route('**/api/clients/*/discover', async (route) => {
      // Delay to show loading state
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          data: {
            icpSummary: 'Test ICP Summary',
            firmographicCriteria: {
              companySize: { employeeRanges: ['10-50'], revenueRanges: ['$1M-$10M'] },
              companyStage: ['growth'],
            },
            geographicTargeting: {
              primaryMarkets: [{ city: 'SF', state: 'CA', country: 'USA', priority: 'high' }],
            },
            industryTargeting: {
              primaryIndustries: [{ name: 'SaaS', subSegments: [], priority: 'high' }],
            },
            decisionMakerTargeting: {
              primaryTitles: ['CEO'],
              departments: ['Executive'],
            },
            messagingFramework: {
              primaryPainPointsToAddress: ['Pain point 1'],
              valuePropositions: ['Value prop 1'],
              proofPoints: ['Proof point 1'],
            },
          },
        }),
      });
    });

    // Click analyze
    await page.getByRole('button', { name: /analyze/i }).click();

    // Should show loading state
    await expect(page.getByText(/analyzing/i)).toBeVisible();
  });
});

test.describe('Dashboard', () => {
  test('should display dashboard with navigation', async ({ page }) => {
    await page.goto('/');

    // Should show dashboard or redirect to onboarding
    // This depends on authentication state
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
  });
});

test.describe('Campaigns', () => {
  test('should display campaigns page', async ({ page }) => {
    await page.goto('/campaigns');

    await expect(page.getByRole('heading', { name: /campaigns/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new campaign/i })).toBeVisible();
  });

  test('should open campaign builder modal', async ({ page }) => {
    await page.goto('/campaigns');

    await page.getByRole('button', { name: /new campaign/i }).click();

    // Modal should appear
    await expect(page.getByRole('heading', { name: /create campaign/i })).toBeVisible();
    await expect(page.getByText('Basics')).toBeVisible();
  });

  test('should navigate through campaign builder steps', async ({ page }) => {
    await page.goto('/campaigns');

    await page.getByRole('button', { name: /new campaign/i }).click();

    // Step 1: Basics
    await page.getByPlaceholder(/q1.*outreach/i).fill('Test Campaign');
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2: Prospects
    await expect(page.getByText('Select Prospects')).toBeVisible();
  });
});

test.describe('Prospects', () => {
  test('should display prospects page', async ({ page }) => {
    await page.goto('/prospects');

    await expect(page.getByRole('heading', { name: /prospects/i })).toBeVisible();
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test('should filter prospects by status', async ({ page }) => {
    await page.goto('/prospects');

    // Click on different status filters
    await page.getByRole('button', { name: /^new$/i }).click();
    await expect(page.getByRole('button', { name: /^new$/i })).toHaveClass(/primary/);

    await page.getByRole('button', { name: /contacted/i }).click();
    await expect(page.getByRole('button', { name: /contacted/i })).toHaveClass(/primary/);
  });
});

test.describe('Analytics', () => {
  test('should display analytics page', async ({ page }) => {
    await page.goto('/analytics');

    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();
  });

  test('should show key metrics cards', async ({ page }) => {
    await page.goto('/analytics');

    await expect(page.getByText(/total emails sent/i)).toBeVisible();
    await expect(page.getByText(/open rate/i)).toBeVisible();
    await expect(page.getByText(/reply rate/i)).toBeVisible();
  });
});

test.describe('Settings', () => {
  test('should display settings page', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });
});


import { expect, test } from '@playwright/test';

const filtersStorageKey = 'swiftcolis.matching-auto-assign.filters';
const lastRunStorageKey = 'swiftcolis.matching-auto-assign.last-run';

test.describe('Admin matching auto panel', () => {
  test('restaure les filtres et le dernier run, puis permet leur effacement', async ({ page, request }) => {
    await request.get('/api/seed');

    await page.addInitScript(() => {
      window.localStorage.setItem(
        'swiftcolis.matching-auto-assign.filters',
        JSON.stringify({
          villeDepart: 'alger',
          villeArrivee: 'oran',
          periodHours: '48',
          limit: '25',
        })
      );

      window.localStorage.setItem(
        'swiftcolis.matching-auto-assign.last-run',
        JSON.stringify({
          assigned: 3,
          processed: 5,
          skipped: 2,
          at: '2026-03-24T10:30:00.000Z',
        })
      );
    });

    await page.goto('/fr/auth/login');
    await page.getByLabel('Email').fill('admin@swiftcolis.dz');
    await page.getByLabel('Mot de passe').fill('admin123');
    await page.getByRole('button', { name: /se connecter/i }).click();

    await page.waitForURL('**/fr/dashboard/admin');
    await expect(page.getByText('Matching transporteur automatique')).toBeVisible();

    await expect(page.getByPlaceholder('Ville départ')).toHaveValue('alger');
    await expect(page.getByPlaceholder('Ville arrivée')).toHaveValue('oran');
    await expect(page.getByPlaceholder('h')).toHaveValue('48');
    await expect(page.locator('input.w-24').nth(1)).toHaveValue('25');

    await expect(page.getByText('3 / 5 assignés')).toBeVisible();
    await expect(page.getByText('Ignorés : 2')).toBeVisible();

    await page.getByRole('button', { name: 'Effacer' }).click();
    await expect(page.getByText('Aucune exécution manuelle')).toBeVisible();

    await page.getByRole('button', { name: 'Réinitialiser' }).click();
    await expect(page.getByPlaceholder('Ville départ')).toHaveValue('');
    await expect(page.getByPlaceholder('Ville arrivée')).toHaveValue('');
    await expect(page.getByPlaceholder('h')).toHaveValue('24');
    await expect(page.locator('input.w-24').nth(1)).toHaveValue('50');

    await expect
      .poll(async () => page.evaluate((key) => window.localStorage.getItem(key), filtersStorageKey))
      .toContain('"periodHours":"24"');
    await expect
      .poll(async () => page.evaluate((key) => window.localStorage.getItem(key), lastRunStorageKey))
      .toBeNull();
  });
});
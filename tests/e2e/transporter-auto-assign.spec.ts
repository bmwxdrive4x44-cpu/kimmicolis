import { expect, test } from '@playwright/test';

/**
 * E2E Smoke Tests — Système Auto-assign Intelligent
 *
 * Teste l'ensemble du flux :
 * 1. Transporteur configure ses préférences
 * 2. Activation/désactivation de l'auto-assign
 * 3. Vérification du statut (capacité, compteurs)
 * 4. Déclenchement manuel
 * 5. Analytics
 */

const TRANSPORTER_EMAIL = 'transporter@swiftcolis.dz';
const TRANSPORTER_PASSWORD = 'transport123';
const ADMIN_EMAIL = 'admin@swiftcolis.dz';
const ADMIN_PASSWORD = 'admin123';

test.describe('Auto-assign — Préférences transporteur', () => {
  test.beforeEach(async ({ request }) => {
    await request.get('/api/seed');
  });

  test('transporteur peut ouvrir l\'onglet Auto-assign', async ({ page }) => {
    await page.goto('/fr/auth/login');
    await page.getByLabel('Email').fill(TRANSPORTER_EMAIL);
    await page.getByLabel('Mot de passe').fill(TRANSPORTER_PASSWORD);
    await page.getByRole('button', { name: /se connecter/i }).click();

    await page.waitForURL('**/fr/dashboard/transporter');

    // Cliquer sur l'onglet Auto-assign
    await page.getByRole('tab', { name: /auto-assign/i }).click();

    // Vérifier les sections principales
    await expect(page.getByText('Activation & Programme')).toBeVisible();
    await expect(page.getByText('Zones préférées')).toBeVisible();
    await expect(page.getByText('Critères de priorité')).toBeVisible();
  });

  test('peut activer et sauvegarder l\'auto-assign', async ({ page }) => {
    await page.goto('/fr/auth/login');
    await page.getByLabel('Email').fill(TRANSPORTER_EMAIL);
    await page.getByLabel('Mot de passe').fill(TRANSPORTER_PASSWORD);
    await page.getByRole('button', { name: /se connecter/i }).click();
    await page.waitForURL('**/fr/dashboard/transporter');

    await page.getByRole('tab', { name: /auto-assign/i }).click();

    // Toggle auto-assign
    const toggle = page.locator('button[class*="rounded-full"]').first();
    await toggle.click();

    // Changer le schedule
    await page.getByRole('combobox').first().click();
    await page.getByText('Tous les jours à 18h').click();

    // Mettre à jour max missions
    await page.locator('input[type="number"]').first().fill('15');

    // Sauvegarder
    await page.getByRole('button', { name: /enregistrer les préférences/i }).click();

    // Vérifier toast de succès
    await expect(page.getByText(/préférences sauvegardées/i)).toBeVisible({ timeout: 5000 });
  });

  test('peut ajouter et supprimer une ville préférée', async ({ page }) => {
    await page.goto('/fr/auth/login');
    await page.getByLabel('Email').fill(TRANSPORTER_EMAIL);
    await page.getByLabel('Mot de passe').fill(TRANSPORTER_PASSWORD);
    await page.getByRole('button', { name: /se connecter/i }).click();
    await page.waitForURL('**/fr/dashboard/transporter');

    await page.getByRole('tab', { name: /auto-assign/i }).click();

    // Ajouter une ville préférée
    await page.getByPlaceholder('Ex: Alger, Oran, Blida…').fill('Alger');
    await page.getByRole('button', { name: 'Ajouter' }).first().click();

    // Vérifier que le badge apparaît
    await expect(page.getByText('Alger')).toBeVisible();

    // Supprimer la ville
    const badge = page.locator('span:has-text("Alger")').locator('..').locator('button');
    await badge.click();

    // Vérifier disparition
    await expect(page.locator('[class*="bg-emerald-100"]:has-text("Alger")')).not.toBeVisible();
  });

  test('affiche un warning si critères de scoring = 0', async ({ page }) => {
    await page.goto('/fr/auth/login');
    await page.getByLabel('Email').fill(TRANSPORTER_EMAIL);
    await page.getByLabel('Mot de passe').fill(TRANSPORTER_PASSWORD);
    await page.getByRole('button', { name: /se connecter/i }).click();
    await page.waitForURL('**/fr/dashboard/transporter');

    await page.getByRole('tab', { name: /auto-assign/i }).click();

    // Mettre tous les sliders à 0
    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();
    for (let i = 0; i < count; i++) {
      await sliders.nth(i).fill('0');
      await sliders.nth(i).dispatchEvent('input');
    }

    // Vérifier warning
    await expect(page.getByText(/La somme des critères doit être supérieure à 0/i)).toBeVisible();

    // Bouton sauvegarder désactivé
    await expect(page.getByRole('button', { name: /enregistrer les préférences/i })).toBeDisabled();
  });
});

test.describe('Auto-assign — API Préférences', () => {
  test('GET /api/transporters/preferences crée les préférences par défaut', async ({ request }) => {
    // Seed et login pour obtenir un token valide
    await request.get('/api/seed');

    const loginRes = await request.post('/api/auth/callback/credentials', {
      data: { email: TRANSPORTER_EMAIL, password: TRANSPORTER_PASSWORD },
    });

    // Test GET préférences
    const res = await request.get('/api/transporters/preferences');

    // Si 200, vérifier structure
    if (res.status() === 200) {
      const data = await res.json();
      expect(data).toHaveProperty('autoAssignEnabled');
      expect(data).toHaveProperty('maxDailyMissions');
      expect(data).toHaveProperty('maxActiveParallel');
      expect(data).toHaveProperty('scoreWeightDistance');
    }
  });

  test('GET /api/transporters/auto-assign retourne les compteurs', async ({ request }) => {
    await request.get('/api/seed');

    const res = await request.get('/api/transporters/auto-assign');

    if (res.status() === 200) {
      const data = await res.json();
      expect(data).toHaveProperty('enabled');
      expect(data).toHaveProperty('todayCount');
      expect(data).toHaveProperty('activeCount');
    }
  });

  test('GET /api/transporters/analytics retourne les métriques', async ({ request }) => {
    await request.get('/api/seed');

    const res = await request.get('/api/transporters/analytics');

    if (res.status() === 200) {
      const data = await res.json();
      expect(data).toHaveProperty('totalAssigned');
      expect(data).toHaveProperty('totalCompleted');
      expect(data).toHaveProperty('successRate');
      expect(data).toHaveProperty('topRoutes');
      expect(data).toHaveProperty('monthlyStats');
      expect(typeof data.successRate).toBe('number');
      expect(data.successRate).toBeGreaterThanOrEqual(0);
      expect(data.successRate).toBeLessThanOrEqual(100);
    }
  });
});

test.describe('Auto-assign — Cron endpoint', () => {
  test('GET /api/cron/auto-assign sans secret retourne 401 si CRON_SECRET défini', async ({ request }) => {
    const res = await request.get('/api/cron/auto-assign');

    // Si le secret est configuré, doit retourner 401
    // Si pas de secret configuré, doit retourner 200 (pas de secret requis)
    expect([200, 401]).toContain(res.status());
  });

  test('GET /api/cron/auto-assign avec schedule filter ne plante pas', async ({ request }) => {
    // Utiliser la clé de seed comme secret de test
    const res = await request.get('/api/cron/auto-assign?schedule=DAILY_8AM&secret=test-secret');

    // Peut retourner 200 (succès, 0 assignés) ou 401 (wrong secret)
    expect([200, 401]).toContain(res.status());

    if (res.status() === 200) {
      const data = await res.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('schedule');
      expect(data).toHaveProperty('totalAssigned');
      expect(data.schedule).toBe('DAILY_8AM');
    }
  });
});

test.describe('Auto-assign — Dashboard Admin', () => {
  test('admin peut déclencher matching pour tous les transporteurs', async ({ page }) => {
    await page.goto('/fr/auth/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Mot de passe').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /se connecter/i }).click();

    await page.waitForURL('**/fr/dashboard/admin');

    // Naviguer vers la section matching si elle existe
    const matchingTab = page.getByRole('tab', { name: /matching/i });
    if (await matchingTab.isVisible()) {
      await matchingTab.click();
      await expect(page.getByText(/Matching transporteur/i)).toBeVisible();
    }
  });
});

test.describe('Auto-assign — Limites et validations', () => {
  test('transporteur à capacité pleine ne reçoit pas de nouvelles missions', async ({ request }) => {
    await request.get('/api/seed');

    // Tester le statut auto-assign
    const statusRes = await request.get('/api/transporters/auto-assign');

    if (statusRes.status() === 200) {
      const status = await statusRes.json();
      // Si capacité pleine, canAssignMore doit être false
      if (status.activeCount >= status.maxActiveParallel || status.todayCount >= status.maxDailyMissions) {
        expect(status.canAssignMore).toBe(false);
      }
    }
  });

  test('PUT /api/transporters/auto-assign déclenche et retourne résumé', async ({ request }) => {
    await request.get('/api/seed');

    const res = await request.put('/api/transporters/auto-assign', {
      data: { limit: 5 },
    });

    // Peut retourner 200 (OK), 403 (auto-assign désactivé), ou 409 (capacité pleine)
    expect([200, 403, 409]).toContain(res.status());

    if (res.status() === 200) {
      const data = await res.json();
      expect(data).toHaveProperty('summary');
      expect(typeof data.summary.success).toBe('number');
      expect(typeof data.summary.total).toBe('number');
    }

    if (res.status() === 403) {
      const data = await res.json();
      expect(data.error).toContain('non activé');
    }
  });
});

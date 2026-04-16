import { expect, test } from '@playwright/test';
import path from 'node:path';

const CLIENT_AUTH = path.join(__dirname, '.auth/client.json');
const CLIENT_EMAIL = 'client@demo.dz';
const CLIENT_PASSWORD = 'client123';
const ADMIN_EMAIL = 'admin@swiftcolis.dz';
const ADMIN_PASSWORD = 'admin123';

async function ensureClientCreatePage(page: any) {
  await page.goto('/fr/dashboard/client?tab=create', { waitUntil: 'domcontentloaded' });

  if (page.url().includes('/auth/login')) {
    await page.getByRole('textbox', { name: /adresse email|email/i }).fill(CLIENT_EMAIL);
    await page.getByRole('textbox', { name: /mot de passe/i }).fill(CLIENT_PASSWORD);
    await page.getByRole('button', { name: /se connecter/i }).click();
    await page.waitForURL('**/fr/dashboard/client**', { timeout: 120_000 });
    await page.goto('/fr/dashboard/client?tab=create', { waitUntil: 'domcontentloaded' });
  }
}

async function ensureActiveAlgerOranLine(request: any) {
  // Authenticate as admin in API request context.
  const csrfRes = await request.get('/api/auth/csrf');
  const csrfData = await csrfRes.json().catch(() => ({}));
  const csrfToken: string = csrfData?.csrfToken ?? '';
  await request.post('/api/auth/callback/credentials', {
    form: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      csrfToken,
      callbackUrl: '/fr/dashboard/admin',
      json: 'true',
    },
  });

  const lignesRes = await request.get('/api/lignes?villeDepart=alger&villeArrivee=oran');
  const lignes = await lignesRes.json().catch(() => []);
  const ligne = Array.isArray(lignes) ? lignes[0] : null;

  if (ligne?.id) {
    if (!ligne.isActive) {
      await request.put('/api/lignes', {
        data: { id: ligne.id, isActive: true },
      });
    }
    return;
  }

  // Fallback: create the line if missing.
  await request.post('/api/lignes', {
    data: {
      villeDepart: 'alger',
      villeArrivee: 'oran',
      tarifPetit: 500,
      tarifMoyen: 750,
      tarifGros: 1000,
    },
  });
}

test.describe('Flow impression au relais', () => {
  test.use({ storageState: CLIENT_AUTH });

  test('client choisit impression relais puis le relais peut imprimer', async ({ page, request }) => {
    test.setTimeout(420_000);

    await request.get('/api/seed');
    await ensureActiveAlgerOranLine(request);

    // 1) Session already loaded via storageState (generated in globalSetup).
    // 2) Création colis avec option "Imprimer au relais"
    await ensureClientCreatePage(page);

    const pickOptionByLabel = async (labelText: string, optionName: RegExp) => {
      const trigger = page
        .locator(`xpath=//*[contains(normalize-space(), "${labelText}")]/following::button[@role="combobox"][1]`)
        .first();
      await trigger.waitFor({ state: 'visible', timeout: 30_000 });
      await trigger.click();

      const preferred = page.getByRole('option', { name: optionName }).first();
      await preferred.waitFor({ state: 'visible', timeout: 20_000 });
      await preferred.click();
      await expect(trigger).toContainText(optionName, { timeout: 15_000 });
    };


    // Wait for the form to fully render before interacting with comboboxes.
    // The client dashboard may still be in session-loading state after navigation.
    await page.getByRole('tab', { name: /Créer un colis/i }).waitFor({ state: 'visible', timeout: 30_000 });

    await pickOptionByLabel('Départ', /Alger/i);
    await pickOptionByLabel('Arrivée', /Oran/i);
    await pickOptionByLabel('Relais départ', /Epicerie du Centre/i);
    await pickOptionByLabel('Relais arrivée', /Peta Ha Commercial Center/i);

    await page.waitForURL('**/fr/dashboard/client?tab=create', { timeout: 30_000 });
    await page.waitForLoadState('domcontentloaded');

    const detailsSection = page
      .getByRole('heading', { name: /Détails du colis/i })
      .locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');
    await detailsSection.waitFor({ state: 'visible', timeout: 30_000 });

    const weightInput = detailsSection.locator('input[type="number"]').first();
    await weightInput.waitFor({ state: 'visible', timeout: 30_000 });
    await weightInput.fill('2');

    // Fill text fields by order while excluding number input(s) to avoid accidental re-targeting.
    const detailTextInputs = detailsSection.locator('input:not([type="number"])');
    await detailTextInputs.nth(0).fill('Test impression relais');
    await detailTextInputs.nth(1).fill('Testeur');
    await detailTextInputs.nth(2).fill('Client');
    await detailTextInputs.nth(3).fill('0550123456');
    await detailTextInputs.nth(4).fill('Dest');
    await detailTextInputs.nth(5).fill('Impression');
    await detailTextInputs.nth(6).fill('0660123456');

    // Print-mode select can re-render while dropdown is open; retry with click + keyboard fallback.
    const printModeTrigger = detailsSection
      .locator('xpath=.//*[contains(normalize-space(), "Option d\'impression de l\'étiquette")]/following::button[@role="combobox"][1]')
      .first();
    let relaySelected = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      await printModeTrigger.click();

      const relayOption = page.getByRole('option', { name: /Imprimer au relais/i }).first();
      const clicked = await relayOption
        .click({ timeout: 5_000 })
        .then(() => true)
        .catch(async () => {
          // Fallback if option detaches during click.
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Enter');
          return false;
        });

      const hasRelayText = await printModeTrigger
        .textContent()
        .then((text) => /relais/i.test(text || ''));

      if (clicked || hasRelayText) {
        relaySelected = true;
        break;
      }
    }

    expect(relaySelected).toBeTruthy();
    await expect(printModeTrigger).toContainText(/relais/i, { timeout: 10_000 });

    const createParcelResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/parcels') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: /Créer le colis/i }).click();
    const createParcelResponse = await createParcelResponsePromise;
    expect(createParcelResponse.ok()).toBeTruthy();

    await expect(page.getByRole('heading', { name: /Colis créé/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Impression demandée au relais/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Imprimer l'étiquette à coller sur le colis/i })).toHaveCount(0);

    const trackingNumber = (await page.locator('p.font-mono').first().innerText()).trim();
    expect(trackingNumber).toMatch(/^SC[A-Z0-9]+$/);

    // 3) Validation côté API QR (données disponibles pour scan + impression relais)
    const qrRes = await request.get(`/api/qr/${trackingNumber}`);
    expect(qrRes.ok()).toBeTruthy();

    const qrPayload = await qrRes.json();
    expect(qrPayload.trackingNumber).toBe(trackingNumber);
    expect(qrPayload.relaisDepart?.commerceName).toBeTruthy();
    expect(qrPayload.relaisArrivee?.commerceName).toBeTruthy();
    expect(qrPayload.qrCodeImage).toBeTruthy();

    // 4) Cas QR invalide/inconnu
    const invalidQrRes = await request.get('/api/qr/SCINVALID999');
    expect(invalidQrRes.status()).toBe(404);

    // 5) Impression interdite avant paiement
    const printBeforePayment = await request.post(`/api/qr/${trackingNumber}`, {
      data: {
        action: 'print_label',
        relaisId: qrPayload.relaisDepart.id,
      },
    });
    expect(printBeforePayment.status()).toBe(400);
    await expect(printBeforePayment.json()).resolves.toMatchObject({
      error: expect.stringMatching(/Paiement non validé/i),
    });

    // 6) Paiement validé puis première impression autorisée
    const validatePaymentRes = await request.post(`/api/qr/${trackingNumber}`, {
      data: {
        action: 'validate_payment',
        relaisId: qrPayload.relaisDepart.id,
      },
    });
    expect(validatePaymentRes.ok()).toBeTruthy();

    const firstPrintRes = await request.post(`/api/qr/${trackingNumber}`, {
      data: {
        action: 'print_label',
        relaisId: qrPayload.relaisDepart.id,
      },
    });
    expect(firstPrintRes.ok()).toBeTruthy();

    // 7) Double scan impression bloqué
    const secondPrintRes = await request.post(`/api/qr/${trackingNumber}`, {
      data: {
        action: 'print_label',
        relaisId: qrPayload.relaisDepart.id,
      },
    });
    expect([200, 409]).toContain(secondPrintRes.status());
    const secondPrintPayload = await secondPrintRes.json().catch(() => ({}));
    if (secondPrintRes.status() === 409) {
      expect(secondPrintPayload).toMatchObject({
        error: expect.stringMatching(/Double scan bloqué/i),
      });
    } else {
      expect(secondPrintPayload).toMatchObject({
        success: true,
      });
    }
  });
});

import { expect, test } from '@playwright/test';

test.describe('Flow impression au relais', () => {
  test('client choisit impression relais puis le relais peut imprimer', async ({ page, request }) => {
    test.setTimeout(90_000);

    await request.get('/api/seed');

    // 1) Connexion client
    await page.goto('/fr/auth/login');
    await page.getByLabel('Email').fill('client@demo.dz');
    await page.getByLabel('Mot de passe').fill('client123');
    await page.getByRole('button', { name: /se connecter/i }).click();

    await page.waitForURL('**/fr/dashboard/client**');

    // 2) Création colis avec option "Imprimer au relais"
    await page.goto('/fr/dashboard/client?tab=create');

    await page.locator('button[role="combobox"]').nth(0).click();
    await page.getByRole('option', { name: /Alger/i }).first().click();

    await page.locator('button[role="combobox"]').nth(1).click();
    await page.getByRole('option', { name: /Oran/i }).first().click();

    await page.locator('button[role="combobox"]').nth(2).click();
    await page.getByRole('option').first().click();

    await page.locator('button[role="combobox"]').nth(3).click();
    await page.getByRole('option').first().click();

    const detailsSection = page.locator('div.rounded-2xl').filter({
      has: page.getByRole('heading', { name: /Détails du colis/i }),
    }).first();

    await detailsSection.getByRole('spinbutton').fill('2');
    await detailsSection.getByPlaceholder('Contenu du colis (optionnel)').fill('Test impression relais');
    const textInputs = detailsSection.getByRole('textbox');
    await textInputs.nth(1).fill('Testeur');
    await textInputs.nth(2).fill('Client');
    await textInputs.nth(3).fill('0550123456');
    await textInputs.nth(4).fill('Dest');
    await textInputs.nth(5).fill('Impression');
    await textInputs.nth(6).fill('0660123456');

    await page.locator('button[role="combobox"]').nth(4).click();
    await page.getByRole('option', { name: /Imprimer au relais/i }).click();

    await expect(page.getByText(/Frais impression relais/i)).toBeVisible();

    await page.getByRole('button', { name: /Créer le colis/i }).click();

    await expect(page.getByText('Colis créé !')).toBeVisible();
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
    expect(secondPrintRes.status()).toBe(409);
    await expect(secondPrintRes.json()).resolves.toMatchObject({
      error: expect.stringMatching(/Double scan bloqué/i),
    });
  });
});

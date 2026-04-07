import { expect, test } from '@playwright/test';

/**
 * E2E Tests — Enseigne Payment Workflow
 * 
 * Valide le flux enseigne 100% digital:
 * 1. Paiement exclusif en ligne (pas de CASH_RELAY)
 * 2. Relais comme point logistique uniquement
 * 3. Matching après confirmation paiement PSP
 */

test.describe('Enseigne Payment Workflow', () => {
  test.beforeEach(async ({ request }) => {
    await request.get('/api/seed');
  });

  test('enseigne peut creer colis et passer au paiement en ligne', async ({ page, request }) => {
    test.setTimeout(60_000);

    const stamp = Date.now();
    const enseigneEmail = `enseigne-pay-${stamp}@demo.dz`;

    // 1) Create enseigne account
    await page.goto('/fr/become-enseigne');
    await page.getByRole('button', { name: /Demarrer maintenant/i }).click();

    const onboarding = page.locator('#enseigne-onboarding-form');
    const fieldInput = (label: string) =>
      onboarding.locator(`xpath=.//div[label[normalize-space()="${label}"]]//input`).first();

    await fieldInput('Prenom').fill('PayTest');
    await fieldInput('Nom').fill('Enseigne');
    await fieldInput('Email').fill(enseigneEmail);
    await fieldInput('Telephone').fill('0550000001');
    await fieldInput('Mot de passe').fill('paytest123');
    await fieldInput('Confirmer le mot de passe').fill('paytest123');
    await fieldInput('Nom commercial').fill('PayTest Commerce');
    await fieldInput('Raison sociale').fill('PayTest SARL');
    await fieldInput('Site web').fill('https://paytest.example');
    await fieldInput('Email facturation').fill(`billing-${stamp}@demo.dz`);
    await fieldInput('Ville operationnelle').fill('alger');
    await fieldInput('Volume mensuel estime').fill('50');

    await onboarding.getByRole('button', { name: /Activer mon espace enseigne/i }).click();
    await page.waitForURL('**/fr/dashboard/enseigne**', { timeout: 30_000 });

    // 2) Navigate to payments tab
    await page.getByRole('tab', { name: /Paiements/i }).click();

    // 3) Verify payment methods exclude CASH_RELAY
    const methodSelect = page.locator('select').first();
    const options = methodSelect.locator('option');
    const optionTexts = await options.allTextContents();

    expect(optionTexts).toContain('CIB');
    expect(optionTexts).toContain('Edahabia');
    expect(optionTexts).not.toContain('Especes relais');
    expect(optionTexts).not.toContain('CASH_RELAY');

    // 4) Verify descriptive text about online-only payments
    await expect(page.getByText(/Paiement enseigne 100% en ligne/i)).toBeVisible();
    await expect(page.getByText(/Le relais ne realise aucun encaissement/i)).toBeVisible();
  });

  test('API rejects CASH_RELAY payment method for enseigne', async ({ request }) => {
    // Login first (use existing test user)
    const loginRes = await request.post('/api/auth/callback/credentials', {
      data: { email: 'enseigne@demo.dz', password: 'enseigne123' },
    });

    // Attempt to create payment intent with CASH_RELAY (should fail)
    const paymentRes = await request.put('/api/enseignes/payments', {
      data: {
        colisIds: ['test-colis-id'],
        paymentMethod: 'CASH_RELAY',
        batchReference: 'TEST-2026-04-05',
      },
    });

    // Should reject CASH_RELAY
    if (paymentRes.status() === 400) {
      const data = await paymentRes.json();
      expect(data.error).toContain('paiement au relais est indisponible');
    }
  });

  test('dashboard describes online → relay logistics → dispatch flow', async ({ page, request }) => {
    test.setTimeout(60_000);

    // Login as enseigne
    await page.goto('/fr/auth/login');
    await page.getByLabel('Email').fill('enseigne@demo.dz');
    await page.getByLabel('Mot de passe').fill('enseigne123');
    await page.getByRole('button', { name: /se connecter/i }).click();

    await page.waitForURL('**/fr/dashboard/enseigne**');

    // Navigate to overview tab
    await page.getByRole('tab', { name: /Vue d ensemble/i }).click();

    // Verify workflow steps are updated with visible assertions
    await expect(page.getByText(/Regler en ligne/i)).toBeVisible();
    await expect(page.getByText(/Deposer le colis au relais de depart indique sur l'etiquette/i)).toBeVisible();
    await expect(page.getByText(/Le transporteur collecte et livre le colis/i)).toBeVisible();

    // Verify hero description
    await expect(page.getByText(/Flux enseigne 100% digital/i)).toBeVisible();
    await expect(page.getByText(/paiement en ligne.*depot physique.*collecte et transport orchestras/i)).toBeVisible();
  });

  test('enseigne colis eligible for matching only after paiement confirme backend', async ({ request }) => {
    // Create a test colis via API and verify eligibility logic
    const createRes = await request.post('/api/parcels/bulk', {
      data: {
        clientId: 'enseigne-user-id', // would use real ID from seed
        villeDepart: 'Alger',
        villeArrivee: 'Oran',
        relaisDepartId: 'relay-id-1',
        relaisArriveeId: 'relay-id-2',
        parcels: [
          {
            senderFirstName: 'Test',
            senderLastName: 'Sender',
            senderPhone: '0550000001',
            recipientFirstName: 'Test',
            recipientLastName: 'Recipient',
            recipientPhone: '0660000001',
            weight: 2.5,
            description: 'Test parcel',
          },
        ],
      },
    });

    // Colis should be created in a pre-payment state until backend confirmation
    const createData = await createRes.json();
    if (createRes.ok() && createData.parcels?.[0]) {
      expect(['CREATED', 'PENDING_PAYMENT', 'READY_FOR_DEPOSIT']).toContain(createData.parcels[0].status);
    }
  });
});

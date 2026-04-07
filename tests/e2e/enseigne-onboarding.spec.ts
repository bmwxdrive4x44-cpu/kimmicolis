import { expect, test } from '@playwright/test';

test.describe('Onboarding ENSEIGNE', () => {
  test('creation compte + profil puis redirection dashboard enseigne', async ({ page, request }) => {
    test.setTimeout(90_000);

    await request.get('/api/seed');

    const stamp = Date.now();
    const email = `enseigne.e2e.${stamp}@demo.dz`;

    await page.goto('/fr/become-enseigne');
    await page.getByRole('button', { name: /Demarrer maintenant/i }).click();

    const onboarding = page.locator('#enseigne-onboarding-form');

    const fieldInput = (label: string) =>
      onboarding.locator(`xpath=.//div[label[normalize-space()="${label}"]]//input`).first();

    await fieldInput('Prenom').fill('Atlas');
    await fieldInput('Nom').fill('Boutique');
    await fieldInput('Email').fill(email);
    await fieldInput('Telephone').fill('0555123456');
    await fieldInput('Mot de passe').fill('enseigne123');
    await fieldInput('Confirmer le mot de passe').fill('enseigne123');

    await fieldInput('Nom commercial').fill('Boutique Atlas E2E');
    await fieldInput('Raison sociale').fill('Atlas E2E SARL');
    await fieldInput('Site web').fill('https://atlas-e2e.example');
    await fieldInput('Email facturation').fill(`facturation.${stamp}@demo.dz`);
    await fieldInput('Ville operationnelle').fill('alger');
    await fieldInput('Volume mensuel estime').fill('25');

    await onboarding.getByRole('button', { name: /Activer mon espace enseigne/i }).click();

    await page.waitForURL('**/fr/dashboard/enseigne**', { timeout: 30_000 });
    await expect(page.getByRole('main').getByText('Espace Enseigne')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pilotage logistique B2B' })).toBeVisible();
  });
});

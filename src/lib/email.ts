import { Resend } from 'resend';

const FROM = process.env.RESEND_FROM ?? 'SwiftColis <onboarding@resend.dev>';

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const resend = getResendClient();

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
  });

  if (error) {
    console.error('[Resend] Erreur envoi email:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: {
  to: string;
  name: string | null;
  resetUrl: string;
}) {
  const displayName = name ?? 'utilisateur';

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /><title>Réinitialisation du mot de passe</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:#2563eb;padding:32px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;">SwiftColis</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="color:#1e293b;margin-top:0;">Réinitialisation de votre mot de passe</h2>
            <p style="color:#475569;">Bonjour <strong>${displayName}</strong>,</p>
            <p style="color:#475569;">
              Vous avez demandé la réinitialisation de votre mot de passe SwiftColis.
              Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${resetUrl}" style="background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px;">
                Réinitialiser mon mot de passe
              </a>
            </div>
            <p style="color:#94a3b8;font-size:13px;">
              Ce lien expire dans <strong>1 heure</strong>. Si vous n'avez pas fait cette demande, ignorez ce message.
            </p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
            <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">
              SwiftColis — Livraison collaborative &bull; Ne pas répondre à cet email
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

  return sendEmail({ to, subject: 'Réinitialisez votre mot de passe SwiftColis', html });
}

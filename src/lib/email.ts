
import nodemailer from 'nodemailer';

const FROM = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'SwiftColis <no-reply@swiftcolis.com>';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  try {
    const info = await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html,
      text,
    });
    return info;
  } catch (error) {
    console.error('[SMTP] Erreur envoi email:', error);
    throw error;
  }
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

export async function sendRegistrationConfirmationEmail({
  to,
  name,
  role,
  verificationUrl,
}: {
  to: string;
  name: string | null;
  role: 'CLIENT' | 'RELAIS' | 'TRANSPORTER' | 'ENSEIGNE' | 'ADMIN' | string;
  verificationUrl: string;
}) {
  const displayName = name ?? 'utilisateur';
  const roleLabelMap: Record<string, string> = {
    CLIENT: 'Client',
    RELAIS: 'Point relais',
    TRANSPORTER: 'Transporteur',
    ENSEIGNE: 'Enseigne',
    ADMIN: 'Administrateur',
  };
  const roleLabel = roleLabelMap[String(role || '').toUpperCase()] || 'Utilisateur';

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /><title>Confirmation d inscription</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:#059669;padding:32px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;">SwiftColis</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="color:#1e293b;margin-top:0;">Confirmez votre adresse email</h2>
            <p style="color:#475569;">Bonjour <strong>${displayName}</strong>,</p>
            <p style="color:#475569;">
              Votre inscription en tant que <strong>${roleLabel}</strong> est bien enregistrée.
            </p>
            <p style="color:#475569;">Cliquez sur le bouton ci-dessous pour activer votre compte.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${verificationUrl}" style="background:#059669;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px;">
                Confirmer mon email
              </a>
            </div>
            <p style="color:#475569;font-size:13px;line-height:1.6;word-break:break-all;">
              Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br />
              <a href="${verificationUrl}" style="color:#059669;text-decoration:underline;">${verificationUrl}</a>
            </p>
            <p style="color:#475569;">
              Si vous n'avez pas créé ce compte, vous pouvez ignorer ce message.
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

  const text = [
    'SwiftColis - Confirmation email',
    '',
    `Bonjour ${displayName},`,
    '',
    `Votre inscription (${roleLabel}) est bien enregistree.`,
    'Confirmez votre adresse email en cliquant sur ce lien :',
    verificationUrl,
    '',
    "Si vous n'avez pas cree ce compte, ignorez ce message.",
  ].join('\n');

  return sendEmail({
    to,
    subject: 'Confirmez votre email - SwiftColis',
    html,
    text,
  });
}

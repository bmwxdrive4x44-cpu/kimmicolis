import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';
import { sendEmail } from '@/lib/email';
import { db } from '@/lib/db';

const SUPPORT_EMAIL = process.env.CONTACT_EMAIL ?? process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'no-reply@swiftcolis.com';

export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(request, RATE_LIMIT_PRESETS.strict);
  if (rl.limited) {
    return NextResponse.json(
      { error: 'Trop de requêtes. Réessayez dans quelques minutes.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Nom invalide.' }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
    }
    if (!subject || subject.length < 3) {
      return NextResponse.json({ error: 'Sujet trop court.' }, { status: 400 });
    }
    if (!message || message.length < 10) {
      return NextResponse.json({ error: 'Message trop court (min. 10 caractères).' }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json({ error: 'Message trop long (max. 2000 caractères).' }, { status: 400 });
    }

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /><title>Nouveau message de contact</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:#2563eb;padding:24px 40px;">
            <h1 style="color:#ffffff;margin:0;font-size:20px;">SwiftColis — Nouveau contact</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:6px 0;color:#64748b;font-size:13px;width:100px;">Nom</td>
                <td style="padding:6px 0;color:#0f172a;font-weight:600;">${name}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#64748b;font-size:13px;">Email</td>
                <td style="padding:6px 0;"><a href="mailto:${email}" style="color:#2563eb;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#64748b;font-size:13px;">Sujet</td>
                <td style="padding:6px 0;color:#0f172a;">${subject}</td>
              </tr>
            </table>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
            <p style="color:#475569;white-space:pre-wrap;margin:0;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 40px;text-align:center;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">SwiftColis &bull; Message reçu le ${new Date().toLocaleDateString('fr-FR', { dateStyle: 'full' })}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Récupère uniquement l'adresse email (sans le "Nom <email>")
    const toAddress = SUPPORT_EMAIL.includes('<')
      ? SUPPORT_EMAIL.match(/<(.+)>/)?.[1] ?? SUPPORT_EMAIL
      : SUPPORT_EMAIL;

    // Sauvegarder d'abord en base pour garantir la visibilité dans l'onglet admin
    const saved = await db.contactMessage.create({
      data: { name, email, subject, message },
    });

    // L'email est best-effort: un échec Resend ne doit pas supprimer le message admin
    let emailSent = true;
    await sendEmail({
      to: toAddress,
      subject: `[Contact SwiftColis] ${subject}`,
      html,
    }).catch((err) => {
      emailSent = false;
      console.error('[contact] Envoi email échoué:', err);
    });

    return NextResponse.json({
      success: true,
      message: emailSent
        ? 'Message envoyé avec succès.'
        : 'Message enregistré. Email temporairement indisponible, notre équipe verra votre demande dans l\'admin.',
      id: saved.id,
      emailSent,
    });
  } catch (err) {
    console.error('[contact] Erreur:', err);
    const detail = err instanceof Error ? err.message : 'Erreur inconnue';
    return NextResponse.json(
      {
        error: 'Impossible d\'envoyer le message pour le moment.',
        ...(process.env.NODE_ENV !== 'production' ? { detail } : {}),
      },
      { status: 500 }
    );
  }
}

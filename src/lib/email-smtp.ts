import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }) {
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject,
    html,
    text,
  });
}

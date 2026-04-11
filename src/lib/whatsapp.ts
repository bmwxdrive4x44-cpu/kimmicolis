type SendWhatsAppTextInput = {
  to: string;
  message: string;
};

function normalizeWhatsAppRecipient(phone: string): string {
  const cleaned = String(phone || '').replace(/\s+/g, '').replace(/[^+\d]/g, '');

  if (!cleaned) {
    throw new Error('Numéro WhatsApp vide');
  }

  if (cleaned.startsWith('+')) {
    return cleaned.slice(1);
  }

  if (cleaned.startsWith('00')) {
    return cleaned.slice(2);
  }

  return cleaned;
}

export async function sendWhatsAppTextMessage(input: SendWhatsAppTextInput) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';

  if (!token || !phoneNumberId) {
    throw new Error('WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID non configurés');
  }

  const to = normalizeWhatsAppRecipient(input.to);
  const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: input.message,
      },
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || `WhatsApp API HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

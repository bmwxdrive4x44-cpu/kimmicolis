import Stripe from 'stripe';

type OnlineMethod = 'CIB' | 'EDAHABIA' | 'BARIDI_MOB' | 'STRIPE_TEST';

type CreateHostedCheckoutInput = {
  paymentId: string;
  amount: number;
  currency: string;
  method: OnlineMethod;
  clientId: string;
};

export type HostedCheckoutResult = {
  checkoutUrl: string;
  providerSessionId?: string;
};

const ONLINE_METHODS: OnlineMethod[] = ['CIB', 'EDAHABIA', 'BARIDI_MOB', 'STRIPE_TEST'];

function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value.trim();
}

export function isOnlineMethod(method: string): method is OnlineMethod {
  return ONLINE_METHODS.includes(method as OnlineMethod);
}

export function isRealPspConfigured(): boolean {
  const provider = process.env.PAYMENT_PROVIDER || 'SIM';
  if (provider === 'SATIM') {
    return Boolean(process.env.SATIM_API_BASE_URL && process.env.SATIM_API_KEY && process.env.SATIM_MERCHANT_ID);
  }
  if (provider === 'STRIPE_TEST') {
    return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SUCCESS_URL && process.env.STRIPE_CANCEL_URL);
  }
  return false;
}

export async function createHostedCheckout(input: CreateHostedCheckoutInput): Promise<HostedCheckoutResult> {
  const provider = process.env.PAYMENT_PROVIDER || 'SIM';
  if (provider === 'SATIM') {
    const apiBase = getRequiredEnv('SATIM_API_BASE_URL');
    const apiKey = getRequiredEnv('SATIM_API_KEY');
    const merchantId = getRequiredEnv('SATIM_MERCHANT_ID');
    const returnUrlBase = getRequiredEnv('SATIM_RETURN_URL');
    const cancelUrlBase = getRequiredEnv('SATIM_CANCEL_URL');
    const webhookUrl = getRequiredEnv('SATIM_WEBHOOK_URL');

    const payload = {
      merchantId,
      orderId: input.paymentId,
      amount: toMinor(input.amount),
      currency: input.currency,
      paymentMethod: input.method,
      customer: {
        id: input.clientId,
      },
      returnUrl: `${returnUrlBase}${returnUrlBase.includes('?') ? '&' : '?'}paymentId=${encodeURIComponent(input.paymentId)}`,
      cancelUrl: `${cancelUrlBase}${cancelUrlBase.includes('?') ? '&' : '?'}paymentId=${encodeURIComponent(input.paymentId)}`,
      webhookUrl,
      metadata: {
        paymentId: input.paymentId,
        clientId: input.clientId,
      },
    };

    const response = await fetch(`${apiBase.replace(/\/$/, '')}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const details = data?.message || data?.error || `HTTP ${response.status}`;
      throw new Error(`Echec creation session PSP: ${details}`);
    }

    const checkoutUrl = data?.checkoutUrl || data?.paymentUrl || data?.redirectUrl;
    if (!checkoutUrl || typeof checkoutUrl !== 'string') {
      throw new Error('PSP response missing checkoutUrl/paymentUrl/redirectUrl');
    }

    return {
      checkoutUrl,
      providerSessionId: data?.sessionId || data?.id,
    };
  }

  if (provider === 'STRIPE_TEST') {
    const stripeSecret = getRequiredEnv('STRIPE_SECRET_KEY');
    const successUrlBase = getRequiredEnv('STRIPE_SUCCESS_URL');
    const cancelUrlBase = getRequiredEnv('STRIPE_CANCEL_URL');

    const stripe = new Stripe(stripeSecret);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      client_reference_id: input.paymentId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: toMinor(input.amount),
            product_data: {
              name: `SwiftColis payment ${input.paymentId}`,
            },
          },
        },
      ],
      success_url: `${successUrlBase}${successUrlBase.includes('?') ? '&' : '?'}paymentId=${encodeURIComponent(input.paymentId)}`,
      cancel_url: `${cancelUrlBase}${cancelUrlBase.includes('?') ? '&' : '?'}paymentId=${encodeURIComponent(input.paymentId)}`,
      metadata: {
        paymentId: input.paymentId,
        clientId: input.clientId,
        method: input.method,
      },
    });

    if (!session.url) {
      throw new Error('Stripe response missing checkout session URL');
    }

    return {
      checkoutUrl: session.url,
      providerSessionId: session.id,
    };
  }

  throw new Error(`PAYMENT_PROVIDER non supporte: ${provider}`);
}

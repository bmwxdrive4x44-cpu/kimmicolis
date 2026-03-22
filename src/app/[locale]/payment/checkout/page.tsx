'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';

interface Colis {
  id: string;
  trackingNumber: string;
  villeDepart: string;
  villeArrivee: string;
  format: string;
  prixClient: number;
  status: string;
  createdAt: string;
}

interface Payment {
  id: string;
  paymentId: string;
  colisId: string;
  amount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error?: string;
  transactionRef?: string;
  processedAt?: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const t = useTranslations('payment');

  const [parcels, setParcels] = useState<Colis[]>([]);
  const [selectedParcel, setSelectedParcel] = useState<Colis | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch unpaid parcels
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if (status === 'authenticated' && session?.user?.id) {
      fetchParcels();
    }
  }, [status, session]);

  async function fetchParcels() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/parcels?clientId=${session?.user?.id}&status=CREATED`);
      if (!response.ok) throw new Error('Failed to fetch parcels');

      const data = await response.json();
      setParcels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePayment() {
    if (!selectedParcel) return;

    try {
      setProcessing(true);
      setError(null);

      // Step 1: Create payment session
      const createResponse = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colisId: selectedParcel.id,
          amount: selectedParcel.prixClient,
          paymentMethod: 'SIM_STANDARD',
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.error || 'Failed to create payment');
      }

      const paymentData = await createResponse.json();
      setPayment({
        id: paymentData.paymentId,
        paymentId: paymentData.paymentId,
        colisId: selectedParcel.id,
        amount: paymentData.amount,
        status: 'PENDING',
      });

      // Step 2: Process payment after user sees the form
      setTimeout(() => processPaymentSimulation(paymentData.paymentId), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment creation failed');
      setProcessing(false);
    }
  }

  async function processPaymentSimulation(paymentId: string) {
    try {
      // Update to PROCESSING
      setPayment((prev) =>
        prev ? { ...prev, status: 'PROCESSING' } : null
      );

      const processResponse = await fetch('/api/payments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          action: 'process',
        }),
      });

      const result = await processResponse.json();

      if (result.payment.status === 'COMPLETED') {
        setPayment((prev) =>
          prev
            ? {
                ...prev,
                status: 'COMPLETED',
                transactionRef: result.payment.transactionRef,
                processedAt: result.payment.processedAt,
              }
            : null
        );
        // Refresh parcels after 2 seconds
        setTimeout(() => {
          fetchParcels();
          setSelectedParcel(null);
        }, 2000);
      } else {
        setPayment((prev) =>
          prev
            ? {
                ...prev,
                status: 'FAILED',
                error: result.payment.errorMessage,
              }
            : null
        );
      }
    } catch (err) {
      setPayment((prev) =>
        prev
          ? {
              ...prev,
              status: 'FAILED',
              error: 'Payment processing error',
            }
          : null
      );
    } finally {
      setProcessing(false);
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <CardHeader className="pb-6">
        <CardTitle className="text-3xl">{t('checkout_title')}</CardTitle>
        <CardDescription>{t('checkout_description')}</CardDescription>
      </CardHeader>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!payment ? (
        <div className="space-y-6">
          {/* Parcel Selection */}
          {parcels.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  {t('no_unpaid_parcels')}
                </p>
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => router.push('/dashboard/client')}
                >
                  {t('back_to_dashboard')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{t('select_parcel')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {parcels.map((parcel) => (
                      <Card
                        key={parcel.id}
                        className={`cursor-pointer transition-all ${
                          selectedParcel?.id === parcel.id
                            ? 'border-blue-500 border-2 bg-blue-50'
                            : 'hover:border-gray-400'
                        }`}
                        onClick={() => setSelectedParcel(parcel)}
                      >
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">
                                {t('tracking')}
                              </p>
                              <p className="font-mono text-lg font-bold">
                                {parcel.trackingNumber}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">
                                {t('format')}
                              </p>
                              <p className="text-lg font-semibold">{parcel.format}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">
                                {t('route')}
                              </p>
                              <p className="text-sm">
                                {parcel.villeDepart} → {parcel.villeArrivee}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">
                                {t('amount')}
                              </p>
                              <p className="text-lg font-bold text-green-600">
                                {parcel.prixClient.toFixed(2)} DZD
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Payment Summary */}
              {selectedParcel && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('payment_summary')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        {t('base_price')}
                      </span>
                      <span className="font-semibold">
                        {(selectedParcel.prixClient * 0.8).toFixed(2)} DZD
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        {t('fees')}
                      </span>
                      <span className="font-semibold">
                        {(selectedParcel.prixClient * 0.2).toFixed(2)} DZD
                      </span>
                    </div>
                    <div className="border-t pt-3 flex justify-between">
                      <span className="font-bold">{t('total')}</span>
                      <span className="text-xl font-bold text-green-600">
                        {selectedParcel.prixClient.toFixed(2)} DZD
                      </span>
                    </div>

                    <Button
                      onClick={handleCreatePayment}
                      disabled={processing}
                      className="w-full bg-green-600 hover:bg-green-700 text-lg py-6"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('processing')}
                        </>
                      ) : (
                        t('pay_now')
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      ) : (
        /* Payment Status */
        <Card className="border-2">
          <CardContent className="pt-8">
            {payment.status === 'PENDING' && (
              <div className="text-center space-y-4">
                <Clock className="h-12 w-12 text-yellow-500 mx-auto animate-pulse" />
                <h3 className="text-lg font-semibold">{t('initiating_payment')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('please_wait')}
                </p>
              </div>
            )}

            {payment.status === 'PROCESSING' && (
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 mx-auto text-blue-500 animate-spin" />
                <h3 className="text-lg font-semibold">{t('processing_payment')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('processing_message')}
                </p>
              </div>
            )}

            {payment.status === 'COMPLETED' && (
              <div className="text-center space-y-4">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
                <h3 className="text-lg font-semibold text-green-600">
                  {t('payment_successful')}
                </h3>
                <div className="bg-green-50 p-4 rounded-lg space-y-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">{t('transaction_id')}:</span>
                    <span className="font-mono font-bold block">{payment.transactionRef}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">{t('amount')}:</span>
                    <span className="font-bold block">
                      {payment.amount.toFixed(2)} DZD
                    </span>
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('payment_complete_message')}
                </p>
                <Button
                  onClick={() => router.push('/dashboard/client')}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {t('back_to_dashboard')}
                </Button>
              </div>
            )}

            {payment.status === 'FAILED' && (
              <div className="text-center space-y-4">
                <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
                <h3 className="text-lg font-semibold text-red-600">
                  {t('payment_failed')}
                </h3>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-red-700 font-medium">
                    {payment.error || t('unknown_error')}
                  </p>
                </div>
                <div className="space-y-2 pt-4">
                  <Button
                    onClick={() => {
                      setPayment(null);
                      setSelectedParcel(null);
                      fetchParcels();
                    }}
                    className="w-full"
                    variant="outline"
                  >
                    {t('try_again')}
                  </Button>
                  <Button
                    onClick={() => router.push('/dashboard/client')}
                    variant="ghost"
                    className="w-full"
                  >
                    {t('back_to_dashboard')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

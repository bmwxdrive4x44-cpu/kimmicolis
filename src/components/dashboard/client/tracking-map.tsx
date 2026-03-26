'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PARCEL_STATUS, WILAYAS } from '@/lib/constants';
import { Search, Package, MapPin, Clock, CheckCircle, Truck, Loader2 } from 'lucide-react';

interface TrackingMapProps {
  initialTracking?: string;
}

export function TrackingMap({ initialTracking = '' }: TrackingMapProps) {
  const t = useTranslations('parcel.tracking');
  const [trackingNumber, setTrackingNumber] = useState(initialTracking);
  const [parcel, setParcel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!trackingNumber.trim()) return;
    
    setIsLoading(true);
    setError('');
    setParcel(null);

    try {
      const response = await fetch(`/api/parcels?tracking=${trackingNumber}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        setParcel(data[0]);
      } else {
        setError(t('notFound'));
      }
    } catch {
      setError(t('notFound'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialTracking) {
      handleSearch();
    }
  }, [initialTracking]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CREATED':
      case 'PAID':
        return <Package className="h-5 w-5" />;
      case 'RECU_RELAIS':
        return <CheckCircle className="h-5 w-5" />;
      case 'EN_TRANSPORT':
        return <Truck className="h-5 w-5" />;
      case 'ARRIVE_RELAIS_DESTINATION':
        return <MapPin className="h-5 w-5" />;
      case 'LIVRE':
        return <CheckCircle className="h-5 w-5" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  const statusOrder = ['CREATED', 'PAID', 'RECU_RELAIS', 'EN_TRANSPORT', 'ARRIVE_RELAIS_DESTINATION', 'LIVRE'];

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>Entrez votre numéro de suivi pour voir l'état de votre colis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder={t('placeholder')}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-center text-red-600">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {parcel && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Parcel Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{parcel.trackingNumber}</CardTitle>
                <Badge className={`${PARCEL_STATUS.find(s => s.id === parcel.status)?.color} text-white`}>
                  {PARCEL_STATUS.find(s => s.id === parcel.status)?.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Trajet</p>
                    <p className="font-medium">
                      {WILAYAS.find(w => w.id === parcel.villeDepart)?.name} → {WILAYAS.find(w => w.id === parcel.villeArrivee)?.name}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Poids</p>
                    <p className="font-medium">{parcel.weight ? `${parcel.weight} kg` : 'Non renseigné'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date de création</p>
                    <p className="font-medium">{new Date(parcel.createdAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Points relais:</p>
                <div className="space-y-1 text-sm">
                  <p><strong>Départ:</strong> {parcel.relaisDepart?.commerceName}</p>
                  <p><strong>Arrivée:</strong> {parcel.relaisArrivee?.commerceName}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tracking Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>{t('history')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {statusOrder.map((status, index) => {
                  const statusInfo = PARCEL_STATUS.find(s => s.id === status);
                  const isCompleted = statusOrder.indexOf(parcel.status) >= index;
                  const historyEntry = parcel.trackingHistory?.find((h: any) => h.status === status);

                  return (
                    <div key={status} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isCompleted ? statusInfo?.color + ' text-white' : 'bg-slate-200 text-slate-400'
                      }`}>
                        {getStatusIcon(status)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className={`font-medium ${isCompleted ? '' : 'text-muted-foreground'}`}>
                            {statusInfo?.label}
                          </p>
                          {historyEntry && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(historyEntry.createdAt).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </div>
                        {historyEntry?.notes && (
                          <p className="text-sm text-muted-foreground">{historyEntry.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Map Placeholder */}
      {parcel && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-full h-64 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
                  <p className="text-muted-foreground">Carte de suivi en temps réel</p>
                  <p className="text-sm text-muted-foreground">(Fonctionnalité WebSocket à implémenter)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

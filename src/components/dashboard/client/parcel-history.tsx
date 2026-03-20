'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PARCEL_STATUS, WILAYAS } from '@/lib/constants';
import { Package, MapPin, Clock, Loader2 } from 'lucide-react';

interface ParcelHistoryProps {
  userId: string;
}

export function ParcelHistory({ userId }: ParcelHistoryProps) {
  const t = useTranslations('parcel.history');
  const [parcels, setParcels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchParcels = async () => {
      try {
        const response = await fetch(`/api/parcels?clientId=${userId}`);
        const data = await response.json();
        setParcels(data);
      } catch (error) {
        console.error('Error fetching parcels:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchParcels();
  }, [userId]);

  const getStatusBadge = (status: string) => {
    const statusInfo = PARCEL_STATUS.find(s => s.id === status);
    return (
      <Badge className={`${statusInfo?.color} text-white`}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (parcels.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('noParcels')}</h3>
          <p className="text-muted-foreground">{t('createFirst')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {parcels.map((parcel) => (
        <Card key={parcel.id} className="overflow-hidden">
          <div className="flex flex-col md:flex-row">
            <div className="flex-1 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg">{parcel.trackingNumber}</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(parcel.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                {getStatusBadge(parcel.status)}
              </div>
              
              <div className="grid gap-4 md:grid-cols-2 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {WILAYAS.find(w => w.id === parcel.villeDepart)?.name} → {WILAYAS.find(w => w.id === parcel.villeArrivee)?.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>{parcel.format} - {parcel.prixClient?.toFixed(0)} DA</span>
                </div>
              </div>
            </div>
            
            <div className="border-t md:border-t-0 md:border-l p-6 bg-slate-50 dark:bg-slate-800">
              <div className="space-y-2">
                <p className="text-sm font-semibold">Points relais:</p>
                <p className="text-xs text-muted-foreground">
                  <strong>Départ:</strong> {parcel.relaisDepart?.commerceName}
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Arrivée:</strong> {parcel.relaisArrivee?.commerceName}
                </p>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

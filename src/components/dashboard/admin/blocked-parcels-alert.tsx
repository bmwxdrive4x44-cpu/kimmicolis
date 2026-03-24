"use client";

import { useState, useEffect } from "react";
import { AlertCircle, AlertTriangle, Info, RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BlockedParcel {
  parcelId: string;
  trackingNumber: string;
  currentStatus: string;
  hoursSinceUpdate: number;
  thresholdHours: number;
  clientId: string;
  relaisDepartId: string;
  relaisArriveeId: string;
  missions: Array<{ transporterId: string }>;
  lastUpdate: string;
}

interface Stats {
  totalBlocked: number;
  byStatus: Record<string, number>;
  criticalCount: number;
  averageDelayHours: number;
}

export function BlockedParcelsAlert() {
  const [parcels, setParcels] = useState<BlockedParcel[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedParcel, setSelectedParcel] = useState<BlockedParcel | null>(
    null
  );
  const [alertMessage, setAlertMessage] = useState("");
  const [alertRole, setAlertRole] = useState("ADMIN");
  const [sendingAlert, setSendingAlert] = useState(false);

  // Charger les données
  useEffect(() => {
    loadData();
    // Auto-refresh toutes les 5 minutes
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer les colis bloqués
      const parcelRes = await fetch("/api/parcels/blocked-alerts");
      if (!parcelRes.ok) throw new Error("Failed to fetch blocked parcels");
      const parcelData = await parcelRes.json();

      // Récupérer les stats
      const statsRes = await fetch("/api/parcels/blocked-alerts/stats");
      if (!statsRes.ok) throw new Error("Failed to fetch stats");
      const statsData = await statsRes.json();

      setParcels(parcelData.parcels || []);
      setStats(statsData.stats || null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      console.error("Error loading blocked parcels:", err);
    } finally {
      setLoading(false);
    }
  };

  const sendAlert = async () => {
    if (!selectedParcel || !alertMessage.trim()) {
      setError("Message required");
      return;
    }

    try {
      setSendingAlert(true);
      const res = await fetch(`/api/parcels/${selectedParcel.parcelId}/alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: alertMessage,
          notifyRole: alertRole,
        }),
      });

      if (!res.ok) throw new Error("Failed to send alert");

      // Succès
      setAlertMessage("");
      setSelectedParcel(null);
      // Rafraîchir les données
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setSendingAlert(false);
    }
  };

  // Déterminer la couleur de sévérité
  const getSeverityColor = (parcel: BlockedParcel) => {
    const ratio = parcel.hoursSinceUpdate / parcel.thresholdHours;
    if (ratio > 2) return "destructive"; // Critique (rouge)
    if (ratio > 1) return "warning"; // Attention (orange)
    return "secondary"; // OK (gris)
  };

  // Déterminer l'icône de sévérité
  const getSeverityIcon = (parcel: BlockedParcel) => {
    const ratio = parcel.hoursSinceUpdate / parcel.thresholdHours;
    if (ratio > 2) return <AlertTriangle className="w-4 h-4 text-red-600" />;
    if (ratio > 1) return <AlertCircle className="w-4 h-4 text-orange-600" />;
    return <Info className="w-4 h-4 text-blue-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Header avec bouton refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">🚨 Colis Bloqués</h2>
          <p className="text-sm text-gray-500 mt-1">
            Suivi automatique des colis n'avançant pas
          </p>
        </div>
        <Button
          onClick={loadData}
          disabled={loading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          {loading ? "Chargement..." : "Rafraîchir"}
        </Button>
      </div>

      {/* Messages d'erreur */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats.totalBlocked}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Critique</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.criticalCount}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {"> 2x seuil"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Délai moyen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.averageDelayHours}h
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Par statut</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between">
                  <span className="text-gray-600">{status}</span>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tableau des colis bloqués */}
      <Card>
        <CardHeader>
          <CardTitle>Colis Bloqués ({parcels.length})</CardTitle>
          <CardDescription>
            Colis dont le statut n'a pas changé depuis le seuil défini
          </CardDescription>
        </CardHeader>
        <CardContent>
          {parcels.length === 0 && !loading ? (
            <div className="text-center py-8 text-gray-500">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Aucun colis bloqué détecté 🎉</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Blocage</TableHead>
                  <TableHead>Seuil</TableHead>
                  <TableHead>Depuis</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcels.map((parcel) => (
                  <TableRow key={parcel.parcelId} className="hover:bg-gray-50">
                    <TableCell>{getSeverityIcon(parcel)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {parcel.trackingNumber}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{parcel.currentStatus}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-orange-600">
                        {parcel.hoursSinceUpdate}h
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-600">
                        {parcel.thresholdHours}h
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(parcel.lastUpdate).toLocaleDateString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog
                        open={selectedParcel?.parcelId === parcel.parcelId}
                        onOpenChange={(open) => {
                          if (!open) setSelectedParcel(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedParcel(parcel);
                              setAlertMessage("");
                            }}
                          >
                            Alerter
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              Envoyer une alerte
                            </DialogTitle>
                            <DialogDescription>
                              {parcel.trackingNumber} - Statut:{" "}
                              {parcel.currentStatus}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium">
                                Notifier
                              </label>
                              <Select value={alertRole} onValueChange={setAlertRole}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ADMIN">Admin</SelectItem>
                                  <SelectItem value="TRANSPORTER">
                                    Transporteur
                                  </SelectItem>
                                  <SelectItem value="CLIENT">Client</SelectItem>
                                  <SelectItem value="ALL">Tous</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-sm font-medium">
                                Message
                              </label>
                              <Textarea
                                placeholder="Message d'alerte personnalisé..."
                                value={alertMessage}
                                onChange={(e) => setAlertMessage(e.target.value)}
                                className="h-20"
                              />
                            </div>
                            <Button
                              onClick={sendAlert}
                              disabled={sendingAlert || !alertMessage.trim()}
                              className="w-full"
                            >
                              {sendingAlert ? "Envoi..." : "Envoyer l'alerte"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

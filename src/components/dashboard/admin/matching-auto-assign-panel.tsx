"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Play, Loader2, Clock3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface MatchingStatsResponse {
  success: boolean;
  stats: {
    unmatchedEligible: number;
    activeTrajets: number;
    missionsAssignedPeriod: number;
    periodHours: number;
    totalScheduledTrajets: number;
  };
  filters: {
    villeDepart: string | null;
    villeArrivee: string | null;
  };
  transporterLoad: Array<{
    transporteurId: string;
    activeMissions: number;
    name: string;
    email: string;
  }>;
  recentAssignments: Array<{
    missionId: string;
    assignedAt: string;
    status: string;
    colis: {
      trackingNumber: string;
      villeDepart: string;
      villeArrivee: string;
      status: string;
    };
    transporteur: {
      name: string | null;
      email: string;
    };
  }>;
  timestamp: string;
}

const STORAGE_KEY = "swiftcolis.matching-auto-assign.filters";
const LAST_RUN_STORAGE_KEY = "swiftcolis.matching-auto-assign.last-run";

interface LastAutoAssignRun {
  assigned: number;
  processed: number;
  skipped: number;
  at: string;
}

export function MatchingAutoAssignPanel() {
  const { toast } = useToast();
  const [data, setData] = useState<MatchingStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [limit, setLimit] = useState("50");
  const [villeDepart, setVilleDepart] = useState("");
  const [villeArrivee, setVilleArrivee] = useState("");
  const [periodHours, setPeriodHours] = useState("24");
  const [filtersReady, setFiltersReady] = useState(false);
  const [lastRun, setLastRun] = useState<LastAutoAssignRun | null>(null);

  const displayedPeriodHours = data?.stats.periodHours ?? (Number(periodHours) || 24);

  const resetFilters = () => {
    setVilleDepart("");
    setVilleArrivee("");
    setPeriodHours("24");
    setLimit("50");
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const clearLastRun = () => {
    setLastRun(null);
  };

  useEffect(() => {
    try {
      const savedFilters = window.localStorage.getItem(STORAGE_KEY);
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters) as {
          villeDepart?: string;
          villeArrivee?: string;
          periodHours?: string;
          limit?: string;
        };

        setVilleDepart(parsed.villeDepart ?? "");
        setVilleArrivee(parsed.villeArrivee ?? "");
        setPeriodHours(parsed.periodHours ?? "24");
        setLimit(parsed.limit ?? "50");
      }

      const savedLastRun = window.localStorage.getItem(LAST_RUN_STORAGE_KEY);
      if (savedLastRun) {
        const parsedLastRun = JSON.parse(savedLastRun) as Partial<LastAutoAssignRun>;
        if (
          typeof parsedLastRun.assigned === "number" &&
          typeof parsedLastRun.processed === "number" &&
          typeof parsedLastRun.skipped === "number" &&
          typeof parsedLastRun.at === "string"
        ) {
          setLastRun({
            assigned: parsedLastRun.assigned,
            processed: parsedLastRun.processed,
            skipped: parsedLastRun.skipped,
            at: parsedLastRun.at,
          });
        }
      }
    } catch {
      // Ignore invalid persisted values and continue with defaults.
    } finally {
      setFiltersReady(true);
    }
  }, []);

  useEffect(() => {
    if (!filtersReady) return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        villeDepart,
        villeArrivee,
        periodHours,
        limit,
      })
    );
  }, [filtersReady, villeDepart, villeArrivee, periodHours, limit]);

  useEffect(() => {
    if (!filtersReady) return;

    if (lastRun) {
      window.localStorage.setItem(LAST_RUN_STORAGE_KEY, JSON.stringify(lastRun));
      return;
    }

    window.localStorage.removeItem(LAST_RUN_STORAGE_KEY);
  }, [filtersReady, lastRun]);

  useEffect(() => {
    if (!filtersReady) return;
    loadStats();
  }, [filtersReady]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const trimmedDepart = villeDepart.trim();
      const trimmedArrivee = villeArrivee.trim();
      if (trimmedDepart) params.set("villeDepart", trimmedDepart);
      if (trimmedArrivee) params.set("villeArrivee", trimmedArrivee);
      if (periodHours.trim()) params.set("periodHours", periodHours.trim());

      const query = params.toString();
      const response = await fetch(`/api/matching/auto-assign/stats${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load matching stats");
      }
      setData(payload);
    } catch (error) {
      toast({
        title: "Erreur matching auto",
        description: error instanceof Error ? error.message : "Chargement impossible",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runAutoAssign = async () => {
    try {
      setRunning(true);
      const parsedLimit = Number(limit);
      const response = await fetch("/api/matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoAssignUnmatched: true, limit: Number.isFinite(parsedLimit) ? parsedLimit : 50 }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Auto-assign failed");
      }

      setLastRun({
        assigned: payload.assigned ?? 0,
        processed: payload.processed ?? 0,
        skipped: payload.skipped ?? 0,
        at: new Date().toISOString(),
      });

      toast({
        title: "Matching auto terminé",
        description: `${payload.assigned ?? 0} colis assignés / ${payload.processed ?? 0} traités`,
      });

      await loadStats();
    } catch (error) {
      toast({
        title: "Erreur exécution matching auto",
        description: error instanceof Error ? error.message : "Exécution impossible",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Matching transporteur automatique</CardTitle>
            <CardDescription>
              Priorisation disponibilité + proximité, avec traitement des colis non assignés.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Input
              placeholder="Ville départ"
              value={villeDepart}
              onChange={(e) => setVilleDepart(e.target.value)}
              className="w-36"
            />
            <Input
              placeholder="Ville arrivée"
              value={villeArrivee}
              onChange={(e) => setVilleArrivee(e.target.value)}
              className="w-36"
            />
            <Input
              type="number"
              min={1}
              max={720}
              value={periodHours}
              onChange={(e) => setPeriodHours(e.target.value)}
              className="w-24"
              placeholder="h"
            />
            <Input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-24"
            />
            <Button onClick={runAutoAssign} disabled={running || loading}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Exécuter
            </Button>
            <Button variant="outline" onClick={loadStats} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Appliquer filtres
            </Button>
            <Button variant="ghost" onClick={resetFilters} disabled={loading || running}>
              Réinitialiser
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Non assignés</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{data?.stats.unmatchedEligible ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Trajets actifs</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{data?.stats.activeTrajets ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1">/ {data?.stats.totalScheduledTrajets ?? 0} programmés</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Assignés {displayedPeriodHours}h
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{data?.stats.missionsAssignedPeriod ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-medium">Dernier run</CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearLastRun}
                      disabled={!lastRun}
                      className="h-7 px-2 text-xs"
                    >
                      Effacer
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {lastRun ? (
                    <>
                      <p className="text-sm font-semibold">{lastRun.assigned} / {lastRun.processed} assignés</p>
                      <p className="text-xs text-slate-500">Ignorés : {lastRun.skipped}</p>
                      <p className="text-xs text-slate-500">{new Date(lastRun.at).toLocaleString('fr-FR')}</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">Aucune exécution manuelle</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h4 className="font-semibold mb-3">Charge transporteurs</h4>
                <div className="space-y-2">
                  {(data?.transporterLoad ?? []).length === 0 ? (
                    <p className="text-sm text-slate-500">Aucune mission active</p>
                  ) : (
                    data?.transporterLoad.map((t) => (
                      <div key={t.transporteurId} className="flex items-center justify-between rounded border p-2">
                        <span className="text-sm truncate mr-2">{t.name || t.email || t.transporteurId}</span>
                        <Badge variant="outline">{t.activeMissions} missions</Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock3 className="h-4 w-4" />
                  <h4 className="font-semibold">Historique récent des assignations</h4>
                </div>
                <div className="max-h-72 overflow-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tracking</TableHead>
                        <TableHead>Trajet</TableHead>
                        <TableHead>Transporteur</TableHead>
                        <TableHead>Quand</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.recentAssignments ?? []).slice(0, 10).map((row) => (
                        <TableRow key={row.missionId}>
                          <TableCell className="font-mono text-xs">{row.colis?.trackingNumber}</TableCell>
                          <TableCell className="text-xs">{row.colis?.villeDepart} → {row.colis?.villeArrivee}</TableCell>
                          <TableCell className="text-xs">{row.transporteur?.name || row.transporteur?.email || 'N/A'}</TableCell>
                          <TableCell className="text-xs">{new Date(row.assignedAt).toLocaleString('fr-FR')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

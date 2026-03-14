import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Package, 
  Truck, 
  MapPin, 
  CreditCard, 
  Clock,
  CheckCircle,
  LogOut,
  User,
  Eye,
  TrendingUp,
  DollarSign,
  Briefcase,
  ArrowRight,
  Star,
  MessageSquare,
  Award
} from 'lucide-react';
import type { Reservation } from '@/types';
import { ReservationStatus, STATUS_LABELS, STATUS_COLORS, PRIX_FORMAT } from '@/types';
import { mockReservations, mockTransporteurs, mockReviews } from '@/data/mockData';
import { toast } from 'sonner';

export default function TransporteurDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  
  // Get transporteur data with reviews
  const transporteur = useMemo(() => {
    return mockTransporteurs.find(t => t.userId === user?.id);
  }, [user?.id]);
  
  // Filtrer les réservations pour ce transporteur
  const transporteurReservations = useMemo(() => {
    return mockReservations.filter(r => r.transporteurId === user?.id);
  }, [user?.id]);

  // Get transporteur reviews
  const transporteurReviews = useMemo(() => {
    if (!transporteur) return [];
    return mockReviews.filter(r => r.targetId === transporteur.id && r.targetType === 'TRANSPORTEUR');
  }, [transporteur]);

  // Stats
  const stats = useMemo(() => {
    const total = transporteurReservations.length;
    const enCours = transporteurReservations.filter(r => 
      r.statutColis === ReservationStatus.EN_COURS
    ).length;
    const livres = transporteurReservations.filter(r => 
      r.statutColis === ReservationStatus.LIVRE
    ).length;
    const totalGains = transporteurReservations
      .filter(r => r.statutColis === ReservationStatus.LIVRE)
      .reduce((sum, r) => sum + r.netTransporteur, 0);
    const gainsEnAttente = transporteurReservations
      .filter(r => r.statutColis === ReservationStatus.EN_COURS || r.statutColis === ReservationStatus.RECU_RELAIS)
      .reduce((sum, r) => sum + r.netTransporteur, 0);
    
    return { total, enCours, livres, totalGains, gainsEnAttente };
  }, [transporteurReservations]);

  // Missions disponibles (réservations payées sans transporteur)
  const availableMissions = useMemo(() => {
    return mockReservations.filter(r => 
      r.statutColis === ReservationStatus.PAYE && 
      !r.transporteurId
    );
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAcceptMission = () => {
    toast.success('Mission acceptée !');
    setSelectedReservation(null);
  };

  const handleUpdateStatus = (newStatus: ReservationStatus) => {
    toast.success(`Statut mis à jour : ${STATUS_LABELS[newStatus]}`);
    setSelectedReservation(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link 
                to="/"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">ColisWay Pro</span>
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <button 
                  onClick={() => setActiveTab('overview')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'overview' ? 'text-green-600' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Tableau de bord
                </button>
                <button 
                  onClick={() => setActiveTab('missions')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'missions' ? 'text-green-600' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Missions
                </button>
                <button 
                  onClick={() => setActiveTab('earnings')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'earnings' ? 'text-green-600' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Mes gains
                </button>
                <button 
                  onClick={() => setActiveTab('reviews')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'reviews' ? 'text-green-600' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Avis
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
                <User className="w-4 h-4" />
                <span>{user?.prenom} {user?.nom}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <OverviewTab 
            stats={stats} 
            recentMissions={transporteurReservations.slice(0, 5)}
            onViewMission={setSelectedReservation}
            transporteur={transporteur}
            reviews={transporteurReviews}
          />
        )}
        {activeTab === 'missions' && (
          <MissionsTab 
            availableMissions={availableMissions}
            myMissions={transporteurReservations.filter(r => 
              r.statutColis === ReservationStatus.EN_COURS || 
              r.statutColis === ReservationStatus.RECU_RELAIS
            )}
            onAcceptMission={handleAcceptMission}
            onViewMission={setSelectedReservation}
            onUpdateStatus={handleUpdateStatus}
          />
        )}
        {activeTab === 'earnings' && (
          <EarningsTab 
            reservations={transporteurReservations}
            totalGains={stats.totalGains}
            gainsEnAttente={stats.gainsEnAttente}
          />
        )}
        {activeTab === 'reviews' && (
          <ReviewsTab 
            reviews={transporteurReviews}
            transporteur={transporteur}
          />
        )}
      </main>

      {/* Mission Detail Dialog */}
      <Dialog open={!!selectedReservation} onOpenChange={() => setSelectedReservation(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détails de la mission</DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <MissionDetail 
              reservation={selectedReservation}
              isAvailable={!selectedReservation.transporteurId}
              onAccept={handleAcceptMission}
              onUpdateStatus={handleUpdateStatus}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Rating Stars Component
function RatingStars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-6 h-6';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`}
        />
      ))}
    </div>
  );
}

// Overview Tab
function OverviewTab({ 
  stats, 
  recentMissions,
  onViewMission,
  transporteur,
  reviews
}: { 
  stats: { 
    total: number; 
    enCours: number; 
    livres: number; 
    totalGains: number;
    gainsEnAttente: number;
  };
  recentMissions: Reservation[];
  onViewMission: (mission: Reservation) => void;
  transporteur?: typeof mockTransporteurs[0];
  reviews: typeof mockReviews;
}) {
  const averageRating = transporteur?.rating || 0;
  const totalReviews = transporteur?.totalReviews || 0;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bonjour, Transporteur !</h1>
        <p className="text-slate-600">Voici votre activité du jour</p>
      </div>

      {/* Rating Card */}
      {transporteur && (
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Award className="w-8 h-8 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Votre réputation</p>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-slate-900">{averageRating}</span>
                    <span className="text-slate-500">/5</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <RatingStars rating={Math.round(averageRating)} size="md" />
                    <span className="text-sm text-slate-500">({totalReviews} avis)</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-slate-900">{transporteur.totalMissions}</p>
                  <p className="text-sm text-slate-600">Missions</p>
                </div>
                <div className="w-px bg-slate-300" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{transporteur.missionsReussies}</p>
                  <p className="text-sm text-slate-600">Livrés</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total missions</p>
                <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">En cours</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.enCours}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Livrés</p>
                <p className="text-3xl font-bold text-green-600">{stats.livres}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Gains totaux</p>
                <p className="text-3xl font-bold text-green-600">{stats.totalGains.toLocaleString()} DA</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gains en attente */}
      {stats.gainsEnAttente > 0 && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Gains en attente de validation</p>
                  <p className="text-2xl font-bold text-yellow-700">{stats.gainsEnAttente.toLocaleString()} DA</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
                En cours de livraison
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Reviews */}
      {reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Avis récents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reviews.slice(0, 3).map((review) => (
                <div key={review.id} className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{review.authorName}</span>
                        <RatingStars rating={review.rating} />
                      </div>
                      <p className="text-sm text-slate-600 mt-2">{review.comment}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(review.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Missions */}
      <Card>
        <CardHeader>
          <CardTitle>Missions récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentMissions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Truck className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucune mission pour le moment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentMissions.map((mission) => (
                <MissionCard 
                  key={mission.id} 
                  mission={mission}
                  onView={() => onViewMission(mission)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Reviews Tab
function ReviewsTab({ 
  reviews,
  transporteur
}: { 
  reviews: typeof mockReviews;
  transporteur?: typeof mockTransporteurs[0];
}) {
  const averageRating = transporteur?.rating || 0;
  
  // Calculate rating distribution
  const ratingDistribution = useMemo(() => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(review => {
      const rating = Math.min(5, Math.max(1, review.rating)) as 1 | 2 | 3 | 4 | 5;
      distribution[rating]++;
    });
    return distribution;
  }, [reviews]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Mes évaluations</h1>

      {/* Rating Overview */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="text-center">
              <p className="text-5xl font-bold text-slate-900">{averageRating}</p>
              <div className="flex justify-center mt-2">
                <RatingStars rating={Math.round(averageRating)} size="md" />
              </div>
              <p className="text-sm text-slate-500 mt-2">{reviews.length} avis</p>
            </div>
            <div className="flex-1 w-full">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratingDistribution[star as 1 | 2 | 3 | 4 | 5];
                const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-3 mb-2">
                    <span className="text-sm w-8">{star} ★</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-400 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-slate-500 w-8">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      <Card>
        <CardHeader>
          <CardTitle>Tous les avis</CardTitle>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun avis pour le moment</p>
              <p className="text-sm">Les avis de vos clients apparaîtront ici</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-slate-200 last:border-0 pb-4 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{review.authorName}</p>
                          <div className="flex items-center gap-2">
                            <RatingStars rating={review.rating} />
                            <span className="text-xs text-slate-400">
                              {new Date(review.createdAt).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-600 mt-3 ml-13">{review.comment}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Missions Tab
function MissionsTab({ 
  availableMissions,
  myMissions,
  onAcceptMission,
  onViewMission,
  onUpdateStatus
}: { 
  availableMissions: Reservation[];
  myMissions: Reservation[];
  onAcceptMission: () => void;
  onViewMission: (mission: Reservation) => void;
  onUpdateStatus: (status: ReservationStatus) => void;
}) {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Missions</h1>

      <Tabs defaultValue="available">
        <TabsList>
          <TabsTrigger value="available">
            Disponibles ({availableMissions.length})
          </TabsTrigger>
          <TabsTrigger value="mine">
            Mes missions ({myMissions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-4">
          {availableMissions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500">Aucune mission disponible pour le moment</p>
              </CardContent>
            </Card>
          ) : (
            availableMissions.map((mission) => (
              <AvailableMissionCard 
                key={mission.id}
                mission={mission}
                onAccept={onAcceptMission}
                onView={() => onViewMission(mission)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="mine" className="space-y-4">
          {myMissions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Truck className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500">Vous n'avez pas de mission en cours</p>
              </CardContent>
            </Card>
          ) : (
            myMissions.map((mission) => (
              <MyMissionCard 
                key={mission.id}
                mission={mission}
                onView={() => onViewMission(mission)}
                onUpdateStatus={onUpdateStatus}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Earnings Tab
function EarningsTab({ 
  reservations,
  totalGains,
  gainsEnAttente
}: { 
  reservations: Reservation[];
  totalGains: number;
  gainsEnAttente: number;
}) {
  const [filter, setFilter] = useState('');

  const filteredReservations = reservations.filter(r => 
    r.statutColis === ReservationStatus.LIVRE ||
    r.statutColis === ReservationStatus.EN_COURS ||
    r.statutColis === ReservationStatus.RECU_RELAIS
  );

  const monthlyGains = useMemo(() => {
    const gains: Record<string, number> = {};
    reservations
      .filter(r => r.statutColis === ReservationStatus.LIVRE)
      .forEach(r => {
        const month = new Date(r.dateLivraison || r.dateCreation).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        gains[month] = (gains[month] || 0) + r.netTransporteur;
      });
    return gains;
  }, [reservations]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Mes gains</h1>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Gains confirmés</p>
                <p className="text-2xl font-bold text-green-700">{totalGains.toLocaleString()} DA</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">En attente</p>
                <p className="text-2xl font-bold text-yellow-700">{gainsEnAttente.toLocaleString()} DA</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total potentiel</p>
                <p className="text-2xl font-bold text-slate-900">{(totalGains + gainsEnAttente).toLocaleString()} DA</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown */}
      {Object.entries(monthlyGains).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gains par mois</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(monthlyGains).map(([month, amount]) => (
                <div key={month} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="font-medium">{month}</span>
                  <span className="font-bold text-green-600">{amount.toLocaleString()} DA</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed List */}
      <Card>
        <CardHeader>
          <CardTitle>Détail des missions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Input
              placeholder="Rechercher..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            {filteredReservations.map((reservation) => (
              <div key={reservation.id} className="flex justify-between items-center p-4 border rounded-lg">
                <div>
                  <div className="font-medium">#{reservation.id}</div>
                  <div className="text-sm text-slate-500">
                    {reservation.ligne?.villeDepart} → {reservation.ligne?.villeArrivee}
                  </div>
                  <div className="text-sm text-slate-500">
                    {new Date(reservation.dateCreation).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600">{reservation.netTransporteur.toLocaleString()} DA</div>
                  <Badge className={STATUS_COLORS[reservation.statutColis]}>
                    {STATUS_LABELS[reservation.statutColis]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Mission Card Component
function MissionCard({ mission, onView }: { mission: Reservation; onView: () => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Badge className={STATUS_COLORS[mission.statutColis]}>
              {STATUS_LABELS[mission.statutColis]}
            </Badge>
            <span className="text-sm text-slate-500">#{mission.id}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-900 font-medium">
            <MapPin className="w-4 h-4 text-slate-400" />
            {mission.ligne?.villeDepart}
            <ArrowRight className="w-4 h-4 text-slate-400" />
            {mission.ligne?.villeArrivee}
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm text-slate-600">
            <span>{PRIX_FORMAT[mission.formatColis].label}</span>
            <span>•</span>
            <span className="text-green-600 font-medium">{mission.netTransporteur.toLocaleString()} DA</span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onView}>
          <Eye className="w-4 h-4 mr-2" />
          Détails
        </Button>
      </div>
    </div>
  );
}

// Available Mission Card
function AvailableMissionCard({ 
  mission, 
  onAccept,
  onView 
}: { 
  mission: Reservation; 
  onAccept: () => void;
  onView: () => void;
}) {
  return (
    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Badge className="bg-green-100 text-green-700">Disponible</Badge>
            <span className="text-sm text-slate-500">#{mission.id}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-900 font-medium">
            <MapPin className="w-4 h-4 text-slate-400" />
            {mission.ligne?.villeDepart}
            <ArrowRight className="w-4 h-4 text-slate-400" />
            {mission.ligne?.villeArrivee}
          </div>
          <div className="mt-2 grid sm:grid-cols-3 gap-2 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Package className="w-4 h-4" />
              {PRIX_FORMAT[mission.formatColis].label}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <CreditCard className="w-4 h-4" />
              {mission.prixClient.toLocaleString()} DA
            </div>
            <div className="flex items-center gap-2 text-green-600 font-medium">
              <DollarSign className="w-4 h-4" />
              Vous gagnez: {mission.netTransporteur.toLocaleString()} DA
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onView}>
            <Eye className="w-4 h-4 mr-2" />
            Voir
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={onAccept}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Accepter
          </Button>
        </div>
      </div>
    </div>
  );
}

// My Mission Card
function MyMissionCard({ 
  mission, 
  onView,
  onUpdateStatus 
}: { 
  mission: Reservation; 
  onView: () => void;
  onUpdateStatus: (status: ReservationStatus) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Badge className={STATUS_COLORS[mission.statutColis]}>
              {STATUS_LABELS[mission.statutColis]}
            </Badge>
            <span className="text-sm text-slate-500">#{mission.id}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-900 font-medium">
            <MapPin className="w-4 h-4 text-slate-400" />
            {mission.ligne?.villeDepart}
            <ArrowRight className="w-4 h-4 text-slate-400" />
            {mission.ligne?.villeArrivee}
          </div>
          <div className="mt-2 text-sm text-green-600 font-medium">
            Gain: {mission.netTransporteur.toLocaleString()} DA
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onView}>
            <Eye className="w-4 h-4 mr-2" />
            Détails
          </Button>
          {mission.statutColis === ReservationStatus.EN_COURS && (
            <Button 
              size="sm" 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => onUpdateStatus(ReservationStatus.RECU_RELAIS)}
            >
              <MapPin className="w-4 h-4 mr-2" />
              Déposer au relais
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Mission Detail Component
function MissionDetail({ 
  reservation, 
  isAvailable,
  onAccept,
  onUpdateStatus
}: { 
  reservation: Reservation;
  isAvailable: boolean;
  onAccept: () => void;
  onUpdateStatus: (status: ReservationStatus) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Badge className={STATUS_COLORS[reservation.statutColis]}>
          {STATUS_LABELS[reservation.statutColis]}
        </Badge>
        <span className="text-sm text-slate-500">#{reservation.id}</span>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-slate-500">Trajet</Label>
          <div className="flex items-center gap-2 text-lg font-medium">
            <MapPin className="w-5 h-5 text-slate-400" />
            {reservation.ligne?.villeDepart}
            <ArrowRight className="w-5 h-5 text-slate-400" />
            {reservation.ligne?.villeArrivee}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-500">Format</Label>
            <p className="font-medium">{PRIX_FORMAT[reservation.formatColis].label}</p>
          </div>
          <div>
            <Label className="text-slate-500">Date</Label>
            <p className="font-medium">{new Date(reservation.dateCreation).toLocaleDateString('fr-FR')}</p>
          </div>
        </div>

        <div>
          <Label className="text-slate-500">Point relais</Label>
          <div className="bg-slate-50 rounded-lg p-3 mt-1">
            <p className="font-medium">{reservation.relais?.nom}</p>
            <p className="text-sm text-slate-600">{reservation.relais?.adresse}</p>
            <p className="text-sm text-slate-600">{reservation.relais?.telephone}</p>
          </div>
        </div>

        <div>
          <Label className="text-slate-500">Destinataire</Label>
          <div className="mt-1">
            <p className="font-medium">{reservation.nomDestinataire}</p>
            <p className="text-sm text-slate-600 flex items-center gap-2">
              <span>📞</span>
              {reservation.telephoneDestinataire}
            </p>
          </div>
        </div>

        {reservation.description && (
          <div>
            <Label className="text-slate-500">Description</Label>
            <p className="text-sm text-slate-600 mt-1">{reservation.description}</p>
          </div>
        )}

        <div className="bg-green-50 rounded-lg p-4">
          <Label className="text-green-700">Votre rémunération</Label>
          <p className="text-2xl font-bold text-green-700">{reservation.netTransporteur.toLocaleString()} DA</p>
          <p className="text-sm text-green-600">
            Prix client: {reservation.prixClient.toLocaleString()} DA - 
            Commission: {reservation.commissionPlatform.toLocaleString()} DA - 
            Relais: {reservation.commissionRelais.toLocaleString()} DA
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        {isAvailable ? (
          <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={onAccept}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Accepter la mission
          </Button>
        ) : reservation.statutColis === ReservationStatus.EN_COURS && (
          <Button 
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            onClick={() => onUpdateStatus(ReservationStatus.RECU_RELAIS)}
          >
            <MapPin className="w-4 h-4 mr-2" />
            Confirmer dépôt au relais
          </Button>
        )}
      </div>
    </div>
  );
}

// Label component
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={`text-sm font-medium ${className}`}>
      {children}
    </label>
  );
}

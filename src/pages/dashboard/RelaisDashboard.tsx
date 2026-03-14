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
  Store, 
  MapPin, 
  CheckCircle,
  LogOut,
  Eye,
  Phone,
  DollarSign,
  Inbox,
  CheckCheck,
  ArrowRight,
  Star,
  MessageSquare,
  Award,
  User
} from 'lucide-react';
import type { Reservation } from '@/types';
import { ReservationStatus, STATUS_LABELS, STATUS_COLORS, PRIX_FORMAT } from '@/types';
import { mockReservations, mockRelais, mockReviews } from '@/data/mockData';
import { toast } from 'sonner';

export default function RelaisDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  
  // Get relais data with reviews
  const relais = useMemo(() => {
    return mockRelais.find(r => r.userId === user?.id) || mockRelais[0];
  }, [user?.id]);
  
  // Filtrer les réservations pour ce point relais
  const relaisReservations = useMemo(() => {
    return mockReservations.filter(r => r.relaisId === relais?.id);
  }, [relais?.id]);

  // Get relais reviews
  const relaisReviews = useMemo(() => {
    if (!relais) return [];
    return mockReviews.filter(r => r.targetId === relais.id && r.targetType === 'RELAIS');
  }, [relais]);

  // Stats
  const stats = useMemo(() => {
    const total = relaisReservations.length;
    const aTraiter = relaisReservations.filter(r => 
      r.statutColis === ReservationStatus.EN_COURS
    ).length;
    const recus = relaisReservations.filter(r => 
      r.statutColis === ReservationStatus.RECU_RELAIS
    ).length;
    const remis = relaisReservations.filter(r => 
      r.statutColis === ReservationStatus.LIVRE
    ).length;
    const totalGains = relaisReservations
      .filter(r => r.statutColis === ReservationStatus.LIVRE || r.statutColis === ReservationStatus.RECU_RELAIS)
      .reduce((sum, r) => sum + r.commissionRelais, 0);
    
    return { total, aTraiter, recus, remis, totalGains };
  }, [relaisReservations]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleReceiveColis = () => {
    toast.success('Colis marqué comme reçu !');
    setSelectedReservation(null);
  };

  const handleDeliverColis = () => {
    toast.success('Colis remis au destinataire !');
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
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <Store className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">ColisWay Relais</span>
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <button 
                  onClick={() => setActiveTab('overview')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'overview' ? 'text-purple-600' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Tableau de bord
                </button>
                <button 
                  onClick={() => setActiveTab('colis')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'colis' ? 'text-purple-600' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Mes colis
                </button>
                <button 
                  onClick={() => setActiveTab('earnings')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'earnings' ? 'text-purple-600' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Mes gains
                </button>
                <button 
                  onClick={() => setActiveTab('reviews')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'reviews' ? 'text-purple-600' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Avis
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
                <Store className="w-4 h-4" />
                <span>{relais?.nom || 'Point Relais'}</span>
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
            recentColis={relaisReservations.slice(0, 5)}
            onViewColis={setSelectedReservation}
            relais={relais}
            reviews={relaisReviews}
          />
        )}
        {activeTab === 'colis' && (
          <ColisTab 
            colisATraiter={relaisReservations.filter(r => r.statutColis === ReservationStatus.EN_COURS)}
            colisRecus={relaisReservations.filter(r => r.statutColis === ReservationStatus.RECU_RELAIS)}
            colisRemis={relaisReservations.filter(r => r.statutColis === ReservationStatus.LIVRE)}
            onViewColis={setSelectedReservation}
            onReceive={handleReceiveColis}
            onDeliver={handleDeliverColis}
          />
        )}
        {activeTab === 'earnings' && (
          <EarningsTab 
            reservations={relaisReservations}
            totalGains={stats.totalGains}
          />
        )}
        {activeTab === 'reviews' && (
          <ReviewsTab 
            reviews={relaisReviews}
            relais={relais}
          />
        )}
      </main>

      {/* Colis Detail Dialog */}
      <Dialog open={!!selectedReservation} onOpenChange={() => setSelectedReservation(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détails du colis</DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <ColisDetail 
              reservation={selectedReservation}
              onReceive={handleReceiveColis}
              onDeliver={handleDeliverColis}
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
  recentColis,
  onViewColis,
  relais,
  reviews
}: { 
  stats: { 
    total: number; 
    aTraiter: number; 
    recus: number; 
    remis: number;
    totalGains: number;
  };
  recentColis: Reservation[];
  onViewColis: (colis: Reservation) => void;
  relais?: typeof mockRelais[0];
  reviews: typeof mockReviews;
}) {
  const averageRating = relais?.rating || 0;
  const totalReviews = relais?.totalReviews || 0;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bonjour !</h1>
        <p className="text-slate-600">Voici l'activité de votre point relais</p>
      </div>

      {/* Rating Card */}
      {relais && averageRating > 0 && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Award className="w-8 h-8 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Réputation de votre point relais</p>
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
                  <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                  <p className="text-sm text-slate-600">Colis traités</p>
                </div>
                <div className="w-px bg-slate-300" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.remis}</p>
                  <p className="text-sm text-slate-600">Remis</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total colis</p>
                <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">À traiter</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.aTraiter}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Inbox className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Reçus</p>
                <p className="text-3xl font-bold text-purple-600">{stats.recus}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Remis</p>
                <p className="text-3xl font-bold text-green-600">{stats.remis}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCheck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Gains</p>
                <p className="text-2xl font-bold text-green-700">{stats.totalGains.toLocaleString()} DA</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Info */}
      {stats.aTraiter > 0 && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Inbox className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium text-yellow-800">Vous avez {stats.aTraiter} colis en attente de réception</p>
                <p className="text-sm text-yellow-700">Les transporteurs attendent votre confirmation</p>
              </div>
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

      {/* Recent Colis */}
      <Card>
        <CardHeader>
          <CardTitle>Colis récents</CardTitle>
        </CardHeader>
        <CardContent>
          {recentColis.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun colis pour le moment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentColis.map((colis) => (
                <ColisCard 
                  key={colis.id} 
                  colis={colis}
                  onView={() => onViewColis(colis)}
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
  relais
}: { 
  reviews: typeof mockReviews;
  relais?: typeof mockRelais[0];
}) {
  const averageRating = relais?.rating || 0;
  
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
      <h1 className="text-2xl font-bold text-slate-900">Avis clients</h1>

      {/* Rating Overview */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="text-center">
              <p className="text-5xl font-bold text-slate-900">{averageRating || '-'}</p>
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
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-purple-600" />
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

// Colis Tab
function ColisTab({ 
  colisATraiter,
  colisRecus,
  colisRemis,
  onViewColis,
  onReceive,
  onDeliver
}: { 
  colisATraiter: Reservation[];
  colisRecus: Reservation[];
  colisRemis: Reservation[];
  onViewColis: (colis: Reservation) => void;
  onReceive: () => void;
  onDeliver: () => void;
}) {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Gestion des colis</h1>

      <Tabs defaultValue="a-traiter">
        <TabsList>
          <TabsTrigger value="a-traiter">
            À traiter ({colisATraiter.length})
          </TabsTrigger>
          <TabsTrigger value="recus">
            Reçus ({colisRecus.length})
          </TabsTrigger>
          <TabsTrigger value="remis">
            Remis ({colisRemis.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="a-traiter" className="space-y-4">
          {colisATraiter.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Inbox className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500">Aucun colis à traiter</p>
              </CardContent>
            </Card>
          ) : (
            colisATraiter.map((colis) => (
              <ATraiterCard 
                key={colis.id}
                colis={colis}
                onView={() => onViewColis(colis)}
                onReceive={onReceive}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="recus" className="space-y-4">
          {colisRecus.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500">Aucun colis en attente de retrait</p>
              </CardContent>
            </Card>
          ) : (
            colisRecus.map((colis) => (
              <RecuCard 
                key={colis.id}
                colis={colis}
                onView={() => onViewColis(colis)}
                onDeliver={onDeliver}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="remis" className="space-y-4">
          {colisRemis.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCheck className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500">Aucun colis remis</p>
              </CardContent>
            </Card>
          ) : (
            colisRemis.map((colis) => (
              <RemisCard 
                key={colis.id}
                colis={colis}
                onView={() => onViewColis(colis)}
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
  totalGains
}: { 
  reservations: Reservation[];
  totalGains: number;
}) {
  const [filter, setFilter] = useState('');

  const filteredReservations = reservations.filter(r => 
    r.statutColis === ReservationStatus.LIVRE ||
    r.statutColis === ReservationStatus.RECU_RELAIS
  );

  const gainsByFormat = useMemo(() => {
    const gains = { PETIT: 0, MOYEN: 0, GROS: 0, count: { PETIT: 0, MOYEN: 0, GROS: 0 } };
    filteredReservations.forEach(r => {
      gains[r.formatColis] += r.commissionRelais;
      gains.count[r.formatColis]++;
    });
    return gains;
  }, [filteredReservations]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Mes gains</h1>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Gains totaux</p>
                <p className="text-2xl font-bold text-green-700">{totalGains.toLocaleString()} DA</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Colis traités</p>
                <p className="text-2xl font-bold text-slate-900">{filteredReservations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown by format */}
      <Card>
        <CardHeader>
          <CardTitle>Rémunération par format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
              <div>
                <span className="font-medium">Petit format</span>
                <span className="text-sm text-slate-500 ml-2">({gainsByFormat.count.PETIT} colis)</span>
              </div>
              <span className="font-bold text-green-600">{gainsByFormat.PETIT.toLocaleString()} DA</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
              <div>
                <span className="font-medium">Moyen format</span>
                <span className="text-sm text-slate-500 ml-2">({gainsByFormat.count.MOYEN} colis)</span>
              </div>
              <span className="font-bold text-green-600">{gainsByFormat.MOYEN.toLocaleString()} DA</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
              <div>
                <span className="font-medium">Gros format</span>
                <span className="text-sm text-slate-500 ml-2">({gainsByFormat.count.GROS} colis)</span>
              </div>
              <span className="font-bold text-green-600">{gainsByFormat.GROS.toLocaleString()} DA</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commission Info */}
      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="p-6">
          <h3 className="font-semibold text-purple-900 mb-2">Vos tarifs de rémunération</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white rounded-lg">
              <div className="text-2xl font-bold text-purple-600">80 DA</div>
              <div className="text-sm text-slate-600">Par colis petit format</div>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <div className="text-2xl font-bold text-purple-600">120 DA</div>
              <div className="text-sm text-slate-600">Par colis moyen format</div>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <div className="text-2xl font-bold text-purple-600">200 DA</div>
              <div className="text-sm text-slate-600">Par colis gros format</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed List */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des colis rémunérés</CardTitle>
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
                    {new Date(reservation.dateCreation).toLocaleDateString('fr-FR')}
                  </div>
                  <div className="text-sm text-slate-500">
                    {PRIX_FORMAT[reservation.formatColis].label}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600">+{reservation.commissionRelais.toLocaleString()} DA</div>
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

// Colis Card Component
function ColisCard({ colis, onView }: { colis: Reservation; onView: () => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Badge className={STATUS_COLORS[colis.statutColis]}>
              {STATUS_LABELS[colis.statutColis]}
            </Badge>
            <span className="text-sm text-slate-500">#{colis.id}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-900 font-medium">
            <MapPin className="w-4 h-4 text-slate-400" />
            {colis.ligne?.villeDepart}
            <ArrowRight className="w-4 h-4 text-slate-400" />
            {colis.ligne?.villeArrivee}
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm text-slate-600">
            <span>{PRIX_FORMAT[colis.formatColis].label}</span>
            <span>•</span>
            <span className="text-green-600 font-medium">+{colis.commissionRelais.toLocaleString()} DA</span>
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

// À Traiter Card
function ATraiterCard({ 
  colis, 
  onView,
  onReceive 
}: { 
  colis: Reservation; 
  onView: () => void;
  onReceive: () => void;
}) {
  return (
    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Badge className="bg-yellow-100 text-yellow-700">En cours de livraison</Badge>
            <span className="text-sm text-slate-500">#{colis.id}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-900 font-medium">
            <MapPin className="w-4 h-4 text-slate-400" />
            {colis.ligne?.villeDepart}
            <ArrowRight className="w-4 h-4 text-slate-400" />
            {colis.ligne?.villeArrivee}
          </div>
          <div className="mt-2 text-sm text-slate-600">
            Format: {PRIX_FORMAT[colis.formatColis].label}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onView}>
            <Eye className="w-4 h-4 mr-2" />
            Voir
          </Button>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={onReceive}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Recevoir
          </Button>
        </div>
      </div>
    </div>
  );
}

// Reçu Card
function RecuCard({ 
  colis, 
  onView,
  onDeliver 
}: { 
  colis: Reservation; 
  onView: () => void;
  onDeliver: () => void;
}) {
  return (
    <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Badge className="bg-purple-100 text-purple-700">Reçu - En attente de retrait</Badge>
            <span className="text-sm text-slate-500">#{colis.id}</span>
          </div>
          <div className="text-slate-900 font-medium">
            {colis.nomDestinataire}
          </div>
          <div className="text-sm text-slate-600 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            {colis.telephoneDestinataire}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onView}>
            <Eye className="w-4 h-4 mr-2" />
            Voir
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={onDeliver}>
            <CheckCheck className="w-4 h-4 mr-2" />
            Remis
          </Button>
        </div>
      </div>
    </div>
  );
}

// Remis Card
function RemisCard({ 
  colis, 
  onView 
}: { 
  colis: Reservation; 
  onView: () => void;
}) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Badge className="bg-green-100 text-green-700">Remis</Badge>
            <span className="text-sm text-slate-500">#{colis.id}</span>
          </div>
          <div className="text-slate-900 font-medium">
            {colis.nomDestinataire}
          </div>
          <div className="text-sm text-slate-600">
            Remis le {new Date(colis.dateLivraison || colis.dateCreation).toLocaleDateString('fr-FR')}
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-green-600">+{colis.commissionRelais.toLocaleString()} DA</div>
          <Button variant="outline" size="sm" onClick={onView}>
            <Eye className="w-4 h-4 mr-2" />
            Voir
          </Button>
        </div>
      </div>
    </div>
  );
}

// Colis Detail Component
function ColisDetail({ 
  reservation, 
  onReceive,
  onDeliver
}: { 
  reservation: Reservation;
  onReceive: () => void;
  onDeliver: () => void;
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
            <Label className="text-slate-500">Date d'envoi</Label>
            <p className="font-medium">{new Date(reservation.dateCreation).toLocaleDateString('fr-FR')}</p>
          </div>
        </div>

        <div>
          <Label className="text-slate-500">Destinataire</Label>
          <div className="bg-slate-50 rounded-lg p-3 mt-1">
            <p className="font-medium">{reservation.nomDestinataire}</p>
            <p className="text-sm text-slate-600 flex items-center gap-2">
              <Phone className="w-4 h-4" />
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

        <div className="bg-purple-50 rounded-lg p-4">
          <Label className="text-purple-700">Votre rémunération</Label>
          <p className="text-2xl font-bold text-purple-700">{reservation.commissionRelais.toLocaleString()} DA</p>
          <p className="text-sm text-purple-600">
            Pour ce colis format {PRIX_FORMAT[reservation.formatColis].label.toLowerCase()}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        {reservation.statutColis === ReservationStatus.EN_COURS && (
          <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={onReceive}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Confirmer réception
          </Button>
        )}
        {reservation.statutColis === ReservationStatus.RECU_RELAIS && (
          <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={onDeliver}>
            <CheckCheck className="w-4 h-4 mr-2" />
            Confirmer remise au destinataire
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

import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Package, 
  Plus, 
  Search, 
  MapPin, 
  CreditCard, 
  Clock,
  CheckCircle,
  LogOut,
  User,
  Eye,
  Calendar,
  Phone,
  ArrowRight,
  ChevronRight,
  Loader2,
  Star,
  Truck,
  Store,
  Info,
  MessageSquare,
  Navigation
} from 'lucide-react';
import type { Reservation, Line, Relais } from '@/types';
import { ParcelSize, ReservationStatus, STATUS_LABELS, STATUS_COLORS, PRIX_FORMAT, PaymentMethod, PAYMENT_METHOD_LABELS } from '@/types';
import { mockReservations, mockLines, mockRelais, calculerCommissions, commissionPlatform, mockTransporteurs, mockReviews } from '@/data/mockData';
import { toast } from 'sonner';

export default function ClientDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showNewReservation, setShowNewReservation] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>(mockReservations.filter(r => r.clientId === user?.id));

  // Stats
  const stats = useMemo(() => {
    const total = reservations.length;
    const enCours = reservations.filter(r => 
      r.statutColis === ReservationStatus.PAYE || 
      r.statutColis === ReservationStatus.EN_COURS ||
      r.statutColis === ReservationStatus.RECU_RELAIS
    ).length;
    const livres = reservations.filter(r => r.statutColis === ReservationStatus.LIVRE).length;
    const totalDepense = reservations
      .filter(r => r.statutColis !== ReservationStatus.ANNULE)
      .reduce((sum, r) => sum + r.prixClient, 0);
    
    return { total, enCours, livres, totalDepense };
  }, [reservations]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNewReservation = (newReservation: Reservation) => {
    setReservations([newReservation, ...reservations]);
    setShowNewReservation(false);
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
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">ColisWay</span>
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <button 
                  onClick={() => setActiveTab('overview')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'overview' ? 'text-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Tableau de bord
                </button>
                <button 
                  onClick={() => setActiveTab('reservations')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'reservations' ? 'text-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Mes colis
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'history' ? 'text-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Historique
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
            reservations={reservations}
            onNewReservation={() => setShowNewReservation(true)}
            onViewReservation={setSelectedReservation}
          />
        )}
        {activeTab === 'reservations' && (
          <ReservationsTab 
            reservations={reservations.filter(r => r.statutColis !== ReservationStatus.LIVRE && r.statutColis !== ReservationStatus.ANNULE)}
            onNewReservation={() => setShowNewReservation(true)}
            onViewReservation={setSelectedReservation}
          />
        )}
        {activeTab === 'history' && (
          <HistoryTab 
            reservations={reservations.filter(r => r.statutColis === ReservationStatus.LIVRE || r.statutColis === ReservationStatus.ANNULE)}
            onViewReservation={setSelectedReservation}
          />
        )}
      </main>

      {/* New Reservation Dialog */}
      <NewReservationDialog 
        open={showNewReservation} 
        onClose={() => setShowNewReservation(false)}
        onSuccess={handleNewReservation}
      />

      {/* Reservation Detail Dialog */}
      <ReservationDetailDialog
        reservation={selectedReservation}
        onClose={() => setSelectedReservation(null)}
      />
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ 
  stats, 
  reservations, 
  onNewReservation,
  onViewReservation 
}: { 
  stats: { total: number; enCours: number; livres: number; totalDepense: number };
  reservations: Reservation[];
  onNewReservation: () => void;
  onViewReservation: (reservation: Reservation) => void;
}) {
  const recentReservations = reservations.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bonjour !</h1>
        <p className="text-slate-600">Voici un aperçu de votre activité</p>
      </div>

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <p className="text-sm text-slate-600">Total dépensé</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalDepense.toLocaleString()} DA</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action */}
      <Card className="bg-blue-600 text-white">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold">Envoyer un nouveau colis</h3>
              <p className="text-blue-100">Créez une réservation en quelques clics</p>
            </div>
            <Button 
              variant="secondary" 
              size="lg"
              onClick={onNewReservation}
              className="bg-white text-blue-600 hover:bg-blue-50"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nouvelle réservation
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Reservations */}
      <Card>
        <CardHeader>
          <CardTitle>Réservations récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentReservations.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucune réservation pour le moment</p>
              <Button variant="outline" className="mt-4" onClick={onNewReservation}>
                Créer ma première réservation
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentReservations.map((reservation) => (
                <ReservationCard 
                  key={reservation.id} 
                  reservation={reservation}
                  onView={() => onViewReservation(reservation)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Reservations Tab Component
function ReservationsTab({ 
  reservations, 
  onNewReservation,
  onViewReservation 
}: { 
  reservations: Reservation[];
  onNewReservation: () => void;
  onViewReservation: (reservation: Reservation) => void;
}) {
  const [filter, setFilter] = useState('');

  const filteredReservations = reservations.filter(r => 
    r.id.toLowerCase().includes(filter.toLowerCase()) ||
    (r.ligne?.villeDepart.toLowerCase().includes(filter.toLowerCase()) || false) ||
    (r.ligne?.villeArrivee.toLowerCase().includes(filter.toLowerCase()) || false)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Mes colis en cours</h1>
        <Button onClick={onNewReservation}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle réservation
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Rechercher un colis..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredReservations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">Aucun colis en cours</p>
            <Button variant="outline" className="mt-4" onClick={onNewReservation}>
              Créer une réservation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredReservations.map((reservation) => (
            <ReservationCard 
              key={reservation.id} 
              reservation={reservation}
              onView={() => onViewReservation(reservation)}
              detailed
            />
          ))}
        </div>
      )}
    </div>
  );
}

// History Tab Component
function HistoryTab({ 
  reservations, 
  onViewReservation 
}: { 
  reservations: Reservation[];
  onViewReservation: (reservation: Reservation) => void;
}) {
  const [filter, setFilter] = useState('');

  const filteredReservations = reservations.filter(r => 
    r.id.toLowerCase().includes(filter.toLowerCase()) ||
    (r.ligne?.villeDepart.toLowerCase().includes(filter.toLowerCase()) || false) ||
    (r.ligne?.villeArrivee.toLowerCase().includes(filter.toLowerCase()) || false)
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Historique</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Rechercher dans l'historique..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredReservations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">Aucun historique</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredReservations.map((reservation) => (
            <ReservationCard 
              key={reservation.id} 
              reservation={reservation}
              onView={() => onViewReservation(reservation)}
              detailed
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Rating Stars Component
function RatingStars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
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

// Reservation Card Component
function ReservationCard({ 
  reservation, 
  onView,
  detailed = false 
}: { 
  reservation: Reservation; 
  onView: () => void;
  detailed?: boolean;
}) {
  const transporteur = mockTransporteurs.find(t => t.userId === reservation.transporteurId);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Badge className={STATUS_COLORS[reservation.statutColis]}>
              {STATUS_LABELS[reservation.statutColis]}
            </Badge>
            <span className="text-sm text-slate-500">#{reservation.id}</span>
            {reservation.isPaid && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                <CheckCircle className="w-3 h-3 mr-1" />
                Payé
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-slate-900 font-medium">
            <MapPin className="w-4 h-4 text-slate-400" />
            {reservation.ligne?.villeDepart}
            <ArrowRight className="w-4 h-4 text-slate-400" />
            {reservation.ligne?.villeArrivee}
          </div>
          {detailed && (
            <div className="mt-3 grid sm:grid-cols-3 gap-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Package className="w-4 h-4" />
                {PRIX_FORMAT[reservation.formatColis].label}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-4 h-4" />
                {new Date(reservation.dateCreation).toLocaleDateString('fr-FR')}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <CreditCard className="w-4 h-4" />
                {reservation.prixClient.toLocaleString()} DA
              </div>
            </div>
          )}
          {/* Transporteur & Relais Info with Ratings */}
          {(reservation.transporteur || reservation.relais) && (
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              {transporteur && (
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-500" />
                  <span className="text-slate-600">{transporteur.entreprise}</span>
                  {transporteur.rating && (
                    <div className="flex items-center gap-1">
                      <RatingStars rating={Math.round(transporteur.rating)} />
                      <span className="text-slate-500">({transporteur.rating})</span>
                    </div>
                  )}
                </div>
              )}
              {reservation.relais && (
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-purple-500" />
                  <span className="text-slate-600">{reservation.relais.nom}</span>
                  {reservation.relais.rating && reservation.relais.rating > 0 && (
                    <div className="flex items-center gap-1">
                      <RatingStars rating={Math.round(reservation.relais.rating)} />
                      <span className="text-slate-500">({reservation.relais.rating})</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onView}>
            <Eye className="w-4 h-4 mr-2" />
            Détails
          </Button>
        </div>
      </div>
    </div>
  );
}

// Reservation Detail Dialog
function ReservationDetailDialog({
  reservation,
  onClose
}: {
  reservation: Reservation | null;
  onClose: () => void;
}) {
  if (!reservation) return null;

  const transporteur = mockTransporteurs.find(t => t.userId === reservation.transporteurId);
  const transporteurReviews = mockReviews.filter(r => r.targetId === reservation.transporteurId && r.targetType === 'TRANSPORTEUR');
  const relaisReviews = mockReviews.filter(r => r.targetId === reservation.relaisId && r.targetType === 'RELAIS');

  return (
    <Dialog open={!!reservation} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Détails de la réservation #{reservation.id}</span>
            <Badge className={STATUS_COLORS[reservation.statutColis]}>
              {STATUS_LABELS[reservation.statutColis]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tracking Timeline */}
          {reservation.trackingHistory && reservation.trackingHistory.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Navigation className="w-4 h-4" />
                Suivi du colis
              </h3>
              <div className="space-y-3">
                {reservation.trackingHistory.map((track, index) => (
                  <div key={track.id} className="flex items-start gap-3">
                    <div className={`w-3 h-3 rounded-full mt-1.5 ${index === 0 ? 'bg-blue-600' : 'bg-slate-300'}`} />
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-sm">{STATUS_LABELS[track.statut]}</span>
                        <span className="text-xs text-slate-500">
                          {new Date(track.date).toLocaleString('fr-FR')}
                        </span>
                      </div>
                      {track.commentaire && (
                        <p className="text-sm text-slate-600 mt-1">{track.commentaire}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Route Info */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                Trajet
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Départ</span>
                  <span className="font-medium">{reservation.ligne?.villeDepart}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Arrivée</span>
                  <span className="font-medium">{reservation.ligne?.villeArrivee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Format</span>
                  <span className="font-medium">{PRIX_FORMAT[reservation.formatColis].label}</span>
                </div>
                {reservation.poids && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Poids</span>
                    <span className="font-medium">{reservation.poids} kg</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-purple-50 rounded-xl p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-purple-600" />
                Destinataire
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Nom</span>
                  <span className="font-medium">{reservation.nomDestinataire}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Téléphone</span>
                  <span className="font-medium">{reservation.telephoneDestinataire}</span>
                </div>
              </div>
              {reservation.description && (
                <div className="mt-3 pt-3 border-t border-purple-200">
                  <span className="text-slate-600 text-sm">Description:</span>
                  <p className="text-sm mt-1">{reservation.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-green-50 rounded-xl p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-green-600" />
              Paiement
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Méthode</span>
                <span className="font-medium">
                  {reservation.paymentMethod 
                    ? PAYMENT_METHOD_LABELS[reservation.paymentMethod].label 
                    : 'Non payé'}
                </span>
              </div>
              {reservation.paymentReference && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Référence</span>
                  <span className="font-medium">{reservation.paymentReference}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">Prix total</span>
                <span className="font-bold text-lg text-green-700">{reservation.prixClient.toLocaleString()} DA</span>
              </div>
            </div>
          </div>

          {/* Transporteur Info with Reviews */}
          {transporteur && (
            <div className="bg-orange-50 rounded-xl p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4 text-orange-600" />
                Transporteur
              </h3>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{transporteur.entreprise}</p>
                  <p className="text-sm text-slate-600">{transporteur.vehiculeType}</p>
                  {transporteur.rating && (
                    <div className="flex items-center gap-2 mt-2">
                      <RatingStars rating={Math.round(transporteur.rating)} size="md" />
                      <span className="text-sm font-medium">{transporteur.rating}/5</span>
                      <span className="text-sm text-slate-500">({transporteur.totalReviews} avis)</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Transporteur Reviews */}
              {transporteurReviews.length > 0 && (
                <div className="mt-4 pt-4 border-t border-orange-200">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Avis récents
                  </h4>
                  <div className="space-y-2">
                    {transporteurReviews.slice(0, 2).map((review) => (
                      <div key={review.id} className="bg-white rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{review.authorName}</span>
                          <RatingStars rating={review.rating} />
                        </div>
                        <p className="text-slate-600">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Relais Info with Reviews */}
          {reservation.relais && (
            <div className="bg-indigo-50 rounded-xl p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Store className="w-4 h-4 text-indigo-600" />
                Point Relais
              </h3>
              <div className="space-y-1">
                <p className="font-medium">{reservation.relais.nom}</p>
                <p className="text-sm text-slate-600">{reservation.relais.adresse}</p>
                <p className="text-sm text-slate-600">{reservation.relais.wilaya}</p>
                <p className="text-sm text-slate-600 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {reservation.relais.telephone}
                </p>
                {reservation.relais.rating && reservation.relais.rating > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <RatingStars rating={Math.round(reservation.relais.rating)} size="md" />
                    <span className="text-sm font-medium">{reservation.relais.rating}/5</span>
                    <span className="text-sm text-slate-500">({reservation.relais.totalReviews} avis)</span>
                  </div>
                )}
              </div>
              {/* Relais Reviews */}
              {relaisReviews.length > 0 && (
                <div className="mt-4 pt-4 border-t border-indigo-200">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Avis récents
                  </h4>
                  <div className="space-y-2">
                    {relaisReviews.slice(0, 2).map((review) => (
                      <div key={review.id} className="bg-white rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{review.authorName}</span>
                          <RatingStars rating={review.rating} />
                        </div>
                        <p className="text-slate-600">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Commission Breakdown */}
          <div className="bg-slate-100 rounded-xl p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Répartition des frais
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Prix client</span>
                <span className="font-medium">{reservation.prixClient.toLocaleString()} DA</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span className="text-slate-600">Commission plateforme (10%)</span>
                <span className="font-medium">-{reservation.commissionPlatform.toLocaleString()} DA</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span className="text-slate-600">Commission point relais</span>
                <span className="font-medium">-{reservation.commissionRelais.toLocaleString()} DA</span>
              </div>
              <div className="border-t border-slate-300 pt-2 flex justify-between text-green-700 font-semibold">
                <span>Net transporteur</span>
                <span>{reservation.netTransporteur.toLocaleString()} DA</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// New Reservation Dialog Component
function NewReservationDialog({ 
  open, 
  onClose,
  onSuccess 
}: { 
  open: boolean; 
  onClose: () => void;
  onSuccess: (reservation: Reservation) => void;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    villeDepart: '',
    villeArrivee: '',
    ligneId: '',
    formatColis: '' as ParcelSize | '',
    relaisId: '',
    nomDestinataire: '',
    telephoneDestinataire: '',
    description: '',
    paymentMethod: '' as PaymentMethod | ''
  });

  const [selectedLine, setSelectedLine] = useState<Line | null>(null);
  const [selectedRelais, setSelectedRelais] = useState<Relais | null>(null);
  const [price, setPrice] = useState(0);

  const availableLines = mockLines.filter(l => l.isActive);
  const availableRelais = mockRelais.filter(r => r.statutValidation === 'VALIDE');

  const handleLineSelect = (lineId: string) => {
    const line = availableLines.find(l => l.id === lineId);
    if (line) {
      setSelectedLine(line);
      setFormData({ ...formData, ligneId: lineId });
      if (formData.formatColis) {
        updatePrice(line, formData.formatColis as ParcelSize);
      }
    }
  };

  const handleFormatSelect = (format: ParcelSize) => {
    setFormData({ ...formData, formatColis: format });
    if (selectedLine) {
      updatePrice(selectedLine, format);
    }
  };

  const updatePrice = (line: Line, format: ParcelSize) => {
    let prix = 0;
    switch (format) {
      case ParcelSize.PETIT:
        prix = line.tarifPetit;
        break;
      case ParcelSize.MOYEN:
        prix = line.tarifMoyen;
        break;
      case ParcelSize.GROS:
        prix = line.tarifGros;
        break;
    }
    setPrice(prix);
  };

  const handleRelaisSelect = (relaisId: string) => {
    const relais = availableRelais.find(r => r.id === relaisId);
    setSelectedRelais(relais || null);
    setFormData({ ...formData, relaisId });
  };

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setFormData({ ...formData, paymentMethod: method });
  };

  const handleSubmit = async () => {
    if (!selectedLine || !formData.formatColis || !selectedRelais || !formData.paymentMethod) return;

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const commissions = calculerCommissions(
      price,
      selectedRelais.commissionPetit,
      commissionPlatform.pourcentage
    );

    const paymentRef = `${formData.paymentMethod}-${Date.now().toString().slice(-8)}`;

    const newReservation: Reservation = {
      id: String(Date.now()),
      clientId: user?.id || '',
      ligneId: selectedLine.id,
      relaisId: selectedRelais.id,
      formatColis: formData.formatColis as ParcelSize,
      nomDestinataire: formData.nomDestinataire,
      telephoneDestinataire: formData.telephoneDestinataire,
      description: formData.description,
      prixClient: price,
      commissionPlatform: commissions.commissionPlatform,
      commissionRelais: commissions.commissionRelais,
      netTransporteur: commissions.netTransporteur,
      statutColis: ReservationStatus.PAYE,
      dateCreation: new Date(),
      datePaiement: new Date(),
      paymentMethod: formData.paymentMethod as PaymentMethod,
      paymentReference: paymentRef,
      isPaid: true,
      ligne: selectedLine,
      relais: selectedRelais
    };

    toast.success('Réservation créée et payée avec succès !');
    onSuccess(newReservation);
    setIsLoading(false);
    setStep(1);
    setFormData({
      villeDepart: '',
      villeArrivee: '',
      ligneId: '',
      formatColis: '',
      relaisId: '',
      nomDestinataire: '',
      telephoneDestinataire: '',
      description: '',
      paymentMethod: ''
    });
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.ligneId && formData.formatColis;
      case 2:
        return formData.relaisId;
      case 3:
        return formData.nomDestinataire && formData.telephoneDestinataire;
      case 4:
        return formData.paymentMethod;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle réservation</DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s === step ? 'bg-blue-600 text-white' : 
                s < step ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {s < step ? <CheckCircle className="w-4 h-4" /> : s}
              </div>
              {s < 5 && <div className={`flex-1 h-1 ${s < step ? 'bg-green-500' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Line and Format */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <Label className="text-base">Sélectionnez votre trajet</Label>
              <div className="mt-3 grid gap-3">
                {availableLines.map((line) => (
                  <button
                    key={line.id}
                    onClick={() => handleLineSelect(line.id)}
                    className={`flex items-center justify-between p-4 border-2 rounded-xl transition-all ${
                      formData.ligneId === line.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-slate-400" />
                      <span className="font-medium">{line.villeDepart} → {line.villeArrivee}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>

            {selectedLine && (
              <div>
                <Label className="text-base">Choisissez le format</Label>
                <div className="mt-3 grid sm:grid-cols-3 gap-3">
                  {[
                    { size: ParcelSize.PETIT, price: selectedLine.tarifPetit },
                    { size: ParcelSize.MOYEN, price: selectedLine.tarifMoyen },
                    { size: ParcelSize.GROS, price: selectedLine.tarifGros }
                  ].map(({ size, price }) => (
                    <button
                      key={size}
                      onClick={() => handleFormatSelect(size)}
                      className={`p-4 border-2 rounded-xl transition-all ${
                        formData.formatColis === size 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="font-medium">{PRIX_FORMAT[size].label}</div>
                      <div className="text-sm text-slate-500">{PRIX_FORMAT[size].poids}</div>
                      <div className="mt-2 text-lg font-bold text-blue-600">{price.toLocaleString()} DA</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Relay Point */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Label className="text-base">Choisissez un point relais</Label>
              <p className="text-sm text-slate-500 mb-3">
                Sélectionnez le point relais où le destinataire pourra retirer le colis
              </p>
              <div className="grid gap-3 max-h-80 overflow-y-auto">
                {availableRelais.map((relais) => (
                  <button
                    key={relais.id}
                    onClick={() => handleRelaisSelect(relais.id)}
                    className={`flex items-start gap-3 p-4 border-2 rounded-xl transition-all text-left ${
                      formData.relaisId === relais.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{relais.nom}</div>
                      <div className="text-sm text-slate-500">{relais.adresse}</div>
                      <div className="text-sm text-slate-500">{relais.wilaya}</div>
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4" />
                        {relais.telephone}
                      </div>
                      {relais.rating && relais.rating > 0 && (
                        <div className="mt-1 flex items-center gap-1">
                          <RatingStars rating={Math.round(relais.rating)} />
                          <span className="text-xs text-slate-500">({relais.rating})</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Recipient Info */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="nomDestinataire">Nom du destinataire</Label>
              <Input
                id="nomDestinataire"
                value={formData.nomDestinataire}
                onChange={(e) => setFormData({ ...formData, nomDestinataire: e.target.value })}
                placeholder="Nom et prénom du destinataire"
              />
            </div>
            <div>
              <Label htmlFor="telephoneDestinataire">Téléphone du destinataire</Label>
              <Input
                id="telephoneDestinataire"
                value={formData.telephoneDestinataire}
                onChange={(e) => setFormData({ ...formData, telephoneDestinataire: e.target.value })}
                placeholder="05XX XX XX XX"
              />
            </div>
            <div>
              <Label htmlFor="description">Description du colis (optionnel)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Contenu du colis, instructions spéciales..."
              />
            </div>
          </div>
        )}

        {/* Step 4: Payment Method */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <Label className="text-base">Choisissez votre mode de paiement</Label>
              <p className="text-sm text-slate-500 mb-3">
                Sélectionnez une méthode de paiement disponible en Algérie
              </p>
              <div className="grid gap-3">
                {(Object.keys(PaymentMethod) as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    onClick={() => handlePaymentMethodSelect(method)}
                    className={`flex items-center gap-4 p-4 border-2 rounded-xl transition-all text-left ${
                      formData.paymentMethod === method 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0 border border-slate-200">
                      <span className="text-2xl">{PAYMENT_METHOD_LABELS[method].icon}</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{PAYMENT_METHOD_LABELS[method].label}</div>
                      <div className="text-sm text-slate-500">{PAYMENT_METHOD_LABELS[method].description}</div>
                    </div>
                    {formData.paymentMethod === method && (
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Summary */}
        {step === 5 && selectedLine && selectedRelais && (
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-lg">Récapitulatif</h3>
              
              <div className="grid gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Trajet</span>
                  <span className="font-medium">{selectedLine.villeDepart} → {selectedLine.villeArrivee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Format</span>
                  <span className="font-medium">{PRIX_FORMAT[formData.formatColis as ParcelSize].label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Point relais</span>
                  <span className="font-medium">{selectedRelais.nom}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Destinataire</span>
                  <span className="font-medium">{formData.nomDestinataire}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Mode de paiement</span>
                  <span className="font-medium flex items-center gap-2">
                    <span>{PAYMENT_METHOD_LABELS[formData.paymentMethod as PaymentMethod].icon}</span>
                    {PAYMENT_METHOD_LABELS[formData.paymentMethod as PaymentMethod].label}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Prix du transport</span>
                  <span>{price.toLocaleString()} DA</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total à payer</span>
                  <span className="text-blue-600">{price.toLocaleString()} DA</span>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <div className="text-yellow-600 flex-shrink-0">⚠️</div>
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Paiement sécurisé</p>
                <p>Le transporteur sera payé uniquement après confirmation de la livraison.</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <Button 
            variant="outline" 
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
          >
            {step === 1 ? 'Annuler' : 'Précédent'}
          </Button>
          
          {step < 5 ? (
            <Button 
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              Suivant
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Payer {price.toLocaleString()} DA
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

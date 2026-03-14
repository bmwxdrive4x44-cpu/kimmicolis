import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Package, 
  LayoutDashboard, 
  MapPin, 
  Users, 
  LogOut,
  User,
  Truck,
  Store,
  TrendingUp,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Edit,
  Trash2,
  Search,
  ArrowRight
} from 'lucide-react';
import type { Reservation, Line, Relais } from '@/types';
import { ReservationStatus, STATUS_LABELS, STATUS_COLORS, UserRole, RelayStatus } from '@/types';
import { mockReservations, mockLines, mockRelais, mockUsers, commissionPlatform } from '@/data/mockData';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [lines, setLines] = useState<Line[]>(mockLines);
  const [relais, setRelais] = useState<Relais[]>(mockRelais);
  const [commission, setCommission] = useState(commissionPlatform.pourcentage);
  const [showLineDialog, setShowLineDialog] = useState(false);
  const [editingLine, setEditingLine] = useState<Line | null>(null);

  // Stats globales
  const stats = useMemo(() => {
    const totalReservations = mockReservations.length;
    const totalUsers = mockUsers.length;
    const totalRelais = relais.filter(r => r.statutValidation === RelayStatus.VALIDE).length;
    const totalCA = mockReservations
      .filter(r => r.statutColis !== ReservationStatus.ANNULE)
      .reduce((sum, r) => sum + r.prixClient, 0);
    const totalCommissions = mockReservations
      .filter(r => r.statutColis !== ReservationStatus.ANNULE)
      .reduce((sum, r) => sum + r.commissionPlatform, 0);
    
    return { 
      totalReservations, 
      totalUsers, 
      totalRelais, 
      totalCA,
      totalCommissions,
      pendingRelais: relais.filter(r => r.statutValidation === RelayStatus.EN_ATTENTE).length
    };
  }, [relais]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSaveLine = (lineData: Partial<Line>) => {
    if (editingLine) {
      setLines(lines.map(l => l.id === editingLine.id ? { ...l, ...lineData } as Line : l));
      toast.success('Ligne mise à jour');
    } else {
      const newLine: Line = {
        id: String(Date.now()),
        villeDepart: lineData.villeDepart || '',
        villeArrivee: lineData.villeArrivee || '',
        tarifPetit: lineData.tarifPetit || 0,
        tarifMoyen: lineData.tarifMoyen || 0,
        tarifGros: lineData.tarifGros || 0,
        isActive: true
      };
      setLines([...lines, newLine]);
      toast.success('Ligne créée');
    }
    setShowLineDialog(false);
    setEditingLine(null);
  };

  const handleDeleteLine = (id: string) => {
    setLines(lines.filter(l => l.id !== id));
    toast.success('Ligne supprimée');
  };

  const handleValidateRelais = (relaisId: string, validate: boolean) => {
    setRelais(relais.map(r => 
      r.id === relaisId 
        ? { ...r, statutValidation: validate ? RelayStatus.VALIDE : RelayStatus.REFUSE }
        : r
    ));
    toast.success(validate ? 'Point relais validé' : 'Point relais refusé');
  };

  const handleUpdateCommission = (newCommission: number) => {
    setCommission(newCommission);
    toast.success(`Commission mise à jour : ${newCommission}%`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link 
                to="/"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <LayoutDashboard className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold">ColisWay Admin</span>
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <button 
                  onClick={() => setActiveTab('overview')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'overview' ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
                >
                  Vue d'ensemble
                </button>
                <button 
                  onClick={() => setActiveTab('lines')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'lines' ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
                >
                  Lignes
                </button>
                <button 
                  onClick={() => setActiveTab('relais')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'relais' ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
                >
                  Points relais
                </button>
                <button 
                  onClick={() => setActiveTab('users')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'users' ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
                >
                  Utilisateurs
                </button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={`text-sm font-medium transition-colors ${activeTab === 'settings' ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
                >
                  Configuration
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
                <User className="w-4 h-4" />
                <span>Admin</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-white">
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab stats={stats} reservations={mockReservations} />}
        {activeTab === 'lines' && (
          <LinesTab 
            lines={lines} 
            onAdd={() => { setEditingLine(null); setShowLineDialog(true); }}
            onEdit={(line) => { setEditingLine(line); setShowLineDialog(true); }}
            onDelete={handleDeleteLine}
          />
        )}
        {activeTab === 'relais' && (
          <RelaisTab 
            relais={relais} 
            onValidate={handleValidateRelais}
          />
        )}
        {activeTab === 'users' && <UsersTab users={mockUsers} />}
        {activeTab === 'settings' && (
          <SettingsTab 
            commission={commission}
            onUpdateCommission={handleUpdateCommission}
          />
        )}
      </main>

      {/* Line Dialog */}
      <Dialog open={showLineDialog} onOpenChange={() => setShowLineDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLine ? 'Modifier la ligne' : 'Nouvelle ligne'}</DialogTitle>
          </DialogHeader>
          <LineForm 
            line={editingLine}
            onSave={handleSaveLine}
            onCancel={() => setShowLineDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Overview Tab
function OverviewTab({ 
  stats, 
  reservations 
}: { 
  stats: { 
    totalReservations: number; 
    totalUsers: number; 
    totalRelais: number; 
    totalCA: number;
    totalCommissions: number;
    pendingRelais: number;
  };
  reservations: Reservation[];
}) {
  const recentReservations = reservations.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Vue d'ensemble</h1>
        <p className="text-slate-600">Statistiques globales de la plateforme</p>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Réservations</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalReservations}</p>
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
                <p className="text-sm text-slate-600">Utilisateurs</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalUsers}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Points relais</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalRelais}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Store className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">CA total</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalCA.toLocaleString()} DA</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {stats.pendingRelais > 0 && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="font-medium text-yellow-800">{stats.pendingRelais} point(s) relais en attente de validation</p>
                  <p className="text-sm text-yellow-700">Vérifiez et validez les nouvelles inscriptions</p>
                </div>
              </div>
              <Button variant="outline" className="border-yellow-300 text-yellow-700 hover:bg-yellow-100">
                Voir
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commission Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-blue-900">Commission plateforme</p>
                <p className="text-2xl font-bold text-blue-700">{stats.totalCommissions.toLocaleString()} DA</p>
                <p className="text-sm text-blue-600">Taux actuel : {commissionPlatform.pourcentage}%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Reservations */}
      <Card>
        <CardHeader>
          <CardTitle>Réservations récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentReservations.map((reservation) => (
              <div key={reservation.id} className="flex justify-between items-center p-4 border rounded-lg">
                <div>
                  <div className="font-medium">#{reservation.id}</div>
                  <div className="text-sm text-slate-500">
                    {reservation.ligne?.villeDepart} → {reservation.ligne?.villeArrivee}
                  </div>
                  <div className="text-sm text-slate-500">
                    {reservation.client?.prenom} {reservation.client?.nom}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{reservation.prixClient.toLocaleString()} DA</div>
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

// Lines Tab
function LinesTab({ 
  lines, 
  onAdd,
  onEdit,
  onDelete 
}: { 
  lines: Line[];
  onAdd: () => void;
  onEdit: (line: Line) => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState('');

  const filteredLines = lines.filter(l => 
    l.villeDepart.toLowerCase().includes(search.toLowerCase()) ||
    l.villeArrivee.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Gestion des lignes</h1>
        <Button onClick={onAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle ligne
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Rechercher une ligne..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium text-slate-600">Trajet</th>
                  <th className="text-right p-4 font-medium text-slate-600">Petit</th>
                  <th className="text-right p-4 font-medium text-slate-600">Moyen</th>
                  <th className="text-right p-4 font-medium text-slate-600">Gros</th>
                  <th className="text-center p-4 font-medium text-slate-600">Statut</th>
                  <th className="text-right p-4 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLines.map((line) => (
                  <tr key={line.id} className="border-b hover:bg-slate-50">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        {line.villeDepart}
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        {line.villeArrivee}
                      </div>
                    </td>
                    <td className="p-4 text-right">{line.tarifPetit.toLocaleString()} DA</td>
                    <td className="p-4 text-right">{line.tarifMoyen.toLocaleString()} DA</td>
                    <td className="p-4 text-right">{line.tarifGros.toLocaleString()} DA</td>
                    <td className="p-4 text-center">
                      <Badge className={line.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                        {line.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(line)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onDelete(line.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Relais Tab
function RelaisTab({ 
  relais, 
  onValidate 
}: { 
  relais: Relais[];
  onValidate: (id: string, validate: boolean) => void;
}) {
  const [search, setSearch] = useState('');

  const filteredRelais = relais.filter(r => 
    r.nom.toLowerCase().includes(search.toLowerCase()) ||
    r.wilaya.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Gestion des points relais</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Rechercher un point relais..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Tous ({relais.length})</TabsTrigger>
          <TabsTrigger value="pending">
            En attente ({relais.filter(r => r.statutValidation === RelayStatus.EN_ATTENTE).length})
          </TabsTrigger>
          <TabsTrigger value="validated">
            Validés ({relais.filter(r => r.statutValidation === RelayStatus.VALIDE).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {filteredRelais.map((r) => (
            <RelaisCard key={r.id} relais={r} onValidate={onValidate} />
          ))}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {filteredRelais.filter(r => r.statutValidation === RelayStatus.EN_ATTENTE).map((r) => (
            <RelaisCard key={r.id} relais={r} onValidate={onValidate} />
          ))}
        </TabsContent>

        <TabsContent value="validated" className="space-y-4">
          {filteredRelais.filter(r => r.statutValidation === RelayStatus.VALIDE).map((r) => (
            <RelaisCard key={r.id} relais={r} onValidate={onValidate} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Relais Card
function RelaisCard({ 
  relais, 
  onValidate 
}: { 
  relais: Relais;
  onValidate: (id: string, validate: boolean) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Badge className={
              relais.statutValidation === RelayStatus.VALIDE ? 'bg-green-100 text-green-700' :
              relais.statutValidation === RelayStatus.EN_ATTENTE ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }>
              {relais.statutValidation === RelayStatus.VALIDE ? 'Validé' :
               relais.statutValidation === RelayStatus.EN_ATTENTE ? 'En attente' : 'Refusé'}
            </Badge>
          </div>
          <h3 className="font-semibold text-lg">{relais.nom}</h3>
          <p className="text-slate-600">{relais.adresse}</p>
          <p className="text-slate-500 text-sm">{relais.wilaya}</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium">Commissions:</span>
            <span>Petit: {relais.commissionPetit} DA</span>
            <span>•</span>
            <span>Moyen: {relais.commissionMoyen} DA</span>
            <span>•</span>
            <span>Gros: {relais.commissionGros} DA</span>
          </div>
        </div>
        {relais.statutValidation === RelayStatus.EN_ATTENTE && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => onValidate(relais.id, false)}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Refuser
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => onValidate(relais.id, true)}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Valider
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Users Tab
function UsersTab({ users }: { users: typeof mockUsers }) {
  const [search, setSearch] = useState('');

  const filteredUsers = users.filter(u => 
    u.nom.toLowerCase().includes(search.toLowerCase()) ||
    u.prenom.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const roleIcons = {
    [UserRole.CLIENT]: User,
    [UserRole.TRANSPORTEUR]: Truck,
    [UserRole.RELAIS]: Store,
    [UserRole.ADMIN]: LayoutDashboard
  };

  const roleColors = {
    [UserRole.CLIENT]: 'bg-blue-100 text-blue-700',
    [UserRole.TRANSPORTEUR]: 'bg-green-100 text-green-700',
    [UserRole.RELAIS]: 'bg-purple-100 text-purple-700',
    [UserRole.ADMIN]: 'bg-slate-100 text-slate-700'
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Gestion des utilisateurs</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Rechercher un utilisateur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium text-slate-600">Utilisateur</th>
                  <th className="text-left p-4 font-medium text-slate-600">Rôle</th>
                  <th className="text-left p-4 font-medium text-slate-600">Téléphone</th>
                  <th className="text-center p-4 font-medium text-slate-600">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const Icon = roleIcons[user.role];
                  return (
                    <tr key={user.id} className="border-b hover:bg-slate-50">
                      <td className="p-4">
                        <div>
                          <div className="font-medium">{user.prenom} {user.nom}</div>
                          <div className="text-sm text-slate-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={roleColors[user.role]}>
                          <Icon className="w-3 h-3 mr-1" />
                          {user.role}
                        </Badge>
                      </td>
                      <td className="p-4">{user.telephone}</td>
                      <td className="p-4 text-center">
                        <Badge className={user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {user.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Settings Tab
function SettingsTab({ 
  commission, 
  onUpdateCommission 
}: { 
  commission: number;
  onUpdateCommission: (value: number) => void;
}) {
  const [newCommission, setNewCommission] = useState(commission);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Configuration</h1>

      <Card>
        <CardHeader>
          <CardTitle>Commission plateforme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="commission">Pourcentage de commission (%)</Label>
            <div className="flex gap-4 mt-2">
              <Input
                id="commission"
                type="number"
                min="0"
                max="50"
                value={newCommission}
                onChange={(e) => setNewCommission(Number(e.target.value))}
                className="w-32"
              />
              <Button onClick={() => onUpdateCommission(newCommission)}>
                Mettre à jour
              </Button>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              Ce pourcentage sera appliqué sur chaque réservation pour calculer la commission de la plateforme.
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 mt-4">
            <h4 className="font-medium mb-2">Exemple de calcul</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Prix client (colis moyen):</span>
                <span>2 000 DA</span>
              </div>
              <div className="flex justify-between">
                <span>Commission plateforme ({commission}%):</span>
                <span>{(2000 * commission / 100).toFixed(0)} DA</span>
              </div>
              <div className="flex justify-between">
                <span>Commission relais:</span>
                <span>120 DA</span>
              </div>
              <div className="flex justify-between font-medium border-t pt-2">
                <span>Net transporteur:</span>
                <span>{(2000 - (2000 * commission / 100) - 120).toFixed(0)} DA</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Line Form Component
function LineForm({ 
  line, 
  onSave, 
  onCancel 
}: { 
  line: Line | null;
  onSave: (data: Partial<Line>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    villeDepart: line?.villeDepart || '',
    villeArrivee: line?.villeArrivee || '',
    tarifPetit: line?.tarifPetit || 0,
    tarifMoyen: line?.tarifMoyen || 0,
    tarifGros: line?.tarifGros || 0
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Ville de départ</Label>
          <Input
            value={formData.villeDepart}
            onChange={(e) => setFormData({ ...formData, villeDepart: e.target.value })}
            placeholder="Ex: Alger"
          />
        </div>
        <div>
          <Label>Ville d'arrivée</Label>
          <Input
            value={formData.villeArrivee}
            onChange={(e) => setFormData({ ...formData, villeArrivee: e.target.value })}
            placeholder="Ex: Oran"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Tarif petit</Label>
          <Input
            type="number"
            value={formData.tarifPetit}
            onChange={(e) => setFormData({ ...formData, tarifPetit: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Tarif moyen</Label>
          <Input
            type="number"
            value={formData.tarifMoyen}
            onChange={(e) => setFormData({ ...formData, tarifMoyen: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Tarif gros</Label>
          <Input
            type="number"
            value={formData.tarifGros}
            onChange={(e) => setFormData({ ...formData, tarifGros: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Annuler
        </Button>
        <Button 
          onClick={() => onSave(formData)} 
          className="flex-1"
          disabled={!formData.villeDepart || !formData.villeArrivee}
        >
          {line ? 'Mettre à jour' : 'Créer'}
        </Button>
      </div>
    </div>
  );
}

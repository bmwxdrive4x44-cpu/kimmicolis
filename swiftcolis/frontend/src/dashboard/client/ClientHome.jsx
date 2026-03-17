import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { colisAPI } from '../../api';
import { Box, Plus, Truck, CheckCircle, Clock, MapPin, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

const ClientHome = () => {
  const { user } = useContext(AuthContext);
  const [colis, setColis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, enCours: 0, livres: 0 });

  useEffect(() => {
    loadColis();
  }, []);

  const loadColis = async () => {
    try {
      const response = await colisAPI.getByClient();
      const colisList = response.data.colis || [];
      setColis(colisList.slice(0, 5)); // 5 derniers
      
      setStats({
        total: colisList.length,
        enCours: colisList.filter(c => !['livré', 'annulé'].includes(c.statut)).length,
        livres: colisList.filter(c => c.statut === 'livré').length,
      });
    } catch (error) {
      console.error('Erreur chargement colis:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'creé': 'bg-gray-100 text-gray-800',
      'en_attente_transport': 'bg-yellow-100 text-yellow-800',
      'reçu_relais_depart': 'bg-blue-100 text-blue-800',
      'en_transport': 'bg-primary-100 text-primary-800',
      'arrivé_relais_destination': 'bg-green-100 text-green-800',
      'livré': 'bg-green-100 text-green-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'creé': 'Créé',
      'en_attente_transport': 'En attente',
      'reçu_relais_depart': 'Au relais',
      'en_transport': 'En transport',
      'arrivé_relais_destination': 'Arrivé',
      'livré': 'Livré',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bonjour, {user?.nom} 👋</h1>
        <p className="text-gray-600 mt-1">Gérez vos envois de colis en toute simplicité</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total colis</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="bg-primary-100 p-3 rounded-lg">
              <Box className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En cours</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.enCours}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Livrés</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.livres}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <Link to="/dashboard/client/create" className="block">
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Créer un nouveau colis</h3>
              <p className="text-primary-100 mt-1">Expédiez votre colis en quelques clics</p>
            </div>
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <Plus className="w-6 h-6" />
            </div>
          </div>
        </div>
      </Link>

      {/* Recent Colis */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Derniers colis</h2>
          <Link to="/dashboard/client/history" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            Voir tout →
          </Link>
        </div>

        {colis.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Aucun colis pour le moment</p>
            <Link to="/dashboard/client/create" className="text-primary-600 hover:text-primary-700 font-medium mt-2 inline-block">
              Créer votre premier colis
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Trajet</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Format</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Prix</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Statut</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {colis.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">#{c.id}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <span>{c.ville_depart}</span>
                        <ArrowRight className="w-4 h-4 mx-2 text-gray-400" />
                        <span>{c.ville_arrivee}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 capitalize">{c.format}</td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{c.prix_client} DZD</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${getStatusBadge(c.statut)}`}>
                        {getStatusLabel(c.statut)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(c.date_creation).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4">
                      <Link 
                        to={`/tracking/${c.id}`}
                        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                      >
                        Suivre
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const ArrowRight = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

export default ClientHome;

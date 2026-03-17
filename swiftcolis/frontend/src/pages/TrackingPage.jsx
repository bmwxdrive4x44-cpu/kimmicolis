import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { colisAPI } from '../api';
import { Package, MapPin, CheckCircle, Clock, Truck, User, Phone } from 'lucide-react';

const TrackingPage = () => {
  const { colisId } = useParams();
  const [colis, setColis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trackingHistory, setTrackingHistory] = useState([]);

  useEffect(() => {
    loadColis();
    
    // Écouter les mises à jour en temps réel
    const handleStatusUpdate = (event) => {
      if (event.detail.colisId === colisId) {
        loadColis();
      }
    };

    window.addEventListener('colis-status-update', handleStatusUpdate);
    return () => window.removeEventListener('colis-status-update', handleStatusUpdate);
  }, [colisId]);

  const loadColis = async () => {
    try {
      const response = await colisAPI.getById(colisId);
      setColis(response.data.colis);
      setTrackingHistory(response.data.tracking || []);
    } catch (error) {
      console.error('Erreur chargement colis:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      'creé': { label: 'Créé', icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100' },
      'en_attente_transport': { label: 'En attente de transport', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
      'reçu_relais_depart': { label: 'Reçu au relais départ', icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-100' },
      'en_transport': { label: 'En cours de transport', icon: Truck, color: 'text-primary-600', bg: 'bg-primary-100' },
      'arrivé_relais_destination': { label: 'Arrivé au relais destination', icon: MapPin, color: 'text-green-600', bg: 'bg-green-100' },
      'livré': { label: 'Livré', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
    };
    return statusMap[status] || { label: status, icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100' };
  };

  const steps = [
    { key: 'creé', label: 'Colis créé' },
    { key: 'reçu_relais_depart', label: 'Déposé au relais' },
    { key: 'en_transport', label: 'En transport' },
    { key: 'arrivé_relais_destination', label: 'Arrivé à destination' },
    { key: 'livré', label: 'Livré' },
  ];

  const getCurrentStep = () => {
    const statusOrder = ['creé', 'reçu_relais_depart', 'en_transport', 'arrivé_relais_destination', 'livré'];
    const currentIndex = statusOrder.indexOf(colis?.statut);
    return currentIndex >= 0 ? currentIndex : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!colis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Colis non trouvé</h2>
          <p className="text-gray-600 mt-2">Le numéro de suivi est incorrect</p>
        </div>
      </div>
    );
  }

  const currentStep = getCurrentStep();
  const statusInfo = getStatusInfo(colis.statut);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="card mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Suivi de votre colis</h1>
              <p className="text-gray-600 mt-1">ID: #{colis.id}</p>
            </div>
            <div className={`flex items-center px-4 py-2 rounded-full ${statusInfo.bg}`}>
              <StatusIcon className={`w-5 h-5 mr-2 ${statusInfo.color}`} />
              <span className={`font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
            </div>
          </div>
        </div>

        {/* Progress Timeline */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Progression</h2>
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-4 left-0 right-0 h-1 bg-gray-200 rounded">
              <div 
                className="h-full bg-primary-600 rounded transition-all duration-500"
                style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
              ></div>
            </div>
            
            {/* Steps */}
            <div className="relative flex justify-between">
              {steps.map((step, index) => {
                const isCompleted = index <= currentStep;
                const isCurrent = index === currentStep;
                
                return (
                  <div key={step.key} className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                        isCompleted
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'bg-white border-gray-300 text-gray-400'
                      } ${isCurrent ? 'ring-4 ring-primary-200' : ''}`}
                    >
                      {isCompleted ? <CheckCircle className="w-5 h-5" /> : index + 1}
                    </div>
                    <span className={`text-xs mt-2 text-center max-w-[80px] ${
                      isCompleted ? 'text-gray-900 font-medium' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Colis Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Trajet */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-primary-600" />
              Trajet
            </h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-500">Départ</div>
                <div className="font-medium text-gray-900">{colis.ville_depart}</div>
                <div className="text-sm text-gray-600">{colis.relais_depart?.nom_commerce || 'N/A'}</div>
              </div>
              <div className="flex items-center">
                <ArrowDown className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Destination</div>
                <div className="font-medium text-gray-900">{colis.ville_arrivee}</div>
                <div className="text-sm text-gray-600">{colis.relais_arrivee?.nom_commerce || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Détails Colis */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Package className="w-5 h-5 mr-2 text-primary-600" />
              Détails du colis
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Format:</span>
                <span className="font-medium text-gray-900 capitalize">{colis.format}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Prix:</span>
                <span className="font-medium text-gray-900">{colis.prix_client} DZD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date création:</span>
                <span className="font-medium text-gray-900">
                  {new Date(colis.date_creation).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Expéditeur & Destinataire */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-primary-600" />
              Expéditeur
            </h3>
            <div className="space-y-2">
              <div className="font-medium text-gray-900">{colis.expediteur_nom}</div>
              <div className="flex items-center text-gray-600">
                <Phone className="w-4 h-4 mr-2" />
                {colis.expediteur_telephone}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-primary-600" />
              Destinataire
            </h3>
            <div className="space-y-2">
              <div className="font-medium text-gray-900">{colis.destinataire_nom}</div>
              <div className="flex items-center text-gray-600">
                <Phone className="w-4 h-4 mr-2" />
                {colis.destinataire_telephone}
              </div>
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">QR Code de suivi</h3>
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
              {colis.qr_code && (
                <img src={colis.qr_code} alt="QR Code" className="w-48 h-48" />
              )}
            </div>
          </div>
          <p className="text-center text-sm text-gray-600 mt-4">
            Présentez ce QR code au point relais pour récupérer votre colis
          </p>
        </div>
      </div>
    </div>
  );
};

// Simple ArrowDown component
const ArrowDown = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
  </svg>
);

export default TrackingPage;

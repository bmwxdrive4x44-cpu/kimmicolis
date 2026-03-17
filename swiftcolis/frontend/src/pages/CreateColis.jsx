import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colisAPI, relaisAPI } from '../api';
import { Package, MapPin, ArrowRight, Truck, DollarSign } from 'lucide-react';
import { toast } from 'react-toastify';

const CreateColis = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [relais, setRelais] = useState([]);
  const [formData, setFormData] = useState({
    ville_depart: '',
    ville_arrivee: '',
    format: 'petit',
    relais_depart_id: '',
    relais_arrivee_id: '',
    expediteur_nom: '',
    expediteur_telephone: '',
    destinataire_nom: '',
    destinataire_telephone: '',
    description: '',
  });
  const [prix, setPrix] = useState(null);

  const wilayas = [
    "Alger", "Oran", "Constantine", "Annaba", "Blida", 
    "Béjaïa", "Sétif", "Tlemcen", "Tizi Ouzou", "Batna",
    "Mostaganem", "Tiaret", "Tébessa", "Biskra", "Ouargla"
  ];

  const formats = [
    { value: 'petit', label: 'Petit', desc: '< 5kg, 30x20x15cm', prix: 800 },
    { value: 'moyen', label: 'Moyen', desc: '5-15kg, 50x40x30cm', prix: 1500 },
    { value: 'gros', label: 'Gros', desc: '> 15kg, 80x60x40cm', prix: 2500 },
  ];

  const handleChange = async (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Charger les relais quand une ville est sélectionnée
    if (name === 'ville_depart' || name === 'ville_arrivee') {
      try {
        const response = await relaisAPI.getAll();
        const villeField = name === 'ville_depart' ? 'ville_depart' : 'ville_arrivee';
        const filteredRelais = response.data.relais.filter(
          r => r.ville === formData[villeField === 'ville_depart' ? 'ville_arrivee' : 'ville_depart'] || r.ville === value
        );
        setRelais(filteredRelais);
      } catch (error) {
        console.error('Erreur chargement relais:', error);
      }
    }

    // Calculer le prix
    if (formData.ville_depart && formData.ville_arrivee && formData.format) {
      const formatSelected = formats.find(f => f.value === (name === 'format' ? value : formData.format));
      if (formatSelected) {
        // Prix de base + supplément distance
        const basePrice = formatSelected.prix;
        const distanceMultiplier = formData.ville_depart !== formData.ville_arrivee ? 1.5 : 1;
        setPrix(Math.round(basePrice * distanceMultiplier));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.relais_depart_id || !formData.relais_arrivee_id) {
      toast.error('Veuillez sélectionner les points relais de départ et d\'arrivée');
      return;
    }

    setLoading(true);

    try {
      const colisData = {
        ...formData,
        prix_client: prix,
      };

      const response = await colisAPI.create(colisData);
      toast.success('Colis créé avec succès!');
      
      // Rediriger vers le suivi
      navigate(`/tracking/${response.data.colis.id}`);
    } catch (error) {
      const message = error.response?.data?.message || 'Erreur lors de la création du colis';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="card">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="bg-primary-600 text-white w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Créer un nouveau colis</h2>
            <p className="text-gray-600 mt-2">Remplissez le formulaire pour expédier votre colis</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Trajet */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-primary-600" />
                Trajet
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wilaya de départ *
                  </label>
                  <select
                    name="ville_depart"
                    value={formData.ville_depart}
                    onChange={handleChange}
                    required
                    className="input-field"
                  >
                    <option value="">Sélectionner</option>
                    {wilayas.map((wilaya) => (
                      <option key={wilaya} value={wilaya}>{wilaya}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wilaya d'arrivée *
                  </label>
                  <select
                    name="ville_arrivee"
                    value={formData.ville_arrivee}
                    onChange={handleChange}
                    required
                    className="input-field"
                  >
                    <option value="">Sélectionner</option>
                    {wilayas.map((wilaya) => (
                      <option key={wilaya} value={wilaya}>{wilaya}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Points Relais */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Truck className="w-5 h-5 mr-2 text-primary-600" />
                Points Relais
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Relais de dépôt *
                  </label>
                  <select
                    name="relais_depart_id"
                    value={formData.relais_depart_id}
                    onChange={handleChange}
                    required
                    className="input-field"
                    disabled={!formData.ville_depart}
                  >
                    <option value="">Sélectionner un relais</option>
                    {relais
                      .filter(r => r.ville === formData.ville_depart)
                      .map((relai) => (
                        <option key={relai.id} value={relai.id}>
                          {relai.nom_commerce} - {relai.adresse}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Relais de retrait *
                  </label>
                  <select
                    name="relais_arrivee_id"
                    value={formData.relais_arrivee_id}
                    onChange={handleChange}
                    required
                    className="input-field"
                    disabled={!formData.ville_arrivee}
                  >
                    <option value="">Sélectionner un relais</option>
                    {relais
                      .filter(r => r.ville === formData.ville_arrivee)
                      .map((relai) => (
                        <option key={relai.id} value={relai.id}>
                          {relai.nom_commerce} - {relai.adresse}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Format du colis */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Package className="w-5 h-5 mr-2 text-primary-600" />
                Format du colis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {formats.map((format) => (
                  <button
                    key={format.value}
                    type="button"
                    onClick={() => handleChange({ target: { name: 'format', value: format.value } })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      formData.format === format.value
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`font-semibold ${formData.format === format.value ? 'text-primary-600' : 'text-gray-900'}`}>
                      {format.label}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">{format.desc}</div>
                    <div className="text-primary-600 font-bold mt-2">{format.prix} DZD</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Informations Expéditeur */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Expéditeur</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom complet *
                  </label>
                  <input
                    name="expediteur_nom"
                    value={formData.expediteur_nom}
                    onChange={handleChange}
                    required
                    className="input-field"
                    placeholder="Nom de l'expéditeur"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Téléphone *
                  </label>
                  <input
                    name="expediteur_telephone"
                    value={formData.expediteur_telephone}
                    onChange={handleChange}
                    required
                    className="input-field"
                    placeholder="+213 XX XX XX XX"
                  />
                </div>
              </div>
            </div>

            {/* Informations Destinataire */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Destinataire</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom complet *
                  </label>
                  <input
                    name="destinataire_nom"
                    value={formData.destinataire_nom}
                    onChange={handleChange}
                    required
                    className="input-field"
                    placeholder="Nom du destinataire"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Téléphone *
                  </label>
                  <input
                    name="destinataire_telephone"
                    value={formData.destinataire_telephone}
                    onChange={handleChange}
                    required
                    className="input-field"
                    placeholder="+213 XX XX XX XX"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description du contenu (optionnel)
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="input-field"
                placeholder="Décrivez le contenu du colis..."
              />
            </div>

            {/* Résumé et Prix */}
            {prix && (
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                    Prix total
                  </h3>
                  <div className="text-3xl font-bold text-primary-600">{prix} DZD</div>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>• Tarif basé sur le format et la distance</div>
                  <div>• Assurance incluse</div>
                  <div>• Suivi en temps réel</div>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !prix}
              className="w-full btn-primary py-4 text-lg flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              ) : (
                <>
                  <span>Payer et créer le colis</span>
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateColis;

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Package, Mail, Lock, Eye, EyeOff, User, Phone, MapPin } from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('client');
  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    password: '',
    confirmPassword: '',
    telephone: '',
    role: 'client',
    // Champs spécifiques transporteur
    siret: '',
    type_transporteur: 'particulier',
    // Champs spécifiques relais
    nom_commerce: '',
    adresse: '',
    ville: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);

    const userData = {
      nom: formData.nom,
      email: formData.email,
      password: formData.password,
      telephone: formData.telephone,
      role: role,
      ...(role === 'transporteur' && {
        siret: formData.siret,
        type_transporteur: formData.type_transporteur,
      }),
      ...(role === 'relais' && {
        nom_commerce: formData.nom_commerce,
        adresse: formData.adresse,
        ville: formData.ville,
      }),
    };

    const result = await register(userData);
    
    if (result.success) {
      const userRole = result.user.role;
      if (userRole === 'client') navigate('/dashboard/client');
      else if (userRole === 'transporteur') navigate('/dashboard/transporteur');
      else if (userRole === 'relais') navigate('/dashboard/relais');
      else if (userRole === 'admin') navigate('/dashboard/admin');
    }
    
    setLoading(false);
  };

  const roles = [
    { value: 'client', label: 'Client', desc: 'Envoyer des colis' },
    { value: 'transporteur', label: 'Transporteur', desc: 'Transporter des colis' },
    { value: 'relais', label: 'Point Relais', desc: 'Recevoir et remettre des colis' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="card">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="bg-primary-600 text-white w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Créer un compte SwiftColis</h2>
            <p className="text-gray-600 mt-2">Rejoignez notre plateforme logistique</p>
          </div>

          {/* Role Selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Je m'inscris en tant que :
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {roles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    role === r.value
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`font-semibold ${role === r.value ? 'text-primary-600' : 'text-gray-900'}`}>
                    {r.label}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nom complet */}
            <div>
              <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-2">
                Nom complet *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="nom"
                  name="nom"
                  type="text"
                  required
                  value={formData.nom}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="Votre nom complet"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Adresse email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="votre@email.com"
                />
              </div>
            </div>

            {/* Téléphone */}
            <div>
              <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-2">
                Numéro de téléphone *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="telephone"
                  name="telephone"
                  type="tel"
                  required
                  value={formData.telephone}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="+213 XX XX XX XX"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="input-field pl-10 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirmation mot de passe */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirmer le mot de passe *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Champs spécifiques Transporteur */}
            {role === 'transporteur' && (
              <>
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations transporteur</h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type de transporteur
                    </label>
                    <select
                      name="type_transporteur"
                      value={formData.type_transporteur}
                      onChange={handleChange}
                      className="input-field"
                    >
                      <option value="particulier">Particulier</option>
                      <option value="professionnel">Professionnel</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="siret" className="block text-sm font-medium text-gray-700 mb-2">
                      N° Registre Commerce / SIRET
                    </label>
                    <input
                      id="siret"
                      name="siret"
                      type="text"
                      required
                      value={formData.siret}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="Numéro d'immatriculation"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Champs spécifiques Relais */}
            {role === 'relais' && (
              <>
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations point relais</h3>
                  
                  <div className="mb-4">
                    <label htmlFor="nom_commerce" className="block text-sm font-medium text-gray-700 mb-2">
                      Nom du commerce *
                    </label>
                    <input
                      id="nom_commerce"
                      name="nom_commerce"
                      type="text"
                      required
                      value={formData.nom_commerce}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="Nom de votre commerce"
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="adresse" className="block text-sm font-medium text-gray-700 mb-2">
                      Adresse complète *
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                      <textarea
                        id="adresse"
                        name="adresse"
                        required
                        rows={3}
                        value={formData.adresse}
                        onChange={handleChange}
                        className="input-field pl-10"
                        placeholder="Adresse complète du commerce"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="ville" className="block text-sm font-medium text-gray-700 mb-2">
                      Wilaya *
                    </label>
                    <select
                      id="ville"
                      name="ville"
                      required
                      value={formData.ville}
                      onChange={handleChange}
                      className="input-field"
                    >
                      <option value="">Sélectionner une wilaya</option>
                      {[
                        "Alger", "Oran", "Constantine", "Annaba", "Blida", 
                        "Béjaïa", "Sétif", "Tlemcen", "Tizi Ouzou", "Batna",
                        "Mostaganem", "Tiaret", "Tébessa", "Biskra", "Ouargla"
                      ].map((wilaya) => (
                        <option key={wilaya} value={wilaya}>{wilaya}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      ℹ️ Votre inscription sera validée par notre équipe après vérification des informations.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                `S'inscrire comme ${role === 'client' ? 'Client' : role === 'transporteur' ? 'Transporteur' : 'Relais'}`
              )}
            </button>
          </form>

          {/* Login Link */}
          <p className="mt-8 text-center text-sm text-gray-600">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-500 font-medium">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;

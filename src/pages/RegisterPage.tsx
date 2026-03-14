import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Package, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  Loader2, 
  User, 
  Truck, 
  Store,
  CheckCircle
} from 'lucide-react';
import { UserRole } from '@/types';
import { toast } from 'sonner';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    password: '',
    confirmPassword: '',
    // Transporteur
    siret: '',
    entreprise: '',
    // Relais
    commerceNom: '',
    adresse: '',
    wilaya: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const selectRole = (role: UserRole) => {
    setSelectedRole(role);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (!selectedRole) {
      setError('Veuillez sélectionner un type de compte');
      return;
    }

    setIsLoading(true);

    try {
      const success = await register({
        nom: formData.nom,
        prenom: formData.prenom,
        email: formData.email,
        telephone: formData.telephone,
        password: formData.password,
        role: selectedRole,
        siret: selectedRole === UserRole.TRANSPORTEUR ? formData.siret : undefined,
        entreprise: selectedRole === UserRole.TRANSPORTEUR ? formData.entreprise : undefined,
        commerceNom: selectedRole === UserRole.RELAIS ? formData.commerceNom : undefined,
        adresse: selectedRole === UserRole.RELAIS ? formData.adresse : undefined,
        wilaya: selectedRole === UserRole.RELAIS ? formData.wilaya : undefined
      });

      if (success) {
        toast.success('Compte créé avec succès !');
        navigate('/dashboard');
      } else {
        setError('Cet email est déjà utilisé');
      }
    } catch (err) {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const roles = [
    {
      role: UserRole.CLIENT,
      icon: User,
      title: 'Client',
      description: 'J\'envoie des colis',
      color: 'bg-blue-100 text-blue-600'
    },
    {
      role: UserRole.TRANSPORTEUR,
      icon: Truck,
      title: 'Transporteur',
      description: 'Je transporte des colis',
      color: 'bg-green-100 text-green-600'
    },
    {
      role: UserRole.RELAIS,
      icon: Store,
      title: 'Point Relais',
      description: 'J\'ai un commerce',
      color: 'bg-purple-100 text-purple-600'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">ColisWay</span>
            </Link>
            <Button variant="ghost" asChild>
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center">
                {step === 1 ? 'Créer un compte' : 'Inscription'}
              </CardTitle>
              <CardDescription className="text-center">
                {step === 1 
                  ? 'Choisissez votre type de compte' 
                  : `Compte ${selectedRole === UserRole.CLIENT ? 'Client' : selectedRole === UserRole.TRANSPORTEUR ? 'Transporteur' : 'Point Relais'}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {step === 1 ? (
                <div className="space-y-4">
                  {roles.map((role) => (
                    <button
                      key={role.role}
                      onClick={() => selectRole(role.role)}
                      className="w-full flex items-center gap-4 p-4 border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${role.color}`}>
                        <role.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{role.title}</div>
                        <div className="text-sm text-slate-500">{role.description}</div>
                      </div>
                      <CheckCircle className="w-5 h-5 text-slate-300 ml-auto" />
                    </button>
                  ))}

                  <div className="mt-6 text-center text-sm">
                    <span className="text-slate-600">Déjà un compte ? </span>
                    <Link to="/login" className="text-blue-600 hover:underline font-medium">
                      Se connecter
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nom">Nom</Label>
                      <Input
                        id="nom"
                        name="nom"
                        placeholder="Votre nom"
                        value={formData.nom}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prenom">Prénom</Label>
                      <Input
                        id="prenom"
                        name="prenom"
                        placeholder="Votre prénom"
                        value={formData.prenom}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="votre@email.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telephone">Téléphone</Label>
                    <Input
                      id="telephone"
                      name="telephone"
                      type="tel"
                      placeholder="05XX XX XX XX"
                      value={formData.telephone}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  {/* Champs spécifiques Transporteur */}
                  {selectedRole === UserRole.TRANSPORTEUR && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="siret">Numéro SIRET</Label>
                        <Input
                          id="siret"
                          name="siret"
                          placeholder="123 456 789 00012"
                          value={formData.siret}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="entreprise">Nom de l'entreprise</Label>
                        <Input
                          id="entreprise"
                          name="entreprise"
                          placeholder="Votre entreprise"
                          value={formData.entreprise}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </>
                  )}

                  {/* Champs spécifiques Point Relais */}
                  {selectedRole === UserRole.RELAIS && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="commerceNom">Nom du commerce</Label>
                        <Input
                          id="commerceNom"
                          name="commerceNom"
                          placeholder="Votre commerce"
                          value={formData.commerceNom}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="adresse">Adresse</Label>
                        <Input
                          id="adresse"
                          name="adresse"
                          placeholder="Votre adresse"
                          value={formData.adresse}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="wilaya">Wilaya</Label>
                        <select
                          id="wilaya"
                          name="wilaya"
                          value={formData.wilaya}
                          onChange={handleChange}
                          required
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Sélectionnez une wilaya</option>
                          {['Alger', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Sétif', 'Tlemcen', 'Béjaïa'].map(w => (
                            <option key={w} value={w}>{w}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <input type="checkbox" required className="rounded border-slate-300" />
                    <span className="text-slate-600">
                      J'accepte les <a href="#" className="text-blue-600 hover:underline">CGU</a> et la <a href="#" className="text-blue-600 hover:underline">politique de confidentialité</a>
                    </span>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Création...
                      </>
                    ) : (
                      'Créer mon compte'
                    )}
                  </Button>

                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-full"
                    onClick={() => setStep(1)}
                  >
                    Retour
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Package, 
  Truck, 
  MapPin, 
  CreditCard, 
  Bell, 
  Shield, 
  CheckCircle,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: Package,
      title: 'Formats adaptés',
      description: 'Petit, Moyen ou Gros colis, trouvez le format qui correspond à vos besoins.'
    },
    {
      icon: Truck,
      title: 'Transporteurs pros',
      description: 'Un réseau de transporteurs professionnels vérifiés et notés.'
    },
    {
      icon: MapPin,
      title: 'Points relais',
      description: 'Retirez vos colis dans l\'un de nos nombreux points relais partout en Algérie.'
    },
    {
      icon: CreditCard,
      title: 'Paiement sécurisé',
      description: 'Payez en ligne en toute sécurité, le transporteur est payé après livraison.'
    },
    {
      icon: Bell,
      title: 'Suivi en temps réel',
      description: 'Recevez des notifications à chaque étape de l\'acheminement de votre colis.'
    },
    {
      icon: Shield,
      title: 'Commission transparente',
      description: 'Une commission fixe de 10%, pas de frais cachés.'
    }
  ];

  const steps = [
    {
      number: '1',
      title: 'Créez votre réservation',
      description: 'Sélectionnez votre trajet et le format de votre colis.'
    },
    {
      number: '2',
      title: 'Payez en ligne',
      description: 'Paiement sécurisé par carte ou autre moyen de paiement.'
    },
    {
      number: '3',
      title: 'Suivez votre colis',
      description: 'Recevez des notifications à chaque étape de la livraison.'
    },
    {
      number: '4',
      title: 'Retirez au relais',
      description: 'Récupérez votre colis dans le point relais de votre choix.'
    }
  ];

  const pricingExamples = [
    { format: 'Petit', weight: 'Jusqu\'à 5kg', price: 'À partir de 300 DA', example: 'Alger → Blida' },
    { format: 'Moyen', weight: '5kg - 15kg', price: 'À partir de 500 DA', example: 'Alger → Oran' },
    { format: 'Gros', weight: '15kg - 30kg', price: 'À partir de 900 DA', example: 'Alger → Constantine' }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">ColisWay</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#fonctionnalites" className="text-slate-600 hover:text-blue-600 transition-colors">Fonctionnalités</a>
              <a href="#comment-ca-marche" className="text-slate-600 hover:text-blue-600 transition-colors">Comment ça marche</a>
              <a href="#tarifs" className="text-slate-600 hover:text-blue-600 transition-colors">Tarifs</a>
              <a href="#devenir-transporteur" className="text-slate-600 hover:text-blue-600 transition-colors">Devenir transporteur</a>
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-4">
              <Button variant="ghost" asChild>
                <Link to="/login">Connexion</Link>
              </Button>
              <Button asChild>
                <Link to="/register">S'inscrire</Link>
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-200">
            <div className="px-4 py-4 space-y-3">
              <a href="#fonctionnalites" className="block py-2 text-slate-600">Fonctionnalités</a>
              <a href="#comment-ca-marche" className="block py-2 text-slate-600">Comment ça marche</a>
              <a href="#tarifs" className="block py-2 text-slate-600">Tarifs</a>
              <a href="#devenir-transporteur" className="block py-2 text-slate-600">Devenir transporteur</a>
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/login">Connexion</Link>
                </Button>
                <Button className="w-full" asChild>
                  <Link to="/register">S'inscrire</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-4xl lg:text-6xl font-bold leading-tight">
                Transport de colis <br />
                <span className="text-blue-200">inter-wilayas</span> simplifié
              </h1>
              <p className="text-xl text-blue-100 max-w-lg">
                Envoyez vos colis partout en Algérie avec notre réseau de transporteurs professionnels et points relais.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  variant="secondary"
                  className="bg-white text-blue-600 hover:bg-blue-50"
                  asChild
                >
                  <Link to="/register">
                    Expédier un colis
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                  asChild
                >
                  <Link to="/register">Devenir transporteur</Link>
                </Button>
              </div>
              <div className="flex items-center gap-8 text-sm text-blue-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>58 wilayas couvertes</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>+500 points relais</span>
                </div>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="relative">
                <div className="absolute -inset-4 bg-white/10 rounded-3xl blur-2xl"></div>
                <img 
                  src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80" 
                  alt="Transport de colis"
                  className="relative rounded-2xl shadow-2xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '50K+', label: 'Colis livrés' },
              { value: '500+', label: 'Points relais' },
              { value: '200+', label: 'Transporteurs' },
              { value: '58', label: 'Wilayas' }
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-blue-600">{stat.value}</div>
                <div className="text-slate-600 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="fonctionnalites" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              Pourquoi choisir ColisWay ?
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Une plateforme complète qui simplifie l'envoi de colis entre les wilayas d'Algérie.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                    <feature.icon className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-slate-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="comment-ca-marche" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              Comment ça marche ?
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Quatre étapes simples pour expédier votre colis en toute tranquillité.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="text-6xl font-bold text-blue-100 mb-4">{step.number}</div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-600">{step.description}</p>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-blue-100 -ml-4">
                    <ChevronRight className="absolute right-0 -top-3 w-6 h-6 text-blue-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="tarifs" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              Nos tarifs
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Des prix transparents et compétitifs pour tous les formats de colis.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {pricingExamples.map((pricing, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="p-8">
                  <div className="text-2xl font-bold text-blue-600 mb-2">{pricing.format}</div>
                  <div className="text-slate-500 mb-4">{pricing.weight}</div>
                  <div className="text-4xl font-bold text-slate-900 mb-2">{pricing.price}</div>
                  <div className="text-sm text-slate-500 mb-6">{pricing.example}</div>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/register">Choisir ce format</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-12 text-center">
            <p className="text-slate-600 mb-4">
              Commission plateforme : <span className="font-semibold text-blue-600">10%</span> uniquement
            </p>
            <p className="text-sm text-slate-500">
              Les tarifs varient selon la distance entre les wilayas
            </p>
          </div>
        </div>
      </section>

      {/* Become Transporter Section */}
      <section id="devenir-transporteur" className="py-20 bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                Devenez transporteur ColisWay
              </h2>
              <p className="text-xl text-blue-100 mb-8">
                Rejoignez notre réseau de transporteurs professionnels et augmentez vos revenus.
              </p>
              <div className="space-y-4">
                {[
                  'Inscription gratuite avec votre SIRET',
                  'Choisissez vos trajets et vos horaires',
                  'Gagnez jusqu\'à 2950 DA par colis gros format',
                  'Paiement sécurisé après livraison'
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-blue-300 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <Button 
                size="lg" 
                variant="secondary"
                className="mt-8 bg-white text-blue-600 hover:bg-blue-50"
                asChild
              >
                <Link to="/register">
                  S'inscrire comme transporteur
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
            </div>
            <div className="hidden lg:block">
              <img 
                src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800&q=80" 
                alt="Transporteur professionnel"
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Become Relay Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="hidden lg:block">
              <img 
                src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80" 
                alt="Point relais"
                className="rounded-2xl shadow-2xl"
              />
            </div>
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-6">
                Devenez point relais
              </h2>
              <p className="text-xl text-slate-600 mb-8">
                Vous avez un commerce ? Devenez point relais ColisWay et générez des revenus supplémentaires.
              </p>
              <div className="space-y-4">
                {[
                  'Rémunération fixe par colis traité',
                  '80 DA (petit) / 120 DA (moyen) / 200 DA (gros)',
                  'Attirez de nouveaux clients dans votre commerce',
                  'Gestion simple via notre application'
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                    <span className="text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
              <Button 
                size="lg"
                className="mt-8"
                asChild
              >
                <Link to="/register">
                  Devenir point relais
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">
            Prêt à expédier votre premier colis ?
          </h2>
          <p className="text-xl text-slate-400 mb-8">
            Inscrivez-vous gratuitement et rejoignez des milliers d'utilisateurs satisfaits.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
              asChild
            >
              <Link to="/register">Créer un compte gratuit</Link>
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
              asChild
            >
              <Link to="/login">J'ai déjà un compte</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">ColisWay</span>
              </div>
              <p className="text-sm">
                La plateforme de transport de colis inter-wilayas la plus fiable d'Algérie.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Services</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/register" className="hover:text-white transition-colors">Expédier un colis</Link></li>
                <li><Link to="/register" className="hover:text-white transition-colors">Devenir transporteur</Link></li>
                <li><Link to="/register" className="hover:text-white transition-colors">Devenir point relais</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Suivi de colis</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Entreprise</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">À propos</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Carrières</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Presse</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Légal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">CGU</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Confidentialité</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookies</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-sm">
            <p>&copy; 2026 ColisWay. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

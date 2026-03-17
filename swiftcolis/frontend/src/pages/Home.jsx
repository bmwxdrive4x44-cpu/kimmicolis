import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, Truck, Store, Shield, MapPin, Clock, CheckCircle } from 'lucide-react';

const Home = () => {
  const features = [
    {
      icon: <Package className="w-8 h-8" />,
      title: "Créer un colis",
      description: "Expédiez vos colis en quelques clics entre toutes les wilayas d'Algérie",
    },
    {
      icon: <Truck className="w-8 h-8" />,
      title: "Transporteurs fiables",
      description: "Des transporteurs professionnels et particuliers vérifiés",
    },
    {
      icon: <Store className="w-8 h-8" />,
      title: "Points relais",
      description: "Déposez et récupérez vos colis dans nos points relais partenaires",
    },
    {
      icon: <MapPin className="w-8 h-8" />,
      title: "Suivi en temps réel",
      description: "Suivez votre colis en temps réel sur la carte",
    },
    {
      icon: <Clock className="w-8 h-8" />,
      title: "Livraison rapide",
      description: "Livraison express inter-wilayas garantie",
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Sécurisé",
      description: "Vos colis sont assurés et tracés de bout en bout",
    },
  ];

  const wilayas = [
    "Alger", "Oran", "Constantine", "Annaba", "Blida", 
    "Béjaïa", "Sétif", "Tlemcen", "Tizi Ouzou", "Batna"
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <div className="bg-primary-600 text-white p-2 rounded-lg">
                <Package className="w-6 h-6" />
              </div>
              <span className="text-2xl font-bold text-gray-900">SwiftColis</span>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="text-gray-600 hover:text-primary-600 transition-colors">Fonctionnalités</a>
              <a href="#wilayas" className="text-gray-600 hover:text-primary-600 transition-colors">Wilayas</a>
              <a href="#devenir-relais" className="text-gray-600 hover:text-primary-600 transition-colors">Devenir relais</a>
            </nav>
            <div className="flex space-x-4">
              <Link to="/login" className="btn-secondary">
                Connexion
              </Link>
              <Link to="/register" className="btn-primary">
                Inscription
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Transport de colis<br/>inter-wilayas en Algérie
            </h1>
            <p className="text-xl md:text-2xl text-primary-100 mb-8 max-w-3xl mx-auto">
              La solution rapide, sécurisée et économique pour envoyer vos colis partout en Algérie. 
              Déposez en point relais, recevez à destination.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/create-colis" className="bg-white text-primary-600 hover:bg-primary-50 font-bold py-4 px-8 rounded-lg text-lg transition-colors inline-flex items-center justify-center">
                <Package className="w-5 h-5 mr-2" />
                Créer un colis
              </Link>
              <Link to="/tracking" className="bg-primary-500 hover:bg-primary-400 font-bold py-4 px-8 rounded-lg text-lg transition-colors inline-flex items-center justify-center">
                <MapPin className="w-5 h-5 mr-2" />
                Suivre un colis
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Comment fonctionne SwiftColis ?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Une plateforme simple et efficace pour tous vos besoins d'expédition
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="card hover:shadow-lg transition-shadow"
              >
                <div className="bg-primary-100 text-primary-600 w-16 h-16 rounded-xl flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Votre colis en 5 étapes simples
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { step: 1, title: "Créez", desc: "Remplissez le formulaire" },
              { step: 2, title: "Déposez", desc: "Au point relais départ" },
              { step: 3, title: "Transport", desc: "Par nos transporteurs" },
              { step: 4, title: "Arrivée", desc: "Au relais destination" },
              { step: 5, title: "Récupérez", desc: "Votre colis livré!" },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.15, duration: 0.5 }}
                className="text-center"
              >
                <div className="bg-primary-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Wilayas Section */}
      <section id="wilayas" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Desserte nationale
            </h2>
            <p className="text-xl text-gray-600">
              Connectés dans toutes les grandes wilayas d'Algérie
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {wilayas.map((wilaya, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="bg-white px-6 py-3 rounded-full shadow-md text-gray-700 font-medium hover:bg-primary-50 hover:text-primary-600 transition-colors cursor-default"
              >
                {wilaya}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Prêt à expédier votre premier colis ?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Rejoignez des milliers de clients satisfaits et profitez de notre service rapide et sécurisé
          </p>
          <Link to="/register" className="bg-white text-primary-600 hover:bg-primary-50 font-bold py-4 px-12 rounded-lg text-lg transition-colors inline-block">
            Commencer maintenant
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="bg-primary-600 text-white p-2 rounded-lg">
                  <Package className="w-5 h-5" />
                </div>
                <span className="text-xl font-bold text-white">SwiftColis</span>
              </div>
              <p className="text-gray-400 text-sm">
                Plateforme logistique de transport de colis inter-wilayas en Algérie.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Services</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/create-colis" className="hover:text-white transition-colors">Créer un colis</Link></li>
                <li><Link to="/tracking" className="hover:text-white transition-colors">Suivre un colis</Link></li>
                <li><a href="#devenir-relais" className="hover:text-white transition-colors">Devenir relais</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Devenir transporteur</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Entreprise</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">À propos</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">CGU</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Confidentialité</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>contact@swiftcolis.dz</li>
                <li>+213 XX XX XX XX</li>
                <li>Alger, Algérie</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 SwiftColis. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;

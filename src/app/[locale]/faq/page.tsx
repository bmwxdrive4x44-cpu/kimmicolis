import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CircleHelp, CreditCard, MapPin, Package, ShieldCheck, Store, Truck } from 'lucide-react';

const faqItems = [
  {
    value: 'create',
    icon: Package,
    question: 'Comment créer un colis sur SwiftColis ?',
    answer:
      'Vous choisissez la ville de départ, la ville d’arrivée, le relais de dépôt, le relais de destination, puis vous renseignez les coordonnées expéditeur et destinataire. Une fois le colis créé, il apparaît dans votre panier de paiement.',
  },
  {
    value: 'payment',
    icon: CreditCard,
    question: 'Quand dois-je payer mon colis ?',
    answer:
      'Le paiement peut être effectué en ligne depuis le panier ou au relais de départ selon le scénario prévu. Un colis simplement créé n’est pas encore considéré comme pris en charge dans le workflow logistique.',
  },
  {
    value: 'deposit',
    icon: Store,
    question: 'Où dois-je déposer mon colis ?',
    answer:
      'Le dépôt doit être fait dans le relais de départ choisi lors de la création. Le workflow impose ce point de dépôt pour garder une traçabilité correcte et préparer la mission de transport.',
  },
  {
    value: 'tracking',
    icon: MapPin,
    question: 'Comment fonctionne le suivi ?',
    answer:
      'Chaque scan terrain ou changement d’état met à jour l’historique du colis. Vous pouvez voir les étapes: créé, déposé, en route, arrivé au relais de destination, puis livré au destinataire.',
  },
  {
    value: 'delivery',
    icon: Truck,
    question: 'Quand un colis est-il marqué comme livré ?',
    answer:
      'Le statut livré est appliqué au relais d’arrivée, au moment où le destinataire récupère réellement le colis après vérification de son identité et du code de retrait.',
  },
  {
    value: 'security',
    icon: ShieldCheck,
    question: 'Comment le retrait est-il sécurisé ?',
    answer:
      'Le relais de destination vérifie le nom, le téléphone et le code de retrait avant de remettre le colis. Cela évite les retraits non autorisés et sécurise la remise finale.',
  },
  {
    value: 'loyalty',
    icon: CircleHelp,
    question: 'Comment fonctionne la fidélité implicite ?',
    answer:
      'La fidélité se base sur les colis valides dans une fenêtre glissante de 7 jours. Selon la règle active, des colis payés, en transport ou livrés peuvent être comptabilisés. Le dashboard client affiche votre progression de fidélité.',
  },
] as const;

export default function FAQPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="rounded-[2rem] border border-sky-100 bg-gradient-to-br from-white via-sky-50 to-cyan-50 p-6 shadow-[0_24px_80px_-45px_rgba(15,23,42,0.35)]">
            <Badge variant="outline" className="mb-4 border-sky-200 bg-white/80 text-sky-700">
              FAQ SwiftColis
            </Badge>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Comprendre le fonctionnement du site</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              Cette FAQ suit le vrai workflow SwiftColis: création du colis, paiement, dépôt au relais, transport, arrivée au relais final et remise au destinataire.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border-emerald-100 bg-white">
              <CardHeader>
                <CardTitle className="text-lg">Côté client</CardTitle>
                <CardDescription>Créer, payer, déposer et suivre.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm leading-7 text-slate-600">
                Le client prépare l’envoi, choisit les relais et suit toutes les étapes depuis son dashboard.
              </CardContent>
            </Card>
            <Card className="border-cyan-100 bg-white">
              <CardHeader>
                <CardTitle className="text-lg">Côté relais</CardTitle>
                <CardDescription>Réception, scan, remise et retrait.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm leading-7 text-slate-600">
                Les relais valident les étapes terrain et sécurisent la remise au transporteur puis au destinataire.
              </CardContent>
            </Card>
            <Card className="border-amber-100 bg-white">
              <CardHeader>
                <CardTitle className="text-lg">Côté transporteur</CardTitle>
                <CardDescription>Missions et transit entre relais.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm leading-7 text-slate-600">
                Le transporteur prend en charge une mission compatible avec son trajet et fait avancer le colis pendant le transport.
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle>Questions fréquentes</CardTitle>
              <CardDescription>Les réponses les plus utiles au bon moment dans le parcours utilisateur.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-3">
                {faqItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <AccordionItem key={item.value} value={item.value} className="overflow-hidden rounded-2xl border border-slate-200 px-4">
                      <AccordionTrigger className="gap-4 py-5 text-left hover:no-underline">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="font-semibold text-slate-900">{item.question}</span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-5 pl-14 pr-2 text-sm leading-7 text-slate-600">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
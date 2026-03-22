'use client';

import { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { WILAYAS } from '@/lib/constants';
import { Store, MapPin, Camera, CheckCircle, Loader2, User, Mail, Lock, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function BecomeRelayPage() {
  const { data: session } = useSession();
  const locale = useLocale();
  const t = useTranslations('relais.register');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [accountData, setAccountData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [formData, setFormData] = useState({
    commerceName: '',
    address: '',
    ville: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let userId = session?.user?.id;

      // If not logged in, create account first
      if (!userId) {
        if (accountData.password !== accountData.confirmPassword) {
          toast({ title: 'Erreur', description: 'Les mots de passe ne correspondent pas', variant: 'destructive' });
          return;
        }
        if (accountData.password.length < 6) {
          toast({ title: 'Erreur', description: 'Le mot de passe doit contenir au moins 6 caractères', variant: 'destructive' });
          return;
        }

        // Create account with RELAIS role
        const registerRes = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: accountData.name,
            email: accountData.email,
            phone: accountData.phone || formData.phone,
            password: accountData.password,
            role: 'RELAIS',
          }),
        });

        const registerData = await registerRes.json();
        if (!registerRes.ok) {
          toast({ title: 'Erreur', description: registerData.details || registerData.error || 'Erreur lors de la création du compte', variant: 'destructive' });
          return;
        }
        userId = registerData.id;
      }

      // Submit relais application
      const relaisRes = await fetch('/api/relais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          commerceName: formData.commerceName,
          address: formData.address,
          ville: formData.ville,
        }),
      });

      if (!relaisRes.ok) {
        const data = await relaisRes.json();
        throw new Error(data.error || 'Erreur lors de la soumission');
      }

      // Auto-connect the new account if it was just created
      if (!session?.user?.id) {
        await signIn('credentials', {
          email: accountData.email,
          password: accountData.password,
          redirect: false,
        });
      }

      setSuccess(true);
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Impossible de soumettre la demande',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-16">
          <Card className="max-w-lg mx-auto text-center">
            <CardContent className="pt-8">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-10 w-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">{t('success')}</h2>
              <p className="text-muted-foreground mb-6">
                {t('pending')}. Notre équipe examinera votre demande et vous contactera sous 48h.
              </p>
              <Link href="/">
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  Retour à l'accueil
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <Store className="h-16 w-16 text-emerald-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('subtitle')}. Générez des revenus complémentaires en devenant point de dépôt et de retrait.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto mb-12">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold mb-2">Visibilité</h3>
              <p className="text-sm text-muted-foreground">Votre commerce apparaît sur notre carte interactive</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <Store className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">Revenus</h3>
              <p className="text-sm text-muted-foreground">Gagnez des commissions sur chaque colis traité</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2">Simplicité</h3>
              <p className="text-sm text-muted-foreground">Scannez simplement les QR codes pour gérer les colis</p>
            </CardContent>
          </Card>
        </div>

        {/* Form */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Formulaire d'inscription</CardTitle>
            <CardDescription>
              {session?.user
                ? `Connecté en tant que ${session.user.name} — remplissez les infos de votre point relais`
                : 'Créez votre compte et soumettez votre demande en une seule étape'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Account section — only for non-logged-in users */}
              {!session?.user && (
                <>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <User className="h-4 w-4" /> Créer votre compte
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Déjà inscrit ?{' '}
                      <Link href={`/${locale}/auth/login`} className="text-emerald-600 underline hover:no-underline">
                        Connectez-vous
                      </Link>
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom complet</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="name"
                          placeholder="Votre nom complet"
                          value={accountData.name}
                          onChange={(e) => setAccountData({ ...accountData, name: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account-phone">Téléphone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="account-phone"
                          type="tel"
                          placeholder="+213 XX XX XX XX"
                          value={accountData.phone}
                          onChange={(e) => setAccountData({ ...accountData, phone: e.target.value })}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="email@exemple.com"
                        value={accountData.email}
                        onChange={(e) => setAccountData({ ...accountData, email: e.target.value })}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="password">Mot de passe</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={accountData.password}
                          onChange={(e) => setAccountData({ ...accountData, password: e.target.value })}
                          className="pl-10"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirmer</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type="password"
                          placeholder="••••••••"
                          value={accountData.confirmPassword}
                          onChange={(e) => setAccountData({ ...accountData, confirmPassword: e.target.value })}
                          className="pl-10"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Store className="h-4 w-4" /> Informations du point relais
                  </p>
                </>
              )}

              {/* Relay info */}
              <div className="space-y-2">
                <Label htmlFor="commerceName">{t('commerceName')}</Label>
                <div className="relative">
                  <Store className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="commerceName"
                    placeholder="Ex: Épicerie du Centre"
                    value={formData.commerceName}
                    onChange={(e) => setFormData({ ...formData, commerceName: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{t('address')}</Label>
                <Textarea
                  id="address"
                  placeholder="Ex: 123 Rue Didouche Mourad, Alger Centre"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>{t('city')}</Label>
                <Select
                  value={formData.ville}
                  onValueChange={(value) => setFormData({ ...formData, ville: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez votre ville" />
                  </SelectTrigger>
                  <SelectContent>
                    {WILAYAS.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {session?.user && (
                <div className="space-y-2">
                  <Label htmlFor="relay-phone">Téléphone professionnel</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="relay-phone"
                      type="tel"
                      placeholder="+213 XX XX XX XX"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t('photos')}</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Glissez vos photos ici ou cliquez pour télécharger</p>
                  <p className="text-xs text-muted-foreground mt-1">(Optionnel - Max 5 photos)</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Conditions</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Être un commerce de proximité (épicerie, pharmacie, bureau de tabac, etc.)</li>
                  <li>• Avoir des horaires d'ouverture réguliers</li>
                  <li>• Disposer d'un espace de stockage sécurisé</li>
                  <li>• Accepter les conditions d'utilisation de SwiftColis</li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={isLoading || !formData.ville}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Soumission en cours...
                  </>
                ) : (
                  t('submit')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}


export default function BecomeRelayPage() {
  const { data: session } = useSession();
  const t = useTranslations('relais.register');
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    commerceName: '',
    address: '',
    ville: '',
    phone: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // If not logged in, create user first
      let userId = session?.user?.id;
      
      if (!userId) {
        // This would typically redirect to registration
        toast({
          title: 'Connexion requise',
          description: 'Veuillez vous connecter ou créer un compte pour devenir relais',
        });
        router.push('/auth/register');
        return;
      }

      // Create relais registration
      const response = await fetch('/api/relais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          commerceName: formData.commerceName,
          address: formData.address,
          ville: formData.ville,
        }),
      });

      if (response.ok) {
        setSuccess(true);
        toast({
          title: t('success'),
          description: 'Votre demande sera examinée par notre équipe',
        });
      } else {
        throw new Error('Failed to submit');
      }
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de soumettre la demande',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-16">
          <Card className="max-w-lg mx-auto text-center">
            <CardContent className="pt-8">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-10 w-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">{t('success')}</h2>
              <p className="text-muted-foreground mb-6">
                {t('pending')}. Notre équipe examinera votre demande et vous contactera sous 48h.
              </p>
              <Link href="/">
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  Retour à l'accueil
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <Store className="h-16 w-16 text-emerald-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('subtitle')}. Générez des revenus complémentaires en devenant point de dépôt et de retrait.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto mb-12">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold mb-2">Visibilité</h3>
              <p className="text-sm text-muted-foreground">
                Votre commerce apparaît sur notre carte interactive
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <Store className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">Revenus</h3>
              <p className="text-sm text-muted-foreground">
                Gagnez des commissions sur chaque colis traité
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2">Simplicité</h3>
              <p className="text-sm text-muted-foreground">
                Scannez simplement les QR codes pour gérer les colis
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Form */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Formulaire d'inscription</CardTitle>
            <CardDescription>
              Remplissez ce formulaire pour soumettre votre demande
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="commerceName">{t('commerceName')}</Label>
                <div className="relative">
                  <Store className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="commerceName"
                    placeholder="Ex: Épicerie du Centre"
                    value={formData.commerceName}
                    onChange={(e) => setFormData({ ...formData, commerceName: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{t('address')}</Label>
                <Textarea
                  id="address"
                  placeholder="Ex: 123 Rue Didouche Mourad, Alger Centre"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>{t('city')}</Label>
                <Select
                  value={formData.ville}
                  onValueChange={(value) => setFormData({ ...formData, ville: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez votre ville" />
                  </SelectTrigger>
                  <SelectContent>
                    {WILAYAS.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone professionnel</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+213 XX XX XX XX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>{t('photos')}</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Glissez vos photos ici ou cliquez pour télécharger
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    (Optionnel - Max 5 photos)
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Conditions</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Être un commerce de proximité (épicerie, pharmacie, bureau de tabac, etc.)</li>
                  <li>• Avoir des horaires d'ouverture réguliers</li>
                  <li>• Disposer d'un espace de stockage sécurisé</li>
                  <li>• Accepter les conditions d'utilisation de SwiftColis</li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Soumission en cours...
                  </>
                ) : (
                  t('submit')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

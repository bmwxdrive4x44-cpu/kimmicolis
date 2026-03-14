import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User, UserRole, LoginFormData, RegisterFormData } from '@/types';
import { mockUsers } from '@/data/mockData';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginFormData) => Promise<boolean>;
  register: (data: RegisterFormData) => Promise<boolean>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (data: LoginFormData): Promise<boolean> => {
    setIsLoading(true);
    
    // Simulation d'appel API
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const foundUser = mockUsers.find(u => u.email === data.email);
    
    if (foundUser && data.password === 'password') { // Mot de passe simulé
      setUser(foundUser);
      setIsLoading(false);
      return true;
    }
    
    setIsLoading(false);
    return false;
  }, []);

  const register = useCallback(async (data: RegisterFormData): Promise<boolean> => {
    setIsLoading(true);
    
    // Simulation d'appel API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Vérifier si l'email existe déjà
    const existingUser = mockUsers.find(u => u.email === data.email);
    if (existingUser) {
      setIsLoading(false);
      return false;
    }
    
    // Créer un nouvel utilisateur (simulation)
    const newUser: User = {
      id: String(mockUsers.length + 1),
      email: data.email,
      nom: data.nom,
      prenom: data.prenom,
      telephone: data.telephone,
      role: data.role,
      siret: data.siret,
      entreprise: data.entreprise,
      commerceNom: data.commerceNom,
      adresse: data.adresse,
      wilaya: data.wilaya,
      isActive: true,
      createdAt: new Date()
    };
    
    // Dans une vraie app, on ajouterait à la BDD
    mockUsers.push(newUser);
    setUser(newUser);
    setIsLoading(false);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const hasRole = useCallback((roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        hasRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook pour protéger les routes par rôle
export function useRequireAuth(allowedRoles?: UserRole[]) {
  const { user, isAuthenticated, hasRole } = useAuth();
  
  const isAuthorized = isAuthenticated && (!allowedRoles || hasRole(allowedRoles));
  
  return {
    user,
    isAuthenticated,
    isAuthorized
  };
}

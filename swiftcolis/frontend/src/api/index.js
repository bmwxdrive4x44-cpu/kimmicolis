import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (credentials) => api.post('/auth/login', credentials),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

// Colis APIs
export const colisAPI = {
  create: (data) => api.post('/colis', data),
  getAll: () => api.get('/colis'),
  getById: (id) => api.get(`/colis/${id}`),
  getByClient: () => api.get('/colis/my-colis'),
  updateStatus: (id, status) => api.patch(`/colis/${id}/status`, { status }),
  track: (id) => api.get(`/colis/${id}/tracking`),
};

// Relais APIs
export const relaisAPI = {
  register: (data) => api.post('/relais/register', data),
  getAll: () => api.get('/relais'),
  getById: (id) => api.get(`/relais/${id}`),
  getColisEnAttente: () => api.get('/relais/colis-en-attente'),
  scanQR: (qrCode, action) => api.post('/relais/scan', { qrCode, action }),
  validateRelais: (id) => api.patch(`/admin/relais/${id}/validate`),
  rejectRelais: (id) => api.patch(`/admin/relais/${id}/reject`),
};

// Transporteur APIs
export const transporteurAPI = {
  createTrajet: (data) => api.post('/transporteur/trajets', data),
  getMesTrajets: () => api.get('/transporteur/mes-trajets'),
  getMissionsDisponibles: () => api.get('/transporteur/missions-disponibles'),
  accepterMission: (missionId) => api.post('/transporteur/missions/accepter', { missionId }),
  getGains: () => api.get('/transporteur/gains'),
  scanQR: (qrCode) => api.post('/transporteur/scan', { qrCode }),
};

// Admin APIs
export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: () => api.get('/admin/users'),
  getRelais: () => api.get('/admin/relais'),
  getLignes: () => api.get('/admin/lignes'),
  createLigne: (data) => api.post('/admin/lignes', data),
  updateTarifs: (ligneId, tarifs) => api.patch(`/admin/lignes/${ligneId}/tarifs`, tarifs),
};

export default api;

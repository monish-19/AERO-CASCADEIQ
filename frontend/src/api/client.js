import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Aircraft
  listAircraft: () => apiClient.get('/aircraft').then(r => r.data),
  listAircraftLrus: (id) => apiClient.get(`/aircraft/${id}/lrus`).then(r => r.data),
  getAircraftRisk: (id) => apiClient.get(`/aircraft-risk/${id}`).then(r => r.data),
  
  // Simulation
  predictFailure: (lruCode, severity) => apiClient.post('/predict-failure', { lru_code: lruCode, severity }).then(r => r.data),
  
  // Alerts
  listAlerts: () => apiClient.get('/alerts').then(r => r.data),
  updateAlertStatus: (id, status) => apiClient.put(`/alerts/${id}`, { status }).then(r => r.data),
  
  // Maintenance Plan
  getMaintenancePlan: (id) => apiClient.get(`/maintenance-plan/${id}`).then(r => r.data),
  
  // Reports
  getAircraftReport: (id) => apiClient.get(`/aircraft/${id}/report`).then(r => r.data),
};

export default apiClient;

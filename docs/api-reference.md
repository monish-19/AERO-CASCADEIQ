# API Reference

Auto-generated docs available at: http://localhost:8000/docs (Swagger UI)

## Key Endpoints (M4 to implement)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /api/v1/aircraft | List all aircraft |
| GET  | /api/v1/aircraft/{id}/lrus | List LRUs with health state |
| GET  | /api/v1/aircraft-risk/{id} | Overall risk score |
| POST | /api/v1/predict-failure | Run cascade simulation |
| GET  | /api/v1/alerts | Open alerts |
| GET  | /api/v1/maintenance-plan/{id} | Maintenance recommendations |
| GET  | /api/v1/aircraft/{id}/report | 30-day summary report |

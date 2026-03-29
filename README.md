# FamilyAdmin

Zentrale Toolsammlung für die Familie – alles an einem Ort statt verstreut in vielen Apps.

## Module

- Aufgaben & To-dos
- Dokumente
- Reisen
- Rezepte
- ...und mehr

## Tech Stack

| Schicht | Technologie |
|---|---|
| Backend | Spring Boot 3 + REST + PostgreSQL |
| Frontend | Next.js + React + Tailwind CSS |
| Native App | React Native |
| Cloud | Railway |

## Projektstruktur

```
familyadmin/
├── backend/    # Spring Boot API
└── frontend/   # Next.js Web-App
```

## Lokale Entwicklung

### Backend
```bash
cd backend
./mvnw spring-boot:run
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

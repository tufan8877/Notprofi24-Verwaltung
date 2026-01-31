# Notprofi24 Web-Verwaltung (Render-ready)

Diese ZIP ist so angepasst, dass sie auf **Render** sauber läuft.

## Deploy auf Render

### 1) Service erstellen
- Render: New + Web Service
- Repo auswählen

### 2) Build/Start
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

> Hinweis: `npm run db:push` (Drizzle) solltest du **einmalig** manuell ausführen, nicht bei jedem Start.

### 3) Environment Variables
Setze in Render unter *Environment*:
- `DATABASE_URL` (Supabase Postgres URI, am besten **Session Pooler** auf Port 6543)
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SESSION_SECRET` (lange zufällige Zeichenkette)

Optional (für E-Mail Versand):
- `SMTP_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

### 4) Datenbank initialisieren (Tabellen anlegen)
**Option A (empfohlen): lokal ausführen**
```bash
npm install
export DATABASE_URL='...'
npm run db:push
```

**Option B: Render Shell** (nur wenn du Zugriff hast):
```bash
npm run db:push
```

### 5) Health Check
Nach Deploy:
- `https://<dein-service>.onrender.com/api/health`
  - `{ ok: true, db: true }` bedeutet: DB verbunden.

## Hinweise
- Die App vertraut dem Render Proxy (trust proxy) damit Login-Cookies funktionieren.
- Für Supabase/Pooler aktivieren wir SSL und setzen `rejectUnauthorized: false` (sonst kommt oft `SELF_SIGNED_CERT_IN_CHAIN`).

# EVtivity CSMS

<p align="center">
  <img src="assets/evtivity-logo.svg" alt="EVtivity" width="80" height="80" />
</p>

<p align="center">
  <a href="https://github.com/EVtivity/evtivity-csms/releases/latest"><img src="https://img.shields.io/github/v/release/EVtivity/evtivity-csms?label=Release&color=4ade80" alt="Release" /></a>
  <a href="https://github.com/EVtivity/evtivity-csms/actions/workflows/ci.yml"><img src="https://github.com/EVtivity/evtivity-csms/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/EVtivity/evtivity-csms/blob/main/LICENSE.md"><img src="https://img.shields.io/badge/License-BUSL--1.1-blue.svg" alt="License: BUSL-1.1" /></a>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-%3E%3D24-339933.svg" alt="Node.js" />
  <img src="https://img.shields.io/badge/OCPP-1.6%20%7C%202.1-4ade80.svg" alt="OCPP" />
  <img src="https://img.shields.io/badge/OCPI-2.2.1%20%7C%202.3.0-4ade80.svg" alt="OCPI" />
</p>

OCPP 1.6 va 2.1 compliant Charging Station Management System for managing EV charging infrastructure. Handles real-time WebSocket communication with charging stations, OCPI 2.2.1/2.3.0 roaming, ISO 15118 Plug and Charge, a REST API for operators, and two React frontends for operators and drivers.

---

## Tarix

Ushbu loyiha EV (Electric Vehicle) zaryadlash stansiyalarini boshqarish tizimi hisoblanadi. Ikkita asosiy interfeys mavjud:

| Interfeys          | Maqsadli foydalanuvchi                         | Port | URL                   |
| ------------------ | ---------------------------------------------- | ---- | --------------------- |
| **CSMS Dashboard** | Tarmoq operatorlari (stansiyalarni boshqarish) | 7100 | http://localhost:7100 |
| **Driver Portal**  | EV haydovchilari (zaryadlashdan foydalanish)   | 7101 | http://localhost:7101 |

---

## Tezkor Boshlash (Docker bilan)

### 1. Talablar

- Docker va Docker Compose
- Node.js 24+ (mahalliy ishlash uchun)
- Git

### 2. Reponi clone qilish

```bash
git clone https://github.com/EVtivity/evtivity-csms.git
cd evtivity-csms
```

### 3. .env faylini yaratish

```bash
cp .env.example .env
```

### 4. Docker bilan ishga tushirish

```bash
docker compose up -d
```

### 5. Statusni tekshirish

```bash
docker compose ps -a
```

Barcha servicelar muvaffaqiyatli ishga tushganini tekshiring:

| Servis    | Status     | Port             |
| --------- | ---------- | ---------------- |
| postgres  | Healthy    | 5433             |
| redis     | Healthy    | 6379             |
| migrate   | Exited (0) | -                |
| api       | Healthy    | 7102             |
| ocpp      | Healthy    | 7103, 8443, 9229 |
| csms      | Healthy    | 7100             |
| portal    | Healthy    | 7101             |
| worker    | Running    | -                |
| simulator | Running    | 8082             |

### 6. Kirish

| Servis             | Email                 | Parol    |
| ------------------ | --------------------- | -------- |
| **CSMS Dashboard** | admin@evtivity.local  | admin123 |
| **Driver Portal**  | driver@evtivity.local | admin123 |

Brauzerda oching:

- CSMS: http://localhost:7100
- Portal: http://localhost:7101

---

## Arxitektura

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontends                                │
│  ┌─────────────────┐              ┌─────────────────────────┐   │
│  │  CSMS Dashboard │              │    Driver Portal         │   │
│  │  (Operator)     │              │    (Driver)             │   │
│  └────────┬─────────┘              └────────────┬────────────┘   │
└───────────┼──────────────────────────────────────┼───────────────┘
            │                                      │
            ▼                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend Services                           │
│  ┌───────┐  ┌────────┐  ┌─────────┐  ┌──────────┐               │
│  │  API  │  │  OCPP  │  │  OCPI   │  │  Worker  │               │
│  │ :7102 │  │ :7103  │  │  :7104  │  │  (bg)    │               │
│  └───────┘  └────────┘  └─────────┘  └──────────┘               │
└─────────────────────────────────────────────────────────────────┘
            │            │            │
            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Data Layer                                 │
│        ┌───────────────┐         ┌───────────────┐              │
│        │  PostgreSQL   │         │     Redis     │              │
│        │    :5433      │         │    :6379      │              │
│        └───────────────┘         └───────────────┘              │
└─────────────────────────────────────────────────────────────────┘
            │            │
            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                            │
│  ┌─────────────────┐         ┌─────────────────────────────┐   │
│  │ Charging Stations│         │   OCPI Partners (Roaming)    │   │
│  │ (OCPP 1.6/2.1)   │         │                             │   │
│  └─────────────────┘         └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Barcha Servislar va URL Manzillari

### Asosiy Servislar

| Servis             | Ichki Port | Tashqi Port | URL                   | Tavsif            |
| ------------------ | ---------- | ----------- | --------------------- | ----------------- |
| **CSMS Dashboard** | 80         | 7100        | http://localhost:7100 | Operator panel    |
| **Driver Portal**  | 80         | 7101        | http://localhost:7101 | Haydovchi portali |
| **REST API**       | 3001       | 7102        | http://localhost:7102 | API server        |
| **OCPP Server**    | 7103       | 7103        | ws://localhost:7103   | OCPP WebSocket    |
| **OCPP TLS**       | 8443       | 8443        | wss://localhost:8443  | OCPP mTLS         |

### OCPP Xizmatlari

| Servis             | Port | URL                   | Maqsad                |
| ------------------ | ---- | --------------------- | --------------------- |
| **OCPP WebSocket** | 7103 | ws://localhost:7103   | OCPP 1.6/2.1 aloqalar |
| **OCPP TLS**       | 8443 | wss://localhost:8443  | xavfsiz OCPP aloqalar |
| **OCPP Debugger**  | 9229 | ws://localhost:9229   | Debugger port         |
| **OCPP Health**    | 8081 | http://localhost:8081 | Health check          |

### Monitoring Servislari (profilingiz bilan)

```bash
docker compose --profile monitoring up -d
```

| Servis         | Port | URL                   | Login       |
| -------------- | ---- | --------------------- | ----------- |
| **Prometheus** | 9090 | http://localhost:9090 | -           |
| **Grafana**    | 7107 | http://localhost:7107 | admin/admin |
| **Loki**       | 3100 | http://localhost:3100 | -           |

### Tools Servislar (profilingiz bilan)

```bash
docker compose --profile tools up -d
```

| Servis      | Port | URL                   | Login                 |
| ----------- | ---- | --------------------- | --------------------- |
| **pgAdmin** | 7109 | http://localhost:7109 | admin@admin.com/admin |
| **Mailpit** | 7108 | http://localhost:7108 | -                     |

### OCPI Servislar (ocpi profilingiz bilan)

```bash
docker compose --profile ocpi up -d
```

| Servis            | Port | URL                   |
| ----------------- | ---- | --------------------- |
| **OCPI Server**   | 7104 | http://localhost:7104 |
| **OCPI eMSP Sim** | 7105 | http://localhost:7105 |
| **OCPI CPO Sim**  | 7106 | http://localhost:7106 |

---

## Development (Mahalliy)

### Talablar

- Node.js 24+
- Docker va Docker Compose
- npm 10+

### 1. Dependencies o'rnatish

```bash
npm install
```

### 2. Infrastructureni Docker-da ishga tushirish

```bash
npm run dev:infra
```

Bu quyidagilarni ishga tushiradi:

- PostgreSQL (:5433)
- Redis (:6379)
- Migrations
- Seed data
- Mailpit (:7108)
- Prometheus (:9090)
- Grafana (:7107)
- Loki (:3100)
- Alloy

### 3. Servislarni ishga tushirish

Har bir service alohida terminalda:

```bash
# REST API (port 7102)
npm run dev:api

# OCPP WebSocket server (port 7103)
npm run dev:ocpp

# Operator dashboard (port 7100)
npm run dev:csms

# Driver portal (port 7101)
npm run dev:portal

# Background worker
npm run dev:worker

# Zaryadlash stansiyasi simulatori
npm run dev:css

# OCPI server (port 7104)
npm run dev:ocpi

# OCPI eMSP simulator (port 7105)
npm run dev:ocpi-sim

# OCPI CPO simulator (port 7106)
npm run dev:ocpi-sim-cpo
```

### Auto-login

`.env` faylida avtomatik kirish sozlanadi:

```env
VITE_CSMS_AUTO_LOGIN=admin@evtivity.local
VITE_PORTAL_AUTO_LOGIN=driver@evtivity.local
```

Olib tashlash uchun comment qiling.

---

## Docker Compose Buyruqlari

### Asosiy buyruqlar

```bash
# Barcha servicelarni ishga tushirish
docker compose up -d

# Barcha servicelarni to'xtatish
docker compose down

# Servicelarni qayta qurish
docker compose build --no-cache

# Barcha servicelarni tozalab, qayta ishga tushirish
docker compose down -v
docker compose up -d
```

### Logs ko'rish

```bash
# Barcha loglar
docker compose logs

# Ma'lum servis loglari
docker compose logs api
docker compose logs ocpp
docker compose logs postgres

# Real-time loglar
docker compose logs -f

# Oxirgi 50 qator
docker compose logs --tail=50
```

### Status tekshirish

```bash
# Barcha containerlar
docker compose ps -a

# Ishlayotganlar
docker compose ps

# Health check
docker compose ps | grep healthy
```

### Database buyruqlari

```bash
# Migration qo'llash
docker compose run --rm migrate

# Database ichiga kirish
docker compose exec postgres psql -U evtivity -d evtivity

# Migratsiyalarni tozalash va qayta qo'llash
docker compose down -v
docker compose up -d
```

### Servislarni alohida boshqarish

```bash
# Faqat infrastructure
docker compose up -d postgres redis migrate

# Faqat API va OCPP
docker compose up -d api ocpp

# Faqat frontend
docker compose up -d csms portal
```

---

## Database Buyruqlari

### npm buyruqlari

```bash
# Migration yaratish (schema o'zgartirilganda)
npm run db:generate

# Migration qo'llash
npm run db:migrate

# Seed data qo'llash
npm run db:seed

# Test stansiyalar yaratish
npm run db:seed:dev
```

### Docker ichida

```bash
# Database ichiga kirish
docker compose exec postgres psql -U evtivity -d evtivity

# Jadval ro'yxati
docker compose exec postgres psql -U evtivity -d evtivity -c "\dt"

# Foydalanuvchilar
docker compose exec postgres psql -U evtivity -d evtivity -c "SELECT email FROM users;"

# Driverlar
docker compose exec postgres psql -U evtivity -d evtivity -c "SELECT email FROM drivers;"
```

---

## Testing

### Unit testlar

```bash
# Barcha testlar
npm test

# Watch mode
npm test -- --watch
```

### Integration testlar

```bash
# Database ishlamayapshi kerak
npm run test:integration
```

### E2E testlar

```bash
# Playwright bilan
npm run test:e2e
```

### OCPP testlari (OCTT)

OCPP protokollarini test qilish uchun:

```bash
# OCPP 2.1 bilan test
npm run octt:2.1

# OCPP 1.6 bilan test
npm run octt:1.6

# Custom server bilan
npx tsx packages/octt/src/cli.ts --server ws://localhost:7103 --version ocpp2.1
```

---

## Code Quality

```bash
# TypeScript tekshirish
npm run typecheck

# Lint
npm run lint

# Formatlash
npm run format

# Format tekshirish
npm run format:check
```

---

## OCPP URL Manzillari va Test Qilish

### OCPP Servis URL lari

| Turi               | URL                  | Maxfiyat       |
| ------------------ | -------------------- | -------------- |
| **OCPP WebSocket** | ws://localhost:7103  | Oddiy          |
| **OCPP TLS**       | wss://localhost:8443 | xavfsiz (mTLS) |

### Health tekshirish

```bash
# OCPP health
curl http://localhost:8081/

# Natijda:
# {"status":"ok","connectedStations":0,"redis":"ok"}
```

### Portlarni tekshirish

```powershell
# PowerShell bilan barcha portlarni tekshirish
$ports = @(7100, 7101, 7102, 7103, 8443, 8081, 5433, 6379)
foreach ($port in $ports) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("localhost", $port)
        $tcp.Close()
        Write-Host "Port $port : OK" -ForegroundColor Green
    } catch {
        Write-Host "Port $port : FAIL" -ForegroundColor Red
    }
}
```

---

## Loyiha Strukturasi

```
evtivity-csms/
├── packages/                  # Monorepo packages
│   ├── api/                  # REST API server (Fastify)
│   ├── ocpp/                 # OCPP WebSocket server
│   ├── ocpi/                 # OCPI roaming server
│   ├── csms/                 # Operator dashboard (React)
│   ├── portal/               # Driver portal (React)
│   ├── worker/               # Background job processor
│   ├── css/                  # Charging station simulator
│   ├── ocpi-simulator/       # OCPI eMSP/CPO simulator
│   ├── octt/                 # OCPP test tool
│   ├── database/             # Database schema, migrations
│   ├── lib/                  # Shared utilities
│   └── codegen/              # OpenAPI codegen
├── prometheus/               # Monitoring configs
├── scripts/                  # Build scripts
├── schemas/                  # OCPP JSON schemas
├── docker-compose.yml        # Docker Compose config
├── .env.example              # Environment template
└── README.md                 # Bu fayl
```

---

## Tez-tez Uchraydigan Muammolar

### 1. Migration xatosi

```
Error: Cannot find module '/app/packages/database/dist/src/seed.js'
```

**Yechim:** `packages/database/Dockerfile.dev` faylida `node dist/src/seed.js` ni `node dist/seed.js` ga o'zgartiring.

### 2. Database ulanish xatosi

```
ERROR: could not connect to server
```

**Yechim:**

```bash
docker compose down
docker compose up -d postgres
# PostgreSQL to'liq ishga tushguncha kuting
docker compose up -d
```

### 3. Port band

```
Error: port is already allocated
```

**Yechim:** Band portni tekshiring va to'xtating:

```bash
netstat -ano | findstr :7102
# Yoki Docker containerni to'xtating
docker compose stop api
```

### 4. Driver login ishlamaydi

Driver portal `drivers` jadvalidan foydalanadi, CSMS esa `users` jadvalidan.

**Yechim:** Driver yaratish:

```sql
INSERT INTO drivers (id, first_name, last_name, email, password_hash, registration_source, language, timezone, theme_preference, distance_unit, is_active, email_verified)
VALUES (
  'drv_' || substr(gen_random_uuid()::text, 1, 8),
  'Test',
  'Driver',
  'driver@evtivity.local',
  '$argon2id$v=19$m=65536,t=3,p=4$...',
  'manual',
  'en',
  'America/New_York',
  'light',
  'miles',
  true,
  true
);
```

### 5. Redis ulanish xatosi

```
Error: Redis connection refused
```

**Yechim:**

```bash
docker compose restart redis
docker compose up -d
```

---

## Git Branch va Commit Qoidalari

### Branch nomlari

```
feature/<feature-name>
bugfix/<bugfix-name>
hotfix/<hotfix-name>
```

### Commit xabarlari

Conventional Commits formatida:

```
feat: add new charging station feature
fix: resolve OCPP connection issue
docs: update README
refactor: simplify payment processing
test: add OCPP integration tests
```

---

## Qo'shimcha Resurslar

- [DEVELOPMENT.md](DEVELOPMENT.md) - Batafsil development qo'llanma
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contributing qoidalari
- [LICENSE.md](LICENSE.md) - Licenziya shartlari
- [SECURITY.md](SECURITY.md) - Xavfsizlik bo'yicha ma'lumot

---

## License

Copyright (c) 2025-2026 EVtivity. All rights reserved.

See [LICENSE.md](LICENSE.md) for full terms.

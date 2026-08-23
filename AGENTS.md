# Finanz-Companion — Agent Guide

Dieses Dokument beschreibt den Aufbau, den Technologie-Stack und die Entwicklungsabläufe des Projekts. Es richtet sich an Agenten, die an diesem Repository arbeiten. Alle Annahmen sollten anhand der hier aufgeführten Dateien und Befehle überprüft werden.

## Projektübersicht

Finanz-Companion ist ein selbst gehostetes Tool für monatliche Vermögens-Snapshots mit Coaching-Ebene. Es besteht aus:

- **Web-App**: Next.js 14 App Router, React Server Components, deutsche UI, Authentifizierung über Passphrase.
- **Telegram-Bot**: Grammy-basierter Bot für Schnellerfassung von Ausgaben und Monatsabschlüssen.
- **Worker**: Node-Cron-basierter Dienst für Erinnerungsnachrichten (Telegram).
- **Datenbank-Package**: Gemeinsame Drizzle-ORM-Definitionen und Migrationen für PostgreSQL.

Das Produkt konzentriert sich auf manuell erfasste monatliche Kontenstände, Kategorisierung von Transaktionen, Nettovermögens-Berechnungen und einen KI-Coach (aktuell Platzhalter/Anthropic-Integration).

## Technologie-Stack

- **Monorepo**: pnpm Workspaces (`pnpm-workspace.yaml`)
- **Sprache**: TypeScript 5.5, ES2022, `moduleResolution: bundler`
- **Node.js**: >= 20.0.0
- **Package Manager**: pnpm 9.7.0 (`packageManager` in `package.json`)
- **Web**: Next.js 14.2.7, React 18, Tailwind CSS 3.4, Radix UI Primitives, Recharts, Zod
- **Bot / Worker**: Grammy, node-cron, Anthropic SDK
- **Datenbank**: PostgreSQL 16, Drizzle ORM 0.33, Drizzle Kit 0.24, `postgres` (pg driver)
- **Auth**: `@node-rs/argon2` für Passwort-Hashing, sessionbasierte Cookies (90 Tage)
- **Deployment**: Docker Compose, Caddy (TLS) oder IP-only, alpine-basierte Images

## Repository-Struktur

```text
.
├── apps/
│   ├── web/              # Next.js App (Port 3000)
│   ├── bot/              # Telegram Bot (Port 3001)
│   └── worker/           # Cron-Reminder (Port 3002)
├── packages/
│   └── db/               # Drizzle Schema, Migrations, Seed
├── docker-compose.dev.yml
├── docker-compose.yml    # IP-only Produktion
├── docker-compose.prod.yml  # Hetzner mit Caddy + TLS
├── package.json          # Root-Scripts
├── pnpm-workspace.yaml
└── tsconfig.json         # Shared TypeScript-Basis
```

### `packages/db`

- `src/schema/index.ts`: Vollständiges Drizzle-Schema (PostgreSQL-Enums, Tabellen, Relationen).
- `src/index.ts`: Exportiert `db`-Client und Schema.
- `src/seed.ts`: Seed-Daten für Kategorien, Konten, Quick Actions, Moduleinstellungen und einen Default-User (`changeme`).
- `drizzle.config.ts`: Drizzle-Kit Konfiguration für `generate`, `migrate` und `studio`.

Wichtige Tabellen: `accounts`, `snapshots`, `snapshot_balances`, `transactions`, `categories`, `quick_actions`, `goals`, `debts`, `advice_log`, `module_settings`, `users`, `sessions`, `reminders`, `bot_sessions`, `audit_log`.

### `apps/web`

- App Router unter `src/app/`.
- Geschützte Dashboard-Routen in `src/app/(dashboard)/`.
- API-Routen unter `src/app/api/` (Accounts, Kategorien, Transaktionen, Snapshots, Ziele, Auth, Coach, Export).
- Shared Logik in `src/lib/`: `auth.ts`, `db.ts`, `calculations.ts`, `utils.ts`, `mode.ts`.
- Komponenten in `src/components/`, UI-Primitive in `src/components/ui/`.
- Darkmode-Default in `layout.tsx` (`className="dark"`).

### `apps/bot`

- `src/index.ts`: Bot-Initialisierung, Session-Storage in `bot_sessions`, Webhook-Server (`/telegram/webhook`, `/health`) oder Long-Polling im Dev-Modus.
- `src/handlers.ts`: Befehle (`/stand`, `/heute`, `/monat`, `/undo`, `/abbruch`, `/hilfe`) und freie Texteingabe.
- `src/parser.ts`: Regex-basiertes Parsen von Ausgaben mit LLM-Fallback (Anthropic) und Kategoriezuordnung über Keywords/Quick Actions.

### `apps/worker`

- `src/index.ts`: Startet Cron-Jobs und Health-Check-Server.
- `src/reminders.ts`: Versendet drei Erinnerungsstufen (28., letzter Tag des Monats, 3. des Folgemonats) per Telegram.

## Entwicklung einrichten

Voraussetzungen: Node.js >= 20, pnpm >= 9, Docker Desktop (für Postgres).

### Windows

Die `setup.bat` führt das komplette Setup durch:

```batch
setup.bat
```

### Manuelles Setup

```bash
# Dependencies installieren
pnpm install

# Dev-Datenbank starten (PostgreSQL auf Port 5432)
docker compose -f docker-compose.dev.yml up -d

# Environment vorbereiten
cp .env.example .env
# .env anpassen (DATABASE_URL, SESSION_SECRET, ggf. TELEGRAM_BOT_TOKEN, ANTHROPIC_API_KEY)

# Optional: .env an die Workspaces verteilen (wie setup.bat)
cp .env apps/web/.env.local
cp .env packages/db/.env
cp .env apps/bot/.env

# Datenbankschema generieren und migrieren
pnpm db:generate
pnpm db:migrate

# Seed-Daten einspielen (Default-User, Kategorien, Konten)
pnpm db:seed
```

### Einzelne Apps starten

```bash
# Alles parallel (baut zuerst packages/db)
pnpm dev

# Nur Web
pnpm dev:web   # http://localhost:3000, Login-Passwort: changeme

# Nur Bot
pnpm dev:bot

# Nur Worker
pnpm dev:worker
```

Auf Windows stehen auch `start.bat` (Web + Bot + DB) und `stop.bat` (DB stoppen) zur Verfügung.

## Build und Deployment

### Build

```bash
# Workspace-weit bauen
pnpm build

# Type-Checking
pnpm typecheck

# Lint (nur Web hat aktuell ein Lint-Script)
pnpm lint
```

### Datenbank-Befehle

```bash
pnpm db:generate   # Migrationen generieren (drizzle-kit generate)
pnpm db:migrate    # Migrationen anwenden (drizzle-kit migrate)
pnpm db:seed       # Seed-Script ausführen
pnpm db:studio     # Drizzle Studio starten
```

### Docker Compose

- **Entwicklung**: `docker-compose.dev.yml` stellt nur PostgreSQL bereit.
- **Produktion (Domain + TLS)**: `docker-compose.prod.yml` inklusive Caddy reverse proxy.
- **Produktion (IP-only)**: `docker-compose.yml` ohne Caddy, Web auf Port 3000, Bot auf Port 3001.

Vor dem Deploy muss `.env` basierend auf `.env.example` angelegt und `DB_PASSWORD`, `DOMAIN`, `SESSION_SECRET` etc. gesetzt werden.

```bash
# Hetzner-Deployment (Domain + Caddy)
docker compose -f docker-compose.prod.yml up -d --build

# IP-only Deployment
docker compose up -d --build
```

## Code-Konventionen

- **Sprache im Code**: Kommentare und UI-Texte sind auf Deutsch. Commit-Messages können Deutsch oder Englisch sein.
- **Imports**: Relative Imports mit `.js`-Endung in `bot` und `worker` (ESM). Web nutzt Next.js/Tailwind-Aliase (`@/lib/...`, `@/components/...`).
- **Typisierung**: Striktes TypeScript (`strict: true`). Server-Komponenten sind async und verwenden React Server Components.
- **Zod**: Für API-Validierung vorgesehen, aktuell noch nicht flächendeckend eingesetzt.
- **Beträge**: Finanzwerte werden durchgehend in Cent (`bigint`/`number`) gespeichert.
- **Perioden**: Monats-Strings im Format `YYYY-MM`.

## Tests

Das Projekt hat aktuell **keinen Test-Runner** und keine Testdateien. Die verfügbaren Qualitätsprüfungen sind:

```bash
pnpm typecheck
pnpm lint
```

Bei größeren Änderungen sollten mindestens Type-Checks und ein lokal gestarteter Dev-Server fehlerfrei durchlaufen.

## Sicherheitshinweise

- `.env` und `.env.*.local` sind in `.gitignore` eingetragen und dürfen nicht committet werden.
- Passwörter werden mit Argon2 (`memoryCost: 19456`, `timeCost: 2`) gehasht.
- Session-Cookies sind `httpOnly`, `sameSite: lax`; `secure` wird nur bei HTTPS (`APP_URL` beginnt mit `https://`) gesetzt.
- Der Telegram-Bot verwendet eine statische Allowlist (`TELEGRAM_ALLOWED_CHAT_ID`) oder ein Pairing-Verfahren über `module_settings` (Telegram-Modul).
- Webhook-Secret (`TELEGRAM_WEBHOOK_SECRET`) wird im Produktivbetrieb verwendet.
- Produktive Docker-Images laufen als nicht-root-User (`nextjs`, `botuser`, `workeruser`).

## Wichtige Annahmen und Besonderheiten

- **Single-User-System**: Die `users`-Tabelle hat aktuell maximal einen Eintrag; viele Routen gehen implizit vom ersten User aus.
- **Onboarding**: Wird über `module_settings` (`moduleId: 'onboarding'`) gesteuert.
- **Modulsystem**: Funktionen wie `transactions`, `debts`, `goals`, `coach`, `telegram` können über `module_settings` aktiviert/deaktiviert werden.
- **Coach-Endpoint**: `apps/web/src/app/api/coach/route.ts` enthält derzeit einen lokalen Platzhalter statt eines echten Anthropic-Aufrufs.
- **Parser-Fallback**: `apps/bot/src/parser.ts` versucht zuerst Regex-Matching, dann Kategorie-Keywords, dann Anthropic LLM.
- **Snapshots als Kern-Entität**: Monatliche Kontenstände (`snapshots` + `snapshot_balances`) bilden die Basis für Vermögensberechnungen, Sparquote und Runway.

## Nützliche Dateien für den Einstieg

- `finanz-companion-spec.md`: Vollständige technische Spezifikation (deutsch).
- `packages/db/src/schema/index.ts`: Alle Datenbanktabellen und Relationen.
- `apps/web/src/lib/calculations.ts`: Geschäftslogik für Vermögen, Ausgaben, Sparquote.
- `apps/bot/src/parser.ts`: Parsing-Logik für Telegram-Schnellerfassung.
- `apps/worker/src/reminders.ts`: Erinnerungslogik.

# Finanz-Companion — Technische Spezifikation

**Version:** 1.1
**Datum:** 22. August 2026
**Betriebsmodell:** Self-hosted auf Hetzner Cloud, Single-User
**Status:** Entwurf zur Umsetzung

> **Neu in 1.1:** Modul-Architektur (2.4), Lebenszyklus von Entitäten mit vollständigem Löschkonzept (2.5), Presets und Schnellbefehle für Telegram (7.2–7.4).

---

## Inhaltsverzeichnis

1. [Produktvision und Abgrenzung](#1-produktvision-und-abgrenzung)
2. [Systemarchitektur](#2-systemarchitektur)
3. [Technologie-Stack](#3-technologie-stack)
4. [Datenmodell](#4-datenmodell)
5. [Kernlogik und Berechnungen](#5-kernlogik-und-berechnungen)
6. [Web-App](#6-web-app)
7. [Telegram-Bot](#7-telegram-bot)
8. [Scheduler und Erinnerungslogik](#8-scheduler-und-erinnerungslogik)
9. [KI-Coach](#9-ki-coach)
10. [API-Spezifikation](#10-api-spezifikation)
11. [Authentifizierung und Sicherheit](#11-authentifizierung-und-sicherheit)
12. [Hosting auf Hetzner](#12-hosting-auf-hetzner)
13. [Backup, Restore und Datenexport](#13-backup-restore-und-datenexport)
14. [Umgebungsvariablen](#14-umgebungsvariablen)
15. [Entwicklungs-Roadmap](#15-entwicklungs-roadmap)
16. [Offene Entscheidungen und Risiken](#16-offene-entscheidungen-und-risiken)
17. [Akzeptanzkriterien](#17-akzeptanzkriterien)

---

## 1. Produktvision und Abgrenzung

### 1.1 Kernidee

Der Finanz-Companion ist **kein Ausgaben-Tracker**, sondern ein **monatlicher Vermögens-Snapshot mit Coaching-Ebene**.

Der entscheidende Unterschied zu Banking-Aggregatoren wie Finanzguru: Diese zeigen den aktuellen Stand *verknüpfter Konten*. Sie kennen weder Bargeld, noch private Schulden, noch Vermögenswerte außerhalb der angebundenen Banken — und sie haben keine belastbare Langzeitreihe, weil sie beim Verbinden bei null anfangen und beim Wechsel der Bank die Historie verlieren.

Dieses System dreht das Prinzip um: Einmal im Monat wird **manuell alles erfasst**, was Vermögen ausmacht oder es mindert. Daraus entsteht eine **Nettovermögenskurve über Jahre**, die nur durch dieses Ritual entstehen kann.

### 1.2 Die drei Säulen

| Säule | Funktion | Frequenz |
|---|---|---|
| **Snapshot** | Vollständige Erfassung aller Konten, Bargeld, Schulden | monatlich |
| **Erfassung** | Ausgaben und Einnahmen per Telegram, freiwillig unvollständig | laufend |
| **Coach** | KI-Analyse mit Rückbezug auf frühere Ansagen | monatlich + auf Abruf |

### 1.3 Leitprinzipien

**P1 — Der Snapshot ist die Wahrheit.**
Einzelbuchungen sind optional und dürfen unvollständig sein. Die Differenz zwischen zwei Snapshots ist die harte Wahrheit über die tatsächlichen Ausgaben. Erfasste Transaktionen *erklären* einen Teil dieser Differenz, sie ersetzen sie nicht.

**P2 — Unvollständigkeit ist ein Feature.**
Der Perfektionsanspruch, jede Buchung zu erfassen, ist der häufigste Grund für Abbruch nach sechs Wochen. Das System zeigt aktiv an: *"1.840 € ausgegeben, davon 620 € erfasst, 1.220 € nicht zugeordnet"* — und arbeitet mit dieser Lücke, statt sie als Fehler zu behandeln.

**P3 — Rechnen tut Code, nicht das Sprachmodell.**
Jede Zahl, die im Dashboard steht, entsteht deterministisch in SQL oder TypeScript. Das LLM interpretiert fertige Zahlen und formuliert Empfehlungen — es rechnet nicht.

**P4 — Der Coach hat ein Gedächtnis für seine eigenen Ansagen.**
Jede Empfehlung wird protokolliert. Im Folgemonat prüft das System automatisch, ob sie eingehalten wurde, und der Coach konfrontiert damit. Ohne diesen Rückbezug ist es kein Companion, sondern ein Zufallsgenerator für Ratschläge.

**P5 — Die Daten gehören dem Nutzer.**
Jederzeit vollständiger Export als CSV und JSON. Kein proprietäres Format, keine Abhängigkeit von einem Anbieter, der morgen seine API ändert.

### 1.4 Explizite Nicht-Ziele

- **Kein Multi-User-System.** Ein Nutzer, ein Server. Kein Mandantenmodell, keine Rollen, keine Einladungen. Falls später ein Partner-Zugang gewünscht wird: eigene Instanz oder Neuentwurf.
- **Keine Echtzeit-Kontoanbindung im MVP.** PSD2 ist Phase 3, siehe Roadmap.
- **Keine Anlageberatung.** Der Coach analysiert Cashflow, Schulden und Zielerreichung. Er empfiehlt keine konkreten Wertpapiere.
- **Keine mobile Native App.** PWA, installierbar auf iOS und Android.
- **Keine Belegverwaltung / OCR.** Kein Foto-Upload von Kassenbons in v1.

---

## 2. Systemarchitektur

### 2.1 Komponentenübersicht

```
                        ┌──────────────────────────┐
   Handy / PC  ────────▶│   Next.js PWA (Web)      │
   (Browser)            │   Dashboard, Formulare   │
                        │   Charts, Historie       │
                        └───────────┬──────────────┘
                                    │ interne API
                                    ▼
   Telegram    ────────▶┌──────────────────────────┐        ┌──────────────┐
   (App)        Webhook │   Bot-Service (grammY)   │───────▶│  PostgreSQL  │
                        │   Parsing, Dialoge       │        │              │
                        └───────────┬──────────────┘        └──────┬───────┘
                                    │                              │
                        ┌───────────▼──────────────┐               │
                        │   Worker / Scheduler     │───────────────┘
                        │   Cron, Reminder,        │
                        │   Coach-Auswertung       │
                        └───────────┬──────────────┘
                                    │ HTTPS
                                    ▼
                        ┌──────────────────────────┐
                        │   Claude API             │
                        │   (Parsing + Coaching)   │
                        └──────────────────────────┘

   Alles läuft in Docker-Containern auf einem Hetzner CX22,
   verwaltet über Coolify, erreichbar über Caddy mit Let's Encrypt.
```

### 2.2 Container-Aufteilung

| Container | Zweck | Port intern | Öffentlich |
|---|---|---|---|
| `web` | Next.js App (SSR + API-Routen) | 3000 | ja, via Reverse Proxy |
| `bot` | Telegram-Webhook-Empfänger | 3001 | nur `/telegram/webhook` |
| `worker` | Cron-Jobs, Coach-Läufe, Backups | — | nein |
| `db` | PostgreSQL 16 | 5432 | nein |
| `proxy` | Caddy / Traefik (von Coolify gestellt) | 80, 443 | ja |

Begründung für die Trennung von `web` und `bot`: Der Bot muss einen Webhook öffentlich erreichbar halten und darf nicht durch die Session-Auth der Web-App laufen. Er authentifiziert über Telegram-Chat-ID plus Secret-Token. Getrennte Container bedeuten außerdem, dass ein Absturz beim Parsing keinen Einfluss auf die Web-App hat.

Alternativ ist ein Monolith möglich (Bot als Next.js API-Route). Für den MVP legitim, aber die Trennung kostet fast nichts und erspart später eine Umbauaktion.

### 2.3 Datenfluss: Monatlicher Snapshot

```
1.  28. des Monats, 19:00  →  Worker prüft: Snapshot für diesen Monat vorhanden?
2.  Nein  →  Telegram-Nachricht: "Zeit für den Monatsabschluss. /stand"
3.  Nutzer sendet /stand  →  Bot startet geführten Dialog
4.  Bot fragt Konto für Konto ab, Nutzer antwortet mit Zahlen
5.  Nach letztem Konto: Snapshot wird geschrieben, Status = complete
6.  Worker berechnet Kennzahlen deterministisch
7.  Worker ruft Claude API mit Kennzahlen + Historie + alten Empfehlungen
8.  Coach-Antwort wird gespeichert und per Telegram zugestellt
9.  31. des Monats  →  falls immer noch kein Snapshot: Nachfassen
10. 3. des Folgemonats  →  letzte Erinnerung, danach Monat als "verpasst" markiert
```

### 2.4 Modul-Architektur

Das System besteht aus einem schlanken Kern und austauschbaren Modulen. Der Kern kann nur eines: Konten führen und monatliche Snapshots speichern. Alles andere — Transaktionen, Schulden, Ziele, Coach — ist ein Modul, das an definierten Stellen andockt und einzeln abschaltbar ist.

Der praktische Nutzen: Du startest mit dem Kern, schaltest Schulden dazu, wenn du welche hast, und wieder ab, wenn sie getilgt sind. Kein toter Menüpunkt, kein leeres Dashboard-Widget. Und wenn du in zwei Jahren ein Immobilien- oder Krypto-Modul willst, ist der Andockpunkt schon da.

**Modul-Schnittstelle:**

```typescript
interface Module {
  id: string;                    // 'debts', 'goals', 'transactions', 'coach'
  name: string;
  enabled: boolean;              // aus Tabelle module_settings

  migrations: Migration[];       // eigene Tabellen, eigene Migrationen
  routes?: RouteDefinition[];    // API-Endpunkte unter /api/<id>/
  pages?: PageDefinition[];      // Web-Seiten + Navigationseintrag

  dashboardWidgets?: Widget[];   // Position und Priorität im Dashboard
  telegramCommands?: Command[];  // Befehle, die der Bot registriert

  snapshotFields?: Field[];      // Zusatzfragen im /stand-Dialog
  metrics?: MetricProvider[];    // liefert Kennzahlen für den Coach
  onSnapshotComplete?: Hook;     // Reaktion auf Monatsabschluss
}
```

**Verbindliche Regeln:**

1. **Der Kern kennt kein Modul.** Module registrieren sich beim Start selbst. Es gibt keinen `import` von Modul-Code im Kern und kein `if (debtsEnabled)` außerhalb der Registry.
2. **Module kennen sich untereinander nicht direkt.** Das Ziele-Modul braucht Schuldenstände für `goal_kind = 'debt_payoff'` — es fragt sie über die Metrik-Registry ab, nicht durch einen Import. Ist das Schulden-Modul aus, fehlt die Metrik und das Ziel wird als „nicht bewertbar" markiert, statt einen Fehler zu werfen.
3. **Abschalten löscht keine Daten.** Ein deaktiviertes Modul verbirgt nur seine Oberfläche und liefert keine Metriken. Beim Wiedereinschalten ist alles da.
4. **Neue Kennzahlen ohne Prompt-Änderung.** Der Coach bekommt seinen Kontext aus der Metrik-Registry zusammengesetzt. Ein neues Modul liefert neue Metriken und taucht automatisch im Coach-Kontext auf.

```sql
CREATE TABLE module_settings (
  module_id   TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  config      JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2.5 Lebenszyklus von Entitäten

Konten, Kategorien und Ziele müssen sich frei anlegen, umbenennen, umsortieren und entfernen lassen. Das ist beim Umbenennen trivial und beim Löschen der heikelste Punkt im ganzen System — deshalb hier eine verbindliche Regelung.

#### 2.5.1 Umbenennen ist immer gefahrlos

Alle Referenzen laufen über numerische IDs, nie über Namen. Ein Konto von „Sparkasse Giro" nach „N26 Hauptkonto" umzubenennen berührt keinen einzigen historischen Datensatz. Der alte Name landet im `audit_log`, damit im Dashboard ein Hinweis möglich ist: *„vor März 2027: Sparkasse Giro"*.

Bei einem echten Bankwechsel ist Umbenennen aber oft das Falsche. Dafür gibt es den **Kontowechsel**: Neues Konto anlegen, altes über `succeeded_by_id` verknüpfen. Das Dashboard kann beide Kurven dann wahlweise getrennt oder zusammengeführt darstellen — die Historie bleibt korrekt, aber die Vermögenskurve bekommt keinen künstlichen Sprung.

#### 2.5.2 Löschen: drei Stufen statt einer

„Konto löschen" bedeutet je nach Situation etwas völlig anderes. Ein einzelner Löschbutton, der stumpf `DELETE` ausführt, würde entweder deine Historie zerreißen oder mit einem Fremdschlüsselfehler abbrechen. Deshalb ermittelt das System, was tatsächlich möglich ist, und bietet nur das an:

| Stufe | Bedingung | Wirkung |
|---|---|---|
| **Hart löschen** | Keine Snapshots, keine Transaktionen referenzieren das Konto | Zeile wird wirklich entfernt |
| **Archivieren** | Historische Daten vorhanden | `archived_at` gesetzt: verschwindet aus `/stand`, aus Formularen und aus der Kontoliste — bleibt in Kurve und Historie |
| **Zusammenführen** | Konto war ein Duplikat oder wurde ersetzt | Alle Snapshot-Werte und Transaktionen werden auf ein Zielkonto übertragen, danach hart gelöscht |

Der Löschdialog prüft vorab und zeigt Klartext: *„Dieses Konto kommt in 14 Monaten und 62 Transaktionen vor. Hartes Löschen würde deine Vermögenskurve verfälschen."* Dann Auswahl zwischen Archivieren und Zusammenführen. Erst bei einem Konto ohne jede Referenz erscheint hartes Löschen überhaupt als Option.

Archivierte Konten sind unter `/accounts` über einen Filter sichtbar und jederzeit reaktivierbar.

#### 2.5.3 Zusammenführen

```
POST /api/accounts/:id/merge  { "into": 7 }

1. Transaktion beginnen
2. Snapshot-Werte: für Perioden, in denen beide Konten existieren,
   Beträge addieren; sonst umhängen
3. transactions.account_id umschreiben
4. debts, goals.linked_account_id umschreiben
5. Vorgang vollständig nach audit_log schreiben (rückgängig machbar)
6. Quellkonto hart löschen
7. Commit
```

Denselben Mechanismus gibt es für Kategorien — „Essen" und „Lebensmittel" doppelt angelegt zu haben ist der Normalfall, nicht die Ausnahme.

#### 2.5.4 Ziele und Kategorien

- **Ziele** haben drei Zustände: aktiv, pausiert, abgeschlossen. Löschen ist erlaubt, solange keine `goal_contributions` existieren; sonst wird archiviert, damit erreichte Ziele im Rückblick sichtbar bleiben. Ein erreichtes Ziel ist Motivation und gehört nicht in den Papierkorb.
- **Kategorien** sind hierarchisch. Wird eine Elternkategorie gelöscht, rücken die Kinder eine Ebene hoch, statt mitgelöscht zu werden. Transaktionen einer gelöschten Kategorie fallen auf `NULL` und erscheinen in einer Aufräumliste.
- **Reihenfolge** ist überall per Drag-and-Drop änderbar (`sort_order`), im Web wie in der Reihenfolge der Abfrage im `/stand`-Dialog.

---

## 3. Technologie-Stack

| Ebene | Wahl | Begründung |
|---|---|---|
| Sprache | TypeScript (überall) | Ein Typsystem für Web, Bot und Worker; geteilte Zod-Schemas und Berechnungslogik ohne Duplikate |
| Web-Framework | Next.js 15 (App Router) | SSR + API-Routen in einem Deployment, gute PWA-Unterstützung |
| UI | React, Tailwind CSS, shadcn/ui | Schnell, keine Design-Entscheidungen von Grund auf |
| Charts | Recharts | Ausreichend für Linien-, Flächen- und Balkendiagramme |
| Datenbank | PostgreSQL 16 | Fenster-Funktionen für Zeitreihen, `numeric` für Geld, `jsonb` für Coach-Output |
| ORM | Drizzle | Typsicher, generiert echte SQL-Migrationen, kein Runtime-Overhead |
| Telegram | grammY | Modernes TS-SDK, saubere Conversation-Middleware für Dialoge |
| Scheduler | node-cron im Worker | Ausreichend für einen Single-User-Betrieb; keine externe Queue nötig |
| Validierung | Zod | Ein Schema für API-Input, LLM-Output-Parsing und Formulare |
| KI | Claude API (Messages) | siehe Kapitel 9 |
| Deployment | Coolify auf Hetzner | Git-Push-Deployment, verwaltetes SSL, Postgres mit Backups |
| Reverse Proxy | Caddy (Coolify-Default) | Automatisches Let's-Encrypt |

**Bewusst nicht gewählt:**

- *Serverless / Vercel* — Cron-Jobs, langlebige Bot-Sessions und eine eigene Datenbank passen schlecht in ein Function-Modell, und du wolltest ohnehin Hetzner.
- *Prisma* — funktioniert, aber der Query-Layer versteckt genau die Fenster-Funktionen, die für Zeitreihen gebraucht werden.
- *Redis* — für einen Nutzer nicht nötig; Bot-Session-State kommt in eine Postgres-Tabelle.

---

## 4. Datenmodell

### 4.1 Grundsatzentscheidungen

**Geldbeträge werden als `bigint` in Cent gespeichert.** Keine Fließkommazahlen, nirgends. Die Anzeige-Formatierung passiert erst im Frontend. Beträge können negativ sein (Schuldkonten, Korrekturen).

**Ein Snapshot ist an einen Monat gebunden, nicht an ein Datum.** Der Schlüssel ist `period` im Format `YYYY-MM`. Ob du am 28. oder am 3. des Folgemonats erfasst, ist egal — es zählt zum jeweiligen Monat.

**Konten werden nie gelöscht, nur archiviert.** Sonst brechen historische Snapshots. `archived_at` markiert den Zeitpunkt, ab dem das Konto in der Abfrage nicht mehr auftaucht.

**Alle Zeitstempel in UTC (`timestamptz`), alle Anzeige in Europe/Berlin.**

### 4.2 Schema

```sql
-- =====================================================
-- KONTEN
-- =====================================================

CREATE TYPE account_kind AS ENUM (
  'checking',     -- Girokonto
  'cash',         -- Bargeld
  'savings',      -- Tagesgeld, Festgeld
  'investment',   -- Depot, ETF, Krypto
  'receivable',   -- Geld, das dir jemand schuldet
  'liability'     -- Schulden (Kredit, Dispo, privat)
);

CREATE TABLE accounts (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  kind          account_kind NOT NULL,
  currency      CHAR(3) NOT NULL DEFAULT 'EUR',
  institution   TEXT,                       -- 'Trade Republic', 'Sparkasse', NULL bei Bargeld
  icon          TEXT,                       -- Emoji für Telegram-Anzeige
  sort_order    INT NOT NULL DEFAULT 0,     -- Reihenfolge im /stand-Dialog
  include_in_networth BOOLEAN NOT NULL DEFAULT TRUE,
  is_default_payment BOOLEAN NOT NULL DEFAULT FALSE,  -- Vorbelegung bei Schnellerfassung
  succeeded_by_id INT REFERENCES accounts(id),        -- bei Bankwechsel: Nachfolgekonto
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at   TIMESTAMPTZ
);

CREATE INDEX idx_accounts_active ON accounts (sort_order)
  WHERE archived_at IS NULL;

-- =====================================================
-- SNAPSHOTS
-- =====================================================

CREATE TYPE snapshot_status AS ENUM ('draft', 'complete', 'missed');

CREATE TABLE snapshots (
  id            SERIAL PRIMARY KEY,
  period        CHAR(7) NOT NULL UNIQUE,    -- 'YYYY-MM'
  status        snapshot_status NOT NULL DEFAULT 'draft',
  recorded_at   TIMESTAMPTZ,                -- wann tatsächlich abgeschlossen
  income_cents  BIGINT NOT NULL DEFAULT 0,  -- Nettoeinkommen des Monats
  note          TEXT,                       -- 'Urlaub', 'Bonus', Kontext für den Coach
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE snapshot_balances (
  snapshot_id   INT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  account_id    INT NOT NULL REFERENCES accounts(id),
  balance_cents BIGINT NOT NULL,            -- bei liability: positiver Wert = Restschuld
  PRIMARY KEY (snapshot_id, account_id)
);

-- =====================================================
-- TRANSAKTIONEN (optional, bewusst unvollständig)
-- =====================================================

CREATE TYPE tx_direction AS ENUM ('expense', 'income', 'transfer');
CREATE TYPE tx_source AS ENUM ('telegram', 'web', 'csv_import', 'psd2');

CREATE TABLE categories (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  parent_id     INT REFERENCES categories(id),
  is_essential  BOOLEAN NOT NULL DEFAULT FALSE,  -- Fixkosten vs. Diskretionär
  icon          TEXT,                            -- Emoji
  color         TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  keywords      TEXT[] NOT NULL DEFAULT '{}',    -- Parser-Treffer: {rewe,aldi,edeka}
  usage_count   INT NOT NULL DEFAULT 0,          -- steuert Button-Reihenfolge
  archived_at   TIMESTAMPTZ
);

-- Schnellbefehle für Telegram, vom Nutzer frei definierbar
CREATE TABLE quick_actions (
  id            SERIAL PRIMARY KEY,
  keyword       TEXT NOT NULL UNIQUE,      -- 'tanken' → /tanken 60
  label         TEXT NOT NULL,             -- 'Tanken ⛽'
  category_id   INT REFERENCES categories(id),
  account_id    INT REFERENCES accounts(id),
  direction     tx_direction NOT NULL DEFAULT 'expense',
  default_amount_cents BIGINT,             -- optional: /kaffee ohne Betrag
  merchant      TEXT,
  show_on_keyboard BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INT NOT NULL DEFAULT 0,
  usage_count   INT NOT NULL DEFAULT 0,
  archived_at   TIMESTAMPTZ
);

CREATE TABLE transactions (
  id            SERIAL PRIMARY KEY,
  occurred_on   DATE NOT NULL,
  amount_cents  BIGINT NOT NULL,            -- immer positiv, Richtung in direction
  direction     tx_direction NOT NULL,
  category_id   INT REFERENCES categories(id),
  account_id    INT REFERENCES accounts(id),-- woher bezahlt, NULL wenn unbekannt
  merchant      TEXT,
  note          TEXT,
  source        tx_source NOT NULL,
  raw_input     TEXT,                       -- Originaltext aus Telegram, für Debugging
  confidence    REAL,                       -- 0..1, vom Parser
  confirmed     BOOLEAN NOT NULL DEFAULT FALSE,
  external_id   TEXT UNIQUE,                -- Dedupe-Schlüssel für CSV/PSD2
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tx_period ON transactions (occurred_on);
CREATE INDEX idx_tx_category ON transactions (category_id, occurred_on);

-- =====================================================
-- SCHULDEN (Detaildaten zu liability-Konten)
-- =====================================================

CREATE TABLE debts (
  id                  SERIAL PRIMARY KEY,
  account_id          INT NOT NULL UNIQUE REFERENCES accounts(id),
  creditor            TEXT NOT NULL,
  original_cents      BIGINT,
  interest_rate_bps   INT NOT NULL DEFAULT 0,   -- Basispunkte: 1990 = 19,90 %
  minimum_payment_cents BIGINT,
  due_day             SMALLINT,                 -- Tag im Monat
  target_payoff_date  DATE,
  is_interest_free    BOOLEAN GENERATED ALWAYS AS (interest_rate_bps = 0) STORED
);

-- =====================================================
-- ZIELE
-- =====================================================

CREATE TYPE goal_kind AS ENUM (
  'emergency_fund',   -- Notgroschen
  'purchase',         -- Anschaffung
  'debt_payoff',      -- Schuldentilgung
  'retirement',       -- Altersvorsorge
  'custom'
);

CREATE TABLE goals (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  kind              goal_kind NOT NULL,
  target_cents      BIGINT NOT NULL,
  target_date       DATE,
  priority          SMALLINT NOT NULL DEFAULT 5,   -- 1 = höchste
  linked_account_id INT REFERENCES accounts(id),   -- Fortschritt = Kontostand
  monthly_plan_cents BIGINT,                       -- geplante Rate
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  achieved_at       TIMESTAMPTZ
);

-- Fortschritt für Ziele ohne verknüpftes Konto
CREATE TABLE goal_contributions (
  id            SERIAL PRIMARY KEY,
  goal_id       INT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  period        CHAR(7) NOT NULL,
  amount_cents  BIGINT NOT NULL,
  UNIQUE (goal_id, period)
);

-- =====================================================
-- COACH
-- =====================================================

CREATE TYPE advice_trigger AS ENUM ('monthly', 'on_demand', 'alert');

CREATE TABLE advice_log (
  id              SERIAL PRIMARY KEY,
  period          CHAR(7) NOT NULL,
  trigger         advice_trigger NOT NULL,
  model           TEXT NOT NULL,
  metrics_json    JSONB NOT NULL,     -- exakte Kennzahlen, die der Coach sah
  verdict         TEXT NOT NULL,      -- Kurzurteil, 1-2 Sätze
  body            TEXT NOT NULL,      -- vollständige Analyse
  commitments     JSONB NOT NULL,     -- [{id, text, metric, target_cents, deadline_period}]
  input_tokens    INT,
  output_tokens   INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE commitment_results (
  id              SERIAL PRIMARY KEY,
  advice_id       INT NOT NULL REFERENCES advice_log(id) ON DELETE CASCADE,
  commitment_id   TEXT NOT NULL,
  evaluated_period CHAR(7) NOT NULL,
  target_cents    BIGINT,
  actual_cents    BIGINT,
  met             BOOLEAN,
  UNIQUE (advice_id, commitment_id, evaluated_period)
);

-- =====================================================
-- INFRASTRUKTUR
-- =====================================================

CREATE TABLE reminders (
  id            SERIAL PRIMARY KEY,
  period        CHAR(7) NOT NULL,
  stage         SMALLINT NOT NULL,   -- 1 = erste, 2 = Nachfassen, 3 = letzte
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel       TEXT NOT NULL DEFAULT 'telegram',
  UNIQUE (period, stage)             -- Idempotenz: nie doppelt senden
);

CREATE TABLE bot_sessions (
  chat_id       BIGINT PRIMARY KEY,
  state         JSONB NOT NULL,      -- aktueller Dialogschritt
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id            SERIAL PRIMARY KEY,
  entity        TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  action        TEXT NOT NULL,       -- 'create' | 'update' | 'delete'
  before_json   JSONB,
  after_json    JSONB,
  actor         TEXT NOT NULL,       -- 'web' | 'telegram' | 'system'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.3 Seed-Daten (Presets)

Beim ersten Start wird das System nicht leer ausgeliefert. Ein leeres Kategoriensystem bedeutet, dass die erste Erfassung mit einer Konfigurationsaufgabe beginnt — und genau da hören Leute auf. Alles Folgende ist Vorschlag und jederzeit umbenennbar, löschbar, erweiterbar.

**Kategorien mit Parser-Keywords:**

| Kategorie | Icon | Fixkosten | Keywords für automatische Zuordnung |
|---|---|---|---|
| Lebensmittel | 🛒 | ja | rewe, aldi, lidl, edeka, penny, netto, kaufland, dm, rossmann, bäcker, supermarkt, einkauf |
| Tanken | ⛽ | ja | tanken, aral, shell, esso, jet, total, sprit, benzin, diesel, ladesäule |
| Mobilität | 🚌 | ja | bahn, db, deutschlandticket, bus, taxi, uber, ticket, parken, werkstatt, tüv |
| Wohnen | 🏠 | ja | miete, nebenkosten, strom, gas, wasser, hausgeld, internet, gez |
| Versicherungen | 🛡️ | ja | versicherung, haftpflicht, kfz, krankenkasse, rechtsschutz |
| Abos | 🔁 | ja | netflix, spotify, handy, mobilfunk, fitness, abo, cloud, prime |
| Gesundheit | 💊 | ja | apotheke, arzt, zahnarzt, brille, rezept, physio |
| Restaurant | 🍕 | nein | restaurant, essen gehen, lieferando, mcdonalds, döner, pizza, imbiss, kneipe, bar |
| Kaffee & Snacks | ☕ | nein | kaffee, starbucks, bäckerei, snack, kiosk |
| Kleidung | 👕 | nein | kleidung, schuhe, zalando, h&m, jacke |
| Freizeit | 🎮 | nein | kino, konzert, spiele, steam, buch, hobby, urlaub |
| Anschaffungen | 📦 | nein | amazon, elektronik, möbel, ikea, media markt |
| Geschenke | 🎁 | nein | geschenk, blumen, spende |
| Sonstiges | ❓ | nein | — |

`keywords` ist ein normales Array-Feld und im Web editierbar. Fügst du „netto" hinzu, greift die Regel ab sofort — ohne Code-Änderung, ohne Deployment.

**Schnellbefehle (`quick_actions`) beim Start:**

`/lebensmittel` · `/tanken` · `/restaurant` · `/kaffee` · `/abo` · `/sonstiges`

**Konten:** Girokonto 🏦 und Bargeld 💶, letzteres als `is_default_payment` für Telegram-Erfassung.

**Ziel:** Notgroschen mit Zielbetrag = 3 × geschätzte Monatsausgaben, Priorität 1.

**Module:** Kern und Transaktionen aktiv; Schulden, Ziele und Coach werden im Einrichtungsassistenten abgefragt.

---

## 5. Kernlogik und Berechnungen

Alle Kennzahlen werden deterministisch berechnet. Dieses Kapitel ist die verbindliche Referenz — bei Zweifeln gilt die hier definierte Formel, nicht das, was ein Modell sagt.

### 5.1 Nettovermögen

```
networth(p) = Σ balance(a, p)   für alle a mit kind ≠ 'liability' und include_in_networth
            − Σ balance(a, p)   für alle a mit kind = 'liability'
```

Liquides Vermögen zählt `checking`, `cash` und `savings`. Depotstände (`investment`) fließen ins Nettovermögen, aber nicht in die Liquidität.

### 5.2 Tatsächliche Ausgaben (die zentrale Formel)

Dies ist Prinzip P1 in Code gegossen:

```
liquid(p)      = Σ balance(a, p)  für kind in (checking, cash, savings)

delta(p)       = liquid(p) − liquid(p−1)

investFlow(p)  = investment(p) − investment(p−1)   [ohne Kursgewinne nicht trennbar]

debtChange(p)  = liabilities(p−1) − liabilities(p) [positiv = getilgt]

spend(p)       = income(p) − delta(p) − debtChange(p)
```

**Wichtige Einschränkung:** Bei Depots lassen sich Einzahlungen und Kursbewegungen aus einem reinen Snapshot nicht trennen. Deshalb bleibt `investment` aus der Ausgabenrechnung heraus und es gibt im Snapshot-Dialog ein optionales Feld *"davon eingezahlt"* pro Depot. Wird es gefüllt, ist die Rechnung exakt; wird es leer gelassen, wird die Depotveränderung nicht als Ausgabe gewertet und im Dashboard mit dem Hinweis *"Depotveränderung nicht aufgeteilt"* markiert.

### 5.3 Erklärungsgrad

```
tracked(p)   = Σ amount   aus transactions mit direction='expense' im Monat p
explained(p) = tracked(p) / spend(p)
unknown(p)   = spend(p) − tracked(p)
```

Das Dashboard zeigt diese drei Werte prominent. `explained` darf niedrig sein — es ist eine Information, keine Mahnung. Erst wenn `unknown` über mehrere Monate stark schwankt, weist der Coach darauf hin, dass die Datenbasis für Empfehlungen dünn ist.

### 5.4 Sparquote

```
savingsRate(p) = (income(p) − spend(p)) / income(p)
```

Zusätzlich als gleitender 3- und 12-Monats-Durchschnitt, weil Einzelmonate durch Sonderausgaben unbrauchbar verzerrt sind.

### 5.5 Runway (Notgroschen-Reichweite)

```
avgSpend  = Median der letzten 6 Monate von spend(p)   [Median, nicht Mittelwert:
                                                        ein Urlaubsmonat soll die
                                                        Zahl nicht kippen]
runway    = liquid(aktuell) / avgSpend                 [in Monaten]
```

Ampel: unter 1 Monat rot, 1–3 gelb, ab 3 grün, ab 6 dunkelgrün.

### 5.6 Schuldentilgung

Zwei Strategien werden parallel berechnet und gegenübergestellt:

**Avalanche** — höchster Zinssatz zuerst. Mathematisch optimal, spart am meisten Geld.
**Snowball** — kleinste Restschuld zuerst. Psychologisch wirksamer durch schnelle Erfolge.

```
Für jede Strategie:
  1. Alle Schulden mit Mindestrate bedienen
  2. Verfügbaren Überschuss (income − spend − Mindestraten) auf die
     nach Strategie priorisierte Schuld werfen
  3. Nach Tilgung: deren Rate auf die nächste Schuld umleiten
  4. Simulation Monat für Monat bis alle bei 0

Ausgabe je Strategie: Tilgungsdatum, Gesamtzinsen, Differenz zur Alternative
```

Der Coach bekommt beide Ergebnisse und die Differenz in Euro, damit er den Trade-off benennen kann statt pauschal eine Methode zu predigen.

### 5.7 Zielprojektion

```
progress(g)      = aktueller Stand / target_cents
requiredMonthly  = (target_cents − aktuell) / Monate bis target_date
actualMonthly    = Median der Beiträge der letzten 6 Monate
projectedDate    = aktuell + (Rest / actualMonthly) Monate
gap              = requiredMonthly − actualMonthly
```

Bei `gap > 0` wird das Ziel im Dashboard als *"nicht auf Kurs"* markiert, mit der konkreten Zahl: *"Du bist 140 €/Monat zu langsam. Zieldatum verschiebt sich auf März 2029."*

### 5.8 Fixkostenquote

```
essentialShare(p) = Σ tracked expenses mit is_essential / tracked(p)
```

Nur belastbar, wenn `explained(p)` über etwa 0,6 liegt. Darunter wird die Kennzahl im Dashboard ausgegraut und dem Coach mit dem Vermerk *"unzuverlässig"* übergeben.

---

## 6. Web-App

### 6.1 Seitenstruktur

| Route | Inhalt |
|---|---|
| `/` | Dashboard |
| `/snapshot/new` | Monatsabschluss erfassen (Web-Variante des `/stand`-Dialogs) |
| `/snapshot/[period]` | Einzelnen Monat ansehen und korrigieren |
| `/history` | Tabelle aller Monate, sortierbar, exportierbar |
| `/transactions` | Liste, Filter, Nachkategorisierung, Bulk-Edit |
| `/accounts` | Konten anlegen, umbenennen, archivieren, Reihenfolge ändern |
| `/debts` | Schuldenübersicht, Tilgungssimulator mit Schiebereglern |
| `/goals` | Ziele mit Fortschrittsbalken und Projektion |
| `/coach` | Chronik aller Coach-Auswertungen, eingehaltene vs. gerissene Zusagen |
| `/settings` | Erinnerungszeiten, Coach-Tonalität, Telegram-Verknüpfung, Export |

### 6.2 Dashboard-Aufbau

**Zeile 1 — die vier Zahlen, die zählen:**
Nettovermögen (mit Veränderung zum Vormonat in € und %) · Liquide Mittel · Schulden gesamt · Runway in Monaten

**Zeile 2 — Nettovermögenskurve.**
Gestapelte Fläche: Bargeld, Giro, Sparen, Depot oberhalb der Nulllinie, Schulden darunter. Die Nettolinie darüber. Zeitraum umschaltbar: 12 Monate / 3 Jahre / alles.

**Zeile 3 — Monatsbilanz.**
Balken: Einkommen, tatsächliche Ausgaben, davon erfasst, Sparbetrag. Darunter der Erklärungsgrad als schmaler Fortschrittsbalken mit dem Text *"620 € von 1.840 € erfasst"*.

**Zeile 4 — Ziele.**
Karten mit Fortschritt, erwartetem Datum und Abweichung.

**Zeile 5 — Letztes Coach-Urteil.**
Das Kurzurteil plus die offenen Zusagen mit Status.

### 6.3 PWA-Anforderungen

- `manifest.json` mit Icons in 192, 512 und maskable.
- Service Worker: App-Shell offline verfügbar, Daten nur online. Kein Offline-Schreiben in v1 — Konfliktauflösung ist mehr Aufwand, als der Nutzen rechtfertigt.
- Auf iOS zwingend über *"Zum Home-Bildschirm"*, sonst keine Push-Fähigkeit.
- Viewport-Optimierung: Der Snapshot-Dialog muss einhändig auf dem Handy bedienbar sein — Zahlenfeld mit `inputmode="decimal"`, großer Weiter-Button unten.

### 6.4 Eingabe-Ergonomie

Beim Erfassen ist Reibung der Feind. Konkrete Anforderungen:

- Beim Öffnen des Snapshot-Formulars sind alle Felder mit dem **Vormonatswert vorbelegt** und farblich als "unverändert" markiert. Wer nur zwei Konten geändert hat, tippt zwei Zahlen.
- Eingabefelder akzeptieren `1.234,56`, `1234.56`, `1234` und `1,2k`.
- Tab-Reihenfolge folgt `sort_order`.
- Autosave als `draft` nach jeder Eingabe. Ein Abbruch mitten im Formular verliert nichts.

---

## 7. Telegram-Bot

### 7.1 Einrichtung

1. Bot über `@BotFather` erstellen, Token notieren.
2. Webhook setzen auf `https://<domain>/telegram/webhook` mit `secret_token` (Header `X-Telegram-Bot-Api-Secret-Token` wird bei jedem Request geprüft).
3. Verknüpfung: Die Web-App zeigt unter `/settings` einen Einmal-Code. Wer `/start <code>` an den Bot sendet, dessen `chat_id` wird als autorisiert hinterlegt. **Alle Nachrichten von anderen Chat-IDs werden kommentarlos verworfen** — nicht mit einer Fehlermeldung beantwortet, weil das die Existenz des Bots bestätigen würde.

### 7.2 Befehle

Leitlinie: **kurze deutsche Wörter, keine Syntax zum Auswendiglernen.** Wer sich Parameterreihenfolgen merken muss, benutzt das Tool nach zwei Wochen nicht mehr. Jeder Befehl funktioniert auch ohne Argumente und fragt dann nach.

**Feste Befehle (Kern):**

| Befehl | Wirkung |
|---|---|
| `/stand` | Startet den geführten Monatsabschluss |
| `/heute` | Ausgaben des heutigen Tages |
| `/monat` | Zwischenstand: erfasst, Restbudget, Tage bis Abschluss |
| `/undo` | Letzte Eingabe rückgängig |
| `/hilfe` | Befehlsübersicht, dynamisch aus aktiven Modulen erzeugt |

**Befehle aus Modulen** — erscheinen nur, wenn das Modul aktiv ist:

| Befehl | Modul |
|---|---|
| `/schulden` | Schulden — Restschulden mit Tilgungsprognose |
| `/ziele` | Ziele — Fortschritt aller aktiven Ziele |
| `/coach` | Coach — Auswertung außer der Reihe |

**Verwaltungsbefehle** — dieselbe Modularität wie im Web, ohne Browser:

| Befehl | Wirkung |
|---|---|
| `/konten` | Kontoliste mit Buttons: Umbenennen, Archivieren, Neu |
| `/neuKonto` | Geführtes Anlegen: Name → Typ → Startsaldo |
| `/kategorien` | Kategorien verwalten, umbenennen, zusammenführen |
| `/neuZiel` | Ziel anlegen: Name → Betrag → Datum |
| `/befehle` | Eigene Schnellbefehle anlegen und bearbeiten |

**Schnellbefehle aus `quick_actions`** — dynamisch registriert, vom Nutzer erweiterbar:

```
/tanken 62,40           → Ausgabe, Kategorie Tanken, Standardkonto
/lebensmittel 23,90     → Ausgabe, Kategorie Lebensmittel
/restaurant 45 mit Anna → Betrag + Notiz
/kaffee                 → nutzt default_amount_cents, ein Wort genügt
```

Nach dem Anlegen eines Schnellbefehls über `/befehle` wird die Telegram-Befehlsliste per `setMyCommands` neu gesetzt — der neue Befehl taucht damit sofort in der Autovervollständigung von Telegram auf. Das ist der Punkt, an dem sich Modularität für dich tatsächlich anfühlt wie Modularität.

### 7.3 Dauertastatur

Unter dem Eingabefeld liegt eine permanente Tastatur mit den sechs meistgenutzten Schnellbefehlen, sortiert nach `usage_count` — sie passt sich also von selbst deiner Realität an:

```
┌──────────────┬──────────────┬──────────────┐
│ 🛒 Lebensm.  │ ⛽ Tanken    │ 🍕 Restaurant│
├──────────────┼──────────────┼──────────────┤
│ ☕ Kaffee    │ 📦 Sonstiges │ 📊 Monat     │
└──────────────┴──────────────┴──────────────┘
```

Tippen auf einen Button ohne Betrag fragt zurück: *„Wie viel für Tanken?"* — eine Zahl als Antwort genügt. Damit sind es zwei Taps und drei Ziffern an der Kasse, ohne einen einzigen Befehl im Kopf zu haben.

### 7.4 Der `/stand`-Dialog

Die abgefragten Konten kommen aus `accounts` in `sort_order` — ein neu angelegtes Konto erscheint ab dem nächsten Monatsabschluss automatisch im Dialog, ein archiviertes verschwindet. Zusatzfragen wie „davon eingezahlt" stammen aus `snapshotFields` der aktiven Module.

```
Bot:  Monatsabschluss August 2026. 5 Konten.
      Girokonto Sparkasse — letzter Stand 1.240,18 €
Du:   1832,50
Bot:  ✓ Bargeld — letzter Stand 85,00 €
Du:   40
Bot:  ✓ Tagesgeld — letzter Stand 4.200,00 €
Du:   =                              ← "=" übernimmt den Vormonatswert
Bot:  ✓ Depot Trade Republic — letzter Stand 8.417,33 €
Du:   9105
Bot:  Davon eingezahlt diesen Monat? (0 wenn nichts, "?" wenn unklar)
Du:   500
Bot:  ✓ Kreditkarte offen — letzter Stand 620,00 €
Du:   410
Bot:  Nettoeinkommen im August?
Du:   3200
Bot:  Kurze Notiz zum Monat? (oder "-")
Du:   Urlaub Kroatien

Bot:  ━━━━━━━━━━━━━━━━━━━━━━━
      Nettovermögen: 14.567,50 € (+892,32 € zum Vormonat)
      Ausgegeben: 2.307,68 € · davon erfasst: 640,20 €
      Sparquote: 27,9 %
      Runway: 3,4 Monate
      ━━━━━━━━━━━━━━━━━━━━━━━
      Coach-Auswertung kommt gleich…
```

Der Dialogzustand liegt in `bot_sessions`. Ein Abbruch mit `/abbruch` oder 30 Minuten Inaktivität verwirft die Session; bereits eingegebene Werte bleiben als `draft` erhalten.

### 7.5 Freitext-Erfassung

Jede Nachricht ohne Slash geht durch eine dreistufige Kaskade. Die ersten beiden Stufen sind kostenlos und antworten in Millisekunden; das Modell wird nur gerufen, wenn es wirklich nötig ist.

**Stufe 1 — Betrag per Regex.** `<Betrag> <Text>` mit optionalem Datumspräfix: `14,80 Rewe`, `60 tanken bar`, `gestern 12 döner`. Erkennt `1.234,56`, `1234.56`, `12`, `1,2k`.

**Stufe 2 — Kategorie per Keyword.** Der Resttext wird gegen `categories.keywords` und `quick_actions.keyword` geprüft. „Rewe" trifft Lebensmittel, „aral" trifft Tanken. Trifft genau ein Eintrag, ist die Zuordnung fertig — ohne API-Aufruf, mit `confidence = 0.95`.

Weil `keywords` eine normale Tabellenspalte ist, wird dieser Parser mit der Zeit von selbst besser: Jede Korrektur über den Button „Kategorie ändern" bietet an, den unbekannten Händler als Keyword zu übernehmen. Nach zwei Monaten Nutzung greift Stufe 2 bei den allermeisten Nachrichten.

**Stufe 3 — LLM-Fallback**, wenn kein Betrag gefunden wurde, mehrere Beträge auftauchen oder kein Keyword greift. Modell: `claude-haiku-4-5-20251001` (1 $ / 5 $ pro Mio. Token — bei ein paar Dutzend Nachrichten im Monat unter einem Cent). Das Modell bekommt die aktuelle Kategorienliste im Prompt und darf **nur aus diesen wählen** — es erfindet keine neuen Kategorien.

Der Parser gibt strikt JSON zurück:

```json
{
  "items": [
    {
      "amount_cents": 1480,
      "direction": "expense",
      "occurred_on": "2026-08-22",
      "merchant": "Rewe",
      "category": "Lebensmittel",
      "account_hint": "cash",
      "confidence": 0.93
    }
  ],
  "ambiguous": false,
  "clarification": null
}
```

Validierung mit Zod. Schlägt das Parsen fehl, wird **nichts geschrieben** und der Bot fragt nach — er rät nicht.

**Bestätigungsverhalten:**

- `confidence ≥ 0.85`: direkt speichern, Antwort `✓ 14,80 € · 🛒 Lebensmittel · Rewe` mit Inline-Buttons `Kategorie ändern` und `Löschen`.
- `confidence < 0.85`: speichern mit `confirmed = false`, Antwort mit den drei nach `usage_count` wahrscheinlichsten Kategorien als Buttons plus `Alle anzeigen`.
- Nach einer Korrektur: *„Soll ‚Kaufland' künftig zu 🛒 Lebensmittel gehören?"* — bei Ja wird das Keyword ergänzt.
- Mehrere Beträge in einer Nachricht: als separate Transaktionen anlegen, gemeinsam bestätigen.

### 7.6 Verhalten bei Fehlern

Der Bot antwortet **immer** — auch bei Absturz des Parsers. Eine Nachricht, die ins Leere läuft, zerstört das Vertrauen in das Tool schneller als eine falsche Kategorie. Fallback-Antwort: *"Konnte ich nicht verarbeiten. Format: `12,50 Rewe`"*.

---

## 8. Scheduler und Erinnerungslogik

### 8.1 Jobs

| Job | Zeitplan (Europe/Berlin) | Aufgabe |
|---|---|---|
| `reminder-stage-1` | 28. um 19:00 | Erinnerung, falls kein `complete`-Snapshot |
| `reminder-stage-2` | letzter Tag um 19:00 | Nachfassen |
| `reminder-stage-3` | 3. des Folgemonats, 19:00 | Letzte Chance, sonst `missed` |
| `coach-run` | ausgelöst durch Snapshot-Abschluss | Kennzahlen + Claude-Aufruf |
| `commitment-check` | mit `coach-run` | Bewertet Zusagen des Vormonats |
| `daily-digest` | täglich 21:00, optional | Kurzer Tagesabschluss |
| `db-backup` | täglich 03:30 | `pg_dump`, verschlüsselt, auf Storage Box |

### 8.2 Zeitzone

Der Container läuft in UTC. **node-cron mit expliziter Option `timezone: 'Europe/Berlin'`** — sonst verschiebt sich jede Erinnerung bei der Zeitumstellung um eine Stunde.

"Letzter Tag des Monats" gibt es in Cron nicht. Lösung: Job läuft täglich um 19:00 und prüft in der Handler-Logik, ob heute der letzte Tag ist.

### 8.3 Idempotenz

Vor jedem Versand: Existiert bereits ein Eintrag in `reminders` für `(period, stage)`? Dann abbrechen. Damit führt ein Container-Neustart oder ein doppelter Cron-Trigger nicht zu doppelten Nachrichten.

### 8.4 Eskalationston

Die drei Stufen sind bewusst unterschiedlich formuliert — Stufe 1 sachlich, Stufe 2 direkter mit Verweis auf die Serie (*"Du hast 7 Monate am Stück erfasst"*), Stufe 3 mit der Konsequenz (*"Ohne Eintrag fehlt August in der Kurve dauerhaft"*). Der Verlust der Serie ist der wirksamste Hebel; das System zählt deshalb `streak_months` und zeigt ihn.

---

## 9. KI-Coach

### 9.1 Modellwahl

| Aufgabe | Modell | Preis (pro Mio. Token) |
|---|---|---|
| Freitext-Parsing | `claude-haiku-4-5-20251001` | 1 $ / 5 $ |
| Monatliche Auswertung | `claude-sonnet-5` | 2 $ / 10 $ |

Für die Monatsauswertung sind es ein Aufruf pro Monat mit vielleicht 4.000 Input- und 1.200 Output-Token. Das sind rund 2 Cent monatlich. Kosten sind hier schlicht kein Entscheidungskriterium; entscheide nach Qualität. Wenn der Coach für dein Empfinden zu oberflächlich urteilt, ist ein Wechsel auf `claude-opus-5` (5 $ / 25 $) eine Ausgabe von wenigen Cent im Jahr.

Prompt-Caching lohnt sich bei einem Aufruf pro Monat nicht — der Cache läuft längst ab.

### 9.2 Kontext, den der Coach bekommt

Ausschließlich fertig berechnete Zahlen, niemals Rohdaten zum Selbstrechnen:

```json
{
  "period": "2026-08",
  "networth_cents": 1456750,
  "networth_change_cents": 89232,
  "networth_series_24m": [...],
  "liquid_cents": 187250,
  "debts": [
    {"creditor": "Kreditkarte", "balance_cents": 41000, "rate_bps": 1990},
    {"creditor": "Bruder", "balance_cents": 150000, "rate_bps": 0}
  ],
  "income_cents": 320000,
  "spend_cents": 230768,
  "spend_median_6m_cents": 198400,
  "tracked_cents": 64020,
  "explained_ratio": 0.28,
  "savings_rate": 0.279,
  "savings_rate_12m": 0.185,
  "runway_months": 3.4,
  "top_categories": [{"name": "Restaurant", "cents": 28400, "vs_median": 1.9}],
  "goals": [
    {"name": "Notgroschen", "progress": 0.62, "required_monthly_cents": 41000,
     "actual_monthly_cents": 27000, "on_track": false}
  ],
  "payoff_avalanche": {"date": "2028-04", "interest_cents": 74200},
  "payoff_snowball":  {"date": "2028-07", "interest_cents": 91800},
  "prior_commitments": [
    {"text": "Restaurantausgaben unter 150 €", "target_cents": 15000,
     "actual_cents": 28400, "met": false}
  ],
  "note": "Urlaub Kroatien",
  "streak_months": 7
}
```

### 9.3 System-Prompt

```
Du bist der Finanz-Coach des Nutzers. Nicht sein Buchhalter, nicht sein Freund —
sein Coach. Deine einzige Aufgabe ist, ihn an seine finanziellen Ziele zu bringen.

HALTUNG
- Direkt, nicht grausam. Du benennst Probleme beim Namen, ohne zu beschämen.
- Du redest nichts schön. Ein schlechter Monat ist ein schlechter Monat.
- Du lobst nur, wenn es verdient ist — dann aber deutlich.
- Du bist auf seiner Seite. Härte ist ein Werkzeug, kein Selbstzweck.

REGELN
1. Rechne nicht selbst. Alle Zahlen stehen im Kontext. Erfinde keine.
2. Beginne mit dem, was zählt, nicht mit Höflichkeiten.
3. Beziehe dich immer zuerst auf die Zusagen des Vormonats. Wurde eine
   gerissen, ist das der erste Punkt — vor allem anderen.
4. Maximal DREI Empfehlungen. Priorisiert. Lieber eine, die sitzt.
5. Jede Empfehlung braucht eine Zahl und eine Frist.
6. Liegt explained_ratio unter 0,5, sag klar, dass deine Analyse auf dünner
   Datenbasis steht — aber nutze das nicht als Ausrede, nichts zu sagen.
   Die Snapshot-Zahlen sind hart und reichen für ein Urteil.
7. Bei Schulden mit Zinssatz über 10 %: Das hat Vorrang vor jedem Sparziel
   außer einem Notgroschen von einem Monatsausgabenbetrag.
8. Berücksichtige die Monatsnotiz. Ein Urlaubsmonat ist kein Kontrollverlust.
9. Keine Anlageberatung. Keine konkreten Wertpapiere.
10. Deutsch. Beträge als "1.234,56 €".

AUSGABE
Ausschließlich JSON, kein Markdown, kein Vorspann:

{
  "verdict": "Ein bis zwei Sätze. Das Urteil über den Monat.",
  "body": "Analyse in 3-5 Absätzen. Erst die Zusagen des Vormonats, dann
           was passiert ist, dann warum es passiert ist.",
  "commitments": [
    {
      "id": "kurzer-slug",
      "text": "Was der Nutzer bis wann tut",
      "metric": "spend_category:Restaurant",
      "target_cents": 15000,
      "deadline_period": "2026-09"
    }
  ]
}
```

### 9.4 Tonalitäts-Einstellung

Unter `/settings` drei Stufen, die einen Absatz im System-Prompt austauschen:

- **Sachlich** — Analyst. Zahlen, Schlussfolgerung, fertig.
- **Direkt** (Standard) — wie oben.
- **Kompromisslos** — konfrontativ, nennt Muster über Monate hinweg beim Namen.

### 9.5 Zusagen-Auswertung

`metric` ist eine maschinenlesbare Kennung, die der Worker im Folgemonat auflöst:

| Metric | Auflösung |
|---|---|
| `spend_total` | `spend(p)` |
| `spend_category:<Name>` | Summe erfasster Ausgaben dieser Kategorie |
| `savings_rate` | Sparquote (Basispunkte) |
| `debt_balance:<account_id>` | Restschuld |
| `goal_contribution:<goal_id>` | Beitrag im Monat |
| `networth` | Nettovermögen |

Das Ergebnis landet in `commitment_results` und geht als `prior_commitments` in den nächsten Aufruf. Damit schließt sich die Schleife aus Prinzip P4.

**Wichtig:** Zusagen mit `spend_category`-Metrik sind nur bewertbar, wenn in dieser Kategorie überhaupt erfasst wird. Der Worker markiert sie sonst als `met: null` und der Coach erfährt, dass die Prüfung nicht möglich war — statt fälschlich einen Erfolg oder Misserfolg anzunehmen.

### 9.6 Fehlerbehandlung

Schlägt der API-Aufruf fehl oder ist die Antwort kein valides JSON: bis zu zwei Wiederholungen mit exponentiellem Backoff. Danach wird die Auswertung übersprungen und der Nutzer bekommt die berechneten Kennzahlen ohne Kommentar plus den Hinweis, dass der Coach ausgefallen ist. **Der Snapshot wird davon nie blockiert** — die Datenerfassung darf nicht von der Verfügbarkeit eines externen Dienstes abhängen.

---

## 10. API-Spezifikation

Alle Endpunkte unter `/api`, JSON, Session-Cookie-Auth.

```
GET    /api/dashboard?period=YYYY-MM      Alle Kennzahlen für das Dashboard
GET    /api/networth?from=&to=            Zeitreihe

GET    /api/accounts?includeArchived=
POST   /api/accounts
PATCH  /api/accounts/:id                  Umbenennen, Typ, Icon, Flags
DELETE /api/accounts/:id                  → archiviert; ?hard=true nur ohne Referenzen
GET    /api/accounts/:id/usage            Vorabprüfung für den Löschdialog
POST   /api/accounts/:id/restore          Archivierung aufheben
POST   /api/accounts/:id/merge            { into: <id> }
POST   /api/accounts/reorder              [{id, sort_order}, …]

GET    /api/categories?includeArchived=
POST   /api/categories
PATCH  /api/categories/:id                inkl. keywords
DELETE /api/categories/:id                Kinder rücken hoch
POST   /api/categories/:id/merge          { into: <id> }
POST   /api/categories/reorder

GET    /api/quick-actions
POST   /api/quick-actions                 → löst setMyCommands aus
PATCH  /api/quick-actions/:id
DELETE /api/quick-actions/:id

GET    /api/modules
PATCH  /api/modules/:id                   { enabled, config }

GET    /api/snapshots
GET    /api/snapshots/:period
POST   /api/snapshots                     Anlegen/Upsert (draft)
PATCH  /api/snapshots/:period             Werte ändern
POST   /api/snapshots/:period/complete    Abschließen, löst Coach aus

GET    /api/transactions?from=&to=&category=&unconfirmed=
POST   /api/transactions
PATCH  /api/transactions/:id
DELETE /api/transactions/:id
POST   /api/transactions/import           CSV-Upload

GET    /api/debts
POST   /api/debts
PATCH  /api/debts/:id
GET    /api/debts/simulate?extra=<cents>  Beide Strategien

GET    /api/goals
POST   /api/goals
PATCH  /api/goals/:id

GET    /api/advice?limit=12
POST   /api/advice/run                    On-demand-Auswertung

GET    /api/export?format=json|csv        Vollexport
POST   /api/telegram/link                 Einmal-Code erzeugen

POST   /telegram/webhook                  (nur Bot-Container, Secret-Token-Auth)
```

**Fehlerformat einheitlich:**

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "…", "fields": {…} } }
```

---

## 11. Authentifizierung und Sicherheit

### 11.1 Auth-Modell

Ein Nutzer. Kein OAuth, keine Registrierung, keine Passwort-Vergessen-Funktion.

- **Passphrase** beim Setup gesetzt, mit Argon2id gehasht in der DB.
- Login erzeugt ein Session-Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, 90 Tage Laufzeit.
- **TOTP als zweiter Faktor** — dringend empfohlen. Die App ist öffentlich erreichbar und enthält deine vollständige Vermögenslage.
- Rate-Limiting auf `/api/auth/login`: 5 Versuche pro 15 Minuten pro IP.

### 11.2 Netzwerkabsicherung

- Hetzner Cloud Firewall: eingehend nur 22 (SSH), 80, 443. Alles andere zu.
- SSH ausschließlich mit Key, `PasswordAuthentication no`, root-Login deaktiviert.
- Postgres ist **nicht** von außen erreichbar — kein Port-Mapping im Compose, nur Docker-Netzwerk.
- Coolify-Dashboard auf einer eigenen Subdomain mit eigenem Passwort, idealerweise zusätzlich auf deine IP beschränkt.
- `fail2ban` für SSH.
- Unattended-Upgrades für Sicherheitspatches.

### 11.3 Datenschutz und Verschlüsselung

- Hetzner-Volumes sind **nicht** standardmäßig verschlüsselt. Wer das will: LUKS auf einem angehängten Volume, mit dem Nachteil, dass nach jedem Reboot manuell entsperrt werden muss. Für den Anwendungsfall (Server steht in einem deutschen Rechenzentrum mit physischer Zugangskontrolle) ist der Verzicht vertretbar — die Entscheidung sollte aber bewusst fallen.
- **Backups werden immer verschlüsselt**, bevor sie den Server verlassen (siehe 13.2). Das ist nicht optional.
- Der Telegram-Chatverlauf enthält Finanzdaten und liegt auf Telegram-Servern. Wer das vermeiden will, nutzt `/stand` nur über die Web-App.
- API-Keys ausschließlich in Environment-Variablen, niemals im Repository. `.env` in `.gitignore`.

### 11.4 Schutz vor Datenverlust durch Fehleingabe

Jede Änderung an `snapshots`, `accounts` und `debts` schreibt nach `audit_log`. Ein versehentlich überschriebener Snapshot ist damit rekonstruierbar, ohne ein Backup einspielen zu müssen.

---

## 12. Hosting auf Hetzner

### 12.1 Server

**Empfehlung: CX22** (2 vCPU, 4 GB RAM, 40 GB NVMe), Standort Nürnberg oder Falkenstein, ca. 4–5 € pro Monat inklusive IPv4.

Warum nicht kleiner: Coolify selbst braucht rund 1 GB RAM, dazu Postgres, drei Node-Container und der Build-Prozess. Auf 2 GB läuft es, aber Builds schlagen unter Speicherdruck fehl. Die 2 € Differenz sind es nicht wert.

Warum nicht größer: Ein Nutzer, ein Snapshot im Monat. Die Last ist praktisch null.

**Backups bei Hetzner aktivieren** (20 % Aufpreis, also etwa 1 €). Das sind Snapshots der gesamten VM — sie ersetzen keine Datenbank-Dumps, retten dich aber, wenn du das System zerkonfigurierst.

### 12.2 Grundinstallation

```bash
# Ubuntu 24.04 LTS als Image wählen, SSH-Key beim Anlegen hinterlegen

ssh root@<server-ip>

adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# SSH härten
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

apt update && apt upgrade -y
apt install -y fail2ban unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Zeitzone (betrifft Logs, nicht die App-Logik)
timedatectl set-timezone Europe/Berlin
```

Cloud Firewall in der Hetzner-Konsole anlegen: eingehend TCP 22, 80, 443 — sonst nichts.

### 12.3 Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Danach `http://<server-ip>:8000` aufrufen, Admin-Konto anlegen, **sofort** eine Subdomain wie `deploy.deine-domain.de` hinterlegen und den Zugriff über HTTPS erzwingen.

In Coolify anschließend:

1. **Projekt** anlegen: `finanz-companion`.
2. **Postgres-Ressource** hinzufügen, automatische Backups aktivieren.
3. **Drei Anwendungen** aus dem Git-Repository: `web`, `bot`, `worker` — jeweils mit eigenem Dockerfile-Pfad.
4. **Domains** zuweisen: `finanzen.deine-domain.de` auf `web`, Pfad `/telegram/webhook` auf `bot`.
5. **Environment-Variablen** setzen (Kapitel 14).
6. **Auto-Deploy** per Webhook auf Push nach `main`.

### 12.4 DNS

Bei deinem Domain-Anbieter zwei A-Records auf die Server-IP: `finanzen` und `deploy`. Bei IPv6 zusätzlich AAAA. Caddy holt die Zertifikate automatisch, sobald die Records aufgelöst werden.

### 12.5 docker-compose (falls ohne Coolify)

Für den Fall, dass du Coolify überspringen und direkt mit Compose arbeiten willst:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: finanzen
      POSTGRES_USER: finanzen
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U finanzen"]
      interval: 10s
      retries: 5

  web:
    build: { context: ., dockerfile: apps/web/Dockerfile }
    restart: unless-stopped
    env_file: .env
    depends_on:
      db: { condition: service_healthy }
    labels:
      - "caddy=finanzen.deine-domain.de"
      - "caddy.reverse_proxy={{upstreams 3000}}"

  bot:
    build: { context: ., dockerfile: apps/bot/Dockerfile }
    restart: unless-stopped
    env_file: .env
    depends_on:
      db: { condition: service_healthy }
    labels:
      - "caddy=finanzen.deine-domain.de"
      - "caddy.handle_path=/telegram/*"
      - "caddy.handle_path.reverse_proxy={{upstreams 3001}}"

  worker:
    build: { context: ., dockerfile: apps/worker/Dockerfile }
    restart: unless-stopped
    env_file: .env
    depends_on:
      db: { condition: service_healthy }

  caddy:
    image: lucaslorentz/caddy-docker-proxy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - caddydata:/data

volumes:
  pgdata:
  caddydata:
```

### 12.6 Laufende Kosten

| Posten | Monatlich |
|---|---|
| Hetzner CX22 | ~4,50 € |
| Hetzner VM-Backups (20 %) | ~0,90 € |
| Hetzner Storage Box BX11 (offsite) | ~3,80 € |
| Domain (anteilig) | ~1,00 € |
| Claude API | < 0,10 € |
| Telegram | 0,00 € |
| **Summe** | **~10,30 €** |

Ohne Storage Box und VM-Backups: unter 6 €.

---

## 13. Backup, Restore und Datenexport

### 13.1 Drei Ebenen

1. **Hetzner VM-Snapshots** — wöchentlich automatisch. Rettet vor Systemfehlern.
2. **Postgres-Dumps** — täglich, verschlüsselt, offsite auf Storage Box. Rettet vor Datenverlust.
3. **Nutzerexport** — jederzeit manuell als JSON und CSV. Rettet dich davor, von diesem System abhängig zu sein.

### 13.2 Backup-Skript

```bash
#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d-%H%M)
FILE="/tmp/finanzen-${STAMP}.sql.gz.gpg"

docker exec finanzen-db pg_dump -U finanzen finanzen \
  | gzip -9 \
  | gpg --batch --yes --symmetric --cipher-algo AES256 \
        --passphrase-file /root/.backup-key \
        -o "${FILE}"

# Offsite auf Hetzner Storage Box
rsync -e 'ssh -p23' "${FILE}" u123456@u123456.your-storagebox.de:backups/

# Lokal 7 Tage, remote 90 Tage vorhalten
rm -f "${FILE}"
ssh -p23 u123456@u123456.your-storagebox.de \
  "find backups -name 'finanzen-*.gpg' -mtime +90 -delete"
```

Als Cron um 03:30. **Die Passphrase-Datei gehört nicht auf denselben Server, jedenfalls nicht als einzige Kopie** — leg sie zusätzlich in deinen Passwort-Manager. Ein verschlüsseltes Backup, dessen Schlüssel mit dem Server verloren geht, ist kein Backup.

### 13.3 Restore-Übung

**Einmal durchspielen, bevor du dich darauf verlässt.** Ein ungetestetes Backup ist eine Vermutung.

```bash
gpg --decrypt --passphrase-file /root/.backup-key finanzen-20260822.sql.gz.gpg \
  | gunzip \
  | docker exec -i finanzen-db psql -U finanzen -d finanzen_restore_test
```

### 13.4 Exportformat

`GET /api/export?format=json` liefert ein vollständiges, dokumentiertes Objekt mit allen Tabellen. CSV liefert ein ZIP mit einer Datei pro Tabelle. Beides muss ohne dieses System lesbar sein — das ist Prinzip P5.

---

## 14. Umgebungsvariablen

```bash
# Datenbank
DATABASE_URL=postgres://finanzen:PASS@db:5432/finanzen

# App
APP_URL=https://finanzen.deine-domain.de
SESSION_SECRET=            # openssl rand -base64 48
AUTH_PASSPHRASE_HASH=      # Argon2id-Hash, per Setup-Skript erzeugt
TOTP_SECRET=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=   # openssl rand -hex 32
TELEGRAM_ALLOWED_CHAT_ID=  # wird beim Verknüpfen gesetzt

# Claude API
ANTHROPIC_API_KEY=
COACH_MODEL=claude-sonnet-5
PARSER_MODEL=claude-haiku-4-5-20251001
COACH_TONE=direkt          # sachlich | direkt | kompromisslos

# Zeitplan
TZ=Europe/Berlin
REMINDER_DAY_1=28
REMINDER_HOUR=19

# Backup
BACKUP_PASSPHRASE_FILE=/root/.backup-key
STORAGE_BOX_HOST=
```

---

## 15. Entwicklungs-Roadmap

### Phase 0 — Validierung (kein Code, 3 Monate)

Bevor eine Zeile geschrieben wird: Google-Tabelle mit den Spalten aus `snapshot_balances`, Handy-Wecker am 28. Drei Monate durchhalten.

Das klingt nach Zeitverschwendung, ist aber der wichtigste Schritt. Nach drei Monaten weißt du, ob du das Ritual durchhältst, welche Konten du tatsächlich hast, welche Felder fehlen — und du hast drei echte Datenpunkte, mit denen die App vom ersten Tag an etwas anzeigen kann statt einer leeren Kurve. Hältst du es nicht durch, hast du dir ein Entwicklungswochenende gespart, und auch das ist ein Ergebnis.

### Phase 1 — MVP (Woche 1–2)

- Postgres-Schema, Migrationen, Seed mit Preset-Kategorien
- **Modul-Registry zuerst** — sie nachträglich einzuziehen bedeutet, jedes bestehende Feature anzufassen
- Auth mit Passphrase + TOTP
- Konten-Verwaltung inklusive Archivieren, Zusammenführen und Reihenfolge
- Snapshot-Erfassung im Web
- Dashboard mit Nettovermögenskurve und den vier Kennzahlen
- Deployment auf Hetzner, Backups aktiv
- Import der Google-Tabelle aus Phase 0

**Fertig, wenn:** Du kannst über das Handy einen Monatsabschluss machen und siehst danach deine Kurve.

### Phase 2 — Telegram (Woche 3)

- Bot-Grundgerüst, Verknüpfung, Auth
- `/stand`-Dialog
- Freitext-Parsing mit Regex und LLM-Fallback
- Erinnerungs-Jobs mit Eskalation
- `/monat`, `/heute`, `/undo`

**Fertig, wenn:** Du wirst am 28. erinnert und kannst den kompletten Abschluss im Chat erledigen.

### Phase 3 — Coach (Woche 4)

- Kennzahlen-Berechnung vollständig
- Claude-Anbindung mit strukturierter Ausgabe
- `advice_log`, Zusagen-Auswertung, `/coach`-Seite
- Tonalitätsstufen

**Fertig, wenn:** Nach dem Abschluss kommt eine Auswertung, die sich auf den Vormonat bezieht.

### Phase 4 — Schulden und Ziele (Woche 5–6)

- Schuldenverwaltung mit Zinssätzen
- Avalanche/Snowball-Simulator mit Schiebereglern
- Ziele mit Projektion
- Ampel für nicht erreichbare Ziele

### Phase 5 — Automatisierung (später, optional)

- CSV-Import für Trade Republic mit Dedupe über `external_id`
- **PSD2-Anbindung prüfen:** Trade Republic hat eine Banklizenz und ein Girokonto mit IBAN; damit besteht grundsätzlich eine Pflicht zur Kontoschnittstelle. Ein Aggregator wie GoCardless Bank Account Data (ehemals Nordigen) hat eine kostenlose Stufe und übernimmt die Lizenzanforderung. **Zuerst prüfen, ob TR in deren Institutsliste steht** — das ist ein Zehn-Minuten-Check und entscheidet, ob dieser Punkt Tage oder gar keine Arbeit bedeutet.
- Automatische Kategorisierung anhand deiner eigenen Historie

**Ausdrücklich nicht empfohlen:** inoffizielle Bibliotheken, die sich mit Telefonnummer und PIN bei Trade Republic einloggen. Sie funktionieren, bis TR etwas am Login ändert. Ein System, das dein Finanzgedächtnis tragen soll, sollte nicht auf einem Fundament stehen, das an einem beliebigen Dienstag wegbrechen kann.

---

## 16. Offene Entscheidungen und Risiken

### 16.1 Zu entscheiden vor Phase 1

| Frage | Optionen | Empfehlung |
|---|---|---|
| Depot-Einzahlungen trennen? | Extrafeld im Dialog vs. ignorieren | Extrafeld, optional |
| Transaktionen überhaupt? | Ja / nur Snapshots | Ja, aber ohne Vollständigkeitsanspruch |
| Coach-Tonalität | drei Stufen vs. eine | Drei, Standard "direkt" |
| Fremdwährungen | ja / nur EUR | Nur EUR in v1 |
| Erinnerungstag | 28. vs. letzter Tag | 28., weil planbar |

### 16.2 Risiken

**Abbruch nach wenigen Monaten.** Das größte Risiko, und es ist ein Produktrisiko, kein technisches. Gegenmaßnahmen: Vormonatswerte vorbelegt, `=`-Kürzel, Serienzähler, Eskalation der Erinnerungen, Abschluss in unter 90 Sekunden möglich.

**Die Ausgabenrechnung wird durch Depotbewegungen unbrauchbar.** Bei großen Depots dominieren Kursbewegungen die Differenz komplett. Gegenmaßnahme: `investment` aus der Ausgabenformel heraushalten, optionales Einzahlungsfeld.

**Der Coach wird beliebig.** Wenn er jeden Monat dasselbe sagt, wird er ignoriert. Gegenmaßnahmen: Zusagen-Rückbezug erzwingen, Limit auf drei Empfehlungen, Pflicht zu Zahl und Frist.

**Single Point of Failure.** Ein Server, eine Datenbank. Gegenmaßnahme: die drei Backup-Ebenen, und mindestens ein getesteter Restore.

**Datenverlust durch Fehleingabe.** Gegenmaßnahme: `audit_log`, `/undo`, Korrekturmöglichkeit für jeden vergangenen Monat.

---

## 17. Akzeptanzkriterien

Das System gilt als fertig, wenn alle folgenden Punkte zutreffen:

**Erfassung**
- [ ] Ein Monatsabschluss mit 5 Konten dauert im Telegram-Dialog unter 90 Sekunden
- [ ] Vormonatswerte sind vorbelegt, `=` übernimmt sie
- [ ] Abbruch mitten im Dialog verliert keine bereits eingegebenen Werte
- [ ] Ein vergangener Monat lässt sich nachträglich korrigieren

**Modularität**
- [ ] Ein neues Konto erscheint ohne Neustart im nächsten `/stand`-Dialog
- [ ] Ein umbenanntes Konto verändert keinen einzigen historischen Wert
- [ ] Der Löschdialog zeigt vor dem Löschen, in wie vielen Monaten das Konto vorkommt
- [ ] Hartes Löschen ist nur bei referenzloser Entität überhaupt anwählbar
- [ ] Zusammenführen zweier Konten erhält die Nettovermögenskurve unverändert
- [ ] Ein deaktiviertes Modul verbirgt Seite, Widget und Telegram-Befehl — und verliert keine Daten
- [ ] Nach Reaktivierung sind alle Daten unverändert vorhanden

**Presets**
- [ ] Nach der Ersteinrichtung existieren Kategorien und Schnellbefehle ohne Zutun
- [ ] „14,80 Rewe" wird ohne API-Aufruf korrekt zugeordnet
- [ ] Ein neuer Schnellbefehl erscheint sofort in Telegrams Autovervollständigung
- [ ] Eine Korrektur bietet an, den Händler als Keyword zu lernen
- [ ] Die Dauertastatur sortiert sich nach tatsächlicher Nutzung

**Erinnerung**
- [ ] Am 28. um 19:00 kommt die Erinnerung, wenn kein Abschluss vorliegt
- [ ] Liegt einer vor, kommt keine
- [ ] Ein Container-Neustart löst keine doppelte Nachricht aus
- [ ] Die Zeitumstellung verschiebt die Uhrzeit nicht

**Auswertung**
- [ ] Alle Dashboard-Zahlen stimmen mit den Formeln aus Kapitel 5 überein
- [ ] Der Erklärungsgrad wird angezeigt, auch wenn er bei 10 % liegt
- [ ] Bei fehlenden Vormonatsdaten zeigt das Dashboard keine Fehler, sondern Platzhalter

**Coach**
- [ ] Die Auswertung bezieht sich nachweislich auf die Zusagen des Vormonats
- [ ] Maximal drei Empfehlungen, jede mit Zahl und Frist
- [ ] Fällt die API aus, wird der Snapshot trotzdem gespeichert
- [ ] Ungültiges JSON führt nicht zu einem gespeicherten Halb-Datensatz

**Betrieb**
- [ ] HTTPS mit gültigem Zertifikat, HTTP leitet weiter
- [ ] Postgres ist von außen nicht erreichbar
- [ ] Login ohne TOTP schlägt fehl
- [ ] Ein Restore aus dem verschlüsselten Backup wurde einmal erfolgreich durchgeführt
- [ ] Der Vollexport lässt sich ohne dieses System lesen

**Mobil**
- [ ] Die PWA ist auf iOS und Android installierbar
- [ ] Der Snapshot-Dialog ist einhändig bedienbar
- [ ] Zahlenfelder öffnen die Zifferntastatur

---

*Ende der Spezifikation.*

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/logout-button';
import { db } from '@/lib/db';
import { categories, moduleSettings } from '@finanz/db/schema';
import { isNull, asc } from 'drizzle-orm';
import {
  User,
  Shield,
  Bell,
  Download,
  Tags,
  Bot,
  Key,
  Smartphone,
  FileJson,
  FileSpreadsheet,
  LogOut,
} from 'lucide-react';
import Link from 'next/link';

export default async function SettingsPage() {
  const [allCategories, settings] = await Promise.all([
    db.query.categories.findMany({
      where: isNull(categories.archivedAt),
      orderBy: [asc(categories.sortOrder)],
    }),
    db.query.moduleSettings.findMany(),
  ]);

  const getModuleSetting = (key: string) => {
    const setting = settings.find(s => s.moduleId === key);
    return setting?.enabled ?? false;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold gradient-text">Einstellungen</h1>
        <p className="text-muted-foreground mt-1">
          Verwalte deine App-Einstellungen
        </p>
      </div>

      {/* Account Section */}
      <Card className="glass hover-lift overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Konto
          </CardTitle>
          <CardDescription>Sicherheit und Authentifizierung</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Passphrase ändern</p>
                <p className="text-sm text-muted-foreground">
                  Ändere deine Login-Passphrase
                </p>
              </div>
            </div>
            <Link href="/settings/password">
              <Button variant="outline" className="hover:bg-primary/10 hover:text-primary hover:border-primary">
                Ändern
              </Button>
            </Link>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[hsl(172,66%,65%)]/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-[hsl(172,66%,65%)]" />
              </div>
              <div>
                <p className="font-medium">Zwei-Faktor-Authentifizierung</p>
                <p className="text-sm text-muted-foreground">
                  Füge TOTP als zweiten Faktor hinzu
                </p>
              </div>
            </div>
            <Button variant="outline" disabled className="opacity-50">
              Bald verfügbar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Telegram Section */}
      <Card className="glass hover-lift overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[hsl(210,80%,70%)]" />
            Telegram
          </CardTitle>
          <CardDescription>Verbinde deinen Telegram-Account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[hsl(210,80%,70%)]/10 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-[hsl(210,80%,70%)]" />
              </div>
              <div>
                <p className="font-medium">Bot verknüpfen</p>
                <p className="text-sm text-muted-foreground">
                  Erstelle einen Verknüpfungscode für den Telegram-Bot
                </p>
              </div>
            </div>
            <Link href="/settings/telegram">
              <Button variant="outline" className="hover:bg-[hsl(210,80%,70%)]/10 hover:text-[hsl(210,80%,70%)] hover:border-[hsl(210,80%,70%)]">
                Verknüpfen
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Categories Section */}
      <Card className="glass hover-lift overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-[hsl(45,90%,70%)]" />
            Kategorien
          </CardTitle>
          <CardDescription>Verwalte deine Ausgabenkategorien</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {allCategories.slice(0, 8).map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50"
                >
                  <span>{cat.icon || '📦'}</span>
                  <span className="text-sm">{cat.name}</span>
                </div>
              ))}
              {allCategories.length > 8 && (
                <div className="flex items-center px-3 py-1.5 rounded-full bg-secondary/50 text-muted-foreground text-sm">
                  +{allCategories.length - 8} weitere
                </div>
              )}
            </div>
            <Link href="/settings/categories">
              <Button variant="outline" className="w-full hover:bg-[hsl(45,90%,70%)]/10 hover:text-[hsl(45,90%,70%)] hover:border-[hsl(45,90%,70%)]">
                Kategorien verwalten
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Section */}
      <Card className="glass hover-lift overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[hsl(330,80%,75%)]" />
            Benachrichtigungen
          </CardTitle>
          <CardDescription>Erinnerungen und Hinweise</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[hsl(330,80%,75%)]/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-[hsl(330,80%,75%)]" />
              </div>
              <div>
                <p className="font-medium">Monatsabschluss-Erinnerung</p>
                <p className="text-sm text-muted-foreground">
                  Erhalte eine Erinnerung für deinen Monatsabschluss
                </p>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm ${
              getModuleSetting('reminder_enabled')
                ? 'bg-[hsl(172,66%,65%)]/10 text-[hsl(172,66%,65%)]'
                : 'bg-secondary text-muted-foreground'
            }`}>
              {getModuleSetting('reminder_enabled') ? 'Aktiv' : 'Inaktiv'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Export Section */}
      <Card className="glass hover-lift overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-[hsl(262,83%,75%)]" />
            Datenexport
          </CardTitle>
          <CardDescription>Exportiere deine Daten</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[hsl(262,83%,75%)]/10 flex items-center justify-center">
                <FileJson className="h-5 w-5 text-[hsl(262,83%,75%)]" />
              </div>
              <div>
                <p className="font-medium">JSON Export</p>
                <p className="text-sm text-muted-foreground">
                  Vollständiger Export aller Daten als JSON
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="hover:bg-[hsl(262,83%,75%)]/10 hover:text-[hsl(262,83%,75%)] hover:border-[hsl(262,83%,75%)]"
              asChild
            >
              <a href="/api/export?format=json" download>
                Exportieren
              </a>
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[hsl(172,66%,65%)]/10 flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5 text-[hsl(172,66%,65%)]" />
              </div>
              <div>
                <p className="font-medium">CSV Export</p>
                <p className="text-sm text-muted-foreground">
                  Export als ZIP mit CSV-Dateien pro Tabelle
                </p>
              </div>
            </div>
            <Button variant="outline" disabled className="opacity-50">
              Bald verfügbar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Session Section */}
      <Card className="glass hover-lift overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-destructive" />
            Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-xl bg-destructive/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <LogOut className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-medium">Abmelden</p>
                <p className="text-sm text-muted-foreground">
                  Beende deine aktuelle Sitzung
                </p>
              </div>
            </div>
            <LogoutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { categories } from '@finanz/db/schema';
import { isNull, isNotNull, asc } from 'drizzle-orm';
import { Tags, Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { CategoryList } from '@/components/category-list';

export default async function CategoriesPage() {
  const [activeCategories, archivedCategories] = await Promise.all([
    db.query.categories.findMany({
      where: isNull(categories.archivedAt),
      orderBy: [asc(categories.sortOrder)],
    }),
    db.query.categories.findMany({
      where: isNotNull(categories.archivedAt),
      orderBy: [asc(categories.sortOrder)],
    }),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="hover:bg-primary/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-bold gradient-text">Kategorien</h1>
            <p className="text-muted-foreground mt-1">
              {activeCategories.length} aktive Kategorien
            </p>
          </div>
        </div>
        <Link href="/settings/categories/new">
          <Button className="glow hover-lift">
            <Plus className="mr-2 h-4 w-4" />
            Neue Kategorie
          </Button>
        </Link>
      </div>

      {/* Active Categories */}
      <Card className="glass hover-lift overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" />
            Aktive Kategorien
          </CardTitle>
          <CardDescription>
            Kategorien für deine Transaktionen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryList categories={activeCategories} />
        </CardContent>
      </Card>

      {/* Archived Categories */}
      {archivedCategories.length > 0 && (
        <Card className="glass opacity-75">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <Tags className="h-5 w-5" />
              Archivierte Kategorien
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryList categories={archivedCategories} isArchived />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

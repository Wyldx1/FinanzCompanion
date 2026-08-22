'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Pencil, Archive, RotateCcw, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Category {
  id: number;
  name: string;
  icon: string | null;
  isEssential: boolean;
  color: string | null;
  usageCount: number;
}

interface CategoryListProps {
  categories: Category[];
  isArchived?: boolean;
}

export function CategoryList({ categories, isArchived = false }: CategoryListProps) {
  const router = useRouter();

  async function handleArchive(id: number) {
    if (!confirm('Kategorie wirklich archivieren?')) return;

    await fetch(`/api/categories/${id}`, {
      method: 'DELETE',
    });

    router.refresh();
  }

  async function handleRestore(id: number) {
    await fetch(`/api/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archivedAt: null }),
    });

    router.refresh();
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">📦</span>
        </div>
        <p className="text-muted-foreground">
          {isArchived ? 'Keine archivierten Kategorien' : 'Noch keine Kategorien angelegt'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {categories.map((category, index) => (
        <div
          key={category.id}
          className={cn(
            'p-4 rounded-xl transition-all duration-300 slide-in group relative',
            isArchived ? 'bg-secondary/30' : 'bg-secondary/50 hover:bg-secondary/80'
          )}
          style={{ animationDelay: `${index * 0.03}s` }}
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl mb-2">
              {category.icon || '📦'}
            </div>
            <p className="font-medium text-sm mb-1">{category.name}</p>
            <div className="flex items-center gap-2">
              {category.isEssential && (
                <span className="flex items-center gap-1 text-xs text-[hsl(45,90%,70%)]">
                  <Star className="h-3 w-3" />
                  Wichtig
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {category.usageCount}x verwendet
              </span>
            </div>
          </div>

          {/* Hover actions */}
          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isArchived ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-[hsl(172,66%,65%)]/20 hover:text-[hsl(172,66%,65%)]"
                onClick={() => handleRestore(category.id)}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-primary/20 hover:text-primary"
                  onClick={() => router.push(`/settings/categories/${category.id}/edit`)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-[hsl(45,90%,70%)]/20 hover:text-[hsl(45,90%,70%)]"
                  onClick={() => handleArchive(category.id)}
                >
                  <Archive className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

'use client';

import { AlertTriangle, Search } from 'lucide-react';
import { useState } from 'react';

interface AttributesTableProps {
  //   readonly projects: DbProject[];
  //   readonly users: DbUser[];
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
}

export default function AttributesTable({
  // currentUserId,
  currentUserRole,
}: Readonly<AttributesTableProps>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'active' | 'archived'>('active');
  console.log(currentUserRole);
  
  //   const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  //   const [projectToEdit, setProjectToEdit] = useState<DbProject | null>(null);
  //   const [projectToDelete, setProjectToDelete] = useState<DbProject | null>(
  //     null
  //   );
  //   const [deleteMode, setDeleteMode] = useState<'soft' | 'hard'>('soft');
  const [error, setError] = useState<string | null>('null');
  //   const [isPending, startTransition] = useTransition();

  // const isManagerOrAdmin =
  //   currentUserRole === 'admin' || currentUserRole === 'manager';
  // const isAdmin = currentUserRole === 'admin';

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-destructive bg-destructive/10 border-destructive/20 relative flex items-center gap-2 rounded-lg border p-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto cursor-pointer text-xs hover:underline focus:outline-none"
          >
            Dismiss
          </button>
        </div>
      )}

      {/*Control Bar*/}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search projects by name, key, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-input bg-background/50 placeholder:text-muted-foreground focus-visible:ring-primary flex h-10 w-full rounded-md border py-2 pr-4 pl-10 text-sm transition-all focus-visible:ring-2 focus-visible:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="bg-muted/50 border-border text-muted-foreground inline-flex h-10 items-center justify-center rounded-md border p-1">
            <button
              onClick={() => setFilterTab('active')}
              className={`ring-offset-background inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${
                filterTab === 'active'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:text-foreground'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterTab('archived')}
              className={`ring-offset-background inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${
                filterTab === 'archived'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:text-foreground'
              }`}
            >
              Archived
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

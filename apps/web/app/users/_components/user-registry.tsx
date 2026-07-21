'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  type CellContext,
  type ColumnDef,
  getCoreRowModel,
  type Row,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { Input } from '@repo/ui/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  AlertTriangle,
  Calendar,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Search,
  Shield,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { formatDate, getInitials } from '@/app/_shared/utility';
import { Pagination } from '@/components/pagination';
import { DataTable } from '@/components/data-table';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { toggleUserActive } from '../_services/users.service';
import type { User } from '../_services/users.service';
import { UserForm } from './user-form';

interface UserRegistryProps {
  readonly users: User[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly search: string;
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
}

type UserRow = Row<User>;

const ROLE_BADGE_STYLES: Record<string, string> = {
  admin: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  manager:
    'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  member: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
};

function RoleBadge({ role }: Readonly<{ role: string }>) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 capitalize',
        ROLE_BADGE_STYLES[role] ?? ROLE_BADGE_STYLES.member
      )}
    >
      <Shield className="size-3 shrink-0" />
      {role}
    </Badge>
  );
}

function StatusBadge({ active }: Readonly<{ active: boolean }>) {
  return (
    <Badge
      variant="outline"
      className={cn(
        active
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400'
      )}
    >
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}

function UserCell({
  row,
  isSelf,
}: Readonly<{ row: UserRow; isSelf: boolean }>) {
  const usr = row.original;

  return (
    <div className="flex min-w-56 items-center gap-3">
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
          usr.active
            ? 'bg-primary/10 text-primary border-primary/20'
            : 'bg-muted text-muted-foreground border-muted-foreground/20'
        )}
      >
        {getInitials(usr.name)}
      </div>
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'truncate text-sm font-semibold',
              !usr.active && 'text-muted-foreground line-through'
            )}
          >
            {usr.name}
          </span>
          {isSelf ? (
            <Badge variant="secondary" className="text-[10px]">
              You
            </Badge>
          ) : null}
        </div>
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <Mail className="size-3 shrink-0" />
          <span className="truncate">{usr.email}</span>
        </span>
      </div>
    </div>
  );
}

function JoinedCell({ row }: Readonly<{ row: UserRow }>) {
  return (
    <div className="text-muted-foreground flex items-center gap-1 text-xs">
      <Calendar className="size-3 shrink-0" />
      {formatDate(row.original.created_at)}
    </div>
  );
}

/* eslint-disable no-unused-vars */
interface ActionsCellProps {
  readonly row: UserRow;
  readonly isSelf: boolean;
  readonly isBusy: boolean;
  readonly onEdit: (usr: User) => void;
  readonly onToggle: (usr: User) => void;
}
/* eslint-enable no-unused-vars */

function ActionsCell({
  row,
  isSelf,
  isBusy,
  onEdit,
  onToggle,
}: Readonly<ActionsCellProps>) {
  const usr = row.original;

  let toggleItem = null;
  if (!isSelf) {
    toggleItem = usr.active ? (
      <DropdownMenuItem variant="destructive" onClick={() => onToggle(usr)}>
        <UserX />
        Deactivate
      </DropdownMenuItem>
    ) : (
      <DropdownMenuItem onClick={() => onToggle(usr)}>
        <UserCheck />
        Activate
      </DropdownMenuItem>
    );
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isBusy}
            className="cursor-pointer"
          >
            <MoreHorizontal />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(usr)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          {toggleItem}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* eslint-disable no-unused-vars */
// Per-table context handed to the module-level cell renderers via
// `useReactTable({ meta })`, so the renderers can stay out of the component.
interface UserTableMeta {
  readonly currentUserId?: string | null;
  readonly isBusy: boolean;
  readonly onEdit: (usr: User) => void;
  readonly onToggle: (usr: User) => void;
}

type UserCellRenderer = (context: CellContext<User, unknown>) => ReactNode;
/* eslint-enable no-unused-vars */

function getUserTableMeta(table: CellContext<User, unknown>['table']) {
  return table.options.meta as UserTableMeta;
}

// Cell renderers keyed by column id. Kept at module scope (outside the
// component) to satisfy react/no-unstable-nested-components (SonarQube S6478).
const CELL_RENDERERS: Record<string, UserCellRenderer> = {
  name: ({ row, table }) => (
    <UserCell
      row={row}
      isSelf={row.original.id === getUserTableMeta(table).currentUserId}
    />
  ),
  role: ({ row }) => <RoleBadge role={row.original.role} />,
  status: ({ row }) => <StatusBadge active={row.original.active} />,
  joined: ({ row }) => <JoinedCell row={row} />,
  actions: ({ row, table }) => {
    const meta = getUserTableMeta(table);
    return (
      <ActionsCell
        row={row}
        isSelf={row.original.id === meta.currentUserId}
        isBusy={meta.isBusy}
        onEdit={meta.onEdit}
        onToggle={meta.onToggle}
      />
    );
  },
};

const renderActionsHeader = () => <span className="sr-only">Actions</span>;

const BASE_COLUMNS: ColumnDef<User>[] = [
  { accessorKey: 'name', header: 'User', cell: CELL_RENDERERS.name },
  { accessorKey: 'role', header: 'Role', cell: CELL_RENDERERS.role },
  { accessorKey: 'active', header: 'Status', cell: CELL_RENDERERS.status },
  { accessorKey: 'created_at', header: 'Joined', cell: CELL_RENDERERS.joined },
];

const ACTIONS_COLUMN: ColumnDef<User> = {
  id: 'actions',
  header: renderActionsHeader,
  cell: CELL_RENDERERS.actions,
};

export function UserRegistry({
  users,
  totalCount,
  page,
  limit,
  totalPages,
  search,
  currentUserId,
  currentUserRole,
}: Readonly<UserRegistryProps>) {
  const { handlePageChange, handleLimitChange, router } =
    usePaginationNavigation(totalPages, limit);
  const { searchQuery, setSearchQuery } = useDebouncedSearch(search);

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingActive, setIsTogglingActive] = useState(false);

  const isAdmin = currentUserRole === 'admin';

  const openEditDialog = useCallback((usr: User) => {
    setEditingUser(usr);
  }, []);

  const handleToggleActive = useCallback(
    (usr: User) => {
      if (usr.active) {
        setDeactivatingUser(usr);
        setError(null);
        return;
      }

      setIsTogglingActive(true);
      toggleUserActive(usr.id, true)
        .then(() => {
          setError(null);
          router.refresh();
        })
        .catch((toggleError: unknown) => {
          const message =
            toggleError instanceof Error
              ? toggleError.message
              : 'Failed to activate user.';
          setError(message);
        })
        .finally(() => {
          setIsTogglingActive(false);
        });
    },
    [router]
  );

  const confirmDeactivation = () => {
    if (!deactivatingUser) return;

    setIsTogglingActive(true);
    toggleUserActive(deactivatingUser.id, false)
      .then(() => {
        setDeactivatingUser(null);
        setError(null);
        router.refresh();
      })
      .catch((toggleError: unknown) => {
        const message =
          toggleError instanceof Error
            ? toggleError.message
            : 'Failed to deactivate user.';
        setError(message);
      })
      .finally(() => {
        setIsTogglingActive(false);
      });
  };

  const columns = useMemo<ColumnDef<User>[]>(
    () => (isAdmin ? [...BASE_COLUMNS, ACTIONS_COLUMN] : BASE_COLUMNS),
    [isAdmin]
  );

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      currentUserId,
      isBusy: isTogglingActive,
      onEdit: openEditDialog,
      onToggle: handleToggleActive,
    } satisfies UserTableMeta,
  });

  return (
    <div className="space-y-6">
      {error ? (
        <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3 text-sm">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setError(null)}
            className="ml-auto"
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {/* Users Options */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search users by name or email..."
            className="pl-9"
          />
        </div>

        {isAdmin ? (
          <Button onClick={() => setIsAddUserOpen(true)}>
            <UserPlus />
            Add User
          </Button>
        ) : null}
      </div>

      {/* Users Table */}
      <Card className="border-border bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="text-primary size-5" />
            User Registry
          </CardTitle>
          <CardDescription>
            View all registered team members, their system roles, and activation
            status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            table={table}
            columnCount={columns.length}
            rowClassName="hover:bg-accent/40"
            emptyState={
              <div className="flex flex-col items-center justify-center gap-2">
                <Users className="text-muted-foreground/50 size-8 stroke-1" />
                <p>No registered users found.</p>
                <p className="text-muted-foreground/75 text-xs">
                  {searchQuery
                    ? 'Try adjusting your search.'
                    : 'Create one using the button to get started.'}
                </p>
              </div>
            }
          />

          <Pagination
            totalCount={totalCount}
            page={page}
            limit={limit}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            label="users"
          />
        </CardContent>
      </Card>

      {/* Add User */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent
          showCloseButton={false}
          className="border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Add User</DialogTitle>
          <DialogDescription className="sr-only">
            Register a new team member and assign them a workspace role.
          </DialogDescription>
          <UserForm
            onClose={() => setIsAddUserOpen(false)}
            onSuccess={() => {
              setIsAddUserOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit User */}
      <Dialog
        open={editingUser !== null}
        onOpenChange={(open) => {
          if (!open) setEditingUser(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Edit User</DialogTitle>
          <DialogDescription className="sr-only">
            Update the workspace role and profile details for this user.
          </DialogDescription>
          {editingUser ? (
            <UserForm
              user={editingUser}
              onClose={() => setEditingUser(null)}
              onSuccess={() => {
                setEditingUser(null);
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Deactivation Confirmation */}
      <Dialog
        open={deactivatingUser !== null}
        onOpenChange={(open) => {
          if (!open && !isTogglingActive) setDeactivatingUser(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <AlertTriangle className="size-5 shrink-0" />
              Confirm Deactivation
            </DialogTitle>
            <DialogDescription>
              {deactivatingUser
                ? `Are you sure you want to deactivate ${deactivatingUser.name} (${deactivatingUser.email})? They will immediately lose access to their dashboard, workspace resources, and any active sessions.`
                : null}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isTogglingActive}
              onClick={() => setDeactivatingUser(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isTogglingActive}
              onClick={confirmDeactivation}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {isTogglingActive ? (
                <>
                  <Loader2 className="animate-spin" />
                  Deactivating...
                </>
              ) : (
                'Deactivate User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import {
  useAssignRole,
  useAssignUserOutlet,
  useCreateRole,
  useInventoryUsers,
  useOutlets,
  usePermissions,
  useRemoveUserOutlet,
  useRevokeRole,
  useRoleAssignments,
  useRolePermissions,
  useRoles,
  useSetRolePermissions,
  useUpdateUserStatus,
  useUserOutlets,
} from '@/hooks/useRBAC';
import { useAuthStore } from '@/store/auth';
import { userHasPermission } from '@/lib/auth/permissions';
import type { Permission } from '@/lib/api/rbac';
import {
  ChevronRight,
  Loader2,
  Lock,
  Plus,
  Save,
  Shield,
  Store,
  UserCog,
  Users,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Tab = 'accounts' | 'roles' | 'permissions';

const inputClass =
  'w-full bg-accent/10 border border-border rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none disabled:opacity-50';
const labelClass = 'text-xs font-bold text-muted-foreground uppercase tracking-wider';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-primary' : 'bg-muted'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export default function TeamPage() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('accounts');

  const canManage = userHasPermission(user as any, ['inventory.users.manage']);

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'accounts', label: 'Accounts', icon: Users },
    { id: 'roles', label: 'Roles & Permissions', icon: Shield },
    { id: 'permissions', label: 'Permission Catalog', icon: Lock },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <UserCog className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-black text-foreground">Team & Roles</h1>
          <p className="text-sm text-muted-foreground">Manage users, roles, permissions, and outlet access.</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'accounts' && <AccountsTab orgSlug={orgSlug} canManage={canManage} />}
      {tab === 'roles' && <RolesTab orgSlug={orgSlug} canManage={canManage} />}
      {tab === 'permissions' && <PermissionsTab orgSlug={orgSlug} />}
    </div>
  );
}

/* ----------------------------- Accounts tab ----------------------------- */

function AccountsTab({ orgSlug, canManage }: { orgSlug: string; canManage: boolean }) {
  const { data: users = [], isLoading } = useInventoryUsers(orgSlug);
  const { data: roles = [] } = useRoles(orgSlug);
  const { data: assignments = [] } = useRoleAssignments(orgSlug);
  const updateStatus = useUpdateUserStatus(orgSlug);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const roleName = useMemo(() => {
    const m = new Map(roles.map((r) => [r.id, r.name]));
    return (id: string) => m.get(id) ?? id;
  }, [roles]);

  const userRoles = (userId: string) => assignments.filter((a) => a.user_id === userId);

  const filtered = users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()));

  if (isLoading) return <Loading />;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <span className="font-bold text-sm">{users.length} user{users.length === 1 ? '' : 's'}</span>
        <Input placeholder="Search by email…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {filtered.map((u) => {
            const isOpen = expanded === u.id;
            const uRoles = userRoles(u.id);
            return (
              <div key={u.id}>
                <div className="flex items-center gap-3 p-3 hover:bg-accent/5">
                  <button onClick={() => setExpanded(isOpen ? null : u.id)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{u.email}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {uRoles.length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
                        {uRoles.map((a) => (
                          <Badge key={a.id} variant="outline">{roleName(a.role_id)}</Badge>
                        ))}
                      </div>
                    </div>
                  </button>
                  <Badge variant={u.status === 'active' ? 'success' : 'warning'}>{u.status}</Badge>
                  {canManage && (
                    <Button
                      variant="outline"
                      onClick={() => updateStatus.mutate({ userId: u.id, status: u.status === 'active' ? 'inactive' : 'active' }, {
                        onSuccess: () => toast.success('User status updated'),
                        onError: () => toast.error('Failed to update status'),
                      })}
                    >
                      {u.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                  )}
                </div>
                {isOpen && (
                  <div className="bg-accent/5 px-4 py-4 border-t border-border">
                    <UserDetail orgSlug={orgSlug} userId={u.id} canManage={canManage} />
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No users found.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function UserDetail({ orgSlug, userId, canManage }: { orgSlug: string; userId: string; canManage: boolean }) {
  const { data: roles = [] } = useRoles(orgSlug);
  const { data: assignments = [] } = useRoleAssignments(orgSlug);
  const { data: outlets = [] } = useOutlets(orgSlug);
  const { data: userOutlets = [] } = useUserOutlets(orgSlug, userId);
  const assignRole = useAssignRole(orgSlug);
  const revokeRole = useRevokeRole(orgSlug);
  const assignOutlet = useAssignUserOutlet(orgSlug);
  const removeOutlet = useRemoveUserOutlet(orgSlug);

  const myAssignments = assignments.filter((a) => a.user_id === userId);
  const hasRole = (roleId: string) => myAssignments.find((a) => a.role_id === roleId);
  const assignedOutletIds = new Set(userOutlets.map((o) => o.outlet_id));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Roles */}
      <div>
        <p className={`${labelClass} mb-2 flex items-center gap-1.5`}><Shield className="h-3.5 w-3.5" /> Roles</p>
        <div className="space-y-1.5">
          {roles.map((r) => {
            const assignment = hasRole(r.id);
            return (
              <label key={r.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border">
                <span className="text-sm">{r.name}</span>
                <Toggle
                  checked={!!assignment}
                  disabled={!canManage || assignRole.isPending || revokeRole.isPending}
                  onChange={(v) => {
                    if (v) {
                      assignRole.mutate({ user_id: userId, role_id: r.id }, { onError: () => toast.error('Failed to assign role') });
                    } else if (assignment) {
                      revokeRole.mutate(assignment.id, { onError: () => toast.error('Failed to revoke role') });
                    }
                  }}
                />
              </label>
            );
          })}
          {roles.length === 0 && <p className="text-xs text-muted-foreground">No roles defined.</p>}
        </div>
      </div>

      {/* Outlets */}
      <div>
        <p className={`${labelClass} mb-2 flex items-center gap-1.5`}><Store className="h-3.5 w-3.5" /> Outlet access</p>
        <p className="text-xs text-muted-foreground mb-2">The user can only log in to the outlets enabled here.</p>
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {outlets.map((o) => {
            const enabled = assignedOutletIds.has(o.id);
            return (
              <label key={o.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border">
                <span className="text-sm truncate">{o.name} <span className="text-xs text-muted-foreground font-mono">{o.code}</span></span>
                <Toggle
                  checked={enabled}
                  disabled={!canManage || assignOutlet.isPending || removeOutlet.isPending}
                  onChange={(v) => {
                    if (v) {
                      assignOutlet.mutate({ userId, outletId: o.id }, { onError: () => toast.error('Failed to assign outlet') });
                    } else {
                      removeOutlet.mutate({ userId, outletId: o.id }, { onError: () => toast.error('Failed to remove outlet') });
                    }
                  }}
                />
              </label>
            );
          })}
          {outlets.length === 0 && <p className="text-xs text-muted-foreground">No outlets found.</p>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Roles tab ------------------------------- */

function RolesTab({ orgSlug, canManage }: { orgSlug: string; canManage: boolean }) {
  const { data: roles = [], isLoading } = useRoles(orgSlug);
  const createRole = useCreateRole(orgSlug);
  const [selected, setSelected] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ role_code: '', name: '', description: '' });

  useEffect(() => {
    if (!selected && roles.length) setSelected(roles[0].id);
  }, [roles, selected]);

  if (isLoading) return <Loading />;

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <span className="font-bold text-sm">Roles</span>
          {canManage && (
            <Button variant="outline" onClick={() => setShowNew((s) => !s)}><Plus className="h-4 w-4" /></Button>
          )}
        </CardHeader>
        <CardContent className="p-2 space-y-1">
          {showNew && (
            <div className="p-2 space-y-2 bg-accent/5 rounded-lg mb-2">
              <Input placeholder="Code (e.g. floor_supervisor)" value={form.role_code} onChange={(e) => setForm({ ...form, role_code: e.target.value })} />
              <Input placeholder="Display name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Button
                className="w-full"
                disabled={!form.role_code || !form.name || createRole.isPending}
                onClick={() => createRole.mutate(form, {
                  onSuccess: () => { toast.success('Role created'); setForm({ role_code: '', name: '', description: '' }); setShowNew(false); },
                  onError: () => toast.error('Failed to create role'),
                })}
              >
                {createRole.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create role'}
              </Button>
            </div>
          )}
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r.id)}
              className={`w-full flex items-center justify-between gap-2 p-2 rounded-lg text-left text-sm ${selected === r.id ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-accent/10'}`}
            >
              <span className="truncate">{r.name}</span>
              {r.is_system && <Badge variant="outline">system</Badge>}
            </button>
          ))}
        </CardContent>
      </Card>

      {selected && <RolePermissionMatrix orgSlug={orgSlug} roleId={selected} canManage={canManage} />}
    </div>
  );
}

function RolePermissionMatrix({ orgSlug, roleId, canManage }: { orgSlug: string; roleId: string; canManage: boolean }) {
  const { data: allPerms = [], isLoading: permsLoading } = usePermissions(orgSlug);
  const { data: rolePerms = [], isLoading: rpLoading } = useRolePermissions(orgSlug, roleId);
  const setRolePerms = useSetRolePermissions(orgSlug);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected(new Set(rolePerms.map((p) => p.id)));
  }, [rolePerms]);

  const grouped = useMemo(() => {
    const g: Record<string, Permission[]> = {};
    for (const p of allPerms) {
      (g[p.module] ??= []).push(p);
    }
    return g;
  }, [allPerms]);

  if (permsLoading || rpLoading) return <Card><CardContent className="p-6"><Loading /></CardContent></Card>;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <span className="font-bold text-sm">Permission matrix</span>
        {canManage && (
          <Button
            disabled={setRolePerms.isPending}
            onClick={() => setRolePerms.mutate({ roleId, permissionIds: Array.from(selected) }, {
              onSuccess: () => toast.success('Permissions updated'),
              onError: () => toast.error('Failed to update permissions'),
            })}
          >
            {setRolePerms.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save</>}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
        {Object.keys(grouped).sort().map((mod) => (
          <div key={mod}>
            <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1.5">{mod.replace(/_/g, ' ')}</p>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {grouped[mod].map((p) => (
                <label key={p.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border">
                  <span className="text-sm truncate" title={p.code}>{p.action}</span>
                  <Toggle checked={selected.has(p.id)} disabled={!canManage} onChange={() => toggle(p.id)} />
                </label>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* --------------------------- Permissions tab ---------------------------- */

function PermissionsTab({ orgSlug }: { orgSlug: string }) {
  const { data: perms = [], isLoading } = usePermissions(orgSlug);
  const grouped = useMemo(() => {
    const g: Record<string, Permission[]> = {};
    for (const p of perms) (g[p.module] ??= []).push(p);
    return g;
  }, [perms]);

  if (isLoading) return <Loading />;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Object.keys(grouped).sort().map((mod) => (
        <Card key={mod}>
          <CardHeader><span className="font-bold text-sm capitalize">{mod.replace(/_/g, ' ')}</span></CardHeader>
          <CardContent className="space-y-1">
            {grouped[mod].map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{p.action}</span>
                <span className="font-mono text-xs text-muted-foreground/70">{p.code}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

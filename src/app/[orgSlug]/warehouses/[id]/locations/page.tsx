'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useWarehouseLocations, useCreateLocation, useDeleteLocation } from '@/hooks/useWarehouses';
import { type WarehouseLocation, type CreateLocationInput } from '@/lib/api/warehouses';
import { ArrowLeft, FolderOpen, MapPin, Plus, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';

const LOCATION_TYPES = ['zone', 'aisle', 'shelf', 'bin', 'other'] as const;

function LocationNode({
    loc,
    depth,
    onDelete,
}: {
    loc: WarehouseLocation;
    depth: number;
    onDelete: (id: string) => void;
}) {
    return (
        <div>
            <div
                className="flex items-center justify-between py-2 px-4 hover:bg-accent/30 rounded-lg transition-colors"
                style={{ paddingLeft: `${16 + depth * 20}px` }}
            >
                <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{loc.name}</span>
                    <span className="text-xs font-mono text-muted-foreground">{loc.code}</span>
                    <span className="text-xs text-muted-foreground/60 capitalize bg-muted px-1.5 py-0.5 rounded">
                        {loc.type}
                    </span>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive h-7 w-7 p-0"
                    onClick={() => onDelete(loc.id)}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
            {loc.children?.map((child) => (
                <LocationNode key={child.id} loc={child} depth={depth + 1} onDelete={onDelete} />
            ))}
        </div>
    );
}

export default function WarehouseLocationsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const warehouseId = params?.id as string;

    const [dialogOpen, setDialogOpen] = useState(false);
    const [formName, setFormName] = useState('');
    const [formCode, setFormCode] = useState('');
    const [formType, setFormType] = useState('zone');
    const [formParentId, setFormParentId] = useState('');

    const { data: locations, isLoading } = useWarehouseLocations(orgSlug, warehouseId);
    const createLocation = useCreateLocation(orgSlug, warehouseId);
    const deleteLocation = useDeleteLocation(orgSlug, warehouseId);

    function openCreate() {
        setFormName('');
        setFormCode('');
        setFormType('zone');
        setFormParentId('');
        setDialogOpen(true);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formName.trim() || !formCode.trim()) {
            toast.error('Name and code are required');
            return;
        }
        const payload: CreateLocationInput = {
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            type: formType,
            parent_id: formParentId || undefined,
        };
        createLocation.mutate(payload, {
            onSuccess: () => {
                toast.success('Location created');
                setDialogOpen(false);
            },
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create location')),
        });
    }

    function handleDelete(id: string) {
        if (!confirm('Delete this location?')) return;
        deleteLocation.mutate(id, {
            onSuccess: () => toast.success('Location deleted'),
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to delete location')),
        });
    }

    function flattenLocations(locs: WarehouseLocation[]): WarehouseLocation[] {
        const result: WarehouseLocation[] = [];
        function walk(list: WarehouseLocation[]) {
            for (const l of list) {
                result.push(l);
                if (l.children?.length) walk(l.children);
            }
        }
        walk(locs);
        return result;
    }

    const allFlat = flattenLocations(locations ?? []);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href={`/${orgSlug}/warehouses`}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Warehouses
                        </Button>
                    </Link>
                    <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        <h1 className="text-2xl font-bold tracking-tight">Warehouse Locations</h1>
                    </div>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Location
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <h2 className="text-sm font-medium text-muted-foreground">
                        Location hierarchy (zones, aisles, shelves, bins)
                    </h2>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="py-8 text-center text-muted-foreground">Loading locations...</div>
                    ) : (locations?.length ?? 0) === 0 ? (
                        <div className="py-16 text-center">
                            <MapPin className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                            <p className="text-muted-foreground">No locations yet</p>
                            <Button className="mt-4" onClick={openCreate}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add first location
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {locations?.map((loc) => (
                                <LocationNode key={loc.id} loc={loc} depth={0} onDelete={handleDelete} />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {dialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDialogOpen(false)} />
                    <div className="relative z-50 w-full max-w-lg mx-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">Add Location</h2>
                                    <button
                                        onClick={() => setDialogOpen(false)}
                                        className="p-1 rounded-lg hover:bg-accent transition-colors"
                                    >
                                        <X className="h-5 w-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Name *</label>
                                            <Input
                                                placeholder="e.g. Zone A"
                                                value={formName}
                                                onChange={(e) => setFormName(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Code *</label>
                                            <Input
                                                placeholder="e.g. ZONE-A"
                                                value={formCode}
                                                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Type</label>
                                            <select
                                                value={formType}
                                                onChange={(e) => setFormType(e.target.value)}
                                                className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none capitalize"
                                            >
                                                {LOCATION_TYPES.map((t) => (
                                                    <option key={t} value={t} className="capitalize">{t}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Parent Location</label>
                                            <select
                                                value={formParentId}
                                                onChange={(e) => setFormParentId(e.target.value)}
                                                className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                            >
                                                <option value="">None (top-level)</option>
                                                {allFlat.map((l) => (
                                                    <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => setDialogOpen(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button type="submit" className="flex-1" disabled={createLocation.isPending}>
                                            {createLocation.isPending ? 'Creating...' : 'Create'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}

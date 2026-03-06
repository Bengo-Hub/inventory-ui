'use client';

import { Badge, Card, CardContent, CardHeader } from '@/components/ui/base';
import { apiClient } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Package, Warehouse } from 'lucide-react';
import { useParams } from 'next/navigation';

interface WarehouseItem {
    id: string;
    name: string;
    location: string;
    itemCount: number;
    status: 'active' | 'inactive';
}

export default function WarehousesPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;

    const { data: warehouses, isLoading } = useQuery<WarehouseItem[]>({
        queryKey: ['warehouses', orgSlug],
        queryFn: () => apiClient.get(`/api/v1/tenants/${orgSlug}/inventory/warehouses`),
        placeholderData: [
            {
                id: 'wh-001',
                name: 'Busia Kitchen',
                location: 'Busia, Kenya',
                itemCount: 0,
                status: 'active',
            },
        ],
    });

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
                <p className="text-muted-foreground mt-1">Storage locations for your inventory</p>
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading warehouses...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {warehouses?.map((wh) => (
                        <Card key={wh.id}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <Warehouse className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">{wh.name}</h3>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                                <MapPin className="h-3 w-3" />
                                                {wh.location}
                                            </div>
                                        </div>
                                    </div>
                                    <Badge variant={wh.status === 'active' ? 'success' : 'outline'}>
                                        {wh.status}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Package className="h-4 w-4" />
                                    <span>{wh.itemCount.toLocaleString()} items tracked</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

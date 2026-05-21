'use client';

import { Button, Card, CardContent } from '@/components/ui/base';
import { ArrowLeft, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function WarehouseLocationsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const id = params?.id as string;

    return (
        <div className="p-6 space-y-6">
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

            <Card>
                <CardContent className="py-20 text-center">
                    <MapPin className="h-14 w-14 mx-auto text-muted-foreground/30 mb-5" />
                    <h2 className="text-lg font-semibold mb-2">Coming Soon</h2>
                    <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
                        Track stock by bin, shelf, aisle, and zone within each warehouse.
                        Sub-warehouse location management is currently being rolled out.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

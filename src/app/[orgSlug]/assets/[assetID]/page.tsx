'use client';

import { Badge, Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { AssetLifecycleTabs } from '@/components/inventory/AssetLifecycleTabs';
import { useAsset, useRunDepreciation } from '@/hooks/useAssets';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

export default function AssetDetailPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const assetId = params?.assetID as string;
    const { data: asset, isLoading } = useAsset(org, assetId);
    const depreciate = useRunDepreciation(org);

    if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
    if (!asset) return <div className="p-6">Asset not found. <Link href={`/${org}/assets`} className="text-primary">Back to assets</Link></div>;

    const rows: [string, React.ReactNode][] = [
        ['Tag', asset.asset_tag],
        ['Serial', asset.serial_number || '—'],
        ['Manufacturer', asset.manufacturer || '—'],
        ['Model', asset.model || '—'],
        ['Location', asset.location || '—'],
        ['Condition', asset.condition || '—'],
        ['Purchased', asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : '—'],
        ['Purchase cost', asset.purchase_cost?.toLocaleString() ?? '—'],
        ['Current value', asset.current_value?.toLocaleString() ?? '—'],
        ['Accumulated depreciation', asset.accumulated_depreciation?.toLocaleString() ?? '—'],
        ['Salvage value', asset.salvage_value?.toLocaleString() ?? '—'],
        ['Depreciation', `${asset.depreciation_method ?? '—'} @ ${asset.depreciation_rate ?? 0}%`],
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
                <Link href={`/${org}/assets`}>
                    <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{asset.name}</h1>
                    <p className="text-muted-foreground text-sm font-mono">{asset.asset_tag}</p>
                </div>
                <Badge className="ml-2 capitalize">{asset.status}</Badge>
                <div className="ml-auto">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={depreciate.isPending}
                        onClick={() => depreciate.mutate(assetId, { onSuccess: () => toast.success('Depreciation run queued'), onError: () => toast.error('Failed to run depreciation') })}
                    >
                        Run Depreciation
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader><h2 className="text-lg font-semibold">Overview</h2></CardHeader>
                    <CardContent>
                        <dl className="space-y-3 text-sm">
                            {rows.map(([k, v]) => (
                                <div key={k} className="flex justify-between gap-4">
                                    <dt className="text-muted-foreground">{k}</dt>
                                    <dd className="font-medium text-right">{v}</dd>
                                </div>
                            ))}
                        </dl>
                    </CardContent>
                </Card>
                <div className="lg:col-span-2">
                    <AssetLifecycleTabs org={org} assetId={assetId} />
                </div>
            </div>
        </div>
    );
}

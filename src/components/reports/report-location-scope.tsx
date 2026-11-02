'use client';

// Location scope shared by the stock movement reports (Deadstock, Fast Moving): the top-nav outlet
// narrows a report to that outlet's own locations, and the picker drills into one location. Stock
// and movement both come from the scoped locations (inventory-api resolveReportScope).

import { Card, CardContent } from '@/components/ui/base';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { useWarehouses } from '@/hooks/useWarehouses';
import type { ReportLocationScope } from '@/lib/api/reports';
import { useOutletFilterStore } from '@/store/outlet-filter';
import { MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const ALL_LOCATIONS_ID = '__all__';

export interface ReportLocation {
    /** What to send to the report endpoint (and its document export). */
    scope: ReportLocationScope;
    /** The picked location's or the selected outlet's name; undefined for every location. */
    scopeName?: string;
    picker: ReportLocationPickerProps;
}

interface ReportLocationPickerProps {
    value: string;
    onChange: (id: string) => void;
    options: { id: string; name: string }[];
    allLabel: string;
    outletName?: string;
    scoped: boolean;
}

export function useReportLocation(org: string): ReportLocation {
    const selectedOutlet = useOutletFilterStore((s) => s.selectedOutlet);
    const outletId = selectedOutlet?.id;
    const { data: warehouses } = useWarehouses(org);
    const [warehouseId, setWarehouseId] = useState('');
    // A location picked under another outlet no longer applies once the outlet changes.
    useEffect(() => { setWarehouseId(''); }, [outletId]);

    const allLabel = selectedOutlet ? `All ${selectedOutlet.name} locations` : 'All Locations';
    const options = useMemo(
        () => [
            { id: ALL_LOCATIONS_ID, name: allLabel },
            ...(warehouses ?? [])
                .filter((w) => !outletId || w.outlet_id === outletId)
                .map((w) => ({ id: w.id, name: w.name })),
        ],
        [warehouses, outletId, allLabel],
    );
    const scopedWarehouseId = warehouseId && warehouseId !== ALL_LOCATIONS_ID ? warehouseId : undefined;
    const scope = useMemo(() => ({ outletId, warehouseId: scopedWarehouseId }), [outletId, scopedWarehouseId]);
    const scopeName = scopedWarehouseId ? options.find((o) => o.id === scopedWarehouseId)?.name : selectedOutlet?.name;

    return {
        scope,
        scopeName,
        picker: {
            value: warehouseId || ALL_LOCATIONS_ID,
            onChange: (v) => setWarehouseId(v === ALL_LOCATIONS_ID ? '' : v),
            options,
            allLabel,
            outletName: selectedOutlet?.name,
            scoped: !!scopedWarehouseId,
        },
    };
}

export function ReportLocationPicker({ value, onChange, options, allLabel, outletName, scoped, noun }: ReportLocationPickerProps & {
    /** What the report shows, for the hint, e.g. "idle stock". */
    noun: string;
}) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="w-full sm:w-64">
                        <CreatableSelect value={value} onChange={onChange} options={options} placeholder={allLabel} required />
                    </div>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                        {scoped
                            ? `Showing ${noun} at this location only.`
                            : outletName
                                ? `Showing every location of ${outletName}. Pick one to see that location alone.`
                                : `Showing every location together. Pick one to see that location alone.`}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

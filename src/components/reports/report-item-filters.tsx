'use client';

// Item filters shared by the stock reports (Stock Valuation, Deadstock, Fast Moving): category,
// brand and a name/SKU search, plus the page of listed lines. inventory-api applies them in SQL,
// so totals and KPIs follow the filter too.

import { Button, Card, CardContent } from '@/components/ui/base';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { useBrands } from '@/hooks/useBrands';
import { useCategories } from '@/hooks/useCategories';
import type { ReportItemFilters } from '@/lib/api/reports';
import { ChevronLeft, ChevronRight, Filter, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const ALL = '__all__';

export interface ReportItemFilterState {
    filters: ReportItemFilters;
    bar: ReportItemFilterBarProps;
    /** Moves to another page of lines. */
    setOffset: (offset: number) => void;
}

interface ReportItemFilterBarProps {
    org: string;
    categoryId: string;
    brandId: string;
    search: string;
    onCategory: (id: string) => void;
    onBrand: (id: string) => void;
    onSearch: (q: string) => void;
    onClear: () => void;
}

export function useReportItemFilters(org: string, pageSize: number): ReportItemFilterState {
    const [categoryId, setCategoryId] = useState('');
    const [brandId, setBrandId] = useState('');
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [offset, setOffset] = useState(0);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(search), 350);
        return () => clearTimeout(t);
    }, [search]);
    // Any filter change starts again from the first page.
    useEffect(() => { setOffset(0); }, [categoryId, brandId, debounced]);

    const filters = useMemo<ReportItemFilters>(
        () => ({ categoryId: categoryId || undefined, brandId: brandId || undefined, search: debounced || undefined, offset, limit: pageSize }),
        [categoryId, brandId, debounced, offset, pageSize],
    );
    return {
        filters,
        setOffset,
        bar: {
            org, categoryId, brandId, search,
            onCategory: (v) => setCategoryId(v === ALL ? '' : v),
            onBrand: (v) => setBrandId(v === ALL ? '' : v),
            onSearch: setSearch,
            onClear: () => { setCategoryId(''); setBrandId(''); setSearch(''); },
        },
    };
}

export function ReportItemFilterBar({ org, categoryId, brandId, search, onCategory, onBrand, onSearch, onClear }: ReportItemFilterBarProps) {
    const { data: categories } = useCategories(org);
    const { data: brands } = useBrands(org);
    const categoryOptions = useMemo(
        () => [{ id: ALL, name: 'All categories' }, ...((categories ?? []) as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name }))],
        [categories],
    );
    const brandOptions = useMemo(
        () => [{ id: ALL, name: 'All brands' }, ...(brands ?? []).map((b) => ({ id: b.id, name: b.name }))],
        [brands],
    );
    const active = !!(categoryId || brandId || search);
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                    <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="w-full sm:w-56">
                        <CreatableSelect value={categoryId || ALL} onChange={onCategory} options={categoryOptions} placeholder="All categories" required />
                    </div>
                    <div className="w-full sm:w-56">
                        <CreatableSelect value={brandId || ALL} onChange={onBrand} options={brandOptions} placeholder="All brands" required />
                    </div>
                    <label className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => onSearch(e.target.value)}
                            placeholder="Search name or SKU"
                            aria-label="Search name or SKU"
                            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm"
                        />
                    </label>
                    {active && (
                        <Button variant="ghost" size="sm" onClick={onClear}>
                            <X className="h-4 w-4 mr-1" /> Clear filters
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

/** Previous / next controls for a report list paged by offset and limit. */
export function ReportPager({ offset, limit, total, shown, onOffset }: {
    offset: number; limit: number; total: number; shown: number; onOffset: (o: number) => void;
}) {
    if (total <= limit) return null;
    const from = total === 0 ? 0 : offset + 1;
    const to = offset + shown;
    return (
        <div className="flex items-center justify-end gap-2 px-4 py-3 text-sm text-muted-foreground">
            <span className="tabular-nums">{from} to {to} of {total}</span>
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => onOffset(Math.max(0, offset - limit))} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={to >= total} onClick={() => onOffset(offset + limit)} aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
}

'use client';

import { Header } from '@/components/header';
import { Sidebar } from '@/components/sidebar';
import { AuthProvider } from '@/providers/auth-provider';
import { BrandingProvider } from '@/providers/branding-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { Footer } from '@/components/footer';

export default function OrgLayout({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30_000,
                retry: 1,
            },
        },
    }));
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <BrandingProvider>
                    <div className="flex h-screen overflow-hidden bg-background">
                    <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                        <Header onMenuClick={() => setSidebarOpen(true)} />
                        <main className="flex-1 overflow-y-auto bg-accent/5">
                            <div className="min-h-full flex flex-col">
                                <div className="flex-1">{children}</div>
                                <Footer />
                            </div>
                        </main>
                    </div>
                </div>
                </BrandingProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}

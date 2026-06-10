import { create } from "zustand";
import type { LimitReachedInfo } from "@/lib/api/error-handler";

interface LimitModalState {
  open: boolean;
  info: LimitReachedInfo | null;
  show: (info: LimitReachedInfo) => void;
  close: () => void;
}

/**
 * Global limit-reached modal state, triggered imperatively from the API 402 interceptor
 * so any failed mutation (warehouse/SKU/supplier cap) surfaces the same modal.
 */
export const useLimitModal = create<LimitModalState>((set) => ({
  open: false,
  info: null,
  show: (info) => set({ open: true, info }),
  close: () => set({ open: false, info: null }),
}));

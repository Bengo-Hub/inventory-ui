import { apiClient } from './client';

// Mirrors inventory-api internal/modules/tickets + the Ticket Ent entity.

export interface Ticket {
  id: string;
  tenant_id: string;
  event_item_id: string;
  order_id?: string | null;
  tier_id?: string;
  tier_name?: string;
  buyer_id?: string | null;
  buyer_name?: string;
  buyer_email?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  code: string;
  status: 'issued' | 'redeemed' | 'cancelled' | 'refunded' | 'void';
  valid_from?: string | null;
  valid_until?: string | null;
  redeemed_at?: string | null;
  redeemed_by?: string | null;
  check_in_location?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TierAvailability {
  tier_id: string;
  name: string;
  price: number;
  capacity: number;
  issued: number;
  remaining: number;
}

export interface EventAvailability {
  event_item_id: string;
  total_capacity: number;
  booked_capacity: number;
  remaining: number;
  tiers: TierAvailability[];
}

export interface IssueTicketInput {
  event_item_id: string;
  order_id?: string;
  tier_id?: string;
  tier_name?: string;
  buyer_id?: string;
  buyer_name?: string;
  buyer_email?: string;
  quantity?: number;
  unit_price?: number;
  currency?: string;
  valid_from?: string;
  valid_until?: string;
  metadata?: Record<string, unknown>;
}

export interface RedeemTicketInput {
  redeemed_by?: string;
  check_in_location?: string;
}

interface PaginatedTickets {
  data: Ticket[];
  total: number;
  page?: number;
  limit?: number;
}

function base(orgSlug: string) {
  return `/api/v1/${orgSlug}/inventory`;
}

export const ticketsApi = {
  eventAvailability: (orgSlug: string, eventId: string) =>
    apiClient.get<EventAvailability>(`${base(orgSlug)}/events/${eventId}/availability`),

  list: (orgSlug: string, params?: { event_item_id?: string; status?: string; buyer_id?: string; page?: number; limit?: number }) =>
    apiClient.get<PaginatedTickets>(`${base(orgSlug)}/tickets`, params as Record<string, string | number | undefined>),

  getByCode: (orgSlug: string, code: string) =>
    apiClient.get<Ticket>(`${base(orgSlug)}/tickets/${code}`),

  issue: (orgSlug: string, data: IssueTicketInput) =>
    apiClient.post<Ticket>(`${base(orgSlug)}/tickets`, data),

  redeem: (orgSlug: string, code: string, data?: RedeemTicketInput) =>
    apiClient.post<Ticket>(`${base(orgSlug)}/tickets/${code}/redeem`, data ?? {}),

  cancel: (orgSlug: string, id: string) =>
    apiClient.post<Ticket>(`${base(orgSlug)}/tickets/${id}/cancel`, {}),
};

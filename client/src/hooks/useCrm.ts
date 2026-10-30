import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  customersApi, followUpsApi, inquiriesApi,
  type CustomerQuery, type FollowUpQuery, type InquiryQuery,
} from '@/api/crm'
import type {
  CustomerInput, CustomerPatch, FollowUpInput, FollowUpPatch, Inquiry, InquiryCreateInput, InquiryPatch, InquiryStage,
  TripConversionInput,
} from '@/api/crmTypes'
import { useToday } from '@/hooks/useToday'
import { tripKeys } from '@/hooks/useTrips'

export const crmKeys = {
  all: ['crm'] as const,
  customers: (params: CustomerQuery) => ['crm', 'customers', params] as const,
  customer: (id: string) => ['crm', 'customer', id] as const,
  events: (id: string) => ['crm', 'events', id] as const,
  board: (params: InquiryQuery) => ['crm', 'inquiries', 'all', params] as const,
  inquiry: (id: string) => ['crm', 'inquiry', id] as const,
  followUps: (params: FollowUpQuery) => ['crm', 'follow-ups', params] as const,
  followUpSummary: (today: string) => ['crm', 'follow-up-summary', today] as const,
}

// ─── Customers ──────────────────────────────────────────────────────────────

export function useCustomers(params: CustomerQuery) {
  return useQuery({
    queryKey: crmKeys.customers(params),
    queryFn: ({ signal }) => customersApi.list(params, signal),
    placeholderData: keepPreviousData,
  })
}

/** Every active customer, for the pickers that choose one. */
export function useCustomerOptions() {
  return useQuery({
    queryKey: crmKeys.customers({ status: 'active', sort: 'name_asc', page_size: 100 }),
    queryFn: ({ signal }) => customersApi.list({ status: 'active', sort: 'name_asc', page_size: 100 }, signal),
    select: (data) => ({ items: data.items, truncated: data.total > data.items.length }),
  })
}

export function useCustomer(id: string | null) {
  const today = useToday()
  return useQuery({
    queryKey: [...crmKeys.customer(id ?? ''), today],
    queryFn: ({ signal }) => customersApi.get(id as string, today, signal),
    enabled: Boolean(id),
  })
}

export function useCustomerEvents(id: string | null) {
  return useInfiniteQuery({
    queryKey: crmKeys.events(id ?? ''),
    queryFn: ({ pageParam, signal }) => customersApi.events(id as string, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.total_pages ? last.page + 1 : undefined),
    enabled: Boolean(id),
  })
}

/** What a change to a customer touches: the directory, the 360 view, the pipeline and the follow-ups. */
function useRefreshCrm() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: crmKeys.all })
}

export function useCreateCustomer() {
  const refresh = useRefreshCrm()
  return useMutation({
    mutationFn: (input: CustomerInput) => customersApi.create(input),
    onSuccess: () => void refresh(),
  })
}

export function useUpdateCustomer() {
  const refresh = useRefreshCrm()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CustomerPatch }) => customersApi.update(id, patch),
    onSuccess: () => void refresh(),
  })
}

export function useDeleteCustomer() {
  const refresh = useRefreshCrm()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => customersApi.remove(id),
    onSuccess: () => {
      void refresh()
      // Their trips stay, but no longer belong to anyone.
      void queryClient.invalidateQueries({ queryKey: tripKeys.all })
    },
  })
}

export function useAddNote() {
  const refresh = useRefreshCrm()
  return useMutation({
    mutationFn: ({ customerId, summary, inquiryId }: { customerId: string; summary: string; inquiryId?: string }) =>
      customersApi.addNote(customerId, summary, inquiryId),
    onSuccess: () => void refresh(),
  })
}

// ─── Inquiries ──────────────────────────────────────────────────────────────

const BOARD_PAGE_SIZE = 100 // the API's maximum
const BOARD_MAX_PAGES = 10 // a safety stop at 1,000 inquiries

/**
 * Every inquiry that matches the filters. A Kanban board with half a column would mislead, so this reads the
 * paginated endpoint to the end.
 */
export function useAllInquiries(params: Omit<InquiryQuery, 'page' | 'page_size'>) {
  return useQuery({
    queryKey: crmKeys.board(params),
    queryFn: async ({ signal }) => {
      const items: Inquiry[] = []
      let page = 1
      let totalPages = 1
      do {
        const result = await inquiriesApi.list({ ...params, page, page_size: BOARD_PAGE_SIZE }, signal)
        items.push(...result.items)
        totalPages = result.total_pages
        page += 1
      } while (page <= totalPages && page <= BOARD_MAX_PAGES)
      return { items, truncated: page - 1 < totalPages }
    },
    placeholderData: keepPreviousData,
  })
}

export function useInquiry(id: string | null) {
  const today = useToday()
  return useQuery({
    queryKey: [...crmKeys.inquiry(id ?? ''), today],
    queryFn: ({ signal }) => inquiriesApi.get(id as string, today, signal),
    enabled: Boolean(id),
  })
}

export function useCreateInquiry() {
  const refresh = useRefreshCrm()
  const today = useToday()
  return useMutation({
    mutationFn: (input: InquiryCreateInput) => inquiriesApi.create(input, today),
    onSuccess: () => void refresh(),
  })
}

export function useUpdateInquiry() {
  const refresh = useRefreshCrm()
  const today = useToday()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: InquiryPatch }) => inquiriesApi.update(id, patch, today),
    onSuccess: () => void refresh(),
  })
}

export function useDeleteInquiry() {
  const refresh = useRefreshCrm()
  return useMutation({
    mutationFn: (id: string) => inquiriesApi.remove(id),
    onSuccess: () => void refresh(),
  })
}

type BoardData = { items: Inquiry[]; truncated: boolean }

/**
 * Moves an inquiry to another stage. The card moves on screen at once and goes back if the server says no,
 * so a drag feels immediate without ever showing a stage the server didn't accept.
 */
export function useMoveInquiry() {
  const queryClient = useQueryClient()
  const refresh = useRefreshCrm()
  const today = useToday()
  return useMutation({
    mutationFn: ({ id, stage, reason }: { id: string; stage: InquiryStage; reason?: string }) =>
      inquiriesApi.moveTo(id, stage, today, reason),
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ['crm', 'inquiries', 'all'] })
      const snapshots = queryClient.getQueriesData<BoardData>({ queryKey: ['crm', 'inquiries', 'all'] })
      queryClient.setQueriesData<BoardData>({ queryKey: ['crm', 'inquiries', 'all'] }, (data) =>
        data && { ...data, items: data.items.map((i) => (i.id === id ? { ...i, stage } : i)) },
      )
      return { snapshots }
    },
    onError: (_error, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSettled: () => void refresh(),
  })
}

export function useConvertInquiry() {
  const queryClient = useQueryClient()
  const refresh = useRefreshCrm()
  const today = useToday()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TripConversionInput }) => inquiriesApi.convert(id, input, today),
    onSuccess: ({ trip }) => {
      queryClient.setQueryData(tripKeys.detail(trip.id), trip)
      void queryClient.invalidateQueries({ queryKey: tripKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['owner'] })
      void refresh()
    },
  })
}

// ─── Follow-ups ─────────────────────────────────────────────────────────────

export function useFollowUps(params: FollowUpQuery) {
  return useQuery({
    queryKey: crmKeys.followUps(params),
    queryFn: ({ signal }) => followUpsApi.list(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useFollowUpSummary() {
  const today = useToday()
  return useQuery({
    queryKey: crmKeys.followUpSummary(today),
    queryFn: ({ signal }) => followUpsApi.summary(today, signal),
  })
}

export function useCreateFollowUp() {
  const refresh = useRefreshCrm()
  const today = useToday()
  return useMutation({
    mutationFn: (input: FollowUpInput) => followUpsApi.create(input, today),
    onSuccess: () => void refresh(),
  })
}

export function useUpdateFollowUp() {
  const refresh = useRefreshCrm()
  const today = useToday()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: FollowUpPatch }) => followUpsApi.update(id, patch, today),
    onSuccess: () => void refresh(),
  })
}

export function useDeleteFollowUp() {
  const refresh = useRefreshCrm()
  return useMutation({
    mutationFn: (id: string) => followUpsApi.remove(id),
    onSuccess: () => void refresh(),
  })
}

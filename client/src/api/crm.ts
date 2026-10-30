import { request } from './http'
import type {
  ContactMethod, ConversionResult, CrmEvent, CustomerDetail, CustomerInput, CustomerPatch, CustomerSummary,
  FollowUp, FollowUpInput, FollowUpPatch, FollowUpSummary, FollowUpView, Inquiry, InquiryCreateInput, InquiryDetail,
  InquiryPatch, InquiryStage, Paginated, TripConversionInput,
} from './crmTypes'

function toQuery(params: object): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

const id = encodeURIComponent

export type CustomerSort = 'name_asc' | 'name_desc' | 'newest' | 'activity_desc' | 'inquiries_desc'
export type InquirySort = 'updated_desc' | 'created_desc' | 'destination_asc' | 'budget_desc' | 'start_asc'

export interface CustomerQuery {
  q?: string
  status?: 'active' | 'archived' | 'all'
  has_open_inquiry?: boolean
  has_trips?: boolean
  preferred_contact?: ContactMethod
  sort?: CustomerSort
  page?: number
  page_size?: number
}

export interface InquiryQuery {
  q?: string
  stage?: InquiryStage
  customer_id?: string
  sort?: InquirySort
  page?: number
  page_size?: number
}

export interface FollowUpQuery {
  view?: FollowUpView
  today?: string
  customer_id?: string
  inquiry_id?: string
  page?: number
  page_size?: number
}

export const customersApi = {
  list: (params: CustomerQuery, signal?: AbortSignal) =>
    request<Paginated<CustomerSummary>>(`/customers${toQuery(params)}`, { signal }),
  get: (customerId: string, today: string, signal?: AbortSignal) =>
    request<CustomerDetail>(`/customers/${id(customerId)}${toQuery({ today })}`, { signal }),
  create: (input: CustomerInput) => request<CustomerDetail>('/customers', { method: 'POST', body: input }),
  update: (customerId: string, patch: CustomerPatch) =>
    request<CustomerDetail>(`/customers/${id(customerId)}`, { method: 'PATCH', body: patch }),
  remove: (customerId: string) => request<void>(`/customers/${id(customerId)}`, { method: 'DELETE' }),
  events: (customerId: string, page: number, signal?: AbortSignal) =>
    request<Paginated<CrmEvent>>(`/customers/${id(customerId)}/events${toQuery({ page, page_size: 30 })}`, { signal }),
  addNote: (customerId: string, summary: string, inquiryId?: string) =>
    request<CrmEvent>(`/customers/${id(customerId)}/notes`, {
      method: 'POST',
      body: { summary, ...(inquiryId && { inquiry_id: inquiryId }) },
    }),
}

export const inquiriesApi = {
  list: (params: InquiryQuery, signal?: AbortSignal) =>
    request<Paginated<Inquiry>>(`/inquiries${toQuery(params)}`, { signal }),
  get: (inquiryId: string, today: string, signal?: AbortSignal) =>
    request<InquiryDetail>(`/inquiries/${id(inquiryId)}${toQuery({ today })}`, { signal }),
  create: (input: InquiryCreateInput, today: string) =>
    request<InquiryDetail>(`/inquiries${toQuery({ today })}`, { method: 'POST', body: input }),
  update: (inquiryId: string, patch: InquiryPatch, today: string) =>
    request<InquiryDetail>(`/inquiries/${id(inquiryId)}${toQuery({ today })}`, { method: 'PATCH', body: patch }),
  remove: (inquiryId: string) => request<void>(`/inquiries/${id(inquiryId)}`, { method: 'DELETE' }),
  moveTo: (inquiryId: string, stage: InquiryStage, today: string, reason?: string) =>
    request<InquiryDetail>(`/inquiries/${id(inquiryId)}/stage${toQuery({ today })}`, {
      method: 'POST',
      body: { stage, ...(reason && { reason }) },
    }),
  convert: (inquiryId: string, input: TripConversionInput, today: string) =>
    request<ConversionResult>(`/inquiries/${id(inquiryId)}/convert${toQuery({ today })}`, { method: 'POST', body: input }),
}

export const followUpsApi = {
  list: (params: FollowUpQuery, signal?: AbortSignal) =>
    request<Paginated<FollowUp>>(`/follow-ups${toQuery(params)}`, { signal }),
  summary: (today: string, signal?: AbortSignal) =>
    request<FollowUpSummary>(`/follow-ups/summary${toQuery({ today })}`, { signal }),
  create: (input: FollowUpInput, today: string) =>
    request<FollowUp>(`/follow-ups${toQuery({ today })}`, { method: 'POST', body: input }),
  update: (followUpId: string, patch: FollowUpPatch, today: string) =>
    request<FollowUp>(`/follow-ups/${id(followUpId)}${toQuery({ today })}`, { method: 'PATCH', body: patch }),
  remove: (followUpId: string) => request<void>(`/follow-ups/${id(followUpId)}`, { method: 'DELETE' }),
}

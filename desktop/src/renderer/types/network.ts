export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE'

export type RequestStatus = 'pending' | 'completed' | 'error' | 'cancelled' | 'timeout'

export type RequestSource = 'fetch' | 'xhr'

export interface NetworkRequest {
  id: string
  method: HttpMethod
  url: string
  requestHeaders: Record<string, string>
  requestBody: unknown
  responseHeaders: Record<string, string>
  responseBody: unknown
  statusCode: number | null
  duration: number | null
  responseSize: number | null
  startTime: number
  endTime: number | null
  status: RequestStatus
  error: string | null
  source: RequestSource
}

export interface NetworkRequestStartPayload {
  id: string
  method: HttpMethod
  url: string
  requestHeaders: Record<string, string>
  requestBody: unknown
  startTime: number
  source: RequestSource
}

export interface NetworkRequestEndPayload {
  id: string
  statusCode: number
  responseHeaders: Record<string, string>
  responseBody: unknown
  responseSize: number | null
  endTime: number
  duration: number
}

export interface NetworkRequestErrorPayload {
  id: string
  error: string
  endTime: number
  duration: number
}

export type MethodFilter = HttpMethod | 'ALL'
export type StatusFilter = 'ALL' | '2xx' | '3xx' | '4xx' | '5xx'

export interface NetworkFilter {
  method: MethodFilter
  status: StatusFilter
  search: string
  onlyErrors: boolean
}

export interface NetworkStats {
  total: number
  completed: number
  failed: number
  pending: number
  avgDuration: number
  totalSize: number
}

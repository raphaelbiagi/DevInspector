export const MAX_NETWORK_LOGS = 2000
export const MAX_CONSOLE_LOGS = 5000
export const MAX_BODY_PREVIEW_LENGTH = 500
export const SERVER_PORT = 8347

export const HTTP_METHODS = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const
export const STATUS_FILTERS = ['ALL', '2xx', '3xx', '4xx', '5xx'] as const
export const LOG_LEVELS = ['log', 'info', 'warn', 'error', 'table'] as const

export const TAB_NETWORK = 'network' as const
export const TAB_CONSOLE = 'console' as const
export const TAB_INSIGHTS = 'insights' as const
export const TAB_DATABASE = 'database' as const
export type TabId = typeof TAB_NETWORK | typeof TAB_CONSOLE | typeof TAB_INSIGHTS | typeof TAB_DATABASE

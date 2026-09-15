import React from 'react'
import { NetworkRequest } from '../../types/network'
import { getMethodColor, getStatusColor, formatDuration, formatBytes, truncateUrl } from '../../utils/formatters'
import { Pin, GitCompare } from 'lucide-react'
import { useNetworkStore } from '../../stores/networkStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { extractGraphQLInfo } from '../../utils/graphql'

interface RequestRowProps {
  request: NetworkRequest
  isSelected: boolean
  onClick: () => void
}

export const RequestRow: React.FC<RequestRowProps> = ({ request, isSelected, onClick }) => {
  const graphql = React.useMemo(() => extractGraphQLInfo(request), [request])
  // GraphQL responde 200 mesmo em falha — o erro vive no corpo
  const isError =
    request.status === 'error' ||
    (request.statusCode !== null && request.statusCode >= 400) ||
    !!graphql?.errors?.length
  const isPinned = useNetworkStore(state => state.pinnedIds.includes(request.id))
  const togglePin = useNetworkStore(state => state.togglePin)
  const hasDiff = useTimelineStore(state => state.diffs.has(request.id))

  return (
    <div 
      className={`request-row ${isSelected ? 'selected' : ''} ${isError ? 'error' : ''} ${request.status === 'pending' ? 'pending' : ''}`}
      onClick={onClick}
    >
      <div className="request-status" style={{ color: getStatusColor(request.statusCode) }}>
        {request.status === 'pending' ? (
          <span className="animate-pulse">⏳</span>
        ) : request.statusCode ? (
          request.statusCode
        ) : (
          'ERR'
        )}
      </div>
      
      <div className="request-method" style={{ color: getMethodColor(request.method) }}>
        {request.method}
      </div>
      
      <div className="request-url" title={request.url} style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
        <button 
          onClick={(e) => { e.stopPropagation(); togglePin(request.id); }}
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            color: isPinned ? 'var(--color-accent)' : 'var(--color-text-muted)',
            opacity: isPinned ? 1 : 0.3,
            padding: 2,
            display: 'flex',
            flexShrink: 0
          }}
          title={isPinned ? "Desfavoritar" : "Favoritar (Fixar no topo)"}
        >
          <Pin size={12} />
        </button>
        {hasDiff && (
          <span
            title="Difere da chamada anterior desta rota"
            style={{ display: 'flex', flexShrink: 0, color: 'var(--color-warning)', opacity: 0.8 }}
          >
            <GitCompare size={12} />
          </span>
        )}
        {graphql && (
          <span
            title={`GraphQL ${graphql.operationType}`}
            style={{
              flexShrink: 0,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.5px',
              padding: '1px 4px',
              borderRadius: 3,
              color: '#E535AB',
              border: '1px solid rgba(229, 53, 171, 0.4)'
            }}
          >
            GQL
          </span>
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {graphql ? graphql.operationName : truncateUrl(request.url, 100)}
        </span>
      </div>
      
      <div className="request-duration">
        {formatDuration(request.duration)}
      </div>
      
      <div className="request-size">
        {formatBytes(request.responseSize)}
      </div>
    </div>
  )
}

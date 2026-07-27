import React from 'react'
import { NetworkRequest } from '../../types/network'
import { getMethodColor, getStatusColor, formatDuration, formatBytes, truncateUrl } from '../../utils/formatters'
import { Pin } from 'lucide-react'
import { useNetworkStore } from '../../stores/networkStore'

interface RequestRowProps {
  request: NetworkRequest
  isSelected: boolean
  onClick: () => void
}

export const RequestRow: React.FC<RequestRowProps> = ({ request, isSelected, onClick }) => {
  const isError = request.status === 'error' || (request.statusCode !== null && request.statusCode >= 400)
  const isPinned = useNetworkStore(state => state.pinnedIds.includes(request.id))
  const togglePin = useNetworkStore(state => state.togglePin)
  
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
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {truncateUrl(request.url, 100)}
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

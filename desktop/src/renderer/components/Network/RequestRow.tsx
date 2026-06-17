import React from 'react'
import { NetworkRequest } from '../../types/network'
import { getMethodColor, getStatusColor, formatDuration, formatBytes, truncateUrl } from '../../utils/formatters'

interface RequestRowProps {
  request: NetworkRequest
  isSelected: boolean
  onClick: () => void
}

export const RequestRow: React.FC<RequestRowProps> = ({ request, isSelected, onClick }) => {
  const isError = request.status === 'error' || (request.statusCode !== null && request.statusCode >= 400)
  
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
      
      <div className="request-url" title={request.url}>
        {truncateUrl(request.url, 100)}
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

import React, { useState } from 'react'
import { NetworkRequest } from '../../types/network'
import { Tabs } from '../shared/Tabs'
import { JsonViewer } from '../shared/JsonViewer'
import { formatBytes, formatDuration, getMethodColor, getStatusColor } from '../../utils/formatters'

interface RequestDetailProps {
  request: NetworkRequest
  onClose: () => void
}

export const RequestDetail: React.FC<RequestDetailProps> = ({ request, onClose }) => {
  const [activeTab, setActiveTab] = useState('headers')

  const renderHeaders = (headers: Record<string, string>) => {
    if (!headers || Object.keys(headers).length === 0) {
      return <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No headers</div>
    }
    return (
      <div className="detail-section">
        {Object.entries(headers).map(([key, value]) => (
          <div key={key} className="detail-kv">
            <span className="detail-kv-key">{key}:</span>
            <span className="detail-kv-value">{value}</span>
          </div>
        ))}
      </div>
    )
  }

  const renderBody = (body: unknown) => {
    if (body === undefined || body === null || body === '') {
      return <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No body data</div>
    }
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body)
        return <JsonViewer data={parsed} />
      } catch {
        return <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>{body}</div>
      }
    }
    return <JsonViewer data={body} />
  }

  return (
    <div className="split-panel-right">
      <div className="detail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
          <span style={{ color: getStatusColor(request.statusCode) }}>
            {request.statusCode || 'ERR'}
          </span>
          <span style={{ color: getMethodColor(request.method) }}>
            {request.method}
          </span>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {request.url}
          </span>
        </div>
        <button className="btn-icon" onClick={onClose}>✕</button>
      </div>

      <Tabs
        tabs={[
          { id: 'headers', label: 'Headers' },
          { id: 'request', label: 'Request' },
          { id: 'response', label: 'Response' },
          { id: 'timing', label: 'Timing' }
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <div className="detail-content">
        {activeTab === 'headers' && (
          <>
            <div className="detail-section-title">General</div>
            <div className="detail-section">
              <div className="detail-kv"><span className="detail-kv-key">Request URL:</span><span className="detail-kv-value">{request.url}</span></div>
              <div className="detail-kv"><span className="detail-kv-key">Request Method:</span><span className="detail-kv-value">{request.method}</span></div>
              <div className="detail-kv"><span className="detail-kv-key">Status Code:</span><span className="detail-kv-value" style={{ color: getStatusColor(request.statusCode) }}>{request.statusCode || 'Pending/Failed'}</span></div>
              <div className="detail-kv"><span className="detail-kv-key">Source:</span><span className="detail-kv-value">{request.source}</span></div>
            </div>

            <div className="detail-section-title">Response Headers</div>
            {renderHeaders(request.responseHeaders)}

            <div className="detail-section-title">Request Headers</div>
            {renderHeaders(request.requestHeaders)}
          </>
        )}

        {activeTab === 'request' && (
          <>
            <div className="detail-section-title">Request Payload</div>
            {renderBody(request.requestBody)}
          </>
        )}

        {activeTab === 'response' && (
          <>
            <div className="detail-section-title">Response Data</div>
            {request.error ? (
              <div style={{ color: 'var(--color-error)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
                {request.error}
              </div>
            ) : request.status === 'pending' ? (
              <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Waiting for response...</div>
            ) : (
              renderBody(request.responseBody)
            )}
          </>
        )}

        {activeTab === 'timing' && (
          <>
            <div className="detail-section-title">Timing Info</div>
            <div className="detail-section">
              <div className="detail-kv"><span className="detail-kv-key">Start Time:</span><span className="detail-kv-value">{new Date(request.startTime).toLocaleTimeString()}</span></div>
              {request.endTime && <div className="detail-kv"><span className="detail-kv-key">End Time:</span><span className="detail-kv-value">{new Date(request.endTime).toLocaleTimeString()}</span></div>}
              <div className="detail-kv"><span className="detail-kv-key">Total Duration:</span><span className="detail-kv-value">{formatDuration(request.duration)}</span></div>
              <div className="detail-kv"><span className="detail-kv-key">Response Size:</span><span className="detail-kv-value">{formatBytes(request.responseSize)}</span></div>
            </div>
            
            {request.duration !== null && (
              <div style={{ marginTop: 24 }}>
                <div style={{ width: '100%', height: 20, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: 'var(--color-accent)', opacity: 0.8 }} />
                </div>
                <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {formatDuration(request.duration)} total
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

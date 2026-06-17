import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useNetworkStore } from '../../stores/networkStore'
import { getStatusColor, formatDuration } from '../../utils/formatters'

export const Timeline: React.FC = () => {
  const requests = useNetworkStore(useShallow((state) => state.getFilteredRequests()))

  if (requests.length === 0) return null

  // Find min start time and max end time to calculate scale
  let minStartTime = Infinity
  let maxEndTime = 0

  requests.forEach((req) => {
    if (req.startTime < minStartTime) minStartTime = req.startTime
    const end = req.endTime || (req.startTime + (req.duration || 100)) // fallback if pending
    if (end > maxEndTime) maxEndTime = end
  })

  // If we only have pending requests or very fast ones, give a minimum 1 second window
  const totalWindow = Math.max(1000, maxEndTime - minStartTime)

  return (
    <div className="timeline-container">
      {requests.map((req) => {
        const startOffset = Math.max(0, req.startTime - minStartTime)
        const duration = req.duration || (req.status === 'pending' ? Date.now() - req.startTime : 10)
        
        // Calculate percentages
        const leftPercent = (startOffset / totalWindow) * 100
        const widthPercent = Math.max(0.5, (duration / totalWindow) * 100) // At least 0.5% width to be visible

        return (
          <div key={req.id} className="timeline-row">
            <div className="timeline-label" title={req.url}>
              {req.url}
            </div>
            <div className="timeline-track">
              <div 
                className="timeline-bar tooltip-wrapper"
                style={{ 
                  position: 'absolute',
                  left: `${leftPercent}%`, 
                  width: `${widthPercent}%`,
                  background: getStatusColor(req.statusCode),
                  opacity: req.status === 'pending' ? 0.6 : 1
                }}
              >
                <div className="tooltip-text" style={{ bottom: '100%', top: 'auto', left: '50%', transform: 'translateX(-50%)', marginBottom: 4 }}>
                  {formatDuration(duration)}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

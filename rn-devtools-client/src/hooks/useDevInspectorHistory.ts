import { useState, useEffect } from 'react'
import { devToolsClient } from '../DevToolsClient'
import type { DevInspectorEvent } from '../types'

export function useDevInspectorHistory() {
  const [history, setHistory] = useState<DevInspectorEvent[]>([])

  useEffect(() => {
    // Initial load
    setHistory([...devToolsClient.getHistory()])

    // Subscribe to changes
    const unsubscribe = devToolsClient.subscribeHistory(() => {
      setHistory([...devToolsClient.getHistory()])
    })

    return unsubscribe
  }, [])

  return history
}

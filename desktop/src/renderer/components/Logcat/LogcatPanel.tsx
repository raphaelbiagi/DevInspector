import React, { useEffect } from 'react'
import { LogcatToolbar } from './LogcatToolbar'
import { LogcatList } from './LogcatList'
import { useLogcatStore } from '../../stores/logcatStore'
import { useConnectionStore } from '../../stores/connectionStore'

export const LogcatPanel: React.FC = () => {
  const clientInfo = useConnectionStore((state) => state.clientInfo)

  useEffect(() => {
    useLogcatStore.getState().refreshDevices()
  }, [])

  // O SDK informa o pacote no handshake; só preenche se o usuário ainda não
  // escolheu outro, para não sobrescrever um filtro digitado à mão.
  useEffect(() => {
    if (clientInfo?.platform !== 'android' || !clientInfo.packageName) return
    const { packageName, status, setPackageName } = useLogcatStore.getState()
    if (!packageName && !status.running) setPackageName(clientInfo.packageName)
  }, [clientInfo?.platform, clientInfo?.packageName])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <LogcatToolbar />
      <LogcatList />
    </div>
  )
}

import React from 'react'
import { ConsoleToolbar } from './ConsoleToolbar'
import { LogList } from './LogList'

export const ConsolePanel: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ConsoleToolbar />
      <LogList />
    </div>
  )
}

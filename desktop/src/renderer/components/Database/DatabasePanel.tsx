import React, { useEffect, useState } from 'react'
import { Database, Table as TableIcon, Play, RefreshCw, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { useDatabaseStore } from '../../stores/databaseStore'

export const DatabasePanel: React.FC = () => {
  const {
    databases, selectedDb, tables, selectedTable, tableData, queryResult,
    queryError, isLoading, fetchDatabases, selectDb, selectTable, executeQuery
  } = useDatabaseStore()

  const [customQuery, setCustomQuery] = useState('')

  useEffect(() => {
    fetchDatabases()
  }, [])

  const handleRunQuery = () => {
    if (customQuery.trim()) {
      executeQuery(customQuery)
    }
  }

  const renderTable = (data: { columns: string[], rows: any[] } | null) => {
    if (!data) return null
    if (data.rows.length === 0) return <div style={{ padding: 16, color: 'var(--color-text-dim)' }}>Tabela/Consulta vazia.</div>

    return (
      <div style={{ overflow: 'auto', maxHeight: '100%', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: 'var(--bg-active)', position: 'sticky', top: 0 }}>
            <tr>
              {data.columns.map(col => (
                <th key={col} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                {data.columns.map(col => (
                  <td key={col} style={{ padding: '8px 12px', color: 'var(--color-text-dim)', whiteSpace: 'nowrap' }}>
                    {row[col] !== null ? String(row[col]) : <span style={{ color: 'var(--color-warning)' }}>NULL</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      
      {/* Sidebar: DBs and Tables */}
      <div style={{ width: 280, borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><Database size={18} /> Bancos de Dados</span>
          <button onClick={() => fetchDatabases()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-accent)' }}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {databases.length === 0 && !isLoading && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--color-text-dim)', textAlign: 'center' }}>
              Nenhum banco retornado pelo App. Certifique-se de que o DatabaseDriver foi registrado.
            </div>
          )}
          {databases.map(db => (
            <div key={db}>
              <div 
                onClick={() => selectDb(selectedDb === db ? null : db)}
                title={db}
                style={{
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  background: selectedDb === db ? 'var(--bg-active)' : 'transparent',
                  color: selectedDb === db ? 'var(--color-accent)' : 'var(--color-text)',
                  fontWeight: selectedDb === db ? 600 : 400,
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {selectedDb === db ? <ChevronDown size={14} style={{ flexShrink: 0 }} /> : <ChevronRight size={14} style={{ flexShrink: 0 }} />}
                <Database size={14} style={{ flexShrink: 0 }} /> 
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {db}
                </span>
              </div>
              
              {selectedDb === db && (
                <div className="animate-fade-in" style={{ marginLeft: 16, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {tables.map(table => (
                    <div 
                      key={table}
                      onClick={() => selectTable(table)}
                      style={{
                        padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                        background: selectedTable === table ? 'var(--color-accent)' : 'transparent',
                        color: selectedTable === table ? '#fff' : 'var(--color-text-dim)',
                        fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      <TableIcon size={12} /> {table}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Area: SQL Editor and Data Grid */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', overflow: 'hidden' }}>
        
        {/* SQL Editor */}
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <textarea 
              value={customQuery}
              onChange={e => setCustomQuery(e.target.value)}
              placeholder="Digite sua query SQL aqui (ex: SELECT * FROM users)..."
              style={{
                flex: 1, height: 80, padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
                background: 'var(--bg-input)', color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: 13, resize: 'none'
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleRunQuery()
                }
              }}
            />
            <button 
              onClick={handleRunQuery}
              disabled={isLoading || !selectedDb || !customQuery.trim()}
              style={{
                padding: '0 24px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-accent)',
                color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                opacity: (isLoading || !selectedDb || !customQuery.trim()) ? 0.5 : 1
              }}
            >
              <Play size={16} /> Rodar (Ctrl+Enter)
            </button>
          </div>
          {queryError && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} /> {queryError}
            </div>
          )}
        </div>

        {/* Data Grid */}
        <div style={{ flex: 1, padding: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
            {queryResult ? 'Resultado da Consulta' : selectedTable ? `Dados da Tabela: ${selectedTable} (Top 100)` : 'Nenhum dado selecionado'}
          </div>
          
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {isLoading ? (
              <div className="animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-dim)', fontSize: 14, gap: 12 }}>
                <RefreshCw size={24} className="animate-spin" />
                <span>Carregando dados...</span>
              </div>
            ) : queryResult ? (
              <div className="animate-fade-in" style={{ height: '100%' }}>{renderTable(queryResult)}</div>
            ) : tableData ? (
              <div className="animate-fade-in" style={{ height: '100%' }}>{renderTable(tableData)}</div>
            ) : (
              <div className="animate-fade-in" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-dim)', fontSize: 14 }}>
                Selecione um banco de dados e uma tabela, ou execute uma query customizada.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

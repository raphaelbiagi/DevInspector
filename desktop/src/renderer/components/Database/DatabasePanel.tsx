import React, { useEffect, useState, useRef } from 'react'
import { Database, Table as TableIcon, Play, RefreshCw, AlertCircle, ChevronDown, ChevronRight, X, ChevronLeft, Save, Bookmark, Trash2, Loader2 } from 'lucide-react'
import { useDatabaseStore } from '../../stores/databaseStore'
import Editor from 'react-simple-code-editor'
import Prism from 'prismjs'
import 'prismjs/components/prism-sql'
import 'prismjs/themes/prism-tomorrow.css'

export const DatabasePanel: React.FC = () => {
  const {
    databases, selectedDb, tables, selectedTable, tableData, queryResult,
    queryError, isLoading, fetchDatabases, selectDb, selectTable, executeQuery,
    tableCurrentPage, tableTotalRows, tablePageSize, fetchTableData,
    savedQueries, saveQuery, loadSavedQueries, deleteQuery
  } = useDatabaseStore()

  const [customQuery, setCustomQuery] = useState('')
  const [expandedCell, setExpandedCell] = useState<string | null>(null)
  const [showSavedQueries, setShowSavedQueries] = useState(false)
  const [queryNameInput, setQueryNameInput] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchDatabases()
    loadSavedQueries()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSavedQueries(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleRunQuery = () => {
    let queryToRun = customQuery
    const selection = window.getSelection()?.toString()
    
    if (selection && selection.trim().length > 0 && customQuery.includes(selection)) {
      queryToRun = selection
    }

    if (queryToRun.trim()) {
      executeQuery(queryToRun)
    }
  }

  const handleDoubleClickCell = (value: any) => {
    if (value === null || value === undefined) return
    let displayValue = String(value)
    try {
      const parsed = JSON.parse(displayValue)
      if (typeof parsed === 'object') {
        displayValue = JSON.stringify(parsed, null, 2)
      }
    } catch (e) {
      // Not JSON
    }
    setExpandedCell(displayValue)
  }

  const handleSaveQuery = () => {
    if (!customQuery.trim() || !queryNameInput.trim()) return
    saveQuery(queryNameInput, customQuery)
    setQueryNameInput('')
  }

  const renderTable = (data: { columns: string[], rows: any[] } | null, isTable: boolean) => {
    if (!data) return null
    if (data.rows.length === 0) return <div style={{ padding: 16, color: 'var(--color-text-dim)' }}>Tabela/Consulta vazia.</div>

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ overflow: 'auto', flex: 1, background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, tableLayout: 'fixed' }}>
            <thead style={{ background: 'var(--bg-active)', position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                {data.columns.map(col => (
                  <th key={col} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', width: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {data.columns.map(col => (
                    <td 
                      key={col} 
                      onDoubleClick={() => handleDoubleClickCell(row[col])}
                      title="Duplo clique para expandir"
                      style={{ 
                        padding: '8px 12px', color: 'var(--color-text-dim)', 
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        maxWidth: 200, cursor: 'pointer'
                      }}
                    >
                      {row[col] !== null ? String(row[col]) : <span style={{ color: 'var(--color-warning)' }}>NULL</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Paginação (apenas para tabelas) */}
        {isTable && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 0', fontSize: 13, color: 'var(--color-text-dim)' }}>
            <div>Total: {tableTotalRows} registros</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button 
                disabled={tableCurrentPage <= 1}
                onClick={() => fetchTableData(tableCurrentPage - 1)}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--color-text)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', cursor: tableCurrentPage <= 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', opacity: tableCurrentPage <= 1 ? 0.5 : 1 }}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <span>Página {tableCurrentPage}</span>
              <button 
                disabled={tableCurrentPage * tablePageSize >= tableTotalRows}
                onClick={() => fetchTableData(tableCurrentPage + 1)}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--color-text)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', cursor: (tableCurrentPage * tablePageSize >= tableTotalRows) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', opacity: (tableCurrentPage * tablePageSize >= tableTotalRows) ? 0.5 : 1 }}
              >
                Próxima <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', position: 'relative' }}>
      
      {/* Sidebar: DBs and Tables */}
      <div style={{ width: 280, borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
        
        {/* SQL Editor */}
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Nome da query..." 
                value={queryNameInput}
                onChange={e => setQueryNameInput(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--color-text)', fontSize: 13 }}
              />
              <button 
                onClick={handleSaveQuery}
                disabled={!customQuery.trim() || !queryNameInput.trim()}
                style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-active)', color: 'var(--color-text)', fontSize: 13, cursor: (!customQuery.trim() || !queryNameInput.trim()) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: (!customQuery.trim() || !queryNameInput.trim()) ? 0.5 : 1 }}
              >
                <Save size={14} /> Salvar Query
              </button>
            </div>

            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <button 
                onClick={() => setShowSavedQueries(!showSavedQueries)}
                style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: showSavedQueries ? 'var(--color-accent)' : 'var(--bg-active)', color: showSavedQueries ? '#fff' : 'var(--color-text)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s ease' }}
              >
                <Bookmark size={14} /> Queries Salvas <ChevronDown size={14} style={{ transform: showSavedQueries ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
              </button>
              
              {showSavedQueries && (
                <>
                  <style>{`
                    @keyframes dropdownSlide {
                      from { opacity: 0; transform: translateY(-8px) scale(0.98); }
                      to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    .animate-dropdown {
                      animation: dropdownSlide 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                      transform-origin: top right;
                    }
                    .saved-query-item {
                      transition: all 0.2s ease;
                    }
                    .saved-query-item:hover {
                      background: var(--bg-hover);
                    }
                    .saved-query-btn {
                      opacity: 0;
                      transform: translateX(10px);
                      transition: all 0.2s ease;
                    }
                    .saved-query-item:hover .saved-query-btn {
                      opacity: 1;
                      transform: translateX(0);
                    }
                  `}</style>
                  <div className="animate-dropdown" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 12, width: 340, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', boxShadow: '0 16px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)', zIndex: 10, maxHeight: 350, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', borderTopLeftRadius: 'var(--radius-md)', borderTopRightRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Suas Queries</span>
                      <span style={{ fontSize: 11, background: 'var(--color-accent-dim)', color: 'var(--color-accent)', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>{savedQueries.length}</span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {savedQueries.length === 0 ? (
                        <div style={{ padding: 24, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                          <Bookmark size={24} style={{ opacity: 0.2 }} />
                          Você ainda não tem queries salvas.
                        </div>
                      ) : (
                        savedQueries.map((sq, index) => (
                          <div 
                            key={sq.name} 
                            className="saved-query-item"
                            style={{ 
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                              padding: '12px 16px', cursor: 'pointer',
                              borderBottom: index < savedQueries.length - 1 ? '1px solid var(--border-color)' : 'none'
                            }}
                            onClick={() => { setCustomQuery(sq.query); setShowSavedQueries(false) }}
                          >
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
                              <span style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: 13 }}>{sq.name}</span>
                              <span style={{ color: 'var(--color-text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sq.query}</span>
                            </div>
                            <button 
                              className="saved-query-btn"
                              onClick={(e) => { e.stopPropagation(); deleteQuery(sq.name) }} 
                              style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', cursor: 'pointer', color: 'var(--color-error)', padding: 8, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <div style={{ flex: 1, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', overflow: 'hidden' }}>
              <Editor
                value={customQuery}
                onValueChange={setCustomQuery}
                highlight={code => Prism.highlight(code, Prism.languages.sql, 'sql')}
                padding={12}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  minHeight: 80,
                  color: 'var(--color-text)'
                }}
                textareaClassName="sql-editor-textarea"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleRunQuery()
                  }
                }}
              />
            </div>
            <button 
              onClick={handleRunQuery}
              disabled={isLoading || !selectedDb || !customQuery.trim()}
              style={{
                padding: '0 24px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-accent)',
                color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                opacity: (isLoading || !selectedDb || !customQuery.trim()) ? 0.5 : 1
              }}
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {isLoading ? 'Executando...' : 'Rodar (Ctrl+Enter)'}
            </button>
          </div>
          {queryError && (
            <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} /> {queryError}
            </div>
          )}
        </div>

        {/* Data Grid */}
        <div style={{ flex: 1, padding: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
            {queryResult ? 'Resultado da Consulta' : selectedTable ? `Dados da Tabela: ${selectedTable}` : 'Nenhum dado selecionado'}
          </div>
          
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {isLoading ? (
              <div className="animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-dim)', fontSize: 14, gap: 12 }}>
                <Loader2 size={24} className="animate-spin" />
                <span>Carregando dados...</span>
              </div>
            ) : queryResult ? (
              <div className="animate-fade-in" style={{ height: '100%' }}>{renderTable(queryResult, false)}</div>
            ) : tableData ? (
              <div className="animate-fade-in" style={{ height: '100%' }}>{renderTable(tableData, true)}</div>
            ) : (
              <div className="animate-fade-in" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-dim)', fontSize: 14 }}>
                Selecione um banco de dados e uma tabela, ou execute uma query customizada.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Expanded Cell Modal */}
      {expandedCell !== null && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 32 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 800, maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Detalhes do Valor</span>
              <button onClick={() => setExpandedCell(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-dim)' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 20, overflow: 'auto', flex: 1, background: 'var(--bg-primary)' }}>
              <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {expandedCell}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useState, useMemo } from 'react'
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, ScrollView, TextInput } from 'react-native'
import { Bug } from 'lucide-react-native'
import { useDevInspectorHistory } from '../hooks/useDevInspectorHistory'
import type { DevInspectorEvent } from '../types'

const formatBytes = (bytes?: number | null) => {
  if (bytes === null || bytes === undefined) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  else return (bytes / 1048576).toFixed(1) + ' MB'
}

export const DebuggerModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const history = useDevInspectorHistory()
  const [activeTab, setActiveTab] = useState<'network' | 'console'>('network')
  const [selectedEvent, setSelectedEvent] = useState<DevInspectorEvent | null>(null)
  const [detailTab, setDetailTab] = useState<'overview' | 'headers' | 'payload' | 'response'>('overview')
  const [searchUrl, setSearchUrl] = useState('')
  const [selectedMethods, setSelectedMethods] = useState<string[]>([])

  const filteredHistory = useMemo(() => {
    if (activeTab === 'network') {
      return history.filter(e => {
        if (e.type !== 'http:request' && e.type !== 'http:response') return false
        
        const p = e.payload as any
        const method = (p.method || '').toUpperCase()
        const url = (p.url || '').toLowerCase()
        
        if (selectedMethods.length > 0 && method && !selectedMethods.includes(method)) return false
        if (searchUrl && !url.includes(searchUrl.toLowerCase())) return false
        
        return true
      })
    }
    
    return history.filter(e => {
      if (e.type !== 'console:entry') return false
      if (!searchUrl) return true
      const p = e.payload as any
      const msg = String(p.message || '').toLowerCase()
      return msg.includes(searchUrl.toLowerCase())
    })
  }, [history, activeTab, searchUrl, selectedMethods])

  const renderNetworkItem = ({ item }: { item: DevInspectorEvent }) => {
    const isResponse = item.type === 'http:response'
    const payload = item.payload as any
    const method = payload.method || (isResponse ? 'RES' : 'REQ')
    const url = payload.url || `Req ID: ${payload.requestId?.substring(0, 8)}`
    const status = payload.statusCode
    const isError = status >= 400 || status === 0
    
    // Cores sutis para visual minimalista
    let methodColor = '#a1a1aa' // default (muted)
    if (method === 'GET') methodColor = '#4ade80' // pastel green
    else if (method === 'POST') methodColor = '#60a5fa' // pastel blue
    else if (method === 'PUT' || method === 'PATCH') methodColor = '#fbbf24' // pastel amber
    else if (method === 'DELETE') methodColor = '#f87171' // pastel red
    else if (isResponse) methodColor = '#c084fc' // pastel purple

    return (
      <TouchableOpacity 
        style={styles.row} 
        onPress={() => {
          setSelectedEvent(item)
          setDetailTab('overview')
        }}
      >
        <View style={styles.rowHeader}>
          <View style={styles.badge}>
            <Text style={[styles.method, { color: methodColor }]}>{method}</Text>
          </View>
          <Text style={styles.url} numberOfLines={1} ellipsizeMode="tail">{url}</Text>
        </View>
        <View style={styles.rowFooter}>
          {status !== undefined && (
            <Text style={[styles.status, { color: isError ? '#EF5350' : '#00E676' }]}>
              {status === 0 ? 'FAIL' : status}
            </Text>
          )}
          {payload.duration !== undefined && <Text style={styles.meta}>{payload.duration}ms</Text>}
          {payload.size !== undefined && <Text style={styles.meta}>{formatBytes(payload.size)}</Text>}
        </View>
      </TouchableOpacity>
    )
  }

  const renderConsoleItem = ({ item }: { item: DevInspectorEvent }) => {
    const payload = item.payload as any
    const isError = payload.level === 'error' || payload.level === 'fatal'
    const isWarn = payload.level === 'warn'
    
    const color = isError ? '#FF5252' : isWarn ? '#FFD740' : '#4CA1AF'
    const bg = isError ? 'rgba(255, 82, 82, 0.08)' : isWarn ? 'rgba(255, 215, 64, 0.08)' : '#1E1E1E'
    const borderColor = isError ? 'rgba(255, 82, 82, 0.3)' : isWarn ? 'rgba(255, 215, 64, 0.3)' : '#2C2C2C'
    
    return (
      <TouchableOpacity 
        style={[styles.row, { backgroundColor: bg, borderColor: borderColor, borderWidth: 1, padding: 10 }]}
        onPress={() => {
          setSelectedEvent(item)
          setDetailTab('overview')
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
          <View style={{ backgroundColor: color + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
            <Text style={{ color, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>
              {payload.level || 'log'}
            </Text>
          </View>
          <Text style={{ color: '#888', fontSize: 10 }}>
            {new Date(payload.timestamp).toLocaleTimeString()}
          </Text>
        </View>

        <Text style={[styles.logText, { color: isError || isWarn ? color : '#E0E0E0' }]} numberOfLines={3}>
          {payload.message || JSON.stringify(payload.args)}
        </Text>
        
        {isError && payload.stackTrace && (
          <Text style={[styles.logText, { color: '#FF8A80', marginTop: 6, opacity: 0.8, fontSize: 11 }]} numberOfLines={2}>
            {payload.stackTrace.split('\n')[0]}
          </Text>
        )}
      </TouchableOpacity>
    )
  }

  const renderHeadersMap = (headers: any) => {
    if (!headers || Object.keys(headers).length === 0) return <Text style={styles.emptyTxt}>No headers</Text>
    return Object.entries(headers).map(([key, val]) => (
      <View key={key} style={styles.kvRow}>
        <Text style={styles.kvKey}>{key}:</Text>
        <Text style={styles.kvVal}>{String(val)}</Text>
      </View>
    ))
  }

  const renderJsonBody = (body: any) => {
    if (!body) return <Text style={styles.emptyTxt}>No body</Text>
    let parsed = body
    if (typeof body === 'string') {
      try { parsed = JSON.parse(body) } catch {}
    }
    return <Text style={styles.jsonText}>{JSON.stringify(parsed, null, 2)}</Text>
  }

  const renderDetails = () => {
    if (!selectedEvent) return null
    const payload = selectedEvent.payload as any
    const isNetwork = selectedEvent.type.startsWith('http')

    return (
      <View style={styles.detailsContainer}>
        <View style={styles.detailsHeader}>
          <Text style={styles.detailsTitle}>Inspector</Text>
          <TouchableOpacity onPress={() => setSelectedEvent(null)}>
            <Text style={styles.closeBtn}>Voltar</Text>
          </TouchableOpacity>
        </View>

        {isNetwork ? (
          <View style={styles.detailTabs}>
            <TouchableOpacity onPress={() => setDetailTab('overview')} style={[styles.dTab, detailTab === 'overview' && styles.dTabActive]}><Text style={[styles.dTabTxt, detailTab === 'overview' && styles.dTabTxtActive]}>Info</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setDetailTab('headers')} style={[styles.dTab, detailTab === 'headers' && styles.dTabActive]}><Text style={[styles.dTabTxt, detailTab === 'headers' && styles.dTabTxtActive]}>Headers</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setDetailTab('payload')} style={[styles.dTab, detailTab === 'payload' && styles.dTabActive]}><Text style={[styles.dTabTxt, detailTab === 'payload' && styles.dTabTxtActive]}>Payload</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setDetailTab('response')} style={[styles.dTab, detailTab === 'response' && styles.dTabActive]}><Text style={[styles.dTabTxt, detailTab === 'response' && styles.dTabTxtActive]}>Response</Text></TouchableOpacity>
          </View>
        ) : null}

        <ScrollView style={styles.detailsScroll}>
          {isNetwork && detailTab === 'overview' && (
            <View>
              <Text style={styles.sectionTitle}>General</Text>
              <View style={styles.card}>
                {payload.url && <View style={styles.kvRow}><Text style={styles.kvKey}>URL:</Text><Text style={styles.kvVal}>{payload.url}</Text></View>}
                {payload.method && <View style={styles.kvRow}><Text style={styles.kvKey}>Method:</Text><Text style={styles.kvVal}>{payload.method}</Text></View>}
                {payload.statusCode !== undefined && <View style={styles.kvRow}><Text style={styles.kvKey}>Status:</Text><Text style={styles.kvVal}>{payload.statusCode}</Text></View>}
                {payload.duration !== undefined && <View style={styles.kvRow}><Text style={styles.kvKey}>Duration:</Text><Text style={styles.kvVal}>{payload.duration}ms</Text></View>}
                {payload.size !== undefined && <View style={styles.kvRow}><Text style={styles.kvKey}>Size:</Text><Text style={styles.kvVal}>{formatBytes(payload.size)}</Text></View>}
                <View style={styles.kvRow}><Text style={styles.kvKey}>Req ID:</Text><Text style={styles.kvVal}>{payload.id || payload.requestId}</Text></View>
              </View>
            </View>
          )}

          {isNetwork && detailTab === 'headers' && (
            <View>
              <Text style={styles.sectionTitle}>Headers</Text>
              <View style={styles.card}>{renderHeadersMap(payload.headers)}</View>
            </View>
          )}

          {isNetwork && detailTab === 'payload' && (
            <View>
              <Text style={styles.sectionTitle}>Request Body (POST/PUT)</Text>
              <View style={styles.card}>{renderJsonBody(payload.body)}</View>
            </View>
          )}

          {isNetwork && detailTab === 'response' && (
            <View>
              <Text style={styles.sectionTitle}>Response Data</Text>
              <View style={styles.card}>{renderJsonBody(payload.body)}</View>
            </View>
          )}

          {!isNetwork && (
            <View>
              <Text style={styles.sectionTitle}>Console Details</Text>
              <View style={styles.card}>
                <View style={styles.kvRow}><Text style={styles.kvKey}>Level:</Text><Text style={styles.kvVal}>{payload.level}</Text></View>
                <View style={styles.kvRow}><Text style={styles.kvKey}>Message:</Text><Text style={styles.kvVal}>{payload.message}</Text></View>
                {payload.stackTrace && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.kvKey}>Stack Trace:</Text>
                    <Text style={[styles.kvVal, { color: '#EF5350', marginTop: 4 }]}>{payload.stackTrace}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Bug color="#4CA1AF" size={20} />
            <Text style={styles.title}>DevInspector</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeHeaderBtn}>
            <Text style={styles.closeHeaderTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        {!selectedEvent && (
          <View style={{ backgroundColor: '#09090b', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#27272a' }}>
            <View style={styles.tabs}>
              <TouchableOpacity style={[styles.tab, activeTab === 'network' && styles.activeTab]} onPress={() => setActiveTab('network')}>
                <Text style={[styles.tabText, activeTab === 'network' && styles.activeTabText]}>Network</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, activeTab === 'console' && styles.activeTab]} onPress={() => setActiveTab('console')}>
                <Text style={[styles.tabText, activeTab === 'console' && styles.activeTabText]}>Console & Errors</Text>
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
              <TextInput
                style={{ backgroundColor: '#18181b', color: '#fafafa', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, fontSize: 13, borderWidth: 1, borderColor: '#27272a' }}
                placeholder={activeTab === 'network' ? "Buscar por URL..." : "Buscar nos logs..."}
                placeholderTextColor="#71717a"
                value={searchUrl}
                onChangeText={setSearchUrl}
              />
              
              {activeTab === 'network' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                  {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(method => {
                    const isActive = selectedMethods.includes(method)
                    return (
                      <TouchableOpacity
                        key={method}
                        style={{
                          backgroundColor: isActive ? '#fafafa' : '#18181b',
                          paddingHorizontal: 14,
                          paddingVertical: 6,
                          borderRadius: 16,
                          marginRight: 8,
                          borderWidth: 1,
                          borderColor: isActive ? '#fafafa' : '#27272a'
                        }}
                        onPress={() => {
                          if (isActive) {
                            setSelectedMethods(prev => prev.filter(m => m !== method))
                          } else {
                            setSelectedMethods(prev => [...prev, method])
                          }
                        }}
                      >
                        <Text style={{ color: isActive ? '#FFF' : '#A0A0A0', fontSize: 11, fontWeight: 'bold' }}>
                          {method}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        )}

        {selectedEvent ? (
          renderDetails()
        ) : (
          <FlatList
            data={filteredHistory}
            keyExtractor={(_, index) => String(index)}
            renderItem={activeTab === 'network' ? renderNetworkItem : renderConsoleItem}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.emptyList}>Nenhum evento capturado ainda.</Text>}
          />
        )}
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#27272a', backgroundColor: '#09090b' },
  title: { color: '#fafafa', fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
  closeHeaderBtn: { padding: 4 },
  closeHeaderTxt: { color: '#a1a1aa', fontSize: 20 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#27272a', backgroundColor: '#09090b' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#fafafa' },
  tabText: { color: '#71717a', fontSize: 13, fontWeight: '500' },
  activeTabText: { color: '#fafafa', fontWeight: '600' },
  list: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 32 },
  emptyList: { color: '#71717a', textAlign: 'center', marginTop: 40, fontSize: 13 },
  
  row: { paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#18181b', backgroundColor: '#09090b' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  badge: { backgroundColor: '#18181b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#27272a' },
  method: { fontWeight: '600', fontSize: 10, letterSpacing: 0.5 },
  url: { color: '#d4d4d8', fontSize: 13, flex: 1 },
  rowFooter: { flexDirection: 'row', gap: 12, paddingLeft: 2 },
  status: { fontWeight: '600', fontSize: 11 },
  meta: { color: '#71717a', fontSize: 11 },
  logText: { fontSize: 12, fontFamily: 'monospace' },
  
  detailsContainer: { flex: 1, backgroundColor: '#09090b' },
  detailsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#09090b', borderBottomWidth: 1, borderBottomColor: '#27272a' },
  detailsTitle: { color: '#fafafa', fontWeight: '600', fontSize: 15 },
  closeBtn: { color: '#a1a1aa', fontSize: 13, fontWeight: '500' },
  detailTabs: { flexDirection: 'row', backgroundColor: '#09090b', borderBottomWidth: 1, borderBottomColor: '#27272a' },
  dTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  dTabActive: { borderBottomWidth: 2, borderBottomColor: '#fafafa' },
  dTabTxt: { color: '#71717a', fontSize: 12, fontWeight: '500' },
  dTabTxtActive: { color: '#fafafa', fontWeight: '600' },
  
  detailsScroll: { flex: 1, padding: 16 },
  sectionTitle: { color: '#71717a', fontSize: 11, fontWeight: '600', marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: '#18181b', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#27272a', marginBottom: 24 },
  kvRow: { flexDirection: 'row', marginBottom: 8 },
  kvKey: { color: '#a1a1aa', width: 80, fontSize: 12, fontWeight: '500' },
  kvVal: { color: '#fafafa', flex: 1, fontSize: 12, fontFamily: 'monospace' },
  emptyTxt: { color: '#71717a', fontStyle: 'italic', fontSize: 12 },
  jsonText: { color: '#d4d4d8', fontFamily: 'monospace', fontSize: 12 }
})

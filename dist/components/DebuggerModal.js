import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, ScrollView, TextInput, Platform, StatusBar } from 'react-native';
import { BugIcon } from './icons';
import { useDevInspectorHistory } from '../hooks/useDevInspectorHistory';
const formatBytes = (bytes) => {
    if (bytes === null || bytes === undefined)
        return '0 B';
    if (bytes < 1024)
        return bytes + ' B';
    else if (bytes < 1048576)
        return (bytes / 1024).toFixed(1) + ' KB';
    else
        return (bytes / 1048576).toFixed(1) + ' MB';
};
export const DebuggerModal = ({ visible, onClose }) => {
    const history = useDevInspectorHistory();
    const [activeTab, setActiveTab] = useState('network');
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [detailTab, setDetailTab] = useState('overview');
    const [searchUrl, setSearchUrl] = useState('');
    const [selectedMethods, setSelectedMethods] = useState([]);
    const filteredHistory = useMemo(() => {
        if (activeTab === 'network') {
            const grouped = new Map();
            const networkEvents = history.filter(e => e.type === 'http:request' || e.type === 'http:response');
            const chronological = [...networkEvents].reverse();
            chronological.forEach(e => {
                const p = e.payload;
                const id = p.id || p.requestId;
                if (!id)
                    return;
                if (!grouped.has(id)) {
                    grouped.set(id, { req: {}, res: {}, timestamp: p.timestamp });
                }
                const entry = grouped.get(id);
                if (e.type === 'http:request') {
                    entry.req = p;
                    entry.timestamp = p.timestamp;
                }
                else {
                    entry.res = p;
                    if (!entry.req.method)
                        entry.timestamp = p.timestamp;
                }
            });
            let mergedList = Array.from(grouped.values()).map(entry => ({
                type: 'network:merged',
                payload: {
                    id: entry.req.id || entry.res.requestId,
                    url: entry.req.url || 'Unknown URL',
                    method: entry.req.method || 'UNKNOWN',
                    statusCode: entry.res.statusCode,
                    duration: entry.res.duration,
                    size: entry.res.size,
                    requestHeaders: entry.req.headers,
                    responseHeaders: entry.res.headers,
                    requestBody: entry.req.body,
                    responseBody: entry.res.body,
                    timestamp: entry.timestamp
                }
            })).sort((a, b) => b.payload.timestamp - a.payload.timestamp);
            if (selectedMethods.length > 0) {
                mergedList = mergedList.filter(item => selectedMethods.includes(item.payload.method.toUpperCase()));
            }
            if (searchUrl) {
                const lowerSearch = searchUrl.toLowerCase();
                mergedList = mergedList.filter(item => item.payload.url.toLowerCase().includes(lowerSearch));
            }
            return mergedList;
        }
        return history.filter(e => {
            if (e.type !== 'console:entry')
                return false;
            if (!searchUrl)
                return true;
            const p = e.payload;
            const msg = String(p.message || '').toLowerCase();
            return msg.includes(searchUrl.toLowerCase());
        });
    }, [history, activeTab, searchUrl, selectedMethods]);
    const renderNetworkItem = ({ item }) => {
        const payload = item.payload;
        const method = payload.method;
        const url = payload.url;
        const status = payload.statusCode;
        const isError = status >= 400 || status === 0;
        // Cores sutis para visual minimalista
        const statusColor = isError ? '#EF5350' : '#00E676';
        let methodColor = '#a1a1aa';
        if (method === 'GET')
            methodColor = '#4ade80';
        else if (method === 'POST')
            methodColor = '#60a5fa';
        else if (method === 'PUT' || method === 'PATCH')
            methodColor = '#fbbf24';
        else if (method === 'DELETE')
            methodColor = '#f87171';
        return (_jsxs(TouchableOpacity, { style: styles.row, onPress: () => { setSelectedEvent(item); setDetailTab('overview'); }, children: [_jsxs(View, { style: styles.rowHeader, children: [_jsx(View, { style: [styles.badge, { borderColor: methodColor }], children: _jsx(Text, { style: [styles.method, { color: methodColor }], children: method }) }), _jsx(Text, { style: styles.url, numberOfLines: 1, ellipsizeMode: "middle", children: url })] }), _jsxs(View, { style: styles.rowFooter, children: [_jsx(Text, { style: [styles.status, { color: statusColor }], children: status ? status : 'Pending' }), _jsx(Text, { style: styles.meta, children: payload.duration ? `${payload.duration}ms` : '...' }), _jsx(Text, { style: styles.meta, children: formatBytes(payload.size) })] })] }));
    };
    const renderConsoleItem = ({ item }) => {
        const payload = item.payload;
        const isError = payload.level === 'error' || payload.level === 'fatal';
        const isWarn = payload.level === 'warn';
        const color = isError ? '#FF5252' : isWarn ? '#FFD740' : '#4CA1AF';
        const bg = isError ? 'rgba(255, 82, 82, 0.08)' : isWarn ? 'rgba(255, 215, 64, 0.08)' : '#1E1E1E';
        const borderColor = isError ? 'rgba(255, 82, 82, 0.3)' : isWarn ? 'rgba(255, 215, 64, 0.3)' : '#2C2C2C';
        return (_jsxs(TouchableOpacity, { style: [styles.row, { backgroundColor: bg, borderColor: borderColor, borderWidth: 1, padding: 10 }], onPress: () => {
                setSelectedEvent(item);
                setDetailTab('overview');
            }, children: [_jsxs(View, { style: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 }, children: [_jsx(View, { style: { backgroundColor: color + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }, children: _jsx(Text, { style: { color, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }, children: payload.level || 'log' }) }), _jsx(Text, { style: { color: '#888', fontSize: 10 }, children: new Date(payload.timestamp).toLocaleTimeString() })] }), _jsx(Text, { style: [styles.logText, { color: isError || isWarn ? color : '#E0E0E0' }], numberOfLines: 3, children: payload.message || JSON.stringify(payload.args) }), isError && payload.stackTrace && (_jsx(Text, { style: [styles.logText, { color: '#FF8A80', marginTop: 6, opacity: 0.8, fontSize: 11 }], numberOfLines: 2, children: payload.stackTrace.split('\n')[0] }))] }));
    };
    const renderHeadersMap = (headers) => {
        if (!headers || Object.keys(headers).length === 0)
            return _jsx(Text, { style: styles.emptyTxt, children: "No headers" });
        return Object.entries(headers).map(([key, val]) => (_jsxs(View, { style: styles.kvRow, children: [_jsxs(Text, { style: styles.kvKey, children: [key, ":"] }), _jsx(Text, { style: styles.kvVal, children: String(val) })] }, key)));
    };
    const renderJsonBody = (body) => {
        if (!body)
            return _jsx(Text, { style: styles.emptyTxt, children: "No body" });
        let parsed = body;
        if (typeof body === 'string') {
            try {
                parsed = JSON.parse(body);
            }
            catch { }
        }
        let jsonStr = '';
        try {
            jsonStr = JSON.stringify(parsed, null, 2);
        }
        catch (e) {
            jsonStr = String(parsed);
        }
        // Performance: Trunca payloads gigantes para evitar travar a UI do celular
        if (jsonStr && jsonStr.length > 8000) {
            jsonStr = jsonStr.substring(0, 8000) + '\n\n... [Conteúdo truncado por segurança (muito longo)]';
        }
        return _jsx(Text, { style: styles.jsonText, children: jsonStr });
    };
    const renderDetails = () => {
        if (!selectedEvent)
            return null;
        const payload = selectedEvent.payload;
        const isNetwork = selectedEvent.type.startsWith('http') || selectedEvent.type === 'network:merged';
        return (_jsxs(View, { style: styles.detailsContainer, children: [_jsxs(View, { style: styles.detailsHeader, children: [_jsx(Text, { style: styles.detailsTitle, children: "Inspector" }), _jsx(TouchableOpacity, { onPress: () => setSelectedEvent(null), children: _jsx(Text, { style: styles.closeBtn, children: "Voltar" }) })] }), isNetwork ? (_jsxs(View, { style: styles.detailTabs, children: [_jsx(TouchableOpacity, { onPress: () => setDetailTab('overview'), style: [styles.dTab, detailTab === 'overview' && styles.dTabActive], children: _jsx(Text, { style: [styles.dTabTxt, detailTab === 'overview' && styles.dTabTxtActive], children: "Info" }) }), _jsx(TouchableOpacity, { onPress: () => setDetailTab('headers'), style: [styles.dTab, detailTab === 'headers' && styles.dTabActive], children: _jsx(Text, { style: [styles.dTabTxt, detailTab === 'headers' && styles.dTabTxtActive], children: "Headers" }) }), _jsx(TouchableOpacity, { onPress: () => setDetailTab('payload'), style: [styles.dTab, detailTab === 'payload' && styles.dTabActive], children: _jsx(Text, { style: [styles.dTabTxt, detailTab === 'payload' && styles.dTabTxtActive], children: "Payload" }) }), _jsx(TouchableOpacity, { onPress: () => setDetailTab('response'), style: [styles.dTab, detailTab === 'response' && styles.dTabActive], children: _jsx(Text, { style: [styles.dTabTxt, detailTab === 'response' && styles.dTabTxtActive], children: "Response" }) })] })) : null, _jsxs(ScrollView, { style: styles.detailsScroll, children: [isNetwork && detailTab === 'overview' && (_jsxs(View, { children: [_jsx(Text, { style: styles.sectionTitle, children: "General" }), _jsxs(View, { style: styles.card, children: [payload.url && _jsxs(View, { style: styles.kvRow, children: [_jsx(Text, { style: styles.kvKey, children: "URL:" }), _jsx(Text, { style: styles.kvVal, children: payload.url })] }), payload.method && _jsxs(View, { style: styles.kvRow, children: [_jsx(Text, { style: styles.kvKey, children: "Method:" }), _jsx(Text, { style: styles.kvVal, children: payload.method })] }), payload.statusCode !== undefined && _jsxs(View, { style: styles.kvRow, children: [_jsx(Text, { style: styles.kvKey, children: "Status:" }), _jsx(Text, { style: styles.kvVal, children: payload.statusCode })] }), payload.duration !== undefined && _jsxs(View, { style: styles.kvRow, children: [_jsx(Text, { style: styles.kvKey, children: "Duration:" }), _jsxs(Text, { style: styles.kvVal, children: [payload.duration, "ms"] })] }), payload.size !== undefined && _jsxs(View, { style: styles.kvRow, children: [_jsx(Text, { style: styles.kvKey, children: "Size:" }), _jsx(Text, { style: styles.kvVal, children: formatBytes(payload.size) })] }), _jsxs(View, { style: styles.kvRow, children: [_jsx(Text, { style: styles.kvKey, children: "Req ID:" }), _jsx(Text, { style: styles.kvVal, children: payload.id || payload.requestId })] })] })] })), isNetwork && detailTab === 'headers' && (_jsxs(View, { children: [payload.requestHeaders && (_jsxs(_Fragment, { children: [_jsx(Text, { style: styles.sectionTitle, children: "Request Headers" }), _jsx(View, { style: styles.card, children: renderHeadersMap(payload.requestHeaders) })] })), payload.responseHeaders && (_jsxs(_Fragment, { children: [_jsx(Text, { style: styles.sectionTitle, children: "Response Headers" }), _jsx(View, { style: styles.card, children: renderHeadersMap(payload.responseHeaders) })] }))] })), isNetwork && detailTab === 'payload' && (_jsxs(View, { children: [_jsx(Text, { style: styles.sectionTitle, children: "Request Body (POST/PUT)" }), _jsx(View, { style: styles.card, children: renderJsonBody(payload.requestBody) })] })), isNetwork && detailTab === 'response' && (_jsxs(View, { children: [_jsx(Text, { style: styles.sectionTitle, children: "Response Data" }), _jsx(View, { style: styles.card, children: renderJsonBody(payload.responseBody) })] })), !isNetwork && (_jsxs(View, { children: [_jsx(Text, { style: styles.sectionTitle, children: "Console Details" }), _jsxs(View, { style: styles.card, children: [_jsxs(View, { style: styles.kvRow, children: [_jsx(Text, { style: styles.kvKey, children: "Level:" }), _jsx(Text, { style: styles.kvVal, children: payload.level })] }), _jsxs(View, { style: { marginTop: 12 }, children: [_jsx(Text, { style: [styles.kvKey, { marginBottom: 6 }], children: "Payload / Data:" }), _jsx(View, { style: { backgroundColor: '#09090b', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#27272a' }, children: payload.args && payload.args.length > 0
                                                        ? renderJsonBody(payload.args.length === 1 ? payload.args[0] : payload.args)
                                                        : _jsx(Text, { style: styles.jsonText, children: payload.message }) })] }), payload.stackTrace && (_jsxs(View, { style: { marginTop: 16 }, children: [_jsx(Text, { style: styles.kvKey, children: "Stack Trace:" }), _jsx(Text, { style: [styles.kvVal, { color: '#EF5350', marginTop: 4 }], children: payload.stackTrace })] }))] })] }))] })] }));
    };
    return (_jsx(Modal, { visible: visible, animationType: "slide", transparent: false, children: _jsxs(View, { style: styles.container, children: [_jsxs(View, { style: styles.header, children: [_jsxs(View, { style: { flexDirection: 'row', alignItems: 'center', gap: 8 }, children: [_jsx(BugIcon, { color: "#4CA1AF", size: 20 }), _jsx(Text, { style: styles.title, children: "DevInspector" })] }), _jsx(TouchableOpacity, { onPress: onClose, style: styles.closeHeaderBtn, children: _jsx(Text, { style: styles.closeHeaderTxt, children: "\u2715" }) })] }), !selectedEvent && (_jsxs(View, { style: { backgroundColor: '#09090b', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#27272a' }, children: [_jsxs(View, { style: styles.tabs, children: [_jsx(TouchableOpacity, { style: [styles.tab, activeTab === 'network' && styles.activeTab], onPress: () => setActiveTab('network'), children: _jsx(Text, { style: [styles.tabText, activeTab === 'network' && styles.activeTabText], children: "Network" }) }), _jsx(TouchableOpacity, { style: [styles.tab, activeTab === 'console' && styles.activeTab], onPress: () => setActiveTab('console'), children: _jsx(Text, { style: [styles.tabText, activeTab === 'console' && styles.activeTabText], children: "Console & Errors" }) })] }), _jsxs(View, { style: { paddingHorizontal: 16, paddingTop: 12, gap: 12 }, children: [_jsx(TextInput, { style: { backgroundColor: '#18181b', color: '#fafafa', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, fontSize: 13, borderWidth: 1, borderColor: '#27272a' }, placeholder: activeTab === 'network' ? "Buscar por URL..." : "Buscar nos logs...", placeholderTextColor: "#71717a", value: searchUrl, onChangeText: setSearchUrl }), activeTab === 'network' && (_jsx(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: { flexDirection: 'row' }, children: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(method => {
                                        const isActive = selectedMethods.includes(method);
                                        return (_jsx(TouchableOpacity, { style: {
                                                backgroundColor: isActive ? '#fafafa' : '#18181b',
                                                paddingHorizontal: 14,
                                                paddingVertical: 6,
                                                borderRadius: 16,
                                                marginRight: 8,
                                                borderWidth: 1,
                                                borderColor: isActive ? '#fafafa' : '#27272a'
                                            }, onPress: () => {
                                                if (isActive) {
                                                    setSelectedMethods(prev => prev.filter(m => m !== method));
                                                }
                                                else {
                                                    setSelectedMethods(prev => [...prev, method]);
                                                }
                                            }, children: _jsx(Text, { style: { color: isActive ? '#FFF' : '#A0A0A0', fontSize: 11, fontWeight: 'bold' }, children: method }) }, method));
                                    }) }))] })] })), selectedEvent ? (renderDetails()) : (_jsx(FlatList, { data: filteredHistory, keyExtractor: (_, index) => String(index), renderItem: activeTab === 'network' ? renderNetworkItem : renderConsoleItem, contentContainerStyle: styles.list, ListEmptyComponent: _jsx(Text, { style: styles.emptyList, children: "Nenhum evento capturado ainda." }) }))] }) }));
};
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#09090b', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44 },
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
});
//# sourceMappingURL=DebuggerModal.js.map
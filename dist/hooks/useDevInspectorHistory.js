import { useState, useEffect } from 'react';
import { devToolsClient } from '../DevToolsClient';
export function useDevInspectorHistory() {
    const [history, setHistory] = useState([]);
    useEffect(() => {
        // Initial load
        setHistory([...devToolsClient.getHistory()]);
        // Subscribe to changes
        const unsubscribe = devToolsClient.subscribeHistory(() => {
            setHistory([...devToolsClient.getHistory()]);
        });
        return unsubscribe;
    }, []);
    return history;
}
//# sourceMappingURL=useDevInspectorHistory.js.map
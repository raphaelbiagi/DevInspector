import { generateUuid } from '../utils/uuid';
import { safeSerialize } from '../utils/serializer';
let originalXhrOpen = null;
let originalXhrSend = null;
let originalXhrSetRequestHeader = null;
export function installXhrInterceptor(client) {
    if (originalXhrOpen)
        return;
    originalXhrOpen = XMLHttpRequest.prototype.open;
    originalXhrSend = XMLHttpRequest.prototype.send;
    originalXhrSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.open = function (method, url) {
        const xhr = this;
        xhr.__devinspector_id = generateUuid();
        xhr.__devinspector_method = typeof method === 'string' ? method.toUpperCase() : 'GET';
        xhr.__devinspector_url = url ? url.toString() : '';
        xhr.__devinspector_requestHeaders = {};
        return originalXhrOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
        const xhr = this;
        if (xhr.__devinspector_requestHeaders) {
            xhr.__devinspector_requestHeaders[header] = value;
        }
        return originalXhrSetRequestHeader.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (data) {
        const xhr = this;
        if (xhr.__devinspector_id) {
            xhr.__devinspector_startTime = Date.now();
            let parsedBody = data;
            if (typeof data === 'string') {
                try {
                    parsedBody = JSON.parse(data);
                }
                catch { }
            }
            client.send({
                type: 'network:request-start',
                payload: {
                    id: xhr.__devinspector_id,
                    url: xhr.__devinspector_url || '',
                    method: (xhr.__devinspector_method || 'GET'),
                    requestHeaders: xhr.__devinspector_requestHeaders || {},
                    requestBody: parsedBody !== undefined ? safeSerialize(parsedBody).value : undefined,
                    startTime: xhr.__devinspector_startTime,
                    source: 'xhr'
                }
            });
            const handleLoadEnd = () => {
                if (!xhr.__devinspector_id || !xhr.__devinspector_startTime)
                    return;
                const endTime = Date.now();
                const duration = endTime - xhr.__devinspector_startTime;
                if (xhr.status === 0) {
                    // Status 0 in React Native usually means a network error or abort.
                    // We should report it as an error rather than ignoring it completely.
                    client.send({
                        type: 'network:request-error',
                        payload: {
                            id: xhr.__devinspector_id,
                            error: 'Network Error / Aborted (Status 0)',
                            endTime,
                            duration
                        }
                    });
                    return;
                }
                const headersString = xhr.getAllResponseHeaders();
                const responseHeaders = {};
                if (headersString) {
                    headersString.trim().split(/[\r\n]+/).forEach((line) => {
                        const parts = line.split(': ');
                        const header = parts.shift();
                        const value = parts.join(': ');
                        if (header)
                            responseHeaders[header] = value;
                    });
                }
                let responseBody = xhr.response;
                let responseSize = null;
                if (typeof xhr.response === 'string') {
                    responseSize = xhr.response.length;
                    try {
                        responseBody = JSON.parse(xhr.response);
                    }
                    catch { }
                }
                else if (xhr.responseType === '' || xhr.responseType === 'text') {
                    try {
                        if (xhr.responseText) {
                            responseSize = xhr.responseText.length;
                            try {
                                responseBody = JSON.parse(xhr.responseText);
                            }
                            catch {
                                responseBody = xhr.responseText;
                            }
                        }
                    }
                    catch (e) {
                        // Ignore access errors
                    }
                }
                client.send({
                    type: 'network:request-end',
                    payload: {
                        id: xhr.__devinspector_id,
                        statusCode: xhr.status,
                        responseHeaders,
                        responseBody,
                        responseSize,
                        endTime,
                        duration
                    }
                });
            };
            const handleError = (e) => {
                if (!xhr.__devinspector_id || !xhr.__devinspector_startTime)
                    return;
                const endTime = Date.now();
                client.send({
                    type: 'network:request-error',
                    payload: {
                        id: xhr.__devinspector_id,
                        error: 'XHR Error / Network failed',
                        endTime,
                        duration: endTime - xhr.__devinspector_startTime
                    }
                });
            };
            xhr.addEventListener('load', handleLoadEnd);
            xhr.addEventListener('error', handleError);
            xhr.addEventListener('abort', handleError);
            xhr.addEventListener('timeout', handleError);
        }
        return originalXhrSend.apply(this, arguments);
    };
}
export function uninstallXhrInterceptor() {
    if (originalXhrOpen) {
        XMLHttpRequest.prototype.open = originalXhrOpen;
        XMLHttpRequest.prototype.send = originalXhrSend;
        XMLHttpRequest.prototype.setRequestHeader = originalXhrSetRequestHeader;
        originalXhrOpen = null;
        originalXhrSend = null;
        originalXhrSetRequestHeader = null;
    }
}
//# sourceMappingURL=xhrInterceptor.js.map
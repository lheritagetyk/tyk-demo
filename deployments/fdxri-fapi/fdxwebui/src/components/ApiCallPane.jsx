import React, { useState } from 'react'
import './ApiCallPane.css'

function ApiCallPane({ apiCalls }) {
  const [selectedCall, setSelectedCall] = useState(null)
  const [filter, setFilter] = useState('all')

  const filteredCalls = filter === 'all' 
    ? apiCalls 
    : apiCalls.filter(call => call.status === filter)

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return '#4caf50'
      case 'error': return '#f44336'
      case 'pending': return '#ff9800'
      default: return '#9e9e9e'
    }
  }

  const formatDuration = (ms) => {
    if (!ms) return '-'
    return `${ms}ms`
  }

  return (
    <div className="api-call-pane">
      <div className="pane-header">
        <h2>API Calls</h2>
        <div className="filter-buttons">
          <button 
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All ({apiCalls.length})
          </button>
          <button 
            className={filter === 'success' ? 'active' : ''}
            onClick={() => setFilter('success')}
          >
            Success ({apiCalls.filter(c => c.status === 'success').length})
          </button>
          <button 
            className={filter === 'error' ? 'active' : ''}
            onClick={() => setFilter('error')}
          >
            Errors ({apiCalls.filter(c => c.status === 'error').length})
          </button>
        </div>
      </div>

      <div className="calls-list">
        {filteredCalls.length === 0 ? (
          <div className="empty-state">No API calls yet</div>
        ) : (
          filteredCalls.map(call => (
            <div
              key={call.id}
              className={`call-item ${call.status} ${selectedCall?.id === call.id ? 'selected' : ''}`}
              onClick={() => setSelectedCall(call)}
            >
              <div className="call-header">
                <span className="call-method">{call.method}</span>
                <span className="call-status" style={{ color: getStatusColor(call.status) }}>
                  {call.status}
                </span>
              </div>
              <div className="call-url">{call.url}</div>
              <div className="call-meta">
                <span>{new Date(call.timestamp).toLocaleTimeString()}</span>
                {call.duration && (
                  <span>{formatDuration(call.duration)}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedCall && (
        <div className="call-details">
          <div className="details-header">
            <h3>Request Details</h3>
            <button onClick={() => setSelectedCall(null)}>×</button>
          </div>

          <div className="details-section">
            <div className="details-label">Method</div>
            <div className="details-value">{selectedCall.method}</div>
          </div>

          <div className="details-section">
            <div className="details-label">URL</div>
            <div className="details-value code">{selectedCall.url}</div>
          </div>

          <div className="details-section">
            <div className="details-label">Full Request (HTTP format - exactly as sent)</div>
            <div className="details-value code request-display">
              <div className="request-format">
                <div className="request-line">
                  <span className="request-method">{selectedCall.method}</span> {selectedCall.url} HTTP/1.1
                </div>
                <div className="request-separator">Headers:</div>
                {selectedCall.headers && Object.keys(selectedCall.headers).length > 0 && (
                  <>
                    {Object.entries(selectedCall.headers).map(([key, value]) => {
                      const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
                      // Show full value, but make DPoP proof more readable
                      if (key === 'DPoP' && valueStr.length > 100) {
                        return (
                          <div key={key} className="request-header-line">
                            <span className="header-name">{key}:</span> <span className="dpop-value">{valueStr}</span>
                          </div>
                        )
                      }
                      return (
                        <div key={key} className="request-header-line">
                          <span className="header-name">{key}:</span> <span className="header-value">{valueStr}</span>
                        </div>
                      )
                    })}
                  </>
                )}
                {selectedCall.body && (
                  <>
                    <div className="request-separator">Body:</div>
                    <pre className="request-body">{JSON.stringify(selectedCall.body, null, 2)}</pre>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="details-section">
            <div className="details-label">Request (curl format - copy/paste ready)</div>
            <div className="details-value code request-display">
              <div className="request-format">
                <div className="request-curl-command">
                  curl -X {selectedCall.method} '{selectedCall.url}' \
                </div>
                {selectedCall.headers && Object.keys(selectedCall.headers).length > 0 && (
                  <>
                    {Object.entries(selectedCall.headers).map(([key, value], index, array) => {
                      const isLast = index === array.length - 1 && !selectedCall.body
                      const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
                      return (
                        <div key={key} className="request-header-line">
                          &nbsp;&nbsp;-H '{key}: {valueStr}'{isLast ? '' : ' \\'}
                        </div>
                      )
                    })}
                  </>
                )}
                {selectedCall.body && (
                  <>
                    <div className="request-header-line">
                      &nbsp;&nbsp;-d '{JSON.stringify(selectedCall.body)}'
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {selectedCall.headers && Object.keys(selectedCall.headers).length > 0 && (
            <div className="details-section">
              <div className="details-label">Headers (JSON)</div>
              <div className="details-value">
                <pre>{JSON.stringify(selectedCall.headers, null, 2)}</pre>
              </div>
            </div>
          )}

          {selectedCall.body && (
            <div className="details-section">
              <div className="details-label">Request Body</div>
              <div className="details-value">
                <pre>{JSON.stringify(selectedCall.body, null, 2)}</pre>
              </div>
            </div>
          )}

          {selectedCall.dpopProof && (
            <div className="details-section">
              <div className="details-label">DPoP Proof</div>
              <div className="details-value code small">
                {selectedCall.dpopProof}
              </div>
            </div>
          )}

          <div className="details-section">
            <div className="details-label">Status</div>
            <div className="details-value">
              <span style={{ color: getStatusColor(selectedCall.status) }}>
                {selectedCall.status}
                {selectedCall.statusCode && ` (${selectedCall.statusCode})`}
              </span>
            </div>
          </div>

          {selectedCall.responseHeaders && Object.keys(selectedCall.responseHeaders).length > 0 && (
            <div className="details-section">
              <div className="details-label">Response Headers</div>
              <div className="details-value code">
                <div className="request-format">
                  {Object.entries(selectedCall.responseHeaders).map(([key, value]) => (
                    <div key={key} className="request-header-line">
                      <span className="header-name">{key}:</span> {Array.isArray(value) ? value.join(', ') : value}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedCall.response && (
            <div className="details-section">
              <div className="details-label">Response Body</div>
              <div className="details-value">
                <pre>{JSON.stringify(selectedCall.response, null, 2)}</pre>
              </div>
            </div>
          )}

          {selectedCall.error && (
            <div className="details-section">
              <div className="details-label">Error</div>
              <div className="details-value error-text">{selectedCall.error}</div>
            </div>
          )}

          {selectedCall.duration && (
            <div className="details-section">
              <div className="details-label">Duration</div>
              <div className="details-value">{formatDuration(selectedCall.duration)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ApiCallPane


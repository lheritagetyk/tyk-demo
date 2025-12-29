import { useEffect } from 'react'

function CallbackHandler() {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    const error = urlParams.get('error')

    if (error) {
      console.error('OAuth error:', error)
      window.opener?.postMessage({
        type: 'oauth-callback',
        error
      }, window.location.origin)
      window.close()
      return
    }

    if (code) {
      window.opener?.postMessage({
        type: 'oauth-callback',
        code,
        state
      }, window.location.origin)
      
      // Close the popup window
      setTimeout(() => {
        window.close()
      }, 1000)
    }
  }, [])

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Authorization Complete</h2>
      <p>You can close this window.</p>
    </div>
  )
}

export default CallbackHandler


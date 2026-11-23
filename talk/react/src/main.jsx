import { TalkTriage } from '@ssc-plus/client-react'
import '@ssc-plus/client-react/styles.css'
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  const [started, setStarted] = useState(null)
  const [result, setResult] = useState(null)

  // Your server creates the session and gives the page its token.
  useEffect(() => {
    fetch('/api/sessions', { method: 'POST' })
      .then((response) => response.json())
      .then(setStarted)
  }, [])

  // When the result is shown, your server reads the full result from SSC+.
  async function readResult() {
    setResult(await (await fetch(`/api/sessions/${started.session}`)).json())
  }

  if (!started) return <p>Yhdistetään…</p>
  return (
    <>
      <TalkTriage
        token={started.token}
        voiceUrl={started.voiceUrl}
        labels={{ start: 'Aloita oirearvio' }}
        onResult={readResult}
      />
      {result && (
        <p>
          Your server read the result: {result.status}, urgency {result.triage_code}/10.
        </p>
      )}
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '40rem', margin: '2rem auto', padding: '0 1rem' }}>
    <h1>Oirearvio</h1>
    <App />
  </main>,
)

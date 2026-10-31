import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { warmUpBackend } from './config/warmup'
import { reloadForNewBuild } from './utils/staleBuild'

// "Open preview in new tab": the preview tab sends the browser to
// /webcontainer/connect/<token> on our origin, and this page must bridge it
// back to the editor's WebContainer instead of rendering the app.
// (Served without COOP/COEP, see vercel.json, so window.opener survives.)
if (window.location.pathname.startsWith('/webcontainer/connect/')) {
  import('@webcontainer/api/connect')
    .then(({ setupConnect }) => setupConnect({ editorOrigin: 'https://stackblitz.com' }))
    .catch((err) => {
      console.error(err)
      document.body.textContent =
        'Could not connect the preview. Keep the Aivex editor tab open and click "Open in new tab" again.'
    })
} else {
  warmUpBackend()

  // A code-split file from an older deploy is gone: load the new build
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewBuild()) event.preventDefault()
  })

  createRoot(document.getElementById('root')!).render(
    // <StrictMode>
      <App />
    // </StrictMode>,
  )
}

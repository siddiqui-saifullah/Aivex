import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { warmUpBackend } from './config/warmup'

warmUpBackend()

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    <App />
  // </StrictMode>,
)

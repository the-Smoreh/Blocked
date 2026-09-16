import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import Gate from './components/Gate.jsx'
import './styles.css'

// The gate wraps the app rather than living inside it, so it covers every
// route including the player, and does not have to be threaded through App's
// several early returns.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Gate>
      <App />
    </Gate>
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import PinLock from './components/PinLock.tsx'
import { queryClient } from './lib/queryClient'
import { STATIC_MODE } from './lib/api'

// Un solo Router montato: su GitHub Pages serve HashRouter (nessun server che
// riscriva le rotte), altrove BrowserRouter come da template.
const Router = STATIC_MODE ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PinLock>
        <Router>
          <App />
        </Router>
      </PinLock>
    </QueryClientProvider>
  </StrictMode>,
)

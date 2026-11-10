import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from "react-router"

import "./styles/reset.css"
import "./styles/variables.css"
import "./styles/themes.css"
import "./styles/main.css"
import "./styles/layout.css"

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

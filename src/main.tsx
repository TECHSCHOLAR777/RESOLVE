import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import SplashGate from './components/splash/SplashGate.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <SplashGate>
    <App />
  </SplashGate>,
);

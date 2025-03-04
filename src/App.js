import React from 'react';
import './App.css';
import DualNBackGame from './DualNBackGame';
import { Analytics } from '@vercel/analytics/react';

function App() {
  return (
    <div className="App">
      <DualNBackGame />
      <Analytics />
    </div>
  );
}

export default App;
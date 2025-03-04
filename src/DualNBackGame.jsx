import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const DualNBackGame = () => {
  // Game states
  const [gameState, setGameState] = useState('start'); // 'start', 'playing', 'result', 'help'
  const [nValue, setNValue] = useState(2);
  const [trials, setTrials] = useState([]);
  const [currentTrial, setCurrentTrial] = useState(0);
  // Separate scores for visual and audio channels
  const [score, setScore] = useState({
    visual: { correct: 0, missed: 0, falseAlarms: 0 },
    audio: { correct: 0, missed: 0, falseAlarms: 0 }
  });
  const [visualResponses, setVisualResponses] = useState([]);
  const [audioResponses, setAudioResponses] = useState([]);
  const [isBreak, setIsBreak] = useState(false);
  
  // Constants
  const TOTAL_TRIALS = 20 + nValue;
  const GRID_SIZE = 3;
  const TRIAL_DURATION = 3000; // milliseconds
  
  // Using useMemo for arrays to prevent recreation on every render
  const LETTERS = useMemo(() => ['c', 'h', 'k', 'l', 'q', 'r', 's', 't'], []);
  const MATCH_FREQUENCY = 0.3; // Strict rate for both channels
  const INTERFERENCE_LEVEL = 0.1; // Changed to 10%
  
  // Refs
  const timerRef = useRef(null);
  const breakTimerRef = useRef(null);
  const timerStartRef = useRef(null);
  const gameRef = useRef(null);
  const audioRef = useRef(null);
  
  // Refs for responses so that calculateFinalScore remains stable
  const visualResponsesRef = useRef(visualResponses);
  const audioResponsesRef = useRef(audioResponses);
  
  useEffect(() => {
    visualResponsesRef.current = visualResponses;
  }, [visualResponses]);
  
  useEffect(() => {
    audioResponsesRef.current = audioResponses;
  }, [audioResponses]);
  
  // Generate trials with strict match enforcement
  const generateTrials = useCallback(() => {
    const newTrials = [];
    const visualHistory = [];
    const audioHistory = [];
    
    // Helper functions to get random stimuli
    const getRandomPosition = () => ({
      row: Math.floor(Math.random() * GRID_SIZE),
      col: Math.floor(Math.random() * GRID_SIZE)
    });
    const getRandomLetter = () => LETTERS[Math.floor(Math.random() * LETTERS.length)];
    
    // First nValue trials: seed trials with no matches
    for (let i = 0; i < nValue; i++) {
      const position = getRandomPosition();
      const letter = getRandomLetter();
      visualHistory.push(position);
      audioHistory.push(letter);
      newTrials.push({
        position,
        letter,
        visualMatch: false,
        audioMatch: false,
        visualLure: false,
        audioLure: false
      });
    }
    
    // Candidate trials (from index nValue to TOTAL_TRIALS - 1)
    const candidateCount = TOTAL_TRIALS - nValue;
    const numVisualMatches = Math.floor(candidateCount * MATCH_FREQUENCY);
    const numAudioMatches = Math.floor(candidateCount * MATCH_FREQUENCY);
    
    // Preselect match indices for each channel
    const visualMatchIndices = new Set();
    while (visualMatchIndices.size < numVisualMatches) {
      const index = Math.floor(Math.random() * candidateCount) + nValue;
      visualMatchIndices.add(index);
    }
    const audioMatchIndices = new Set();
    while (audioMatchIndices.size < numAudioMatches) {
      const index = Math.floor(Math.random() * candidateCount) + nValue;
      audioMatchIndices.add(index);
    }
    
    // Generate remaining trials
    for (let i = nValue; i < TOTAL_TRIALS; i++) {
      let position, letter;
      let visualMatch = false;
      let audioMatch = false;
      let visualLure = false;
      let audioLure = false;
      
      // Visual channel
      if (visualMatchIndices.has(i)) {
        position = { ...visualHistory[i - nValue] };
        visualMatch = true;
      } else if (Math.random() < INTERFERENCE_LEVEL) {
        const lureOffset = Math.random() < 0.5 ? nValue - 1 : nValue + 1;
        if (i - lureOffset >= 0 && i - lureOffset < visualHistory.length) {
          position = { ...visualHistory[i - lureOffset] };
          visualLure = true;
        } else {
          position = getRandomPosition();
        }
      } else {
        let pos;
        do {
          pos = getRandomPosition();
        } while (pos.row === visualHistory[i - nValue].row && pos.col === visualHistory[i - nValue].col);
        position = pos;
      }
      
      // Audio channel
      if (audioMatchIndices.has(i)) {
        letter = audioHistory[i - nValue];
        audioMatch = true;
      } else if (Math.random() < INTERFERENCE_LEVEL) {
        const lureOffset = Math.random() < 0.5 ? nValue - 1 : nValue + 1;
        if (i - lureOffset >= 0 && i - lureOffset < audioHistory.length) {
          letter = audioHistory[i - lureOffset];
          audioLure = true;
        } else {
          letter = getRandomLetter();
        }
      } else {
        let l;
        do {
          l = getRandomLetter();
        } while (l === audioHistory[i - nValue]);
        letter = l;
      }
      
      visualHistory.push(position);
      audioHistory.push(letter);
      
      newTrials.push({
        position,
        letter,
        visualMatch,
        audioMatch,
        visualLure,
        audioLure
      });
    }
    
    return newTrials;
  }, [nValue, TOTAL_TRIALS, GRID_SIZE, LETTERS, MATCH_FREQUENCY, INTERFERENCE_LEVEL]);
  
  // Calculate final score for each channel.
  // Only count a correct hit if the player pressed and the trial is a match.
  // If a trial is a match and no press was made, it's a miss.
  // If a trial is not a match and the player pressed, it's a false alarm.
  // Trials with no match and no response are not counted.
  const calculateFinalScore = useCallback(() => {
    let visualScore = { correct: 0, missed: 0, falseAlarms: 0 };
    let audioScore = { correct: 0, missed: 0, falseAlarms: 0 };
    
    for (let i = 0; i < trials.length; i++) {
      const trial = trials[i];
      const visualResponse = visualResponsesRef.current[i];
      const audioResponse = audioResponsesRef.current[i];
      
      // Visual scoring
      if (visualResponse) {
        if (trial.visualMatch) {
          visualScore.correct++;
        } else {
          visualScore.falseAlarms++;
        }
      } else {
        if (trial.visualMatch) {
          visualScore.missed++;
        }
      }
      
      // Audio scoring
      if (audioResponse) {
        if (trial.audioMatch) {
          audioScore.correct++;
        } else {
          audioScore.falseAlarms++;
        }
      } else {
        if (trial.audioMatch) {
          audioScore.missed++;
        }
      }
    }
    
    setScore({ visual: visualScore, audio: audioScore });
    setGameState('result');
  }, [trials]);
  
  // Advance to the next trial (with a 0.1 second break)
  const advanceTrial = useCallback(() => {
    setIsBreak(true);
    breakTimerRef.current = setTimeout(() => {
      setIsBreak(false);
      setCurrentTrial(prev => {
        const next = prev + 1;
        return next >= TOTAL_TRIALS ? prev : next;
      });
    }, 100);
  }, [TOTAL_TRIALS]);
  
  // Start a new game
  const startGame = useCallback(() => {
    clearTimeout(timerRef.current);
    clearTimeout(breakTimerRef.current);
    window.speechSynthesis.cancel();
    
    const newTrials = generateTrials();
    setTrials(newTrials);
    setScore({
      visual: { correct: 0, missed: 0, falseAlarms: 0 },
      audio: { correct: 0, missed: 0, falseAlarms: 0 }
    });
    setVisualResponses(Array(TOTAL_TRIALS).fill(false));
    setAudioResponses(Array(TOTAL_TRIALS).fill(false));
    setIsBreak(false);
    setCurrentTrial(0);
    setGameState('playing');
    
    if (gameRef.current) {
      gameRef.current.focus();
    }
  }, [generateTrials, TOTAL_TRIALS]);
  
  // Handle keyboard inputs
  const handleKeyDown = useCallback((e) => {
    if (gameState !== 'playing' || isBreak) return;
    
    if (e.key === 'a' || e.key === 'A') {
      setVisualResponses(prev => {
        const newResponses = [...prev];
        newResponses[currentTrial] = true;
        return newResponses;
      });
    } else if (e.key === 'l' || e.key === 'L') {
      setAudioResponses(prev => {
        const newResponses = [...prev];
        newResponses[currentTrial] = true;
        return newResponses;
      });
    } else if (e.key === ' ') {
      clearTimeout(timerRef.current);
      clearTimeout(breakTimerRef.current);
      startGame();
    }
  }, [gameState, currentTrial, isBreak, startGame]);
  
  // Play audio for the current trial
  useEffect(() => {
    if (gameState === 'playing' && currentTrial < trials.length) {
      const speak = () => {
        if (audioRef.current) {
          audioRef.current.text = trials[currentTrial].letter.toLowerCase();
          speechSynthesis.speak(audioRef.current);
        }
      };
      
      audioRef.current = new SpeechSynthesisUtterance();
      audioRef.current.volume = 1;
      audioRef.current.rate = 1;
      audioRef.current.pitch = 1;
      
      window.speechSynthesis.cancel();
      speak();
    }
  }, [gameState, currentTrial, trials]);
  
  // Timer for advancing trials automatically
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const startTrialTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerStartRef.current = Date.now();
      
      if (currentTrial < TOTAL_TRIALS - 1) {
        timerRef.current = setTimeout(() => {
          advanceTrial();
        }, TRIAL_DURATION);
      } else if (currentTrial === TOTAL_TRIALS - 1) {
        timerRef.current = setTimeout(() => {
          calculateFinalScore();
        }, TRIAL_DURATION);
      }
    };
    
    if (!isBreak) startTrialTimer();
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [gameState, currentTrial, isBreak, TOTAL_TRIALS, TRIAL_DURATION, advanceTrial, calculateFinalScore]);
  
  // Keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.speechSynthesis.cancel();
    };
  }, [handleKeyDown]);
  
  // Start Screen Component
  const StartScreen = () => (
    <div className="screen start-screen">
      <div className="help-button-container">
        <button className="help-button" onClick={() => setGameState('help')}>
          ?
        </button>
      </div>
      <h1>Dual N-Back Game</h1>
      <div className="n-selector">
        <label htmlFor="n-value">N Value:</label>
        <input
          id="n-value"
          type="number"
          min="1"
          max="9"
          value={nValue}
          onChange={(e) => setNValue(Math.max(1, Math.min(9, parseInt(e.target.value) || 1)))}
        />
      </div>
      <button className="play-button" onClick={startGame}>Play</button>
      <div className="instructions">
        <h3>Instructions:</h3>
        <p>Press 'A' if the position matches the position N trials back.</p>
        <p>Press 'L' if the letter matches the letter N trials back.</p>
        <p>Press Space to restart the game at any time.</p>
      </div>
    </div>
  );

  // Help Screen Component
  const HelpScreen = () => (
    <div className="screen help-screen">
      <h1>How to Play Dual N-Back</h1>
      
      <div className="help-section">
        <h2>Game Overview</h2>
        <p>
          Dual N-Back is a cognitive training exercise that challenges your working memory and attention.
          The game presents two types of stimuli simultaneously - visual (position) and auditory (letters).
        </p>
      </div>
      
      <div className="help-section">
        <h2>How It Works</h2>
        <ol>
          <li>Each trial shows a blue square in one of nine positions and plays a letter sound.</li>
          <li>You need to remember both the position and the letter.</li>
          <li>For each new trial, you must decide if either the position, letter, both, or neither match what appeared exactly N trials back.</li>
          <li>The N value is adjustable - higher values make the game more difficult.</li>
        </ol>
      </div>
      
      <div className="help-section">
        <h2>Controls</h2>
        <ul>
          <li><strong>Press 'A'</strong> or click "Position" if the current square position matches the position from N trials back.</li>
          <li><strong>Press 'L'</strong> or click "Letter" if the current letter matches the letter from N trials back.</li>
          <li><strong>Press Space</strong> at any time to restart the game.</li>
        </ul>
      </div>
      
      <div className="help-section">
        <h2>Scoring</h2>
        <p>Your performance is measured separately for visual and audio channels:</p>
        <ul>
          <li><strong>Correct Matches:</strong> When you correctly identify a match.</li>
          <li><strong>Missed Matches:</strong> When there was a match but you didn't respond.</li>
          <li><strong>False Alarms:</strong> When you responded but there was no match.</li>
        </ul>
      </div>
      
      <div className="help-section">
        <h2>Tips</h2>
        <ul>
          <li>Start with N=2 before trying higher values.</li>
          <li>Regular practice can improve your working memory.</li>
          <li>Focus on both types of stimuli equally.</li>
          <li>Try to develop a strategy that works for you to track the patterns.</li>
        </ul>
      </div>
      
      <button className="back-button" onClick={() => setGameState('start')}>
        Back to Start
      </button>
    </div>
  );
  
  // Game Screen Component
  const GameScreen = () => {
    const currentPosition = trials[currentTrial]?.position || { row: 0, col: 0 };
    
    const handlePositionClick = () => {
      if (gameState === 'playing' && !isBreak) {
        setVisualResponses(prev => {
          const newResponses = [...prev];
          newResponses[currentTrial] = true;
          return newResponses;
        });
      }
    };
    
    const handleLetterClick = () => {
      if (gameState === 'playing' && !isBreak) {
        setAudioResponses(prev => {
          const newResponses = [...prev];
          newResponses[currentTrial] = true;
          return newResponses;
        });
      }
    };
    
    return (
      <div className="screen game-screen" ref={gameRef} tabIndex={0}>
        <div className="game-info">
          <div className="n-value">N = {nValue}</div>
          <div className="trial-counter">Trial: {currentTrial + 1} / {TOTAL_TRIALS}</div>
        </div>
        <div className="grid-container">
          {Array(GRID_SIZE).fill().map((_, rowIndex) => (
            <div key={`row-${rowIndex}`} className="grid-row">
              {Array(GRID_SIZE).fill().map((_, colIndex) => (
                <div
                  key={`cell-${rowIndex}-${colIndex}`}
                  className={`grid-cell ${currentPosition.row === rowIndex && currentPosition.col === colIndex && !isBreak ? 'active' : ''}`}
                ></div>
              ))}
            </div>
          ))}
        </div>
        <div className="response-indicators">
          <div className={`indicator visual ${visualResponses[currentTrial] ? 'active' : ''}`} onClick={handlePositionClick}>
            Position (A)
          </div>
          <div className={`indicator audio ${audioResponses[currentTrial] ? 'active' : ''}`} onClick={handleLetterClick}>
            Letter (L)
          </div>
        </div>
      </div>
    );
  };
  
  // Result Screen Component (separate visual and audio results)
  const ResultScreen = () => {
    // Denominator is only the sum of (correct + misses + false alarms)
    const visualTotal = score.visual.correct + score.visual.missed + score.visual.falseAlarms;
    const audioTotal = score.audio.correct + score.audio.missed + score.audio.falseAlarms;
    const visualScorePercentage = visualTotal > 0 ? Math.round((score.visual.correct / visualTotal) * 100) : 0;
    const audioScorePercentage = audioTotal > 0 ? Math.round((score.audio.correct / audioTotal) * 100) : 0;
    
    return (
      <div className="screen result-screen">
        <h2>Game Results</h2>
        <div className="results">
          <h3>Visual (Position) Results</h3>
          <div className="result-item">
            <span>Correct Matches:</span>
            <span>{score.visual.correct}</span>
          </div>
          <div className="result-item">
            <span>Missed Matches:</span>
            <span>{score.visual.missed}</span>
          </div>
          <div className="result-item">
            <span>False Alarms:</span>
            <span>{score.visual.falseAlarms}</span>
          </div>
          <div className="result-item score">
            <span>Score:</span>
            <span>{visualScorePercentage}%</span>
          </div>
          <h3>Audio (Letter) Results</h3>
          <div className="result-item">
            <span>Correct Matches:</span>
            <span>{score.audio.correct}</span>
          </div>
          <div className="result-item">
            <span>Missed Matches:</span>
            <span>{score.audio.missed}</span>
          </div>
          <div className="result-item">
            <span>False Alarms:</span>
            <span>{score.audio.falseAlarms}</span>
          </div>
          <div className="result-item score">
            <span>Score:</span>
            <span>{audioScorePercentage}%</span>
          </div>
        </div>
        <button className="play-again-button" onClick={startGame}>Play Again</button>
        <button className="back-button" onClick={() => setGameState('start')}>Back to Start</button>
      </div>
    );
  };
  
  return (
    <div className="dual-n-back-container">
      {gameState === 'start' && <StartScreen />}
      {gameState === 'playing' && <GameScreen />}
      {gameState === 'result' && <ResultScreen />}
      {gameState === 'help' && <HelpScreen />}
      
      <style jsx>{`
        .dual-n-back-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100vh;
          background-color: #f5f5f5;
          font-family: 'Arial', sans-serif;
        }
        .screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 600px;
          padding: 2rem;
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          position: relative;
        }
        .help-button-container {
          position: absolute;
          top: 1rem;
          right: 1rem;
        }
        .help-button {
          width: 35px;
          height: 35px;
          border-radius: 50%;
          background-color: #2196F3;
          color: white;
          font-weight: bold;
          font-size: 1.2rem;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .help-button:hover {
          background-color: #0d8bf2;
        }
        .start-screen h1 {
          margin-bottom: 2rem;
          color: #333;
        }
        .n-selector {
          display: flex;
          align-items: center;
          margin-bottom: 2rem;
        }
        .n-selector label {
          margin-right: 1rem;
          font-size: 1.2rem;
        }
        .n-selector input {
          width: 60px;
          height: 40px;
          font-size: 1.2rem;
          text-align: center;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .play-button, .play-again-button, .back-button {
          padding: 0.8rem 2rem;
          font-size: 1.2rem;
          color: white;
          background-color: #4CAF50;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.3s;
          margin: 0.5rem;
        }
        .play-button:hover, .play-again-button:hover {
          background-color: #45a049;
        }
        .back-button {
          background-color: #f44336;
        }
        .back-button:hover {
          background-color: #d32f2f;
        }
        .instructions {
          margin-top: 2rem;
          text-align: center;
        }
        .instructions h3 {
          margin-bottom: 1rem;
        }
        .instructions p {
          margin: 0.5rem 0;
        }
        .game-screen {
          position: relative;
        }
        .game-info {
          display: flex;
          justify-content: space-between;
          width: 100%;
          margin-bottom: 1rem;
        }
        .n-value, .trial-counter {
          font-size: 1.2rem;
          font-weight: bold;
        }
        .grid-container {
          display: flex;
          flex-direction: column;
          margin: 2rem 0;
        }
        .grid-row {
          display: flex;
        }
        .grid-cell {
          width: 80px;
          height: 80px;
          border: 1px solid #ddd;
          margin: 2px;
          background-color: #f9f9f9;
          transition: background-color 0.3s;
        }
        .grid-cell.active {
          background-color: #2196F3;
        }
        .response-indicators {
          display: flex;
          justify-content: space-around;
          width: 100%;
          margin-top: 1rem;
        }
        .indicator {
          padding: 0.5rem 1rem;
          margin: 0 0.5rem;
          border-radius: 4px;
          background-color: #ddd;
          transition: background-color 0.3s;
          cursor: pointer;
          user-select: none;
        }
        .indicator:hover {
          background-color: #ccc;
        }
        .indicator.active {
          background-color: #4CAF50;
          color: white;
        }
        .result-screen {
          text-align: center;
        }
        .result-screen h2 {
          margin-bottom: 2rem;
          color: #333;
        }
        .results {
          width: 100%;
          margin-bottom: 2rem;
        }
        .result-item {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px solid #eee;
        }
        .result-item.score {
          margin-top: 1rem;
          font-size: 1.5rem;
          font-weight: bold;
          border-bottom: none;
        }
        .help-screen {
          max-width: 800px;
          max-height: 80vh;
          overflow-y: auto;
          padding: 2rem;
        }
        .help-screen h1 {
          color: #2196F3;
          margin-bottom: 1.5rem;
          text-align: center;
        }
        .help-section {
          margin-bottom: 2rem;
          text-align: left;
          width: 100%;
        }
        .help-section h2 {
          color: #333;
          border-bottom: 2px solid #eee;
          padding-bottom: 0.5rem;
          margin-bottom: 1rem;
        }
        .help-section p, .help-section li {
          margin-bottom: 0.5rem;
          line-height: 1.5;
        }
        .help-section ul, .help-section ol {
          padding-left: 1.5rem;
        }
      `}</style>
    </div>
  );
};

export default DualNBackGame;
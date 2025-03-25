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
  
  // Theme state
  const [darkMode, setDarkMode] = useState(false);
  
  // Constants
  const TOTAL_TRIALS = 20 + nValue;
  const GRID_SIZE = 3;
  const TRIAL_DURATION = 3000; // milliseconds
  
  // Using useMemo for arrays to prevent recreation on every render
  const LETTERS = useMemo(() => ['c', 'h', 'k', 'l', 'q', 'r', 's', 't'], []);
  
  // Adapted from brainworkshop.py
  const CHANCE_OF_GUARANTEED_MATCH = 0.125; // From brainworkshop's default
  const CHANCE_OF_INTERFERENCE = 0.125; // From brainworkshop's default
  
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
  
  // Add dark mode persistence
  useEffect(() => {
    const savedTheme = localStorage.getItem('dualNBackTheme');
    if (savedTheme) {
      setDarkMode(savedTheme === 'dark');
    } else {
      // Check if user prefers dark mode
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(prefersDark);
    }
  }, []);
  
  // Save theme preference
  useEffect(() => {
    localStorage.setItem('dualNBackTheme', darkMode ? 'dark' : 'light');
    
    // Apply dark mode to body for complete theme coverage
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    
    return () => {
      document.body.classList.remove('dark-mode');
    };
  }, [darkMode]);
  
  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };
  
  // Generate trials using brainworkshop's algorithm
  const generateTrials = useCallback(() => {
    // Following brainworkshop's compute_bt_sequence() logic for Jaeggi mode
    // but adapting it to be more flexible
    
    const visualSequence = [];
    const audioSequence = [];
    const newTrials = [];
    
    // First generate the n initial trials without matches
    for (let i = 0; i < nValue; i++) {
      const position = {
        row: Math.floor(Math.random() * GRID_SIZE),
        col: Math.floor(Math.random() * GRID_SIZE)
      };
      const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
      
      visualSequence.push(position);
      audioSequence.push(letter);
      
      newTrials.push({
        position,
        letter,
        visualMatch: false,
        audioMatch: false,
        visualLure: false,
        audioLure: false
      });
    }
    
    // Target match counts for the remaining trials
    const remainingTrials = TOTAL_TRIALS - nValue;
    // In Jaeggi mode, brainworkshop uses exactly 6 position matches, 6 audio matches
    // with 2 simultaneous matches. We'll set a percentage based on total trials.
    const targetVisualMatches = Math.round(remainingTrials * 0.3); // ~30% match rate
    const targetAudioMatches = Math.round(remainingTrials * 0.3);
    const targetBothMatches = Math.min(2, Math.floor(remainingTrials * 0.1)); // Similar to brainworkshop's 2 out of 20+
    
    // Initialize match counters
    let visualMatches = 0;
    let audioMatches = 0;
    let bothMatches = 0;
    
    // Use a brute force approach like in compute_bt_sequence()
    let attempts = 0;
    const maxAttempts = 1000; // Safety mechanism
    
    while ((visualMatches !== targetVisualMatches || 
            audioMatches !== targetAudioMatches || 
            bothMatches !== targetBothMatches) && 
           attempts < maxAttempts) {
      
      attempts++;
      
      // Reset trial generation after the initial n trials
      newTrials.length = nValue;
      visualSequence.length = nValue;
      audioSequence.length = nValue;
      visualMatches = 0;
      audioMatches = 0;
      bothMatches = 0;
      
      // Generate the remaining trials
      for (let i = nValue; i < TOTAL_TRIALS; i++) {
        let position, letter;
        let visualMatch = false;
        let audioMatch = false;
        let visualLure = false;
        let audioLure = false;
        
        // Visual stimulus (position)
        // Decide if this should be a match, based on match count needed and random chance
        if ((visualMatches < targetVisualMatches) && 
            (Math.random() < CHANCE_OF_GUARANTEED_MATCH || 
             (visualMatches < targetVisualMatches - (TOTAL_TRIALS - i)))) {
          // Force a match to meet our target
          position = { ...visualSequence[i - nValue] };
          visualMatch = true;
          visualMatches++;
        } else if (Math.random() < CHANCE_OF_INTERFERENCE && i > nValue + 1) {
          // Create a lure trial (n+1 or n-1 back)
          // This follows brainworkshop's logic for interference
          const interferenceOptions = [-1, 1, nValue];
          const lureOffset = interferenceOptions[Math.floor(Math.random() * interferenceOptions.length)];
          
          if (i - nValue - lureOffset >= 0 && i - nValue - lureOffset < visualSequence.length) {
            // Check that it doesn't create an accidental n-back match
            const lurePosition = visualSequence[i - nValue - lureOffset];
            const nBackPosition = visualSequence[i - nValue];
            
            if (!(lurePosition.row === nBackPosition.row && lurePosition.col === nBackPosition.col)) {
              position = { ...lurePosition };
              visualLure = true;
            } else {
              // Generate a random position
              position = {
                row: Math.floor(Math.random() * GRID_SIZE),
                col: Math.floor(Math.random() * GRID_SIZE)
              };
            }
          } else {
            // Fallback to random position
            position = {
              row: Math.floor(Math.random() * GRID_SIZE),
              col: Math.floor(Math.random() * GRID_SIZE)
            };
          }
        } else {
          // Generate a non-matching position
          let newPosition;
          do {
            newPosition = {
              row: Math.floor(Math.random() * GRID_SIZE),
              col: Math.floor(Math.random() * GRID_SIZE)
            };
          } while (
            newPosition.row === visualSequence[i - nValue].row && 
            newPosition.col === visualSequence[i - nValue].col
          );
          position = newPosition;
        }
        
        // Audio stimulus (letter)
        // Similar logic as for visual
        if ((audioMatches < targetAudioMatches) && 
            (Math.random() < CHANCE_OF_GUARANTEED_MATCH || 
             (audioMatches < targetAudioMatches - (TOTAL_TRIALS - i)))) {
          // Force a match to meet our target
          letter = audioSequence[i - nValue];
          audioMatch = true;
          audioMatches++;
        } else if (Math.random() < CHANCE_OF_INTERFERENCE && i > nValue + 1) {
          // Create a lure trial
          const interferenceOptions = [-1, 1, nValue];
          const lureOffset = interferenceOptions[Math.floor(Math.random() * interferenceOptions.length)];
          
          if (i - nValue - lureOffset >= 0 && i - nValue - lureOffset < audioSequence.length) {
            const lureLetter = audioSequence[i - nValue - lureOffset];
            const nBackLetter = audioSequence[i - nValue];
            
            if (lureLetter !== nBackLetter) {
              letter = lureLetter;
              audioLure = true;
            } else {
              // Get a random letter that's not a match
              let randomLetter;
              do {
                randomLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
              } while (randomLetter === nBackLetter);
              letter = randomLetter;
            }
          } else {
            // Fallback to random letter
            letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
          }
        } else {
          // Generate a non-matching letter
          let newLetter;
          do {
            newLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
          } while (newLetter === audioSequence[i - nValue]);
          letter = newLetter;
        }
        
        // Check and adjust for combined matches
        if (visualMatch && audioMatch) {
          bothMatches++;
          
          // If we already have enough combined matches, undo one of them
          if (bothMatches > targetBothMatches) {
            // Decide which one to undo
            if (Math.random() < 0.5 && visualMatches > 1) {
              // Undo visual match
              visualMatch = false;
              visualMatches--;
              
              // Generate a new non-matching position
              let newPosition;
              do {
                newPosition = {
                  row: Math.floor(Math.random() * GRID_SIZE),
                  col: Math.floor(Math.random() * GRID_SIZE)
                };
              } while (
                newPosition.row === visualSequence[i - nValue].row && 
                newPosition.col === visualSequence[i - nValue].col
              );
              position = newPosition;
            } else if (audioMatches > 1) {
              // Undo audio match
              audioMatch = false;
              audioMatches--;
              
              // Generate a new non-matching letter
              let newLetter;
              do {
                newLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
              } while (newLetter === audioSequence[i - nValue]);
              letter = newLetter;
            }
            bothMatches--;
          }
        }
        
        // If we need more combined matches and we're running out of trials
        if (bothMatches < targetBothMatches && i >= TOTAL_TRIALS - (targetBothMatches - bothMatches) * 2) {
          // Force both to match
          position = { ...visualSequence[i - nValue] };
          letter = audioSequence[i - nValue];
          visualMatch = true;
          audioMatch = true;
          
          // Update counters (avoid double counting)
          if (!visualMatch) visualMatches++;
          if (!audioMatch) audioMatches++;
          bothMatches++;
        }
        
        // Add to sequences
        visualSequence.push(position);
        audioSequence.push(letter);
        
        // Add trial
        newTrials.push({
          position,
          letter,
          visualMatch,
          audioMatch,
          visualLure,
          audioLure
        });
      }
    }
    
    if (attempts >= maxAttempts) {
      console.warn('Could not generate ideal trial distribution after maximum attempts');
    }
    
    // Verify and log the distribution (for debugging)
    const finalVisualMatches = newTrials.filter(t => t.visualMatch).length;
    const finalAudioMatches = newTrials.filter(t => t.audioMatch).length;
    const finalBothMatches = newTrials.filter(t => t.visualMatch && t.audioMatch).length;
    console.log(`Generated: ${finalVisualMatches} visual, ${finalAudioMatches} audio, ${finalBothMatches} both matches`);
    
    return newTrials;
  }, [nValue, TOTAL_TRIALS, GRID_SIZE, LETTERS]);
  
  // Calculate final score for each channel
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
  
  // Advance to the next trial
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
  
  // Timer for advancing trials
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
  
  // Theme toggle button
  const ThemeToggle = () => (
    <button 
      className={`theme-toggle ${darkMode ? 'dark' : 'light'}`}
      onClick={toggleDarkMode}
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {darkMode ? '☀️' : '🌙'}
    </button>
  );
  
  // Start Screen Component
  const StartScreen = () => (
    <div className="screen start-screen">
      <div className="top-controls">
        <button className="help-button" onClick={() => setGameState('help')}>
          ?
        </button>
        <ThemeToggle />
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
      <div className="top-controls right-aligned">
        <ThemeToggle />
      </div>
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
        <div className="game-header">
          <div className="game-info">
            <div className="n-value">N = {nValue}</div>
            <div className="trial-counter">Trial: {currentTrial + 1} / {TOTAL_TRIALS}</div>
          </div>
          <div className="game-controls">
            <button className="quit-button" onClick={() => setGameState('start')}>Quit</button>
            <ThemeToggle />
          </div>
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
  
  // Result Screen Component
  const ResultScreen = () => {
    // Denominator is only the sum of (correct + misses + false alarms)
    const visualTotal = score.visual.correct + score.visual.missed + score.visual.falseAlarms;
    const audioTotal = score.audio.correct + score.audio.missed + score.audio.falseAlarms;
    const visualScorePercentage = visualTotal > 0 ? Math.round((score.visual.correct / visualTotal) * 100) : 0;
    const audioScorePercentage = audioTotal > 0 ? Math.round((score.audio.correct / audioTotal) * 100) : 0;
    
    return (
      <div className="screen result-screen">
        <div className="top-controls right-aligned">
          <ThemeToggle />
        </div>
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
        <div className="result-buttons">
          <button className="play-again-button" onClick={startGame}>Play Again</button>
          <button className="back-button" onClick={() => setGameState('start')}>Back to Start</button>
        </div>
      </div>
    );
  };
  
  return (
    <div className={`dual-n-back-container ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      {gameState === 'start' && <StartScreen />}
      {gameState === 'playing' && <GameScreen />}
      {gameState === 'result' && <ResultScreen />}
      {gameState === 'help' && <HelpScreen />}
      
      <style jsx>{`
        /* CSS variables for theming */
        .light-theme {
          --bg-color: #f5f5f5;
          --card-bg: #ffffff;
          --text-color: #333333;
          --border-color: #dddddd;
          --primary-color: #2196F3;
          --primary-hover: #0d8bf2;
          --success-color: #4CAF50;
          --success-hover: #45a049;
          --danger-color: #f44336;
          --danger-hover: #d32f2f;
          --cell-bg: #f9f9f9;
          --cell-active: #2196F3;
          --indicator-bg: #dddddd;
          --indicator-active: #4CAF50;
          --indicator-hover: #cccccc;
          --result-border: #eeeeee;
          --box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .dark-theme {
          --bg-color: #1a1a1a;
          --card-bg: #2d2d2d;
          --text-color: #e5e5e5;
          --border-color: #444444;
          --primary-color: #8c52ff;
          --primary-hover: #7a42e5;
          --success-color: #3bbc60;
          --success-hover: #309e4f;
          --danger-color: #e5534b;
          --danger-hover: #c6433d;
          --cell-bg: #3d3d3d;
          --cell-active: #8c52ff;
          --indicator-bg: #444444;
          --indicator-active: #3bbc60;
          --indicator-hover: #555555;
          --result-border: #444444;
          --box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        
        /* Base container styles */
        .dual-n-back-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 100vh;
          background-color: var(--bg-color);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          color: var(--text-color);
          transition: all 0.3s ease;
          padding: 0.5rem;
          box-sizing: border-box;
        }
        
        .screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 600px;
          padding: 1.5rem;
          background-color: var(--card-bg);
          border-radius: 8px;
          box-shadow: var(--box-shadow);
          position: relative;
          transition: all 0.3s ease;
          margin-top: 1rem;
          box-sizing: border-box;
        }
        
        .top-controls {
          display: flex;
          position: absolute;
          top: 1rem;
          right: 1rem;
          z-index: 10;
        }
        
        .right-aligned {
          right: 1rem;
          left: auto;
        }
        
        .theme-toggle {
          width: 35px;
          height: 35px;
          border-radius: 50%;
          background-color: var(--primary-color);
          color: white;
          font-weight: bold;
          font-size: 1.2rem;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          margin-left: 0.5rem;
          transition: all 0.3s ease;
        }
        
        .theme-toggle:hover {
          background-color: var(--primary-hover);
        }
        
        .help-button {
          width: 35px;
          height: 35px;
          border-radius: 50%;
          background-color: var(--primary-color);
          color: white;
          font-weight: bold;
          font-size: 1.2rem;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: all 0.3s ease;
        }
        
        .help-button:hover {
          background-color: var(--primary-hover);
        }
        
        .start-screen h1, .help-screen h1 {
          margin-bottom: 2rem;
          color: var(--text-color);
          transition: color 0.3s ease;
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
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background-color: var(--bg-color);
          color: var(--text-color);
          transition: all 0.3s ease;
        }
        
        .play-button, .play-again-button, .back-button {
          padding: 0.8rem 2rem;
          font-size: 1.2rem;
          color: white;
          background-color: var(--success-color);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.3s;
          margin: 0.5rem;
          font-family: inherit;
        }
        
        .play-button:hover, .play-again-button:hover {
          background-color: var(--success-hover);
        }
        
        .back-button {
          background-color: var(--danger-color);
        }
        
        .back-button:hover {
          background-color: var(--danger-hover);
        }
        
        .instructions {
          margin-top: 2rem;
          text-align: center;
        }
        
        .instructions h3 {
          margin-bottom: 1rem;
          color: var(--text-color);
        }
        
        .instructions p {
          margin: 0.5rem 0;
          color: var(--text-color);
        }
        
        .game-screen {
          position: relative;
        }
        
        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          margin-bottom: 1rem;
          margin-top: 1rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        
        .game-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .quit-button {
          padding: 0.4rem 1rem;
          font-size: 1rem;
          color: white;
          background-color: var(--danger-color);
          border: none;
          border-radius: 4px;
          transition: background-color 0.3s;
        }
        
        .quit-button:hover {
          background-color: var(--danger-hover);
        }
        
        .game-info {
          display: flex;
          justify-content: space-between;
          width: 60%;
        }
        
        .n-value, .trial-counter {
          font-size: 1.2rem;
          font-weight: 500;
        }
        
        /* Responsive design for grid sizes */
        .grid-container {
          display: flex;
          flex-direction: column;
          margin: 2rem 0;
          width: 100%;
          max-width: 320px;
          aspect-ratio: 1/1;
        }
        
        .grid-row {
          display: flex;
          flex: 1;
        }
        
        .grid-cell {
          flex: 1;
          border: 1px solid var(--border-color);
          margin: 2px;
          background-color: var(--cell-bg);
          transition: background-color 0.3s;
          aspect-ratio: 1/1;
        }
        
        .grid-cell.active {
          background-color: var(--cell-active);
        }
        
        .response-indicators {
          display: flex;
          justify-content: space-around;
          width: 100%;
          margin-top: 1rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        
        .indicator {
          flex: 1;
          min-width: 120px;
          padding: 0.8rem 0.5rem;
          margin: 0 0.5rem;
          border-radius: 4px;
          background-color: var(--indicator-bg);
          transition: all 0.3s ease;
          cursor: pointer;
          user-select: none;
          font-weight: 500;
          text-align: center;
        }
        
        .indicator:hover {
          background-color: var(--indicator-hover);
        }
        
        .indicator.active {
          background-color: var(--indicator-active);
          color: white;
        }
        
        .result-screen {
          text-align: center;
        }
        
        .result-screen h2 {
          margin-bottom: 1.5rem;
          color: var(--text-color);
          margin-top: 1rem;
        }
        
        .results {
          width: 100%;
          margin-bottom: 1.5rem;
          padding: 0 0.5rem;
          box-sizing: border-box;
        }
        
        .result-item {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--result-border);
        }
        
        .result-item.score {
          margin-top: 1rem;
          font-size: 1.5rem;
          font-weight: 600;
          border-bottom: none;
        }
        
        .result-buttons {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          width: 100%;
          gap: 0.5rem;
        }
        
        .help-screen {
          max-width: 800px;
          max-height: 80vh;
          overflow-y: auto;
          padding: 1.5rem;
          width: 100%;
          box-sizing: border-box;
        }
        
        .help-screen h1 {
          color: var(--primary-color);
          margin-bottom: 1.5rem;
          text-align: center;
          margin-top: 1rem;
        }
        
        .help-section {
          margin-bottom: 2rem;
          text-align: left;
          width: 100%;
        }
        
        .help-section h2 {
          color: var(--text-color);
          border-bottom: 2px solid var(--border-color);
          padding-bottom: 0.5rem;
          margin-bottom: 1rem;
        }
        
        .help-section p, .help-section li {
          margin-bottom: 0.5rem;
          line-height: 1.5;
          color: var(--text-color);
        }
        
        .help-section ul, .help-section ol {
          padding-left: 1.5rem;
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
          .screen {
            padding: 1rem;
            margin-top: 0.5rem;
            width: 95%;
          }
          
          .grid-container {
            margin: 1rem 0;
          }
          
          .game-info {
            width: 100%;
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
          
          .result-buttons {
            flex-direction: row; /* Keep buttons horizontal */
            flex-wrap: wrap;
            justify-content: center;
            width: 100%;
          }
          
          .play-button, .play-again-button, .back-button {
            width: auto; /* Allow natural width */
            min-width: 120px;
            margin: 0.3rem 0.5rem;
          }
          
          h1 {
            font-size: 1.5rem;
            margin-top: 3rem; /* Add more space at the top for the controls */
          }
          
          h2 {
            font-size: 1.3rem;
          }
          
          .top-controls {
            top: 0.5rem;
            right: 0.5rem;
          }
        }
        
        @media (max-width: 480px) {
          .response-indicators {
            flex-direction: row; /* Keep buttons horizontal */
            flex-wrap: wrap;
            justify-content: center;
          }
          
          .indicator {
            margin: 0.3rem 0.5rem;
            width: auto; /* Allow natural width */
            min-width: 120px; /* Set minimum width */
            flex: 0 1 auto; /* Don't force equal growth */
          }
          
          .game-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .game-controls {
            align-self: flex-end;
          }
          
          .help-section {
            padding: 0 0.5rem;
          }
          
          .n-selector {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
          
          .n-selector label {
            margin-right: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default DualNBackGame;
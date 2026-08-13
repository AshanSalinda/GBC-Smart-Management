import { useState, useEffect, useRef } from 'react';
import SoundSystem from '../utils/SoundSystem';

// MOCK DATA: Configured to demonstrate live transitions 5 seconds after page load!
const MOCK_TABLES = [
  // T1: 55s elapsed -> Starts as "STARTED", becomes "PLAYING" in 5s
  { id: 1, status: 'busy', player: 'Rahul Mehta', startTime: Date.now() - 55000, duration: 60 * 60000 },

  // T2: 10m 5s left -> Starts as "PLAYING", becomes "ENDING SOON" in 5s
  { id: 2, status: 'busy', player: 'Sarah Connor', startTime: Date.now() - (48 * 60000 + 55000), duration: 60 * 60000 },

  // T3: 55s overdue -> Starts as "TIME UP", becomes "AVAILABLE" in 5s
  { id: 3, status: 'busy', player: 'Alex Rivera', startTime: Date.now() - (59 * 60000 + 55000), duration: 60 * 60000 },

  // T4: Available (No Session)
  { id: 4, status: 'available', player: null, startTime: null, duration: null }
];

// --- HELPER FUNCTIONS ---
const formatTimeRemaining = (start, duration, now) => {
  const end = start + duration;
  const remainingMs = end - now;
  if (remainingMs <= 0) return '00:00:00';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatTimeRange = (start, duration) => {
  const startDate = new Date(start);
  const endDate = new Date(start + duration);

  const formatOpts = { hour: 'numeric', minute: '2-digit', hour12: true };
  return `${startDate.toLocaleTimeString('en-US', formatOpts)} - ${endDate.toLocaleTimeString('en-US', formatOpts)}`;
};

const getProgress = (start, duration, now) => {
  const end = start + duration;
  const elapsed = now - start;
  const percent = (elapsed / duration) * 100;
  return Math.min(Math.max(percent, 0), 100);
};


// --- HEADER CLOCK COMPONENT ---
function HeaderClock({ isConnected, onToggleConnection }) {
  const [now, setNow] = useState(Date.now());
  
  // Use a standard slow tick since this only shows minutes
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const currentTimeStr = new Date(now).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return (
    <header className="px-4 py-4 md:px-[4vw] md:py-[2vh] flex items-center justify-between border-b border-white/5 bg-black backdrop-blur-md flex-shrink-0 z-20 shadow-lg">
      <div className="flex items-center gap-3 md:gap-[1vw]">
        <div className="w-8 h-8 md:w-[6vh] md:h-[6vh] bg-accent text-bg font-display font-bold text-xs md:text-lg md:text-[2.2vh] flex items-center justify-center rounded-xl md:rounded-[1.5vh] shadow-[0_0_2vh_rgba(74,188,109,0.2)]">
          GBC
        </div>
        <div>
          <h1 className="text-lg md:text-[3.5vh] font-display font-bold text-white leading-none">Galle Billiards Club</h1>
          <p className="text-text-dim text-[0.5rem] md:text-[1.2vh] tracking-widest uppercase font-semibold mt-1 md:mt-[0.5vh]">Live Status Board</p>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-[2vw]">
        <div className="flex items-center gap-2 md:gap-[0.8vw] bg-white/5 border border-white/10 px-1.5 py-1.5 md:px-[1.5vw] md:py-[1vh] rounded-full cursor-pointer transition-colors hover:bg-white/10" onClick={onToggleConnection}>
          <div className={`w-2.5 h-2.5 md:w-[1.5vh] md:h-[1.5vh] rounded-full ${isConnected ? 'bg-accent animate-pulse shadow-[0_0_1vh_rgba(74,188,109,0.6)]' : 'bg-danger shadow-[0_0_1vh_rgba(240,82,82,0.6)]'}`} />
          <span className={`hidden sm:inline text-xs md:text-[1.75vh] font-bold tracking-widest uppercase ${isConnected ? 'text-accent' : 'text-danger'}`}>
            {isConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-[1vw] text-md md:text-[4vh] font-display text-white drop-shadow-[0_0_1vh_rgba(255,255,255,0.3)]">
          {currentTimeStr}
        </div>
      </div>
    </header>
  );
}


// --- TABLE CARD COMPONENT ---
function TableCard({ table, onAutoReset, previousStatesRef }) {
  const [now, setNow] = useState(Date.now());

  // High performance internal tick using requestAnimationFrame
  useEffect(() => {
    let frameId;
    const tick = () => {
      setNow(Date.now());
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const isBusy = table.status === 'busy';

  // Safely calculate hook dependencies
  const remainingMs = isBusy ? (table.startTime + table.duration) - now : 0;
  const elapsed = isBusy ? now - table.startTime : 0;
  const totalSeconds = isBusy ? Math.floor(remainingMs / 1000) : 0;

  // Audio and Auto Reset Logic (Must be declared before any early returns!)
  useEffect(() => {
    if (!isBusy) return;

    // 1 minute overdue reset check
    if (remainingMs <= -60000) {
      onAutoReset(table.id);
      return;
    }

    const prevState = previousStatesRef.current[table.id] || {
      alertedStarted: false,
      alertedEndingSoon: false,
      alertedFinal: false,
      alertedEnded: false
    };

    if (elapsed >= 0 && elapsed <= 60000 && !prevState.alertedStarted) {
      SoundSystem.playStarted();
      prevState.alertedStarted = true;
    }
    
    if (totalSeconds <= 600 && totalSeconds > 180 && !prevState.alertedEndingSoon) {
      SoundSystem.playEndingSoon();
      prevState.alertedEndingSoon = true;
    }
    
    if (totalSeconds <= 180 && totalSeconds > 0 && !prevState.alertedFinal) {
      SoundSystem.playFinalMinutes();
      prevState.alertedFinal = true;
    }
    
    if (totalSeconds <= 0 && !prevState.alertedEnded) {
      SoundSystem.playEnded();
      prevState.alertedEnded = true;
    }
    
    previousStatesRef.current[table.id] = prevState;
  }, [isBusy, now, table.id, elapsed, totalSeconds, remainingMs, onAutoReset, previousStatesRef]);

  if (!isBusy) {
    // Render Available Card
    return (
      <div className="relative min-h-[220px] md:min-h-0 rounded-3xl md:rounded-[3vh] overflow-hidden flex flex-col bg-accent/[0.04] md:backdrop-blur-[2vh] border border-accent/20 shadow-[0_2vh_4vh_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(74,188,109,0.15)] transition-colors duration-1000">
        <div className="p-5 md:p-[3.5vh] flex-1 flex flex-col z-10 relative">
          <div className="flex justify-between items-start">
            <h2 className="text-4xl md:text-[6vh] font-display font-black text-white/60 tracking-tighter leading-none drop-shadow-sm">
              T{table.id}
            </h2>
            <div className="px-3 py-1 md:px-[2vh] md:py-[0.8vh] rounded-full border border-accent/20 bg-accent/10 text-accent shadow-[inset_0_1px_1px_rgba(74,188,109,0.2)] font-bold text-[0.65rem] md:text-[1.5vh] tracking-widest uppercase">
              AVAILABLE
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center items-center text-center py-6 md:py-0">
            <div className="w-16 h-16 md:w-[10vh] md:h-[10vh] rounded-full border border-accent/30 bg-accent/5 flex items-center justify-center mb-4 md:mb-[3vh] shadow-[inset_0_1px_5px_rgba(74,188,109,0.2)]">
              <div className="w-6 h-6 md:w-[4vh] md:h-[4vh] rounded-full bg-accent/40 animate-pulse blur-sm md:blur-[0.3vh]" />
            </div>
            <h3 className="text-2xl md:text-[4vh] font-display font-light text-white/80 tracking-widest uppercase mb-2 md:mb-[1vh] drop-shadow-md">
              Ready to Play
            </h3>
            <p className="text-accent/80 text-xs md:text-[1.8vh] font-medium tracking-widest uppercase max-w-[90%] md:max-w-[80%] leading-relaxed">
              Please visit the front desk to start a session
            </p>
          </div>
        </div>

        <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:w-[30vh] md:h-[30vh] bg-accent rounded-full md:blur-[12vh] pointer-events-none opacity-[0.1]" />
      </div>
    );
  }

  // Busy calculations
  const progress = getProgress(table.startTime, table.duration, now);
  const totalRemainingMins = remainingMs / 60000;

  const isEnded = remainingMs <= 0;
  const isFinalMinutes = !isEnded && totalRemainingMins <= 3;
  const isEndingSoon = !isEnded && !isFinalMinutes && totalRemainingMins <= 10;


  // Determine Colors
  let cardBg = 'bg-gray-500/[0.03] md:backdrop-blur-[2vh]';
  let cardBorder = 'border-gray-500/30 shadow-[0_2vh_4vh_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)]';
  let badgeBg = 'bg-gray-500/20 text-white/70 border-gray-300/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]';
  let badgeText = 'IN PLAY';
  let timerColor = 'text-gray-300 drop-shadow-[0_0_2vh_rgba(255,255,255,0.15)]';
  let progressColor = 'bg-gray-500';
  let glowColor = 'bg-gray-500 opacity-40';

  if (isEndingSoon) {
    cardBg = 'bg-[#ff9f43]/[0.03] md:backdrop-blur-[2vh]';
    cardBorder = 'border-[#ff9f43]/20 shadow-[0_2vh_4vh_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,159,67,0.2)]';
    badgeBg = 'bg-[#ff9f43]/5 text-[#ff9f43] border-[#ff9f43]/20 shadow-[inset_0_1px_1px_rgba(255,159,67,0.2)]';
    badgeText = 'ENDING SOON';
    timerColor = 'text-[#ff9f43] drop-shadow-[0_0_2vh_rgba(255,159,67,0.3)]';
    progressColor = 'bg-[#ff9f43]';
    glowColor = 'bg-[#ff9f43] opacity-20';
  } else if (isFinalMinutes) {
    cardBg = 'bg-[#ff4757]/[0.03] md:backdrop-blur-[2vh]';
    cardBorder = 'border-[#ff4757]/20 shadow-[0_2vh_4vh_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,71,87,0.2)]';
    badgeBg = 'bg-[#ff4757]/10 text-[#ff4757] border-[#ff4757]/30 shadow-[inset_0_1px_1px_rgba(255,71,87,0.2)] animate-pulse';
    badgeText = 'FINAL MINS';
    timerColor = 'text-[#ff4757] drop-shadow-[0_0_2vh_rgba(255,71,87,0.4)]';
    progressColor = 'bg-[#ff4757]';
    glowColor = 'bg-[#ff4757] opacity-30';
  } else if (isEnded) {
    cardBg = 'bg-danger/[0.05] md:backdrop-blur-[2vh]';
    cardBorder = 'border-danger/50 shadow-[0_2vh_4vh_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(240,82,82,0.4)]';
    badgeBg = 'bg-danger/20 text-danger border-danger/50 shadow-[inset_0_1px_1px_rgba(240,82,82,0.4)] animate-pulse';
    badgeText = 'TIME UP';
    timerColor = 'text-danger animate-pulse drop-shadow-[0_0_3vh_rgba(240,82,82,0.5)]';
    progressColor = 'bg-danger';
    glowColor = 'bg-danger opacity-40';
  }

  return (
    <div className={`relative min-h-[220px] md:min-h-0 rounded-3xl md:rounded-[3vh] overflow-hidden flex flex-col ${cardBg} border ${cardBorder} transition-colors duration-1000`}>
      <div className="p-5 md:p-[3.5vh] flex-1 flex flex-col z-10 relative">
        <div className="flex justify-between items-start">
          <h2 className="text-4xl md:text-[6vh] font-display font-black text-white/40 tracking-tighter leading-none drop-shadow-sm">
            T{table.id}
          </h2>
          <div className={`px-3 py-1 md:px-[2vh] md:py-[0.8vh] rounded-full border font-bold text-[0.65rem] md:text-[1.5vh] tracking-widest uppercase ${badgeBg}`}>
            {badgeText}
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center items-center text-center py-6 md:py-0">
          <p className={`text-xs md:text-[1.8vh] font-bold uppercase tracking-widest mb-1 md:mb-[0.5vh] ${isEnded || isFinalMinutes ? 'text-danger' : 'text-text-dim'}`}>
            {isEnded ? 'Overdue By' : 'Time Left'}
          </p>
          <p className={`text-6xl md:text-[12vh] font-display font-medium tracking-tight leading-none tabular-nums ${timerColor} mt-2 md:mt-[1vh]`}>
            {isEnded ? '00:00:00' : formatTimeRemaining(table.startTime, table.duration, now)}
          </p>
        </div>

        <div className="mt-auto border-t border-gray-500/40 pt-3 md:pt-[2vh] flex items-end justify-between">
          <div>
            <p className="text-text-dim text-[0.65rem] md:text-[1.5vh] font-medium uppercase tracking-wider mb-1 md:mb-[0.5vh]">Playing Now</p>
            <p className="text-lg md:text-[3vh] text-white/80 font-bold tracking-tight truncate leading-none max-w-[40vw] md:max-w-[20vw]">
              {table.player}
            </p>
          </div>
          <div className="text-right">
            <p className="text-text-dim text-[0.65rem] md:text-[1.5vh] font-medium uppercase tracking-wider mb-1 md:mb-[0.5vh]">Session</p>
            <p className="text-sm md:text-[2.2vh] text-white/80 font-semibold tracking-wide leading-none">
              {formatTimeRange(table.startTime, table.duration)}
            </p>
          </div>
        </div>
      </div>

      <div className="h-1 md:h-[0.3vh] w-full bg-black/30 relative z-10 flex-shrink-0">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${progressColor}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className={`hidden md:block absolute top-0 right-0 w-48 h-48 md:w-[30vh] md:h-[30vh] rounded-full blur-[64px] md:blur-[20vh] pointer-events-none opacity-20 ${glowColor}`} />
    </div>
  );
}


// --- MAIN APP COMPONENT ---
export default function TvDisplay() {
  const [tables, setTables] = useState(MOCK_TABLES);
  const [isStarted, setIsStarted] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const previousStates = useRef({});

  const handleAutoReset = (tableId) => {
    setTables(current => current.map(t => {
      if (t.id === tableId) {
        if (previousStates.current[tableId]) {
          previousStates.current[tableId] = {
            alertedStarted: false,
            alertedEndingSoon: false,
            alertedFinal: false,
            alertedEnded: false
          };
        }
        return { ...t, status: 'available', player: null, startTime: null, duration: null };
      }
      return t;
    }));
  };

  const handleStart = () => {
    SoundSystem.init();
    setIsStarted(true);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => console.log("Fullscreen denied", err));
    }
  };

  if (!isStarted) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-[6vh] font-display font-black text-white tracking-tighter mb-[4vh]">
          TV Display Ready
        </h1>
        <p className="text-text-dim text-[2vh] max-w-lg mb-[6vh]">
          Click the button below to initialize the audio engine and enter full-screen mode.
        </p>
        <button
          onClick={handleStart}
          className="px-[6vh] py-[3vh] bg-accent/20 border-2 border-accent/40 text-accent font-display text-[3vh] font-bold rounded-[3vh] hover:bg-accent/30 transition-colors shadow-[0_0_4vh_rgba(74,188,109,0.3)] animate-pulse"
        >
          Tap to Start Display
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#070709] text-text-main font-sans overflow-hidden flex flex-col selection:bg-transparent cursor-none relative z-0">
      
      {/* Global Background Blobs for Glassmorphism */}
      <div className="hidden md:block absolute top-0 left-1/3 w-[60vw] h-[60vw] bg-white/[0.02] rounded-full blur-[15vh] pointer-events-none -translate-y-1/2 -z-10" />
      <div className="hidden md:block absolute bottom-0 right-1/4 w-[50vw] h-[50vw] bg-accent/[0.03] rounded-full blur-[15vh] pointer-events-none translate-y-1/2 -z-10" />

      {/* Extracted Header Clock Component */}
      <HeaderClock isConnected={isConnected} onToggleConnection={() => setIsConnected(!isConnected)} />

      <main className="flex-1 p-4 md:p-[2.5vh] flex flex-col items-center overflow-y-auto overflow-x-hidden md:overflow-hidden bg-transparent">
        <div className="grid grid-cols-1 md:grid-cols-2 grid-rows-none md:grid-rows-2 gap-4 md:gap-[2.5vh] h-auto md:h-full w-full max-w-[200vh]">
          {tables.map(table => (
            /* Extracted Table Card Component */
            <TableCard 
              key={table.id} 
              table={table} 
              onAutoReset={handleAutoReset} 
              previousStatesRef={previousStates} 
            />
          ))}
        </div>
      </main>
    </div>
  );
}

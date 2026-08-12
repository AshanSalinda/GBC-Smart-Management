import { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

const MOCK_TABLES = [
  { id: 1, type: 'Pro Pool', status: 'busy', player: 'Rahul Mehta', startTime: Date.now() - 25 * 60000, duration: 60 * 60000 },
  { id: 2, type: 'Snooker', status: 'available', player: null, startTime: null, duration: null },
  { id: 3, type: 'Pro Pool', status: 'busy', player: 'Alex Rivera', startTime: Date.now() - 58 * 60000, duration: 60 * 60000 }, // Near end
  { id: 4, type: 'Carom', status: 'available', player: null, startTime: null, duration: null }
];

// --- Web Audio API Sound System ---
class SoundSystem {
  static ctx = null;
  static init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  static playTone(freq, type, duration, vol = 0.1) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  static playNearEnd() {
    // Double warning beep
    this.playTone(880, 'sine', 0.2, 0.05);
    setTimeout(() => this.playTone(880, 'sine', 0.4, 0.05), 300);
  }

  static playEnded() {
    // Long resonant alert
    this.playTone(440, 'triangle', 0.8, 0.1); 
    setTimeout(() => this.playTone(349.23, 'triangle', 1.2, 0.1), 400); 
  }
}

export default function TvDisplay() {
  const [now, setNow] = useState(Date.now());
  const [tables] = useState(MOCK_TABLES);
  const [isStarted, setIsStarted] = useState(false);
  
  // Track previous states to trigger sounds
  const previousStates = useRef({});

  useEffect(() => {
    if (!isStarted) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isStarted]);

  useEffect(() => {
    if (!isStarted) return;

    tables.forEach(table => {
      if (table.status !== 'busy') return;

      const end = table.startTime + table.duration;
      const remainingMs = end - now;
      const totalSeconds = Math.floor(remainingMs / 1000);
      
      const prevState = previousStates.current[table.id] || { alertedNearEnd: false, alertedEnded: false };
      
      // Near end alert: < 2 minutes remaining
      if (totalSeconds > 0 && totalSeconds <= 120 && !prevState.alertedNearEnd) {
        SoundSystem.playNearEnd();
        previousStates.current[table.id] = { ...prevState, alertedNearEnd: true };
      }
      
      // Ended alert: exactly 0
      if (totalSeconds <= 0 && !prevState.alertedEnded) {
        SoundSystem.playEnded();
        previousStates.current[table.id] = { ...prevState, alertedEnded: true, alertedNearEnd: true };
      }
    });
  }, [now, tables, isStarted]);

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
        <h1 className="text-4xl md:text-6xl font-display font-black text-white tracking-tighter mb-8">
          TV Display Ready
        </h1>
        <p className="text-text-dim text-lg md:text-xl max-w-lg mb-12">
          Click the button below to initialize the audio engine and enter full-screen mode.
        </p>
        <button 
          onClick={handleStart}
          className="px-10 py-5 bg-accent/20 border-2 border-accent/40 text-accent font-display text-2xl md:text-3xl font-bold rounded-3xl hover:bg-accent/30 transition-colors shadow-[0_0_40px_rgba(74,188,109,0.3)] animate-pulse"
        >
          Tap to Start Display
        </button>
      </div>
    );
  }

  const formatTimeRemaining = (start, duration) => {
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

  const getProgress = (start, duration) => {
    const end = start + duration;
    const elapsed = now - start;
    const percent = (elapsed / duration) * 100;
    return Math.min(Math.max(percent, 0), 100);
  };

  const currentTimeStr = new Date(now).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true
  });

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] text-text-main font-sans overflow-hidden flex flex-col selection:bg-transparent cursor-none">
      {/* Top Header - TV style */}
      <header className="px-[4vw] py-[2vh] flex items-center justify-between border-b border-white/5 bg-[#101010] flex-shrink-0 z-20 shadow-lg">
        <div className="flex items-center gap-[1vw]">
          <div className="w-[6vh] h-[6vh] bg-accent text-bg font-display font-bold text-[3vh] flex items-center justify-center rounded-[1.5vh] shadow-[0_0_2vh_rgba(74,188,109,0.2)]">
            B
          </div>
          <div>
            <h1 className="text-[3vh] font-display font-bold tracking-tight text-white leading-none">GBC Billiard Station</h1>
            <p className="text-text-dim text-[1.2vh] tracking-widest uppercase font-semibold mt-[0.5vh]">Live Status Board</p>
          </div>
        </div>
        
        <div className="flex items-center gap-[1vw] text-[4vh] font-display font-bold text-white tracking-tight">
          <Clock className="text-accent w-[4vh] h-[4vh]" />
          {currentTimeStr}
        </div>
      </header>

      {/* Main Grid Content - Strict 2x2 without scrollbars */}
      <main className="flex-1 p-[3vh] flex flex-col overflow-hidden bg-bg">
        <div className="grid grid-cols-2 grid-rows-2 gap-[3vh] h-full w-full">
          {tables.map(table => {
            const isBusy = table.status === 'busy';
            
            // Render Busy Card
            if (isBusy) {
              const progress = getProgress(table.startTime, table.duration);
              const remainingMs = (table.startTime + table.duration) - now;
              const isEndingSoon = remainingMs <= 120000 && remainingMs > 0; // < 2 mins
              const isEnded = remainingMs <= 0;

              // Compute dynamic styles based on time status
              const cardBorder = isEnded ? 'border-danger shadow-[0_0_50px_rgba(240,82,82,0.4)]' : 
                                 isEndingSoon ? 'border-[#ff9f43] shadow-[0_0_30px_rgba(255,159,67,0.3)]' : 
                                 'border-white/10 shadow-lg';
              
              const badgeBg = isEnded ? 'bg-danger text-white border-danger' : 
                              isEndingSoon ? 'bg-[#ff9f43]/20 text-[#ff9f43] border-[#ff9f43]/40' : 
                              'bg-white/10 text-white/70 border-white/20';
              
              const badgeText = isEnded ? 'TIME UP' : 
                                isEndingSoon ? 'ENDING SOON' : 'IN PLAY';

              return (
                <div key={table.id} className={`relative rounded-[3vh] overflow-hidden flex flex-col bg-[#141414] border ${cardBorder} transition-colors duration-500`}>
                  <div className="p-[4vh] flex-1 flex flex-col z-10 relative">
                    {/* TOP HEADER */}
                    <div className="flex justify-between items-start">
                      <h2 className="text-[7vh] font-display font-black text-white tracking-tighter leading-none">
                        T{table.id}
                      </h2>
                      <div className={`px-[2.5vh] py-[1vh] rounded-full border font-bold text-[1.8vh] tracking-widest uppercase ${badgeBg} ${isEndingSoon || isEnded ? 'animate-pulse' : ''}`}>
                        {badgeText}
                      </div>
                    </div>

                    {/* CENTER MASSIVE TIMER */}
                    <div className="flex-1 flex flex-col justify-center items-center text-center">
                      <p className={`text-[2.2vh] font-bold uppercase tracking-widest mb-[1vh] ${isEnded || isEndingSoon ? 'text-danger' : 'text-text-dim'}`}>
                        {isEnded ? 'Overdue By' : 'Time Left'}
                      </p>
                      <p className={`text-[13vh] font-display font-black tracking-tighter leading-none tabular-nums ${isEnded ? 'text-danger animate-pulse' : isEndingSoon ? 'text-[#ff9f43]' : 'text-white'}`}>
                        {isEnded ? '00:00:00' : formatTimeRemaining(table.startTime, table.duration)}
                      </p>
                    </div>

                    {/* BOTTOM FOOTER */}
                    <div className="mt-auto border-t border-white/10 pt-[3vh] pb-[0.5vh] flex items-end justify-between">
                      <div>
                        <p className="text-text-dim text-[1.5vh] font-medium uppercase tracking-wider mb-[0.5vh]">Playing Now</p>
                        <p className="text-[3vh] text-white font-bold tracking-tight truncate leading-none max-w-[20vw]">
                          {table.player}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-text-dim text-[1.5vh] font-medium uppercase tracking-wider mb-[0.5vh]">Session</p>
                        <p className="text-[2.2vh] text-white/80 font-semibold tracking-wide leading-none">
                          {formatTimeRange(table.startTime, table.duration)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar Container */}
                  <div className="h-[1.5vh] w-full bg-black relative z-10 flex-shrink-0">
                    <div 
                      className={`h-full transition-all duration-1000 ease-linear ${isEnded ? 'bg-danger' : isEndingSoon ? 'bg-[#ff9f43]' : 'bg-white'}`} 
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Background ambient glow */}
                  <div className={`absolute top-0 right-0 w-[30vh] h-[30vh] rounded-full blur-[8vh] pointer-events-none opacity-20 ${isEnded ? 'bg-danger' : isEndingSoon ? 'bg-[#ff9f43]' : 'bg-transparent'}`} />
                </div>
              );
            }

            // Render Available Card
            return (
              <div key={table.id} className="relative rounded-[3vh] overflow-hidden flex flex-col bg-[#111612] border border-accent/10 shadow-[inset_0_0_8vh_rgba(74,188,109,0.02)] transition-colors duration-1000">
                <div className="p-[4vh] flex-1 flex flex-col z-10 relative">
                  <div className="flex justify-between items-start">
                    <h2 className="text-[7vh] font-display font-black text-white/30 tracking-tighter leading-none">
                      T{table.id}
                    </h2>
                  </div>

                  <div className="flex-1 flex flex-col justify-center items-center text-center mt-[-4vh]">
                    <div className="w-[12vh] h-[12vh] rounded-full border-[0.5vh] border-accent/20 flex items-center justify-center mb-[4vh] shadow-[0_0_4vh_rgba(74,188,109,0.1)]">
                      <div className="w-[8vh] h-[8vh] rounded-full bg-accent/20 animate-pulse" />
                    </div>
                    <h3 className="text-[5vh] font-display font-light text-white tracking-widest uppercase mb-[1vh]">
                      Available
                    </h3>
                    <p className="text-accent-bright/70 text-[2vh] font-medium tracking-widest uppercase">
                      Ready for Booking
                    </p>
                  </div>
                </div>

                {/* Background ambient glow */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-[40vh] h-[40vh] bg-accent rounded-full blur-[12vh] pointer-events-none opacity-[0.07]" />
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

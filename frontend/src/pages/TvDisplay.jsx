import { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

// MOCK DATA: Configured to demonstrate live transitions 5 seconds after page load!
const MOCK_TABLES = [
  // T1: 55s elapsed -> Starts as "STARTED", becomes "PLAYING" in 5s
  { id: 1, type: 'Pro Pool', status: 'busy', player: 'Rahul Mehta', startTime: Date.now() - 55000, duration: 60 * 60000 },

  // T2: 10m 5s left -> Starts as "PLAYING", becomes "ENDING SOON" in 5s
  { id: 2, type: 'Snooker', status: 'busy', player: 'Sarah Connor', startTime: Date.now() - (30 * 60000 + 55000), duration: 60 * 60000 },

  // T3: 0m 5s left -> Starts as "FINAL MINUTES", becomes "TIME UP" in 5s
  { id: 3, type: 'Pro Pool', status: 'busy', player: 'Alex Rivera', startTime: Date.now() - (30 * 60000 + 55000), duration: 60 * 60000 },

  // T4: Available (No Session)
  { id: 4, type: 'Carom', status: 'available', player: null, startTime: null, duration: null }
];

// --- Web Audio API Sound System ---
class SoundSystem {
  static ctx = null;
  static init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
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

  static playStarted() {
    // Bright ascending chime
    this.playTone(523.25, 'sine', 0.2, 0.05); // C5
    setTimeout(() => this.playTone(659.25, 'sine', 0.4, 0.05), 150); // E5
  }

  static playFinalMinutes() {
    // Urgent double beep
    this.playTone(880, 'sine', 0.2, 0.05);
    setTimeout(() => this.playTone(880, 'sine', 0.4, 0.05), 250);
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

      const elapsed = now - table.startTime;
      const end = table.startTime + table.duration;
      const remainingMs = end - now;
      const totalSeconds = Math.floor(remainingMs / 1000);

      const prevState = previousStates.current[table.id] || {
        alertedStarted: false,
        alertedFinal: false,
        alertedEnded: false
      };

      // Started: first 60 seconds
      if (elapsed >= 0 && elapsed <= 60000 && !prevState.alertedStarted) {
        SoundSystem.playStarted();
        prevState.alertedStarted = true;
      }

      // Final Minutes: <= 3 minutes
      if (totalSeconds <= 180 && totalSeconds > 0 && !prevState.alertedFinal) {
        SoundSystem.playFinalMinutes();
        prevState.alertedFinal = true;
      }

      // Ended: <= 0 seconds
      if (totalSeconds <= 0 && !prevState.alertedEnded) {
        SoundSystem.playEnded();
        prevState.alertedEnded = true;
      }

      previousStates.current[table.id] = prevState;
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

      <main className="flex-1 p-[3vh] flex flex-col overflow-hidden bg-bg">
        <div className="grid grid-cols-2 grid-rows-2 gap-[3vh] h-full w-full">
          {tables.map(table => {
            const isBusy = table.status === 'busy';

            if (isBusy) {
              const progress = getProgress(table.startTime, table.duration);
              const elapsedMs = now - table.startTime;
              const remainingMs = (table.startTime + table.duration) - now;
              const totalRemainingMins = remainingMs / 60000;

              const isEnded = remainingMs <= 0;
              const isFinalMinutes = !isEnded && totalRemainingMins <= 3;
              const isEndingSoon = !isEnded && !isFinalMinutes && totalRemainingMins <= 10;
              const isPlaying = !isEnded && !isFinalMinutes && !isEndingSoon;

              let cardBorder = 'border-white/10 shadow-[0_4vh_6vh_rgba(0,0,0,0.4)]';
              let badgeBg = 'bg-white/5 text-text-muted border-white/10';
              let badgeText = 'IN PLAY';
              let timerColor = 'text-white';
              let progressColor = 'bg-white/70';
              let glowColor = 'bg-white opacity-[0.03]';

              if (isEndingSoon) {
                cardBorder = 'border-[#ff9f43]/60 shadow-[0_0_4vh_rgba(255,159,67,0.15)]';
                badgeBg = 'bg-[#ff9f43]/20 text-[#ff9f43] border-[#ff9f43]/40';
                badgeText = 'ENDING SOON';
                timerColor = 'text-[#ff9f43]';
                progressColor = 'bg-[#ff9f43]';
                glowColor = 'bg-[#ff9f43] opacity-20';
              } else if (isFinalMinutes) {
                cardBorder = 'border-[#ff4757]/80 shadow-[0_0_5vh_rgba(255,71,87,0.25)]';
                badgeBg = 'bg-[#ff4757]/20 text-[#ff4757] border-[#ff4757]/40 animate-pulse';
                badgeText = 'FINAL MINS';
                timerColor = 'text-[#ff4757]';
                progressColor = 'bg-[#ff4757]';
                glowColor = 'bg-[#ff4757] opacity-30';
              } else if (isEnded) {
                cardBorder = 'border-danger shadow-[0_0_6vh_rgba(240,82,82,0.4)]';
                badgeBg = 'bg-danger text-white border-danger animate-pulse';
                badgeText = 'TIME UP';
                timerColor = 'text-danger animate-pulse';
                progressColor = 'bg-danger';
                glowColor = 'bg-danger opacity-40';
              }

              return (
                <div key={table.id} className={`relative rounded-[3vh] overflow-hidden flex flex-col bg-[#141414] border ${cardBorder} transition-colors duration-1000`}>
                  <div className="p-[4vh] flex-1 flex flex-col z-10 relative">
                    <div className="flex justify-between items-start">
                      <h2 className="text-[7vh] font-display font-black text-white/80 tracking-tighter leading-none">
                        T{table.id}
                      </h2>
                      <div className={`px-[2.5vh] py-[1vh] rounded-full border font-bold text-[1.8vh] tracking-widest uppercase ${badgeBg}`}>
                        {badgeText}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center items-center text-center">
                      <p className={`text-[2.2vh] font-bold uppercase tracking-widest mb-[1vh] ${isEnded || isFinalMinutes ? 'text-danger' : 'text-text-dim'}`}>
                        {isEnded ? 'Overdue By' : 'Time Left'}
                      </p>
                      <p className={`text-[13vh] font-display font-black tracking-tighter leading-none tabular-nums ${timerColor}`}>
                        {isEnded ? '00:00:00' : formatTimeRemaining(table.startTime, table.duration)}
                      </p>
                    </div>

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

                  <div className="h-[1.5vh] w-full bg-black relative z-10 flex-shrink-0">
                    <div
                      className={`h-full transition-all duration-1000 ease-linear ${progressColor}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className={`absolute top-0 right-0 w-[30vh] h-[30vh] rounded-full blur-[8vh] pointer-events-none opacity-20 ${glowColor}`} />
                </div>
              );
            }

            return (
              <div key={table.id} className="relative rounded-[3vh] overflow-hidden flex flex-col bg-[#111612] border border-accent/10 shadow-[inset_0_0_8vh_rgba(74,188,109,0.02)] transition-colors duration-1000">
                <div className="p-[4vh] flex-1 flex flex-col z-10 relative">
                  <div className="flex justify-between items-start">
                    <h2 className="text-[7vh] font-display font-black text-white/40 tracking-tighter leading-none">
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

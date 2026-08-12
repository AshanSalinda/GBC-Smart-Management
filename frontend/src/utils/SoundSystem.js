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

  static playStarted() {
    // Bright ascending chime
    this.playTone(523.25, 'sine', 0.2, 0.05); // C5
    setTimeout(() => this.playTone(659.25, 'sine', 0.4, 0.05), 150); // E5
  }

  static playEndingSoon() {
    // Gentle warning tone
    this.playTone(600, 'sine', 0.4, 0.05);
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

export default SoundSystem;

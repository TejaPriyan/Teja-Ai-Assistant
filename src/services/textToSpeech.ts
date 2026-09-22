export class TextToSpeechService {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private onStartCallback: (() => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onBoundaryCallback: ((charIndex: number, charLength: number) => void) | null = null;
  private onLevelCallback: ((level: number) => void) | null = null;
  private isSpeaking: boolean = false;
  private voice: SpeechSynthesisVoice | null = null;
  private rate: number = 1;
  private volume: number = 0.8;
  private keepAliveInterval: any = null;
  private levelSimulationInterval: any = null;
  private voicesLoaded: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    if (voices.length > 0) {
      this.voicesLoaded = true;
    }
    // Only auto-pick if no voice has been explicitly set
    if (!this.voice) {
      const preferred =
        voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
        voices.find(v => v.name.includes('Natural') && v.lang.startsWith('en')) ||
        voices.find(v => v.name.includes('Zira') || v.name.includes('David')) ||
        voices.find(v => v.lang === 'en-US') ||
        voices[0];
      if (preferred) this.voice = preferred;
    }
  }

  private startKeepAlive() {
    this.stopKeepAlive();
    // Chromium bug workaround: speech synthesis pauses silently after 15s without this pulse
    this.keepAliveInterval = setInterval(() => {
      if (this.synth && this.isSpeaking) {
        this.synth.pause();
        this.synth.resume();
      } else {
        this.stopKeepAlive();
      }
    }, 10000);
  }

  private stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * Simulate voice-level output during speaking.
   * Uses boundary events and a periodic interval to generate
   * natural-looking voice amplitude for the orb animation.
   */
  private startLevelSimulation() {
    this.stopLevelSimulation();
    let phase = 0;
    this.levelSimulationInterval = setInterval(() => {
      if (!this.isSpeaking) {
        this.stopLevelSimulation();
        return;
      }
      // Generate a natural-looking voice pattern using layered sine waves
      phase += 0.15;
      const base = 0.35;
      const wave1 = Math.sin(phase * 2.1) * 0.25;
      const wave2 = Math.sin(phase * 5.3) * 0.15;
      const wave3 = Math.sin(phase * 0.7) * 0.1;
      const jitter = (Math.random() - 0.5) * 0.12;
      const level = Math.max(0.05, Math.min(1, base + wave1 + wave2 + wave3 + jitter));
      this.onLevelCallback?.(level);
    }, 50); // 20fps level updates
  }

  private stopLevelSimulation() {
    if (this.levelSimulationInterval) {
      clearInterval(this.levelSimulationInterval);
      this.levelSimulationInterval = null;
    }
    this.onLevelCallback?.(0);
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error('Text-to-speech not supported'));
        return;
      }

      this.stop();

      this.currentUtterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance.rate = this.rate;
      this.currentUtterance.volume = this.volume;
      this.currentUtterance.pitch = 1;

      if (this.voice) {
        this.currentUtterance.voice = this.voice;
      } else {
        this.currentUtterance.lang = 'en-US';
      }

      this.currentUtterance.onstart = () => {
        this.isSpeaking = true;
        this.startKeepAlive();
        this.startLevelSimulation();
        this.onStartCallback?.();
      };

      this.currentUtterance.onend = () => {
        this.isSpeaking = false;
        this.stopKeepAlive();
        this.stopLevelSimulation();
        this.onEndCallback?.();
        resolve();
      };

      this.currentUtterance.onerror = (e) => {
        this.isSpeaking = false;
        this.stopKeepAlive();
        this.stopLevelSimulation();
        const msg = e.error === 'interrupted' ? 'Speech interrupted' : `Speech error: ${e.error}`;
        this.onErrorCallback?.(msg);
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          reject(new Error(msg));
        } else {
          resolve();
        }
      };

      this.currentUtterance.onboundary = (e) => {
        if (e.name === 'word') {
          this.onBoundaryCallback?.(e.charIndex, e.charLength);
          // Spike the level briefly on word boundary for more natural feel
          if (this.isSpeaking) {
            const spike = 0.5 + Math.random() * 0.4;
            this.onLevelCallback?.(spike);
          }
        }
      };

      this.synth.speak(this.currentUtterance);
    });
  }

  stop() {
    this.stopKeepAlive();
    this.stopLevelSimulation();
    if (this.synth) {
      try { this.synth.cancel(); } catch {}
    }
    this.isSpeaking = false;
  }

  pause() {
    if (this.synth) this.synth.pause();
  }

  resume() {
    if (this.synth) this.synth.resume();
  }

  setRate(rate: number) {
    this.rate = Math.max(0.5, Math.min(2, rate));
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  setVoice(voice: SpeechSynthesisVoice | null) {
    this.voice = voice;
  }

  /**
   * Set voice by name string. Used to restore from settings.
   * Returns true if the voice was found and applied.
   */
  setVoiceByName(name: string): boolean {
    if (!name || name === 'default') {
      this.voice = null;
      this.loadVoices(); // Re-pick default
      return true;
    }
    const voices = this.getVoices();
    const match = voices.find(v => v.name === name);
    if (match) {
      this.voice = match;
      return true;
    }
    return false;
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.synth?.getVoices() || [];
  }

  getCurrentVoiceName(): string {
    return this.voice?.name || 'default';
  }

  onStart(callback: () => void) {
    this.onStartCallback = callback;
  }

  onEnd(callback: () => void) {
    this.onEndCallback = callback;
  }

  onError(callback: (error: string) => void) {
    this.onErrorCallback = callback;
  }

  onBoundary(callback: (charIndex: number, charLength: number) => void) {
    this.onBoundaryCallback = callback;
  }

  onLevel(callback: (level: number) => void) {
    this.onLevelCallback = callback;
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  areVoicesLoaded(): boolean {
    return this.voicesLoaded;
  }

  isSupported(): boolean {
    return !!this.synth;
  }
}

export const textToSpeech = new TextToSpeechService();

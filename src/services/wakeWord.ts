export class WakeWordService {
  private recognition: any = null;
  private isRunning: boolean = false;
  private onWakeCallback: ((immediateQuery?: string) => void) | null = null;
  private restartTimeout: any = null;
  private audioContext: AudioContext | null = null;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.toLowerCase().trim();
          
          // Pattern matches "hey teja", "hi teja", "teja", "ok teja", "hello teja"
          const wakeMatch = transcript.match(/\b(?:hey|hi|hello|ok|hai)?\s*teja\b(.*)/i);
          if (wakeMatch) {
            const remainder = (wakeMatch[1] || '').trim();
            this.playWakeChime();
            this.stop();
            this.onWakeCallback?.(remainder || undefined);
            return;
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        // Ignore aborted or no-speech in background wake listener
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          console.debug('Wake word listener notice:', event.error);
        }
      };

      this.recognition.onend = () => {
        if (this.isRunning) {
          // Restart background listener after brief delay
          clearTimeout(this.restartTimeout);
          this.restartTimeout = setTimeout(() => {
            if (this.isRunning) {
              try { this.recognition.start(); } catch {}
            }
          }, 400);
        }
      };
    } catch (e) {
      console.warn('Wake word initialization error:', e);
    }
  }

  playWakeChime() {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AC();
      }
      const ctx = this.audioContext;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;

      // Two-tone futuristic ascending beep (880Hz -> 1320Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.12); // E6

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(440, now);
      osc2.frequency.exponentialRampToValueAtTime(660, now + 0.12);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.2);
      osc2.stop(now + 0.2);
    } catch {
      // Audio playback optional
    }
  }

  start(onWake: (immediateQuery?: string) => void) {
    this.onWakeCallback = onWake;
    if (!this.recognition || this.isRunning) return;

    this.isRunning = true;
    try {
      this.recognition.start();
    } catch (e) {
      // Sometimes already running
      console.debug('Wake word start notice:', e);
    }
  }

  stop() {
    this.isRunning = false;
    clearTimeout(this.restartTimeout);
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  isSupported(): boolean {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }
}

export const wakeWord = new WakeWordService();

export class SpeechToTextService {
  private recognition: any = null;
  private isListening: boolean = false;
  private onResultCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onStartCallback: (() => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private onLevelCallback: ((level: number) => void) | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animationFrame: number | null = null;
  private finalTextBuffer: string = '';

  private accumulatedFinalText: string = '';
  private manualStop: boolean = false;
  private onCommandCompleteCallback: ((text: string) => void) | null = null;
  private silenceTimeout: any = null;

  constructor() {
    this.initializeRecognition();
  }

  private initializeRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition API not supported in this environment');
      return;
    }

    this.recognition = new SpeechRecognition();
    // Continuous live listening: keep the stream open without cutting off
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.manualStop = false;
      this.startAudioLevelMonitoring();
      this.onStartCallback?.();
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          this.accumulatedFinalText = (this.accumulatedFinalText + ' ' + transcript).trim();
        } else {
          interimTranscript += transcript;
        }
      }

      const liveFullText = (this.accumulatedFinalText + ' ' + interimTranscript).trim();

      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }

      // Check for the "over" conclusion keyword
      const overMatch = liveFullText.match(/\b(?:over)\b[.!?]?\s*$/i);
      if (overMatch) {
        const cleanCommand = liveFullText.replace(/\b(?:over)\b[.!?]?\s*$/i, '').trim();
        this.accumulatedFinalText = '';
        this.finalTextBuffer = cleanCommand;
        if (cleanCommand) {
          this.onCommandCompleteCallback?.(cleanCommand);
        }
        this.stop();
        return;
      }

      this.finalTextBuffer = liveFullText;
      // Emit live transcript update without cutting off
      this.onResultCallback?.(liveFullText, false);

      // Auto-conclude fallback if user stops speaking for 2.2 seconds
      if (liveFullText.length > 0) {
        this.silenceTimeout = setTimeout(() => {
          if (this.isListening && this.finalTextBuffer.trim()) {
            const cmd = this.finalTextBuffer.replace(/\b(?:over)\b[.!?]?\s*$/i, '').trim();
            this.accumulatedFinalText = '';
            this.finalTextBuffer = '';
            if (cmd) {
              this.onCommandCompleteCallback?.(cmd);
            }
            this.stop();
          }
        }, 2200);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);

      switch (event.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          this.stopAudioLevelMonitoring();
          this.isListening = false;
          this.onErrorCallback?.('Microphone access denied. Please allow microphone access in your browser, or use the chat panel to type.');
          break;
        case 'audio-capture':
          this.stopAudioLevelMonitoring();
          this.isListening = false;
          this.onErrorCallback?.('Cannot access microphone. Check that a microphone is connected.');
          break;
        case 'network':
          this.onErrorCallback?.('Network error during speech recognition.');
          break;
        case 'no-speech':
          // In continuous live mode, no-speech is normal while user pauses; do not abort
          break;
        default:
          break;
      }
    };

    this.recognition.onend = () => {
      // Seamless auto-restart if still listening and not manually stopped
      if (this.isListening && !this.manualStop) {
        try {
          this.recognition.start();
          return;
        } catch {
          // ignore restart race condition
        }
      }

      this.isListening = false;
      this.stopAudioLevelMonitoring();
      this.onEndCallback?.();
    };
  }

  private async startAudioLevelMonitoring() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.audioContext = new AC();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.5;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        const startBin = 2;
        const endBin = Math.min(Math.floor(this.analyser.frequencyBinCount * 0.4), dataArray.length);
        let count = 0;
        for (let i = startBin; i < endBin; i++) {
          sum += dataArray[i] * dataArray[i];
          count++;
        }
        const rms = Math.sqrt(sum / (count || 1)) / 255;
        this.onLevelCallback?.(Math.min(rms * 3, 1));
        this.animationFrame = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch {
      // Audio level monitoring optional
    }
  }

  private stopAudioLevelMonitoring() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
    this.analyser = null;
    this.onLevelCallback?.(0);
  }

  start(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.recognition) {
        this.onErrorCallback?.('Speech recognition not supported. Please use Chrome/Edge, or use the chat panel to type messages.');
        resolve(false);
        return;
      }
      if (this.isListening) {
        resolve(true);
        return;
      }

      let settled = false;
      const originalStart = this.recognition.onstart;
      const originalError = this.recognition.onerror;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.recognition.onstart = originalStart;
          this.recognition.onerror = originalError;
          resolve(this.isListening);
        }
      }, 3000); // 3s grace period for microphone activation/permissions

      this.recognition.onstart = (ev: any) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          this.recognition.onstart = originalStart;
          this.recognition.onerror = originalError;
          resolve(true);
        }
        originalStart?.(ev);
      };

      this.recognition.onerror = (ev: any) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          this.recognition.onstart = originalStart;
          this.recognition.onerror = originalError;
          resolve(false);
        }
        originalError?.(ev);
      };

      try {
        this.recognition.start();
      } catch (err) {
        clearTimeout(timer);
        console.warn('Initial recognition start notice:', err);
        try {
          this.recognition.stop();
          setTimeout(() => {
            try {
              this.recognition.start();
              resolve(true);
            } catch {
              resolve(false);
            }
          }, 200);
        } catch {
          resolve(false);
        }
      }
    });
  }

  stop() {
    this.manualStop = true;
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn('Error stopping recognition:', err);
      }
    }
    this.isListening = false;
    this.stopAudioLevelMonitoring();
  }

  abort() {
    this.manualStop = true;
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
    }
    this.isListening = false;
    this.stopAudioLevelMonitoring();
  }

  onCommandComplete(callback: (text: string) => void) {
    this.onCommandCompleteCallback = callback;
  }

  getFinalBuffer(): string {
    return (this.accumulatedFinalText || this.finalTextBuffer).trim();
  }

  resetBuffer() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
    this.accumulatedFinalText = '';
    this.finalTextBuffer = '';
  }

  onResult(callback: (text: string, isFinal: boolean) => void) {
    this.onResultCallback = callback;
  }

  onError(callback: (error: string) => void) {
    this.onErrorCallback = callback;
  }

  onStart(callback: () => void) {
    this.onStartCallback = callback;
  }

  onEnd(callback: () => void) {
    this.onEndCallback = callback;
  }

  onLevel(callback: (level: number) => void) {
    this.onLevelCallback = callback;
  }

  isSupported(): boolean {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  getIsListening(): boolean {
    return this.isListening;
  }
}

export const speechToText = new SpeechToTextService();

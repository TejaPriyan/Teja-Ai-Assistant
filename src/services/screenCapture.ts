import type { AppSettings } from '../types';

export class ScreenCaptureService {
  private liveStream: MediaStream | null = null;
  private liveVideo: HTMLVideoElement | null = null;
  private onEndCallbacks: Set<() => void> = new Set();

  async startLiveStream(): Promise<{ stream: MediaStream | null; error?: string }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      return {
        stream: null,
        error: 'Screen capture is not supported in this browser.',
      };
    }

    if (this.liveStream && this.liveStream.active) {
      return { stream: this.liveStream };
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: false,
      });

      this.liveStream = stream;

      const video = document.createElement('video');
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      await video.play().catch(() => {});
      this.liveVideo = video;

      const track = stream.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          this.stopLiveStream();
          this.onEndCallbacks.forEach(cb => {
            try { cb(); } catch {}
          });
        };
      }

      return { stream };
    } catch (err: any) {
      this.stopLiveStream();
      if (err.name === 'NotAllowedError') {
        return { stream: null, error: 'Screen sharing permission was cancelled or denied.' };
      }
      return { stream: null, error: err?.message || 'Could not start screen capture.' };
    }
  }

  stopLiveStream() {
    if (this.liveStream) {
      this.liveStream.getTracks().forEach(t => t.stop());
      this.liveStream = null;
    }
    if (this.liveVideo) {
      this.liveVideo.srcObject = null;
      this.liveVideo = null;
    }
  }

  isLiveActive(): boolean {
    return !!(this.liveStream && this.liveStream.active);
  }

  getLiveStream(): MediaStream | null {
    return this.liveStream;
  }

  onStreamEnded(cb: () => void) {
    this.onEndCallbacks.add(cb);
    return () => this.onEndCallbacks.delete(cb);
  }

  private drawVideoToDataUrl(video: HTMLVideoElement): string | null {
    try {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const maxDim = 1280;
      let targetW = width;
      let targetH = height;
      if (targetW > maxDim || targetH > maxDim) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * maxDim) / targetW);
          targetW = maxDim;
        } else {
          targetW = Math.round((targetW * maxDim) / targetH);
          targetH = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, targetW, targetH);
      return canvas.toDataURL('image/jpeg', 0.82);
    } catch {
      return null;
    }
  }

  async captureScreenFrame(): Promise<{ imageBase64: string | null; error?: string }> {
    // If live stream is already running, grab the frame immediately in zero milliseconds!
    if (this.liveVideo && this.liveStream && this.liveStream.active) {
      const dataUrl = this.drawVideoToDataUrl(this.liveVideo);
      if (dataUrl) return { imageBase64: dataUrl };
    }

    // Otherwise, start or request stream
    const started = await this.startLiveStream();
    if (!started.stream || !this.liveVideo) {
      return { imageBase64: null, error: started.error || 'Screen capture failed' };
    }

    await new Promise(r => setTimeout(r, 200));
    const dataUrl = this.drawVideoToDataUrl(this.liveVideo);
    return { imageBase64: dataUrl };
  }

  async analyzeScreen(query: string, imageBase64: string, settings: AppSettings): Promise<string> {
    const userPrompt =
      query && query.trim().length > 0
        ? query
        : 'Look at my screen and describe what is visible, open applications, main text, or important details concisely in 2-3 sentences.';

    const openRouterKey = settings.ai.apiKeyOpenRouter;
    if (openRouterKey) {
      try {
        const candidateModels = [
          'google/gemma-4-31b-it:free',
          'google/gemma-4-26b-a4b-it:free',
          'qwen/qwen3.8-27b:free',
          'inclusionai/ling-3.0-flash-vl:free',
        ];

        for (const model of candidateModels) {
          try {
            const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openRouterKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model,
                messages: [
                  {
                    role: 'system',
                    content:
                      'You are TEJA AI vision core with live screen vision. Analyze the screen capture and answer concisely in 2-4 sentences as if talking directly to the user.',
                  },
                  {
                    role: 'user',
                    content: [
                      { type: 'text', text: userPrompt },
                      { type: 'image_url', image_url: { url: imageBase64 } },
                    ],
                  },
                ],
                max_tokens: 500,
              }),
            });

            if (resp.ok) {
              const data = await resp.json();
              const answer = data.choices?.[0]?.message?.content;
              if (answer && answer.trim()) {
                return answer.trim();
              }
            }
          } catch {
            // try next model
          }
        }
      } catch (e) {
        console.warn('Vision API error on OpenRouter:', e);
      }
    }

    return `I am seeing your live screen! The visual frame was captured successfully. To enable complete visual analysis of windows and text, ensure your OpenRouter API key is set in Settings.`;
  }
}

export const screenCapture = new ScreenCaptureService();

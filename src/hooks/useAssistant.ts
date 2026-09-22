import { useCallback, useEffect, useRef } from 'react';
import { useTeja } from '../store/TejaContext';
import { speechToText } from '../services/speechToText';
import { textToSpeech } from '../services/textToSpeech';
import { getAIResponse } from '../services/ai';
import { executeTool } from '../services/tools';
import { wakeWord } from '../services/wakeWord';
import { screenCapture } from '../services/screenCapture';
import type { ToolCall } from '../types';

/** Phrases that end a live session */
const SESSION_END_PHRASES = [
  'over',
  "i'm done",
  'im done',
  'end conversation',
  'stop listening',
  'goodbye teja',
  'goodbye',
  "that's all",
  'thats all',
  'bye teja',
  'end session',
  'stop session',
];

function isSessionEndPhrase(text: string): boolean {
  const lower = text.toLowerCase().trim().replace(/[.!?,]+$/, '').trim();
  return SESSION_END_PHRASES.some(p => lower === p || lower.endsWith(p));
}

export function useAssistant() {
  const { state, dispatch } = useTeja();

  const stateRef = useRef(state);
  const processQueryRef = useRef<(q: string) => void>(() => {});
  const isProcessingRef = useRef(false);
  const autoListenTimeoutRef = useRef<any>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // =============================================
  // AUTO-LISTEN: restart STT after TTS ends during live session
  // =============================================
  const autoListenAfterSpeaking = useCallback(() => {
    if (autoListenTimeoutRef.current) clearTimeout(autoListenTimeoutRef.current);
    autoListenTimeoutRef.current = setTimeout(async () => {
      if (!stateRef.current.isLiveSession) return;
      if (stateRef.current.isMuted) return;
      if (isProcessingRef.current) return;
      if (stateRef.current.state === 'listening') return;

      // Auto restart listening
      dispatch({ type: 'SET_STATE', payload: 'listening' });
      speechToText.resetBuffer();
      const ok = await speechToText.start();
      if (!ok) {
        dispatch({ type: 'SET_STATE', payload: 'idle' });
      }
    }, 400); // slight delay after TTS ends
  }, [dispatch]);

  // =============================================
  // CORE: Process a user query
  // =============================================
  const processQuery = useCallback(async (query: string) => {
    if (!query.trim() || isProcessingRef.current) return;

    // Check for session-end phrases
    if (stateRef.current.isLiveSession && isSessionEndPhrase(query)) {
      isProcessingRef.current = true;
      wakeWord.stop();
      speechToText.stop();
      dispatch({ type: 'SET_STATE', payload: 'speaking' });
      dispatch({ type: 'SET_TRANSCRIPT', payload: query });
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: { role: 'user', content: query } });

      const goodbye = "Alright, talk to you later!";
      dispatch({ type: 'SET_RESPONSE', payload: goodbye });
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: { role: 'assistant', content: goodbye } });

      textToSpeech.setRate(stateRef.current.settings.voice.speechSpeed);
      textToSpeech.setVolume(stateRef.current.settings.voice.volume);
      try {
        await textToSpeech.speak(goodbye);
      } catch {}

      dispatch({ type: 'END_LIVE_SESSION' });
      isProcessingRef.current = false;
      return;
    }

    isProcessingRef.current = true;

    // Stop listening & wake word during processing
    wakeWord.stop();
    speechToText.stop();
    dispatch({ type: 'SET_STATE', payload: 'thinking' });
    dispatch({ type: 'SET_TRANSCRIPT', payload: query });
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: { role: 'user', content: query } });

    // Apply TTS settings
    textToSpeech.setRate(stateRef.current.settings.voice.speechSpeed);
    textToSpeech.setVolume(stateRef.current.settings.voice.volume);

    try {
      const aiResult = await getAIResponse(
        query,
        stateRef.current.settings,
        stateRef.current.chatMessages
      );

      if (aiResult.error && !aiResult.text) {
        dispatch({ type: 'SET_ERROR', payload: aiResult.error || 'AI request failed' });
        isProcessingRef.current = false;
        // Auto-listen even on error if live session
        if (stateRef.current.isLiveSession) autoListenAfterSpeaking();
        return;
      }

      let responseText = aiResult.text || "I'm not sure how to respond to that.";
      let speechToPlay = responseText;

      // Execute tool if present
      if (aiResult.tool) {
        try {
          // Show acting state with status
          dispatch({ type: 'SET_STATE', payload: 'acting' });
          dispatch({ type: 'SET_CURRENT_ACTION', payload: getActionDescription(aiResult.tool) });

          const toolResult = await executeTool(
            aiResult.tool,
            stateRef.current.settings,
            (pending) => dispatch({ type: 'SET_PENDING_URL', payload: pending }),
            (active) => dispatch({ type: 'SET_LIVE_SCREEN_ACTIVE', payload: active })
          );
          if (toolResult.message) {
            responseText = toolResult.message;
          }
          if (toolResult.speechResponse) {
            speechToPlay = toolResult.speechResponse;
          }
          dispatch({ type: 'SET_CURRENT_ACTION', payload: '' });
        } catch (tErr) {
          console.error('Tool execution error:', tErr);
          dispatch({ type: 'SET_CURRENT_ACTION', payload: '' });
        }
      }

      dispatch({ type: 'SET_RESPONSE', payload: responseText });
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: { role: 'assistant', content: responseText } });

      // Add to history
      dispatch({
        type: 'ADD_HISTORY',
        payload: {
          id: Date.now().toString(),
          timestamp: Date.now(),
          userQuery: query,
          aiResponse: responseText,
          toolUsed: aiResult.tool?.name,
        },
      });

      // Speak response
      try {
        await textToSpeech.speak(speechToPlay);
      } catch (err) {
        console.error('TTS failed:', err);
        dispatch({ type: 'SET_STATE', payload: 'idle' });
      }
    } catch (err: any) {
      console.error('Processing error:', err);
      dispatch({ type: 'SET_ERROR', payload: err?.message || 'Something went wrong' });
    } finally {
      isProcessingRef.current = false;
    }
  }, [dispatch, autoListenAfterSpeaking]);

  useEffect(() => {
    processQueryRef.current = processQuery;
  }, [processQuery]);

  // =============================================
  // LIVE SESSION MANAGEMENT
  // =============================================

  const startLiveSession = useCallback(async () => {
    if (stateRef.current.isLiveSession) return; // already in session
    dispatch({ type: 'START_LIVE_SESSION' });
    dispatch({ type: 'SET_STATE', payload: 'speaking' });

    const greeting = "Yeah, I'm listening.";
    dispatch({ type: 'SET_RESPONSE', payload: greeting });
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: { role: 'assistant', content: greeting } });

    textToSpeech.setRate(stateRef.current.settings.voice.speechSpeed);
    textToSpeech.setVolume(stateRef.current.settings.voice.volume);
    try {
      await textToSpeech.speak(greeting);
    } catch {}

    // Auto-listen after greeting
    autoListenAfterSpeaking();
  }, [dispatch, autoListenAfterSpeaking]);

  const endLiveSession = useCallback(() => {
    speechToText.stop();
    textToSpeech.stop();
    if (autoListenTimeoutRef.current) clearTimeout(autoListenTimeoutRef.current);
    dispatch({ type: 'END_LIVE_SESSION' });
    dispatch({ type: 'SET_VOICE_LEVEL', payload: 0 });
    dispatch({ type: 'SET_CURRENT_ACTION', payload: '' });
  }, [dispatch]);

  const toggleMute = useCallback(() => {
    const newMuted = !stateRef.current.isMuted;
    dispatch({ type: 'SET_MUTED', payload: newMuted });
    if (newMuted) {
      speechToText.stop();
      dispatch({ type: 'SET_STATE', payload: 'idle' });
    } else if (stateRef.current.isLiveSession) {
      autoListenAfterSpeaking();
    }
  }, [dispatch, autoListenAfterSpeaking]);

  // =============================================
  // STANDARD ACTIONS
  // =============================================

  const startListening = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (!stateRef.current.settings.privacy.microphoneEnabled) {
      dispatch({ type: 'SET_ERROR', payload: 'Microphone is disabled in privacy settings.' });
      return;
    }
    wakeWord.stop();
    speechToText.resetBuffer();
    dispatch({ type: 'SET_TRANSCRIPT', payload: '' });
    dispatch({ type: 'CLEAR_ERROR' });
    dispatch({ type: 'SET_STATE', payload: 'listening' });
    const ok = await speechToText.start();
    if (!ok) {
      dispatch({
        type: 'SET_ERROR',
        payload: 'Could not start microphone. Check browser permissions or use the chat panel.',
      });
    }
  }, [dispatch]);

  const stopListening = useCallback(() => {
    const pending = speechToText.getFinalBuffer().replace(/\b(?:over)\b[.!?]?\s*$/i, '').trim();
    speechToText.stop();
    speechToText.resetBuffer();
    if (pending && !isProcessingRef.current) {
      processQueryRef.current(pending);
    } else if (!stateRef.current.isLiveSession) {
      dispatch({ type: 'SET_STATE', payload: 'idle' });
    }
  }, [dispatch]);

  const sendTextMessage = useCallback((text: string) => {
    if (!text.trim() || isProcessingRef.current) return;
    // If not in live session, start one for text messages
    if (!stateRef.current.isLiveSession) {
      dispatch({ type: 'START_LIVE_SESSION' });
    }
    processQueryRef.current(text);
  }, [dispatch]);

  const stopSpeaking = useCallback(() => {
    textToSpeech.stop();
    if (stateRef.current.isLiveSession) {
      // Barge-in: stop speaking and start listening
      autoListenAfterSpeaking();
    } else {
      dispatch({ type: 'SET_STATE', payload: 'idle' });
    }
  }, [dispatch, autoListenAfterSpeaking]);

  const triggerScreenCapture = useCallback(
    async (prompt = "What's on my screen?") => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      wakeWord.stop();
      dispatch({ type: 'SET_STATE', payload: 'thinking' });
      dispatch({ type: 'SET_TRANSCRIPT', payload: prompt });
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: { role: 'user', content: prompt } });

      try {
        const toolCall: ToolCall = { name: 'capture_screen', parameters: { question: prompt } };
        const res = await executeTool(
          toolCall,
          stateRef.current.settings,
          (pending) => dispatch({ type: 'SET_PENDING_URL', payload: pending }),
          (active) => dispatch({ type: 'SET_LIVE_SCREEN_ACTIVE', payload: active })
        );
        const text = res.message || 'Screen capture completed.';
        dispatch({ type: 'SET_RESPONSE', payload: text });
        dispatch({ type: 'ADD_CHAT_MESSAGE', payload: { role: 'assistant', content: text } });
        dispatch({
          type: 'ADD_HISTORY',
          payload: {
            id: Date.now().toString(),
            timestamp: Date.now(),
            userQuery: prompt,
            aiResponse: text,
            toolUsed: 'capture_screen',
          },
        });
        await textToSpeech.speak(res.speechResponse || text);
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', payload: err?.message || 'Screen analysis failed.' });
      } finally {
        isProcessingRef.current = false;
      }
    },
    [dispatch]
  );

  const startLiveVision = useCallback(async () => {
    const res = await screenCapture.startLiveStream();
    if (res.stream) {
      dispatch({ type: 'SET_LIVE_SCREEN_ACTIVE', payload: true });
      textToSpeech.speak('Live screen vision is active.');
    } else if (res.error) {
      dispatch({ type: 'SET_ERROR', payload: res.error });
    }
  }, [dispatch]);

  const stopLiveVision = useCallback(() => {
    screenCapture.stopLiveStream();
    dispatch({ type: 'SET_LIVE_SCREEN_ACTIVE', payload: false });
  }, [dispatch]);

  // =============================================
  // SETUP CALLBACKS (once)
  // =============================================
  useEffect(() => {
    // STT callbacks
    speechToText.onResult((text) => {
      dispatch({ type: 'SET_TRANSCRIPT', payload: text });
    });

    speechToText.onCommandComplete((command) => {
      dispatch({ type: 'SET_TRANSCRIPT', payload: command });
      processQueryRef.current(command);
    });

    speechToText.onError((error) => {
      if (isProcessingRef.current) return;
      console.warn('STT error:', error);
      if (error.includes('No speech')) {
        // In live session, silently restart listening
        if (stateRef.current.isLiveSession && !stateRef.current.isMuted) {
          setTimeout(async () => {
            if (stateRef.current.isLiveSession && !isProcessingRef.current) {
              speechToText.resetBuffer();
              dispatch({ type: 'SET_STATE', payload: 'listening' });
              await speechToText.start();
            }
          }, 300);
        } else {
          dispatch({ type: 'SET_STATE', payload: 'idle' });
        }
      } else if (error.includes('denied') || error.includes('permission')) {
        dispatch({ type: 'UPDATE_STATUS', payload: { microphone: 'denied' } });
        dispatch({ type: 'SET_ERROR', payload: error });
      } else {
        if (stateRef.current.isLiveSession) {
          // Try again
          setTimeout(async () => {
            if (stateRef.current.isLiveSession && !isProcessingRef.current) {
              speechToText.resetBuffer();
              await speechToText.start();
            }
          }, 500);
        } else {
          dispatch({ type: 'SET_STATE', payload: 'idle' });
        }
      }
    });

    speechToText.onStart(() => {
      dispatch({ type: 'UPDATE_STATUS', payload: { microphone: 'ready' } });
    });

    speechToText.onEnd(() => {
      if (!isProcessingRef.current && stateRef.current.state === 'listening') {
        // In live session, get the pending buffer and process it
        if (stateRef.current.isLiveSession) {
          const pending = speechToText.getFinalBuffer().replace(/\b(?:over)\b[.!?]?\s*$/i, '').trim();
          speechToText.resetBuffer();
          if (pending) {
            processQueryRef.current(pending);
          } else {
            // No speech detected, restart listening
            setTimeout(async () => {
              if (stateRef.current.isLiveSession && !isProcessingRef.current) {
                dispatch({ type: 'SET_STATE', payload: 'listening' });
                await speechToText.start();
              }
            }, 200);
          }
        } else {
          dispatch({ type: 'SET_STATE', payload: 'idle' });
        }
      }
    });

    speechToText.onLevel((level) => {
      dispatch({ type: 'SET_VOICE_LEVEL', payload: level });
    });

    // TTS callbacks
    textToSpeech.onStart(() => {
      dispatch({ type: 'SET_STATE', payload: 'speaking' });
    });

    textToSpeech.onEnd(() => {
      dispatch({ type: 'SET_VOICE_LEVEL', payload: 0 });
      if (stateRef.current.isLiveSession) {
        // Don't go idle — auto-listen
        dispatch({ type: 'SET_STATE', payload: 'idle' });
        // Trigger auto-listen after a brief pause
        if (autoListenTimeoutRef.current) clearTimeout(autoListenTimeoutRef.current);
        autoListenTimeoutRef.current = setTimeout(async () => {
          if (stateRef.current.isLiveSession && !stateRef.current.isMuted && !isProcessingRef.current) {
            dispatch({ type: 'SET_STATE', payload: 'listening' });
            speechToText.resetBuffer();
            await speechToText.start();
          }
        }, 500);
      } else {
        dispatch({ type: 'SET_STATE', payload: 'idle' });
      }
    });

    textToSpeech.onError((err) => {
      console.error('TTS error:', err);
      dispatch({ type: 'SET_VOICE_LEVEL', payload: 0 });
      dispatch({ type: 'SET_STATE', payload: 'idle' });
    });

    // Wire TTS voice level to orb animation during speaking
    textToSpeech.onLevel((level) => {
      dispatch({ type: 'SET_VOICE_LEVEL', payload: level });
    });

    if (textToSpeech.isSupported()) {
      dispatch({ type: 'UPDATE_STATUS', payload: { voice: 'ready' } });
    } else {
      dispatch({ type: 'UPDATE_STATUS', payload: { voice: 'error' } });
    }

    return () => {
      wakeWord.stop();
      speechToText.abort();
      textToSpeech.stop();
      if (autoListenTimeoutRef.current) clearTimeout(autoListenTimeoutRef.current);
    };
  }, [dispatch]);

  // Apply selected TTS voice from settings
  useEffect(() => {
    const voiceName = state.settings.voice.ttsVoice;
    if (voiceName && voiceName !== 'default') {
      const apply = () => textToSpeech.setVoiceByName(voiceName);
      if (!apply()) {
        const timer = setTimeout(() => apply(), 500);
        return () => clearTimeout(timer);
      }
    }
  }, [state.settings.voice.ttsVoice]);

  // Wake Word listener — now starts a LIVE SESSION
  useEffect(() => {
    const isWakeEnabled = state.settings.voice.wakeWordEnabled && state.settings.privacy.microphoneEnabled;
    const isIdle = state.state === 'idle' && !state.isLiveSession;

    if (isWakeEnabled && isIdle) {
      wakeWord.start((immediateQuery) => {
        if (immediateQuery) {
          // Wake word detected with immediate query
          if (!stateRef.current.isLiveSession) {
            dispatch({ type: 'START_LIVE_SESSION' });
          }
          processQueryRef.current(immediateQuery);
        } else {
          // Just "Hey Teja" — start live session
          startLiveSession();
        }
      });
    } else {
      wakeWord.stop();
    }

    return () => {
      wakeWord.stop();
    };
  }, [state.settings.voice.wakeWordEnabled, state.settings.privacy.microphoneEnabled, state.state, state.isLiveSession, startLiveSession, dispatch]);

  // Barge-in: if user starts speaking while TTS is playing, stop TTS
  useEffect(() => {
    if (state.state === 'speaking' && state.isLiveSession) {
      // Monitor for voice input during speaking
      const bargeInListener = () => {
        // If we detect significant voice level, it might be the user trying to interrupt
        // This is handled by the STT starting automatically
      };
      bargeInListener(); // setup
    }
  }, [state.state, state.isLiveSession]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        const s = stateRef.current.state;
        if (s === 'idle' || s === 'error') {
          if (!stateRef.current.isLiveSession) {
            startLiveSession();
          } else {
            startListening();
          }
        } else if (s === 'speaking') {
          stopSpeaking();
        } else if (s === 'listening') {
          stopListening();
        }
      }

      if (e.key === 'Escape') {
        if (stateRef.current.activePanel !== 'none') {
          dispatch({ type: 'SET_PANEL', payload: 'none' });
          return;
        }
        if (stateRef.current.isLiveSession) {
          endLiveSession();
          return;
        }
        speechToText.abort();
        textToSpeech.stop();
        wakeWord.stop();
        dispatch({ type: 'SET_STATE', payload: 'idle' });
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [startListening, stopListening, stopSpeaking, endLiveSession, startLiveSession, dispatch]);

  return {
    startListening,
    stopListening,
    sendTextMessage,
    stopSpeaking,
    triggerScreenCapture,
    startLiveVision,
    stopLiveVision,
    startLiveSession,
    endLiveSession,
    toggleMute,
  };
}

/** Get human-readable description of what an action is doing */
function getActionDescription(tool: ToolCall): string {
  switch (tool.name) {
    case 'open_application': return `Opening ${tool.parameters.name || tool.parameters.application || 'app'}...`;
    case 'open_website': return `Opening ${tool.parameters.name || tool.parameters.url || 'website'}...`;
    case 'open_file': return `Opening file...`;
    case 'youtube_search': return `Searching YouTube...`;
    case 'web_search': return `Searching the web...`;
    case 'mouse_click': return `Clicking at (${tool.parameters.x}, ${tool.parameters.y})...`;
    case 'mouse_scroll': return `Scrolling ${tool.parameters.direction || 'down'}...`;
    case 'keyboard_type': return `Typing...`;
    case 'keyboard_key': return `Pressing ${tool.parameters.key}...`;
    case 'keyboard_hotkey': return `Pressing ${tool.parameters.combo}...`;
    case 'analyze_and_click': return `Looking for ${tool.parameters.element_description}...`;
    case 'capture_screen': return `Analyzing screen...`;
    case 'control_live_app': return `Controlling window...`;
    case 'calculate_in_app': return `Calculating...`;
    case 'draw_in_paint': return `Drawing in Paint...`;
    case 'write_and_open_file': return `Writing file...`;
    case 'open_in_vscode': return `Opening in VS Code...`;
    default: return `Executing ${tool.name}...`;
  }
}

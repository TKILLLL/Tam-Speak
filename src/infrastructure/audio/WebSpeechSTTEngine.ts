import { VietnameseEntityPhoneticNormalizer } from './VietnameseEntityPhoneticNormalizer';

// SpeechRecognition interface declarations for cross-browser Web Speech API support

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

/**
 * WebSpeechSTTEngine
 * Zero-Token, client-side Speech-to-Text using native Web Speech API.
 * Provides continuous transcript streaming, confidence tracking, and auto-restart resilience.
 */
export class WebSpeechSTTEngine {
  private recognition: ISpeechRecognition | null = null;
  private isListening = false;
  private finalTranscript = '';
  private interimTranscript = '';
  private onTranscriptUpdateCallback?: (finalText: string, interimText: string) => void;
  private onErrorCallback?: (error: string) => void;

  constructor() {
    this.initRecognition();
  }

  private initRecognition(): void {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let accumulatedFinal = '';
      let interim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result && result[0]) {
          const text = result[0].transcript;
          if (result.isFinal) {
            accumulatedFinal += `${text} `;
          } else {
            interim += text;
          }
        }
      }

      this.finalTranscript = VietnameseEntityPhoneticNormalizer.normalizeTranscript(accumulatedFinal.trim());
      this.interimTranscript = VietnameseEntityPhoneticNormalizer.normalizeTranscript(interim.trim());
      if (this.onTranscriptUpdateCallback) {
        this.onTranscriptUpdateCallback(this.finalTranscript, this.interimTranscript);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') {
        return; // Ignore normal silence timeouts
      }
      if (this.onErrorCallback) {
        this.onErrorCallback(event.error);
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if user has not explicitly stopped listening
      if (this.isListening && this.recognition) {
        try {
          this.recognition.start();
        } catch {
          // Ignore restart conflicts
        }
      }
    };
  }

  public isSupported(): boolean {
    return this.recognition !== null;
  }

  public start(callbacks: {
    onUpdate: (finalText: string, interimText: string) => void;
    onError?: (error: string) => void;
  }): void {
    if (!this.recognition) {
      callbacks.onError?.('Speech recognition is not supported in this browser.');
      return;
    }

    this.finalTranscript = '';
    this.interimTranscript = '';
    this.onTranscriptUpdateCallback = callbacks.onUpdate;
    this.onErrorCallback = callbacks.onError;
    this.isListening = true;

    try {
      this.recognition.start();
    } catch {
      // Already running
    }
  }

  public stop(): string {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Safe ignore
      }
    }
    const completeText = VietnameseEntityPhoneticNormalizer.normalizeTranscript(
      `${this.finalTranscript} ${this.interimTranscript}`.trim()
    );
    return completeText;
  }

  public abort(): void {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Safe ignore
      }
    }
  }

  public setLanguage(lang: 'en-US' | 'en-GB' | 'en-AU'): void {
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }
}

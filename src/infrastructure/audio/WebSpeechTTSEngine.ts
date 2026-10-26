export interface VoiceOption {
  id: string;
  name: string;
  lang: string;
  accent: 'US' | 'UK' | 'AU' | 'Other';
  voiceObject: SpeechSynthesisVoice;
}

/**
 * WebSpeechTTSEngine
 * Zero-Token, multi-voice Text-to-Speech using native Web Speech Synthesis.
 * Supports natural accent selection (US / UK / AU) and interactive playback control.
 */
export class WebSpeechTTSEngine {
  private availableVoices: VoiceOption[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isSpeaking = false;

  constructor() {
    this.loadVoices();
  }

  private loadVoices(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const populate = () => {
      const rawVoices = window.speechSynthesis.getVoices();
      const englishVoices = rawVoices.filter((v) => v.lang.startsWith('en'));

      this.availableVoices = englishVoices.map((v, index) => {
        let accent: 'US' | 'UK' | 'AU' | 'Other' = 'Other';
        if (v.lang.includes('US') || v.lang === 'en_US') accent = 'US';
        else if (v.lang.includes('GB') || v.lang === 'en_GB') accent = 'UK';
        else if (v.lang.includes('AU') || v.lang === 'en_AU') accent = 'AU';

        return {
          id: `voice-${index}-${v.name}`,
          name: v.name,
          lang: v.lang,
          accent,
          voiceObject: v,
        };
      });

      // Default to US voice or first available English voice
      const defaultUsVoice = this.availableVoices.find((v) => v.accent === 'US') || this.availableVoices[0];
      if (defaultUsVoice) {
        this.selectedVoice = defaultUsVoice.voiceObject;
      }
    };

    populate();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = populate;
    }
  }

  public getVoices(): VoiceOption[] {
    if (this.availableVoices.length === 0) {
      this.loadVoices();
    }
    return this.availableVoices;
  }

  public setVoiceByAccent(accent: 'US' | 'UK' | 'AU'): void {
    const voice = this.availableVoices.find((v) => v.accent === accent);
    if (voice) {
      this.selectedVoice = voice.voiceObject;
    }
  }

  public setVoiceByName(voiceName: string): void {
    const voice = this.availableVoices.find((v) => v.name === voiceName);
    if (voice) {
      this.selectedVoice = voice.voiceObject;
    }
  }

  public speak(
    text: string,
    options?: {
      rate?: number; // 0.8 to 1.2
      pitch?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: Error) => void;
    }
  ): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      options?.onError?.(new Error('SpeechSynthesis is not supported in this browser.'));
      return;
    }

    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }

    utterance.rate = options?.rate ?? 0.95; // Slightly slower than 1.0 for optimal ESL learner clarity
    utterance.pitch = options?.pitch ?? 1.0;

    utterance.onstart = () => {
      this.isSpeaking = true;
      options?.onStart?.();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      options?.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.isSpeaking = false;
      options?.onError?.(new Error(`TTS Error: ${e.error}`));
    };

    window.speechSynthesis.speak(utterance);
  }

  public stop(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }

  public isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }
}

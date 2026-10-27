export interface VoiceOption {
  id: string;
  name: string;
  lang: string;
  accent: 'US' | 'UK' | 'AU' | 'Other';
  voiceObject: SpeechSynthesisVoice;
}

export interface PersonaVoiceConfig {
  persona: string;
  mappedVoiceName: string;
  actualVoice: SpeechSynthesisVoice | null;
  accent: 'US' | 'UK' | 'AU';
  pitch: number;
  rate: number;
  previewSample: string;
}

/**
 * WebSpeechTTSEngine
 * Zero-Token, multi-voice Text-to-Speech using native Web Speech Synthesis.
 * Supports Smart Voice Mapping for Aoede (US), Charon (UK), and Kore (AU).
 * Handles asynchronous getVoices() across macOS, Windows, Chrome, Safari, and Edge.
 */
export class WebSpeechTTSEngine {
  private availableVoices: VoiceOption[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isSpeaking = false;
  private activePersona: string = 'Aoede (US)';
  private manualPersonaVoiceOverrides: Record<string, string> = {};
  private onVoicesLoadedCallbacks: Array<() => void> = [];
  private keepAliveTimer: any = null;

  constructor() {
    this.loadVoices();
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } else {
        this.stopKeepAlive();
      }
    }, 7000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  private loadVoices(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const populate = () => {
      const rawVoices = window.speechSynthesis.getVoices();
      if (!rawVoices || rawVoices.length === 0) return;

      const englishVoices = rawVoices.filter((v) => v.lang.toLowerCase().startsWith('en'));

      this.availableVoices = (englishVoices.length > 0 ? englishVoices : rawVoices).map((v, index) => {
        let accent: 'US' | 'UK' | 'AU' | 'Other' = 'Other';
        const langUpper = v.lang.toUpperCase();
        if (langUpper.includes('US') || langUpper === 'EN_US') accent = 'US';
        else if (langUpper.includes('GB') || langUpper.includes('UK') || langUpper === 'EN_GB') accent = 'UK';
        else if (langUpper.includes('AU') || langUpper === 'EN_AU') accent = 'AU';

        return {
          id: `voice-${index}-${v.name}`,
          name: v.name,
          lang: v.lang,
          accent,
          voiceObject: v,
        };
      });

      // Notify any registered listeners that voices have loaded
      this.onVoicesLoadedCallbacks.forEach((cb) => cb());
    };

    populate();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = populate;
    }
  }

  public subscribeVoicesLoaded(callback: () => void): () => void {
    this.onVoicesLoadedCallbacks.push(callback);
    // If voices already available, invoke immediately
    if (this.availableVoices.length > 0) {
      callback();
    }
    return () => {
      this.onVoicesLoadedCallbacks = this.onVoicesLoadedCallbacks.filter((cb) => cb !== callback);
    };
  }

  public getVoices(): VoiceOption[] {
    if (this.availableVoices.length === 0) {
      this.loadVoices();
    }
    return this.availableVoices;
  }

  /**
   * Smart Voice Mapper for Aoede (US), Charon (UK), Kore (AU)
   */
  public getPersonaConfig(persona: string): PersonaVoiceConfig {
    const voices = this.getVoices();
    const manualVoiceName = this.manualPersonaVoiceOverrides[persona];

    if (manualVoiceName) {
      const found = voices.find((v) => v.name === manualVoiceName);
      if (found) {
        return {
          persona,
          mappedVoiceName: found.name,
          actualVoice: found.voiceObject,
          accent: found.accent === 'Other' ? 'US' : found.accent,
          pitch: persona.includes('UK') ? 0.9 : persona.includes('AU') ? 1.1 : 1.05,
          rate: persona.includes('UK') ? 0.98 : persona.includes('AU') ? 1.02 : 1.0,
          previewSample: this.getPreviewSample(persona),
        };
      }
    }

    if (persona.includes('UK') || persona.toLowerCase().includes('charon')) {
      // Prioritize male UK voice (Google UK English Male, Microsoft George, Daniel, Arthur)
      const ukVoices = voices.filter((v) => v.accent === 'UK');
      const maleUkVoice = ukVoices.find((v) =>
        /male|george|daniel|arthur|oliver/i.test(v.name)
      ) || ukVoices[0] || voices.find((v) => /uk|gb/i.test(v.lang)) || voices[0];

      return {
        persona: 'Charon (UK)',
        mappedVoiceName: maleUkVoice?.name || 'Default British Voice',
        actualVoice: maleUkVoice?.voiceObject || null,
        accent: 'UK',
        pitch: 0.9,
        rate: 0.98,
        previewSample: "Greetings. I am Charon, your British IELTS examiner. We shall focus on your fluency, coherence, and lexical resource.",
      };
    }

    if (persona.includes('AU') || persona.toLowerCase().includes('kore')) {
      // Prioritize Australian voice (Karen, Catherine, Natasha, Google Australian)
      const auVoices = voices.filter((v) => v.accent === 'AU');
      const preferredAu = auVoices.find((v) =>
        /karen|catherine|natasha|australian/i.test(v.name)
      ) || auVoices[0] || voices[0];

      return {
        persona: 'Kore (AU)',
        mappedVoiceName: preferredAu?.name || 'Default Australian Voice',
        actualVoice: preferredAu?.voiceObject || null,
        accent: 'AU',
        pitch: 1.1,
        rate: 1.02,
        previewSample: "G'day! I am Kore, your Australian English conversation coach. Ready to speak naturally with confidence?",
      };
    }

    // Default: Aoede (US) - prioritize female US voice (Samantha, Jenny, Aria, Google US English, Zira)
    const usVoices = voices.filter((v) => v.accent === 'US');
    const femaleUsVoice = usVoices.find((v) =>
      /female|samantha|jenny|aria|victoria|zira|google us english/i.test(v.name)
    ) || usVoices[0] || voices[0];

    return {
      persona: 'Aoede (US)',
      mappedVoiceName: femaleUsVoice?.name || 'Default American Voice',
      actualVoice: femaleUsVoice?.voiceObject || null,
      accent: 'US',
      pitch: 1.05,
      rate: 1.0,
      previewSample: "Hello! I am Aoede, your American English pronunciation coach. Let's speak with natural clarity and confidence.",
    };
  }

  private getPreviewSample(persona: string): string {
    if (persona.includes('UK')) {
      return "Greetings. I am Charon, your British IELTS examiner. We shall focus on your fluency, coherence, and lexical resource.";
    }
    if (persona.includes('AU')) {
      return "G'day! I am Kore, your Australian English conversation coach. Ready to speak naturally with confidence?";
    }
    return "Hello! I am Aoede, your American English pronunciation coach. Let's speak with natural clarity and confidence.";
  }

  public setActivePersona(persona: string): void {
    this.activePersona = persona;
    const config = this.getPersonaConfig(persona);
    if (config.actualVoice) {
      this.selectedVoice = config.actualVoice;
    }
  }

  public setManualVoiceOverride(persona: string, voiceName: string): void {
    this.manualPersonaVoiceOverrides[persona] = voiceName;
    if (this.activePersona === persona) {
      this.setActivePersona(persona);
    }
  }

  public previewVoice(
    persona: string,
    callbacks?: { onStart?: () => void; onEnd?: () => void; onError?: (err: Error) => void }
  ): void {
    const config = this.getPersonaConfig(persona);
    this.speak(config.previewSample, {
      voice: config.actualVoice || undefined,
      pitch: config.pitch,
      rate: config.rate,
      onStart: callbacks?.onStart,
      onEnd: callbacks?.onEnd,
      onError: callbacks?.onError,
    });
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
      rate?: number;
      pitch?: number;
      voice?: SpeechSynthesisVoice;
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

    const cleanText = text.trim();
    if (!cleanText) {
      options?.onEnd?.();
      return;
    }

    // Split long speech into sentence chunks to circumvent the Chrome 15-second speech cutoff bug
    const sentences = cleanText
      .split(/(?<=[.!?\n])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const chunks = sentences.length > 0 ? sentences : [cleanText];
    const personaConfig = this.getPersonaConfig(this.activePersona);
    const chosenVoice = options?.voice || this.selectedVoice || personaConfig.actualVoice;
    const chosenPitch = options?.pitch ?? personaConfig.pitch;
    const chosenRate = options?.rate ?? personaConfig.rate;

    let chunkIndex = 0;
    this.isSpeaking = true;
    this.startKeepAlive();
    options?.onStart?.();

    const speakNextChunk = () => {
      if (!this.isSpeaking || chunkIndex >= chunks.length) {
        this.isSpeaking = false;
        this.stopKeepAlive();
        options?.onEnd?.();
        return;
      }

      const chunkText = chunks[chunkIndex]!;
      chunkIndex += 1;

      const utterance = new SpeechSynthesisUtterance(chunkText);
      utterance.voice = chosenVoice;
      utterance.pitch = chosenPitch;
      utterance.rate = chosenRate;

      utterance.onend = () => {
        speakNextChunk();
      };

      utterance.onerror = (e) => {
        this.isSpeaking = false;
        this.stopKeepAlive();
        options?.onError?.(new Error(`TTS Error: ${e.error}`));
      };

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.speak(utterance);
    };

    speakNextChunk();
  }

  public stop(): void {
    this.stopKeepAlive();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }

  public isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }
}

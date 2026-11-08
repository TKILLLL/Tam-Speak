import { WebSpeechTTSEngine } from './WebSpeechTTSEngine';

/** Compatibility facade for callers that need a single TTS service. */
export class TTSService extends WebSpeechTTSEngine {}

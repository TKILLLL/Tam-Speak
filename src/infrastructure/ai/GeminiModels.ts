/** Text/chat models from AI Studio that fit TamSpeak's generateContent flow.
 * Account-specific availability is validated at runtime with ListModels.
 * Live, TTS, transcription, image, embedding, media-generation and agent models
 * are excluded because they use specialized endpoints or output formats.
 */
export const GEMINI_CHAT_MODEL_PRIORITY = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
  'gemini-4-argon',
  'gemini-4-carbon',
] as const;

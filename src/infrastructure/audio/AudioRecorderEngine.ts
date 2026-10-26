import { dexieDb } from '../database/dexie/TamSpeakDexieDatabase';

export interface RecordedAudioResult {
  recordingId: string;
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
}

/**
 * AudioRecorderEngine
 * High-performance audio capture using W3C MediaRecorder API.
 * Captures microphone stream, encodes to Opus/WebM, and commits Blob directly to Dexie.js
 * with 30-day TTL automatic purge protection.
 */
export class AudioRecorderEngine {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime = 0;
  private durationSeconds = 0;
  private stream: MediaStream | null = null;

  /**
   * Identifies supported high-fidelity audio MIME types on the client.
   */
  public static getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    if (typeof MediaRecorder === 'undefined') {
      return 'audio/webm';
    }

    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  }

  public async start(stream: MediaStream): Promise<void> {
    this.stream = stream;
    this.audioChunks = [];
    this.startTime = Date.now();

    const mimeType = AudioRecorderEngine.getSupportedMimeType();
    const options: MediaRecorderOptions = mimeType ? { mimeType } : {};

    this.mediaRecorder = new MediaRecorder(stream, options);

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(250); // Emit chunk every 250ms
  }

  public async stop(userId: string, sessionId: string): Promise<RecordedAudioResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('MediaRecorder is not active.'));
        return;
      }

      this.durationSeconds = Math.max(0.1, (Date.now() - this.startTime) / 1000);

      this.mediaRecorder.onstop = async () => {
        try {
          if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
          }

          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          const recordingId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          // Save into client Dexie IndexedDB with 30-day TTL
          await dexieDb.saveAudioRecording({
            id: recordingId,
            userId,
            sessionId,
            audioBlob,
            mimeType,
            durationSeconds: this.durationSeconds,
            isBookmarked: false,
          });

          resolve({
            recordingId,
            blob: audioBlob,
            mimeType,
            durationSeconds: this.durationSeconds,
          });
        } catch (err) {
          reject(err);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  public pause(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  public resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  public isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}

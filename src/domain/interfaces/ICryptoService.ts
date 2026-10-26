import { EncryptedApiKey } from '../value-objects/EncryptedApiKey';

export interface ICryptoService {
  /**
   * Encrypts a plaintext API key using AES-GCM 256-bit with PBKDF2 key derivation.
   */
  encryptApiKey(plaintextKey: string, userSessionSecret: string): Promise<EncryptedApiKey>;

  /**
   * Decrypts an EncryptedApiKey payload strictly in-memory (RAM) immediately before transmission,
   * then releases from memory.
   */
  decryptApiKey(encryptedKey: EncryptedApiKey, userSessionSecret: string): Promise<string>;

  /**
   * Redacts sensitive token patterns from error logs or console output.
   */
  redactSensitiveString(input: string): string;
}

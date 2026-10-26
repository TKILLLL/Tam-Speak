import { ICryptoService } from '../../domain/interfaces/ICryptoService';
import { EncryptedApiKey } from '../../domain/value-objects/EncryptedApiKey';
import { SensitiveDataRedactor } from './SensitiveDataRedactor';

/**
 * WebCryptoVaultService
 * Production-grade Cryptographic Vault using the W3C Web Crypto API.
 * - Algorithm: AES-GCM 256-bit encryption
 * - Key Derivation: PBKDF2 (SHA-256, 100,000 iterations)
 * - Random Nonce: 12-byte IV for every encryption call
 * - In-Memory Ephemeral Decryption: Plaintext keys exist in RAM only for the duration of the API call.
 */
export class WebCryptoVaultService implements ICryptoService {
  private static readonly PBKDF2_ITERATIONS = 100_000;
  private static readonly KEY_LENGTH_BITS = 256;
  private static readonly IV_LENGTH_BYTES = 12; // 96 bits standard for AES-GCM
  private static readonly SALT_LENGTH_BYTES = 16; // 128 bits salt

  private get subtle(): SubtleCrypto {
    const cryptoInstance = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
    if (!cryptoInstance || !cryptoInstance.subtle) {
      throw new Error('Web Crypto API (crypto.subtle) is not available in the current environment.');
    }
    return cryptoInstance.subtle;
  }

  private getRandomValues(array: Uint8Array): Uint8Array {
    const cryptoInstance = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
    return cryptoInstance.getRandomValues(array);
  }

  /**
   * Derives an AES-GCM 256-bit CryptoKey from a user secret string (e.g. session token or password)
   * using PBKDF2 with SHA-256 and 100,000 iterations.
   */
  private async deriveEncryptionKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const rawSecret = encoder.encode(secret);

    // Import the secret password as key material
    const baseKey = await this.subtle.importKey(
      'raw',
      rawSecret,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Derive the AES-GCM 256-bit key
    return await this.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: WebCryptoVaultService.PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: WebCryptoVaultService.KEY_LENGTH_BITS },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts a plaintext API key.
   * Produces an EncryptedApiKey Value Object containing Base64 encoded ciphertext, IV, and salt.
   */
  public async encryptApiKey(plaintextKey: string, userSessionSecret: string): Promise<EncryptedApiKey> {
    if (!plaintextKey || plaintextKey.trim().length === 0) {
      throw new Error('Cannot encrypt an empty API key.');
    }
    if (!userSessionSecret || userSessionSecret.trim().length === 0) {
      throw new Error('User session secret is required for key derivation.');
    }

    const salt = this.getRandomValues(new Uint8Array(WebCryptoVaultService.SALT_LENGTH_BYTES));
    const iv = this.getRandomValues(new Uint8Array(WebCryptoVaultService.IV_LENGTH_BYTES));

    const cryptoKey = await this.deriveEncryptionKey(userSessionSecret, salt);

    const encoder = new TextEncoder();
    const encodedData = encoder.encode(plaintextKey.trim());

    const encryptedBuffer = await this.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
      },
      cryptoKey,
      encodedData
    );

    const ciphertext = this.arrayBufferToBase64(encryptedBuffer);
    const ivBase64 = this.uint8ArrayToBase64(iv);
    const saltBase64 = this.uint8ArrayToBase64(salt);

    return EncryptedApiKey.create({
      ciphertext,
      iv: ivBase64,
      salt: saltBase64,
    });
  }

  /**
   * Decrypts an EncryptedApiKey payload strictly in RAM for ephemeral transmission.
   * Plaintext string is returned and must not be persisted to client storage.
   */
  public async decryptApiKey(encryptedKey: EncryptedApiKey, userSessionSecret: string): Promise<string> {
    if (!userSessionSecret || userSessionSecret.trim().length === 0) {
      throw new Error('User session secret is required for key derivation.');
    }

    const ciphertextBuffer = this.base64ToArrayBuffer(encryptedKey.getCiphertext());
    const iv = this.base64ToUint8Array(encryptedKey.getIv());
    const salt = this.base64ToUint8Array(encryptedKey.getSalt());

    const cryptoKey = await this.deriveEncryptionKey(userSessionSecret, salt);

    try {
      const decryptedBuffer = await this.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
        },
        cryptoKey,
        ciphertextBuffer
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch {
      throw new Error(
        'Decryption failed. The secret password/session may be incorrect or the ciphertext was tampered with.'
      );
    }
  }

  /**
   * Redacts sensitive token patterns from error logs or console output.
   */
  public redactSensitiveString(input: string): string {
    return SensitiveDataRedactor.redactString(input);
  }

  // --- Base64 Conversion Helpers (Safe for Binary Data & Universal) ---

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return this.uint8ArrayToBase64(bytes);
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

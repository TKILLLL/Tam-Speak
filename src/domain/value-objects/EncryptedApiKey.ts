import { DomainError } from '../errors/DomainErrors';

export class InvalidEncryptedKeyError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_ENCRYPTED_KEY', 422);
  }
}

/**
 * Immutable Value Object representing an AES-GCM 256-bit encrypted API key payload.
 * Encapsulates ciphertext, initialization vector (IV), and PBKDF2 salt.
 * Ensures no plaintext key ever enters or leaks through this object.
 */
export class EncryptedApiKey {
  private readonly ciphertext: string;
  private readonly iv: string;
  private readonly salt: string;

  private constructor(ciphertext: string, iv: string, salt: string) {
    this.ciphertext = ciphertext;
    this.iv = iv;
    this.salt = salt;
    Object.freeze(this);
  }

  private static isValidBase64(str: string): boolean {
    if (!str || typeof str !== 'string') return false;
    // Standard Base64 regex
    const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    return base64Regex.test(str.trim());
  }

  public static create(params: {
    ciphertext: string;
    iv: string;
    salt: string;
  }): EncryptedApiKey {
    const { ciphertext, iv, salt } = params;

    if (!ciphertext || ciphertext.trim().length === 0) {
      throw new InvalidEncryptedKeyError('Ciphertext cannot be empty.');
    }

    if (!iv || iv.trim().length === 0) {
      throw new InvalidEncryptedKeyError('Initialization Vector (IV) cannot be empty.');
    }

    if (!salt || salt.trim().length === 0) {
      throw new InvalidEncryptedKeyError('Salt cannot be empty.');
    }

    if (!EncryptedApiKey.isValidBase64(ciphertext)) {
      throw new InvalidEncryptedKeyError('Ciphertext must be a valid Base64 encoded string.');
    }

    if (!EncryptedApiKey.isValidBase64(iv)) {
      throw new InvalidEncryptedKeyError('IV must be a valid Base64 encoded string.');
    }

    if (!EncryptedApiKey.isValidBase64(salt)) {
      throw new InvalidEncryptedKeyError('Salt must be a valid Base64 encoded string.');
    }

    return new EncryptedApiKey(ciphertext.trim(), iv.trim(), salt.trim());
  }

  public getCiphertext(): string {
    return this.ciphertext;
  }

  public getIv(): string {
    return this.iv;
  }

  public getSalt(): string {
    return this.salt;
  }

  public toJSON(): { ciphertext: string; iv: string; salt: string } {
    return {
      ciphertext: this.ciphertext,
      iv: this.iv,
      salt: this.salt,
    };
  }

  public equals(other: EncryptedApiKey): boolean {
    return (
      this.ciphertext === other.ciphertext &&
      this.iv === other.iv &&
      this.salt === other.salt
    );
  }
}

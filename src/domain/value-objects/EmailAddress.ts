import { InvalidEmailError } from '../errors/DomainErrors';

/**
 * Immutable Value Object representing a validated email address.
 */
export class EmailAddress {
  private readonly value: string;

  private constructor(email: string) {
    this.value = email;
    Object.freeze(this);
  }

  public static create(email: string): EmailAddress {
    if (!email || typeof email !== 'string') {
      throw new InvalidEmailError('Email cannot be empty.');
    }

    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

    if (!emailRegex.test(trimmed)) {
      throw new InvalidEmailError(email);
    }

    return new EmailAddress(trimmed);
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: EmailAddress): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}

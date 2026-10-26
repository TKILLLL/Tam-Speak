import { User } from '../entities/User';
import { EmailAddress } from '../value-objects/EmailAddress';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: EmailAddress): Promise<User | null>;
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
}

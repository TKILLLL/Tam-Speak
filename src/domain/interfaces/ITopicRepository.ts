import { CustomTopic } from '../entities/CustomTopic';
import { type SkillLevel } from '../entities/User';

export interface ITopicRepository {
  findById(id: string): Promise<CustomTopic | null>;
  findByUserId(userId: string): Promise<CustomTopic[]>;
  findPublicTopics(level?: SkillLevel): Promise<CustomTopic[]>;
  save(topic: CustomTopic): Promise<void>;
  update(topic: CustomTopic): Promise<void>;
  delete(id: string, userId: string): Promise<void>;
  clearMemoryCache?(): void;
}

import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { RatingScale, UserRole, type UserPublic } from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Strip secrets and coerce string columns to their validated enum types. */
  toPublic(user: User): UserPublic {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: UserRole.catch('USER').parse(user.role),
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      bio: user.bio,
      ratingScale: RatingScale.catch('TEN').parse(user.ratingScale),
      createdAt: user.createdAt.toISOString(),
    };
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getPublicById(id: string): Promise<UserPublic> {
    return this.toPublic(await this.findByIdOrThrow(id));
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { User } from '@prisma/client';
import {
  RatingScale,
  UserRole,
  type AdminCreateUserRequest,
  type AdminUpdateUserRequest,
  type AdminUser,
  type AdminUserListResponse,
  type ChangePasswordRequest,
  type UpdateProfileRequest,
  type UserPublic,
} from '@cinelog/contracts';
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

  async updateProfile(userId: string, dto: UpdateProfileRequest): Promise<UserPublic> {
    if (dto.username) {
      const existing = await this.prisma.user.findFirst({
        where: { username: dto.username, NOT: { id: userId } },
      });
      if (existing) throw new ConflictException('Username is already taken');
    }
    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id: userId } },
      });
      if (existing) throw new ConflictException('Email is already taken');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.username !== undefined ? { username: dto.username } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
      },
    });
    return this.toPublic(user);
  }

  async changePassword(userId: string, dto: ChangePasswordRequest): Promise<void> {
    const user = await this.findByIdOrThrow(userId);
    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async setAvatarUrl(userId: string, avatarUrl: string | null): Promise<UserPublic> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
    return this.toPublic(user);
  }

  async setBannerUrl(userId: string, bannerUrl: string | null): Promise<UserPublic> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { bannerUrl } });
    return this.toPublic(user);
  }

  // -- admin -----------------------------------------------------------------

  /** All accounts with light activity counts, newest first. Admin-only. */
  async listUsers(): Promise<AdminUserListResponse> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { statuses: true, ratings: true } },
      },
    });
    return {
      users: users.map<AdminUser>((u) => ({
        ...this.toPublic(u),
        libraryCount: u._count.statuses,
        ratingCount: u._count.ratings,
      })),
    };
  }

  async adminCreateUser(dto: AdminCreateUserRequest): Promise<AdminUser> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.username }, ...(dto.email ? [{ email: dto.email }] : [])] },
    });
    if (existing) throw new ConflictException('Username or email is already taken');

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email ?? null,
        passwordHash,
        role: dto.role,
      },
    });
    return { ...this.toPublic(user), libraryCount: 0, ratingCount: 0 };
  }

  /** Edit an account (role/username/email/password reset). Guards against
   *  demoting or locking out the last remaining admin. */
  async adminUpdateUser(
    actingUserId: string,
    targetId: string,
    dto: AdminUpdateUserRequest,
  ): Promise<AdminUser> {
    const target = await this.findByIdOrThrow(targetId);

    if (dto.username && dto.username !== target.username) {
      const clash = await this.prisma.user.findFirst({
        where: { username: dto.username, NOT: { id: targetId } },
      });
      if (clash) throw new ConflictException('Username is already taken');
    }
    if (dto.email) {
      const clash = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id: targetId } },
      });
      if (clash) throw new ConflictException('Email is already taken');
    }

    // Never let the last admin lose admin rights — it would orphan the panel.
    if (dto.role === 'USER' && target.role === 'ADMIN') {
      await this.assertNotLastAdmin(targetId);
    }

    const data: Record<string, unknown> = {};
    if (dto.username !== undefined) data.username = dto.username;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.password !== undefined) data.passwordHash = await argon2.hash(dto.password);

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data,
      include: { _count: { select: { statuses: true, ratings: true } } },
    });
    return {
      ...this.toPublic(updated),
      libraryCount: updated._count.statuses,
      ratingCount: updated._count.ratings,
    };
  }

  async adminDeleteUser(actingUserId: string, targetId: string): Promise<void> {
    if (actingUserId === targetId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    const target = await this.findByIdOrThrow(targetId);
    if (target.role === 'ADMIN') await this.assertNotLastAdmin(targetId);
    // Cascades remove the user's tracking/ratings/history/artwork (see schema).
    await this.prisma.user.delete({ where: { id: targetId } });
  }

  private async assertNotLastAdmin(targetId: string): Promise<void> {
    const otherAdmins = await this.prisma.user.count({
      where: { role: 'ADMIN', NOT: { id: targetId } },
    });
    if (otherAdmins === 0) {
      throw new BadRequestException('This is the only admin — promote another user first');
    }
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { UserPublic } from '@cinelog/contracts';
import { CurrentUser } from '../common/decorators';
import { UsersService } from './users.service';
import { UploadsService } from '../uploads/uploads.service';
import { ChangePasswordDto, UpdateProfileDto } from './users.dto';

const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif)$/;
const uploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, ok: boolean) => void) => {
    if (!IMAGE_TYPES.test(file.mimetype)) {
      return cb(new BadRequestException('Unsupported image type — use JPEG, PNG, WebP, or GIF'), false);
    }
    cb(null, true);
  },
};

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly uploads: UploadsService,
  ) {}

  @Get('me')
  me(@CurrentUser('sub') userId: string): Promise<UserPublic> {
    return this.users.getPublicById(userId);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserPublic> {
    return this.users.updateProfile(userId, dto);
  }

  @Put('me/password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.users.changePassword(userId, dto);
  }

  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  async uploadAvatar(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UserPublic> {
    if (!file) throw new BadRequestException('No file uploaded');
    const url = await this.uploads.saveImage('avatars', userId, file);
    return this.users.setAvatarUrl(userId, url);
  }

  @Delete('me/avatar')
  async removeAvatar(@CurrentUser('sub') userId: string): Promise<UserPublic> {
    await this.uploads.deleteImage('avatars', userId);
    return this.users.setAvatarUrl(userId, null);
  }

  @Post('me/banner')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  async uploadBanner(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UserPublic> {
    if (!file) throw new BadRequestException('No file uploaded');
    const url = await this.uploads.saveImage('banners', userId, file);
    return this.users.setBannerUrl(userId, url);
  }

  @Delete('me/banner')
  async removeBanner(@CurrentUser('sub') userId: string): Promise<UserPublic> {
    await this.uploads.deleteImage('banners', userId);
    return this.users.setBannerUrl(userId, null);
  }
}

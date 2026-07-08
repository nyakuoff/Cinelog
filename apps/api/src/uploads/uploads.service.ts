import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

export type UploadKind = 'avatars' | 'banners';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** User-uploaded images (avatars, banners), stored under DATA_DIR/uploads. */
@Injectable()
export class UploadsService implements OnModuleInit {
  private uploadsDir!: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const dataDir = this.config.getOrThrow<string>('dataDir');
    this.uploadsDir = join(isAbsolute(dataDir) ? dataDir : resolve(dataDir), 'uploads');
    await mkdir(join(this.uploadsDir, 'avatars'), { recursive: true });
    await mkdir(join(this.uploadsDir, 'banners'), { recursive: true });
  }

  /** Save an uploaded image for a user, replacing any previous file (any extension). */
  async saveImage(kind: UploadKind, userId: string, file: Express.Multer.File): Promise<string> {
    const ext = EXT_BY_MIME[file.mimetype];
    if (!ext) throw new BadRequestException('Unsupported image type — use JPEG, PNG, WebP, or GIF');

    await this.deleteImage(kind, userId);
    const filename = `${userId}${ext}`;
    await writeFile(join(this.uploadsDir, kind, filename), file.buffer);
    // Cache-bust so the browser picks up a replaced image immediately.
    return `/api/uploads/${kind}/${filename}?v=${Date.now()}`;
  }

  async deleteImage(kind: UploadKind, userId: string): Promise<void> {
    const dir = join(this.uploadsDir, kind);
    const existing = await readdir(dir).catch(() => [] as string[]);
    await Promise.all(
      existing
        .filter((f) => f.startsWith(`${userId}.`))
        .map((f) => rm(join(dir, f), { force: true })),
    );
  }

  /** Resolve a validated kind/filename to an absolute path for serving. */
  resolvePath(kind: UploadKind, filename: string): string {
    return join(this.uploadsDir, kind, filename);
  }
}

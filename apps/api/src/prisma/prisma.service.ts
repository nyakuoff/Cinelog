import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
    // WAL lets readers run alongside the writer; NORMAL sync is safe under WAL.
    // PRAGMAs return rows, so they need $queryRawUnsafe. Prisma enables foreign_keys by default;
    // set it explicitly anyway (cascades depend on it).
    for (const p of ['journal_mode=WAL', 'busy_timeout=5000', 'synchronous=NORMAL', 'foreign_keys=ON']) {
      await this.$queryRawUnsafe(`PRAGMA ${p}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

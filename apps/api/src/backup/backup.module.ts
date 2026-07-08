import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { EpisodesModule } from '../episodes/episodes.module';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

@Module({
  imports: [MediaModule, EpisodesModule],
  controllers: [BackupController],
  providers: [BackupService],
})
export class BackupModule {}

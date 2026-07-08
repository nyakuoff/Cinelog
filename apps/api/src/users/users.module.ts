import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { UsersController } from './users.controller';
import { AdminController } from './admin.controller';
import { UsersService } from './users.service';

@Module({
  imports: [UploadsModule],
  controllers: [UsersController, AdminController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

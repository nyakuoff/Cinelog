import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { UserPublic } from '@cinelog/contracts';
import { CurrentUser } from '../common/decorators';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser('sub') userId: string): Promise<UserPublic> {
    return this.users.getPublicById(userId);
  }
}

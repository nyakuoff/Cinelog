import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AdminUser, AdminUserListResponse } from '@cinelog/contracts';
import { CurrentUser, Roles } from '../common/decorators';
import { UsersService } from './users.service';
import { AdminCreateUserDto, AdminUpdateUserDto } from './users.dto';

/** User administration. Every route requires the ADMIN role (enforced by the
 *  global RolesGuard via the class-level @Roles decorator). */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/users')
export class AdminController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(): Promise<AdminUserListResponse> {
    return this.users.listUsers();
  }

  @Post()
  create(@Body() dto: AdminCreateUserDto): Promise<AdminUser> {
    return this.users.adminCreateUser(dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('sub') actingUserId: string,
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ): Promise<AdminUser> {
    return this.users.adminUpdateUser(actingUserId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser('sub') actingUserId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.users.adminDeleteUser(actingUserId, id);
  }
}

import { createZodDto } from 'nestjs-zod';
import {
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  ChangePasswordRequest,
  UpdateProfileRequest,
} from '@cinelog/contracts';

export class UpdateProfileDto extends createZodDto(UpdateProfileRequest) {}
export class ChangePasswordDto extends createZodDto(ChangePasswordRequest) {}
export class AdminCreateUserDto extends createZodDto(AdminCreateUserRequest) {}
export class AdminUpdateUserDto extends createZodDto(AdminUpdateUserRequest) {}

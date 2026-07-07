import { createZodDto } from 'nestjs-zod';
import { LoginRequest, RegisterRequest, SetupRequest } from '@cinelog/contracts';

/** DTO classes wrap the shared Zod schemas so Nest validates + documents them. */
export class SetupDto extends createZodDto(SetupRequest) {}
export class RegisterDto extends createZodDto(RegisterRequest) {}
export class LoginDto extends createZodDto(LoginRequest) {}

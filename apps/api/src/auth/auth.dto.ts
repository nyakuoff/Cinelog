import { createZodDto } from 'nestjs-zod';
import { LoginRequest, SetupRequest } from '@cinelog/contracts';

/** DTO classes wrap the shared Zod schemas so Nest validates + documents them. */
export class SetupDto extends createZodDto(SetupRequest) {}
export class LoginDto extends createZodDto(LoginRequest) {}

import { createZodDto } from 'nestjs-zod';
import { UpdateIntegrationSettingsRequest } from '@cinelog/contracts';

export class UpdateIntegrationSettingsDto extends createZodDto(
  UpdateIntegrationSettingsRequest,
) {}

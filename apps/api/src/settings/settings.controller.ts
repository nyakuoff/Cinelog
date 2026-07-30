import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { IntegrationSettings } from '@cinelog/contracts';
import { Roles } from '../common/decorators';
import { SettingsService } from './settings.service';
import { UpdateIntegrationSettingsDto } from './settings.dto';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /**
   * Admin-only, both directions. Members never need these values: everything
   * the UI shows is assembled by /media/:id/availability, so URLs and key
   * presence stay inside the admin panel.
   */
  @Get('integrations')
  @Roles('ADMIN')
  get(): Promise<IntegrationSettings> {
    return this.settings.getPublic();
  }

  @Put('integrations')
  @Roles('ADMIN')
  update(@Body() dto: UpdateIntegrationSettingsDto): Promise<IntegrationSettings> {
    return this.settings.update(dto);
  }
}

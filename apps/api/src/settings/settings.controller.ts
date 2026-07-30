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

  /** Readable by any signed-in member: the web app needs the URLs to build
   *  "where to watch" links. No credentials are stored here. */
  @Get('integrations')
  get(): Promise<IntegrationSettings> {
    return this.settings.getIntegrations();
  }

  @Put('integrations')
  @Roles('ADMIN')
  update(@Body() dto: UpdateIntegrationSettingsDto): Promise<IntegrationSettings> {
    return this.settings.setIntegrations(dto);
  }
}

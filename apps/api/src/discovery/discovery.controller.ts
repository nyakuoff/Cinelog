import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { DiscoverFilterResponse, DiscoverResponse } from '@cinelog/contracts';
import { Public } from '../common/decorators';
import { DiscoveryService } from './discovery.service';
import { DiscoverFilterDto } from './discovery.dto';

@ApiTags('discovery')
@Public()
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get()
  getDiscover(): Promise<DiscoverResponse> {
    return this.discovery.getDiscover();
  }

  @Get('filter')
  filter(@Query() query: DiscoverFilterDto): Promise<DiscoverFilterResponse> {
    return this.discovery.filter(query);
  }
}

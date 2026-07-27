import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { BrowseResponse, DiscoverFilterResponse, DiscoverResponse } from '@cinelog/contracts';
import { Public } from '../common/decorators';
import { DiscoveryService } from './discovery.service';
import { BrowseDto, DiscoverFilterDto } from './discovery.dto';

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

  @Get('browse')
  browse(@Query() query: BrowseDto): Promise<BrowseResponse> {
    return this.discovery.browse(query);
  }
}

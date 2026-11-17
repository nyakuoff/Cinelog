import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { HomeResponse } from '@cinelog/contracts';
import { CurrentUser } from '../common/decorators';
import { HomeService } from './home.service';

@ApiTags('home')
@ApiBearerAuth()
@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  get(@CurrentUser('sub') viewerId: string): Promise<HomeResponse> {
    return this.home.getHome(viewerId);
  }
}

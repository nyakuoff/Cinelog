import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { PersonDetail } from '@cinelog/contracts';
import { PeopleService } from './people.service';
import { CurrentUser } from '../common/decorators';
import { PersonByNameQueryDto, PersonQueryDto } from './people.dto';

@ApiTags('people')
@ApiBearerAuth()
@Controller('people')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  /**
   * By name — declared before `:id` so it isn't swallowed by that route.
   * Used for credits cached without a person id.
   */
  @Get('by-name')
  byName(
    @CurrentUser('sub') userId: string,
    @Query() query: PersonByNameQueryDto,
  ): Promise<PersonDetail> {
    return this.people.getPersonByName(query.provider, query.name, userId);
  }

  @Get(':id')
  detail(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query() query: PersonQueryDto,
  ): Promise<PersonDetail> {
    return this.people.getPerson(query.provider, id, userId);
  }
}

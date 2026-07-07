import { Body, Controller, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RatingResponse } from '@cinelog/contracts';
import { CurrentUser } from '../common/decorators';
import { RatingsService } from './ratings.service';
import { SetRatingDto } from './ratings.dto';

@ApiTags('ratings')
@ApiBearerAuth()
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Put()
  setRating(
    @CurrentUser('sub') userId: string,
    @Body() dto: SetRatingDto,
  ): Promise<RatingResponse> {
    return this.ratings.setRating(userId, dto);
  }
}

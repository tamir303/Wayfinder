import { StayCalendarQuerySchema, StayDetailQuerySchema, StayReviewsQuerySchema, StaySearchQuerySchema, StaySuggestQuerySchema } from '@wayfinder/shared';
import { createZodDto } from 'nestjs-zod';

export class StaySearchQueryDto extends createZodDto(StaySearchQuerySchema) {}
export class StaySuggestQueryDto extends createZodDto(StaySuggestQuerySchema) {}
export class StayDetailQueryDto extends createZodDto(StayDetailQuerySchema) {}
export class StayCalendarQueryDto extends createZodDto(StayCalendarQuerySchema) {}
export class StayReviewsQueryDto extends createZodDto(StayReviewsQuerySchema) {}

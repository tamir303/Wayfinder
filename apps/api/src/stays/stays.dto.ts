import { StaySearchQuerySchema } from '@wayfinder/shared';
import { createZodDto } from 'nestjs-zod';

export class StaySearchQueryDto extends createZodDto(StaySearchQuerySchema) {}

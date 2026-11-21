import { FlightSearchQuerySchema } from '@wayfinder/shared';
import { createZodDto } from 'nestjs-zod';

export class FlightSearchQueryDto extends createZodDto(FlightSearchQuerySchema) {}

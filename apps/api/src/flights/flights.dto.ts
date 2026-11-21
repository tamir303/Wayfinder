import { FlightCalendarQuerySchema, FlightReturnQuerySchema, FlightSearchQuerySchema } from '@wayfinder/shared';
import { createZodDto } from 'nestjs-zod';

export class FlightSearchQueryDto extends createZodDto(FlightSearchQuerySchema) {}
export class FlightReturnQueryDto extends createZodDto(FlightReturnQuerySchema) {}
export class FlightCalendarQueryDto extends createZodDto(FlightCalendarQuerySchema) {}

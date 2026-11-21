import { GeoSuggestQuerySchema } from '@wayfinder/shared';
import { createZodDto } from 'nestjs-zod';

export class GeoSuggestQueryDto extends createZodDto(GeoSuggestQuerySchema) {}

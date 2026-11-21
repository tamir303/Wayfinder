import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

const UI_VERSION = '5.17.14';
const CDN = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${UI_VERSION}`;

// Swagger UI is the API root. Assets come from a CDN so it also works on Vercel's serverless runtime,
// where the package's static files are not served.
export const applySwagger = (app: INestApplication): void => {
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Wayfinder API')
      .setDescription('Normalized travel API. Authenticate with a Supabase access token (Bearer).')
      .setVersion('0.1.0')
      .addBearerAuth(undefined, 'bearer')
      .build(),
  ));
  SwaggerModule.setup('/', app, document, {
    jsonDocumentUrl: 'openapi.json',
    customCssUrl: `${CDN}/swagger-ui.css`,
    customJs: [`${CDN}/swagger-ui-bundle.js`, `${CDN}/swagger-ui-standalone-preset.js`],
    swaggerOptions: { persistAuthorization: true },
  });
};

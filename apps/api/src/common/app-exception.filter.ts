import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { HTTP_STATUS_BY_CODE, type ApiError } from '@wayfinder/shared';
import type { Response } from 'express';
import { AppError } from './app-error';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.translate(exception);
    response.status(status).json(body);
  }

  private translate(exception: unknown): { status: number; body: ApiError } {
    if (exception instanceof AppError) {
      return {
        status: HTTP_STATUS_BY_CODE[exception.code],
        body: { code: exception.code, message: exception.message },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = status === 401 ? 'UNAUTHENTICATED' : status < 500 ? 'BAD_QUERY' : 'PROVIDER_DOWN';
      return { status, body: { code, message: status < 500 ? 'Invalid request' : 'Unexpected error' } };
    }
    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    return { status: 500, body: { code: 'PROVIDER_DOWN', message: 'Unexpected error' } };
  }
}

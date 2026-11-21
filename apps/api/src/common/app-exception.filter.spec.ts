import { ArgumentsHost, BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { AppError } from './app-error';
import { AppExceptionFilter } from './app-exception.filter';

const run = (exception: unknown) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  new AppExceptionFilter().catch(exception, host);
  return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
};

describe('AppExceptionFilter', () => {
  it('maps AppError to its status and { code, message }', () => {
    expect(run(new AppError('RATE_LIMITED', 'slow down'))).toEqual({
      status: 429,
      body: { code: 'RATE_LIMITED', message: 'slow down' },
    });
  });

  it('maps a 400 HttpException (e.g. zod validation) to BAD_QUERY', () => {
    expect(run(new BadRequestException('bad')).body.code).toBe('BAD_QUERY');
    expect(run(new BadRequestException('bad')).status).toBe(400);
  });

  it('maps a 404 HttpException to NOT_FOUND', () => {
    expect(run(new NotFoundException())).toEqual({ status: 404, body: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  it('maps a 429 HttpException (throttling) to RATE_LIMITED', () => {
    expect(run(new HttpException('Too Many Requests', 429))).toEqual({
      status: 429,
      body: { code: 'RATE_LIMITED', message: 'Too many requests' },
    });
  });

  it('maps an unknown error to 500 PROVIDER_DOWN with a generic message', () => {
    expect(run(new Error('secret db password'))).toEqual({
      status: 500,
      body: { code: 'PROVIDER_DOWN', message: 'Unexpected error' },
    });
  });
});

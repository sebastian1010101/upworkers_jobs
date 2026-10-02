import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, catchError, tap, throwError } from 'rxjs';

interface HttpRequest {
  method: string;
  originalUrl?: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
}

interface HttpResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequest>();
    const response = http.getResponse<HttpResponse>();
    const requestId = validRequestId(request.headers['x-request-id']) ?? randomUUID();
    const startedAt = Date.now();
    response.setHeader('X-Request-Id', requestId);

    const details = (statusCode = response.statusCode) => ({
      requestId,
      method: request.method,
      path: request.originalUrl ?? request.url,
      statusCode,
      durationMs: Date.now() - startedAt,
    });

    return next.handle().pipe(
      tap(() => this.logger.log({ event: 'request_completed', ...details() })),
      catchError((error: unknown) => {
        const statusCode = error instanceof HttpException ? error.getStatus() : 500;
        this.logger.error({ event: 'request_failed', ...details(statusCode), errorType: errorName(error) });
        return throwError(() => error);
      }),
    );
  }
}

function validRequestId(value: string | string[] | undefined): string | undefined {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(value)) return undefined;
  return value;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

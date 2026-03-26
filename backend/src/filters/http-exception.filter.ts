import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();
      errorResponse = typeof responseBody === 'string' 
        ? { code: 'ERROR', message: responseBody as string }
        : responseBody as object;
    } else {
      errorResponse = { 
        code: 'INTERNAL_ERROR', 
        message: 'Internal server error' 
      };
    }

    const finalResponse = {
      ...errorResponse,
      path: request.url,
      timestamp: new Date().toISOString(),
      statusCode: status,
    };

    response.status(status).json(finalResponse);
  }
}


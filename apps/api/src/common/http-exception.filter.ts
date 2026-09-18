import { randomUUID } from "node:crypto";

import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const payload =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : {};
    const code =
      typeof payload.code === "string"
        ? payload.code
        : status >= 500
          ? "INTERNAL_SERVER_ERROR"
          : "BAD_REQUEST";
    const message =
      typeof payload.message === "string"
        ? payload.message
        : Array.isArray(payload.message)
          ? payload.message.join("; ")
          : status >= 500
            ? "服务器内部错误"
            : "请求无效";
    const requestId = request.header("x-request-id") ?? randomUUID();

    if (status >= 500) {
      console.error(`[${requestId}]`, exception);
    }

    response.status(status).json({ code, message, requestId });
  }
}

export class HttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function errorResponse(
  error: unknown,
  statusOverride?: number
): Response {
  if (error instanceof HttpError) {
    return new Response(
      JSON.stringify({
        error: {
          message: error.message,
          status: error.status,
          details: error.details
        }
      }),
      {
        status: statusOverride ?? error.status,
        headers: baseErrorHeaders()
      }
    );
  }

  console.error("未处理异常", error);

  return new Response(
    JSON.stringify({
      error: {
        message: "服务器内部错误，请稍后重试。"
      }
    }),
    {
      status: statusOverride ?? 500,
      headers: baseErrorHeaders()
    }
  );
}

function baseErrorHeaders(): HeadersInit {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*"
  };
}

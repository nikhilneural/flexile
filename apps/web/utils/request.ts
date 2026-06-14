export type RequestSettings = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  accept: "json" | "html" | "pdf";
  url: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  assertOk?: boolean;
} & (object | { formData: string | FormData } | { jsonData: unknown });

export class AbortError extends Error {
  constructor() {
    super("Request aborted");
  }
}

export class ResponseError extends Error {
  constructor(
    message = "Something went wrong.",
    readonly response?: Response,
  ) {
    super(message);
  }
}

export function assertResponseError(e: unknown): asserts e is ResponseError {
  if (!(e instanceof ResponseError)) throw e;
}

export const request = (settings: RequestSettings): Promise<Response> => {
  const body =
    "formData" in settings ? settings.formData : "jsonData" in settings ? JSON.stringify(settings.jsonData) : null;

  const hasFileUpload = "formData" in settings && settings.formData instanceof FormData;

  const contentType = hasFileUpload
    ? false
    : "jsonData" in settings
      ? "application/json"
      : "application/x-www-form-urlencoded; charset=UTF-8";

  const acceptType = {
    json: "application/json",
    html: "text/html",
    pdf: "application/pdf",
  }[settings.accept];

  const headers = new Headers();
  if (contentType) {
    headers.append("Content-Type", contentType);
  }
  headers.append("Accept", acceptType);
  if (settings.headers) {
    for (const [key, value] of Object.entries(settings.headers)) {
      headers.append(key, value);
    }
  }

  return fetch(settings.url, {
    method: settings.method,
    body,
    headers,
    signal: settings.signal ?? null,
  })
    .then(
      (response) => {
        if (response.status === 422) {
          return response.json().then((data: { error_message: string }) => {
            throw new ResponseError(data.error_message);
          });
        }
        if ((settings.assertOk && !response.ok) || response.status >= 500) throw new ResponseError(undefined, response);
        return response;
      },
      (e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") throw new AbortError();
        throw new ResponseError();
      },
    );
};

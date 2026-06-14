import superjson from "superjson";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

let getAuthToken: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  getAuthToken = getter;
}

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL ?? "";
  }
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | null | undefined>): string {
  const base = getBaseUrl();
  const url = new URL(path, base);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params, signal, headers: extraHeaders } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...extraHeaders,
  };

  if (getAuthToken) {
    const token = await getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const url = buildUrl(path, params);

  const response = await fetch(url, {
    method,
    headers,
    body: body instanceof FormData ? body : body !== undefined ? superjson.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      // ignore parse errors
    }
    const message =
      errorData && typeof errorData === "object" && "error_message" in errorData
        ? String((errorData as { error_message: string }).error_message)
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, errorData);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) return undefined as T;

  try {
    return superjson.parse<T>(text);
  } catch {
    return JSON.parse(text) as T;
  }
}

export const apiClient = {
  get<T>(path: string, params?: Record<string, string | number | boolean | null | undefined>, signal?: AbortSignal) {
    return request<T>(path, { method: "GET", params, signal });
  },

  post<T>(path: string, body?: unknown) {
    return request<T>(path, { method: "POST", body });
  },

  put<T>(path: string, body?: unknown) {
    return request<T>(path, { method: "PUT", body });
  },

  patch<T>(path: string, body?: unknown) {
    return request<T>(path, { method: "PATCH", body });
  },

  delete<T>(path: string, body?: unknown) {
    return request<T>(path, { method: "DELETE", body });
  },

  upload<T>(path: string, formData: FormData) {
    return request<T>(path, { method: "POST", body: formData });
  },
};

export class HttpResponseError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly url: string
  ) {
    super(`HTTP ${status} ${statusText}`.trim());
    this.name = "HttpResponseError";
  }
}

export class ResponseContentTypeError extends Error {
  constructor(
    public readonly contentType: string | null,
    public readonly url: string
  ) {
    super(`Expected a JSON response from ${url}, received ${contentType ?? "no Content-Type"}`);
    this.name = "ResponseContentTypeError";
  }
}

/**
 * Orval 生成クライアント共通の HTTP 境界。
 * エラーレスポンスは本文を解析せず、ステータスを保持したまま呼び出し元へ渡す。
 */
export const orvalFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new HttpResponseError(response.status, response.statusText, url);
  }

  if ([204, 205].includes(response.status)) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || (!contentType.includes("application/json") && !contentType.includes("+json"))) {
    throw new ResponseContentTypeError(contentType, url);
  }

  return (await response.json()) as T;
};

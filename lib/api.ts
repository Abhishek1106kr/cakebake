export type ApiClientOptions = RequestInit & { token?: string };

export async function api<T>(path: string, options: ApiClientOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

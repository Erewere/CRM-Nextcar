export function getApiUrl(path: string): string {
  const baseUrl = (import.meta.env.VITE_API_URL as string) || '';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  if (baseUrl) {
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBase}${cleanPath}`;
  }
  
  return cleanPath;
}



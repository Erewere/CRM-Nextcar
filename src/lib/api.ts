export function getApiUrl(path: string): string {
  const envUrl = (import.meta.env.VITE_API_URL as string) || '';
  const localUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('custom_api_url') || '' : '';
  const baseUrl = envUrl || localUrl;

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  if (baseUrl) {
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBase}${cleanPath}`;
  }
  
  return cleanPath;
}


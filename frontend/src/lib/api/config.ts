export function getApiUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("Falta configurar NEXT_PUBLIC_API_URL");
  }
  return apiUrl.replace(/\/$/u, "");
}

import { apiClient } from './client'

export async function login(
  usuario: string,
  password: string,
): Promise<string> {
  const { data } = await apiClient.post<{ token: string }>('/auth/login', {
    usuario,
    password,
  })
  return data.token
}

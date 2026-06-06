// Breaks circular dependency between axios.ts and authStore.ts.
// authStore registers callbacks here; axios.ts reads/writes via these functions.

let getToken: () => string | null = () => null
let setToken: (token: string) => void = () => undefined
let clearAuth: () => void = () => undefined

export function registerTokenHandlers(
  getter: () => string | null,
  setter: (token: string) => void,
  clearer: () => void,
) {
  getToken = getter
  setToken = setter
  clearAuth = clearer
}

export const tokenRegistry = {
  get: () => getToken(),
  set: (token: string) => setToken(token),
  clear: () => clearAuth(),
}

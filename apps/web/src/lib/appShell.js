import { inject } from 'vue'

export const APP_SHELL_KEY = Symbol('app-shell')

export function useAppShell() {
  const shell = inject(APP_SHELL_KEY, null)

  if (!shell) {
    throw new Error('App shell is not available in this route context.')
  }

  return shell
}

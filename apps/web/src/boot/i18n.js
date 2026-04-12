import { boot } from 'quasar/wrappers'
import { i18n, setLocale } from 'src/i18n'

export default boot(({ app }) => {
  app.use(i18n)
  setLocale(i18n.global.locale.value)
})

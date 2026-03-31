import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({
  html: false,         // don't allow raw HTML in source
  linkify: true,       // auto-detect URLs
  typographer: true,   // smart quotes, dashes
  breaks: true,        // newlines → <br>
  highlight(code, lang) {
    const escapedCode = md.utils.escapeHtml(code)
    const highlighted = lang && hljs.getLanguage(lang)
      ? (() => { try { return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value } catch { return escapedCode } })()
      : escapedCode
    const langLabel = lang ? `<span class="hljs-lang-label">${md.utils.escapeHtml(lang)}</span>` : ''
    const copyBtn = `<button class="hljs-copy-btn" onclick="(function(b){var pre=b.closest('.hljs-code-block');var code=pre?pre.querySelector('code'):null;if(!code)return;navigator.clipboard.writeText(code.innerText).then(function(){b.textContent='Copied!';setTimeout(function(){b.textContent='Copy'},1800)})})(this)">Copy</button>`
    return (
      `<pre class="hljs-code-block">${langLabel}${copyBtn}<code class="hljs${lang ? ' language-' + lang : ''}">` +
      highlighted +
      '</code></pre>'
    )
  },
})

// Open external links in new tab
const defaultLinkOpen = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options)
}
md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const aIndex = tokens[idx].attrIndex('target')
  if (aIndex < 0) {
    tokens[idx].attrPush(['target', '_blank'])
    tokens[idx].attrPush(['rel', 'noopener noreferrer'])
  } else {
    tokens[idx].attrs[aIndex][1] = '_blank'
  }
  return defaultLinkOpen(tokens, idx, options, env, self)
}

/**
 * Render markdown text to sanitized HTML.
 * @param {string} text
 * @returns {string}
 */
export function renderMarkdown(text) {
  if (!text) return ''
  const raw = md.render(text)
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'del', 's', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'hr',
      'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'span', 'div', 'button',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'class', 'language', 'onclick'],
  })
}

import { useMemo } from 'preact/hooks'
import { marked } from 'marked'

marked.setOptions({
  breaks: true,
  gfm: true
})

export const Markdown = ({ text }) => {
  const html = useMemo(() => marked.parse(text || ''), [text])
  return <div class="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
}

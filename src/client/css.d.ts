/**
 * 构建把样式表内联为文本（`esbuild --loader:.css=text`），因此 `.css`
 * 导入在运行时是一个字符串。
 *
 * @module dsh-file-shield/src/client/css
 */

declare module '*.css' {
  const text: string
  export default text
}

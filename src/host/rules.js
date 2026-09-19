/**
 * 规则的编译与匹配。
 *
 * 规则是 glob 或字面路径。绝对规则（以 `/` 开头，或 `~` 展开为宿主家目录）匹配目标的
 * 绝对路径；其它规则匹配目标的工作区相对路径，因此绝不会伸到会话工作区之外。目标的
 * 规范化拼法（符号链接已解析）与显示拼法都会参与比较，见 {@link matchRule}。
 *
 * 每个候选都连同它的各级祖先一起匹配，所以写一个目录就等于覆盖它下面的整棵树。匹配
 * 默认不区分大小写：规范化路径带着文件系统存储时的拼法，而在 macOS 与 Windows 默认
 * 使用的大小写不敏感文件系统上，区分大小写的比较会静默漏掉规则。
 *
 * @module dsh-file-shield/src/host/rules
 */

import { homedir } from 'node:os'
import { isAbsolute, join, posix, sep } from 'node:path'

/** 一条编译后的规则：原始拼法、是否为绝对规则，以及它的匹配器。 */
/** @typedef {{ pattern: string, absolute: boolean, glob: boolean, prefix: string, regex: RegExp }} Rule */

/**
 * 一个已解析目标参与规则匹配的几种拼法。
 * @typedef {object} TargetSpellings
 * @property {string} canonical - 后端的稳定身份，符号链接已解析。
 * @property {string} lexical - 调用方写下的绝对路径，链接保持原样。
 * @property {string} displayPath - 面向模型的拼法。
 */

/** 把平台分隔符改写为 `/`，使同一套比较适用于所有平台。 */
/**
 * @param {string} value - 使用宿主分隔符写成的路径。
 * @returns {string} 换成 `/` 分隔符的同一路径。
 */
export function toPosix(value) {
  return sep === '/' ? value : value.split(sep).join('/')
}

/**
 * 为正则表达式转义一个字符。
 * @param {string} character - 要转义的字符。
 * @returns {string} 转义后的字符。
 */
function escapeLiteral(character) {
  return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character
}

/**
 * 在 `start` 处开启的字符类，其闭合 `]` 的下标；未闭合时为 -1。
 * @param {string} pattern - 正在编译的 glob。
 * @param {number} start - 左括号之后一位的下标。
 * @returns {number} 闭合括号的下标，或 -1。
 */
function classEnd(pattern, start) {
  let index = pattern[start] === '!' || pattern[start] === '^' ? start + 1 : start
  if (pattern[index] === ']') index += 1
  for (; index < pattern.length; index += 1) {
    if (pattern[index] === ']') return index
  }
  return -1
}

/**
 * 把一个 glob 编译成两端锚定的正则表达式源码。
 *
 * `**` 跨越目录分隔符，且 `**` 段可以一个目录都不匹配，所以以 `/.env` 结尾的规则也能
 * 匹配裸 `.env`。`*` 与 `?` 绝不跨越分隔符。反斜杠转义下一个字符。
 *
 * @param {string} pattern - glob，使用 `/` 分隔符。
 * @returns {string} 正则表达式源码，不含锚点。
 */
export function globSource(pattern) {
  let source = ''
  let index = 0
  while (index < pattern.length) {
    const character = pattern.charAt(index)
    if (character === '\\') {
      index += 1
      if (index < pattern.length) {
        source += escapeLiteral(pattern.charAt(index))
        index += 1
      }
      continue
    }
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        if (pattern[index + 2] === '/') {
          source += '(?:.*/)?'
          index += 3
          continue
        }
        source += '.*'
        index += 2
        continue
      }
      source += '[^/]*'
      index += 1
      continue
    }
    if (character === '?') {
      source += '[^/]'
      index += 1
      continue
    }
    if (character === '[') {
      const end = classEnd(pattern, index + 1)
      if (end === -1) {
        source += '\\['
        index += 1
        continue
      }
      let body = pattern.slice(index + 1, end)
      const negated = body.startsWith('!') || body.startsWith('^')
      if (negated) body = body.slice(1)
      source += `[${negated ? '^' : ''}${body.replace(/\\/gu, '\\\\')}]`
      index = end + 1
      continue
    }
    source += escapeLiteral(character)
    index += 1
  }
  return source
}

/**
 * 判断一条规则是 glob 还是字面路径的元字符集。
 * `\` 转义会让判断偏向 glob，那只意味着少做一次字面子串检查。
 */
const GLOB_METACHARACTERS = /[*?[\]{}]/u

/**
 * 一条规则的静态前缀：第一个 glob 元字符之前的部分，并在最后一个 `/` 处截断。
 * 用于从工具输出里认出“这一行来自被屏蔽的路径”，而无需解析输出格式。
 *
 * @param {string} spelling - 以 `/` 分隔的规则。
 * @returns {string} 静态前缀；规则不含元字符时就是规则本身。
 */
export function staticPrefix(spelling) {
  const meta = spelling.search(GLOB_METACHARACTERS)
  if (meta === -1) return spelling
  const head = spelling.slice(0, meta)
  const cut = head.lastIndexOf('/')
  return cut <= 0 ? '' : head.slice(0, cut)
}

/**
 * 编译已配置的规则，丢弃空条目与非字符串条目。
 *
 * @param {readonly unknown[]} patterns - 已配置的 `deny` 列表。
 * @param {{ matchCase?: boolean, home?: string }} [options] - 大小写敏感性与 `~` 展开目标。
 * @returns {Rule[]} 编译后的规则，按配置顺序。
 */
export function compileRules(patterns, options = {}) {
  const { matchCase = false, home = homedir() } = options
  const flags = matchCase ? '' : 'i'
  /** @type {Rule[]} */
  const rules = []
  for (const entry of patterns ?? []) {
    if (typeof entry !== 'string') continue
    let pattern = entry.trim()
    if (pattern === '') continue
    let absolute = false
    if (pattern === '~' || pattern.startsWith('~/')) {
      pattern = join(home, pattern.slice(1))
      absolute = true
    } else if (isAbsolute(pattern)) {
      absolute = true
    }
    const spelling = toPosix(pattern)
    rules.push({
      pattern: entry,
      absolute,
      glob: GLOB_METACHARACTERS.test(spelling),
      prefix: staticPrefix(spelling),
      regex: new RegExp(`^${globSource(spelling)}$`, flags),
    })
  }
  return rules
}

/**
 * 一个匹配候选参与比较的取值：它自身，随后是各级祖先目录。把祖先包含进来，目录规则
 * 才能覆盖它下面的整棵树。
 *
 * @param {string} value - 以 `/` 分隔的路径。
 * @returns {string[]} 该候选及其祖先，由近及远。
 */
export function ancestors(value) {
  const chain = [value]
  let current = value
  for (;;) {
    const parent = posix.dirname(current)
    if (parent === current || parent === '.' || parent === '/' || parent === '') break
    chain.push(parent)
    current = parent
  }
  return chain
}

/**
 * 把一个绝对路径表示成相对于某个根的形式；逃出该根时返回 `undefined`。
 *
 * @param {string} root - 绝对的工作区根。
 * @param {string} absolute - 要表示的绝对路径。
 * @returns {string | undefined} 以 `/` 分隔的相对路径；根本身返回 `'.'`。
 */
export function relativeTo(root, absolute) {
  const relative = posix.relative(toPosix(root), toPosix(absolute))
  if (relative === '') return '.'
  if (relative === '..' || relative.startsWith('../')) return undefined
  return relative
}

/**
 * 一个目标参与匹配的绝对拼法，后端重复报告的同一拼法只列一次。
 *
 * @param {TargetSpellings} target - 已解析的目标。
 * @returns {string[]} 规范化拼法与显示拼法，按此顺序。
 */
export function spellingsOf(target) {
  return target.canonical === target.lexical ? [target.canonical] : [target.canonical, target.lexical]
}

/**
 * 把每种拼法表示成相对于工作区的形式，丢掉逃出工作区的那些：相对规则绝不会伸到会话
 * 工作区之外。
 *
 * @param {string | undefined} root - 会话工作区，调用有时才有。
 * @param {TargetSpellings} target - 已解析的目标。
 * @returns {string[]} 工作区相对拼法；没有根时为空。
 */
export function relativesOf(root, target) {
  if (root === undefined) return []
  const relatives = []
  for (const absolute of spellingsOf(target)) {
    const relative = relativeTo(root, absolute)
    if (relative !== undefined) relatives.push(relative)
  }
  return relatives
}

/**
 * 用一个目标去匹配已编译的规则。
 *
 * 同一个目标有两种拼法，规则可能写成其中任一种：规范化身份（`targetKey`，所有符号链接
 * 均已解析）与绝对显示路径（调用方写下的形式，链接保持原样）。macOS 的 `/tmp` 与
 * `/var` 是指向 `/private/...` 的符号链接，因此按路径显示的样子——也就是文件浏览器报告
 * 的样子——写出的规则只匹配显示拼法，而针对真实位置写出的规则只匹配规范化拼法。所以
 * 两种都要测，别名也仍然逃不过针对真实路径写出的规则。
 *
 * @param {readonly Rule[]} rules - 已编译的规则。
 * @param {string | readonly string[]} absolute - 目标的规范化绝对路径、它的显示拼法，或两者。
 * @param {string | readonly string[] | undefined} relative - 每种拼法相对于工作区的形式；逃出工作区或没有已知根时为 `undefined`。
 * @returns {string | undefined} 第一条命中规则的配置拼法。
 */
export function matchRule(rules, absolute, relative) {
  if (rules.length === 0) return undefined
  const absolutes = typeof absolute === 'string' ? [absolute] : absolute
  const relatives = relative === undefined ? [] : typeof relative === 'string' ? [relative] : relative
  const absoluteChains = absolutes.map(candidate => ancestors(toPosix(candidate)))
  const relativeChains = relatives.map(candidate => ancestors(candidate))
  for (const rule of rules) {
    for (const chain of rule.absolute ? absoluteChains : relativeChains) {
      for (const candidate of chain) {
        if (rule.regex.test(candidate)) return rule.pattern
      }
    }
  }
  return undefined
}

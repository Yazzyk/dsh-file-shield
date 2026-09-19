/**
 * 从 shell 命令文本里提取可能与规则命中的路径候选。
 *
 * 这里做的是**尽力而为的静态提取，不是 shell 解释器**：命令是一段文本，
 * 真正的求值发生在子进程里。它覆盖模型实际会写出来的形态——
 * `cat /abs/path`、`head -c 40 backend/data/utils.go`、
 * `cd /dir && cat file`、`FOO=/x python3 -c "open('/x')"`——
 * 而不是刻意混淆（变量拼接、base64、`$(...)` 二次求值）。因此它是防止
 * 误读的一道闸，不是对恶意 shell 的隔离；后者只能靠操作系统级的读取限制
 * 来做。
 *
 * @module dsh-file-shield/src/host/commands
 */

import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'

/** 开启新命令段的元字符：管道、逻辑连接、子 shell、换行。 */
const SEGMENT_SEPARATORS = /[|&;()\n\r\t`]/gu

/** 只分隔词、不开启新命令段的元字符：重定向符号后面跟的是文件名，不是命令名。 */
const PLAIN_SEPARATORS = /[<>]/gu

/** 段落起始标记：一个命令段的第一个词是命令名，不是路径。 */
const SEGMENT_BREAK = '\u0000'

/** 形如 `NAME=value` 的前缀：环境变量赋值。 */
const ASSIGNMENT_PREFIX = /^[A-Za-z_][A-Za-z0-9_]*=/u

/**
 * 去掉一个词两端的引号（成对或不成对都处理，因为按空白切分可能已经拆开了引号）。
 * @param {string} token - 原始词。
 * @returns {string} 去掉引号后的词。
 */
function unquote(token) {
  let result = token
  while (result.startsWith("'") || result.startsWith('"')) result = result.slice(1)
  while (result.endsWith("'") || result.endsWith('"')) result = result.slice(0, -1)
  return result
}

/**
 * 展开词首的 `~`。
 * @param {string} token - 可能是 `~` 或 `~/...` 的词。
 * @returns {string} 展开后的词。
 */
function expandHome(token) {
  if (token === '~') return homedir()
  if (token.startsWith('~/')) return join(homedir(), token.slice(2))
  return token
}

/**
 * @typedef {object} CommandWord
 * @property {string} token - 去掉引号与环境变量前缀后的词。
 * @property {boolean} commandName - 是否为所在命令段的命令名。
 */

/**
 * 把一条命令切成候选词：按 shell 元字符与空白切分，剥引号、剥 `NAME=` 前缀、
 * 丢弃选项（`-` 开头的词），并标出每个命令段的第一个词。
 *
 * 除命令名之外的每个词都会被当作潜在路径——这里不做语法分析，因为“哪个位置的词是
 * 路径”需要真正的 shell 解析，而代价是一个命令段里多几个不会命中的候选。
 *
 * @param {string} command - 模型给出的命令文本。
 * @returns {CommandWord[]} 候选词，按出现顺序。
 */
export function markedWords(command) {
  const words = []
  let atSegmentStart = true
  for (const raw of command
    .replace(SEGMENT_SEPARATORS, ` ${SEGMENT_BREAK} `)
    .replace(PLAIN_SEPARATORS, ' ')
    .split(/\s+/u)) {
    if (raw === SEGMENT_BREAK) {
      atSegmentStart = true
      continue
    }
    const hadAssignment = ASSIGNMENT_PREFIX.test(raw)
    const token = unquote(raw).replace(ASSIGNMENT_PREFIX, '')
    if (token === '' || token.startsWith('-')) continue
    words.push({ token, commandName: atSegmentStart && !hadAssignment })
    if (!hadAssignment) atSegmentStart = false
  }
  return words
}

/**
 * 只取词本身，供调用方直接使用。
 *
 * @param {string} command - 命令文本。
 * @returns {string[]} 候选词。
 */
export function commandWords(command) {
  return markedWords(command).map(word => word.token)
}

/**
 * 把候选词解析成绝对路径。相对词按当前基准目录解析，并跟随命令里出现的
 * `cd <目录>`——`cd /a && cat b.txt` 里的 `b.txt` 属于 `/a`，不属于会话工作区。
 *
 * @param {string} command - 命令文本。
 * @param {string} base - 命令的起始目录。
 * @returns {string[]} 每个候选词对应的绝对路径，命令名不计入。
 */
export function commandPaths(command, base) {
  const words = markedWords(command)
  const paths = []
  let current = base
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]
    if (word === undefined) continue
    const expanded = expandHome(word.token)
    if (expanded === 'cd') {
      const next = words[index + 1]
      if (next === undefined) continue
      const destination = expandHome(next.token)
      current = isAbsolute(destination) ? destination : resolve(current, destination)
      paths.push(current)
      index += 1
      continue
    }
    if (word.commandName) continue
    paths.push(isAbsolute(expanded) ? expanded : resolve(current, expanded))
  }
  return paths
}

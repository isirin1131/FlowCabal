// 当 launcher 以子进程方式起 Next server 时，server.js 头部会 process.chdir(__dirname)
// 让 cwd 变成 standalone 目录；launcher 通过 env 把用户原始项目目录传进来。
// dev 模式（bun dev）下 env 没设，fallback 到 process.cwd() 即可。
export function getProjectRoot(): string {
  const fromEnv = process.env.FLOWCABAL_PROJECT_ROOT
  if (fromEnv && fromEnv.length > 0) return fromEnv
  return process.cwd()
}

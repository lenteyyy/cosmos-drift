import { spawn } from 'node:child_process';
import { mkdir, open, readFile, writeFile, rm, rmdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';

const root = fileURLToPath(new URL('../', import.meta.url));
const portArg = process.argv.indexOf('--port');
const port = Number(portArg >= 0 ? process.argv[portArg + 1] : process.env.COSMOS_PORT || 5173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error('端口必须是1024至65535的整数。');
const runtime = new URL('../.runtime/', import.meta.url),
  pidFile = new URL(`server-${port}.json`, runtime),
  lock = new URL(`start-${port}.lock`, runtime);
const instance = createHash('sha256').update(root).digest('hex').slice(0, 16);
const url = `http://127.0.0.1:${port}`;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function health() {
  try {
    const response = await fetch(url + '/__cosmos/health', { signal: AbortSignal.timeout(1000) });
    const data = await response.json();
    return data.app === 'cosmos-drift' && data.instance === instance ? data : null;
  } catch {
    return null;
  }
}
async function occupied() {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(600, () => finish(false));
  });
}
async function start() {
  await mkdir(runtime, { recursive: true });
  let acquired = false;
  for (let i = 0; i < 150; i++) {
    const running = await health();
    if (running) {
      console.log(`COSMOS DRIFT 已运行：${url}/`);
      return;
    }
    try {
      await mkdir(lock);
      acquired = true;
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const info = await stat(lock).catch(() => null);
      if (info && Date.now() - info.mtimeMs > 30000) await rmdir(lock).catch(() => {});
      await pause(100);
    }
  }
  if (!acquired) throw Error('另一次启动尚未完成，请稍后重试。');
  try {
    if (await occupied()) throw Error(`${port} 端口由其他服务占用；未停止或覆盖该服务。`);
    const log = await open(new URL(`server-${port}.log`, runtime), 'a');
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '--strictPort',
      ],
      {
        cwd: root,
        detached: true,
        stdio: ['ignore', log.fd, log.fd],
        env: { ...process.env, NODE_ENV: 'development' },
      },
    );
    let launchError = null;
    child.on('error', (error) => {
      launchError = error;
    });
    child.unref();
    await log.close();
    for (let i = 0; i < 150; i++) {
      if (launchError) throw launchError;
      const running = await health();
      if (running) {
        await writeFile(
          pidFile,
          JSON.stringify({ pid: running.pid, instance, startedAt: new Date().toISOString() }),
        );
        console.log(
          `COSMOS DRIFT 已启动：${url}/\n关闭启动窗口不会停止游戏；停止服务请运行 npm stop -- --port ${port}。`,
        );
        return;
      }
      if (child.exitCode !== null) break;
      await pause(100);
    }
    throw Error(`服务未就绪，请查看 .runtime/server-${port}.log。`);
  } finally {
    await rmdir(lock).catch(() => {});
  }
}
async function stop() {
  const running = await health();
  if (!running) {
    console.log('COSMOS DRIFT 当前未运行。');
    return;
  }
  const saved = await readFile(pidFile, 'utf8')
    .then(JSON.parse)
    .catch(() => null);
  if (saved?.pid !== running.pid || saved?.instance !== instance)
    throw Error('服务不属于此启动器，未终止该进程。');
  process.kill(running.pid, 'SIGTERM');
  for (let i = 0; i < 50; i++) {
    if (!(await health())) {
      await rm(pidFile, { force: true });
      console.log('COSMOS DRIFT 已停止。');
      return;
    }
    await pause(100);
  }
  throw Error(`服务尚未停止，请查看 .runtime/server-${port}.log。`);
}
try {
  const command = process.argv[2] || 'start';
  if (command === 'start') await start();
  else if (command === 'stop') await stop();
  else if (command === 'restart') {
    await stop();
    await start();
  } else if (command === 'status') {
    const running = await health();
    console.log(running ? `COSMOS DRIFT 在线：${url}/` : 'COSMOS DRIFT 离线');
    process.exitCode = running ? 0 : 1;
  } else throw Error('用法：node scripts/server.mjs start|stop|restart|status [--port 5174]');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

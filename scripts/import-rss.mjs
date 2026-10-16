import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseFeed, mergePosts } from './rsshub.mjs';

const defaultUrl = 'http://localhost:1200/twitter/user/thsottiaux';
const args = process.argv.slice(2);
const options = {};
for (let index = 0; index < args.length; index++) {
  const flag = args[index];
  if (flag === '--help') {
    console.log('用法：npm run import:rss -- [--url RSS地址 | --file RSS文件] [--output JSON文件]\n默认地址：http://localhost:1200/twitter/user/thsottiaux\n默认归档：data/thsottiaux-rss.json\n先保留原文供核实，不会自动把推文标成日历更新。');
    process.exit(0);
  }
  if (!['--url', '--file', '--output'].includes(flag) || !args[index + 1] || args[index + 1].startsWith('--')) {
    console.error('参数无效，请运行 npm run import:rss -- --help。');
    process.exit(1);
  }
  options[flag.slice(2)] = args[++index];
}

let temporaryFile;
try {
  if (options.file && options.url) throw new Error('--file 和 --url 只能选择一个。');
  let xml;
  let source;
  if (options.file) {
    xml = await readFile(resolve(options.file), 'utf8');
    source = 'offline-rss';
  } else {
    const endpoint = new URL(options.url ?? process.env.RSSHUB_URL ?? defaultUrl);
    if (!['http:', 'https:'].includes(endpoint.protocol)) throw new Error('RSSHub 地址必须使用 HTTP 或 HTTPS。');
    let response;
    try {
      response = await fetch(endpoint, { signal: AbortSignal.timeout(20_000), headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } });
    } catch (error) {
      const code = error.cause?.code ?? error.name;
      throw new Error(`无法连接 RSSHub（${code}）。当前进程的 localhost 指当前运行机器；如果 RSSHub 在另一台电脑，请用 --url 提供可访问地址，或使用 --file 导入 XML。`);
    }
    if (!response.ok) throw new Error(`RSSHub 返回 HTTP ${response.status}；未覆盖已有归档。`);
    xml = await response.text();
    // 不将访问参数或 URL 中的认证信息写入归档。
    source = `${endpoint.protocol}//${endpoint.host}${endpoint.pathname}`;
  }
  const result = parseFeed(xml);
  const output = resolve(options.output ?? 'data/thsottiaux-rss.json');
  let previous = [];
  try {
    const archive = JSON.parse(await readFile(output, 'utf8'));
    if (archive.schemaVersion !== 1 || archive.publisher !== 'thsottiaux' || !Array.isArray(archive.posts)) throw new Error('现有归档格式不匹配，未覆盖文件。');
    previous = archive.posts;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const posts = mergePosts(previous, result.posts);
  const archive = { schemaVersion: 1, publisher: 'thsottiaux', source, importedAt: new Date().toISOString(), timezone: 'Asia/Shanghai', posts };
  await mkdir(dirname(output), { recursive: true });
  const target = `${output}.${process.pid}.tmp`;
  await writeFile(target, `${JSON.stringify(archive, null, 2)}\n`, { flag: 'wx' });
  temporaryFile = target;
  await rename(target, output);
  temporaryFile = undefined;
  console.log(`已读取 ${result.posts.length} 条官方账号帖子，归档共 ${posts.length} 条；跳过 ${result.skipped} 条非该账号的链接。\n归档：${output}\n原文与时间已保存，仍需核实计划起始日和公告内容后填入日历。`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (temporaryFile) await unlink(temporaryFile).catch(() => {});
}

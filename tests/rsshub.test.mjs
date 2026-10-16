import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { htmlToText, mergePosts, officialPostUrl, parseFeed } from '../scripts/rsshub.mjs';

const run = promisify(execFile);
const importer = resolve('scripts/import-rss.mjs');
// These are test fixtures only, never official announcements or application data.
const item = ({ id = '10001', handle = 'thsottiaux', date = 'Fri, 16 Oct 2026 16:30:00 GMT', body = '<p>Fixture only: reset &amp; update.</p>', title = 'Fixture post' } = {}) => `<item><title>${title}</title><link>https://twitter.com/${handle}/status/${id}?s=20</link><pubDate>${date}</pubDate><description><![CDATA[${body}]]></description></item>`;
const rss = (...items) => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Fixture feed</title>${items.join('')}</channel></rss>`;

test('RSSHub RSS preserves original content and publication time with the Chinese calendar date', () => {
  const result = parseFeed(rss(item()));
  assert.equal(result.posts.length, 1);
  const post = result.posts[0];
  assert.equal(post.url, 'https://x.com/thsottiaux/status/10001');
  assert.equal(post.publishedAt, '2026-10-16T16:30:00.000Z');
  assert.equal(post.originalPublishedAt, 'Fri, 16 Oct 2026 16:30:00 GMT');
  assert.equal(post.date, '2026-10-17');
  assert.equal(post.text, 'Fixture only: reset & update.');
});

test('Atom alternate links and encoded HTML are parsed', () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Fixture</title><entry><title>Fixture title</title><link rel="self" href="https://example.com/other"/><link rel="alternate" href="https://x.com/thsottiaux/status/10002"/><published>2026-10-15T09:00:00Z</published><content type="html">&lt;p&gt;First&lt;/p&gt;&lt;p&gt;Second&lt;/p&gt;</content></entry></feed>`;
  const [post] = parseFeed(xml).posts;
  assert.equal(post.url, 'https://x.com/thsottiaux/status/10002');
  assert.equal(post.text, 'First\n\nSecond');
});

test('HTML decoding preserves readable lines and excludes scripts and styles', () => {
  assert.equal(htmlToText('<p>A &amp; B</p><script>bad()</script><style>.hidden{}</style><p>第二行 &#128578;</p>'), 'A & B\n\n第二行 🙂');
});

test('foreign account posts are skipped rather than attributed to the publisher', () => {
  const result = parseFeed(rss(item(), item({ handle: 'another_account', id: '10002' })));
  assert.equal(result.posts.length, 1);
  assert.equal(result.skipped, 1);
  assert.equal(officialPostUrl('https://x.com/another_account/status/10002'), null);
  assert.equal(officialPostUrl('https://x.com.evil.example/thsottiaux/status/10002'), null);
  assert.equal(officialPostUrl('https://x.com/thsottiaux/status/10002/photo/1'), 'https://x.com/thsottiaux/status/10002');
});

test('RSS duplicates are canonicalized and reposts are flagged for review', () => {
  const result = parseFeed(rss(item(), item(), item({ id: '10002', title: 'RT @example: fixture repost' })));
  assert.equal(result.posts.length, 2);
  assert.equal(result.posts.find((post) => post.url.endsWith('/10002')).kind, 'repost');
});

test('bad, empty and incomplete upstream responses fail instead of creating a successful empty import', () => {
  assert.throws(() => parseFeed('<rss>'), /格式无效/);
  assert.throws(() => parseFeed('<html><body>Login required</body></html>'), /不是 RSS/);
  assert.throws(() => parseFeed(rss()), /没有任何条目/);
  assert.throws(() => parseFeed(rss(item({ date: '' }))), /发布时间/);
  assert.throws(() => parseFeed(rss(item({ handle: 'another_account' }))), /没有可确认/);
  assert.throws(() => parseFeed('<!DOCTYPE rss><rss/>'), /DOCTYPE/);
});

test('merging repeated imports keeps older history and updates duplicated posts', () => {
  const old = parseFeed(rss(item({ id: '10001', date: '2026-10-01T09:00:00Z' }))).posts;
  const incoming = parseFeed(rss(item({ id: '10002' }), item({ id: '10001', date: '2026-10-01T09:00:00Z', body: 'Revised fixture' }))).posts;
  const merged = mergePosts(old, incoming);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].url.endsWith('/10002'), true);
  assert.equal(merged[1].text, 'Revised fixture');
});

test('CLI imports a real local HTTP response and preserves existing data on upstream error', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tibo-rss-test-'));
  const output = join(directory, 'archive.json');
  let broken = false;
  const server = createServer((_request, response) => {
    response.writeHead(broken ? 503 : 200, { 'Content-Type': 'application/rss+xml' });
    response.end(broken ? 'RSSHub upstream unavailable' : rss(item()));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/twitter/user/thsottiaux`;
  try {
    const result = await run(process.execPath, [importer, '--url', endpoint, '--output', output]);
    assert.match(result.stdout, /已读取 1 条/);
    const original = await readFile(output, 'utf8');
    const archive = JSON.parse(original);
    assert.equal(archive.publisher, 'thsottiaux');
    assert.equal(archive.posts[0].text, 'Fixture only: reset & update.');
    assert.equal(archive.posts[0].publicationStatus, undefined);
    broken = true;
    await assert.rejects(run(process.execPath, [importer, '--url', endpoint, '--output', output]), (error) => error.code === 1 && /HTTP 503/.test(error.stderr));
    assert.equal(await readFile(output, 'utf8'), original);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true });
  }
});

test('CLI accepts offline XML and repeated imports retain previous entries', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tibo-rss-offline-'));
  const input = join(directory, 'feed.xml');
  const output = join(directory, 'archive.json');
  try {
    await writeFile(input, rss(item({ id: '10001' })));
    await run(process.execPath, [importer, '--file', input, '--output', output]);
    await writeFile(input, rss(item({ id: '10002' })));
    await run(process.execPath, [importer, '--file', input, '--output', output]);
    const archive = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(archive.source, 'offline-rss');
    assert.equal(archive.posts.length, 2);
  } finally { await rm(directory, { recursive: true }); }
});

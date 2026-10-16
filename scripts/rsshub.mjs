import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { Parser } from 'htmlparser2';

const publisher = 'thsottiaux';
const list = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
const xmlText = (value) => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(xmlText).join('\n');
  return value && typeof value === 'object' ? xmlText(value['#text'] ?? value['#cdata'] ?? '') : '';
};

export function htmlToText(html) {
  const chunks = [];
  let ignoredDepth = 0;
  const parser = new Parser({
    onopentag(name) {
      if (name === 'script' || name === 'style') ignoredDepth++;
      if (!ignoredDepth && ['br', 'p', 'div', 'li', 'blockquote'].includes(name)) chunks.push('\n');
    },
    ontext(text) { if (!ignoredDepth) chunks.push(text); },
    onclosetag(name) {
      if (name === 'script' || name === 'style') ignoredDepth = Math.max(0, ignoredDepth - 1);
      if (!ignoredDepth && ['p', 'div', 'li', 'blockquote'].includes(name)) chunks.push('\n');
    },
  }, { decodeEntities: true });
  parser.end(String(html ?? ''));
  return chunks.join('').replace(/\r\n?/g, '\n').replace(/[\t\u00a0 ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function officialPostUrl(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname)) return null;
  const match = url.pathname.match(/^\/thsottiaux\/status\/(\d+)(?:\/.*)?$/i);
  return match ? `https://x.com/${publisher}/status/${match[1]}` : null;
}

export function parseFeed(xml) {
  if (/<!DOCTYPE/i.test(xml)) throw new Error('订阅不应包含 DOCTYPE。');
  const valid = XMLValidator.validate(xml);
  if (valid !== true) throw new Error(`RSS/XML 格式无效：${valid.err.msg}`);
  const document = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: false,
    removeNSPrefix: true,
  }).parse(xml);
  const rss = document.rss?.channel;
  const atom = document.feed;
  if (!rss && !atom) throw new Error('返回内容不是 RSS 或 Atom 订阅。');
  const entries = list(rss?.item ?? atom?.entry);
  if (!entries.length) throw new Error('订阅没有任何条目；请检查 RSSHub 路由及上游状态。');
  const posts = new Map();
  let skipped = 0;
  for (const entry of entries) {
    const atomLink = list(entry.link).find((link) => typeof link === 'object' && (!link['@_rel'] || link['@_rel'] === 'alternate'));
    const sourceUrl = typeof entry.link === 'string' ? entry.link.trim() : atomLink?.['@_href'] ?? xmlText(entry.guid).trim();
    const url = officialPostUrl(sourceUrl);
    if (!url) { skipped++; continue; }
    const originalPublishedAt = xmlText(entry.pubDate ?? entry.published ?? entry.date ?? entry.updated).trim();
    const timestamp = Date.parse(originalPublishedAt);
    if (!originalPublishedAt || Number.isNaN(timestamp)) throw new Error(`官方帖子缺少有效发布时间：${url}`);
    const publishedAt = new Date(timestamp).toISOString();
    const title = htmlToText(xmlText(entry.title));
    const text = htmlToText(xmlText(entry.encoded ?? entry.content ?? entry.description ?? entry.summary)) || title;
    if (!text) throw new Error(`官方帖子正文为空：${url}`);
    const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(timestamp));
    const part = (name) => dateParts.find((item) => item.type === name).value;
    posts.set(url, {
      url,
      author: publisher,
      title,
      text,
      publishedAt,
      originalPublishedAt,
      date: `${part('year')}-${part('month')}-${part('day')}`,
      kind: /^(?:RT\s+@|转发\s*[@：:])/i.test(title || text) ? 'repost' : 'post',
    });
  }
  if (!posts.size) throw new Error('订阅中没有可确认属于 @thsottiaux 的原始帖子链接。');
  return { posts: [...posts.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), skipped };
}

export function mergePosts(previous, incoming) {
  const merged = new Map();
  for (const post of [...previous, ...incoming]) {
    if (!post || officialPostUrl(post.url) !== post.url || post.author !== publisher || Number.isNaN(Date.parse(post.publishedAt))) {
      throw new Error('已有归档包含无效帖子，请先检查归档；未覆盖已有数据。');
    }
    merged.set(post.url, post);
  }
  return [...merged.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

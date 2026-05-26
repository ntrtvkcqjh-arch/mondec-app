const FEEDS = [
  { url: 'https://www.compta-online.com/rss.php', category: 'COMPTABILITÉ', source: 'Compta Online' },
  { url: 'https://bofip.impots.gouv.fr/bofip/rss/bofipRSS.rss', category: 'FISCAL', source: 'BOFIP' },
  { url: 'https://www.village-justice.com/rss/articles.php', category: 'DROIT', source: 'Village Justice' },
  { url: 'https://www.experts-comptables.fr/rss.php', category: 'CSOEC', source: 'Experts-Comptables.fr' },
  { url: 'https://www.legifiscal.fr/rss/toutes_actualites.xml', category: 'FISCAL', source: 'LégiFiscal' },
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');

  const results = await Promise.allSettled(
    FEEDS.map(f => fetchAndParse(f.url, f.category, f.source))
  );

  const allItems = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      allItems.push(...result.value);
    }
  }

  allItems.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  const unique = [];
  const seen = new Set();
  for (const item of allItems) {
    const key = item.title.slice(0, 60).toLowerCase().replace(/\s+/g, ' ').trim();
    if (!seen.has(key)) { seen.add(key); unique.push(item); }
  }

  res.json({
    items: unique.slice(0, 12),
    updatedAt: new Date().toISOString(),
    count: unique.length,
    sources: results.map((r, i) => ({
      name: FEEDS[i].source,
      ok: r.status === 'fulfilled' && r.value.length > 0,
      count: r.status === 'fulfilled' ? r.value.length : 0,
    })),
  });
};

async function fetchAndParse(url, category, source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*', 'User-Agent': 'PHDDEC/1.0' },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const text = await res.text();
    return parseRSS(text, category, source);
  } catch (_) {
    clearTimeout(timer);
    return [];
  }
}

function parseRSS(xml, category, source) {
  const items = [];
  const rssItems = matchAll(xml, /<item[\s>]([\s\S]*?)<\/item>/gi);
  const atomItems = rssItems.length === 0 ? matchAll(xml, /<entry[\s>]([\s\S]*?)<\/entry>/gi) : [];
  const rawItems = rssItems.concat(atomItems);

  for (const body of rawItems) {
    const title = getText(body, ['title']);
    if (!title || title.length < 5) continue;

    const link = getLink(body);
    const description = getText(body, ['description', 'summary', 'content']);
    const pubDate = getText(body, ['pubDate', 'published', 'updated']);
    const cat = getText(body, ['category']) || category;
    const parsedDate = tryParseDate(pubDate);

    items.push({
      title: clean(title),
      link: clean(link),
      description: stripHTML(clean(description)).slice(0, 450),
      pubDate: parsedDate,
      category: cleanCat(cat),
      source,
    });
    if (items.length >= 8) break;
  }
  return items;
}

function matchAll(str, regex) {
  const out = [];
  let m;
  regex.lastIndex = 0;
  while ((m = regex.exec(str)) !== null) { out.push(m[1]); }
  return out;
}

function getText(xml, tags) {
  for (const tag of tags) {
    const safe = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cdata = xml.match(new RegExp('<' + safe + '[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/' + safe + '>', 'i'));
    if (cdata) return cdata[1].trim();
    const plain = xml.match(new RegExp('<' + safe + '[^>]*>([^<]*)<\\/' + safe + '>', 'i'));
    if (plain) return plain[1].trim();
    const multi = xml.match(new RegExp('<' + safe + '[^>]*>([\\s\\S]*?)<\\/' + safe + '>', 'i'));
    if (multi && !multi[1].includes('<item') && !multi[1].includes('<entry')) return multi[1].trim();
  }
  return '';
}

function getLink(xml) {
  const href = xml.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  if (href) return href[1];
  const plain = xml.match(/<link[^>]*>([^<]+)<\/link>/i);
  if (plain) return plain[1].trim();
  const guid = xml.match(/<guid[^>]*>([^<]+)<\/guid>/i);
  if (guid && guid[1].startsWith('http')) return guid[1].trim();
  return '';
}

function tryParseDate(str) {
  if (!str) return null;
  try { const d = new Date(str); return isNaN(d.getTime()) ? null : d.toISOString(); } catch (_) { return null; }
}

function cleanCat(cat) {
  return (cat || 'ACTUALITÉ').replace(/<[^>]+>/g, '').split(/[,/|]/)[0].trim().toUpperCase().slice(0, 18);
}

function stripHTML(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function clean(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, ' ').trim();
}

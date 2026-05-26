const FEEDS = [
  {
    url: 'https://www.compta-online.com/rss.php',
    category: 'COMPTABILITÉ',
    source: 'Compta Online'
  },
  {
    url: 'https://www.experts-comptables.fr/rss.php',
    category: 'CSOEC',
    source: 'Experts-Comptables.fr'
  },
  {
    url: 'https://bofip.impots.gouv.fr/bofip/rss/bofipRSS.rss',
    category: 'FISCAL',
    source: 'BOFIP'
  },
  {
    url: 'https://www.legifrance.gouv.fr/atom/code/last_modified_codes.atom',
    category: 'JURIDIQUE',
    source: 'Légifrance'
  },
  {
    url: 'https://www.village-justice.com/rss/articles.php',
    category: 'DROIT',
    source: 'Village Justice'
  }
];

export const config = { runtime: 'edge' };

export default async function handler(req) {
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
    const key = item.title.slice(0, 60).toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return new Response(
    JSON.stringify({
      items: unique.slice(0, 12),
      updatedAt: new Date().toISOString(),
      count: unique.length,
      sources: results.map((r, i) => ({
        name: FEEDS[i].source,
        ok: r.status === 'fulfilled' && r.value.length > 0,
        count: r.status === 'fulfilled' ? r.value.length : 0
      }))
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=300',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}

async function fetchAndParse(url, category, source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
        'User-Agent': 'PHDDEC-Stage-Monitor/1.0'
      }
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return parseXML(text, category, source);
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

function parseXML(xml, category, source) {
  const items = [];

  // Try RSS <item> tags first, then Atom <entry> tags
  const rssMatch = [...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)];
  const atomMatch = rssMatch.length === 0
    ? [...xml.matchAll(/<entry[\s>]([\s\S]*?)<\/entry>/gi)]
    : [];
  const rawItems = [...rssMatch, ...atomMatch];

  for (const m of rawItems) {
    const body = m[1];
    const title = getText(body, ['title']);
    const link = getLink(body);
    const description = getText(body, ['description', 'summary', 'content']);
    const pubDate = getText(body, ['pubDate', 'published', 'updated', 'dc:date']);
    const itemCategory = getText(body, ['category']) || category;

    if (!title || title.length < 5) continue;

    const cleanDesc = stripHTML(decodeEntities(description)).slice(0, 450);
    const parsedDate = pubDate ? tryParseDate(pubDate) : null;

    items.push({
      title: decodeEntities(title).replace(/\s+/g, ' ').trim(),
      link: decodeEntities(link).trim(),
      description: cleanDesc,
      pubDate: parsedDate,
      category: cleanCategory(itemCategory),
      source
    });

    if (items.length >= 8) break;
  }

  return items;
}

function getText(xml, tags) {
  for (const tag of tags) {
    // CDATA version
    const cdata = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'));
    if (cdata) return cdata[1].trim();
    // Plain text version
    const plain = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
    if (plain) return plain[1].trim();
    // Multiline plain
    const multi = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    if (multi && !multi[1].includes('<item') && !multi[1].includes('<entry')) {
      return multi[1].trim();
    }
  }
  return '';
}

function getLink(xml) {
  // Try <link href="..."> (Atom)
  const href = xml.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  if (href) return href[1];
  // Try <link>URL</link>
  const plain = xml.match(/<link[^>]*>([^<]+)<\/link>/i);
  if (plain) return plain[1].trim();
  // Try <guid>URL</guid>
  const guid = xml.match(/<guid[^>]*>([^<]+)<\/guid>/i);
  if (guid && guid[1].startsWith('http')) return guid[1].trim();
  return '';
}

function tryParseDate(str) {
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {}
  return null;
}

function cleanCategory(cat) {
  if (!cat) return 'ACTUALITÉ';
  return cat
    .replace(/<[^>]+>/g, '')
    .split(/[,/|]/)[0]
    .trim()
    .toUpperCase()
    .slice(0, 18);
}

function stripHTML(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

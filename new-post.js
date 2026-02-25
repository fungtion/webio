#!/usr/bin/env node

/**
 * 新文章辅助脚本
 * 
 * Usage:
 *   node new-post.js "文章标题" "slug-name" "标签1,标签2" "摘要文字"
 * 
 * Example:
 *   node new-post.js "量子计算的经济学前景" "quantum-computing-economics" "量子计算,前沿" "探讨量子计算技术对算力市场的潜在影响"
 * 
 * This script will:
 *   1. Create a new markdown file in posts/
 *   2. Update posts/posts.json
 *   3. Update feed.xml
 *   4. Update sitemap.xml
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node new-post.js "标题" "slug" ["标签1,标签2"] ["摘要"]');
    process.exit(1);
}

const title = args[0];
const slug = args[1];
const tags = args[2] ? args[2].split(',').map(t => t.trim()) : [];
const excerpt = args[3] || '';

const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const pubDate = today.toUTCString();

const postsDir = path.join(__dirname, 'posts');
const postsJsonPath = path.join(postsDir, 'posts.json');
const feedPath = path.join(__dirname, 'feed.xml');
const sitemapPath = path.join(__dirname, 'sitemap.xml');

// 1. Create markdown file
const mdPath = path.join(postsDir, `${slug}.md`);
if (fs.existsSync(mdPath)) {
    console.error(`Error: ${mdPath} already exists!`);
    process.exit(1);
}

const mdContent = `# ${title}\n\n在这里开始撰写你的文章...\n`;
fs.writeFileSync(mdPath, mdContent, 'utf-8');
console.log(`✅ Created ${mdPath}`);

// 2. Update posts.json
let posts = [];
if (fs.existsSync(postsJsonPath)) {
    posts = JSON.parse(fs.readFileSync(postsJsonPath, 'utf-8'));
}

posts.unshift({
    slug,
    title,
    date: dateStr,
    excerpt,
    tags
});

fs.writeFileSync(postsJsonPath, JSON.stringify(posts, null, 4) + '\n', 'utf-8');
console.log(`✅ Updated posts.json (${posts.length} posts)`);

// 3. Update feed.xml
const baseUrl = 'https://fungtion.github.io/webio';
const feedItems = posts.map(p => `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${baseUrl}/?post=${p.slug}</link>
      <guid isPermaLink="true">${baseUrl}/?post=${p.slug}</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <description>${escapeXml(p.excerpt || '')}</description>
      <dc:creator>微观算力经济学</dc:creator>
    </item>`).join('\n');

const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>微观算力经济学</title>
    <link>${baseUrl}</link>
    <description>微观算力经济学</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
${feedItems}
  </channel>
</rss>
`;

fs.writeFileSync(feedPath, feedXml, 'utf-8');
console.log(`✅ Updated feed.xml`);

// 4. Update sitemap.xml
const sitemapUrls = [
    { loc: `${baseUrl}/`, lastmod: dateStr, freq: 'weekly', priority: '1.0' },
    { loc: `${baseUrl}/about.html`, lastmod: dateStr, freq: 'monthly', priority: '0.5' },
    ...posts.map(p => ({
        loc: `${baseUrl}/?post=${p.slug}`,
        lastmod: p.date,
        freq: 'monthly',
        priority: '0.8'
    }))
];

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

fs.writeFileSync(sitemapPath, sitemapXml, 'utf-8');
console.log(`✅ Updated sitemap.xml`);

console.log(`\n🎉 Done! Now edit ${mdPath} and push to GitHub.`);

function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

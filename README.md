# Blog (Astro 重写版)

旧 React SPA 已备份至 `/tmp/blog-react-backup`,本目录已覆盖重写为 Astro SSG,主攻 SEO。

## 为什么 SEO 变好

旧站问题:React CSR,`index.html` 只有一个空 `#root`,爬虫首屏无内容;全站共用一个 `<title>`,无 description/canonical/OG/结构化数据;归档靠 `?tag=`/`?category=` 查询参数,不利于收录;无 sitemap/RSS/robots。

新站:
- SSG 预渲染:首页/分页/归档/文章详情/About 在构建时生成静态 HTML,爬虫直接可见正文
- 每页独立 title/description/canonical + OG/Twitter + JSON-LD(Blog/BlogPosting/Breadcrumb/WebSite+SearchAction)
- tag/category 改为静态路由 `/archive/tag/:tag/`, `/archive/category/:category/`,可被收录
- 自动 sitemap(`/sitemap-index.xml`),`robots.txt`,RSS(`/rss.xml`)
- 语义化 HTML(`article`/`time`/`nav`/`main`),图片 alt + 懒加载,分页 `rel=prev/next`

## 目录

- `src/pages/`: `index`(首页), `page/[page]`, `post/[id]`, `archive`, `archive/tag/[tag]`, `archive/category/[category]`, `about`, `search`, `admin/**`, `rss.xml.js`, `robots.txt.ts`
- `src/layouts/BaseLayout.astro`:全局 SEO head
- `src/components/`: Navbar/Footer/Sidebar/PostCard/ArchiveTimeline + `admin/*`(React islands)
- `src/lib/api.ts`:后端接口封装(与 `blog_back_wasm` 对齐)
- `src/lib/markdown.ts`:构建时 markdown→HTML

## 本地开发

```bash
cp .env.example .env  # 按需改 PUBLIC_SITE_URL / PUBLIC_API_BASE
npm install
npm run dev
```

## 构建

```bash
npm run build   # 输出 dist/
npm run preview
```

构建时需要能访问 `PUBLIC_API_BASE`,否则页面会以空数据降级构建(行政后台不受影响)。

## 后台

- `/admin/`, `/admin/posts/`, `/admin/edit/?id=xxx`,Cloudflare Access SaaS OIDC 登录,noindex,不进 sitemap
- 旧路由映射:`/dashboard`→`/admin/`,`/post-list`→`/admin/posts/`,`/post-edit`(state传参)→`/admin/edit/?id=`
- 登录回调页:`/admin/callback/`(需加到 Access SaaS 应用的 Redirect URLs)

## 环境变量

| 变量 | 说明 |
|---|---|
| `PUBLIC_API_BASE` | 后端 API,如 `https://blog-api.charlie-cloud.me/api` |
| `PUBLIC_SITE_URL` | 站点根地址(canonical/sitemap/RSS 用) |
| `PUBLIC_SITE_NAME` | 站点名 |
| `PUBLIC_CF_ACCESS_TEAM_DOMAIN` | Access 团队域名,如 `https://xxx.cloudflareaccess.com` |
| `PUBLIC_CF_ACCESS_CLIENT_ID` | Access SaaS OIDC 应用的 Client ID |

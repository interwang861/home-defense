# 家园保卫战 · 部署到 Cloudflare Pages

这个项目用了 `vite-plugin-singlefile`，构建后**整个游戏被打包成一个 `dist/index.html`**（约 400 KB，JS 和 CSS 全部内联）。
所以部署非常简单，本质上就是把 `dist` 文件夹传上去。

---

## 关键参数（照抄即可）

| 项目 | 值 |
| --- | --- |
| 框架预设 Framework preset | **None**（不要选 React，选了会自动填错的输出目录） |
| 构建命令 Build command | `npm run build` |
| 构建输出目录 Build output directory | `dist` |
| 根目录 Root directory | `/`（留空） |
| 环境变量 | `NODE_VERSION` = `22` |

> `NODE_VERSION` 必须设置。Vite 7 要求 Node 20.19+ 或 22.12+，Cloudflare 默认的 Node 版本可能偏低，不设会构建失败。

---

## 需要部署的文件只有 3 个

执行 `npm run build` 后，`dist/` 目录里就是全部要上传的东西：

```
dist/
├── index.html      ← 整个游戏（394 KB，JS/CSS/所有 SVG 素材全内联）
├── _headers        ← 缓存策略（可选，但建议留着）
└── _redirects      ← 路由规则（可选）
```

因为用了 `vite-plugin-singlefile`，**游戏被打包成了单个 HTML 文件**。
极端情况下，你只拖 `index.html` 这一个文件上去，游戏就能正常跑，另外两个只是锦上添花。

### 一键打包成 zip

项目里已经放了打包脚本，会自动完成「安装依赖 → 构建 → 压缩」：

```bash
# Mac / Linux
bash pack.sh
```

```powershell
# Windows PowerShell（在项目根目录执行）
powershell -ExecutionPolicy Bypass -File pack.ps1
```

跑完会在项目根目录生成 **`homeland-defense.zip`**，解压出来就是上面那 3 个文件。

### 或者手动压缩

```bash
npm run build
cd dist && zip -r ../homeland-defense.zip . && cd ..
```

Windows 用户也可以直接进 `dist` 文件夹 → 全选 3 个文件 → 右键「压缩为 ZIP」。

> 注意：要压缩的是 **`dist` 里面的内容**，不是 `dist` 文件夹本身。
> 如果压出来的 zip 解压后是 `dist/index.html` 这种带一层目录的结构，Cloudflare 会找不到首页而报 404。

---

## 方式一：连接 GitHub 自动部署（推荐）

以后每次 `git push` 都会自动重新部署，适合长期维护。

1. **把代码推到 GitHub**（项目里已经有 `.gitignore`，`node_modules` 和 `dist` 不会被提交）

   ```bash
   git init
   git add .
   git commit -m "家园保卫战"
   git branch -M main
   git remote add origin https://github.com/你的用户名/仓库名.git
   git push -u origin main
   ```

2. **在 Cloudflare 控制台创建项目**
   - 打开 [dash.cloudflare.com](https://dash.cloudflare.com) → 左侧 **Workers & Pages** → **Create** → **Pages** 标签 → **Connect to Git**
   - 授权 GitHub，选中刚才的仓库

3. **填构建配置**，按上面那张表填：
   - Framework preset：`None`
   - Build command：`npm run build`
   - Build output directory：`dist`

4. **加环境变量**：展开 *Environment variables (advanced)* → 添加
   - 变量名 `NODE_VERSION`，值 `22`

5. 点 **Save and Deploy**，等 1～2 分钟，会给你一个 `https://项目名.pages.dev` 的地址。

---

## 方式二：命令行直接上传（最快）

不用 GitHub，本地构建完直接推上去。项目里已经配好 `wrangler.jsonc`。

```bash
npm install          # 第一次需要
npm run build        # 生成 dist/
npx wrangler login   # 第一次需要，会打开浏览器授权
npx wrangler pages deploy
```

第一次运行 `deploy` 时，如果 Cloudflare 上还没有同名项目，它会问你要不要新建，按提示确认就行。
以后每次更新，只要重复 `npm run build` + `npx wrangler pages deploy` 两条命令。

---

## 方式三：拖拽上传（不想装任何东西）

1. 本地执行 `bash pack.sh`（或 `npm run build`）
2. 打开 **Workers & Pages** → **Create** → **Pages** → **Upload assets**
3. 填一个项目名，然后二选一：
   - 把 `dist` **文件夹**整个拖进去
   - 或者直接拖 `homeland-defense.zip`，Cloudflare 会自动解压

这种方式每次更新都要手动重新传一次。

---

## 几个需要注意的地方

- **存档是按域名存的**。游戏进度存在浏览器的 localStorage 里，`xxx.pages.dev` 和你之后绑定的自定义域名算两个不同的域名，进度不互通，换域名等于重新开始。同理，换浏览器、换设备、清理浏览器数据都会丢进度。

- **`public/_headers` 已经禁止缓存 index.html**。因为游戏整个打包进了这一个文件，如果被 CDN 长期缓存，你更新后玩家会一直看到旧版本。

- **`public/_redirects` 里的 `/* /index.html 200`** 是让任意路径都返回游戏页面。当前游戏是单页、没有路由，其实用不上，但留着以后加路由不会踩坑。

- **以后替换素材图片**时，把图片放进 `public/images/`，然后在 `src/game/sprites.tsx` 的 `SPRITE_IMAGES` 里填路径。`public/` 里的文件不会被内联，会作为独立文件部署，并且已经配好了长期缓存。

- **自定义域名**：项目部署好后，进项目 → **Custom domains** → **Set up a domain**。域名如果已经托管在 Cloudflare，会自动配好 DNS 和 HTTPS。

- **免费额度**对这个游戏完全够用：静态请求不限量、带宽不计费，每月 500 次构建。

---

## 关于 Pages 和 Workers

2026 年 Cloudflare 官方推荐新项目用 **Workers + 静态资源**，Pages 虽然还在正常维护，但新功能主要往 Workers 走。

不过对这个游戏来说**用 Pages 完全没问题**：它是纯前端单页，没有后端接口、没有数据库、没有服务端渲染，Pages 的 git 推送即部署反而更省事。等以后真要加服务端功能（比如云存档、全球排行榜）再迁到 Workers 也不迟，迁移成本很低。

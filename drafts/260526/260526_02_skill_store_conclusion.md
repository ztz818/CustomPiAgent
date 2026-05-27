# pi-web Skill Store 诊断结论

时间：2026-05-26

## 检查对象

用户提到项目：`resources/pi-web`

当前实际运行中的 pi-web 进程：

- `node /usr/local/bin/pi-web -p 18001 -H 127.0.0.1`
- Next 进程 cwd：`/usr/local/lib/node_modules/@agegr/pi-web`

说明：当前端口 18001 上运行的是全局安装的 `@agegr/pi-web`，不是工作区里的 `resources/pi-web` 源码目录。

## 网络连通性

在当前服务器环境中：

- `https://skills.sh/api/search?q=react&limit=3`：HTTP 200
- Node.js `fetch()` 调用同一 API：HTTP 200
- 本地 pi-web API `/api/skills/search`：HTTP 200，并返回搜索结果
- `npx skills find react`：可正常返回结果
- `https://github.com/vercel-labs/agent-skills`：HTTP 200
- `https://registry.npmjs.org/skills`：HTTP 200

## 结论

从服务器侧看，Skill Store 依赖的网络不是不通；skills.sh、npm registry、GitHub 都可访问。

如果浏览器里表现为“商店不通”，更可能是以下原因之一：

1. 点击的是 UI 里的外链 `skills.sh`，这是浏览器直连外网；如果本地/办公网络不能访问外网，会失败。
2. 你以为打开的是 `resources/pi-web`，但实际运行的是全局安装的 `/usr/local/lib/node_modules/@agegr/pi-web`。
3. 前端页面可能缓存了旧状态或打开了不是当前 18001 的服务。

## 关键验证命令

```bash
curl -sS -X POST http://127.0.0.1:18001/api/skills/search \
  -H 'content-type: application/json' \
  --data '{"query":"react","limit":3}'
```

该命令当前返回正常搜索结果。

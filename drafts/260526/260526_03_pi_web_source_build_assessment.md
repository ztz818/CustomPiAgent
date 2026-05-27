# pi-web 源码构建与二次开发评估

## 结论

当前本地 `resources/pi-web` 是 `@agegr/pi-web` 的源码仓库，版本为 `0.6.11`，与 npm latest 一致。

从源码构建复杂度不高。它是标准 Next.js 应用，主要命令是：

```bash
cd resources/pi-web
npm install
npm run dev
npm run build
```

二次开发成本整体不高，尤其是 UI、API route、会话展示、模型配置、skills 搜索/安装等功能。但需要注意它依赖 pi agent 的会话目录、模型配置、AgentSession/RPC 管理逻辑，涉及运行时协议的改动需要更谨慎。

## 依据

- `resources/pi-web/package.json` 声明包名 `@agegr/pi-web`，版本 `0.6.11`
- npm registry 当前 latest 为 `0.6.11`
- `resources/pi-web` git remote 为 `https://github.com/agegr/pi-web.git`
- CLI `bin/pi-web.js` 本质是检查 `.next` 后启动 `next start`
- API 层集中在 `app/api/`，组件集中在 `components/`，结构清晰

## 建议路径

1. 先用源码目录运行 `npm install && npm run dev` 验证开发环境。
2. 小改 UI 或 API route 时直接在源码中改，使用 `npm run dev` 验证。
3. 如果要替代全局安装版本，完成 `npm run build` 后用源码目录启动或使用本地 link。
4. 涉及 agent 协议、session jsonl、skills 安装路径、模型配置写入时，先写最小实验记录和回归检查。

## 风险

- 当前运行进程如果仍来自 `/usr/local/lib/node_modules/@agegr/pi-web`，修改 `resources/pi-web` 不会影响线上运行。
- 发布包包含 `.next` 构建产物，源码运行前需要本地安装依赖并构建或使用 dev server。
- 二开成本主要来自业务协议理解，不是构建链路。

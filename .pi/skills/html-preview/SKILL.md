---
name: html-preview
description: "当 Agent 生成 HTML 报告、网页、图表、仪表盘或需要给用户返回可视化预览链接时使用。通过独立 HTML Preview Service 上传 HTML 项目；不依赖具体 WebUI。"
---

目标：
- 将 Agent 生成的 HTML 及其静态资源上传到独立 HTML Preview Service。
- 返回可被任意 WebUI、聊天前端或用户浏览器打开的 preview URL。

输入：
- `index.html` 或任意 `.html/.htm` 文件。
- 可选同目录静态资源：CSS、JS、图片、字体、JSON 等。
- 服务地址：环境变量 `HTML_PREVIEW_SERVICE_URL`，例如 `http://127.0.0.1:18080`。

输出：
- `projectId`
- `render_url` / `preview_url`
- 上传文件列表
- 失败时返回本地 HTML artifact 路径作为降级结果。

工作流：
1. 确认 HTML 及资源已落盘在项目内，例如 `drafts/YYMMDD/` 或正式产物目录。
2. 读取 `HTML_PREVIEW_SERVICE_URL`；未配置时不要猜测 WebUI 地址，直接降级返回本地路径。
3. 将 HTML 项目转换为请求体：

```json
{
  "title": "optional title",
  "files": [
    { "path": "index.html", "content": "<html>...</html>" },
    { "path": "style.css", "content": "..." }
  ]
}
```

4. 调用：

```bash
curl -sS -X POST "$HTML_PREVIEW_SERVICE_URL/previews" \
  -H 'Content-Type: application/json' \
  --data @payload.json
```

5. 将响应中的 `render_url` 返回给用户；如果是相对路径，需要拼接 `HTML_PREVIEW_SERVICE_URL`。

硬约束：
- HTML Preview Service 是独立服务，不把渲染逻辑耦合到 WebUI。
- Agent 不传本地任意路径给服务，只上传文件内容。
- 所有 payload、中间文件、日志必须放在项目内 `drafts/YYMMDD/` 或 `logs/`。
- 服务不可用时不能阻断主任务，应降级为本地 artifact 路径。

服务部署：
- 服务源码位于 `/workspace/nas-data/huya_projects/OpenAgents/AgentScaffolds/services/html_preview_service/`。
- 启动脚本：`/workspace/nas-data/huya_projects/OpenAgents/AgentScaffolds/scripts/html_preview_service/start.sh`。

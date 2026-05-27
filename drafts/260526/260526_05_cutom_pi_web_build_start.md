# cutom_pi_web 本地构建启动记录

## 操作

在 `cutom_pi_web/` 内执行：

```bash
npm install
npm run build
```

随后停止原全局 pi-web 监听进程，并启动本地构建版：

```bash
node bin/pi-web.js -p 18001 -H 127.0.0.1
```

后台运行日志：

```text
logs/cutom_pi_web_18001.log
```

## 校验

- 监听地址：`127.0.0.1:18001`
- 当前监听进程：`cutom_pi_web` 下的 `node bin/pi-web.js`
- HTTP 检查：`http://127.0.0.1:18001` 返回 `200 OK`

## 注意

`npm install` 报告了 6 个依赖审计问题，来自依赖树审计结果；本次未执行 `npm audit fix`，避免自动升级影响二次开发基线。

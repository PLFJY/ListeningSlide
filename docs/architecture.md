# 架构

ListeningSlide 只使用固定版本的官方 ONLYOFFICE 引擎。应用没有 HTML 幻灯片渲染器、自制动画调度器或引擎切换入口。

- `electron/main.ts` 与 `preload.ts`：文件打开、便携设置、原生全屏与受限转换 IPC。
- `electron/onlyoffice.ts`、`conversionQueue.ts`：调用官方 x2t 转换为 PPTY，验证输出与归档路径，相同内容合并在途请求，不同课件顺序转换。
- `src/importer/pptx.ts`、`xml.ts`：校验 PPTX、读取页顺序与尺寸、提取音频和裁剪；不参与绘制或动画解析。
- `src/slideshow/OnlyOfficeEngine.ts`：管理隔离 iframe、加载/放映生命周期、动画操作与状态订阅。
- `engine/onlyoffice/bridge.js`：初始化固定 SDKJS，复用其布局、Canvas 与动画调度；保存原始对象 ID，兼容官方转换器的媒体裁剪字段，映射媒体命中区域。
- `src/components/Stage.tsx`：按钮、键盘、水平手势与滚轮统一控制动画，剩余步骤结束后再翻页；音频及菜单交互隔离。
- `src/core/audioObjects.ts`：对官方引擎提供的多边形做音频命中判断。
- `src/core/useAudio.ts`、`audio.ts`：每个播放器独立的 Audio 元素、裁剪、倍速、A–B 循环和资源释放。
- `AudioPlayerInstance.tsx`、`FloatingPlayer.tsx`、`playerLayout.ts`：播放器布局、拖动缩放、折叠、多实例与跨页固定。
- `SlideOverview.tsx`：使用 SDKJS 生成总览缩略图；放映保持动态 Canvas。
- `About.tsx`、`src/author.ts`：主页右下角作者信息入口、留空的作者文案、ONLYOFFICE 版权说明和完整许可。

官方上游源码、原生运行时和生成的浏览器引擎不混入应用源码，由 `onlyoffice:prepare` 按 `upstream.lock.json` 准备；来源和许可证见 [onlyoffice-source.md](onlyoffice-source.md)。

`@fefeding/ppt-parser` 仅通过 `pnpm run demo:generate` 生成应用附带的演示课件，不参与运行时导入、绘制或动画。`scripts/create-icon.mjs` 生成应用图标。界面交互由人工验证，不保留浏览器或 Electron 窗口自动测试；核心逻辑通过无窗口单元测试验证。

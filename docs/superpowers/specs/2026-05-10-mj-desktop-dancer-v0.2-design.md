# MJ Desktop Dancer v0.2 设计规格（Design Spec）

## 背景

v0.1 已实现透明置顶窗口、GIF 播放、拖动、麦克风采集、低频能量节拍检测、节拍视觉反馈、退出机制。

v0.2 目标是在保持纯 JS + Web Audio API 的前提下，补齐“可用性与可配置性”：托盘/菜单栏入口、设置面板、配置持久化、多形象切换，并为后续 BPM/动作分档留好接口。

## 目标（In Scope）

- 引入 `electron-store` 持久化配置：窗口位置/大小、当前形象、节拍检测关键参数
- 系统托盘/菜单栏图标 + 完整右键菜单：退出/穿透/重置位置/打开设置/切换形象
- 设置面板独立窗口（BrowserWindow）：以“分组区块”方式可视化调参
- 扫描 `assets/` 下多个 GIF 资源并支持切换
- macOS（Apple Silicon）适配：隐藏 Dock，仅通过菜单栏与右键菜单操作

## 非目标（Out of Scope）

- BPM 估算与基于 BPM 的动画切换（作为 v0.2+ / P1）
- 3D 模型（Three.js / MMD）与歌曲识别
- 打包发布（electron-builder）
- 系统音频直采（loopback）在应用内的自动化引导（仍由 README 指导用户设置）

## 约束与原则

- 继续保持纯 JS（不引入 TS/React）
- 不引入第三方音频分析库（不使用 Tone.js / librosa）
- 配置读写集中在主进程；渲染进程通过 IPC 读写，避免在渲染层直接写磁盘
- 模块边界清晰：主进程负责窗口/托盘/配置与 IPC；渲染进程只负责 UI 与算法

## 代码结构（v0.2 目标）

```
mj-desktop/
  package.json
  src/
    main/
      main.js
      store.js
      ipc.js
      tray.js
      windows/
        mainWindow.js
        settingsWindow.js
    renderer/
      main/
        index.html
        renderer.js
        styles.css
      settings/
        settings.html
        settings.js
        settings.css
      beatDetector.js
  assets/
    mj-*.gif
    trayTemplate.png (或你提供的实际文件)
    placeholder.svg
```

说明：
- v0.1 的 `index.html/styles.css/renderer.js` 拆到 `src/renderer/main/`
- 入口从根目录 `main.js` 迁移到 `src/main/main.js`

## 配置设计（electron-store）

### 存储键（Store Schema）

- `windowBounds`
  - `{ x: number, y: number, width: number, height: number }`
  - 用于主窗口位置与尺寸（v0.1 固定尺寸，v0.2 可保留固定或允许有限缩放；实现时决定）
- `mouseThrough`
  - `boolean`
- `selectedAvatar`
  - `string`（GIF 文件名，例如 `mj-dance.gif` / `mj-fast.gif`）
- `beatConfig`
  - 与渲染层 `CONFIG` 对齐的结构：
    - `fftSize: number`
    - `bassRange: [number, number]`
    - `historySize: number`
    - `beatThreshold: number`
    - `minEnergy: number`
    - `beatCooldownMs: number`

### 默认值（Defaults）

- 若 store 中无值，则写入 v0.1 当前默认值
- `windowBounds` 默认值来自首次创建窗口时的 `BrowserWindow` 参数

## IPC 设计（主进程作为配置中心：方案 B）

### 通用约定

- 渲染层通过 `preload` 暴露 `mjAPI`，不启用 `nodeIntegration`
- 主进程对 IPC 输入做最小校验（类型/范围），避免写入非法配置导致崩溃

### 通道定义

- `config:get`
  - 入参：`{ keys?: string[] }`（为空表示取全部）
  - 出参：`{ windowBounds, mouseThrough, selectedAvatar, beatConfig }` 或子集
- `config:set`
  - 入参：`{ patch: Partial<Config> }`
  - 行为：合并写入 store，随后广播 `config:changed`
- `config:changed`（事件广播）
  - 出参：`{ patch: Partial<Config>, full?: Config }`
  - 订阅方：主窗口与设置窗口
- `avatar:list`
  - 出参：`{ avatars: Array<{ fileName: string, displayName: string }> }`
  - 规则：扫描 `assets/` 下 `*.gif`（可扩展 `*.png`/序列帧目录）
- `window:resetPosition`
  - 行为：把主窗口移动回默认位置（如屏幕右下/居中），并写入 store
- `app:quit`
  - 行为：退出应用

## 托盘/菜单栏（Tray）

### 图标资源

由你提供跨平台图标文件（建议提供 PNG 多尺寸；Windows 未来可补 ICO）。

### 菜单结构（建议）

- “MJ Desktop Dancer”（disabled）
- 分隔线
- “打开设置”
- “形象”
  - radio 子菜单：扫描到的 GIF 列表（选中项为 `selectedAvatar`）
- 分隔线
- “鼠标穿透”（checkbox）
- “重置位置”
- 分隔线
- “退出”

说明：
- 托盘菜单是主要入口；主窗口右键菜单与托盘菜单保持一致（同一份模板构建）

## 设置面板（Settings Window）

### 窗口形态

- 独立 `BrowserWindow`（可置顶或普通窗口；默认普通窗口）
- 单例：已打开则 focus

### 布局方案

采用你选择的 “分组区块（B）”：

- 音频
  - `fftSize`（下拉：512/1024/2048）
  - `bassRange`（双滑杆或两个数字输入：lo/hi）
- 节拍
  - `beatThreshold`
  - `minEnergy`
  - `beatCooldownMs`
  - `historySize`（可放在高级）
- 外观
  - 窗口大小（如 scale 或 preset：小/中/大）
  - 透明度（可选）
- 高级
  - `smoothingTimeConstant`（如决定暴露）
  - “恢复默认”

交互：
- 默认“实时生效”：每次控件变化都调用 `config:set`
- “恢复默认”写入默认 `beatConfig` 并广播

## 主窗口资源切换（Avatar Switching）

- 主窗口 `img#mj` 的资源路径由 `selectedAvatar` 决定
- 切换时为避免缓存：可附加查询串 `?t=timestamp` 或先清空 src 再赋值
- 未找到资源时回落到 `assets/placeholder.svg`

## macOS（Apple Silicon）适配要点

- 启动后隐藏 Dock：`app.dock.hide()`（仅 macOS）
- 托盘图标表现：macOS 使用菜单栏图标；图标建议提供模板图（单色/透明背景）或按实现做 `setTemplateImage(true)`
- Apple Silicon：Electron 28+ 原生支持；开发/打包阶段需确保依赖安装在 arm64 环境

## 验收标准（v0.2）

- `npm start` 启动无报错，主窗口正常显示、可拖动、可右键退出
- 托盘/菜单栏图标出现，菜单可操作：退出/穿透/重置位置/打开设置/切换形象
- 设置窗口可打开并调参，调参后节拍反应发生变化且不会卡死
- 重启应用后：窗口位置、鼠标穿透状态、当前形象、节拍参数均能恢复


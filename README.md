# COSMOS DRIFT

从地球出发的开源 Three.js 太空探索游戏：1315个真实目录天体、连续航速、曲速与虫洞、自动黑洞穿越、10首原创太空配乐。

A browser-based space exploration game with real catalogue objects, precision flight controls, fictional intergalactic travel and an original ambient soundtrack.

![COSMOS DRIFT gameplay](docs/preview.png)

## 运行

需要 Node.js 22.12+、npm，以及支持 WebGL2 的现代桌面浏览器。

```sh
git clone https://github.com/lenteyyy/cosmos-drift.git
cd cosmos-drift
npm ci
npm start
```

打开 http://127.0.0.1:5173/ 。服务仅监听本机，独立于启动终端运行。同一端口重复启动会复用已有服务；重启电脑后需要再次启动。macOS也可双击 `start.command` / `stop.command`。

```sh
npm run server:status
npm restart
npm stop
npm run dev       # 前台开发服务
npm run build     # 生成 dist，可部署到网站根路径
npm run preview   # 预览构建结果
```

自定义端口使用 `npm start -- --port 5174`，对应状态和停止命令同样加 `-- --port 5174`。日志位于 `.runtime/server-端口.log`；日常游玩复用一个端口即可。

## 飞行

鼠标双击天体选择目的地，右键拖动转向；也可使用方向键转向、Enter选择准星天体、Tab切换附近目标。

W/S调油门，滚轮或+/-连续调速，Alt精调，Shift加速，Space刹车。速度从1厘米/秒到5亿光年/秒，组合横移与加速也受上限约束；粒子与引擎音色随实际航速变化。

J曲速跃迁，O虫洞，F自动驾驶，G对准目标。B选择附近黑洞，靠近或按J抵达边缘后自动捕获，随机到达其他星系或结构；捕获后无法中止、暂停或打开菜单。普通曲速和虫洞可以用Space中止。

M开关星图，I开关资料，保留视角锁定且隐藏光标；Esc关闭。星图中↑↓浏览，/搜索，Enter确认，J出发，+/-缩放，PgUp/PgDn切尺度。A/D横移，Q/E滚转，V切视角，P暂停；更多说明在游戏手册中。

## 内容与声音

目录共1315项：355颗恒星、280颗已确认系外行星、520座星系、107个星系群与结构、30个黑洞系统，以及8颗行星、5颗矮行星、9颗卫星和观测视界。每个独立可见的永久星点都对应可选目录对象。坐标使用扇区与误差补偿，保留深空低速位移。

恒星拥有高亮核心、颗粒表面、光晕与距离亮度衰减。飞行粒子、隧道和宇宙尘埃为程序视觉效果。超光速、虫洞及可穿越黑洞属于科幻玩法；太阳系相位、天体尺寸与结构边界为示意，并非星历或相对论光线追踪。

星云和流动噪声采用 [Paper Shaders](https://shaders.paper.design/) 的 Perlin Noise，曲速、虫洞与黑洞背景采用 Warp。GLSL通过现有Three.js渲染器运行，复用一个WebGL上下文和一个低分辨率背景纹理。

公开版带10首原创氛围配乐，共16分钟，按场景切换并循环播放。音乐、音效和英文导航语音分别调音量，播报时音乐自动降低。浏览器需要用户首次按键或点击才能开始声音；英文语音取决于本机可用的英语声库。

三首私人MP3与macOS系统语音录音不随仓库分发。本地已有这些素材时，启动或构建会自动识别；缺少它们不会影响公开版。添加或移除可选素材后需重启开发服务。不要将这些素材提交或随构建公开分发。

## 帧率与省电

前台场景以60 FPS为目标，采用单一RAF节拍，不使用限帧计时器，也不因静止或低画质而降帧。负载升高时自动降低渲染分辨率，持续恢复余量后再缓慢提高；显示器刷新率、设备与浏览器仍决定实际表现。

设置中的“低画质 · 流畅优先”减少粒子、像素密度、噪声层数及旋涡迭代。标准/低画质的背景纹理上限为129600/32400像素，Paper着色器更新上限为20/12次每秒，独立于60 FPS的主场景。不会为每一帧重复计算完整背景，也不会创建第二个WebGL上下文。

“暂停背景动画”冻结星云、粒子及装饰运动，驾驶和跃迁仍可用；静止时停止连续重绘。游戏暂停、打开面板时也停止连续场景渲染，必要交互仍可触发单帧更新。两个选项均保存在本机。

隐藏或失焦窗口停止渲染与遥测轮询，音频和音乐切换计时一并暂停。支持BroadcastChannel的浏览器中，同源重复游戏标签仅保留当前窗口活动；点击或按键恢复其他窗口。不同端口属于不同源，不能互相协调，因此避免多开端口。黑洞捕获不会被待机取消，返回窗口后继续穿越。省电效果未做电池耗电量测量。

## 开发与验证

```sh
npm run check          # 类型、44项回归、目录校验、生产构建
npm run release:check  # 已跟踪文件中的私有素材、凭据与个人路径扫描
npm audit
npm run data:build     # 用随仓库提供的快照离线重建目录
npm run data:validate
npm run data:refresh   # 主动刷新上游数据，需要网络
```

`scripts/build-audio.py`可从原创音符和合成算法重建配乐，需要Python 3和numpy。默认保留现有WAV，添加`--force`可全部重建。正常运行、构建和CI不需要Python，也不依赖远程天文API。

GitHub Actions在推送及PR时运行检查与离线重建。审查范围、修复和验证记录见[代码审查记录](docs/AUDIT.md)，贡献要求见[CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可

原始代码、文档、程序视觉素材和10首原创配乐采用[MIT](LICENSE)。派生天文目录与HYG/OpenNGC快照遵循[CC BY-SA 4.0](LICENSES/CC-BY-SA-4.0.txt)，完整来源与哈希位于[来源清单](public/data/sources.json)。Lenteyyy标志保留品牌权利。

Paper Shaders采用Apache-2.0；许可、NASA地球纹理、天文资料署名及不分发的可选音频说明见[第三方声明](THIRD_PARTY_NOTICES.md)。

# PinkHunkDB - 现代化轻量级数据库客户端
  
[Go Version](https://go.dev/)
[Wails Version](https://wails.io)
[React Version](https://reactjs.org/)
[License](LICENSE)
[Build Status](https://github.com/FaaTang/PinkHunkDB/actions)
[Stars](https://github.com/FaaTang/PinkHunkDB/stargazers)
[Downloads](https://github.com/FaaTang/PinkHunkDB/releases)

**语言**: [English](README.md) | 简体中文

> **Fork 说明**
>
> 本仓库（[FaaTang/PinkHunkDB](https://github.com/FaaTang/PinkHunkDB)
> ）是基于上游项目 [Syngnat/GoNavi](https://github.com/Syngnat/GoNavi) 的 **个人 fork**，用于**定制化开发**与个人使用。
>
> - 上游项目的版权与商标归 [Syngnat/GoNavi](https://github.com/Syngnat/GoNavi) 原作者所有；本 fork
>   在 [Apache-2.0](LICENSE) 许可下基于上游代码修改与分发。
>   > - 本仓库的 Release、Issue 与定制改动**由 fork 维护者独立维护**，**与上游项目无关联**。
>   > - **不提供永久维护承诺**：更新节奏、缺陷修复与功能支持视个人时间与需求而定，不保证长期跟进上游或持续修复所有问题。
>   > - 如需官方上游版本、稳定发布或参与上游贡献，请访问 [Syngnat/GoNavi](https://github.com/Syngnat/GoNavi)。

PinkHunkDB 是基于 **Wails (Go)** 与 **React** 构建的跨平台数据库管理工具，强调原生性能、低资源占用与多数据源统一工作流。

相比常见 Electron 客户端，PinkHunkDB 在体积、启动速度和内存占用上更轻量。

---



## 项目简介

PinkHunkDB 面向开发者与 DBA，核心目标是让数据库操作在桌面端做到“快、稳、统一”。

- **原生性能架构**：Wails（Go + WebView），降低运行时开销。
- **大数据可用性**：虚拟滚动 + DataGrid 交互优化，提升大结果集可操作性。
- **统一连接能力**：支持 URI 生成/解析、SSH 隧道、代理、驱动按需安装。
- **工程化能力完整**：覆盖 SQL 编辑、对象管理、批量导出/备份、数据同步、执行日志、在线更新。



## 支持的数据源

> `内置`：主程序开箱即用。  
> `可选驱动代理`：需在驱动管理中安装启用后可用。


| 类别    | 数据源               | 驱动模式   | 典型能力                                       |
| ----- | ----------------- | ------ | ------------------------------------------ |
| 关系型   | MySQL             | 内置     | 库表浏览、SQL 查询、数据编辑、导出/备份                     |
| 关系型   | PostgreSQL        | 内置     | 库表浏览、SQL 查询、数据编辑、对象管理                      |
| 关系型   | Oracle            | 内置     | 连接查询、对象浏览、数据编辑                             |
| 缓存    | Redis             | 内置     | Key 浏览、命令执行、编码/视图切换                        |
| 关系型   | MariaDB           | 可选驱动代理 | 连接查询、对象管理、数据编辑                             |
| 关系型   | Doris             | 可选驱动代理 | 连接查询、对象浏览、SQL 执行                           |
| 列式分析  | StarRocks         | 可选驱动代理 | 连接查询、对象浏览、SQL 执行                           |
| 搜索    | Sphinx            | 可选驱动代理 | SphinxQL 查询与对象浏览                           |
| 关系型   | SQL Server        | 可选驱动代理 | 库表浏览、SQL 查询、对象管理                           |
| 文件型   | SQLite            | 可选驱动代理 | 本地文件库浏览、编辑、导出                              |
| 文件型   | DuckDB            | 可选驱动代理 | 大表查询、分页浏览、文件库管理                            |
| 国产数据库 | Dameng            | 可选驱动代理 | 连接查询、对象浏览、数据编辑                             |
| 国产数据库 | Kingbase          | 可选驱动代理 | 连接查询、对象浏览、数据编辑                             |
| 国产数据库 | HighGo            | 可选驱动代理 | 连接查询、对象浏览、数据编辑                             |
| 国产数据库 | Vastbase          | 可选驱动代理 | 连接查询、对象浏览、数据编辑                             |
| 文档型   | MongoDB           | 可选驱动代理 | 文档查询、集合浏览、连接管理                             |
| 时序    | TDengine          | 可选驱动代理 | 时序库表浏览、查询分析                                |
| 列式分析  | ClickHouse        | 可选驱动代理 | 分析查询、对象浏览、SQL 执行                           |
| 联邦查询  | Trino             | 可选驱动代理 | 跨多数据源联邦 SQL、`catalog.schema` 浏览、SQL 执行     |
| 搜索    | Elasticsearch     | 可选驱动代理 | 索引浏览、Mapping 检查、JSON DSL / query_string 查询 |
| 扩展接入  | Custom Driver/DSN | 自定义    | 通过 Driver + DSN 接入更多数据源                    |


## 📸 项目截图

  


---

 

## 核心特性



### AI 智能助手 (New)

- **多模型服务商支持**：内置跨平台接入 OpenAI, Google Gemini, Anthropic Claude，同时支持任意自定义兼容 OpenAI 格式的 API。
- **关联表结构上下文**：原生支持将当前数据库表结构直接提取作为上下文发送给 AI，让 SQL 生成、分析变得更精准。
- **快捷指令**：内置多种快捷对话指（如一键生成 SQL、解释执行逻辑、分析性能优化、表字段代码评审等）。



### 性能与交互

- 大数据场景下保持流畅交互（含 DataGrid 列宽拖拽、批量编辑流程优化）。
- 虚拟滚动渲染，降低大结果集卡顿风险。



### 数据管理（DataGrid）

- 单元格所见即所得编辑。
- 批量新增/修改/删除，支持事务提交与回滚。
- 大字段弹窗编辑。
- 右键上下文操作（NULL、复制、导出等）。
- 根据查询上下文智能切换读写模式。
- 支持 CSV / XLSX / JSON / Markdown 导出。



### SQL 编辑器

- 基于 Monaco Editor。
- 上下文补全（数据库/表/字段）。
- 多标签查询工作流。



### 连接与驱动

- URI 生成与解析。
- SSH 隧道、代理支持。
- 连接配置 JSON 导入/导出。
- 可选驱动安装与启用管理。



### Redis 工具

- 自动/原始文本/UTF-8/十六进制等视图模式。
- 内置命令执行面板。



### 可观测性与更新

- SQL 执行日志（含耗时）。
- 启动/定时/手动更新检查。



### UI 体验

- Ant Design 5 体系。
- 深色/浅色主题切换。
- 灵活布局与侧边栏行为。

---



## 技术栈

- **后端**: Go 1.24 + Wails v2
- **前端**: React 18 + TypeScript + Vite
- **UI 框架**: Ant Design 5
- **状态管理**: Zustand
- **编辑器**: Monaco Editor

---



## 安装与运行



### 前置要求

- [Go](https://go.dev/dl/) 1.21+
- [Node.js](https://nodejs.org/) 18+
- [Wails CLI](https://wails.io/docs/gettingstarted/installation):
`go install github.com/wailsapp/wails/v2/cmd/wails@v2.11.0`



### 开发模式

```shell
# 克隆本 fork
git clone https://github.com/FaaTang/PinkHunkDB.git
cd PinkHunkDB

# 启动开发（热重载）
wails dev
# 日常开发后端逻辑，前端结构稳定：可以放心使用完整的 wails dev -m -skipembedcreate -skipbindings，以获得最快的编译速度。
#当你修改了前端目录结构：应去掉 -skipembedcreate，进行一次完整编译以确保资源正确嵌入。
# 当你修改了 Go 方法或数据结构：应去掉 -skipbindings，让绑定代码更新。
# 当你引入了新的 Go 依赖：应去掉 -m，让 go mod tidy 更新依赖。
wails dev -m -skipembedcreate -skipbindings

# 本地快速启动：未修改 Go 导出方法签名时使用
node tools/wails-fast-dev.mjs

# 修改 Go 导出方法签名后刷新 Wails JS 绑定
node tools/wails-fast-dev.mjs --refresh-bindings

# Windows PowerShell 低内存视觉模式：关闭透明 WebView 和 Acrylic 背景
$env:GONAVI_LOW_MEMORY_MODE="1"; node tools/wails-fast-dev.mjs
```



### 编译构建

```bash
# 构建当前平台
wails build

# 清理后构建（发布前推荐）
wails build -clean
```

构建产物位于 `build/bin`。

### 跨平台发布（GitHub Actions）

本 fork 使用独立的发布流水线。
仅在配置分支（默认 `own`）上的提交推送 `v*` Tag 时才会触发构建与 Release；同步上游不会自动发布。
Dev 预发布流水线仅支持手动触发。

**仓库变量**（`RELEASE_BRANCH`、`BUILD_DRIVER_AGENTS` 等）说明见 
[](.github/FORK_CI_VARIABLES.md)`.github/FORK_CI_VARIABLES.md`。

```bash
git checkout own
git tag v0.6.5
git push origin own --tags
```

Release 更新说明会基于已合并 Pull Request 自动生成，并按 `.github/release.yaml` 分类。

支持目标：

- macOS (AMD64 / ARM64)
- Windows (AMD64)
- Linux (AMD64，含 WebKitGTK 4.0 / 4.1 变体)

---



## 常见问题



### macOS 提示“应用已损坏，无法打开”

在未进行 Apple Notarization 时，Gatekeeper 可能拦截应用。

```bash
sudo xattr -rd com.apple.quarantine /Applications/PinkHunkDB.app
```



### Linux 缺少 `libwebkit2gtk` / `libjavascriptcoregtk`

```bash
# Debian 13 / Ubuntu 24.04+
sudo apt-get update
sudo apt-get install -y libgtk-3-0 libwebkit2gtk-4.1-0 libjavascriptcoregtk-4.1-0

# Ubuntu 22.04 / Debian 12
sudo apt-get update
sudo apt-get install -y libgtk-3-0 libwebkit2gtk-4.0-37 libjavascriptcoregtk-4.0-18
```



### Linux 中文显示为方框

Ubuntu 24.04 LTS 的最小化桌面或服务器环境可能没有安装中文 CJK 字体，PinkHunkDB 打开后中文会显示为方框。安装 Noto / 文泉驿字体后重启
PinkHunkDB：

```bash
sudo apt-get update
sudo apt-get install -y fonts-noto-cjk fonts-wqy-microhei
fc-cache -fv
```

---



## 贡献指南

本仓库为个人 fork，欢迎提交 Issue 与 Pull Request，但**不承诺固定的 review 节奏或长期维护**。

如需参与上游项目贡献，请前往 [Syngnat/GoNavi](https://github.com/Syngnat/GoNavi) 及其贡献说明。

本 fork 本地说明（可能与上游不同）：

- [CONTRIBUTING.zh-CN.md](CONTRIBUTING.zh-CN.md)



## Star History (Star 增长趋势)



上游项目：[Syngnat/GoNavi](https://github.com/Syngnat/GoNavi)

## 友情链接

- [linux.do](https://linux.do/)
- [AI全书](https://aibook.ren/)



## 开源协议

本 fork 基于 [Syngnat/GoNavi](https://github.com/Syngnat/GoNavi)，在 [Apache-2.0](LICENSE) 协议下分发。

- 源代码中的上游版权声明仍归原作者所有。
- 本 fork 的定制改动按「现状」提供，不作任何担保，**不提供永久维护承诺**。


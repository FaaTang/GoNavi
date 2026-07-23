# Fork CI / Release 仓库变量说明

本文档说明 [FaaTang/PinkHunkDB](https://github.com/FaaTang/PinkHunkDB) fork 在 GitHub Actions 中使用的**仓库变量（Repository Variables）**。

配置入口：

**GitHub 仓库 → Settings → Secrets and variables → Actions → Variables → New repository variable**

---

## 变量一览

| 变量名 | 默认值 | 适用工作流 | 说明 |
|--------|--------|------------|------|
| `RELEASE_BRANCH` | `own` | `Release` | 只有指向该分支上提交的 `v*` tag 才会触发正式打包发布；同步上游 tag 不会误发 |
| `BUILD_DRIVER_AGENTS` | `false` | `Release`、`Dev Build` | 设为 `true` 时，除三端应用外还会检测变更、编译驱动代理并打入 `PinkHunkDB-DriverAgents.zip` |
| `DRIVER_RELEASE_REPO` | 当前仓库（如 `FaaTang/PinkHunkDB`） | `Release`、`Dev Build` | CI 从哪个仓库的 Release 读取历史驱动资产以做增量补齐 |

> **注意**：变量值为字符串。布尔类请填 `true` / `false`（小写），不要加引号。

---

## `RELEASE_BRANCH`

### 作用

`Release` 工作流在 push `v*` tag 时会先执行 **gate** 检查：tag 所指向的 commit 必须位于 `origin/<RELEASE_BRANCH>` 上，否则跳过整个发布。

### 典型场景

| 操作 | 是否触发 Release |
|------|------------------|
| 在 `own` 分支提交后 `git push origin own --tags` | 是（默认） |
| GitHub「Sync fork」同步上游到 `dev` | 否 |
| 拉取并 push 上游的 `v*` tag（commit 不在 `own` 上） | 否 |

### 示例

若希望发布分支改为 `main`：

```
RELEASE_BRANCH = main
```

---

## `BUILD_DRIVER_AGENTS`

### 作用

- **`false`（默认）**：只构建并发布三端应用（macOS / Windows / Linux 及 WebKit 变体），不编译驱动代理，Release 中不会出现 `PinkHunkDB-DriverAgents.zip` 与各 `*-driver-agent` 文件。
- **`true`**：在应用构建之外，按相对上一版的变更检测驱动代理，构建有变动的驱动并打包进当前 Release。

`Dev Build` 工作流为手动触发；该变量同样控制是否构建驱动（默认同样不构建）。

### 示例

需要首次全量或定期发布驱动包时：

```
BUILD_DRIVER_AGENTS = true
```

发布完成后若日常只想发应用，可改回 `false` 或删除该变量。

---

## `DRIVER_RELEASE_REPO`

### 作用

Release / Dev Build 在 `BUILD_DRIVER_AGENTS=true` 时，会通过 `tools/resolve-driver-release-source.py`、`complete-driver-release-assets.py` 等脚本，从指定仓库的 Release 读取上一版驱动清单与资产，用于**增量补齐**（未改动的驱动可从上一版 Release 复用）。

### 默认值

未设置时使用 **`github.repository`**，即当前 fork 仓库（`FaaTang/PinkHunkDB`）。

### 示例

驱动与应用仍发布在同一仓库（推荐，与当前代码一致）：

```
# 可不设置，或显式指定：
DRIVER_RELEASE_REPO = FaaTang/PinkHunkDB
```

---

## 与应用内更新地址的关系

以下逻辑在**应用代码**中配置（非 GitHub Variables），构建进二进制后生效：

| 功能 | 仓库 | 代码位置 |
|------|------|----------|
| 应用检查更新、下载安装包 | `FaaTang/PinkHunkDB` | `internal/app/methods_update.go` |
| 驱动管理器在线下载驱动 / 驱动包 | `FaaTang/PinkHunkDB`（与上同） | `internal/app/methods_driver.go` |

上游原项目驱动曾使用独立仓库 `Syngnat/GoNavi-DriverAgents`；本 fork 已改为从 **`FaaTang/PinkHunkDB` 的 Release** 拉取驱动资产。

若修改了 `DRIVER_RELEASE_REPO` 仅影响 **CI 补齐逻辑**；要让客户端也从其他仓库下载，需同步改 Go 源码中的 `updateRepo` / `driverReleaseRepo`。

---

## 工作流触发摘要

| 工作流 | 触发方式 | 默认行为 |
|--------|----------|----------|
| **Release** | push `v*` tag，且 tag 在 `RELEASE_BRANCH` 上 | 仅三端应用 |
| **Dev Build** | Actions 页手动 **Run workflow** | 仅三端应用（pre-release 标签 `dev-latest`） |
| **Docker Images** | 手动 **Run workflow**；或 push `v*` tag 且 tag 在 `RELEASE_BRANCH` 上 | 不响应 `dev` 分支 push |

---

## 同步上游 `dev` 后恢复 Fork CI 配置

GitHub「Sync fork」会把上游的 `.github/workflows/` 覆盖到 fork 的 `dev` 分支。上游默认在 `dev` push 时触发 **Dev Build** 与 **Docker Images**，因此同步后可能再次误触发 Actions。

Fork 的 CI 修复保存在 **`own` 分支**（或你维护 fork 配置的分支）。每次同步上游 `dev` 后，请把 fork 工作流合并回 `dev` 并推送：

```bash
git fetch origin
git checkout dev
git pull origin dev
git checkout origin/own -- .github/workflows/dev-build.yml .github/workflows/docker-images.yml .github/workflows/release.yml .github/FORK_CI_VARIABLES.md
git commit -m "chore(ci): restore fork workflow triggers after upstream sync"
git push origin dev
```

> 若你直接在 `own` 上维护工作流，把上面命令里的 `origin/own` 换成对应分支名即可。

---

## 推荐发布流程

### 仅发布三端应用（默认）

确保未设置 `BUILD_DRIVER_AGENTS`，或其为 `false`：

```bash
git checkout own
git tag v0.6.6
git push origin own --tags
```

### 同时发布应用与驱动

1. 在 Variables 中设置 `BUILD_DRIVER_AGENTS = true`
2. 执行上述 tag 推送
3. 首次或驱动大改时构建时间会明显变长

---

## 故障排查

| 现象 | 可能原因 |
|------|----------|
| push tag 后 Release 工作流瞬间结束、无产物 | tag 指向的 commit 不在 `RELEASE_BRANCH` 分支历史上 |
| Release 里没有驱动 zip | `BUILD_DRIVER_AGENTS` 为 `false` 或未设置 |
| 驱动增量补齐失败 | 上一版 Release 缺少驱动资产；可设 `BUILD_DRIVER_AGENTS=true` 做一次全量驱动构建 |
| 客户端仍从旧地址下驱动 | 使用的是旧版本安装包；需用新构建版本，且 Release 中已包含对应驱动文件 |

---

## 相关文件

- `.github/workflows/release.yml` — 正式 Release
- `.github/workflows/dev-build.yml` — 手动 Dev 预发布
- `.github/workflows/docker-images.yml` — Docker 镜像（手动或 Release tag）
- `tools/resolve-driver-release-source.py`
- `tools/complete-driver-release-assets.py`
- `internal/app/methods_update.go`
- `internal/app/methods_driver.go`

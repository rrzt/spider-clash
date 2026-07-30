# Spider Clash 🕸️

一个轻量级的 Node.js 爬虫，用于抓取、验证和生成 Clash/V2Ray 订阅链接。

## 特性

- ✅ **多源抓取**: 支持从订阅链接或网页中提取节点。
- ✅ **自动验证**: 内置 TCP Ping 验证，自动剔除无效节点。
- ✅ **GitHub Actions**: 利用免费算力自动更新节点，生成永久订阅连接。
- ✅ **Clash/V2Ray**: 自动生成标准的 YAML 和 Base64 格式配置。

=================================================================================
1. config.js – 配置文件
功能：集中管理所有可调参数，包括：

sources：抓取目标列表（订阅链接或网页）。

crawler：爬虫并发数、超时、深度限制。

validator：TCP 测试超时、重试次数、并发数。

output：输出目录、文件名（已验证/未验证、Clash/订阅格式）。

cronSchedule：定时任务表达式。

完整性：✅ 配置项齐全，满足需求。

2. crawler.js – 抓取模块
功能：负责从 config.sources 中定义的多种源（直接订阅链接、普通网页、带通配符的页面）提取原始节点链接。处理流程包括：

直接订阅：通过 axios 下载并调用 parser 解码/提取。

网页抓取：使用 CheerioCrawler（静态）遍历页面，提取文本链接，并寻找子订阅文件进行二次解析。

完整性：⚠️ 基本功能存在，但不足。

无法处理需要 JavaScript 渲染的页面（如 Telegram 公开频道），导致抓取失败。

子订阅文件下载为串行，效率低。

若采用我们建议的 PlaywrightCrawler 替换，则可完整支持动态内容。

3. parser.js – 解析模块
功能：提供链接提取、协议解码、节点结构化解析：

extractLinks：用正则从文本中提取 vmess://、vless://、ss://、trojan:// 链接。

decodeSubscription：Base64 解码订阅内容（或返回明文行）。

parseNode：将链接解析为包含 type、add、port 等字段的对象（仅 vmess 完整实现）。

parseClash：将 Clash YAML 格式的代理列表转换为通用对象。

完整性：⚠️ 部分协议解析不完整。

ss、vless、trojan 在原始代码中未提取 add/port，导致后续验证无法进行。

extractLinks 正则过窄，无法匹配 trojan:// 中含 . : 的链接。

我们已给出增强版，覆盖所有常见协议，修改后可完全满足。

4. validator.js – 验证模块
功能：对解析后的节点进行 TCP 连通性测试（tcpping），通过 concurrent 控制并发，过滤掉延迟过高或不可达的节点，返回可用节点列表。

完整性：✅ 功能完整，仅建议将硬编码阈值（<3000ms）改为可配置，但实际已可用。

5. exporter.js – 导出模块
功能：将验证通过的节点生成为两种格式：

Clash YAML：构建包含代理、代理组、规则的完整配置文件。

Base64 订阅：将原始链接列表重新编码为标准订阅格式。

同时负责保存运行日志（saveRunLog）。

完整性：✅ 功能完备，支持未验证节点的单独导出（clash_all.yaml 等），满足“生成标准配置”需求。

6. index.js – 主程序入口
功能：串联整个工作流：

调用 crawlSources → parseNode → validateNodes → saveResults。

支持 --run-once（一次性执行）和常驻模式（定时循环）。

捕获异常、记录统计信息并持久化日志。

完整性：✅ 流程清晰，状态统计完整，支持两种运行模式，满足需求。

7. package.json – 依赖与脚本
功能：声明项目依赖（crawlee、playwright、axios、tcp-ping 等），定义 scripts（crawl、start、test），指定模块类型（ESM）。

完整性：✅ 依赖齐全，脚本正确。

8. schedule.yml（即 GitHub Actions 工作流） – CI/CD 自动化
功能：每日定时（或手动）触发任务，执行 npm run crawl，并将 output/ 目录的变更自动提交到仓库，从而实现“永久订阅链接”的持续更新。

完整性：✅ 配置正确，但需额外增加 Playwright 浏览器安装步骤（若使用动态爬虫），否则 Telegram 等源无法抓取。

✅ 整体结论
原始文件已具备全部功能的骨架，但在“多源抓取”的全面性和“多种协议解析”的完整性上存在缺陷，具体表现为：

无法抓取动态网页（如 Telegram 频道）；

部分协议（ss/vless/trojan）解析未提取关键字段，导致验证失败；

正则表达式匹配范围不足。

若采用我们之前提出的增强修改（Playwright 爬虫、完善 parseNode、增强正则），则这些文件将完整、高效地实现所有特性。
=====================================================================================
## 如何使用 (GitHub Actions 版) - **推荐**

这是最简单、最稳定的使用方式，无需自己的服务器。

### 1. Fork 本项目
点击右上角的 **Fork** 按钮，将项目复制到你的账号下。

### 2. 配置订阅源
修改 `src/config.js` 文件，填入你的订阅源 URL：
```javascript
export default {
    sources: [
        'https://你的订阅链接1...',
        'https://你的订阅链接2...'
    ],
    // ...
}
```

### 3. 启用权限 (关键步骤！)
在你的 GitHub 仓库页面：
1. 点击 **Settings** > **Actions** > **General**
2. 滚动到底部 **Workflow permissions**
3. 选择 **Read and write permissions**
4. 点击 Save

### 4. 启动运行
1. 点击 **Actions** 标签页。
2. 在左侧选择 **Update Subscription**。
3. 点击 **Run workflow** 手动触发一次。
4. 之后每天会自动运行两次（北京时间 8:00 和 20:00）。

### 5. 获取订阅链接
运行成功后，订阅文件会自动更新在 `output` 文件夹中。你可以使用 **jsDelivr CDN** 加速作为你的订阅地址：

- **Clash 订阅**: 
  `https://cdn.jsdelivr.net/gh/<你的用户名>/<仓库名>@main/output/clash.yaml`
  
- **V2Ray/通用订阅**:
  `https://cdn.jsdelivr.net/gh/<你的用户名>/<仓库名>@main/output/subscribe.txt`

---

## 本地开发

```bash
# 安装依赖
npm install

# 单次运行
npm run crawl

# 运行测试
npm test
```

## Linux 服务器部署 (自托管)

如果你拥有一台 Linux 服务器 (VPS)，可以让爬虫并在后台静默运行。

### 1. 环境准备
确保服务器已安装 Node.js 18+。
```bash
# 检查 node 版本
node -v
```

### 2. 部署代码
```bash
git clone https://github.com/你的用户名/spider-clash.git
cd spider-clash
npm install
```

### 3. 后台运行

#### 方式 A: 使用 PM2 (推荐)
PM2 是一个强大的进程管理器，支持开机自启和日志管理。

```bash
# 安装 PM2
npm install -g pm2

# 启动爬虫 (它会根据 config.js 的 Cron 设定自动工作)
pm2 start src/index.js --name spider-clash

# 保存当前进程列表 (用于开机自启)
pm2 save
pm2 startup
```

常用命令：
- 查看日志: `pm2 logs spider-clash`
- 停止服务: `pm2 stop spider-clash`
- 重启服务: `pm2 restart spider-clash`

#### 方式 B: 使用 nohup
```bash
nohup node src/index.js > app.log 2>&1 &
```

### 4. 获取订阅
部署在服务器上后，你需要配置 Nginx 或 Apache 将 `output` 目录暴露给公网，或者直接通过文件路径读取。

## 贡献
欢迎提交 Issue 或 PR 改进解析逻辑。

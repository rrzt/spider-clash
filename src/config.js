export default {
    // 目标订阅源或网页列表
    sources: [
        // 示例: 'https://example.com/free-nodes',
        // 示例: 'vmess://....' (base64 文本内容的 URL)
        'https://nodefree.me',
        'https://nodefree.me/p/*.html'

    ],
    
    // 抓取设置
    crawler: {
        maxRequestsPerCrawl: 50,
        requestTimeoutSecs: 30,
        maxDepth: 3, // 爬取深度: 1=只爬当前页, 2=爬当前页+它包含的链接
    },

    // 验证设置
    validator: {
        timeout: 3000, // TCP ping 超时时间 (ms)
        attempts: 2,   // 重试次数
        concurrent: 20 // 并发验证数量
    },

    // 输出设置
    output: {
        dir: './output',
        clashFileName: 'clash.yaml',
        subscribeFileName: 'subscribe.txt',
        // 未验证的节点输出
        unvalidatedClashFileName: 'clash_all.yaml',
        unvalidatedSubscribeFileName: 'subscribe_all.txt',
        // 日志目录
        logDir: './output/logs'
    },

    // 定时任务 (Cron 表达式) - 默认每4小时运行一次
    cronSchedule: '0 */4 * * *'
};

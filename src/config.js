export default {
    // 目标订阅源或网页列表
    sources: [
        // 示例: 'https://example.com/free-nodes',
        // 示例: 'vmess://....' (base64 文本内容的 URL)
        'https://nodefree.me',
        'https://nodefree.me/p/*.html',
                'https://oneclash.cc/',
        'https://oneclash.cc/a/*.html',
        'https://clashnodev2ray.github.io/',
        'https://clashnodev2ray.github.io/*/*/*/free-ssr-node/',
        'https://github.com/free-nodes/v2rayfree',
        'https://freenode.openrunner.net/',
        'https://freenode.openrunner.net/post/*/',
        'https://www.cfmem.com/search/label/free',
        'https://clashgithub.com/category/freenode',
        'https://github.com/free-nodes/clashfree',
        'https://github.com/free18/v2ray',
        'https://github.com/Pawdroid/Free-servers',
        'https://github.com/John19187/v2ray-SSR-Clash-Verge-Shadowrocke',

        'https://github.com/shaoyouvip/free',
        'https://github.com/hwanz/SSR-V2ray-Trojan-vpn',
        'https://nodefree.me',
        'https://nodefree.me/p/*.html',
        'https://nodefree.me/*/*.html',
        'https://v2rayshare.net',
        'https://v2rayshare.net/*/*.html',
        'https://jichangx.com/free-subscription',
        'https://jichangx.com/*/',
        'https://clashstair.com/freenode/',
        'https://clashstair.com/freenode/*/',
        'https://nodebuf.com',
        'https://clashgithub.com/*.html',
        'https://www.freeclashnode.com/free-node/',
        'https://www.freeclashnode.com/free-node/*.htm',
        'https://www.mibei77.com/*.html',
        'https://clashnodev2ray.github.io',
        'https://clashnodev2ray.github.io/*/*/*/free-ssr-node/',

        'https://www.proxyqueen.top/*/*/*/',

        'https://wanzhuanmi.com/*/*/',
        'https://clashnode.cc/free-node/*.htm',
        'https://free.datiya.com',
        'https://free.datiya.com/post/*/',
        'https://clashgithub.com/*.html',
        'https://oneclash.cc/freenode',
        'https://oneclash.cc/a/*.html',
        'https://www.freev2raynode.com/free-node-subscription/*.htm',
        'https://www.85la.com/internet-access/free-network-nodes',
        'https://www.85la.com/*.html',
        'https://www.stairnode.com/daily/*',
        //以下链接需用新应用抓取
        'https://t.me/s/StairNode',
        'https://t.me/s/v2queen',  
        'https://t.me/s/clashjd', 
        'https://t.me/s/changfengchannel',       
        'https://www.cfmem.com'

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

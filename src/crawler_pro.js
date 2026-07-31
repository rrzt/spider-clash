/**
 * ============================================================
 *  crawler.js - 多源节点抓取模块
 * ============================================================
 * 
 * 通配符配置示例（在 config.js 的 sources 中使用）：
 * 
 *   // 1. 匹配所有每日更新页面（跨多层目录）
 *   'https://www.cfmem.com/*/*/*.html' 
 *   // 说明：爬虫将从根域名（https://www.cfmem.com/）开始，
 *   //      匹配所有符合该模式的三级目录 .html 链接并入队。
 * 
 *   // 2. 匹配特定目录下的所有 html
 *   'https://www.cfmem.com/a/*/*.html'
 *   // 说明：同样从根域名开始，仅匹配 /a/ 下的两级目录 .html 链接。
 * 
 *   // 3. 混合使用普通 URL 和通配符
 *   'https://example.com/page1',
 *   'https://example.com/daily/*'
 *   // 说明：page1 作为普通网页直接抓取；daily/* 匹配 daily 下所有页面。
 * 
 * 通配符特性：
 *   - 支持多层路径（例如 /a/*/*.html 可匹配 /a/2026/07/xxx.html）
 *   - 自动以根域名作为起始页，确保能从首页发现链接
 *   - 深度由 config.crawler.maxDepth 控制
 * ============================================================
 */

import { CheerioCrawler } from 'crawlee';
import config from './config.js';
import { decodeSubscription, extractLinks, parseClash } from './parser.js';
import axios from 'axios';

/**
 * 抓取所有源并返回提取到的节点链接
 * @returns {Promise<string[]>} 原始节点链接列表
 */
export async function crawlSources() {
    const foundLinks = new Set();

    // 预处理源：分离直接订阅、普通网页、通配符
    const directUrls = [];
    const pageUrls = [];
    const globs = [];

    config.sources.forEach(url => {
        // [修改] 通配符处理：起始页统一为根域名
        if (url.includes('*')) {
            globs.push(url);
            // [新增] 使用 URL 对象提取协议+主机名作为起始页
            // 目的：支持深层通配符（如 /a/*/*.html），确保从首页开始抓取
            const urlObj = new URL(url);
            const startUrl = urlObj.origin + '/';
            console.log(`Wildcard source detected: ${url} -> Start at: ${startUrl}`);
            pageUrls.push(startUrl);
        // [MOD] 将订阅关键词从 'subscribe' 改为 'subscri'，以同时匹配 'subscribe' 和 'subscription'
        } else if (url.includes('subscri') || url.includes('feed') || url.includes('.txt') || url.includes('.yaml')) {
            directUrls.push(url);
        } else {
            pageUrls.push(url);
        }
    });

    console.log(`Starting crawl. Direct: ${directUrls.length}, Pages: ${pageUrls.length}, Globs: ${globs.length}`);

    // ==================== 处理直接订阅链接 ====================
    for (const url of directUrls) {
        try {
            console.log(`Fetching subscription: ${url}`);
            const response = await axios.get(url, { timeout: 10000 });
            const content = response.data;
            if (typeof content === 'string') {
                // 尝试 Base64 解码
                const links = decodeSubscription(content) || [];
                if (links.length > 0) {
                    links.forEach(l => foundLinks.add(l));
                } else {
                    // 正则提取
                    const extracted = extractLinks(content);
                    extracted.forEach(l => foundLinks.add(l));
                }

                // 尝试 Clash YAML 解析
                const clashProxies = parseClash(content);
                // [修改] 修复：parseClash 返回对象数组，需提取 original 字段（节点链接字符串）
                // 但 original 可能是原始 Clash 对象，需统一转换为字符串（如 vmess://...）
                // 我们采用保守策略：如果有 original 且是字符串则添加，否则跳过
                clashProxies.forEach(p => {
                    if (p.original && typeof p.original === 'string') {
                        foundLinks.add(p.original);
                    } else {
                        // 若无法还原为链接，将整个对象转为 JSON 字符串（非标准但保留数据）
                        // 实际项目应完善转换逻辑，此处仅做演示
                        console.warn(`Clash proxy lacks original string:`, p);
                    }
                });
            }
        } catch (error) {
            console.error(`Failed to fetch ${url}: ${error.message}`);
        }
    }

    // ==================== 处理网页抓取 ====================
    if (pageUrls.length > 0) {
        const crawler = new CheerioCrawler({
            maxRequestsPerCrawl: config.crawler.maxRequestsPerCrawl,
            requestHandler: async ({ $, request, enqueueLinks }) => {
                console.log(`Scanning page: ${request.url}`);
                const text = $('body').text();
                const html = $('body').html();

                // 1. 从当前页面文本提取直接链接
                const linksFromText = extractLinks(text);
                [...linksFromText].forEach(link => foundLinks.add(link));

                // 2. 查找页面中的订阅链接（包括 .txt/.yaml/.yml 以及包含 subscri/feed 的链接）
                const subLinks = new Set();

                // A. 查找 a 标签
                $('a[href]').each((i, el) => {
                    let href = $(el).attr('href');
                    if (href) {
                        // [新增] 将相对路径补全为绝对 URL
                        // 目的：确保后续 axios 请求能正确访问子订阅
                        try {
                            const absoluteUrl = new URL(href, request.url).href;
                            // [MOD] 扩大判断范围：除了 .txt/.yaml/.yml，还包含 subscri 或 feed 关键词的链接
                            if (absoluteUrl && (
                                absoluteUrl.endsWith('.txt') ||
                                absoluteUrl.endsWith('.yaml') ||
                                absoluteUrl.endsWith('.yml') ||
                                /subscri|feed/i.test(absoluteUrl)
                            )) {
                                subLinks.add(absoluteUrl);
                            }
                        } catch (e) {
                            // URL 构造失败则忽略
                        }
                    }
                });

                // B. 查找文本中的 http 链接（扩大匹配范围）
                // [MOD] 正则表达式现在匹配 .txt/.yaml/.yml 或者包含 subscri/feed 的链接
                const urlRegex = /https?:\/\/[^\s"']+(?:\.(?:txt|yaml|yml)|(?:subscri|feed))/gi;
                const textMatches = text.match(urlRegex) || [];
                textMatches.forEach(m => subLinks.add(m));

                console.log(`Found ${subLinks.size} potential subscription links on ${request.url}`);

                // [修改] 并发下载子订阅，提升效率
                if (subLinks.size > 0) {
                    const downloadPromises = Array.from(subLinks).map(async (subLink) => {
                        try {
                            console.log(`Fetching sub-link: ${subLink}`);
                            const response = await axios.get(subLink, { timeout: 10000 });
                            const content = response.data;

                            if (typeof content === 'string') {
                                // 尝试 Base64 解码
                                const decoded = decodeSubscription(content);
                                if (decoded.length > 0) {
                                    decoded.forEach(l => foundLinks.add(l));
                                }
                                // 正则提取
                                const extracted = extractLinks(content);
                                extracted.forEach(l => foundLinks.add(l));

                                // [新增] 对 YAML 子订阅调用 parseClash 解析
                                // 目的：支持 Clash YAML 格式的订阅文件
                                if (subLink.endsWith('.yaml') || subLink.endsWith('.yml')) {
                                    const clashProxies = parseClash(content);
                                    clashProxies.forEach(p => {
                                        if (p.original && typeof p.original === 'string') {
                                            foundLinks.add(p.original);
                                        }
                                    });
                                }
                            }
                        } catch (err) {
                            console.error(`Failed to fetch sub-link ${subLink}: ${err.message}`);
                        }
                    });
                    await Promise.allSettled(downloadPromises);
                }

                // 3. 深度控制
                const currentDepth = request.userData.depth || 1;
                if (currentDepth >= config.crawler.maxDepth) {
                    console.log(`Reached max depth (${currentDepth}) for ${request.url}`);
                    return;
                }

                // 4. 通配符模式匹配：将匹配的链接入队
                if (globs.length > 0) {
                    await enqueueLinks({
                        globs: globs,
                        label: 'wildcard-match',
                        userData: {
                            depth: currentDepth + 1
                        }
                    });
                }
            },
        });

        await crawler.run(pageUrls);
    }

    console.log(`Crawl finished. Found ${foundLinks.size} unique links.`);
    return Array.from(foundLinks);
}

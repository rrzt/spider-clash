// ============================================================
// crawler_pro.js - 多源节点抓取模块
// ============================================================
// 
// 通配符配置示例（在 config.js 的 sources 中使用）：
//   1. 匹配所有每日更新页面（跨多层目录）
//   'https://www.cfmem.com/*/*/*.html' 
//   说明：爬虫将从根域名（https://www.cfmem.com/）开始，
//        匹配所有符合该模式的三级目录 .html 链接并入队。
//   2. 匹配特定目录下的所有 html
//   'https://www.cfmem.com/a/*/*.html'
//   说明：同样从根域名开始，仅匹配 /a/ 下的两级目录 .html 链接。
//   3. 混合使用普通 URL 和通配符
//   'https://example.com/page1',
//   'https://example.com/daily/*'
//   说明：page1 作为普通网页直接抓取；daily/* 匹配 daily 下所有页面。
// 通配符特性：
//   - 支持多层路径（例如 /a/*/*.html 可匹配 /a/2026/07/xxx.html）
//   - 自动以根域名作为起始页，确保能从首页发现链接
//   - 深度由 config.crawler.maxDepth 控制
// ============================================================

import { CheerioCrawler } from 'crawlee';
import config from './config.js';
import { decodeSubscription, extractLinks, parseClash } from './parser.js';
import axios from 'axios';

// 辅助函数：清理链接末尾的标点符号（如 : , . ? ! ;）
function cleanUrl(url) {
    return url.replace(/[:,.?!;]+$/, '');
}

export async function crawlSources() {
    const foundLinks = new Set();

    const directUrls = [];
    const pageUrls = [];
    const globPatterns = [];

    config.sources.forEach(url => {
        if (url.includes('*')) {
            try {
                const urlObj = new URL(url);
                globPatterns.push(urlObj.pathname);
            } catch (e) {
                globPatterns.push(url);
            }
            const urlObj = new URL(url);
            const startUrl = urlObj.origin + '/';
            console.log(`Wildcard source detected: ${url} -> Start at: ${startUrl}`);
            pageUrls.push(startUrl);
        } else if (url.includes('subscri') || url.includes('feed') || url.includes('.txt') || url.includes('.yaml')) {
            directUrls.push(url);
        } else {
            pageUrls.push(url);
        }
    });

    console.log(`Starting crawl. Direct: ${directUrls.length}, Pages: ${pageUrls.length}`);

    // 处理直接订阅
    for (const url of directUrls) {
        try {
            console.log(`Fetching subscription: ${url}`);
            const response = await axios.get(url, { timeout: 10000 });
            const content = response.data;
            if (typeof content === 'string') {
                const links = decodeSubscription(content) || [];
                if (links.length > 0) {
                    links.forEach(l => foundLinks.add(cleanUrl(l)));
                } else {
                    const extracted = extractLinks(content);
                    extracted.forEach(l => foundLinks.add(cleanUrl(l)));
                }

                const clashProxies = parseClash(content);
                clashProxies.forEach(p => {
                    if (p.original && typeof p.original === 'string') {
                        foundLinks.add(cleanUrl(p.original));
                    } else {
                        console.warn(`Clash proxy lacks original string:`, p);
                    }
                });
            }
        } catch (error) {
            console.error(`Failed to fetch ${url}: ${error.message}`);
        }
    }

    // 网页抓取
    if (pageUrls.length > 0) {
        const crawler = new CheerioCrawler({
            maxRequestsPerCrawl: config.crawler.maxRequestsPerCrawl,
            requestHandler: async ({ $, request, enqueueLinks }) => {
                console.log(`Scanning page: ${request.url}`);
                const text = $('body').text();

                // 提取页面文本中的直接链接
                const linksFromText = extractLinks(text);
                [...linksFromText].forEach(link => foundLinks.add(cleanUrl(link)));

                // 查找订阅链接
                const subLinks = new Set();
                $('a[href]').each((i, el) => {
                    let href = $(el).attr('href');
                    if (href) {
                        try {
                            const absoluteUrl = new URL(href, request.url).href;
                            const cleaned = cleanUrl(absoluteUrl);
                            if (cleaned && (
                                cleaned.endsWith('.txt') ||
                                cleaned.endsWith('.yaml') ||
                                cleaned.endsWith('.yml') ||
                                /subscri|feed/i.test(cleaned)
                            )) {
                                subLinks.add(cleaned);
                            }
                        } catch (e) {}
                    }
                });

                const urlRegex = /https?:\/\/[^\s"']+(?:\.(?:txt|yaml|yml)|(?:subscri|feed))/gi;
                const textMatches = text.match(urlRegex) || [];
                textMatches.forEach(m => subLinks.add(cleanUrl(m)));

                // 下载并解析子订阅
                if (subLinks.size > 0) {
                    const downloadPromises = Array.from(subLinks).map(async (subLink) => {
                        try {
                            const response = await axios.get(subLink, { timeout: 10000 });
                            const content = response.data;

                            if (typeof content === 'string') {
                                const decoded = decodeSubscription(content);
                                if (decoded.length > 0) {
                                    decoded.forEach(l => foundLinks.add(cleanUrl(l)));
                                }
                                const extracted = extractLinks(content);
                                extracted.forEach(l => foundLinks.add(cleanUrl(l)));

                                if (subLink.endsWith('.yaml') || subLink.endsWith('.yml')) {
                                    const clashProxies = parseClash(content);
                                    clashProxies.forEach(p => {
                                        if (p.original && typeof p.original === 'string') {
                                            foundLinks.add(cleanUrl(p.original));
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

                // 深度控制
                const currentDepth = request.userData.depth || 1;
                if (currentDepth >= config.crawler.maxDepth) {
                    return;
                }

                // 手动匹配通配符模式，入队新链接
                if (globPatterns.length > 0) {
                    const matchedUrls = [];
                    $('a[href]').each((i, el) => {
                        const href = $(el).attr('href');
                        if (href) {
                            try {
                                const absoluteUrl = new URL(href, request.url).href;
                                for (const pattern of globPatterns) {
                                    const regexPattern = pattern
                                        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                                        .replace(/\\\*/g, '.*');
                                    const regex = new RegExp('^' + regexPattern + '$');
                                    const urlObj = new URL(absoluteUrl);
                                    if (regex.test(urlObj.pathname)) {
                                        matchedUrls.push(absoluteUrl);
                                        break;
                                    }
                                }
                            } catch (e) {}
                        }
                    });
                    const uniqueUrls = [...new Set(matchedUrls)];
                    if (uniqueUrls.length > 0) {
                        await enqueueLinks({
                            urls: uniqueUrls,
                            label: 'wildcard-match',
                            userData: {
                                depth: currentDepth + 1
                            }
                        });
                    }
                }
            },
        });

        await crawler.run(pageUrls);
    }

    console.log(`Crawl finished. Found ${foundLinks.size} unique links.`);
    return Array.from(foundLinks);
}

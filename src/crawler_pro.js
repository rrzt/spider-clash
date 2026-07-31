import { CheerioCrawler } from 'crawlee';
import config from './config.js';
import { decodeSubscription, extractLinks, parseClash } from './parser.js';
import axios from 'axios';

export async function crawlSources() {
    const foundLinks = new Set();
    const directUrls = [];
    const pageUrls = [];
    const globs = [];

    config.sources.forEach(url => {
        if (url.includes('*')) {
            globs.push(url);
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

    console.log(`Starting crawl. Direct: ${directUrls.length}, Pages: ${pageUrls.length}, Globs: ${globs.length}`);

    for (const url of directUrls) {
        try {
            console.log(`Fetching subscription: ${url}`);
            const response = await axios.get(url, { timeout: 10000 });
            const content = response.data;
            if (typeof content === 'string') {
                const links = decodeSubscription(content) || [];
                if (links.length > 0) {
                    links.forEach(l => foundLinks.add(l));
                } else {
                    const extracted = extractLinks(content);
                    extracted.forEach(l => foundLinks.add(l));
                }

                const clashProxies = parseClash(content);
                clashProxies.forEach(p => {
                    if (p.original && typeof p.original === 'string') {
                        foundLinks.add(p.original);
                    } else {
                        console.warn(`Clash proxy lacks original string:`, p);
                    }
                });
            }
        } catch (error) {
            console.error(`Failed to fetch ${url}: ${error.message}`);
        }
    }

    if (pageUrls.length > 0) {
        const crawler = new CheerioCrawler({
            maxRequestsPerCrawl: config.crawler.maxRequestsPerCrawl,
            requestHandler: async ({ $, request, enqueueLinks }) => {
                console.log(`Scanning page: ${request.url}`);
                const text = $('body').text();

                const linksFromText = extractLinks(text);
                [...linksFromText].forEach(link => foundLinks.add(link));

                const subLinks = new Set();

                $('a[href]').each((i, el) => {
                    let href = $(el).attr('href');
                    if (href) {
                        try {
                            const absoluteUrl = new URL(href, request.url).href;
                            if (absoluteUrl && (
                                absoluteUrl.endsWith('.txt') ||
                                absoluteUrl.endsWith('.yaml') ||
                                absoluteUrl.endsWith('.yml') ||
                                /subscri|feed/i.test(absoluteUrl)
                            )) {
                                subLinks.add(absoluteUrl);
                            }
                        } catch (e) {}
                    }
                });

                const urlRegex = /https?:\/\/[^\s"']+(?:\.(?:txt|yaml|yml)|(?:subscri|feed))/gi;
                const textMatches = text.match(urlRegex) || [];
                textMatches.forEach(m => subLinks.add(m));

                console.log(`Found ${subLinks.size} potential subscription links on ${request.url}`);

                if (subLinks.size > 0) {
                    const downloadPromises = Array.from(subLinks).map(async (subLink) => {
                        try {
                            console.log(`Fetching sub-link: ${subLink}`);
                            const response = await axios.get(subLink, { timeout: 10000 });
                            const content = response.data;

                            if (typeof content === 'string') {
                                const decoded = decodeSubscription(content);
                                if (decoded.length > 0) {
                                    decoded.forEach(l => foundLinks.add(l));
                                }
                                const extracted = extractLinks(content);
                                extracted.forEach(l => foundLinks.add(l));

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

                const currentDepth = request.userData.depth || 1;
                if (currentDepth >= config.crawler.maxDepth) {
                    console.log(`Reached max depth (${currentDepth}) for ${request.url}`);
                    return;
                }

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

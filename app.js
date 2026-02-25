/**
 * 微观算力经济学 — Blog Engine
 * 
 * Architecture:
 *   posts/posts.json  → registry of all posts (metadata)
 *   posts/*.md        → individual markdown files
 *   app.js            → this file; handles routing, rendering, RSS link
 */

(function () {
    'use strict';

    // ---- Configuration ----
    const POSTS_DIR = 'posts';
    const POSTS_INDEX = `${POSTS_DIR}/posts.json`;

    // ---- DOM References ----
    const postListSection = document.getElementById('post-list-section');
    const postView = document.getElementById('post-view');
    const postListEl = document.getElementById('post-list');
    const postArticleEl = document.getElementById('post-article');
    const backLink = document.getElementById('back-link');

    // ---- Marked Configuration ----
    marked.setOptions({
        highlight: function (code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: false,
        gfm: true
    });

    // ---- State ----
    let postsData = [];

    // ---- Helpers ----
    function formatDate(dateStr) {
        const d = new Date(dateStr);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getPostSlug() {
        const params = new URLSearchParams(window.location.search);
        return params.get('post');
    }

    // ---- Rendering ----
    function renderPostList() {
        postListSection.style.display = 'block';
        postView.style.display = 'none';

        if (postsData.length === 0) {
            postListEl.innerHTML = `
                <div style="text-align:center; padding:3rem 0; color:var(--text-muted);">
                    <p style="font-size:1.2rem; margin-bottom:0.5rem;">📝</p>
                    <p>暂无文章，敬请期待</p>
                </div>
            `;
            return;
        }

        postListEl.innerHTML = postsData.map(post => `
            <a class="post-card" href="?post=${post.slug}" onclick="handlePostClick(event, '${post.slug}')">
                <div class="post-card-meta">
                    <span class="post-date">${formatDate(post.date)}</span>
                    ${(post.tags || []).map(tag => `<span class="post-tag">${tag}</span>`).join('')}
                </div>
                <h3 class="post-card-title">${post.title}</h3>
                <p class="post-card-excerpt">${post.excerpt || ''}</p>
                <span class="post-card-arrow">→</span>
            </a>
        `).join('');
    }

    async function renderPost(slug) {
        const post = postsData.find(p => p.slug === slug);
        if (!post) {
            postArticleEl.innerHTML = `
                <div style="text-align:center; padding:3rem 0;">
                    <p style="font-size:1.5rem; margin-bottom:0.5rem;">😕</p>
                    <p style="color:var(--text-muted);">文章未找到</p>
                </div>
            `;
            postListSection.style.display = 'none';
            postView.style.display = 'block';
            return;
        }

        postListSection.style.display = 'none';
        postView.style.display = 'block';

        // Show loading
        postArticleEl.innerHTML = `
            <div class="post-header">
                <span class="post-date loading-skeleton" style="display:inline-block;width:120px;height:1em;background:var(--bg-tertiary);border-radius:4px;">&nbsp;</span>
                <div class="post-title loading-skeleton" style="width:80%;height:2em;background:var(--bg-tertiary);border-radius:8px;margin-top:1rem;">&nbsp;</div>
            </div>
        `;

        try {
            const response = await fetch(`${POSTS_DIR}/${slug}.md`);
            if (!response.ok) throw new Error('Failed to load');
            const md = await response.text();
            const htmlContent = marked.parse(md);

            const tagsHtml = (post.tags || []).map(t => `<span class="post-tag">${t}</span>`).join('');

            postArticleEl.innerHTML = `
                <div class="post-header">
                    <span class="post-date">${formatDate(post.date)}</span>
                    <h1 class="post-title">${post.title}</h1>
                    ${tagsHtml ? `<div class="post-tags">${tagsHtml}</div>` : ''}
                </div>
                <div class="post-body">${htmlContent}</div>
            `;

            // Update page title
            document.title = `${post.title} — 微观算力经济学`;

            // Apply syntax highlighting to any missed blocks
            document.querySelectorAll('.post-body pre code').forEach(block => {
                hljs.highlightElement(block);
            });

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (err) {
            postArticleEl.innerHTML = `
                <div style="text-align:center; padding:3rem 0;">
                    <p style="font-size:1.5rem; margin-bottom:0.5rem;">⚠️</p>
                    <p style="color:var(--text-muted);">加载文章失败，请稍后再试</p>
                </div>
            `;
        }
    }

    // ---- Navigation ----
    window.handlePostClick = function (event, slug) {
        event.preventDefault();
        history.pushState({ post: slug }, '', `?post=${slug}`);
        renderPost(slug);
    };

    backLink.addEventListener('click', function (event) {
        event.preventDefault();
        history.pushState({}, '', window.location.pathname);
        document.title = '微观算力经济学';
        renderPostList();
    });

    window.addEventListener('popstate', function () {
        const slug = getPostSlug();
        if (slug) {
            renderPost(slug);
        } else {
            document.title = '微观算力经济学';
            renderPostList();
        }
    });

    // ---- Initialization ----
    async function init() {
        // Show skeleton loading
        postListEl.innerHTML = Array(3).fill(0).map(() =>
            '<div class="skeleton-card loading-skeleton"></div>'
        ).join('');

        try {
            const response = await fetch(POSTS_INDEX);
            if (!response.ok) throw new Error('Cannot load posts index');
            postsData = await response.json();

            // Sort by date descending
            postsData.sort((a, b) => new Date(b.date) - new Date(a.date));

        } catch (err) {
            console.warn('Posts index not found or empty. Starting fresh.');
            postsData = [];
        }

        const slug = getPostSlug();
        if (slug) {
            renderPost(slug);
        } else {
            renderPostList();
        }
    }

    init();
})();

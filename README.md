# GitCMSstudio 🚀

> **Lightweight, Privacy-First, Zero-Dependency Headless Git CMS** running 100% in your browser.  
> Directly manage content, dynamic pages, and settings on any public or private GitHub repository via the GitHub REST API.

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-blue.svg)](#)
[![Client-Side Only](https://img.shields.io/badge/Backend-Serverless%20%2F%20In--Browser-purple.svg)](#)

---

## ✨ Features

- **100% Client-Side & Privacy-First** : No intermediary server, no database, no third-party tracking. All operations happen directly between your web browser and the official GitHub REST API.
- **Zero Dependencies** : Pure Vanilla HTML5, CSS3, and modern JavaScript. Fast, maintainable, and completely bloat-free.
- **Schema-Driven Architecture** : Entirely configured through a single `cms.config.json` file stored in your target repository.
- **Private & Public Repo Support** : Seamlessly works with private client websites as well as open-source projects using GitHub Personal Access Tokens (PAT).
- **Direct Multi-File GitHub Commits** : Edits, creations, deletions, and image uploads are committed directly with custom commit messages.
- **One-Click URL Launch** : Share pre-configured URLs with team members or clients:  
  `https://your-studio-domain.com/?repo=owner/my-site&branch=main&config=cms.config.json`

---

## 🚀 Quick Start

### 1. Host or Open GitCMSstudio
You can host GitCMSstudio for free on **Cloudflare Pages**, **GitHub Pages**, or even open `index.html` locally in your browser.

### 2. Add `cms.config.json` to Your Target Repository
Create a `cms.config.json` file in the root of your target website repository:

```json
{
  "title": "My Company Studio",
  "media_folder": "public/images",
  "public_folder": "/images",
  "collections": [
    {
      "name": "settings",
      "label": "⚙️ Site Settings",
      "type": "file",
      "file": "src/data/site_settings.json",
      "fields": [
        { "name": "company_name", "label": "Company Name", "type": "string", "required": true },
        { "name": "email", "label": "Email Address", "type": "string", "required": true },
        {
          "name": "theme",
          "label": "🎨 Color Palette",
          "type": "object",
          "fields": [
            { "name": "primary_color", "label": "Primary Color", "type": "color", "default": "#10b981" }
          ]
        }
      ]
    },
    {
      "name": "pages",
      "label": "📄 Pages",
      "type": "folder",
      "folder": "src/data/pages",
      "fields": [
        { "name": "title", "label": "Page Title", "type": "string", "required": true },
        { "name": "slug", "label": "URL Slug", "type": "string", "required": true },
        { "name": "content", "label": "Markdown Content", "type": "markdown" }
      ]
    }
  ]
}
```

### 3. Connect & Edit
1. Open GitCMSstudio in your browser.
2. Enter your repository (`owner/repo`), branch (`main`), config path (`cms.config.json`), and your **GitHub Personal Access Token (PAT)** with `repo` permissions.
3. Edit your content visually, upload images, and click **Publish to GitHub**!

---

## 🧩 Supported Field Types

| Type | Description |
| :--- | :--- |
| `string` | Single-line text input |
| `text` | Multi-line textarea |
| `markdown` | Markdown editor textarea |
| `boolean` | Toggle checkbox (true/false) |
| `select` | Dropdown selection with defined options |
| `color` | Native HTML color picker + hex code sync |
| `image` | Text path input + local file uploader with base64 staging |
| `object` | Nested object with child fields |

---

## 🔒 Security & Privacy

- **No Server Storage** : GitCMSstudio does not have a backend server. Your GitHub token is stored solely in your local browser's `localStorage` and sent exclusively via HTTPS to `https://api.github.com`.
- **Granular Permissions** : You can use GitHub Fine-Grained Personal Access Tokens restricted to a single repository with **Contents: Read & Write** permissions.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

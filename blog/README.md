# PublishJockey Blog Content

This directory contains blog posts for the PublishJockey website.

## Structure

```
blog/
├── index.json                    # Blog post metadata index
├── README.md                     # This file
└── [slug].md                     # Individual blog post files
```

## Adding a New Blog Post

### 1. Create the Markdown File

Create a new `.md` file using a URL-friendly slug as the filename:
- Use lowercase letters
- Replace spaces with hyphens
- Keep it concise but descriptive

Example: `professional-book-formatting-tips.md`

### 2. Write Your Content

Use standard Markdown formatting with the following structure:

```markdown
# Main Title (H1)

## Introduction (H2)

Your opening paragraphs...

## Body Sections (H2)

### Subsections (H3)

Content here...

---

**Published:** [Date]  
**Category:** [Category Name]  
**Tags:** #Tag1 #Tag2 #Tag3
```

### 3. Update index.json

Add an entry to `index.json` with the following fields:

```json
{
  "id": "post-slug",
  "title": "Full Post Title",
  "slug": "post-slug",
  "description": "Brief description for SEO",
  "author": "Author Name",
  "publishDate": "YYYY-MM-DD",
  "category": "Category Name",
  "tags": ["Tag1", "Tag2"],
  "featured": false,
  "readTime": "X min",
  "excerpt": "First paragraph or summary",
  "seoKeywords": ["keyword1", "keyword2"]
}
```

## Categories

- Publishing Tips
- Professional Development
- Case Studies
- Product Updates
- Industry Insights

## Best Practices

1. **SEO Optimization**: Include relevant keywords naturally in titles, headings, and content
2. **Readability**: Use short paragraphs, bullet points, and clear headings
3. **Visual Elements**: Use emojis (✅, 🚀, 💡) sparingly for visual interest
4. **Call to Action**: Always end with a clear next step for readers
5. **Links**: Link to relevant PublishJockey features and other blog posts

## Publishing Workflow

1. Write and review the blog post
2. Add to `index.json`
3. Commit to git
4. Frontend will automatically display new posts based on `index.json`


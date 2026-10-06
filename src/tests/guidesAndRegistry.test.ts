import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GUIDES, getGuideBySlug } from '../features/seo/guides/guidesData';
import { ALL_TOOLS, findToolById, searchTools } from '../registry/toolRegistry';

describe('Tool Registry & SEO Guides Integrity', () => {
  it('registers at least 20 production tools with valid metadata', () => {
    expect(ALL_TOOLS.length).toBeGreaterThanOrEqual(20);

    for (const tool of ALL_TOOLS) {
      expect(tool.id).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.route).toMatch(/^\/[a-z0-9-]+$/);
      expect(tool.category).toBeTruthy();
      expect(tool.keywords.length).toBeGreaterThanOrEqual(3);
      expect(tool.acceptedInputExtensions.length).toBeGreaterThanOrEqual(1);
      expect(tool.outputExtension).toBeTruthy();
    }
  });

  it('searches tools accurately by keywords, category, and name', () => {
    const signResults = searchTools('sign');
    expect(signResults.some((t) => t.id === 'sign-pdf')).toBe(true);

    const encryptResults = searchTools('encrypt');
    expect(encryptResults.some((t) => t.id === 'protect-pdf')).toBe(true);

    const wordResults = searchTools('word');
    expect(wordResults.some((t) => t.id === 'pdf-to-word')).toBe(true);
  });

  it('finds tool by ID correctly', () => {
    const editor = findToolById('pdf-editor');
    expect(editor).toBeDefined();
    expect(editor?.route).toBe('/pdf-editor');

    const redact = findToolById('redact-pdf');
    expect(redact).toBeDefined();
    expect(redact?.name).toBe('Redact PDF');
  });

  it('contains all required high-value SEO guides with rich content', () => {
    const requiredSlugs = [
      'how-to-edit-pdf-without-adobe',
      'how-to-convert-pdf-to-word',
      'how-to-protect-pdf-with-password',
      'how-to-redact-pdf-permanently',
      'how-to-compress-pdf-without-losing-quality',
      'how-to-sign-pdf-online-free',
    ];

    expect(GUIDES.length).toBeGreaterThanOrEqual(6);

    for (const slug of requiredSlugs) {
      const guide = getGuideBySlug(slug);
      expect(guide).toBeDefined();
      expect(guide?.title).toBeTruthy();
      expect(guide?.summary).toBeTruthy();
      expect(guide?.keyTakeaways.length).toBeGreaterThanOrEqual(2);
      expect(guide?.sections.length).toBeGreaterThanOrEqual(2);
      expect(guide?.faqs.length).toBeGreaterThanOrEqual(1);
      expect(guide?.relatedToolRoute).toBeTruthy();
    }
  });

  it('verifies that robots.txt and sitemap.xml exist in public directory', () => {
    const publicDir = path.resolve(__dirname, '../../public');
    const robotsPath = path.join(publicDir, 'robots.txt');
    const sitemapPath = path.join(publicDir, 'sitemap.xml');

    expect(fs.existsSync(robotsPath)).toBe(true);
    expect(fs.existsSync(sitemapPath)).toBe(true);

    const robotsContent = fs.readFileSync(robotsPath, 'utf-8');
    expect(robotsContent).toContain('sitemap.xml');

    const sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');
    expect(sitemapContent).toContain('https://doculoom.com/pdf-editor');
    expect(sitemapContent).toContain('https://doculoom.com/pdf-to-word');
    expect(sitemapContent).toContain('https://doculoom.com/guides');
  });
});

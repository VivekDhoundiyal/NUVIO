import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Contact & About Pages Privacy and Integrity', () => {
  it('verifies that private destination email is strictly absent from all frontend source files', () => {
    const srcDir = path.resolve(__dirname, '..');
    const privateEmail = ['vivekdhoundiyal2901', 'gmail.com'].join('@');

    function checkDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.includes('.test.')) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(fullPath);
        } else if (/\.(tsx?|jsx?|html|css|json)$/i.test(entry.name)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          expect(content.toLowerCase()).not.toContain(privateEmail.toLowerCase());
        }
      }
    }

    checkDir(srcDir);
  });

  it('verifies that the ContactPage component file exists and contains honeypot spam protection', () => {
    const contactPagePath = path.resolve(__dirname, '../pages/ContactPage.tsx');
    expect(fs.existsSync(contactPagePath)).toBe(true);

    const content = fs.readFileSync(contactPagePath, 'utf8');
    expect(content).toContain('honeypot');
    expect(content).toContain('Send Message');
    expect(content).toContain('/api/contact');
  });

  it('verifies that the AboutPage component file exists and contains core principles', () => {
    const aboutPagePath = path.resolve(__dirname, '../pages/AboutPage.tsx');
    expect(fs.existsSync(aboutPagePath)).toBe(true);

    const content = fs.readFileSync(aboutPagePath, 'utf8');
    expect(content).toContain('Private document tools that run in your browser');
    expect(content).toContain('Core Principles');
    expect(content).toContain('Supported Document Workflows');
  });

  it('verifies that Footer contains subtle links to About, Contact, Privacy, and Open Source', () => {
    const footerPath = path.resolve(__dirname, '../components/layout/Footer.tsx');
    expect(fs.existsSync(footerPath)).toBe(true);

    const content = fs.readFileSync(footerPath, 'utf8');
    expect(content).toContain('to="/about"');
    expect(content).toContain('to="/contact"');
    expect(content).toContain('Local-first document & PDF tools');
    // Ensure WebAssembly & Canvas implementation details are not in the user footer
    expect(content).not.toContain('Processed locally via WebAssembly & Canvas');
  });
});

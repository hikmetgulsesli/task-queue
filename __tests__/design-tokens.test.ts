import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Design Tokens', () => {
  const globalsCssPath = path.join(__dirname, '../app/globals.css');
  const layoutPath = path.join(__dirname, '../app/layout.tsx');
  
  describe('CSS Custom Properties', () => {
    it('should have globals.css file', () => {
      expect(fs.existsSync(globalsCssPath)).toBe(true);
    });

    it('should define --primary color token', () => {
      const css = fs.readFileSync(globalsCssPath, 'utf-8');
      expect(css).toContain('--primary:');
    });

    it('should define surface color tokens', () => {
      const css = fs.readFileSync(globalsCssPath, 'utf-8');
      expect(css).toContain('--surface-0:');
      expect(css).toContain('--surface-1:');
      expect(css).toContain('--surface-2:');
    });

    it('should define text color tokens', () => {
      const css = fs.readFileSync(globalsCssPath, 'utf-8');
      expect(css).toContain('--text-primary:');
      expect(css).toContain('--text-secondary:');
    });

    it('should define border color tokens', () => {
      const css = fs.readFileSync(globalsCssPath, 'utf-8');
      expect(css).toContain('--border-subtle:');
      expect(css).toContain('--border-default:');
    });

    it('should define status color tokens', () => {
      const css = fs.readFileSync(globalsCssPath, 'utf-8');
      expect(css).toContain('--status-backlog:');
      expect(css).toContain('--status-queued:');
      expect(css).toContain('--status-running:');
      expect(css).toContain('--status-done:');
      expect(css).toContain('--status-failed:');
    });

    it('should define typography tokens', () => {
      const css = fs.readFileSync(globalsCssPath, 'utf-8');
      expect(css).toContain('--font-mono:');
      expect(css).toContain('--font-sans:');
    });

    it('should define spacing tokens', () => {
      const css = fs.readFileSync(globalsCssPath, 'utf-8');
      expect(css).toContain('--space-1:');
      expect(css).toContain('--space-4:');
      expect(css).toContain('--space-8:');
    });

    it('should define border radius tokens', () => {
      const css = fs.readFileSync(globalsCssPath, 'utf-8');
      expect(css).toContain('--radius-sm:');
      expect(css).toContain('--radius-md:');
      expect(css).toContain('--radius-lg:');
    });

    it('should define shadow tokens', () => {
      const css = fs.readFileSync(globalsCssPath, 'utf-8');
      expect(css).toContain('--shadow-sm:');
      expect(css).toContain('--shadow-md:');
    });

    it('should define transition tokens', () => {
      const css = fs.readFileSync(globalsCssPath, 'utf-8');
      expect(css).toContain('--transition-fast:');
      expect(css).toContain('--transition-base:');
    });
  });

  describe('Google Fonts', () => {
    it('should have layout.tsx file', () => {
      expect(fs.existsSync(layoutPath)).toBe(true);
    });

    it('should include Manrope font', () => {
      const layout = fs.readFileSync(layoutPath, 'utf-8');
      expect(layout).toContain('Manrope');
    });

    it('should include Karla font', () => {
      const layout = fs.readFileSync(layoutPath, 'utf-8');
      expect(layout).toContain('Karla');
    });

    it('should have Google Fonts link in head', () => {
      const layout = fs.readFileSync(layoutPath, 'utf-8');
      expect(layout).toContain('fonts.googleapis.com');
    });
  });

  describe('.gitignore', () => {
    const gitignorePath = path.join(__dirname, '../.gitignore');

    it('should have .gitignore file', () => {
      expect(fs.existsSync(gitignorePath)).toBe(true);
    });

    it('should ignore node_modules', () => {
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      expect(gitignore).toContain('node_modules');
    });

    it('should ignore .next', () => {
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      expect(gitignore).toContain('.next/');
    });

    it('should ignore .env', () => {
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      expect(gitignore).toContain('.env');
    });

    it('should ignore data/', () => {
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      expect(gitignore).toContain('data/');
    });
  });

  describe('.env.example', () => {
    const envExamplePath = path.join(__dirname, '../.env.example');

    it('should have .env.example file', () => {
      expect(fs.existsSync(envExamplePath)).toBe(true);
    });

    it('should have DATABASE_PATH placeholder', () => {
      const envExample = fs.readFileSync(envExamplePath, 'utf-8');
      expect(envExample).toContain('DATABASE_PATH');
    });
  });

  describe('Lucide React', () => {
    const packageJsonPath = path.join(__dirname, '../package.json');

    it('should have package.json', () => {
      expect(fs.existsSync(packageJsonPath)).toBe(true);
    });

    it('should have lucide-react in dependencies', () => {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      expect(packageJson.dependencies).toHaveProperty('lucide-react');
    });
  });
});

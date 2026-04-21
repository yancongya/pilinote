import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkSlug from 'remark-slug';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

type Props = {
  content: string;
  onHeadingClick?: (id: string) => void;
};

// Helper: prefix image src with base URL if needed
function fixSrc(src: string, baseURL: string): string {
  if (!src) return src;
  if (src.startsWith('/')) {
    // If you have a known API base, you can set it via env var VITE_API_BASE_URL
    const base = baseURL.replace(/\/$/, '');
    return `${base}${src}`;
  }
  return src;
}

export function MarkdownRenderer({ content, onHeadingClick }: Props) {
  // 基础 API 基地址（如有）从 env 读取，默认空字符串
  const baseURL = (typeof import.meta !== 'undefined' && (import.meta.env as any).VITE_API_BASE_URL) || '';

  const components = {
    a: ({ href, children, ...rest }: any) => {
      // 内部锚点跳转
      if (href?.startsWith('#')) {
        const id = href.substring(1);
        return (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              onHeadingClick?.(id);
            }}
            {...rest}
          >
            {children}
          </a>
        );
      }
      // 外部链接
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
          {children}
        </a>
      );
    },
    img: ({ src, alt, ...rest }: any) => (
      <img
        src={src ? fixSrc(src, baseURL) : ''}
        alt={alt ?? ''}
        style={{ maxWidth: '100%', display: 'block' }}
        {...rest}
      />
    ),
    code: ({ inline, className, children, ...rest }: any) => {
      if (inline) {
        return (
          <code
            style={{
              background: 'rgba(0,0,0,0.05)',
              padding: '2px 6px',
              borderRadius: 4,
            }}
            {...rest}
          >
            {children}
          </code>
        );
      }
      const language = (className || '').replace('language-', '');
      return (
        <SyntaxHighlighter style={atomDark} language={language} PreTag="div" {...rest}>
          {String(children).trim()}
        </SyntaxHighlighter>
      );
    },
  } as any;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkSlug, remarkMath]}
      // KaTeX for math rendering
      rehypePlugins={[rehypeKatex]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}

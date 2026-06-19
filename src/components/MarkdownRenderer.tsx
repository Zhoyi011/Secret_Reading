import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-body prose max-w-none text-gray-800 leading-relaxed">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

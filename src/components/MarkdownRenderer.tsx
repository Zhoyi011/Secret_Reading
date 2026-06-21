import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-body prose max-w-none text-gray-800 leading-relaxed">
      <ReactMarkdown
        components={{
          img: ({ node, ...props }) => (
            <span className="block my-6 text-center">
              <img
                {...props}
                className="mx-auto rounded-2xl max-w-full h-auto object-contain shadow-xs border border-gray-150/80 max-h-[550px] transition-all hover:shadow-sm"
                loading="lazy"
                referrerPolicy="no-referrer"
                style={{ imageRendering: 'auto' }}
              />
              {props.alt && (
                <span className="block text-[11px] text-gray-400 mt-2 font-medium">
                  {props.alt}
                </span>
              )}
            </span>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

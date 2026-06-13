"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

type CreatorDocsContentProps = {
  markdown: string;
};

export default function CreatorDocsContent({ markdown }: CreatorDocsContentProps) {
  return (
    <article className="creator-docs prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-4 mt-8 text-2xl font-semibold text-white first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-8 border-b border-white/10 pb-2 text-xl font-semibold text-white">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-6 text-lg font-medium text-[#F0F0F4]">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mb-4 leading-relaxed text-[#C8C8D4]">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 list-disc space-y-2 pl-6 text-[#C8C8D4]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal space-y-2 pl-6 text-[#C8C8D4]">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-[#FFFF00] underline hover:text-[#E6E600]">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-4 border-[#FFFF00] bg-[#0E0E12] py-2 pl-4 text-[#C8C8D4]">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-8 border-white/10" />,
          table: ({ children }) => (
            <div className="mb-6 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-white/10 text-left text-[#7A7A8E]">{children}</thead>
          ),
          th: ({ children }) => <th className="px-3 py-2 font-medium">{children}</th>,
          td: ({ children }) => (
            <td className="border-t border-white/5 px-3 py-2 text-[#C8C8D4]">{children}</td>
          ),
          code: ({ className, children }) => {
            const match = /language-(\w+)/.exec(className ?? "");
            const code = String(children).replace(/\n$/, "");

            if (match) {
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: "1rem 0",
                    borderRadius: "8px",
                    background: "#0E0E12",
                    border: "1px solid #2A2A38",
                    fontSize: "13px",
                  }}
                >
                  {code}
                </SyntaxHighlighter>
              );
            }

            return (
              <code className="rounded bg-[#0E0E12] px-1.5 py-0.5 font-mono text-sm text-[#FFFF00]">
                {children}
              </code>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}

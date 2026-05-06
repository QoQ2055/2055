import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownView({ content, className }: { content: string; className?: string }) {
  return (
    <div className={`prose prose-invert prose-sm max-w-none ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h1 className="text-lg font-bold text-zinc-100 mt-4 mb-2" {...p} />,
          h2: (p) => <h2 className="text-base font-semibold text-brand-400 mt-4 mb-2" {...p} />,
          h3: (p) => <h3 className="text-sm font-semibold text-zinc-200 mt-3 mb-1.5" {...p} />,
          p:  (p) => <p className="text-sm leading-relaxed text-zinc-300 my-2" {...p} />,
          ul: (p) => <ul className="list-disc pl-5 my-2 text-sm text-zinc-300 space-y-1" {...p} />,
          ol: (p) => <ol className="list-decimal pl-5 my-2 text-sm text-zinc-300 space-y-1" {...p} />,
          blockquote: (p) => (
            <blockquote className="border-l-2 border-brand-500/60 pl-3 my-2 text-sm text-zinc-400 italic" {...p} />
          ),
          code: ({ className, children, ...rest }) => {
            const inline = !className;
            return inline
              ? <code className="px-1 py-0.5 rounded bg-zinc-800 text-[0.85em] text-brand-300" {...rest}>{children}</code>
              : <code className="block p-3 rounded bg-zinc-950 border border-zinc-800 text-xs overflow-auto" {...rest}>{children}</code>;
          },
          hr: () => <hr className="my-4 border-zinc-800" />,
          strong: (p) => <strong className="text-zinc-100 font-semibold" {...p} />,
          em: (p) => <em className="text-zinc-200" {...p} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

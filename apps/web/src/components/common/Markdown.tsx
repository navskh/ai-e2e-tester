import ReactMarkdown from 'react-markdown';

interface Props {
  children: string;
  className?: string;
}

export function Markdown({ children, className = '' }: Props) {
  return (
    <ReactMarkdown
      className={`markdown-body ${className}`}
      components={{
        h1: ({ children }) => <h1 className="text-lg font-bold text-gray-200 mt-4 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-semibold text-gray-200 mt-3 mb-1.5">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-300 mt-2 mb-1">{children}</h3>,
        p: ({ children }) => <p className="text-sm text-gray-400 mb-2 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside text-sm text-gray-400 mb-2 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside text-sm text-gray-400 mb-2 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="text-sm text-gray-400">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-gray-200">{children}</strong>,
        em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
        code: ({ className, children, ...props }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <pre className="bg-gray-900 border border-gray-800 rounded-lg p-3 overflow-auto my-2">
                <code className="text-xs text-green-400 font-mono">{children}</code>
              </pre>
            );
          }
          return (
            <code className="bg-gray-800 text-amber-400 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary-500 pl-3 my-2 text-gray-400 italic">{children}</blockquote>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300 underline">
            {children}
          </a>
        ),
        hr: () => <hr className="border-gray-800 my-3" />,
        table: ({ children }) => (
          <div className="overflow-auto my-2">
            <table className="text-xs text-gray-400 border-collapse w-full">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-gray-900">{children}</thead>,
        th: ({ children }) => <th className="border border-gray-800 px-2 py-1 text-left text-gray-300 font-medium">{children}</th>,
        td: ({ children }) => <td className="border border-gray-800 px-2 py-1">{children}</td>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

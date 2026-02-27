import ReactMarkdown from 'react-markdown'

interface Props {
  content: string
  className?: string
}

export default function MarkdownRenderer({ content, className = '' }: Props) {
  return (
    <div className={`prose max-w-none text-charcoal ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="text-2xl font-bold text-navy mb-4">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-semibold text-navy mb-3 mt-6">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-navy mb-2 mt-4">{children}</h3>,
          p: ({ children }) => <p className="text-sm text-charcoal mb-3 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-sm text-charcoal">{children}</li>,
          a: ({ href, children }) => (
            <a href={href} className="text-primark-blue hover:text-primark-blue-dark underline">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold text-navy">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primark-blue pl-4 italic text-mid-grey my-3">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-border-grey my-4" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

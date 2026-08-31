'use client';

import { Check, Copy } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { useState } from 'react';

export default function CodeBlockNodeView({ node }: NodeViewProps) {
  const [copied, setCopied] = useState(false);
  const lang = node.attrs.language || 'plaintext';

  const handleCopy = async () => {
    const codeText = node.textContent;
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <NodeViewWrapper
      className={cn(
        'code-block-wrapper group relative my-4',
        'rounded-md bg-zinc-950 font-mono text-sm'
      )}
    >
      <div
        className={cn(
          'absolute top-2 right-3 z-10 flex items-center gap-2',
          'opacity-40 transition-opacity duration-150 select-none group-hover:opacity-100'
        )}
      >
        {lang !== 'plaintext' && lang !== 'auto' && (
          <span
            className={cn(
              'border-border/40 rounded border bg-zinc-900 px-1.5',
              'py-0.5 font-sans text-[10px] font-bold tracking-widest text-zinc-300 uppercase shadow-sm'
            )}
          >
            {lang}
          </span>
        )}

        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'border-border/40 flex h-6 w-6 cursor-pointer items-center justify-center rounded',
            'border bg-zinc-900 text-zinc-300 shadow-sm transition-colors hover:bg-zinc-800 hover:text-zinc-100'
          )}
          title="Copy Code"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>

      <pre className="m-0 overflow-x-auto bg-transparent p-0 pt-4">
        <NodeViewContent as="div" className="block bg-transparent p-0" />
      </pre>
    </NodeViewWrapper>
  );
}

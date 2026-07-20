'use client';

import * as React from 'react';
import {
  useDropzone,
  type DropzoneOptions,
  type FileRejection,
} from 'react-dropzone';
import { UploadCloud } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

type DropzoneProps = Omit<DropzoneOptions, 'onDrop' | 'disabled'> & {
  onDrop: (acceptedFiles: File[], fileRejections: FileRejection[]) => void;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
};

/**
 * Accessible drag-and-drop file zone built on react-dropzone.
 * Compose with app upload logic; keep styling token-aligned.
 */
function Dropzone({
  onDrop,
  className,
  disabled = false,
  children,
  ...options
}: DropzoneProps) {
  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      disabled,
      ...options,
    });

  return (
    <div
      {...getRootProps({
        className: cn(
          'border-border bg-card text-card-foreground relative flex min-h-40 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center transition-colors sm:min-h-52 sm:px-6 sm:py-10',
          'hover:border-primary/50 hover:bg-muted/30',
          'focus-visible:ring-ring focus-visible:ring-3 focus-visible:outline-none',
          isDragActive && 'border-primary bg-primary/5',
          isDragReject && 'border-destructive bg-destructive/5',
          disabled && 'pointer-events-none opacity-50',
          className
        ),
      })}
    >
      <input {...getInputProps()} />
      {children ?? (
        <>
          <div className="bg-muted flex size-10 items-center justify-center rounded-full sm:size-12">
            <UploadCloud className="text-muted-foreground size-5 sm:size-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium sm:text-base">
              {isDragActive
                ? 'Drop files to upload'
                : 'Drag and drop files here'}
            </p>
            <p className="text-muted-foreground text-xs sm:text-sm">
              or click to browse from your device
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export { Dropzone };
export type { DropzoneProps, FileRejection };

'use client';

import { useState, useEffect } from 'react';
import {
  Folder,
  File,
  RefreshCw,
  Download,
  ChevronRight,
  ChevronDown,
  X,
  FileText,
  FileCode,
  FileJson,
  Image,
  FileArchive,
  HardDrive,
  AlertCircle,
  Box,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileInfo {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  children?: FileInfo[];
}

interface FilesystemBrowserProps {
  sessionId: string;
  isStreaming?: boolean;
}

// Get file icon based on extension
function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'py':
    case 'rb':
    case 'go':
    case 'rs':
    case 'java':
    case 'c':
    case 'cpp':
    case 'h':
    case 'cs':
    case 'php':
    case 'swift':
    case 'kt':
      return FileCode;
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'xml':
      return FileJson;
    case 'md':
    case 'txt':
    case 'log':
    case 'csv':
      return FileText;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
    case 'ico':
      return Image;
    case 'zip':
    case 'tar':
    case 'gz':
    case 'rar':
    case '7z':
      return FileArchive;
    default:
      return File;
  }
}

// Get file type color
function getFileColor(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return 'text-yellow-500';
    case 'ts':
    case 'tsx':
      return 'text-blue-400';
    case 'py':
      return 'text-green-400';
    case 'json':
      return 'text-amber-400';
    case 'md':
      return 'text-sky-400';
    case 'css':
    case 'scss':
    case 'sass':
      return 'text-pink-400';
    case 'html':
      return 'text-orange-400';
    default:
      return 'text-muted-foreground';
  }
}

export function FilesystemBrowser({ sessionId, isStreaming = false }: FilesystemBrowserProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['/scratch']));
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [containerActive, setContainerActive] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    loadFiles();
  }, [sessionId]);

  // Auto-refresh during streaming
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      loadFiles(true); // Silent refresh (no loading state)
    }, 3000);

    return () => clearInterval(interval);
  }, [isStreaming, sessionId]);

  const loadFiles = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/chat/${sessionId}/files?path=/scratch`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load files');
      }

      setContainerActive(data.containerActive);
      setFiles(data.files || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load files');
      console.error('Failed to load files:', err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const toggleDirectory = (path: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  };

  const handleFileClick = async (file: FileInfo) => {
    if (file.type === 'directory') {
      toggleDirectory(file.path);
      return;
    }

    setSelectedFile(file);
    setFileContent(null);
    setContentLoading(true);

    try {
      const response = await fetch(
        `/api/chat/${sessionId}/files?path=${encodeURIComponent(file.path)}&action=content`
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to read file');
      }

      if (data.truncated) {
        setFileContent(`[File too large to display: ${data.message}]`);
      } else {
        setFileContent(data.content);
      }
    } catch (err: any) {
      setFileContent(`[Error loading file: ${err.message}]`);
      console.error('Failed to load file content:', err);
    } finally {
      setContentLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const downloadFile = async (file: FileInfo) => {
    try {
      // Fetch the file content if not already loaded
      let content = fileContent;
      if (!content) {
        const response = await fetch(
          `/api/chat/${sessionId}/files?path=${encodeURIComponent(file.path)}&action=content`
        );
        const data = await response.json();

        if (!data.success || data.truncated) {
          throw new Error(data.message || data.error || 'Failed to download file');
        }
        content = data.content;
      }

      const blob = new Blob([content || ''], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to download file:', err);
      alert(`Failed to download file: ${err.message}`);
    }
  };

  // Count total files recursively
  const countFiles = (items: FileInfo[]): number => {
    return items.reduce((count, item) => {
      if (item.type === 'file') return count + 1;
      if (item.children) return count + countFiles(item.children);
      return count;
    }, 0);
  };

  const totalFiles = countFiles(files);

  const renderFileTree = (items: FileInfo[], depth = 0) => {
    return items.map((item, index) => {
      const isExpanded = expandedDirs.has(item.path);
      const isSelected = selectedFile?.path === item.path;
      const FileIcon = item.type === 'directory' ? Folder : getFileIcon(item.name);
      const fileColor = item.type === 'directory' ? 'text-primary' : getFileColor(item.name);

      return (
        <div
          key={item.path}
          className="animate-fade-in"
          style={{ animationDelay: `${Math.min(index * 20, 100)}ms` }}
        >
          <button
            onClick={() => handleFileClick(item)}
            className={cn(
              "group w-full flex items-center gap-2 py-1.5 text-left rounded-md transition-all duration-150",
              "hover:bg-accent/40",
              isSelected && "bg-accent/60 hover:bg-accent/60"
            )}
            style={{ paddingLeft: `${depth * 14 + 10}px`, paddingRight: '10px' }}
          >
            {/* Chevron for directories */}
            {item.type === 'directory' ? (
              <div className={cn(
                "flex-shrink-0 w-4 h-4 flex items-center justify-center rounded transition-transform duration-200",
                isExpanded && "rotate-0",
                !isExpanded && "-rotate-90"
              )}>
                <ChevronDown className="w-3 h-3 text-muted-foreground/70" />
              </div>
            ) : (
              <span className="w-4 flex-shrink-0" />
            )}

            {/* File/folder icon with background */}
            <div className={cn(
              "flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-all duration-150",
              item.type === 'directory'
                ? "bg-primary/10"
                : "bg-muted/40 group-hover:bg-muted/60",
              isSelected && item.type !== 'directory' && "bg-accent"
            )}>
              <FileIcon className={cn("w-3.5 h-3.5", fileColor)} />
            </div>

            {/* File name */}
            <span className={cn(
              "flex-1 text-sm truncate transition-colors",
              isSelected ? "text-foreground font-medium" : "text-foreground/80 group-hover:text-foreground"
            )}>
              {item.name}
            </span>

            {/* File size badge */}
            {item.type === 'file' && (
              <span className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded transition-all",
                "bg-muted/30 text-muted-foreground/60",
                "group-hover:bg-muted/50 group-hover:text-muted-foreground"
              )}>
                {formatSize(item.size)}
              </span>
            )}
          </button>

          {/* Expanded children with connector line */}
          {item.type === 'directory' && isExpanded && item.children && (
            <div className="relative">
              <div
                className="absolute top-0 bottom-2 w-px bg-border/50"
                style={{ left: `${depth * 14 + 17}px` }}
              />
              {renderFileTree(item.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-background to-background/95">
      {/* Header */}
      <div className="relative flex items-center justify-between p-4 border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <HardDrive className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Scratch Files</h3>
            {containerActive && files.length > 0 && (
              <p className="text-[10px] text-muted-foreground/70">
                {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
              </p>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => loadFiles()}
          disabled={loading}
          className={cn(
            "h-8 w-8 p-0 rounded-lg transition-all",
            "hover:bg-accent/50 hover:text-foreground",
            loading && "text-primary"
          )}
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <div className="relative mb-4">
              <div className="w-10 h-10 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-primary animate-spin" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground/70">Loading files...</p>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
            <div className="relative mb-4">
              <div className="w-12 h-12 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
            </div>
            <p className="text-sm text-destructive font-medium mb-1">Failed to load</p>
            <p className="text-xs text-muted-foreground/70 max-w-[200px]">{error}</p>
          </div>
        ) : !containerActive ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-xl bg-muted/20 animate-pulse" style={{ animationDuration: '3s' }} />
              <div className="relative w-14 h-14 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-center">
                <Box className="w-6 h-6 text-muted-foreground/40" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground/70 font-medium mb-1">Container not started</p>
            <p className="text-xs text-muted-foreground/50 max-w-[180px]">
              Start a conversation to enable the sandbox
            </p>
          </div>
        ) : files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
            <div className="relative mb-4">
              <div className="w-14 h-14 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-center">
                <Folder className="w-6 h-6 text-muted-foreground/30" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground/70 max-w-[200px]">
              Files will appear here as the agent works
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {renderFileTree(files)}
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {selectedFile && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedFile(null)}
        >
          <div
            className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview Header */}
            <div className="relative flex items-center justify-between p-4 border-b border-border/50">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />

              <div className="relative flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center">
                  {(() => {
                    const FileIcon = getFileIcon(selectedFile.name);
                    return <FileIcon className={cn("w-4 h-4", getFileColor(selectedFile.name))} />;
                  })()}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{selectedFile.name}</h3>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {formatSize(selectedFile.size)} • {formatDate(selectedFile.modified)}
                  </p>
                </div>
              </div>

              <div className="relative flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadFile(selectedFile)}
                  className="h-8 px-3 rounded-lg text-xs border-border/50 hover:bg-accent/50"
                >
                  <Download className="w-3 h-3 mr-1.5" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                  className="h-8 w-8 p-0 rounded-lg hover:bg-accent/50"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {contentLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-10 h-10 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-center mb-3">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                  </div>
                  <span className="text-sm text-muted-foreground/70">Loading content...</span>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-muted/20 to-transparent pointer-events-none" />
                  <pre className="relative bg-background/50 border border-border/50 rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap text-foreground/90 max-h-[60vh]">
                    {fileContent || 'Empty file'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

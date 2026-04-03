"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Folder,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileImage,
  File,
  Loader2,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  modifiedTime: string | null;
  iconLink: string | null;
  isFolder: boolean;
}

interface BreadcrumbEntry {
  id: string;
  name: string;
}

interface DrivePickerProps {
  connectionId: string;
  open: boolean;
  onImport: (fileIds: string[]) => void;
  onClose: () => void;
}

function formatFileSize(sizeStr: string | null): string {
  if (!sizeStr) return "--";
  const bytes = parseInt(sizeStr, 10);
  if (isNaN(bytes)) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "--";
  }
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === "application/vnd.google-apps.folder") {
    return <Folder className="h-4 w-4 text-emerald-400" />;
  }
  if (
    mimeType.includes("document") ||
    mimeType.includes("word") ||
    mimeType === "text/plain" ||
    mimeType === "text/markdown"
  ) {
    return <FileText className="h-4 w-4 text-blue-400" />;
  }
  if (mimeType.includes("spreadsheet") || mimeType === "text/csv") {
    return <FileSpreadsheet className="h-4 w-4 text-green-400" />;
  }
  if (mimeType.includes("presentation")) {
    return <Presentation className="h-4 w-4 text-yellow-400" />;
  }
  if (mimeType.includes("image")) {
    return <FileImage className="h-4 w-4 text-purple-400" />;
  }
  if (mimeType === "application/pdf") {
    return <FileText className="h-4 w-4 text-red-400" />;
  }
  return <File className="h-4 w-4 text-muted-foreground" />;
}

export function DrivePicker({
  connectionId,
  open,
  onImport,
  onClose,
}: DrivePickerProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([
    { id: "root", name: "My Drive" },
  ]);

  const currentFolderId = breadcrumb[breadcrumb.length - 1].id;

  const fetchFiles = useCallback(
    async (folderId: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/integrations/drive/list?folderId=${encodeURIComponent(folderId)}&connectionId=${encodeURIComponent(connectionId)}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load files");
        }
        const data = await res.json();
        setFiles(data.files ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load files");
        setFiles([]);
      } finally {
        setLoading(false);
      }
    },
    [connectionId]
  );

  useEffect(() => {
    if (open) {
      fetchFiles(currentFolderId);
    }
  }, [open, currentFolderId, fetchFiles]);

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      setBreadcrumb([{ id: "root", name: "My Drive" }]);
    }
  }, [open]);

  const handleFolderClick = (folder: DriveFile) => {
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    setBreadcrumb((prev) => prev.slice(0, index + 1));
  };

  const handleGoBack = () => {
    if (breadcrumb.length > 1) {
      setBreadcrumb((prev) => prev.slice(0, -1));
    }
  };

  const toggleFile = (fileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const toggleAllFiles = () => {
    const nonFolderFiles = files.filter((f) => !f.isFolder);
    const allSelected = nonFolderFiles.every((f) => selectedIds.has(f.id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        nonFolderFiles.forEach((f) => next.delete(f.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        nonFolderFiles.forEach((f) => next.add(f.id));
        return next;
      });
    }
  };

  const selectFolder = (folder: DriveFile) => {
    // Select all non-folder children currently visible
    // (In practice this selects files in the current view; user can also drill in)
    const childFiles = files.filter((f) => !f.isFolder);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      childFiles.forEach((f) => next.add(f.id));
      return next;
    });
    // Also navigate into the folder
    handleFolderClick(folder);
  };

  const handleImport = () => {
    if (selectedIds.size > 0) {
      onImport(Array.from(selectedIds));
    }
  };

  const nonFolderFiles = files.filter((f) => !f.isFolder);
  const allNonFoldersSelected =
    nonFolderFiles.length > 0 &&
    nonFolderFiles.every((f) => selectedIds.has(f.id));

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import from Google Drive</DialogTitle>
          <DialogDescription>
            Browse and select files to import into your context library.
          </DialogDescription>
        </DialogHeader>

        {/* Breadcrumb navigation */}
        <div className="flex items-center gap-2">
          {breadcrumb.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={handleGoBack}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumb.map((entry, idx) => (
                <BreadcrumbItem key={entry.id}>
                  {idx < breadcrumb.length - 1 ? (
                    <>
                      <BreadcrumbLink
                        className="cursor-pointer text-xs"
                        onClick={() => handleBreadcrumbClick(idx)}
                      >
                        {entry.name}
                      </BreadcrumbLink>
                      <BreadcrumbSeparator>
                        <ChevronRight className="h-3 w-3" />
                      </BreadcrumbSeparator>
                    </>
                  ) : (
                    <span className="text-xs font-medium text-foreground">
                      {entry.name}
                    </span>
                  )}
                </BreadcrumbItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* File list */}
        <ScrollArea className="flex-1 min-h-0 rounded-md border border-border/50">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading...
              </span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : files.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                This folder is empty.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {/* Select all header for non-folder files */}
              {nonFolderFiles.length > 0 && (
                <div className="flex items-center gap-3 px-3 py-2 bg-muted/30">
                  <Checkbox
                    checked={allNonFoldersSelected}
                    onCheckedChange={toggleAllFiles}
                    aria-label="Select all files"
                  />
                  <span className="text-xs text-muted-foreground">
                    Select all files
                  </span>
                </div>
              )}

              {files.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 hover:bg-muted/40 transition-colors",
                    !file.isFolder &&
                      selectedIds.has(file.id) &&
                      "bg-emerald-500/5"
                  )}
                >
                  {file.isFolder ? (
                    <div className="h-4 w-4" /> // spacer to align with checkboxes
                  ) : (
                    <Checkbox
                      checked={selectedIds.has(file.id)}
                      onCheckedChange={() => toggleFile(file.id)}
                      aria-label={`Select ${file.name}`}
                    />
                  )}

                  <FileIcon mimeType={file.mimeType} />

                  {file.isFolder ? (
                    <button
                      className="flex-1 text-left text-sm font-medium hover:text-emerald-400 transition-colors truncate"
                      onClick={() => handleFolderClick(file)}
                    >
                      {file.name}
                    </button>
                  ) : (
                    <button
                      className="flex-1 text-left text-sm truncate"
                      onClick={() => toggleFile(file.id)}
                    >
                      {file.name}
                    </button>
                  )}

                  <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-16 text-right">
                    {file.isFolder ? "" : formatFileSize(file.size)}
                  </span>

                  <span className="text-xs text-muted-foreground shrink-0 w-24 text-right hidden sm:block">
                    {formatDate(file.modifiedTime)}
                  </span>

                  {file.isFolder && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => selectFolder(file)}
                      >
                        Select all
                      </Button>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer with import button */}
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedIds.size > 0 && (
              <Badge variant="secondary" className="font-mono">
                {selectedIds.size} selected
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={selectedIds.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Import Selected
              {selectedIds.size > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 bg-white/20 text-white hover:bg-white/20"
                >
                  {selectedIds.size}
                </Badge>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

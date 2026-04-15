"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LibraryShell, type ContextItem } from "@/components/library-shell";
import { LibrarySections } from "@/components/library-sections";
import { LibraryItemDetail } from "@/components/library-item-detail";

/* ---------- Types ---------- */

interface ContextLibraryTabsProps {
  items: ContextItem[];
  initialSearch: string;
  initialSource: string;
  initialFolder: string;
  initialType: string;
  initialTags: string;
  initialStatus: string;
  initialFrom: string;
  initialTo: string;
}

/* ---------- Component ---------- */

export function ContextLibraryTabs({
  items,
  initialSearch,
  initialSource,
  initialFolder,
  initialType,
  initialTags,
  initialStatus,
  initialFrom,
  initialTo,
}: ContextLibraryTabsProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] min-h-0">
      <Tabs defaultValue="finder" className="flex flex-col flex-1 min-h-0">
        <div className="px-4 sm:px-6 pt-4 sm:pt-6">
          <TabsList>
            <TabsTrigger value="finder">Finder</TabsTrigger>
            <TabsTrigger value="browse">Browse</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="finder" className="flex-1 min-h-0 mt-0">
          <LibraryShell
            items={items}
            initialSearch={initialSearch}
            initialSource={initialSource}
            initialFolder={initialFolder}
            initialType={initialType}
            initialTags={initialTags}
            initialStatus={initialStatus}
            initialFrom={initialFrom}
            initialTo={initialTo}
          />
        </TabsContent>

        <TabsContent value="browse" className="flex-1 min-h-0 mt-0 px-4 sm:px-6 pb-6">
          <LibrarySections onItemClick={(id) => setSelectedItemId(id)} />
        </TabsContent>
      </Tabs>

      {selectedItemId && (
        <LibraryItemDetail
          itemId={selectedItemId}
          onClose={() => setSelectedItemId(null)}
        />
      )}
    </div>
  );
}

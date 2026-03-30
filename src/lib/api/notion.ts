import { Client } from '@notionhq/client';
import type {
  BlockObjectResponse,
  DataSourceObjectResponse,
  PageObjectResponse,
  QueryDataSourceParameters,
  RichTextItemResponse,
  SearchResponse,
} from '@notionhq/client/build/src/api-endpoints';
import type { IngestableRecord, ProviderClient } from './types';

export interface NotionSearchResult {
  id: string;
  title: string;
  object: 'page' | 'data_source';
  created_time: string;
  last_edited_time: string;
  url: string;
}

export class NotionClient implements ProviderClient {
  readonly provider = 'notion';
  private client: Client;

  constructor(token: string) {
    this.client = new Client({ auth: token });
  }

  /** Search across all shared pages and data sources (databases) */
  async search(query?: string, limit = 20): Promise<NotionSearchResult[]> {
    const response: SearchResponse = await this.client.search({
      query: query || undefined,
      page_size: limit,
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
    });

    return response.results
      .filter(
        (r): r is PageObjectResponse | DataSourceObjectResponse =>
          r.object === 'page' || r.object === 'data_source',
      )
      .map((result) => ({
        id: result.id,
        title: this.extractTitle(result),
        object: result.object as 'page' | 'data_source',
        created_time: result.created_time,
        last_edited_time: result.last_edited_time,
        url: result.url,
      }));
  }

  /** Get a page's content by fetching its blocks and flattening to text */
  async getPageContent(pageId: string): Promise<string> {
    const allBlocks: BlockObjectResponse[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.client.blocks.children.list({
        block_id: pageId,
        page_size: 100,
        start_cursor: cursor,
      });

      const blocks = response.results.filter(
        (b): b is BlockObjectResponse => 'type' in b,
      );
      allBlocks.push(...blocks);

      cursor = response.has_more
        ? (response.next_cursor ?? undefined)
        : undefined;
    } while (cursor);

    return this.flattenBlocks(allBlocks);
  }

  /** Query a data source (database) with optional filters */
  async queryDatabase(
    dataSourceId: string,
    filter?: QueryDataSourceParameters['filter'],
  ): Promise<NotionSearchResult[]> {
    const response = await this.client.dataSources.query({
      data_source_id: dataSourceId,
      ...(filter ? { filter } : {}),
      page_size: 100,
    });

    return response.results
      .filter((r): r is PageObjectResponse => r.object === 'page')
      .map((page) => ({
        id: page.id,
        title: this.extractPageTitle(page),
        object: 'page' as const,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
        url: page.url,
      }));
  }

  /** ProviderClient: list all shared pages as IngestableRecords */
  async list(options?: {
    since?: string;
    limit?: number;
  }): Promise<IngestableRecord[]> {
    const results = await this.search(undefined, options?.limit ?? 30);
    const records: IngestableRecord[] = [];

    // Filter to pages only (data sources are containers, not content)
    const pages = results.filter((r) => r.object === 'page');

    // Optionally filter by date
    const filteredPages = options?.since
      ? pages.filter((p) => p.last_edited_time >= options.since!)
      : pages;

    for (const page of filteredPages) {
      try {
        const content = await this.getPageContent(page.id);
        if (content.length < 30) continue;

        records.push({
          source_id: page.id,
          source_type: 'notion',
          content_type: 'document',
          title: page.title || 'Untitled',
          raw_content: content.slice(0, 12000),
          source_created_at: page.created_time,
          source_metadata: {
            last_edited_time: page.last_edited_time,
            url: page.url,
          },
        });
      } catch {
        // Skip pages we can't read (permission issues, deleted, etc.)
        continue;
      }
    }

    return records;
  }

  /** ProviderClient: get single page as IngestableRecord */
  async get(id: string): Promise<IngestableRecord | null> {
    try {
      const page = await this.client.pages.retrieve({ page_id: id });

      if (!('created_time' in page)) return null;
      const fullPage = page as PageObjectResponse;

      const content = await this.getPageContent(id);
      if (content.length < 30) return null;

      return {
        source_id: fullPage.id,
        source_type: 'notion',
        content_type: 'document',
        title: this.extractPageTitle(fullPage),
        raw_content: content.slice(0, 12000),
        source_created_at: fullPage.created_time,
        source_metadata: {
          last_edited_time: fullPage.last_edited_time,
          url: fullPage.url,
        },
      };
    } catch {
      return null;
    }
  }

  /** Extract title from a page or data source object */
  private extractTitle(
    obj: PageObjectResponse | DataSourceObjectResponse,
  ): string {
    if (obj.object === 'data_source') {
      return this.richTextToPlain((obj as DataSourceObjectResponse).title);
    }
    return this.extractPageTitle(obj as PageObjectResponse);
  }

  /** Extract title from a page's properties */
  private extractPageTitle(page: PageObjectResponse): string {
    const props = page.properties;
    for (const prop of Object.values(props)) {
      if (prop.type === 'title') {
        return this.richTextToPlain(prop.title);
      }
    }
    return 'Untitled';
  }

  /** Convert rich text array to plain text */
  private richTextToPlain(richText: RichTextItemResponse[]): string {
    return richText.map((rt) => rt.plain_text).join('');
  }

  /** Flatten Notion blocks to plain text */
  private flattenBlocks(blocks: BlockObjectResponse[]): string {
    const lines: string[] = [];

    for (const block of blocks) {
      const text = this.blockToText(block);
      if (text !== null) {
        lines.push(text);
      }
    }

    return lines.join('\n');
  }

  /** Convert a single block to a text line */
  private blockToText(block: BlockObjectResponse): string | null {
    const type = block.type;

    switch (type) {
      case 'paragraph':
        return this.richTextToPlain(block.paragraph.rich_text);

      case 'heading_1':
        return `# ${this.richTextToPlain(block.heading_1.rich_text)}`;

      case 'heading_2':
        return `## ${this.richTextToPlain(block.heading_2.rich_text)}`;

      case 'heading_3':
        return `### ${this.richTextToPlain(block.heading_3.rich_text)}`;

      case 'heading_4':
        return `#### ${this.richTextToPlain(block.heading_4.rich_text)}`;

      case 'bulleted_list_item':
        return `- ${this.richTextToPlain(block.bulleted_list_item.rich_text)}`;

      case 'numbered_list_item':
        return `1. ${this.richTextToPlain(block.numbered_list_item.rich_text)}`;

      case 'to_do': {
        const checked = block.to_do.checked ? '[x]' : '[ ]';
        return `${checked} ${this.richTextToPlain(block.to_do.rich_text)}`;
      }

      case 'toggle':
        return this.richTextToPlain(block.toggle.rich_text);

      case 'code':
        return `\`\`\`${block.code.language}\n${this.richTextToPlain(block.code.rich_text)}\n\`\`\``;

      case 'quote':
        return `> ${this.richTextToPlain(block.quote.rich_text)}`;

      case 'callout':
        return `> ${this.richTextToPlain(block.callout.rich_text)}`;

      case 'divider':
        return '---';

      case 'table_of_contents':
      case 'breadcrumb':
      case 'column_list':
      case 'column':
        return null;

      case 'image':
      case 'video':
      case 'file':
      case 'pdf':
        return `[${type}]`;

      case 'bookmark':
        return block.bookmark.url || null;

      case 'link_preview':
        return block.link_preview.url || null;

      case 'equation':
        return block.equation.expression;

      case 'table_row':
        return block.table_row.cells
          .map((cell) => this.richTextToPlain(cell))
          .join(' | ');

      default:
        return null;
    }
  }
}

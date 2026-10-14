import type { PaginationInput } from '@polycanvas/graphql';
import { Store } from '@toeverything/infra';

export class EmbeddingStore extends Store {
  constructor() {
    super();
  }

  async getEnabled(_workspaceId: string, _signal?: AbortSignal) {
    return false;
  }

  async updateEnabled(
    _workspaceId: string,
    _enabled: boolean,
    _signal?: AbortSignal
  ) {
    return undefined;
  }

  async getIgnoredDocs(_workspaceId: string, _signal?: AbortSignal) {
    return [];
  }

  async updateIgnoredDocs(
    _workspaceId: string,
    _add: string[],
    _remove: string[],
    _signal?: AbortSignal
  ) {
    return undefined;
  }

  async addEmbeddingFile(
    _workspaceId: string,
    _blob: File,
    _signal?: AbortSignal
  ) {
    return undefined;
  }

  async addEmbeddingFiles(
    _workspaceId: string,
    _files: File[],
    _signal?: AbortSignal
  ) {
    return undefined;
  }

  async removeEmbeddingFile(
    _workspaceId: string,
    _fileId: string,
    _signal?: AbortSignal
  ) {
    return undefined;
  }

  async removeEmbeddingFiles(
    _workspaceId: string,
    _fileIds: string[],
    _signal?: AbortSignal
  ) {
    return undefined;
  }

  async getEmbeddingFiles(
    _workspaceId: string,
    _pagination: PaginationInput,
    _signal?: AbortSignal
  ) {
    return { files: [], totalCount: 0 };
  }

  async getEmbeddingProgress(_workspaceId: string, _signal?: AbortSignal) {
    return undefined;
  }
}

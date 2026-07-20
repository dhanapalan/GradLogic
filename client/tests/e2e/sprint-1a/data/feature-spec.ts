/**
 * Shared feature expectation shape for hub audits (Learning / Assessment / AI Studio).
 */
export type FeatureSpec = {
  search?: { required: boolean; placeholder?: RegExp };
  filters?: { required: boolean; hints?: RegExp[] };
  listOrContent?: { required: boolean; hints?: RegExp[] };
  pagination?: { required: boolean };
  create?: { required: boolean; name?: RegExp };
  secondaryTabs?: { required: boolean; sample?: RegExp };
  rowActions?: { required: boolean; name?: RegExp; softIfEmpty?: boolean };
  emptyState?: { acceptable: boolean; hints?: RegExp[] };
  sort?: { required: boolean };
  exportImport?: { required: boolean };
};

export type HubPageFeatures = {
  id: string;
  label: string;
  path: string;
  /** Used in expected browser title: GradLogic | <hubTitle> | <pageName> */
  pageName: string;
  expectedHeading: RegExp;
  duplicateOf?: string;
  /** Alias note — e.g. AI Studio entry that points at Learning Companion */
  aliasOf?: string;
  features: FeatureSpec;
};

export interface AeroSpaceConfig {
  'after-login-command'?: string[];
  'after-startup-command'?: string[];
  'start-at-login'?: boolean;
  'enable-normalization-flatten-containers'?: boolean;
  'enable-normalization-opposite-orientation-for-nested-containers'?: boolean;
  'accordion-padding'?: number;
  'default-root-container-layout'?: 'tiles' | 'accordion';
  'default-root-container-orientation'?: 'horizontal' | 'vertical' | 'auto';
  'key-mapping'?: { preset: 'qwerty' | 'dvorak' };
  'exec-on-workspace-change'?: string[];
  'on-focus-changed'?: string[];
  gaps: ComplexGap;
  exec: ExecConfig;
  mode: Record<string, BindingMode>;
  'on-window-detected': WindowDetectionRule[];
}

export type GapPattern = { monitor: Record<string, number> } | number;

export interface ComplexGap {
  inner?:
    | {
        horizontal: number | GapPattern[];
        vertical: number | GapPattern[];
      }
    | undefined;
  outer: {
    left?: number | GapPattern[];
    bottom?: number | GapPattern[];
    top?: number | GapPattern[];
    right?: number | GapPattern[];
  };
}

export interface Gaps {
  inner: { horizontal: number; vertical: number };
  outer: { left: number; bottom: number; top: number; right: number };
}

export interface ExecConfig {
  'inherit-env-vars': boolean;
  'env-vars': Record<string, string>;
}

export interface BindingMode {
  binding: Record<string, string | string[]>;
}

export interface WindowDetectionRule {
  if: {
    'app-id'?: string;
    'window-title-regex-substring'?: string;
    'app-name-regex-substring'?: string;
    workspace?: string;
  };
  'check-further-callbacks'?: boolean;
  run: string | string[];
}

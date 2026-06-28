import { theme as antdTheme, type ThemeConfig } from 'antd';
import type { UiTheme } from './types';

const sansStack =
  '"Inter Variable", "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", helvetica, Arial, sans-serif';

const sharedComponents: NonNullable<ThemeConfig['components']> = {
  Button: {
    borderRadius: 6,
    borderRadiusLG: 6,
    borderRadiusSM: 6,
    controlHeight: 36,
    controlHeightSM: 28,
    primaryShadow: 'none',
    defaultShadow: 'none',
    contentFontSize: 14,
    fontWeight: 510,
  },
  Card: {
    borderRadiusLG: 8,
    headerFontSize: 16,
    headerFontSizeSM: 14,
  },
  Input: {
    controlHeight: 40,
    borderRadius: 6,
    borderRadiusLG: 6,
    borderRadiusSM: 4,
  },
  InputNumber: {
    borderRadius: 6,
  },
  Select: {
    controlHeight: 40,
    borderRadius: 6,
  },
  Tabs: {
    titleFontSize: 14,
  },
  Modal: {
    titleFontSize: 18,
    borderRadiusLG: 12,
  },
  Tag: {
    borderRadiusSM: 9999,
  },
  Timeline: {
    dotBorderWidth: 2,
  },
  Alert: {
    borderRadiusLG: 8,
  },
  Form: {
    labelFontSize: 13,
  },
};

// One semantic color per role; light and dark differ only in these values.
// Every component/token below reads from this palette, so each color is named
// once instead of duplicated across both themes.
const lightPalette = {
  algorithm: antdTheme.defaultAlgorithm,
  primary: '#5e6ad2',
  primaryHover: '#828fff',
  primaryActive: '#5e6ad2',
  link: '#7170ff',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  text: '#08090a',
  textSecondary: '#3c4149',
  textTertiary: '#6b7280',
  textQuaternary: '#9ca3af',
  onPrimary: '#ffffff',
  bgBase: '#ffffff',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  bgLayout: '#ffffff',
  bgSpotlight: '#f7f8f8',
  border: '#e6e6e6',
  borderSecondary: 'rgba(0, 0, 0, 0.05)',
  fill: 'rgba(0, 0, 0, 0.04)',
  fillSecondary: 'rgba(0, 0, 0, 0.02)',
  fillTertiary: 'rgba(0, 0, 0, 0.02)',
  fillQuaternary: 'rgba(0, 0, 0, 0.02)',
  boxShadow: 'rgba(0, 0, 0, 0.06) 0px 0px 0px 1px',
  boxShadowSecondary: 'rgba(0, 0, 0, 0.08) 0px 2px 4px',
  boxShadowTertiary: 'rgba(0, 0, 0, 0.03) 0px 1.2px 0px 0px',
  controlOutline: 'rgba(113, 112, 255, 0.15)',
  inputHoverBorder: '#d0d6e0',
  optionSelectedBg: 'rgba(113, 112, 255, 0.1)',
  optionActiveBg: 'rgba(0, 0, 0, 0.04)',
  rowHoverBg: 'rgba(0, 0, 0, 0.04)',
  timelineTail: 'rgba(0, 0, 0, 0.08)',
};

const darkPalette: typeof lightPalette = {
  algorithm: antdTheme.darkAlgorithm,
  primary: '#8ea2ff',
  primaryHover: '#bbc6ff',
  primaryActive: '#7b91ff',
  link: '#9dacff',
  success: '#34d399',
  warning: '#fbbf24',
  error: '#f87171',
  text: '#edf2f7',
  textSecondary: '#c6d0dd',
  textTertiary: '#97a3b6',
  textQuaternary: '#738096',
  onPrimary: '#0d1117',
  bgBase: '#0d1117',
  surface: '#141a22',
  surfaceRaised: '#171f29',
  bgLayout: '#0d1117',
  bgSpotlight: '#1b2430',
  border: '#293241',
  borderSecondary: 'rgba(255, 255, 255, 0.08)',
  fill: 'rgba(255, 255, 255, 0.08)',
  fillSecondary: 'rgba(255, 255, 255, 0.04)',
  fillTertiary: 'rgba(255, 255, 255, 0.03)',
  fillQuaternary: 'rgba(255, 255, 255, 0.02)',
  boxShadow: 'rgba(0, 0, 0, 0.35) 0px 0px 0px 1px',
  boxShadowSecondary: 'rgba(0, 0, 0, 0.45) 0px 8px 24px',
  boxShadowTertiary: 'rgba(0, 0, 0, 0.24) 0px 1.2px 0px 0px',
  controlOutline: 'rgba(142, 162, 255, 0.22)',
  inputHoverBorder: '#3a4659',
  optionSelectedBg: 'rgba(142, 162, 255, 0.16)',
  optionActiveBg: 'rgba(255, 255, 255, 0.06)',
  rowHoverBg: 'rgba(255, 255, 255, 0.04)',
  timelineTail: 'rgba(255, 255, 255, 0.12)',
};

type Palette = typeof lightPalette;

function buildTheme(p: Palette): ThemeConfig {
  const activeShadow = `0 0 0 3px ${p.controlOutline}`;
  return {
    algorithm: p.algorithm,
    token: {
      colorPrimary: p.primary,
      colorLink: p.link,
      colorLinkHover: p.primaryHover,
      colorSuccess: p.success,
      colorWarning: p.warning,
      colorError: p.error,
      colorInfo: p.link,
      colorText: p.text,
      colorTextSecondary: p.textSecondary,
      colorTextTertiary: p.textTertiary,
      colorTextQuaternary: p.textQuaternary,
      colorTextLightSolid: p.onPrimary,
      colorBgBase: p.bgBase,
      colorBgContainer: p.surface,
      colorBgElevated: p.surfaceRaised,
      colorBgLayout: p.bgLayout,
      colorBgSpotlight: p.bgSpotlight,
      colorBorder: p.border,
      colorBorderSecondary: p.borderSecondary,
      colorFill: p.fill,
      colorFillSecondary: p.fillSecondary,
      colorFillTertiary: p.fillTertiary,
      colorFillQuaternary: p.fillQuaternary,
      borderRadius: 6,
      borderRadiusLG: 8,
      borderRadiusSM: 4,
      borderRadiusXS: 2,
      fontFamily: sansStack,
      fontSize: 14,
      lineHeight: 1.5,
      boxShadow: p.boxShadow,
      boxShadowSecondary: p.boxShadowSecondary,
      boxShadowTertiary: p.boxShadowTertiary,
      controlOutline: p.controlOutline,
      controlOutlineWidth: 3,
      wireframe: false,
    },
    components: {
      ...sharedComponents,
      Layout: {
        headerBg: p.surface,
        bodyBg: p.bgLayout,
        triggerBg: p.surface,
      },
      Button: {
        ...sharedComponents.Button,
        defaultBg: p.surfaceRaised,
        defaultColor: p.text,
        defaultBorderColor: p.border,
        primaryColor: p.onPrimary,
        colorPrimary: p.primary,
        colorPrimaryHover: p.primaryHover,
        colorPrimaryActive: p.primaryActive,
      },
      Card: {
        ...sharedComponents.Card,
        colorBgContainer: p.surface,
      },
      Input: {
        ...sharedComponents.Input,
        activeBorderColor: p.link,
        hoverBorderColor: p.inputHoverBorder,
        activeShadow,
        colorBgContainer: p.surfaceRaised,
        colorTextPlaceholder: p.textQuaternary,
      },
      InputNumber: {
        ...sharedComponents.InputNumber,
        activeBorderColor: p.link,
        hoverBorderColor: p.inputHoverBorder,
        activeShadow,
      },
      Select: {
        ...sharedComponents.Select,
        activeBorderColor: p.link,
        hoverBorderColor: p.inputHoverBorder,
        optionSelectedBg: p.optionSelectedBg,
        optionActiveBg: p.optionActiveBg,
        colorBgContainer: p.surfaceRaised,
      },
      Tabs: {
        ...sharedComponents.Tabs,
        itemColor: p.textTertiary,
        itemHoverColor: p.text,
        itemSelectedColor: p.text,
        inkBarColor: p.link,
      },
      Table: {
        headerBg: 'transparent',
        rowHoverBg: p.rowHoverBg,
        headerColor: p.textTertiary,
        borderColor: p.borderSecondary,
        colorBgContainer: 'transparent',
      },
      Modal: {
        ...sharedComponents.Modal,
        contentBg: p.surface,
        headerBg: p.surface,
        footerBg: p.surface,
        titleColor: p.text,
      },
      Drawer: {
        colorBgElevated: p.surface,
      },
      Popover: {
        colorBgElevated: p.surfaceRaised,
      },
      Notification: {
        colorBgElevated: p.surfaceRaised,
      },
      Breadcrumb: {
        linkColor: p.textTertiary,
        itemColor: p.textTertiary,
        lastItemColor: p.text,
        separatorColor: p.textQuaternary,
      },
      Typography: {
        titleMarginBottom: '0.5em',
        titleMarginTop: 0,
        colorLink: p.link,
        colorLinkHover: p.primaryHover,
      },
      Tag: {
        ...sharedComponents.Tag,
        colorBorder: p.border,
      },
      Timeline: {
        ...sharedComponents.Timeline,
        tailColor: p.timelineTail,
      },
      // ponytail: light previously omitted colorBgContainer here (inherited);
      // setting it to surface matches dark and is invisible on a white card.
      List: {
        colorBgContainer: p.surface,
        colorBorder: p.borderSecondary,
      },
      Empty: {
        colorTextDisabled: p.textQuaternary,
      },
      Spin: {
        colorPrimary: p.link,
      },
      Form: {
        ...sharedComponents.Form,
        labelColor: p.textSecondary,
      },
      Checkbox: {
        colorPrimary: p.primary,
        colorPrimaryHover: p.primaryHover,
      },
      Radio: {
        colorPrimary: p.primary,
      },
      Switch: {
        colorPrimary: p.primary,
      },
    },
  };
}

export function buildAntdTheme(mode: UiTheme): ThemeConfig {
  return mode === 'dark' ? buildTheme(darkPalette) : buildTheme(lightPalette);
}

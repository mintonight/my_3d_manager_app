import { theme as antdTheme, type ThemeConfig } from 'antd';
import type { UiTheme } from './types';

const sansStack =
  '"Inter Variable", "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", helvetica, Arial, sans-serif';

const sharedComponents: ThemeConfig['components'] = {
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

const lightTheme: ThemeConfig = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#5e6ad2',
    colorLink: '#7170ff',
    colorLinkHover: '#828fff',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#7170ff',
    colorText: '#08090a',
    colorTextSecondary: '#3c4149',
    colorTextTertiary: '#6b7280',
    colorTextQuaternary: '#9ca3af',
    colorTextLightSolid: '#ffffff',
    colorBgBase: '#ffffff',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#ffffff',
    colorBgSpotlight: '#f7f8f8',
    colorBorder: '#e6e6e6',
    colorBorderSecondary: 'rgba(0, 0, 0, 0.05)',
    colorFill: 'rgba(0, 0, 0, 0.04)',
    colorFillSecondary: 'rgba(0, 0, 0, 0.02)',
    colorFillTertiary: 'rgba(0, 0, 0, 0.02)',
    colorFillQuaternary: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    borderRadiusXS: 2,
    fontFamily: sansStack,
    fontSize: 14,
    lineHeight: 1.5,
    boxShadow: 'rgba(0, 0, 0, 0.06) 0px 0px 0px 1px',
    boxShadowSecondary: 'rgba(0, 0, 0, 0.08) 0px 2px 4px',
    boxShadowTertiary: 'rgba(0, 0, 0, 0.03) 0px 1.2px 0px 0px',
    controlOutline: 'rgba(113, 112, 255, 0.15)',
    controlOutlineWidth: 3,
    wireframe: false,
  },
  components: {
    ...sharedComponents,
    Layout: {
      headerBg: '#ffffff',
      bodyBg: '#ffffff',
      triggerBg: '#ffffff',
    },
    Button: {
      ...sharedComponents.Button,
      defaultBg: '#ffffff',
      defaultColor: '#08090a',
      defaultBorderColor: '#e6e6e6',
      primaryColor: '#ffffff',
      colorPrimary: '#5e6ad2',
      colorPrimaryHover: '#828fff',
      colorPrimaryActive: '#5e6ad2',
    },
    Card: {
      ...sharedComponents.Card,
      colorBgContainer: '#ffffff',
    },
    Input: {
      ...sharedComponents.Input,
      activeBorderColor: '#7170ff',
      hoverBorderColor: '#d0d6e0',
      activeShadow: '0 0 0 3px rgba(113, 112, 255, 0.15)',
      colorBgContainer: '#ffffff',
      colorTextPlaceholder: '#9ca3af',
    },
    InputNumber: {
      ...sharedComponents.InputNumber,
      activeBorderColor: '#7170ff',
      hoverBorderColor: '#d0d6e0',
      activeShadow: '0 0 0 3px rgba(113, 112, 255, 0.15)',
    },
    Select: {
      ...sharedComponents.Select,
      activeBorderColor: '#7170ff',
      hoverBorderColor: '#d0d6e0',
      optionSelectedBg: 'rgba(113, 112, 255, 0.1)',
      optionActiveBg: 'rgba(0, 0, 0, 0.04)',
      colorBgContainer: '#ffffff',
    },
    Tabs: {
      ...sharedComponents.Tabs,
      itemColor: '#6b7280',
      itemHoverColor: '#08090a',
      itemSelectedColor: '#08090a',
      inkBarColor: '#7170ff',
    },
    Table: {
      headerBg: 'transparent',
      rowHoverBg: 'rgba(0, 0, 0, 0.04)',
      headerColor: '#6b7280',
      borderColor: 'rgba(0, 0, 0, 0.05)',
      colorBgContainer: 'transparent',
    },
    Modal: {
      ...sharedComponents.Modal,
      contentBg: '#ffffff',
      headerBg: '#ffffff',
      footerBg: '#ffffff',
      titleColor: '#08090a',
    },
    Drawer: {
      colorBgElevated: '#ffffff',
    },
    Popover: {
      colorBgElevated: '#ffffff',
    },
    Notification: {
      colorBgElevated: '#ffffff',
    },
    Breadcrumb: {
      linkColor: '#6b7280',
      itemColor: '#6b7280',
      lastItemColor: '#08090a',
      separatorColor: '#9ca3af',
    },
    Typography: {
      titleMarginBottom: '0.5em',
      titleMarginTop: 0,
      colorLink: '#7170ff',
      colorLinkHover: '#828fff',
    },
    Tag: {
      ...sharedComponents.Tag,
      colorBorder: '#e6e6e6',
    },
    Timeline: {
      ...sharedComponents.Timeline,
      tailColor: 'rgba(0, 0, 0, 0.08)',
    },
    List: {
      colorBorder: 'rgba(0, 0, 0, 0.05)',
    },
    Empty: {
      colorTextDisabled: '#9ca3af',
    },
    Spin: {
      colorPrimary: '#7170ff',
    },
    Form: {
      ...sharedComponents.Form,
      labelColor: '#3c4149',
    },
    Checkbox: {
      colorPrimary: '#5e6ad2',
      colorPrimaryHover: '#828fff',
    },
    Radio: {
      colorPrimary: '#5e6ad2',
    },
    Switch: {
      colorPrimary: '#5e6ad2',
    },
  },
};

const darkTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: '#8ea2ff',
    colorLink: '#9dacff',
    colorLinkHover: '#bbc6ff',
    colorSuccess: '#34d399',
    colorWarning: '#fbbf24',
    colorError: '#f87171',
    colorInfo: '#9dacff',
    colorText: '#edf2f7',
    colorTextSecondary: '#c6d0dd',
    colorTextTertiary: '#97a3b6',
    colorTextQuaternary: '#738096',
    colorTextLightSolid: '#0d1117',
    colorBgBase: '#0d1117',
    colorBgContainer: '#141a22',
    colorBgElevated: '#171f29',
    colorBgLayout: '#0d1117',
    colorBgSpotlight: '#1b2430',
    colorBorder: '#293241',
    colorBorderSecondary: 'rgba(255, 255, 255, 0.08)',
    colorFill: 'rgba(255, 255, 255, 0.08)',
    colorFillSecondary: 'rgba(255, 255, 255, 0.04)',
    colorFillTertiary: 'rgba(255, 255, 255, 0.03)',
    colorFillQuaternary: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    borderRadiusXS: 2,
    fontFamily: sansStack,
    fontSize: 14,
    lineHeight: 1.5,
    boxShadow: 'rgba(0, 0, 0, 0.35) 0px 0px 0px 1px',
    boxShadowSecondary: 'rgba(0, 0, 0, 0.45) 0px 8px 24px',
    boxShadowTertiary: 'rgba(0, 0, 0, 0.24) 0px 1.2px 0px 0px',
    controlOutline: 'rgba(142, 162, 255, 0.22)',
    controlOutlineWidth: 3,
    wireframe: false,
  },
  components: {
    ...sharedComponents,
    Layout: {
      headerBg: '#141a22',
      bodyBg: '#0d1117',
      triggerBg: '#141a22',
    },
    Button: {
      ...sharedComponents.Button,
      defaultBg: '#171f29',
      defaultColor: '#edf2f7',
      defaultBorderColor: '#2e3948',
      primaryColor: '#0d1117',
      colorPrimary: '#8ea2ff',
      colorPrimaryHover: '#bbc6ff',
      colorPrimaryActive: '#7b91ff',
    },
    Card: {
      ...sharedComponents.Card,
      colorBgContainer: '#141a22',
    },
    Input: {
      ...sharedComponents.Input,
      activeBorderColor: '#8ea2ff',
      hoverBorderColor: '#3a4659',
      activeShadow: '0 0 0 3px rgba(142, 162, 255, 0.22)',
      colorBgContainer: '#171f29',
      colorTextPlaceholder: '#738096',
    },
    InputNumber: {
      ...sharedComponents.InputNumber,
      activeBorderColor: '#8ea2ff',
      hoverBorderColor: '#3a4659',
      activeShadow: '0 0 0 3px rgba(142, 162, 255, 0.22)',
    },
    Select: {
      ...sharedComponents.Select,
      activeBorderColor: '#8ea2ff',
      hoverBorderColor: '#3a4659',
      optionSelectedBg: 'rgba(142, 162, 255, 0.16)',
      optionActiveBg: 'rgba(255, 255, 255, 0.06)',
      colorBgContainer: '#171f29',
    },
    Tabs: {
      ...sharedComponents.Tabs,
      itemColor: '#97a3b6',
      itemHoverColor: '#edf2f7',
      itemSelectedColor: '#edf2f7',
      inkBarColor: '#8ea2ff',
    },
    Table: {
      headerBg: 'transparent',
      rowHoverBg: 'rgba(255, 255, 255, 0.04)',
      headerColor: '#97a3b6',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      colorBgContainer: 'transparent',
    },
    Modal: {
      ...sharedComponents.Modal,
      contentBg: '#141a22',
      headerBg: '#141a22',
      footerBg: '#141a22',
      titleColor: '#edf2f7',
    },
    Drawer: {
      colorBgElevated: '#141a22',
    },
    Popover: {
      colorBgElevated: '#171f29',
    },
    Notification: {
      colorBgElevated: '#171f29',
    },
    Breadcrumb: {
      linkColor: '#97a3b6',
      itemColor: '#97a3b6',
      lastItemColor: '#edf2f7',
      separatorColor: '#738096',
    },
    Typography: {
      titleMarginBottom: '0.5em',
      titleMarginTop: 0,
      colorLink: '#9dacff',
      colorLinkHover: '#bbc6ff',
    },
    Tag: {
      ...sharedComponents.Tag,
      colorBorder: '#2e3948',
    },
    Timeline: {
      ...sharedComponents.Timeline,
      tailColor: 'rgba(255, 255, 255, 0.12)',
    },
    List: {
      colorBorder: 'rgba(255, 255, 255, 0.08)',
    },
    Empty: {
      colorTextDisabled: '#738096',
    },
    Spin: {
      colorPrimary: '#8ea2ff',
    },
    Form: {
      ...sharedComponents.Form,
      labelColor: '#c6d0dd',
    },
    Checkbox: {
      colorPrimary: '#8ea2ff',
      colorPrimaryHover: '#bbc6ff',
    },
    Radio: {
      colorPrimary: '#8ea2ff',
    },
    Switch: {
      colorPrimary: '#8ea2ff',
    },
  },
};

export function buildAntdTheme(mode: UiTheme): ThemeConfig {
  return mode === 'dark' ? darkTheme : lightTheme;
}

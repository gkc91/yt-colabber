const tintColorLight = '#2f95dc';
const tintColorDark = '#fff';

export default {
  light: {
    text: '#000',
    background: '#fff',
    tint: tintColorLight,
    onTint: '#fff',
    border: '#d0d4da',
    muted: '#6b7280',
    danger: '#c62828',
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#fff',
    background: '#000',
    tint: tintColorDark,
    onTint: '#000',
    border: '#3a3f47',
    muted: '#9ca3af',
    danger: '#ef5350',
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
  },
};

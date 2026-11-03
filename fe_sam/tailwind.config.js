
// Bảng màu SAM theo bố cục, cách trang trí của phần mềm quản lý tài sản đang dùng (cho người dùng quen mắt):
// thanh menu sáng, dải tab xanh lam đậm, nút viền xám, nút Thêm đỏ cam, dòng đang chọn tô hồng, liên kết xanh dương.
// Màu đèn tông trầm, đủ phân biệt.
// Giữ đồng bộ với các biến --color-* trong src/index.css (dùng cho style nội dòng của ô đèn, biểu đồ).
const defaultTheme = require('tailwindcss/defaultTheme');

const colors = {
  paper: '#eef1f3',
  surface: '#ffffff',
  sunken: '#f5f6f7',
  ink: { DEFAULT: '#222b35', 2: '#3b4552' },
  muted: '#5f6a77',
  subtle: '#8b949f',
  rule: { DEFAULT: '#d6dade', 2: '#e7e9ec' },
  accent: { DEFAULT: '#2a78b8', hover: '#1f6399', soft: '#e7f1fa', line: '#b6d3ec' },
  band: { DEFAULT: '#165f6e', dark: '#114c58', light: '#2a7887' },
  create: { DEFAULT: '#e6503a', hover: '#cf4430' },
  sel: { DEFAULT: '#f7d4d8', strong: '#ebb3ba' },
  'l-red': { DEFAULT: '#b3372f', soft: '#fbeceb' },
  'l-orange': { DEFAULT: '#c25f1c', soft: '#fcefe4' },
  'l-amber': { DEFAULT: '#a87c12', soft: '#fbf3dc' },
  'l-green': { DEFAULT: '#2c7a4f', soft: '#e8f3ec' },
  'l-blue': { DEFAULT: '#2d62a0', soft: '#e9eff8' },
  'l-gray': { DEFAULT: '#6f7783', soft: '#eff1f3' },
};

module.exports = {
  content: ['./src/**/*.{js,jsx}', './public/index.html'],
  theme: {
    extend: {
      colors,
      borderColor: { DEFAULT: colors.rule.DEFAULT },
      fontFamily: {
        sans: ['"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};

import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  build: {
    // Оптимизация разделения чанков для лучшего кэширования
    rollupOptions: {
      output: {
        manualChunks: {
          // React и основные библиотеки — отдельный чанк (редко меняется)
          'vendor-react': ['react', 'react-dom'],
          // Supabase — отдельный чанк
          'vendor-supabase': ['@supabase/supabase-js'],
          // Lucide иконки — отдельный чанк
          'vendor-icons': ['lucide-react'],
          // MUI — отдельный чанк (тяжёлый, но редко меняется)
          'vendor-mui': ['@mui/material', '@mui/icons-material'],
          // Radix UI — отдельный чанк
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-slot',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
        },
      },
    },
    //_chunk размер для предупреждений (увеличим чтобы не спамило)
    chunkSizeWarningLimit: 1000,
  },
})

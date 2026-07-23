import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/electric/',
  server: {
    proxy: {
      // /famma-proxy/… → https://njfulpklvqezflxiozhn.supabase.co/…
      '/famma-proxy': {
        target: 'https://njfulpklvqezflxiozhn.supabase.co',
        changeOrigin: true,
        secure: false,                    // skip expired SSL cert
        rewrite: (path) => path.replace(/^\/famma-proxy/, ''),
      },
    },
  },
})

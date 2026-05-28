import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1", // บังคับให้วิ่งเข้า IP ตรงๆ แทนคำว่า localhost
    port: 5173,
    open: true, // หรือใส่เป็น 'http://127.0.0.1:5173'
  },
});

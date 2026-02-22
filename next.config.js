/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3', 'ws'],
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei', '@react-spring/three'],
};

module.exports = nextConfig;

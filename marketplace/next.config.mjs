import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: path.resolve('.'),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cnqscknjrijazcfrdhbx.supabase.co', // Your exact Supabase domain
        port: '',
        pathname: '/storage/v1/object/public/**', // Allows any image in your public buckets
      },
    ],
  },
};

export default nextConfig;
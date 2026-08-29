import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

/**
 * Official Cloudflare Brand Logo (SVG)
 */
export const CloudflareLogo: React.FC<IconProps> = ({ className = "w-5 h-5", size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M23.992 18.572c-.053-.456-.25-.873-.559-1.189a2.023 2.023 0 00-1.282-.572c-.116 0-.23.011-.343.033-.312-1.84-1.745-3.23-3.52-3.23-.743 0-1.428.243-1.993.655a4.343 4.343 0 00-4.04-2.615c-2.296 0-4.179 1.76-4.393 4.026a2.91 2.91 0 00-1.077-.206C5.14 15.474 4 16.634 4 18.064c0 .126.01.25.027.371a3.02 3.02 0 00-.73 1.942c0 1.677 1.34 3.04 2.993 3.04h17.485c1.782 0 3.225-1.464 3.225-3.272 0-1.391-.856-2.58-2.008-3.073v-.5z" 
      fill="#F38020" 
    />
    <path 
      d="M24.775 17.514a3.178 3.178 0 00-2.065-1.272c-.116 0-.23.011-.343.033-.312-1.84-1.745-3.23-3.52-3.23-.743 0-1.428.243-1.993.655a4.343 4.343 0 00-4.04-2.615c-2.296 0-4.179 1.76-4.393 4.026a2.91 2.91 0 00-1.077-.206c-1.645 0-2.98 1.334-2.98 2.98 0 .126.01.25.027.371a3.02 3.02 0 00-.73 1.942c0 1.677 1.34 3.04 2.993 3.04h17.485c1.782 0 3.225-1.464 3.225-3.272 0-1.127-.565-2.122-1.432-2.702z" 
      fill="#FAAE40" 
    />
    <path 
      d="M23.992 18.572c-.053-.456-.25-.873-.559-1.189a2.023 2.023 0 00-1.282-.572c-.116 0-.23.011-.343.033-.312-1.84-1.745-3.23-3.52-3.23-.743 0-1.428.243-1.993.655-.178-.063-.365-.1-.559-.109a4.344 4.344 0 013.987 4.298v.178c0 .359-.062.703-.178 1.026h2.894c.942 0 1.716-.763 1.716-1.716 0-.612-.321-1.15-.804-1.455-.382-.416-.957-.684-1.359-.919z" 
      fill="#F38020" 
    />
  </svg>
);

/**
 * Official Alibaba Cloud / 阿里云 Brand Logo (SVG)
 */
export const AliyunLogo: React.FC<IconProps> = ({ className = "w-5 h-5", size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect width="32" height="32" rx="7" fill="#FF6A00" />
    <path 
      d="M10.8 11.2C9.25 11.2 8 12.45 8 14v4c0 1.55 1.25 2.8 2.8 2.8h1.4v-2.2h-1.4c-.33 0-.6-.27-.6-.6v-4c0-.33.27-.6.6-.6h1.4v-2.2h-1.4zm10.4 0h-1.4v2.2h1.4c.33 0 .6.27.6.6v4c0 .33-.27.6-.6.6h-1.4v2.2h1.4c1.55 0 2.8-1.25 2.8-2.8v-4c0-1.55-1.25-2.8-2.8-2.8z" 
      fill="#FFFFFF" 
    />
    <rect x="12.5" y="14.8" width="7" height="2.4" rx="1.2" fill="#FFFFFF" />
  </svg>
);

/**
 * Official Tencent Cloud / 腾讯云 DNSPod Brand Logo (SVG)
 */
export const TencentCloudLogo: React.FC<IconProps> = ({ className = "w-5 h-5", size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect width="32" height="32" rx="7" fill="#0052D9" />
    {/* Tencent Cloud Iconic Interlinked Cloud Nodes */}
    <circle cx="16" cy="11.5" r="3.2" fill="#FFFFFF" />
    <circle cx="10.5" cy="19.5" r="2.8" fill="#FFFFFF" />
    <circle cx="21.5" cy="19.5" r="2.8" fill="#FFFFFF" />
    <path 
      d="M16 12.5L10.5 19.5h11L16 12.5z" 
      stroke="#FFFFFF" 
      strokeWidth="1.8" 
      strokeLinejoin="round" 
    />
    <circle cx="16" cy="17.2" r="1.2" fill="#0052D9" />
  </svg>
);

/**
 * Official Huawei Cloud / 华为云 Brand Logo (SVG)
 */
export const HuaweiCloudLogo: React.FC<IconProps> = ({ className = "w-5 h-5", size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect width="32" height="32" rx="7" fill="#E60012" />
    {/* Huawei 8-Petal Fan Shape */}
    <path 
      d="M16 6.5c-.8 2.2-1.5 5.5-.3 7.8.3.6.8.8 1.4.5.6-.3.8-.8.5-1.4-.8-1.8-.4-4.5.4-6.3.2-.4 0-.8-.4-.9-.5-.1-1.2-.1-1.6.3zM10.8 9.5c-.2 2.3.2 5.6 2.3 7.4.5.4 1.1.3 1.5-.2.4-.5.3-1.1-.2-1.5-1.7-1.4-2-4.1-1.8-6.1.1-.5-.3-.9-.7-.9-.4 0-.9.6-1.1 1.3zM21.2 9.5c.2 2.3-.2 5.6-2.3 7.4-.5.4-1.1.3-1.5-.2-.4-.5-.3-1.1.2-1.5 1.7-1.4 2-4.1 1.8-6.1-.1-.5.3-.9.7-.9.4 0 .9.6 1.1 1.3z" 
      fill="#FFFFFF" 
    />
    <path 
      d="M7.8 14.5c.6 2.2 2.4 5.1 4.9 6 .6.2 1.2 0 1.4-.6.2-.6 0-1.2-.6-1.4-2-.8-3.5-3.1-4-4.9-.1-.5-.6-.7-1.1-.5-.4.2-.7.8-.6 1.4zM24.2 14.5c-.6 2.2-2.4 5.1-4.9 6-.6.2-1.2 0-1.4-.6-.2-.6 0-1.2.6-1.4 2-.8 3.5-3.1 4-4.9.1-.5.6-.7 1.1-.5.4.2.7.8.6 1.4z" 
      fill="#FFFFFF" 
    />
  </svg>
);

/**
 * SSH Host / 远程服务器 Terminal Logo (SVG)
 */
export const SSHHostLogo: React.FC<IconProps> = ({ className = "w-5 h-5", size = 20 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect width="32" height="32" rx="7" fill="#0F172A" />
    {/* Terminal Header */}
    <rect x="4" y="6" width="24" height="20" rx="3" fill="#1E293B" stroke="#334155" strokeWidth="1" />
    <circle cx="7.5" cy="9.5" r="1" fill="#EF4444" />
    <circle cx="10.5" cy="9.5" r="1" fill="#F59E0B" />
    <circle cx="13.5" cy="9.5" r="1" fill="#10B981" />
    {/* Terminal Prompt >_ */}
    <path d="M8 15l3.5 3L8 21" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="14" y1="21" x2="19" y2="21" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <meta name="description" content="Speech to Text Application" />
        {/* Add permission meta tag */}
        <meta name="permissions-policy" content="microphone=*" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
} 
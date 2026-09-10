import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import privacyMarkdown from '../content/informativa-privacy.md?raw';
import './PrivacyPage.css';

const markdownComponents = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

export default function PrivacyPage() {
  return (
    <article className="privacy-page">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {privacyMarkdown}
      </ReactMarkdown>
    </article>
  );
}

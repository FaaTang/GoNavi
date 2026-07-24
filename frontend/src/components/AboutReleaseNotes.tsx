import React, { useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BrowserOpenURL } from '../../wailsjs/runtime';
import './AboutReleaseNotes.css';

type AboutReleaseNotesProps = {
  notes: string;
  hasUpdate: boolean;
  title: string;
  latestTitle: string;
  darkMode: boolean;
};

const remarkPlugins = [remarkGfm];

export const AboutReleaseNotes: React.FC<AboutReleaseNotesProps> = ({
  notes,
  hasUpdate,
  title,
  latestTitle,
  darkMode,
}) => {
  const text = String(notes || '').trim();

  const onLinkClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = String(anchor.getAttribute('href') || '').trim();
    if (!/^https?:\/\//i.test(href)) return;
    event.preventDefault();
    BrowserOpenURL(href);
  }, []);

  if (!text) {
    return null;
  }

  return (
    <div className={`about-release-section${darkMode ? ' about-release-section--dark' : ''}`}>
      <div className="about-release-section-title">
        <span>{hasUpdate ? title : latestTitle}</span>
      </div>
      <div className="about-update-notes" onClick={onLinkClick}>
        <ReactMarkdown remarkPlugins={remarkPlugins}>{text}</ReactMarkdown>
      </div>
    </div>
  );
};

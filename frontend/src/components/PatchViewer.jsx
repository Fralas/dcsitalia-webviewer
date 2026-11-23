import { useEffect } from 'react';
import Patch3D from './Patch3D';

/** Full-screen single patch in 3D (claim toast, any single-patch opening). Esc or click outside closes. */
export default function PatchViewer({ achievement, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const imageUrl = achievement?.imageUrl || '';
  const name = achievement?.name || 'Patch';
  const description = achievement?.description || 'Nessuna descrizione disponibile.';

  return (
    <div className="profile-viewer" onClick={onClose}>
      <button
        type="button"
        className="profile-viewer__close"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        Chiudi
      </button>
      <div className="profile-viewer__stage" onClick={(event) => event.stopPropagation()}>
        <p className="profile-viewer__name">{name}</p>
        <p className="profile-viewer__desc">{description}</p>
        <Patch3D imageUrl={imageUrl} name={name} wheelZoom />
      </div>
    </div>
  );
}

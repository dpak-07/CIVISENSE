import { useEffect } from 'react';
import './Modal.css';
import { HiXMark } from 'react-icons/hi2';

export default function Modal({
    isOpen,
    onClose,
    title,
    subtitle = '',
    children,
    size = 'md',
    closeOnBackdrop = true
}) {
    useEffect(() => {
        if (!isOpen) return undefined;

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                onClose?.();
            }
        };

        document.body.classList.add('modal-open');
        window.addEventListener('keydown', handleEscape);

        return () => {
            document.body.classList.remove('modal-open');
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="modal-overlay"
            onClick={closeOnBackdrop ? onClose : undefined}
            role="presentation"
        >
            <div
                className={`modal modal--${size}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal__header">
                    <div className="modal__title-wrap">
                        <h3 className="modal__title">{title}</h3>
                        {subtitle ? <p className="modal__subtitle">{subtitle}</p> : null}
                    </div>
                    <button type="button" className="modal__close" onClick={onClose}>
                        <HiXMark />
                    </button>
                </div>
                <div className="modal__body">{children}</div>
            </div>
        </div>
    );
}

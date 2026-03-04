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
    closeOnBackdrop = true,
    bodyScrollable = true,
    overlayClassName = '',
    modalClassName = '',
    bodyClassName = ''
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

    const overlayClasses = [
        'modal-overlay',
        bodyScrollable ? '' : 'modal-overlay--stacked',
        overlayClassName
    ]
        .filter(Boolean)
        .join(' ');

    const modalClasses = [
        `modal modal--${size}`,
        bodyScrollable ? '' : 'modal--static',
        modalClassName
    ]
        .filter(Boolean)
        .join(' ');

    const bodyClasses = [
        'modal__body',
        bodyScrollable ? '' : 'modal__body--static',
        bodyClassName
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div
            className={overlayClasses}
            onClick={closeOnBackdrop ? onClose : undefined}
            role="presentation"
        >
            <div
                className={modalClasses}
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
                <div className={bodyClasses}>{children}</div>
            </div>
        </div>
    );
}

import { useEffect } from 'react';
import { HiXMark } from 'react-icons/hi2';

export default function Modal({
    isOpen,
    onClose,
    title,
    subtitle = '',
    children,
    size = 'md',
    closeOnBackdrop = true,
    className = '',
    bodyClassName = '',
    bodyScrollable = true
}) {
    const sizeClasses = {
        sm: 'max-w-xl',
        md: 'max-w-2xl',
        lg: 'max-w-4xl',
        xl: 'max-w-6xl'
    };

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
            className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:px-6"
            onClick={closeOnBackdrop ? onClose : undefined}
            role="presentation"
        >
            <div className="relative mx-auto flex min-h-full items-center justify-center">
                <div
                    className={`w-full ${sizeClasses[size] || sizeClasses.md} overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_40px_120px_-40px_rgba(15,23,42,0.6)] ${className}`.trim()}
                    role="dialog"
                    aria-modal="true"
                    aria-label={title}
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-7">
                        <div className="space-y-1">
                            <h3 className="text-2xl font-bold text-slate-950">{title}</h3>
                            {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
                        </div>
                        <button
                            type="button"
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-sky-200 hover:text-sky-700"
                            onClick={onClose}
                        >
                            <HiXMark />
                        </button>
                    </div>
                    <div
                        className={`px-6 py-6 sm:px-7 ${bodyScrollable ? 'max-h-[75vh] overflow-y-auto' : ''} ${bodyClassName}`.trim()}
                    >
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

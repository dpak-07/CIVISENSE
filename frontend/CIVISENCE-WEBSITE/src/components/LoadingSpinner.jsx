import './LoadingSpinner.css';

export default function LoadingSpinner({ fullPage, size = 40 }) {
    if (fullPage) {
        return (
            <div className="spinner-fullpage">
                <div className="spinner" style={{ width: size, height: size }} />
            </div>
        );
    }
    return <div className="spinner" style={{ width: size, height: size }} />;
}

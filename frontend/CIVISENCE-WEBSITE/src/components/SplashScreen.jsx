import CiviSenseLogo from './branding/CiviSenseLogo';
import './SplashScreen.css';

export default function SplashScreen() {
    return (
        <div className="splash-screen" role="status" aria-live="polite">
            <div className="splash-screen__aurora" aria-hidden="true" />
            <div className="splash-screen__center">
                <CiviSenseLogo size={96} className="splash-screen__logo" />
                <h1>CiviSense</h1>
                <p>Smart civic intelligence in motion</p>
                <div className="splash-screen__loader" aria-hidden="true">
                    <span />
                </div>
            </div>
            <div className="splash-screen__scan" aria-hidden="true" />
        </div>
    );
}

import './StatsCard.css';

export default function StatsCard({ icon, label, value, color = 'primary', trend }) {
    return (
        <div className={`stats-card stats-card--${color}`}>
            <div className="stats-card__icon">{icon}</div>
            <div className="stats-card__content">
                <span className="stats-card__value">{value}</span>
                <span className="stats-card__label">{label}</span>
            </div>
            {trend !== undefined && (
                <span className={`stats-card__trend ${trend >= 0 ? 'up' : 'down'}`}>
                    {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
                </span>
            )}
        </div>
    );
}

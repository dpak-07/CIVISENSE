import './EmptyState.css';
import { HiOutlineInbox } from 'react-icons/hi2';

export default function EmptyState({ title = 'No data found', message = 'There are no items to display yet.', icon }) {
    return (
        <div className="empty-state">
            <div className="empty-state__icon">{icon || <HiOutlineInbox />}</div>
            <h3 className="empty-state__title">{title}</h3>
            <p className="empty-state__message">{message}</p>
        </div>
    );
}
